import { describe, expect, it } from "vitest";
import { addFoodAmount, emptyTotals, roundTotals } from "./nutrition.js";

describe("nutrition totals", () => {
  it("scales nutrients by grams", () => {
    const total = addFoodAmount(emptyTotals(), {
      caloriesPer100g: 200,
      protein: 10,
      carbs: 20,
      fat: 5,
      fiber: 2,
      sugar: 1,
      salt: 0.5
    } as never, 50);
    expect(roundTotals(total)).toMatchObject({ calories: 100, protein: 5, carbs: 10, fat: 2.5 });
  });
});
