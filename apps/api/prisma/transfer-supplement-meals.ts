import "dotenv/config";
import { writeFileSync } from "node:fs";
import { prisma } from "../src/config/prisma.js";
import { recordDay } from "../src/services/supplements/overview.js";

// Explicitly scoped maintenance task. Default is read-only; credentials and user data
// stay on the server. Combined meals and ambiguous portion placeholders are excluded.
const userId = process.env.MIGRATION_USER_ID;
if (!userId) throw new Error("MIGRATION_USER_ID is required");
const apply = process.argv.includes("--apply");
const correctLaVita = process.argv.includes("--lavita-grams-were-ml");
const nutrients = ["calories", "protein", "fat", "carbs", "sugar", "fiber", "salt"] as const;
function classify(name: string): string | null {
  if (/^(creatin|kreatin)( monohydrat| in wasser)?$/i.test(name)) return "creatin";
  if (/^(kollagen(pulver| im kaffee)?|kaffee mit kollagen)$/i.test(name)) return "kollagen";
  if (/^lavita( 1 el| in wasser)?$/i.test(name)) return "lavita";
  return null;
}

try {
  const summary = await prisma.$transaction(async tx => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    const products = await tx.supplement.findMany({ where: { userId } });
    const items = await tx.mealItem.findMany({ where: { meal: { userId } }, include: { food: true, meal: true } });
    const entries = await tx.supplementEntry.findMany({ where: { userId } });
    const skipped: { name: string; reason: string }[] = [];
    const selected = items.flatMap(item => {
      const key = classify(item.food.name);
      if (!key) {
        if (/lavita|kreatin|creatin|kollagen|collagen/i.test(item.food.name)) skipped.push({ name: item.food.name, reason: "Combined meal or unclear powder quantity" });
        return [];
      }
      const product = products.find(p => p.defaultKey === key);
      if (!product || product.archived) throw new Error(`Active default supplement missing: ${key}`);
      const unit = key === "lavita" && item.unit === "g" && correctLaVita ? "ml" : item.unit;
      if (unit !== product.unit) throw new Error(`Unconfirmed unit conversion: ${item.food.name} (${item.unit})`);
      const date = recordDay(item.meal.date, user.timezone);
      if (entries.some(e => e.supplementId === product.id && e.date === date && e.amount === item.amount)) {
        skipped.push({ name: item.food.name, reason: "Possible existing supplement intake on the same day" });
        return [];
      }
      return [{ item, product, unit, date }];
    });
    const counts = Object.fromEntries(products.filter(p => p.defaultKey).map(p => [p.name, selected.filter(s => s.product.id === p.id).length]));
    const totals = (meals: typeof items, supplements: typeof entries) => {
      const result: Record<string, Record<string, number>> = {};
      const add = (date: string, amount: number, values: Record<string, number | null>) => {
        result[date] ??= Object.fromEntries(nutrients.map(key => [key, 0]));
        for (const key of nutrients) result[date][key] += (values[key] ?? 0) * amount / 100;
      };
      for (const item of meals) add(recordDay(item.meal.date, user.timezone), item.amount, { ...item.food, calories: item.food.caloriesPer100g } as unknown as Record<string, number>);
      for (const entry of supplements) add(entry.date, entry.amount, entry as unknown as Record<string, number | null>);
      return result;
    };
    const before = totals(items, entries);
    if (apply && selected.length) {
      if (!process.env.MIGRATION_REPORT_PATH) throw new Error("MIGRATION_REPORT_PATH is required before applying");
      // Root-only source record export is written before modifying anything.
      writeFileSync(process.env.MIGRATION_REPORT_PATH, JSON.stringify({ userId, createdAt: new Date(), sources: selected, before, skipped }, null, 2), { flag: "wx", mode: 0o600 });
      for (const { item, product, unit, date } of selected) {
        await tx.supplementEntry.create({ data: {
          userId, supplementId: product.id, date, amount: item.amount, unit,
          calories: item.food.caloriesPer100g, protein: item.food.protein, fat: item.food.fat,
          carbs: item.food.carbs, sugar: item.food.sugar, fiber: item.food.fiber, salt: item.food.salt,
          externalId: `migration:meal-item:${item.id}`, createdAt: item.createdAt
        } });
        // Keep food definitions and meal containers; remove only the transferred item.
        await tx.mealItem.delete({ where: { id: item.id } });
      }
      const afterItems = await tx.mealItem.findMany({ where: { meal: { userId } }, include: { food: true, meal: true } });
      const afterEntries = await tx.supplementEntry.findMany({ where: { userId } });
      const after = totals(afterItems, afterEntries);
      for (const date of new Set([...Object.keys(before), ...Object.keys(after)])) {
        for (const key of nutrients) if (Math.abs((before[date]?.[key] ?? 0) - (after[date]?.[key] ?? 0)) > 0.0000001)
          throw new Error(`Nutrition verification failed: ${date} ${key}; rolling back`);
      }
      if (afterItems.length !== items.length - selected.length || afterEntries.length !== entries.length + selected.length)
        throw new Error("Unexpected record counts; rolling back");
    }
    return { applied: apply, transferred: selected.length, counts, skipped, dayCount: new Set(selected.map(s => s.date)).size,
      firstDate: selected.map(s => s.date).sort()[0], lastDate: selected.map(s => s.date).sort().at(-1),
      correctedLaVitaUnits: selected.filter(s => s.item.unit !== s.unit).length,
      dailyNutritionUnchanged: apply ? true : "dry run" };
  }, { timeout: 60000 });
  console.log(JSON.stringify(summary));
} finally { await prisma.$disconnect(); }
