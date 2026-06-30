import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { FoodRepository } from "../../repositories/foodRepository.js";

export const foodsRouter = Router();
const repo = new FoodRepository();

const foodSchema = z.object({
  name: z.string().min(1),
  brand: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  caloriesPer100g: z.coerce.number().nonnegative(),
  protein: z.coerce.number().nonnegative(),
  fat: z.coerce.number().nonnegative(),
  carbs: z.coerce.number().nonnegative(),
  sugar: z.coerce.number().nonnegative().default(0),
  fiber: z.coerce.number().nonnegative().default(0),
  salt: z.coerce.number().nonnegative().default(0)
});

foodsRouter.use(requireAuth);

foodsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const foods = await repo.search(
      req.user!.id,
      String(req.query.q ?? ""),
      Number(req.query.take ?? 25),
      Number(req.query.skip ?? 0)
    );
    res.json(foods);
  })
);

foodsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = foodSchema.parse(req.body);
    const food = await repo.create({ ...body, user: { connect: { id: req.user!.id } }, source: "manual" });
    res.status(201).json(food);
  })
);

foodsRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const food = await repo.update(req.params.id, req.user!.id, foodSchema.partial().parse(req.body));
    res.json(food);
  })
);

foodsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await repo.delete(req.params.id, req.user!.id);
    res.status(204).end();
  })
);
