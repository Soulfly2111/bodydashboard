import { z } from "zod";
import { env } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";
import { requireHousehold } from "./households.js";
import { itemKey, normalizeMeasure } from "./pantry.js";
import { laterDate, versionSchema, weekKey, type DishSnapshot } from "./plans.js";
import { cartCounts, picnicAvailable, productOptions, productSchema, withPicnic } from "./picnic.js";
import { dbConflict, fail } from "./recipes.js";

const canUsePicnic = (userId: string) => picnicAvailable() && userId === env.MEAL_PICNIC_OWNER_ID;

const lineSchema = z.object({
  key: z.string().min(1).max(240),
  name: z.string().trim().min(1).max(160),
  amount: z.number().finite().positive().max(100_000_000),
  unit: z.string().trim().min(1).max(24),
  checked: z.boolean(),
  product: productSchema.nullable(),
  packs: z.number().int().min(1).max(100)
});
type Line = z.infer<typeof lineSchema>;
type CartLine = { productId: string; count: number };
type CartProgress = Record<string, { before: number; done: boolean }>;

async function approvedPlan(userId: string, week: unknown, managing = false) {
  const member = await requireHousehold(userId, managing);
  const plan = await prisma.weeklyMealPlan.findUnique({
    where: { householdId_weekStart: { householdId: member.householdId, weekStart: weekKey.parse(week) } },
    include: { dishes: true, shopping: true }
  });
  if (!plan || plan.status !== "approved") throw fail(404, "Für diese Woche gibt es keinen freigegebenen Plan.");
  return { member, plan };
}

function shoppingView(list: { items: string; version: number; state: string }, budgetCents: number | null, userId: string) {
  const items = JSON.parse(list.items) as Line[];
  const selected = items.filter((item) => item.checked);
  const estimateCents = selected.reduce((sum, line) => sum + (line.product?.priceCents ?? 0) * line.packs, 0);
  return { items, version: list.version, state: list.state, budgetCents,
    picnicAvailable: canUsePicnic(userId), estimateCents, hasUnpricedItems: selected.some((line) => line.product?.priceCents == null) };
}

export async function getShopping(userId: string, week: unknown) {
  const { member, plan } = await approvedPlan(userId, week);
  return plan.shopping ? shoppingView(plan.shopping, member.household.budgetCents, userId) : null;
}

export async function prepareShopping(userId: string, week: unknown) {
  const { member, plan } = await approvedPlan(userId, week, true);
  if (plan.shopping) return shoppingView(plan.shopping, member.household.budgetCents, userId);
  const items = await shoppingLines(member.householdId, plan.dishes, plan.weekStart);
  const list = await prisma.mealShoppingList.upsert({
    where: { planId: plan.id }, create: { planId: plan.id, items: JSON.stringify(items) }, update: {}
  });
  return shoppingView(list, member.household.budgetCents, userId);
}

async function shoppingLines(householdId: string, dishes: { snapshot: string; servings: number; cookedAt: Date | null }[], weekStart: string) {
  const totals = new Map<string, Line>();
  for (const dish of dishes) {
    const recipe = JSON.parse(dish.snapshot) as DishSnapshot;
    if (dish.cookedAt || recipe.leftoverDishId) continue;
    for (const ingredient of recipe.ingredients) {
      const measure = normalizeMeasure(ingredient.amount * dish.servings / recipe.servings, ingredient.unit);
      const key = itemKey(ingredient.name, measure.unit);
      const previous = totals.get(key);
      if (previous) previous.amount += measure.amount;
      else totals.set(key, { key, name: ingredient.name, ...measure, checked: true, product: null, packs: 1 });
    }
  }
  return deductPantry(householdId, [...totals.values()], laterDate(weekStart));
}

async function deductPantry(householdId: string, lines: Line[], date: string) {
  const available = await prisma.mealPantryItem.findMany({
    where: { householdId, OR: [{ expiresOn: null }, { expiresOn: { gte: date } }] }
  });
  const stock = new Map<string, number>();
  for (const item of available) {
    const measure = normalizeMeasure(item.amount, item.unit);
    const key = itemKey(item.name, measure.unit);
    stock.set(key, (stock.get(key) ?? 0) + measure.amount);
  }
  return lines.flatMap((line) => {
    const amount = Math.round((line.amount - (stock.get(line.key) ?? 0)) * 1000) / 1000;
    return amount > 0 ? [{ ...line, amount }] : [];
  });
}

