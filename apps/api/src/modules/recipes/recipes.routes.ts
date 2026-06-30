import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { addFoodAmount, emptyTotals, roundTotals } from "../../utils/nutrition.js";

export const recipesRouter = Router();
recipesRouter.use(requireAuth);

const recipeSchema = z.object({
  name: z.string().min(1),
  servings: z.coerce.number().int().positive().default(1),
  instructions: z.string().optional(),
  category: z.string().optional(),
  items: z.array(z.object({ foodId: z.string(), amount: z.coerce.number().positive(), unit: z.string().default("g") })).default([])
});

recipesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const recipes = await prisma.recipe.findMany({
      where: { userId: req.user!.id },
      include: { items: { include: { food: true } } },
      orderBy: { name: "asc" }
    });
    res.json(
      recipes.map((recipe) => ({
        ...recipe,
        totals: roundTotals(recipe.items.reduce((acc, item) => addFoodAmount(acc, item.food, item.amount), emptyTotals()))
      }))
    );
  })
);

recipesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = recipeSchema.parse(req.body);
    const recipe = await prisma.recipe.create({
      data: {
        userId: req.user!.id,
        name: body.name,
        servings: body.servings,
        instructions: body.instructions,
        category: body.category,
        items: { create: body.items }
      },
      include: { items: { include: { food: true } } }
    });
    res.status(201).json(recipe);
  })
);

recipesRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await prisma.recipe.deleteMany({ where: { id: req.params.id, userId: req.user!.id } });
    res.status(204).end();
  })
);
