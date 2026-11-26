import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";
import type { MealPlannerJob } from "@prisma/client";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { prisma } from "../../config/prisma.js";
import { requireHousehold } from "./households.js";
import { berlinDate, generatePlan } from "./plans.js";
import { fail } from "./recipes.js";
import { withPicnic } from "./picnic.js";
import { transferCart } from "./shopping.js";

const imagePayload = z.object({ dishId: z.string(), index: z.number().int().nonnegative(), prompt: z.string() });
const cartPayload = z.object({ planId: z.string(), lines: z.array(z.object({ productId: z.string(), count: z.number().int().positive() })) });
const planPayload = z.object({ weekStart: z.string() });
const lease = () => new Date(Date.now() + 5 * 60_000);

export function scheduleWindow(now: Date) {
  const day = new Date(berlinDate(now));
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", hour: "2-digit", hourCycle: "h23" }).format(now));
  day.setUTCDate(day.getUTCDate() - day.getUTCDay() - (day.getUTCDay() === 0 && hour < 9 ? 7 : 0));
  const sunday = day.toISOString().slice(0, 10);
  day.setUTCDate(day.getUTCDate() + 1);
  return { sunday, weekStart: day.toISOString().slice(0, 10) };
}

export async function enqueueSundayPlans(now = new Date()) {
  const { sunday, weekStart } = scheduleWindow(now);
  const households = await prisma.mealHousehold.findMany({ where: { autoPlan: true } });
  for (const household of households) {
    if (household.autoPlanSince) {
      const startedDay = berlinDate(household.autoPlanSince);
      if (startedDay > sunday) continue;
      if (startedDay === sunday && scheduleWindow(household.autoPlanSince).sunday === sunday) continue;
    }
    const plan = await prisma.weeklyMealPlan.findUnique({ where: { householdId_weekStart: { householdId: household.id, weekStart } }, select: { id: true } });
    if (plan) continue;
    const jobKey = weekStart;
    await prisma.mealPlannerJob.upsert({
      where: { householdId_kind_jobKey: { householdId: household.id, kind: "weekly", jobKey } },
      create: { householdId: household.id, kind: "weekly", jobKey, payload: JSON.stringify({ weekStart }) }, update: {}
    });
  }
}

export async function jobView(userId: string) {
  const { householdId } = await requireHousehold(userId, true);
  const jobs = await prisma.mealPlannerJob.findMany({
    where: { householdId, OR: [{ kind: { in: ["weekly", "notify", "cart"] } }, { kind: "image", state: "failed" }] },
    orderBy: { createdAt: "desc" }, take: 30,
    select: { id: true, kind: true, jobKey: true, state: true, error: true, updatedAt: true, result: true }
  });
  return jobs.map(({ result, ...job }) => ({ ...job, ready: job.kind === "weekly" && job.state === "done" && Boolean(result) }));
}

export async function retryJob(userId: string, id: string) {
  const { householdId } = await requireHousehold(userId, true);
  const result = await prisma.mealPlannerJob.updateMany({
    where: { id, householdId, state: "failed", kind: { not: "cart" } },
    data: { state: "queued", error: null, leaseUntil: null, leaseToken: null }
  });
  if (!result.count) throw fail(409, "Dieser Auftrag kann nicht neu gestartet werden.");
}