export async function editShopping(userId: string, week: unknown, input: unknown) {
  const { member, plan } = await approvedPlan(userId, week, true);
  const body = z.object({ version: versionSchema, items: z.array(lineSchema).max(840) }).parse(input);
  if (new Set(body.items.map(({ key }) => key)).size !== body.items.length) throw fail(400, "Jede Position braucht eine eindeutige Kennung.");
  const where = { planId: plan.id, version: body.version, state: "preview" };
  const updated = await prisma.mealShoppingList.updateMany({ where, data: { items: JSON.stringify(body.items), version: { increment: 1 } } });
  if (!updated.count) throw fail(409, "Die Einkaufsliste wurde geändert. Bitte erneut laden.");
  return getShopping(member.userId, week);
}

export async function findProducts(userId: string, week: unknown, input: unknown) {
  await approvedPlan(userId, week, true);
  if (!canUsePicnic(userId)) throw fail(503, "Picnic ist für diesen Haushalt nicht eingerichtet.");
  const query = z.string().trim().min(1).max(160).parse(input);
  try {
    return await withPicnic(async (call) => productOptions(await call("picnic_search", { query, limit: 6 })));
  } catch {
    throw fail(502, "Picnic-Produkte konnten nicht geladen werden.");
  }
}

export async function queueCart(userId: string, week: unknown, input: unknown) {
  const { member, plan } = await approvedPlan(userId, week, true);
  if (!canUsePicnic(userId)) throw fail(503, "Picnic ist für diesen Haushalt nicht eingerichtet.");
  const body = z.object({ version: versionSchema }).parse(input);
  const list = plan.shopping;
  if (!list || list.version !== body.version) throw fail(409, "Die Einkaufsliste wurde geändert. Bitte erneut laden.");
  if (list.state === "transferred" || list.state === "transferring") return shoppingView(list, member.household.budgetCents, userId);
  const products = new Map<string, number>();
  for (const line of (JSON.parse(list.items) as Line[])) {
    if (line.checked && line.product) products.set(line.product.id, (products.get(line.product.id) ?? 0) + line.packs);
  }
  if (!products.size) throw fail(400, "Bitte mindestens ein Picnic-Produkt auswählen.");
  const lines = Array.from(products, ([productId, count]) => ({ productId, count }));
  if (lines.length > 60 || lines.some(({ count }) => count > 100)) throw fail(400, "Zu viele Artikel für eine Übertragung.");
  try {
    await prisma.$transaction(async (tx) => {
      const claim = await tx.mealShoppingList.updateMany({
        where: { planId: plan.id, version: body.version, state: { in: ["preview", "review"] } }, data: { state: "transferring" }
      });
      if (!claim.count) throw fail(409, "Bitte den Einkaufsstatus erneut laden.");
      const jobKey = plan.id + ":" + body.version;
      await tx.mealPlannerJob.upsert({
        where: { householdId_kind_jobKey: { householdId: member.householdId, kind: "cart", jobKey } },
        create: { householdId: member.householdId, kind: "cart", jobKey, payload: JSON.stringify({ planId: plan.id, lines }) },
        update: { state: "queued", leaseUntil: null, leaseToken: null, error: null }
      });
    });
  } catch (error) {
    if (dbConflict(error)) throw fail(409, "Die Einkaufsliste wurde geändert. Bitte erneut laden.");
    throw error;
  }
  return getShopping(userId, week);
}

export async function transferCart(
  call: (name: string, args?: Record<string, unknown>) => Promise<unknown>,
  lines: CartLine[],
  progress: CartProgress,
  save: (progress: CartProgress) => Promise<void>
) {
  const unresolved = () => new Error("Picnic-Übertragung für einen Artikel ist unklar. Bitte den Warenkorb prüfen.");
  let counts = cartCounts(await call("picnic_get_cart"));
  for (const { productId, count } of lines) {
    const key = "product:" + productId;
    const entry = progress[key];
    if (entry?.done) continue;
    const current = counts.get(productId) ?? 0;
    if (entry) {
      if (current < entry.before + count) throw unresolved();
      progress[key] = { ...entry, done: true };
      await save(progress);
      continue;
    }
    progress[key] = { before: current, done: false };
    await save(progress);
    try {
      await call("picnic_add_to_cart", { productId, count });
    } catch {
      // Adding is non-idempotent even when the response indicates a timeout or failure.
    }
    counts = cartCounts(await call("picnic_get_cart"));
    if ((counts.get(productId) ?? 0) < current + count) throw unresolved();
    progress[key].done = true;
    await save(progress);
  }
}

export async function refreshShopping(userId: string, week: unknown, input: unknown) {
  const { member, plan } = await approvedPlan(userId, week, true);
  const { version } = z.object({ version: versionSchema }).parse(input);
  const items = await shoppingLines(member.householdId, plan.dishes, plan.weekStart);
  return editShopping(userId, week, { version, items });
}
