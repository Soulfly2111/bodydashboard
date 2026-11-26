import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { requireHousehold } from "./households.js";
import { berlinDate, dateKey, type DishSnapshot } from "./plans.js";
import { dbConflict, fail, positive } from "./recipes.js";

export function normalizeMeasure(amount: number, unit: string) {
  const key = unit.trim().toLocaleLowerCase("de");
  if (key === "kg") return { amount: amount * 1000, unit: "g" };
  if (key === "l") return { amount: amount * 1000, unit: "ml" };
  return { amount, unit: key === "g" || key === "ml" ? key : unit };
}

export const itemKey = (name: string, unit: string) => name.normalize("NFKC").trim().toLocaleLowerCase("de") + "|" + unit.trim().toLocaleLowerCase("de");

export async function pantryView(userId: string) {
  const { householdId } = await requireHousehold(userId);
  return prisma.mealPantryItem.findMany({ where: { householdId }, orderBy: [{ expiresOn: "asc" }, { name: "asc" }] });
}

export async function savePantryItem(userId: string, input: unknown, id?: string) {
  const { householdId } = await requireHousehold(userId);
  const data = z.object({
    name: z.string().trim().min(1).max(160), amount: positive, unit: z.string().trim().min(1).max(24),
    expiresOn: dateKey.nullable().optional()
  }).parse(input);
  if (!id) return prisma.mealPantryItem.create({ data: { ...data, householdId } });
  const result = await prisma.mealPantryItem.updateMany({ where: { id, householdId }, data });
  if (!result.count) throw fail(404, "Vorrat nicht gefunden.");
  return pantryView(userId);
}

export async function removePantryItem(userId: string, id: string) {
  const { householdId } = await requireHousehold(userId);
  await prisma.mealPantryItem.deleteMany({ where: { id, householdId } });
}

export async function confirmCooked(userId: string, id: string, input: unknown) {
  const { householdId } = await requireHousehold(userId);
  const body = z.object({
    used: z.array(z.object({ id: z.string().min(1), amount: positive })).max(60),
    leftoverPortions: z.number().finite().min(0).max(100),
    leftoverUntil: dateKey.nullable().optional()
  }).parse(input);
  const date = berlinDate();
  if (body.leftoverUntil && body.leftoverUntil < date) throw fail(400, "Das Verbrauchsdatum liegt in der Vergangenheit.");
  try {
    return await prisma.$transaction(async (tx) => {
      const dish = await tx.weeklyMealDish.findFirst({ where: { id, plan: { householdId, status: "approved" } } });
      if (!dish) throw fail(404, "Freigegebenes Gericht nicht gefunden.");
      if (dish.cookedAt) throw fail(409, "Das Kochen wurde bereits bestätigt.");
      if (body.leftoverPortions > dish.servings) throw fail(400, "Die Restemenge übersteigt die geplanten Portionen.");
      const snapshot = JSON.parse(dish.snapshot) as DishSnapshot;
      const updated = await tx.weeklyMealDish.updateMany({
        where: { id, cookedAt: null }, data: {
          cookedAt: new Date(), leftoverPortions: body.leftoverPortions, leftoverUntil: body.leftoverPortions ? body.leftoverUntil : null
        }
      });
      if (!updated.count) throw fail(409, "Das Kochen wurde bereits bestätigt.");
      if (snapshot.leftoverDishId) {
        const result = await tx.weeklyMealDish.updateMany({
          where: { id: snapshot.leftoverDishId, plan: { householdId }, leftoverPortions: { gte: dish.servings },
            OR: [{ leftoverUntil: null }, { leftoverUntil: { gte: date } }] },
          data: { leftoverPortions: { decrement: dish.servings } }
        });
        if (!result.count) throw fail(409, "Die geplanten Reste reichen nicht mehr aus.");
      }
      for (const row of body.used) {
        const result = await tx.mealPantryItem.updateMany({
          where: { id: row.id, householdId, amount: { gte: row.amount }, OR: [{ expiresOn: null }, { expiresOn: { gte: date } }] },
          data: { amount: { decrement: row.amount } }
        });
        if (!result.count) throw fail(409, "Ein Vorrat reicht nicht aus oder ist abgelaufen.");
      }
      await tx.mealPantryItem.deleteMany({ where: { householdId, amount: { lte: 0 } } });
      return { cooked: true };
    });
  } catch (error) {
    if (dbConflict(error)) throw fail(409, "Der Haushalt wurde gleichzeitig aktualisiert. Bitte erneut laden.");
    throw error;
  }
}
