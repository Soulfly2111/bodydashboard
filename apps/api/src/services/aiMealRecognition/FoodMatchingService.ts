import { prisma } from "../../config/prisma.js";
import { OpenFoodFactsService } from "../openFoodFacts/OpenFoodFactsService.js";
import type { FoodMatchingService as FoodMatchingServiceContract, RecognizedFoodDraft } from "./types.js";

export class DefaultFoodMatchingService implements FoodMatchingServiceContract {
  private openFoodFacts = new OpenFoodFactsService();

  async match(userId: string, item: RecognizedFoodDraft): Promise<RecognizedFoodDraft> {
    const local = await prisma.food.findFirst({
      where: {
        OR: [
          { userId },
          { isPublic: true }
        ],
        name: { contains: item.name }
      },
      orderBy: { lastUsedAt: "desc" }
    });

    if (local) {
      return this.withFood(item, local.id, "local_database", local);
    }

    try {
      const [offProduct] = await this.openFoodFacts.search({ query: item.name, country: "Germany", language: "de" });
      if (offProduct) {
        return {
          ...this.withFood(item, undefined, "open_food_facts_match", {
            caloriesPer100g: offProduct.caloriesPer100g,
            protein: offProduct.protein,
            carbs: offProduct.carbs,
            fat: offProduct.fat,
            fiber: offProduct.fiber,
            sugar: offProduct.sugar,
            salt: offProduct.salt
          }),
          category: item.category ?? offProduct.category,
          confidence: Math.max(35, item.confidence - 5)
        };
      }
    } catch {
      return item;
    }

    return item;
  }

  private withFood(item: RecognizedFoodDraft, foodId: string | undefined, source: string, food: { caloriesPer100g: number; protein: number; carbs: number; fat: number; fiber: number; sugar: number; salt: number }) {
    const factor = item.weightGrams / 100;
    return {
      ...item,
      foodId,
      source,
      calories: this.round(food.caloriesPer100g * factor),
      protein: this.round(food.protein * factor),
      carbs: this.round(food.carbs * factor),
      fat: this.round(food.fat * factor),
      fiber: this.round(food.fiber * factor),
      sugar: this.round(food.sugar * factor),
      salt: this.round(food.salt * factor)
    };
  }

  private round(value: number) {
    return Math.round(value * 10) / 10;
  }
}
