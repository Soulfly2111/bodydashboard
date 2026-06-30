import { startOfDay } from "date-fns";
import { prisma } from "../../config/prisma.js";
import type { MealCreationService as MealCreationServiceContract, RecognizedFoodDraft } from "./types.js";

export class DefaultMealCreationService implements MealCreationServiceContract {
  async createFromAnalysis(input: { userId: string; analysisId: string; date: Date; mealType: string; customMealTag?: string; items: RecognizedFoodDraft[]; saveUnknownFoods: boolean }) {
    const date = startOfDay(input.date);
    const mealType = input.customMealTag ? `CUSTOM:${input.customMealTag}` : input.mealType;
    const meal = await prisma.meal.upsert({
      where: { userId_date_type: { userId: input.userId, date, type: mealType } },
      update: { name: input.customMealTag },
      create: { userId: input.userId, date, type: mealType, name: input.customMealTag }
    });

    for (const item of input.items) {
      const foodId = item.foodId ?? await this.createFoodFromEstimate(input.userId, item, input.saveUnknownFoods);
      await prisma.mealItem.create({
        data: {
          mealId: meal.id,
          foodId,
          amount: item.weightGrams,
          unit: "g",
          servingName: item.servingName ?? item.name
        }
      });
      await prisma.food.update({ where: { id: foodId }, data: { lastUsedAt: new Date() } });
    }

    await prisma.aiMealAnalysis.update({
      where: { id: input.analysisId },
      data: { mealId: meal.id, status: "SAVED", manualChangesJson: JSON.stringify(input.items) }
    });

    return { mealId: meal.id };
  }

  private async createFoodFromEstimate(userId: string, item: RecognizedFoodDraft, persist: boolean) {
    const grams = Math.max(item.weightGrams, 1);
    const food = await prisma.food.create({
      data: {
        userId: persist ? userId : undefined,
        name: item.name,
        category: item.category,
        caloriesPer100g: this.per100(item.calories, grams),
        protein: this.per100(item.protein, grams),
        carbs: this.per100(item.carbs, grams),
        fat: this.per100(item.fat, grams),
        fiber: this.per100(item.fiber, grams),
        sugar: this.per100(item.sugar, grams),
        salt: this.per100(item.salt, grams),
        source: persist ? "ai_estimate" : "ai_temporary",
        sourcePayload: JSON.stringify(item)
      }
    });
    return food.id;
  }

  private per100(value: number, grams: number) {
    return Math.round((value / grams) * 1000) / 10;
  }
}
