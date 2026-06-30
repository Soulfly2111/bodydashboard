import type { Food, MealItem } from "@prisma/client";

export type MacroTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  salt: number;
};

export const emptyTotals = (): MacroTotals => ({
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 0,
  sugar: 0,
  salt: 0
});

export function addFoodAmount(total: MacroTotals, food: Food, amount: number) {
  const factor = amount / 100;
  total.calories += food.caloriesPer100g * factor;
  total.protein += food.protein * factor;
  total.carbs += food.carbs * factor;
  total.fat += food.fat * factor;
  total.fiber += food.fiber * factor;
  total.sugar += food.sugar * factor;
  total.salt += food.salt * factor;
  return total;
}

export function roundTotals(total: MacroTotals): MacroTotals {
  return Object.fromEntries(
    Object.entries(total).map(([key, value]) => [key, Math.round(value * 10) / 10])
  ) as MacroTotals;
}

export function totalsForItems(items: Array<MealItem & { food: Food }>) {
  return roundTotals(items.reduce((acc, item) => addFoodAmount(acc, item.food, item.amount), emptyTotals()));
}
