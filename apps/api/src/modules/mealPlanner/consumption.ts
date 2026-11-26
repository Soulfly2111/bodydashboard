import { createHash } from "node:crypto";
import { startOfDay } from "date-fns";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { roundTotals, type MacroTotals } from "../../utils/nutrition.js";
import { dateKey } from "./plans.js";
import { dbConflict, fail, membership, recipeFor, recipeSnapshot, type Snapshot } from "./recipes.js";

const portionSchema = z.object({
  recipeId: z.string().min(1).optional(),
  dishId: z.string().min(1).optional(),
  portions: z.number().finite().positive().max(100)
});
type PortionInput = z.infer<typeof portionSchema>;
const exactlyOneRecipe = (input: PortionInput) => Boolean(input.recipeId) !== Boolean(input.dishId);
const trackingSchema = portionSchema.extend({
  date: dateKey,
  type: z.enum(["BREAKFAST", "LUNCH", "DINNER", "SNACK"]),
  requestKey: z.string().uuid()
}).refine(exactlyOneRecipe, "Bitte ein Rezept auswählen.");
const scale = (macros: MacroTotals, factor: number) =>
  Object.fromEntries(Object.entries(macros).map(([key, value]) => [key, value * factor])) as MacroTotals;

async function getPortion(userId: string, input: PortionInput) {
  const member = await membership(userId);
  let snapshot: Snapshot;
  if (input.dishId) {
    const dish = member && await prisma.weeklyMealDish.findFirst({ where: { id: input.dishId, plan: { householdId: member.householdId, status: "approved" } } });
    if (!dish) throw fail(404, "Freigegebenes Gericht nicht gefunden.");
    snapshot = JSON.parse(dish.snapshot) as Snapshot;
  } else {
    snapshot = recipeSnapshot(await recipeFor(userId, input.recipeId!, member?.householdId));
  }
  const totals = snapshot.perPortion ? roundTotals(scale(snapshot.perPortion, input.portions)) : null;
  return { snapshot, totals };
}

export async function previewPortion(userId: string, input: unknown) {
  const body = portionSchema.refine(exactlyOneRecipe, "Bitte ein Rezept auswählen.").parse(input);
  const [{ snapshot, totals }, goal] = await Promise.all([
    getPortion(userId, body),
    prisma.goal.findUnique({ where: { userId }, select: { calories: true, protein: true } })
  ]);
  return { name: snapshot.name, totals, goal };
}

export async function recordConsumption(userId: string, input: unknown) {
  const { requestKey, ...body } = trackingSchema.parse(input);
  const requestBody = JSON.stringify(body);
  const where = { userId_requestKey: { userId, requestKey } };
  const previous = await prisma.recipeConsumption.findUnique({ where });
  if (previous) return replay(previous);
  const { snapshot, totals } = await getPortion(userId, body);
  if (!totals || !snapshot.perPortion || !snapshot.trackedWeightPerPortion) throw fail(422, "Für dieses Rezept fehlen Nährwerte.");
  const per100 = scale(snapshot.perPortion, 100 / snapshot.trackedWeightPerPortion);
  const serialized = JSON.stringify(snapshot);
  const externalId = createHash("sha256").update(serialized).digest("hex");
  const date = startOfDay(new Date(body.date));
  try {
    return await prisma.$transaction(async (tx) => {
      const source = "recipe_consumption";
      const food = await tx.food.upsert({
        where: { userId_externalId_source: { userId, externalId, source } },
        create: {
          userId, externalId, source, name: snapshot.name, caloriesPer100g: per100.calories, protein: per100.protein,
          fat: per100.fat, carbs: per100.carbs, sugar: per100.sugar, fiber: per100.fiber, salt: per100.salt
        },
        update: {}
      });
      const meal = await tx.meal.upsert({
        where: { userId_date_type: { userId, date, type: body.type } },
        create: { userId, date, type: body.type }, update: {}
      });
      const item = await tx.mealItem.create({ data: {
        mealId: meal.id, foodId: food.id, amount: snapshot.trackedWeightPerPortion! * body.portions,
        unit: "g", servingName: String(body.portions) + " Portion(en)"
      } });
      const entry = await tx.recipeConsumption.create({ data: {
        userId, requestKey, requestBody, mealItemId: item.id, date: body.date, portions: body.portions, snapshot: serialized
      } });
      return { id: entry.id, mealItemId: entry.mealItemId, totals, replayed: false };
    });
  } catch (error) {
    if (!dbConflict(error)) throw error;
    const concurrent = await prisma.recipeConsumption.findUnique({ where });
    if (concurrent) return replay(concurrent);
    throw fail(409, "Das Tagebuch wird gerade aktualisiert. Bitte denselben Eintrag erneut senden.");
  }

  function replay(entry: { id: string; requestBody: string; mealItemId: string | null; snapshot: string; portions: number }) {
    if (entry.requestBody !== requestBody) throw fail(409, "Dieser Schlüssel gehört bereits zu einer anderen Erfassung.");
    const snapshot = JSON.parse(entry.snapshot) as Snapshot;
    return { id: entry.id, mealItemId: entry.mealItemId, totals: roundTotals(scale(snapshot.perPortion!, entry.portions)), replayed: true };
  }
}

export async function consumptionHistory(userId: string) {
  const entries = await prisma.recipeConsumption.findMany({ where: { userId }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 100 });
  return entries.map(({ id, date, portions, snapshot, mealItemId }) => ({
    id, date, portions, name: (JSON.parse(snapshot) as Snapshot).name, mealItemId
  }));
}