export async function runPlannerJob(kind: "image" | "weekly" | "notify" | "cart") {
  const now = new Date();
  const ready = { OR: [{ state: "queued" }, { state: "running", leaseUntil: { lt: now } }] };
  const job = await prisma.mealPlannerJob.findFirst({ where: { ...ready, kind }, orderBy: { createdAt: "asc" } });
  if (!job) return;
  const ownership = { id: job.id, leaseToken: randomUUID() };
  const claimed = await prisma.mealPlannerJob.updateMany({
    where: { ...ready, id: job.id }, data: {
      state: "running", leaseUntil: lease(), leaseToken: ownership.leaseToken, attempts: { increment: 1 }
    }
  });
  if (!claimed.count) return;
  const save = async (result: unknown) => {
    const saved = await prisma.mealPlannerJob.updateMany({ where: ownership, data: { result: JSON.stringify(result), leaseUntil: lease() } });
    if (!saved.count) throw new Error("Der Hintergrundauftrag wurde übernommen.");
  };
  try {
    const payload: unknown = JSON.parse(job.payload);
    if (kind === "weekly") {
      const planId = await createScheduledPlan(job, planPayload.parse(payload).weekStart);
      if (planId) await save({ planId });
    }
    if (kind === "notify") await sendNotification(job.householdId, planPayload.parse(payload).weekStart);
    if (kind === "image") await generateImage(job, imagePayload.parse(payload), save);
    if (kind === "cart") {
      const { lines } = cartPayload.parse(payload);
      const owner = await prisma.mealHouseholdMember.findFirst({ where: { householdId: job.householdId, role: "owner", userId: env.MEAL_PICNIC_OWNER_ID, user: { status: "ACTIVE" } } });
      if (!owner) throw new Error("Picnic ist für diesen Haushalt nicht eingerichtet.");
      const progress = z.record(z.object({ before: z.number(), done: z.boolean() })).parse(job.result ? JSON.parse(job.result) : {});
      await withPicnic((call) => transferCart(call, lines, progress, save));
    }
    await finish("done");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Hintergrundauftrag fehlgeschlagen.";
    logger.warn({ jobId: job.id, kind }, message);
    await finish("failed", message.slice(0, 400));
  }

  async function finish(state: "done" | "failed", error?: string) {
    await prisma.$transaction(async (tx) => {
      const result = await tx.mealPlannerJob.updateMany({
        where: ownership, data: { state, error: error ?? null, leaseUntil: null, leaseToken: null }
      });
      if (result.count && kind === "cart") {
        const { planId } = cartPayload.parse(JSON.parse(job!.payload));
        await tx.mealShoppingList.updateMany({ where: { planId, state: "transferring" }, data: { state: state === "done" ? "transferred" : "review" } });
      }
    });
  }
}

async function createScheduledPlan(job: MealPlannerJob, weekStart: string) {
  const owner = await prisma.mealHouseholdMember.findFirst({
    where: { householdId: job.householdId, role: "owner", user: { status: "ACTIVE" } }, include: { household: true }
  });
  if (!owner) throw new Error("Kein aktives Konto für die Haushaltsplanung.");
  if (!owner.household.autoPlan) return;
  const plan = await generatePlan(owner.userId, weekStart, { mode: "ai" });
  if (plan.status !== "draft") return;
  if (env.MEAL_NTFY_URL && env.MEAL_PUBLIC_URL && owner.userId === env.MEAL_NTFY_OWNER_ID) {
    await prisma.mealPlannerJob.upsert({
      where: { householdId_kind_jobKey: { householdId: job.householdId, kind: "notify", jobKey: weekStart } },
      create: { householdId: job.householdId, kind: "notify", jobKey: weekStart, payload: JSON.stringify({ weekStart }) }, update: {}
    });
  }
  return plan.id;
}

async function sendNotification(householdId: string, weekStart: string) {
  const owner = await prisma.mealHouseholdMember.findFirst({ where: { householdId, role: "owner", userId: env.MEAL_NTFY_OWNER_ID, user: { status: "ACTIVE" } } });
  if (!owner) throw new Error("ntfy ist für diesen Haushalt nicht eingerichtet.");
  if (!env.MEAL_NTFY_URL || !env.MEAL_PUBLIC_URL) throw new Error("ntfy ist noch nicht konfiguriert.");
  const link = new URL("/meal-planner?week=" + weekStart, env.MEAL_PUBLIC_URL);
  const response = await fetch(env.MEAL_NTFY_URL, {
    method: "POST", signal: AbortSignal.timeout(15_000),
    headers: { title: "BodyDashboard", click: link.href, ...(env.MEAL_NTFY_TOKEN ? { authorization: "Bearer " + env.MEAL_NTFY_TOKEN } : {}) },
    body: "Der Wochenentwurf ist bereit."
  }).catch(() => null);
  if (!response?.ok) throw new Error("Die ntfy-Benachrichtigung konnte nicht zugestellt werden.");
}

const imageInfo = z.object({ filename: z.string(), subfolder: z.string().default(""), type: z.literal("output") });

