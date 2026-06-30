import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const goalsRouter = Router();
goalsRouter.use(requireAuth);

const goalSchema = z.object({
  calories: z.coerce.number().int().positive(),
  protein: z.coerce.number().int().nonnegative(),
  fat: z.coerce.number().int().nonnegative(),
  carbs: z.coerce.number().int().nonnegative(),
  waterMl: z.coerce.number().int().positive(),
  weightKg: z.coerce.number().positive().optional().nullable()
});

goalsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const goal = await prisma.goal.upsert({
      where: { userId: req.user!.id },
      update: {},
      create: { userId: req.user!.id }
    });
    res.json(goal);
  })
);

goalsRouter.put(
  "/",
  asyncHandler(async (req, res) => {
    const data = goalSchema.parse(req.body);
    const goal = await prisma.goal.upsert({
      where: { userId: req.user!.id },
      update: data,
      create: { ...data, userId: req.user!.id }
    });
    res.json(goal);
  })
);
