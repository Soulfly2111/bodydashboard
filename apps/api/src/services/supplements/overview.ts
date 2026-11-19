import { prisma } from "../../config/prisma.js";
import { addFoodAmount, emptyTotals, roundTotals } from "../../utils/nutrition.js";
import { dateKey, initializeSupplements, shiftDay, supplementTotals } from "./supplements.js";

// Existing date-only records were stored at UTC midnight. Preserve their calendar date.
export function recordDay(date: Date, timezone: string) {
  return date.toISOString().endsWith("T00:00:00.000Z") ? date.toISOString().slice(0, 10) : dateKey(date, timezone);
}
export function mean(values: (number | null)[]) {
  const present = values.filter((value): value is number => value !== null);
  return present.length ? Math.round(present.reduce((sum, value) => sum + value, 0) / present.length * 10) / 10 : null;
}
export async function overview(userId: string, anchor?: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const today = dateKey(new Date(), user.timezone);
  const end = anchor ?? today;
  const start = shiftDay(end, -27);
  const range = { gte: new Date(`${shiftDay(start, -1)}T00:00:00Z`), lt: new Date(`${shiftDay(end, 2)}T00:00:00Z`) };
  await initializeSupplements(userId);
  const [meals, weights, activities, supplements, entries] = await Promise.all([
    prisma.meal.findMany({ where: { userId, date: range }, include: { items: { include: { food: true } } } }),
    prisma.weightEntry.findMany({ where: { userId, date: range } }),
    prisma.activity.findMany({ where: { userId, date: range } }),
    prisma.supplement.findMany({ where: { userId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
    prisma.supplementEntry.findMany({ where: { userId, date: { gte: start, lte: end } } })
  ]);
  const visible = supplements.filter(s => !s.archived || entries.some(e => e.supplementId === s.id));
  const days = Array.from({ length: 28 }, (_, index) => {
    const date = shiftDay(end, -index);
    const items = meals.filter(m => recordDay(m.date, user.timezone) === date).flatMap(m => m.items);
    const dailyEntries = entries.filter(e => e.date === date);
    const nutrition = supplementTotals(dailyEntries);
    const totals = items.reduce((total, item) => addFoodAmount(total, item.food, item.amount), emptyTotals());
    for (const key of ["calories", "protein", "fat", "carbs"] as const) totals[key] += nutrition[key];
    const measured = weights.filter(w => recordDay(w.date, user.timezone) === date);
    return { date, ...roundTotals(totals), hasNutrition: items.length > 0 || dailyEntries.length > 0,
      missingNutritionCount: nutrition.missingNutritionCount,
      knownNutrition: Object.fromEntries((["calories", "protein", "fat", "carbs"] as const).map(key => [key, items.length > 0 || dailyEntries.some(e => e[key] !== null)])),
      activityCount: activities.filter(a => recordDay(a.date, user.timezone) === date).length,
      weightKg: user.trackWeight ? mean(measured.map(w => w.weightKg)) : null,
      bodyFatPercent: user.trackBodyFat ? mean(measured.map(w => w.bodyFatPercent)) : null,
      supplements: visible.map(s => ({ id: s.id, count: dailyEntries.filter(e => e.supplementId === s.id).length })) };
  });
  const weeks = Array.from({ length: 4 }, (_, index) => {
    const block = days.slice(index * 7, index * 7 + 7);
    const totals = emptyTotals();
    for (const day of block) for (const key of ["calories", "protein", "fat", "carbs"] as const) totals[key] += day[key] / 7;
    return { start: block[6].date, end: block[0].date, ...roundTotals(totals),
      hasNutrition: block.some(d => d.hasNutrition), missingNutritionCount: block.reduce((n, d) => n + d.missingNutritionCount, 0),
      knownNutrition: Object.fromEntries(["calories", "protein", "fat", "carbs"].map(key => [key, block.some(d => d.knownNutrition[key])])),
      weightKg: mean(block.map(d => d.weightKg)), bodyFatPercent: mean(block.map(d => d.bodyFatPercent)),
      supplements: visible.map(s => ({ id: s.id, days: block.filter(d => d.supplements.some(v => v.id === s.id && v.count > 0)).length })) };
  });
  return { today, timezone: user.timezone, days: days.slice(0, 7), weeks, supplements: visible.map(({ id, name, color }) => ({ id, name, color })) };
}
