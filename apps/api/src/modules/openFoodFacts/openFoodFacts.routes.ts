import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { FavoriteService } from "../../services/favorites/FavoriteService.js";
import { FoodImportService } from "../../services/openFoodFacts/FoodImportService.js";
import { OpenFoodFactsService } from "../../services/openFoodFacts/OpenFoodFactsService.js";

export const openFoodFactsRouter = Router();
openFoodFactsRouter.use(requireAuth);

const off = new OpenFoodFactsService();
const importer = new FoodImportService();
const favorites = new FavoriteService();

const productSchema = z.object({
  id: z.string(),
  barcode: z.string(),
  name: z.string().min(1),
  brand: z.string().optional(),
  category: z.string().optional(),
  imageUrl: z.string().optional(),
  nutriScore: z.string().optional(),
  caloriesPer100g: z.coerce.number().nonnegative(),
  protein: z.coerce.number().nonnegative(),
  carbs: z.coerce.number().nonnegative(),
  fat: z.coerce.number().nonnegative(),
  sugar: z.coerce.number().nonnegative(),
  fiber: z.coerce.number().nonnegative(),
  salt: z.coerce.number().nonnegative()
});

openFoodFactsRouter.get(
  "/search",
  asyncHandler(async (req, res) => {
    const query = z.object({
      q: z.string().optional(),
      brand: z.string().optional(),
      category: z.string().optional(),
      barcode: z.string().optional(),
      country: z.string().optional().default("Germany"),
      language: z.string().optional().default("de")
    }).parse(req.query);
    res.json(await off.search({
      query: query.q,
      brand: query.brand,
      category: query.category,
      barcode: query.barcode,
      country: query.country,
      language: query.language
    }));
  })
);

openFoodFactsRouter.get(
  "/barcode/:barcode",
  asyncHandler(async (req, res) => {
    const product = await off.getByBarcode(req.params.barcode);
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    res.json(product);
  })
);

openFoodFactsRouter.post(
  "/import",
  asyncHandler(async (req, res) => {
    const body = z.object({
      product: productSchema,
      overrides: productSchema.partial().optional(),
      favorite: z.boolean().default(false),
      meal: z.object({
        date: z.coerce.date(),
        type: z.enum(["BREAKFAST", "LUNCH", "DINNER", "SNACK"]),
        amount: z.coerce.number().positive(),
        unit: z.string().default("g")
      }).optional()
    }).parse(req.body);
    const food = await importer.importProduct({ userId: req.user!.id, ...body });
    res.status(201).json(food);
  })
);

openFoodFactsRouter.post(
  "/foods/:id/sync",
  asyncHandler(async (req, res) => {
    res.json(await importer.syncFood(req.user!.id, req.params.id));
  })
);

openFoodFactsRouter.get(
  "/favorites",
  asyncHandler(async (req, res) => {
    res.json(await favorites.listFoods(req.user!.id));
  })
);