async function generateImage(job: MealPlannerJob, input: z.infer<typeof imagePayload>, save: (result: unknown) => Promise<void>) {
  if (!env.MEAL_COMFY_URL || !env.MEAL_COMFY_WORKFLOW) throw new Error("ComfyUI ist noch nicht konfiguriert.");
  const base = env.MEAL_COMFY_URL.replace(/\/+$/, "");
  const headers = env.MEAL_COMFY_TOKEN ? { authorization: "Bearer " + env.MEAL_COMFY_TOKEN } : undefined;
  let promptId = (job.result ? JSON.parse(job.result) as { promptId?: string } : {}).promptId;
  if (!promptId) {
    let template: string;
    try { template = await readFile(env.MEAL_COMFY_WORKFLOW, "utf8"); } catch { throw new Error("Der ComfyUI-Workflow konnte nicht gelesen werden."); }
    if (!template.includes("{{MEAL_PROMPT}}")) throw new Error("Im ComfyUI-Workflow fehlt {{MEAL_PROMPT}}.");
    const text = JSON.stringify("Realistisches Rezeptfoto: " + input.prompt).slice(1, -1);
    const prompt = JSON.parse(template.replaceAll("{{MEAL_PROMPT}}", () => text)) as unknown;
    const response = await fetch(base + "/prompt", {
      method: "POST", headers: { ...headers, "content-type": "application/json" }, signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({ prompt, client_id: job.id })
    });
    if (!response.ok) throw new Error("ComfyUI hat den Workflow abgelehnt.");
    promptId = z.object({ prompt_id: z.string().min(1) }).parse(await response.json()).prompt_id;
    await save({ promptId });
  }
  let image: z.infer<typeof imageInfo> | undefined;
  for (let attempt = 0; attempt < 30 && !image; attempt++) {
    const response = await fetch(base + "/history/" + encodeURIComponent(promptId), { headers, signal: AbortSignal.timeout(5_000) });
    if (!response.ok) throw new Error("ComfyUI-Auftragsstatus konnte nicht geladen werden.");
    const history = await response.json() as Record<string, { status?: { status_str?: string }; outputs?: Record<string, { images?: unknown[] }> }>;
    const result = history[promptId];
    if (result?.status?.status_str === "error") {
      await save({});
      throw new Error("ComfyUI konnte das Rezeptbild nicht erzeugen.");
    }
    const pictures = Object.values(result?.outputs ?? {}).flatMap((output) => output.images ?? []);
    for (const picture of pictures) {
      const parsed = imageInfo.safeParse(picture);
      if (parsed.success) { image = parsed.data; break; }
    }
    if (!image) await delay(2000);
  }
  if (!image) throw new Error("Das ComfyUI-Ergebnis liegt noch nicht vor. Der Auftrag kann erneut abgefragt werden.");
  const response = await fetch(base + "/view?" + new URLSearchParams(image), { headers, signal: AbortSignal.timeout(15_000) });
  const mediaType = response.headers.get("content-type") ?? "";
  if (!response.ok || !["image/png", "image/jpeg", "image/webp"].includes(mediaType)) throw new Error("ComfyUI hat kein unterstütztes Bild geliefert.");
  const contents = Buffer.from(await response.arrayBuffer());
  if (contents.byteLength > 15_000_000) throw new Error("Das Rezeptbild ist zu groß.");
  await mkdir(env.MEAL_IMAGE_DIR, { recursive: true });
  const imageName = job.id + "." + mediaType.split("/")[1];
  await writeFile(path.join(env.MEAL_IMAGE_DIR, imageName), contents);
  await prisma.$transaction(async (tx) => {
    const dish = await tx.weeklyMealDish.findUniqueOrThrow({ where: { id: input.dishId } });
    const images = dish.images ? JSON.parse(dish.images) as Record<string, string> : {};
    await tx.weeklyMealDish.update({ where: { id: input.dishId }, data: { images: JSON.stringify({ ...images, [input.index]: imageName }) } });
  });
}

export async function readDishImage(userId: string, id: string, index: string) {
  const { householdId } = await requireHousehold(userId);
  const dish = await prisma.weeklyMealDish.findFirst({
    where: { id, plan: { householdId, status: "approved" } }, select: { images: true }
  });
  const filename = dish?.images ? (JSON.parse(dish.images) as Record<string, string>)[index] : undefined;
  if (!filename || !/^[a-z0-9]+\.(png|jpeg|webp)$/.test(filename)) throw fail(404, "Rezeptbild nicht gefunden.");
  try {
    return { contents: await readFile(path.join(env.MEAL_IMAGE_DIR, filename)), mediaType: "image/" + filename.split(".")[1] };
  } catch {
    throw fail(404, "Rezeptbild nicht gefunden.");
  }
}

export function startMealPlannerWorker() {
  let scheduling = false;
  const active = new Set<string>();
  const tick = () => {
    if (!scheduling) {
      scheduling = true;
      void enqueueSundayPlans().catch(() => logger.warn("Die Wochenplanung konnte nicht geprüft werden.")).finally(() => { scheduling = false; });
    }
    for (const kind of ["weekly", "notify", "image", "cart"] as const) {
      if (active.has(kind)) continue;
      active.add(kind);
      void runPlannerJob(kind).catch(() => logger.warn({ kind }, "Hintergrundauftrag konnte nicht verarbeitet werden.")).finally(() => { active.delete(kind); });
    }
  };
  tick();
  const timer = setInterval(tick, 5000);
  timer.unref();
  return () => clearInterval(timer);
}
