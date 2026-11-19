import { z } from "zod";
import { prisma } from "../../config/prisma.js";

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Ungültiges Datum");
export function dateKey(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
export function shiftDay(value: string, amount: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}
export const defaults = [
  { defaultKey: "creatin", name: "Creatin", unit: "g", color: "#00baff" },
  { defaultKey: "kollagen", name: "Kollagen", unit: "g", color: "#ffffff" },
  { defaultKey: "lavita", name: "LaVita", unit: "ml", color: "#32ff20" }
];
export async function initializeSupplements(userId: string) {
  for (const item of defaults) await prisma.supplement.upsert({
    where: { userId_defaultKey: { userId, defaultKey: item.defaultKey } }, update: {}, create: { userId, ...item }
  });
}
const nutrient = z.number().finite().nonnegative().nullable().optional();
export const supplementSchema = z.object({
  name: z.string().trim().min(1).max(100), brand: z.string().trim().max(100).nullable().optional(),
  unit: z.enum(["g", "ml", "Stück"]), defaultAmount: z.number().finite().positive().nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#00d4df"), archived: z.boolean().optional(),
  calories: nutrient, protein: nutrient, fat: nutrient, carbs: nutrient, sugar: nutrient, fiber: nutrient, salt: nutrient
});
export const entrySchema = z.object({
  date: dateSchema.optional(), amount: z.number().finite().positive(), unit: z.enum(["g", "ml", "Stück"]).optional(),
  externalId: z.string().trim().min(1).max(150).optional()
});
export function problem(message: string, status = 400): never {
  throw Object.assign(new Error(message), { statusCode: status });
}
export async function ownSupplement(userId: string, id: string) {
  const item = await prisma.supplement.findFirst({ where: { id, userId } });
  if (!item) return problem("Supplement nicht gefunden", 404);
  return item;
}
export async function logSupplement(userId: string, id: string, input: z.infer<typeof entrySchema>) {
  const item = await ownSupplement(userId, id);
  if (item.archived) return problem("Supplement ist archiviert");
  if (input.unit && input.unit !== item.unit) return problem("Einheit stimmt nicht mit dem Supplement überein");
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const date = input.date ?? dateKey(new Date(), user.timezone);
  const data = { userId, supplementId: id, date, amount: input.amount, unit: item.unit,
    calories: item.calories, protein: item.protein, fat: item.fat, carbs: item.carbs, sugar: item.sugar, fiber: item.fiber, salt: item.salt, externalId: input.externalId };
  // The snapshot stores values per 100 units, so quantity corrections retain historical nutrition.
  if (input.externalId) {
    const saved = await prisma.supplementEntry.upsert({
      where: { userId_externalId: { userId, externalId: input.externalId } }, update: {}, create: data
    });
    if (saved.supplementId !== id || saved.amount !== input.amount || saved.date !== date || saved.unit !== item.unit)
      return problem("Buchungs-ID wurde bereits für eine andere Einnahme verwendet", 409);
    return saved;
  }
  return prisma.supplementEntry.create({ data });
}
export function supplementTotals(entries: { amount: number; calories: number | null; protein: number | null; fat: number | null; carbs: number | null; sugar?: number | null; fiber?: number | null; salt?: number | null }[]) {
  const totals = { calories: 0, protein: 0, fat: 0, carbs: 0, sugar: 0, fiber: 0, salt: 0, missingNutritionCount: 0 };
  for (const entry of entries) {
    for (const key of ["calories", "protein", "fat", "carbs", "sugar", "fiber", "salt"] as const) totals[key] += (entry[key] ?? 0) * entry.amount / 100;
    if ([entry.calories, entry.protein, entry.fat, entry.carbs].some(value => value === null)) totals.missingNutritionCount++;
  }
  return totals;
}
