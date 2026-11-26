import { PrismaClient } from "@prisma/client";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { Express } from "express";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

let app: Express;
let db: PrismaClient;
let folder: string;
let ownerId: string;
let memberId: string;
let foodId: string;
let recipeId: string;
let legacyRecipeId: string;
let owner: { Authorization: string };
let member: { Authorization: string };
let stranger: { Authorization: string };
let readKey: string;
let writeKey: string;

const root = "/api/meal-planner";
const week = root + "/plans/2026-11-30";
const requestApi = () => request(app);
const draft = () => ({
  name: "Linsen mit Gemüse", servings: 4, instructions: "Linsen kochen.\nGemüse dazugeben.",
  category: "Pflanzlich", activeMinutes: 30, shared: true,
  ingredients: [{ name: "Linsen", foodId, amount: 400, unit: "g" }]
});

beforeAll(async () => {
  folder = mkdtempSync(join(tmpdir(), "bodydashboard-meal-planner-"));
  const oldDir = join(folder, "pre-migration");
  const oldMigrations = join(oldDir, "migrations");
  mkdirSync(oldMigrations, { recursive: true });
  const migrations = resolve("prisma/migrations");
  for (const name of readdirSync(migrations)) {
    if (!name.endsWith("_meal_planner")) cpSync(join(migrations, name), join(oldMigrations, name), { recursive: true });
  }
  cpSync(resolve("prisma/schema.prisma"), join(oldDir, "schema.prisma"));
  const database = join(folder, "old.db");
  writeFileSync(database, "");
  const fileUrl = (file: string) => "file:" + file.replaceAll("\\", "/");
  process.env.LOG_LEVEL = "silent";
  process.env.MEAL_OPENWEBUI_URL = "http://openwebui.test";
  process.env.MEAL_OPENWEBUI_KEY = "test-key";
  process.env.MEAL_OPENWEBUI_MODEL = "test-model";
  process.env.MEAL_COMFY_URL = "http://comfy.test";
  process.env.MEAL_COMFY_WORKFLOW = join(folder, "workflow.json");
  const require = createRequire(import.meta.url);
  const deploy = (schema: string, url: string) => execFileSync(process.execPath,
    [require.resolve("prisma/build/index.js"), "migrate", "deploy", "--schema", schema],
    { env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" });
  deploy(join(oldDir, "schema.prisma"), fileUrl(database));
  const legacy = new PrismaClient({ datasourceUrl: fileUrl(database) });
  try {
    const first = await legacy.user.create({ data: { name: "Owner", email: "owner@example.invalid", passwordHash: "unused" } });
    ownerId = first.id;
    const oldRecipe = await legacy.recipe.create({ data: { userId: ownerId, name: "Vorhandenes Rezept", instructions: "Mischen.", servings: 2 } });
    legacyRecipeId = oldRecipe.id;
    await legacy.goal.create({ data: { userId: ownerId, calories: 2400, protein: 170 } });
  } finally {
    await legacy.$disconnect();
  }
  const copy = join(folder, "migrated.db");
  cpSync(database, copy);
  process.env.DATABASE_URL = fileUrl(copy);
  process.env.MEAL_NTFY_URL = "http://ntfy.test/meal";
  process.env.MEAL_NTFY_OWNER_ID = ownerId;
  process.env.MEAL_PUBLIC_URL = "https://bodydashboard.test";
  deploy(resolve("prisma/schema.prisma"), process.env.DATABASE_URL);
  db = (await import("../../config/prisma.js")).prisma;
  app = (await import("../../app.js")).createApp();
  const { signAccessToken } = await import("../../middleware/auth.js");
  const tokens = (user: Parameters<typeof signAccessToken>[0]) => ({ Authorization: "Bearer " + signAccessToken(user) });
  owner = tokens(await db.user.findUniqueOrThrow({ where: { id: ownerId } }));
  const second = await db.user.create({ data: { name: "Member", email: "member@example.invalid", passwordHash: "unused" } });
  memberId = second.id;
  member = tokens(second);
  stranger = tokens(await db.user.create({ data: { name: "Stranger", email: "stranger@example.invalid", passwordHash: "unused" } }));
  await db.goal.create({ data: { userId: memberId, calories: 1900, protein: 95 } });
  const food = await db.food.create({
    data: { name: "Linsen", userId: ownerId, caloriesPer100g: 130, protein: 10, fat: 1, carbs: 21, fiber: 8 }
  });
  foodId = food.id;
  const { IntegrationApiKeyService } = await import("../../services/integrations/IntegrationApiKeyService.js");
  const keys = new IntegrationApiKeyService();
  readKey = (await keys.create({ userId: ownerId, name: "Planner read", scopes: ["meal-planner:read"] })).apiKey;
  writeKey = (await keys.create({ userId: ownerId, name: "Planner write", scopes: ["meal-planner:write"] })).apiKey;
}, 30_000);

afterAll(async () => {
  await db?.$disconnect();
  if (folder) rmSync(folder, { recursive: true, force: true });
});
afterEach(() => vi.unstubAllGlobals());

describe("meal planner on an upgraded SQLite database", () => {
  it("keeps legacy recipes private and grants a single-use household invitation", async () => {
    const old = await requestApi().get("/api/recipes/" + legacyRecipeId).set(owner).expect(200);
    expect(old.body).toMatchObject({ name: "Vorhandenes Rezept", servings: 2, shared: false, perPortion: null });
    await requestApi().get("/api/recipes/" + legacyRecipeId).set(member).expect(404);
    const household = await requestApi().post(root + "/household").set(owner).send({ name: "Familie" }).expect(200);
    expect(household.body).toMatchObject({ role: "owner", servings: 4, dishCount: 3, autoPlan: false });
    await requestApi().post(root + "/household").set(owner).send({ name: "Doppelter Haushalt" }).expect(409);
    const revoked = await requestApi().post(root + "/household/invites").set(owner).expect(200);
    const pending = await requestApi().get(root + "/household").set(owner).expect(200);
    expect(pending.body.invitations).toEqual([{ id: revoked.body.id, expiresAt: revoked.body.expiresAt }]);
    await requestApi().delete(root + "/household/invites/" + revoked.body.id).set(owner).expect(204);
    await requestApi().post(root + "/household/join").set(member).send({ token: revoked.body.token }).expect(404);
    const invite = await requestApi().post(root + "/household/invites").set(owner).expect(200);
    const join = await requestApi().post(root + "/household/join").set(member).send({ token: invite.body.token }).expect(200);
    expect(join.body).toMatchObject({ id: household.body.id, role: "member" });
    await requestApi().post(root + "/household/join").set(stranger).send({ token: invite.body.token }).expect(404);
    await requestApi().post(root + "/household/invites").set("x-api-key", writeKey).expect(403);
    await requestApi().get(root + "/household").set("x-api-key", writeKey).expect(403);
    await requestApi().post("/api/integrations/api-keys").set("x-api-key", readKey).send({ name: "Escalation" }).expect(403);
  });

  it("validates plan visibility, recipe sharing and optimistic version checks", async () => {
    const created = await requestApi().post("/api/recipes").set(owner).send(draft()).expect(201);
    recipeId = created.body.id;
    const shared = await requestApi().get("/api/recipes/" + recipeId).set(member).expect(200);
    expect(shared.body.ingredients[0]).toMatchObject({ name: "Linsen", hasNutrition: true });
    expect(shared.body.ingredients[0].foodId).toBeUndefined();
    await requestApi().get("/api/recipes/" + recipeId).set(stranger).expect(404);
    await requestApi().put("/api/recipes/" + recipeId + "/feedback").set(member).send({ favorite: true, rating: 5 }).expect(200);
    const self = await requestApi().get("/api/recipes/" + recipeId).set(owner).expect(200);
    expect(self.body).toMatchObject({ favorite: false, rating: null });
    await requestApi().post(week).set(member).send({ mode: "manual" }).expect(403);
    await requestApi().post(week).set("x-api-key", readKey).send({ mode: "manual" }).expect(403);
    await requestApi().post(week).set("x-api-key", writeKey).send({ mode: "manual", dishes: [{ recipeId: legacyRecipeId }] }).expect(400);
    const createdPlan = await requestApi().post(week).set("x-api-key", writeKey).send({ mode: "manual", dishes: [{ recipeId }] }).expect(200);
    expect(createdPlan.body).toMatchObject({ status: "draft", version: 1 });
    expect((await requestApi().get(week).set(member).expect(200)).body).toBeNull();
    await requestApi().get(week).set(stranger).expect(404);
    const edited = await requestApi().put(week + "/dish").set(owner).send({ version: 1, position: 0, dish: { recipeId, servings: 6 } }).expect(200);
    expect(edited.body).toMatchObject({ version: 2, dishes: [{ servings: 6 }] });
    await requestApi().post(week + "/approve").set(owner).send({ version: 1 }).expect(409);
    const approved = await requestApi().post(week + "/approve").set(owner).send({ version: 2 }).expect(200);
    expect(approved.body).toMatchObject({ status: "approved", version: 3 });
    expect((await requestApi().get(week).set(member).expect(200)).body.status).toBe("approved");
    await requestApi().put("/api/recipes/" + recipeId).set(owner).send({ ...draft(), name: "Geändertes Rezept" }).expect(200);
    const frozen = await requestApi().get(week).set("x-api-key", readKey).expect(200);
    expect(frozen.body.dishes[0].recipe.name).toBe("Linsen mit Gemüse");
  });

  it("writes fractional portions to each account and keeps retries idempotent", async () => {
    const { body: plan } = await requestApi().get(week).set(owner).expect(200);
    const dishId = plan.dishes[0].id;
    const preview = await requestApi().post(root + "/preview").set(member).send({ dishId, portions: 0.5 }).expect(200);
    expect(preview.body).toMatchObject({ goal: { calories: 1900, protein: 95 }, totals: { calories: 65, protein: 5 } });
    await requestApi().post(root + "/preview").set(stranger).send({ dishId, portions: 0.5 }).expect(404);
    const payload = { dishId, date: "2026-12-01", type: "DINNER", portions: 0.5, requestKey: randomUUID() };
    const logged = await requestApi().post(root + "/consumptions").set(member).send(payload).expect(200);
    const replayed = await requestApi().post(root + "/consumptions").set(member).send(payload).expect(200);
    expect(replayed.body).toMatchObject({ id: logged.body.id, replayed: true, totals: preview.body.totals });
    await requestApi().post(root + "/consumptions").set(member).send({ ...payload, portions: 2 }).expect(409);
    const second = await requestApi().post(root + "/consumptions").set(owner).send({ ...payload, portions: 1.5 }).expect(200);
    expect(second.body.totals.calories).toBe(195);
    await requestApi().post(root + "/consumptions").set(owner).send({ ...payload, recipeId: legacyRecipeId, dishId: undefined, requestKey: randomUUID() }).expect(422);
    const diary = await requestApi().get("/api/meals/day/2026-12-01").set(member).expect(200);
    expect(diary.body[0]).toMatchObject({ totals: { calories: 65, protein: 5 }, items: [{ id: logged.body.mealItemId, amount: 50 }] });
    const stats = await requestApi().get("/api/stats/week?start=2026-11-30&end=2026-12-06").set(member).expect(200);
    expect(JSON.stringify(stats.body)).toContain('"calories":65');
    const history = await requestApi().get(root + "/consumptions").set(member).expect(200);
    expect(history.body).toEqual([expect.objectContaining({ portions: 0.5, name: "Linsen mit Gemüse" })]);
    await requestApi().delete("/api/meals/items/" + logged.body.mealItemId).set(member).expect(204);
    expect((await requestApi().post(root + "/consumptions").set(member).send(payload).expect(200)).body.mealItemId).toBeNull();
  });

  it("validates Open WebUI output and keeps personal goals out of the request", async () => {
    await requestApi().put(root + "/household").set(owner).send({ dishCount: 1 }).expect(200);
    const path = root + "/plans/2026-12-07";
    const model = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ choices: [{ message: { content: "invalid" } }] }));
    vi.stubGlobal("fetch", model);
    await requestApi().post(path).set(owner).send({ mode: "ai" }).expect(502);
    expect((await requestApi().get(path).set(owner).expect(200)).body).toBeNull();
    const recipe = { ...draft(), name: "Gericht aus Open WebUI" };
    model.mockResolvedValueOnce(Response.json({ choices: [{ message: { content: JSON.stringify({ dishes: [{ recipe }] }) } }] }));
    const plan = await requestApi().post(path).set(owner).send({ mode: "ai" }).expect(200);
    expect(plan.body.dishes[0].recipe.draft.ingredients[0].foodId).toBe(foodId);
    expect(model.mock.calls[1][0]).toBe("http://openwebui.test/api/chat/completions");
    const body = JSON.parse(String(model.mock.calls[1][1]?.body));
    expect(body.model).toBe("test-model");
    expect(body.messages[1].content).not.toContain("2400");
    expect(body.messages[1].content).not.toContain("1900");
    model.mockResolvedValueOnce(Response.json({ choices: [{ message: { content: JSON.stringify({ dishes: [{ recipe: { ...recipe, name: "Alternative aus Open WebUI" } }] }) } }] }));
    const replacement = await requestApi().put(path + "/dish").set(owner).send({ version: 1, position: 0, mode: "ai" }).expect(200);
    expect(replacement.body.dishes[0].recipe.name).toBe("Alternative aus Open WebUI");
    const approved = await requestApi().post(path + "/approve").set(owner).send({ version: 2 }).expect(200);
    expect(approved.body.dishes[0].recipe.draft).toBeUndefined();
    await requestApi().get("/api/recipes/" + approved.body.dishes[0].recipeId).set(member).expect(200);
  });

  it("aggregates adjusted shopping quantities, tracks leftovers and revokes household access", async () => {
    const stock = await requestApi().post(root + "/pantry").set(owner).send({ name: "Linsen", amount: 0.2, unit: "kg" }).expect(200);
    const prepared = await requestApi().post(week + "/shopping").set(owner).expect(200);
    expect(prepared.body).toMatchObject({ items: [{ name: "Linsen", amount: 400 }], picnicAvailable: false, state: "preview" });
    await requestApi().post(week + "/shopping/confirm").set("x-api-key", writeKey).send({ version: 1 }).expect(403);
    const { body: plan } = await requestApi().get(week).set(member).expect(200);
    await requestApi().post(root + "/dishes/" + plan.dishes[0].id + "/cooked").set(member).send({ used: [{ id: stock.body.id, amount: 0.2 }], leftoverPortions: 2 }).expect(200);
    const ideas = await requestApi().get(root + "/recommendations").set(owner).expect(200);
    expect(ideas.body.leftovers).toEqual([expect.objectContaining({ id: plan.dishes[0].id, portions: 2 })]);
    const leftovers = root + "/plans/2026-12-14";
    await requestApi().post(leftovers).set(owner).send({ mode: "manual", dishes: [{ leftoverDishId: plan.dishes[0].id }] }).expect(200);
    const ready = await requestApi().post(leftovers + "/approve").set(owner).send({ version: 1 }).expect(200);
    expect((await requestApi().post(leftovers + "/shopping").set(owner).expect(200)).body.items).toEqual([]);
    await requestApi().post(root + "/dishes/" + ready.body.dishes[0].id + "/cooked").set(member).send({ used: [], leftoverPortions: 0 }).expect(200);
    const emptied = await requestApi().get(root + "/recommendations").set(owner).expect(200);
    expect(emptied.body.leftovers).toEqual([]);
    await requestApi().delete(root + "/household/members/" + memberId).set(owner).expect(204);
    await requestApi().get(week).set(member).expect(404);
    await requestApi().get("/api/recipes/" + recipeId).set(member).expect(404);
    expect((await requestApi().get(root + "/consumptions").set(member).expect(200)).body).toHaveLength(1);
  });

  it("schedules the correct week across DST, handles a late startup and records image outages", async () => {
    const { scheduleWindow, enqueueSundayPlans, runPlannerJob } = await import("./automation.js");
    expect(scheduleWindow(new Date("2026-03-29T06:59:00Z")).weekStart).toBe("2026-03-23");
    expect(scheduleWindow(new Date("2026-03-29T07:00:00Z")).weekStart).toBe("2026-03-30");
    expect(scheduleWindow(new Date("2026-10-25T08:00:00Z")).weekStart).toBe("2026-10-26");
    expect(scheduleWindow(new Date("2026-10-27T08:00:00Z")).weekStart).toBe("2026-10-26");
    const house = await db.mealHouseholdMember.findUniqueOrThrow({ where: { userId: ownerId } });
    await db.mealHousehold.update({ where: { id: house.householdId }, data: { autoPlan: true, autoPlanSince: new Date("2026-10-20") } });
    await enqueueSundayPlans(new Date("2026-10-26T09:00:00Z"));
    await enqueueSundayPlans(new Date("2026-10-27T09:00:00Z"));
    expect(await db.mealPlannerJob.count({ where: { householdId: house.householdId, kind: "weekly", jobKey: "2026-10-26" } })).toBe(1);
    const schedulerFetch = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ choices: [{ message: { content: JSON.stringify({ dishes: [{ recipeId }] }) } }] }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", schedulerFetch);
    await runPlannerJob("weekly");
    await runPlannerJob("notify");
    expect(schedulerFetch.mock.calls[1][0]).toBe("http://ntfy.test/meal");
    expect(schedulerFetch.mock.calls[1][1]?.headers).toMatchObject({ click: "https://bodydashboard.test/meal-planner?week=2026-10-26" });
    writeFileSync(process.env.MEAL_COMFY_WORKFLOW!, '{"1":{"inputs":{"text":"{{MEAL_PROMPT}}"}}}');
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockRejectedValue(new Error("ComfyUI offline")));
    await runPlannerJob("image");
    const jobs = await requestApi().get(root + "/jobs").set(owner).expect(200);
    expect(jobs.body).toContainEqual(expect.objectContaining({ kind: "weekly", state: "done", ready: true }));
    const imageJob = jobs.body.find((job: { kind: string }) => job.kind === "image");
    expect(imageJob).toMatchObject({ state: "failed" });
    await requestApi().post(root + "/jobs/" + imageJob.id + "/retry").set(owner).expect(204);
  });

  it("reconciles an ambiguous Picnic response before sending any further cart additions", async () => {
    const { transferCart } = await import("./shopping.js");
    let cart = [{ id: "existing", count: 2 }, { id: "lentils", count: 1 }];
    let journal = {};
    const save = async (value: typeof journal) => { journal = structuredClone(value); };
    const call = vi.fn(async (name: string, args?: Record<string, unknown>) => {
      if (name === "picnic_get_cart") return { items: cart };
      if (args?.productId === "lentils") throw new Error("connection lost");
      cart = [...cart, { id: String(args?.productId), count: Number(args?.count) }];
      return {};
    });
    const lines = [{ productId: "lentils", count: 3 }, { productId: "tomatoes", count: 2 }];
    await expect(transferCart(call, lines, journal, save)).rejects.toThrow("unklar");
    await expect(transferCart(call, lines, journal, save)).rejects.toThrow("unklar");
    expect(call.mock.calls.filter(([name]) => name === "picnic_add_to_cart")).toHaveLength(1);
    cart[1].count = 4;
    await transferCart(call, lines, journal, save);
    expect(cart).toContainEqual({ id: "existing", count: 2 });
    expect(cart).toContainEqual({ id: "tomatoes", count: 2 });
  });
});
