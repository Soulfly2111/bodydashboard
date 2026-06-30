import { prisma } from "../../config/prisma.js";
import { FavoriteService } from "../favorites/FavoriteService.js";
import { OpenFoodFactsService, type OpenFoodFactsProduct } from "./OpenFoodFactsService.js";

type ImportOptions = {
  userId: string;
  product: OpenFoodFactsProduct;
  overrides?: Partial<OpenFoodFactsProduct> & { portionSize?: number };
  favorite?: boolean;
  meal?: { date: Date; type: "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK"; amount: number; unit?: string };
};

export class FoodImportService {
  private favorites = new FavoriteService();
  private off = new OpenFoodFactsService();

  async importProduct(options: ImportOptions) {
    const data = { ...options.product, ...options.overrides };
    const now = new Date();
    const food = await prisma.food.upsert({
      where: { userId_externalId_source: { userId: options.userId, externalId: options.product.id, source: "open_food_facts" } },
      update: {
        name: data.name,
        brand: data.brand,
        category: data.category,
        barcode: data.barcode,
        caloriesPer100g: data.caloriesPer100g,
        protein: data.protein,
        carbs: data.carbs,
        fat: data.fat,
        sugar: data.sugar,
        fiber: data.fiber,
        salt: data.salt,
        lastSyncedAt: now,
        sourcePayload: JSON.stringify(options.product)
      },
      create: {
        userId: options.userId,
        name: data.name,
        brand: data.brand,
        category: data.category,
        barcode: data.barcode,
        caloriesPer100g: data.caloriesPer100g,
        protein: data.protein,
        carbs: data.carbs,
        fat: data.fat,
        sugar: data.sugar,
        fiber: data.fiber,
        salt: data.salt,
        source: "open_food_facts",
        externalId: options.product.id,
        importedAt: now,
        lastSyncedAt: now,
        sourcePayload: JSON.stringify(options.product)
      }
    });

    if (options.favorite) {
      await this.favorites.upsertFood(options.userId, food.id, food.name);
    }

    if (options.meal) {
      await this.addToMeal(options.userId, food.id, options.meal);
    }

    return food;
  }

  async syncFood(userId: string, foodId: string) {
    const food = await prisma.food.findFirstOrThrow({ where: { id: foodId, userId, source: "open_food_facts" } });
    const product = await this.off.getByBarcode(food.barcode ?? food.externalId ?? "");
    if (!product) throw new Error("Open Food Facts product not found");
    return this.importProduct({ userId, product });
  }

  private async addToMeal(userId: string, foodId: string, mealInput: NonNullable<ImportOptions["meal"]>) {
    const date = new Date(mealInput.date);
    date.setHours(0, 0, 0, 0);
    const meal = await prisma.meal.upsert({
      where: { userId_date_type: { userId, date, type: mealInput.type } },
      update: {},
      create: { userId, date, type: mealInput.type }
    });
    await prisma.mealItem.create({
      data: { mealId: meal.id, foodId, amount: mealInput.amount, unit: mealInput.unit ?? "g" }
    });
    await prisma.food.update({ where: { id: foodId }, data: { lastUsedAt: new Date() } });
  }
}
