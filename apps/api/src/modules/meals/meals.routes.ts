import { endOfDay, startOfDay } from "date-fns";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { totalsForItems } from "../../utils/nutrition.js";

export const mealsRouter = Router();
mealsRouter.use(requireAuth);

const itemSchema = z.object({
  date: z.coerce.date(),
  type: z.enum(["BREAKFAST", "LUNCH", "DINNER", "SNACK"]),
  foodId: z.string(),
  amount: z.coerce.number().positive(),
  unit: z.string().default("g"),
  servingName: z.string().optional()
});

const itemUpdateSchema = z.object({
  foodId: z.string().optional(),
  amount: z.coerce.number().positive().optional(),
  unit: z.string().optional(),
  servingName: z.string().optional().nullable()
});

mealsRouter.get(
  "/day/:date",
  asyncHandler(async (req, res) => {
    const date = new Date(req.params.date);
    const meals = await prisma.meal.findMany({
      where: { userId: req.user!.id, date: { gte: startOfDay(date), lte: endOfDay(date) } },
      include: { items: { include: { food: true } } },
      orderBy: { type: "asc" }
    });
    res.json(meals.map((meal) => ({ ...meal, totals: totalsForItems(meal.items) })));
  })
);

mealsRouter.post(
  "/items",
  asyncHandler(async (req, res) => {
    const body = itemSchema.parse(req.body);
    const meal = await prisma.meal.upsert({
      where: {
        userId_date_type: { userId: req.user!.id, date: startOfDay(body.date), type: body.type }
      },
      update: {},
      create: { userId: req.user!.id, date: startOfDay(body.date), type: body.type }
    });
    const item = await prisma.mealItem.create({
      data: {
        mealId: meal.id,
        foodId: body.foodId,
        amount: body.amount,
        unit: body.unit,
        servingName: body.servingName
      },
      include: { food: true }
    });
    await prisma.food.update({ where: { id: body.foodId }, data: { lastUsedAt: new Date() } });
    res.status(201).json(item);
  })
);

mealsRouter.put(
  "/items/:id",
  asyncHandler(async (req, res) => {
    const body = itemUpdateSchema.parse(req.body);
    if (body.foodId) {
      await prisma.food.findFirstOrThrow({ where: { id: body.foodId, OR: [{ userId: req.user!.id }, { isPublic: true }] } });
    }
    const existing = await prisma.mealItem.findFirstOrThrow({ where: { id: req.params.id, meal: { userId: req.user!.id } } });
    const item = await prisma.mealItem.update({
      where: { id: existing.id },
      data: body,
      include: { food: true }
    });
    if (body.foodId) await prisma.food.update({ where: { id: body.foodId }, data: { lastUsedAt: new Date() } });
    res.json(item);
  })
);

mealsRouter.delete(
  "/items/:id",
  asyncHandler(async (req, res) => {
    await prisma.mealItem.deleteMany({ where: { id: req.params.id, meal: { userId: req.user!.id } } });
    res.status(204).end();
  })
);
