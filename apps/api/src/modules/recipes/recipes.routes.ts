import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { requireMealPlannerAuth } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { fail, listRecipes, recipeFeedback, writeRecipe } from "../mealPlanner/recipes.js";
import { plannerScope } from "../mealPlanner/scope.js";

export const recipesRouter = Router();
recipesRouter.use(requireMealPlannerAuth);

recipesRouter.get("/", plannerScope("read", "recipes:write"), asyncHandler(async (req, res) => {
  const query = z.object({ q: z.string().trim().max(160).optional(), favorites: z.enum(["true", "false"]).optional() }).parse(req.query);
  res.json(await listRecipes(req.user!.id, query.q, query.favorites === "true"));
}));

recipesRouter.get("/:id", plannerScope("read", "recipes:write"), asyncHandler(async (req, res) => {
  const [recipe] = await listRecipes(req.user!.id, "", false, req.params.id);
  if (!recipe) throw fail(404, "Rezept nicht gefunden.");
  res.json(recipe);
}));

recipesRouter.post("/", plannerScope("write", "recipes:write"), asyncHandler(async (req, res) => {
  res.status(201).json(await writeRecipe(req.user!.id, req.body));
}));

recipesRouter.put("/:id", plannerScope("write"), asyncHandler(async (req, res) => {
  res.json(await writeRecipe(req.user!.id, req.body, req.params.id));
}));

recipesRouter.put("/:id/feedback", plannerScope("write"), asyncHandler(async (req, res) => {
  res.json(await recipeFeedback(req.user!.id, req.params.id, req.body));
}));

recipesRouter.delete("/:id", plannerScope("write", "recipes:write"), asyncHandler(async (req, res) => {
  await prisma.recipe.deleteMany({ where: { id: req.params.id, userId: req.user!.id } });
  res.status(204).end();
}));
