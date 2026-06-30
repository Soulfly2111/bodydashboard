import type { NutritionEstimationService as NutritionEstimationServiceContract, RecognizedFoodDraft } from "./types.js";

export class DefaultNutritionEstimationService implements NutritionEstimationServiceContract {
  recalculate(items: RecognizedFoodDraft[]) {
    return items.reduce((totals, item) => ({
      calories: this.round(totals.calories + item.calories),
      protein: this.round(totals.protein + item.protein),
      carbs: this.round(totals.carbs + item.carbs),
      fat: this.round(totals.fat + item.fat),
      fiber: this.round(totals.fiber + item.fiber),
      sugar: this.round(totals.sugar + item.sugar),
      salt: this.round(totals.salt + item.salt)
    }), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, salt: 0 });
  }

  private round(value: number) {
    return Math.round(value * 10) / 10;
  }
}
