import { addDays, endOfDay, format, startOfDay, subDays } from "date-fns";
import { Router } from "express";
import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { emptyTotals, roundTotals, totalsForItems } from "../../utils/nutrition.js";

export const statsRouter = Router();
statsRouter.use(requireAuth);

statsRouter.get(
  "/day/:date",
  asyncHandler(async (req, res) => {
    const date = new Date(req.params.date);
    const [meals, water, weight, goal, user] = await Promise.all([
      prisma.meal.findMany({
        where: { userId: req.user!.id, date: { gte: startOfDay(date), lte: endOfDay(date) } },
        include: { items: { include: { food: true } } }
      }),
      prisma.waterEntry.findMany({ where: { userId: req.user!.id, date: { gte: startOfDay(date), lte: endOfDay(date) } } }),
      prisma.weightEntry.findFirst({ where: { userId: req.user!.id }, orderBy: { date: "desc" } }),
      prisma.goal.upsert({ where: { userId: req.user!.id }, update: {}, create: { userId: req.user!.id } }),
      prisma.user.findUnique({ where: { id: req.user!.id } })
    ]);
    const totals = meals.flatMap((meal) => meal.items).reduce((acc, item) => {
      acc.calories += (item.food.caloriesPer100g * item.amount) / 100;
      acc.protein += (item.food.protein * item.amount) / 100;
      acc.carbs += (item.food.carbs * item.amount) / 100;
      acc.fat += (item.food.fat * item.amount) / 100;
      acc.fiber += (item.food.fiber * item.amount) / 100;
      acc.sugar += (item.food.sugar * item.amount) / 100;
      acc.salt += (item.food.salt * item.amount) / 100;
      return acc;
    }, emptyTotals());
    const waterMl = water.reduce((sum, item) => sum + item.amountMl, 0);
    const bmi = weight?.weightKg && user?.heightCm ? weight.weightKg / Math.pow(user.heightCm / 100, 2) : null;
    res.json({ totals: roundTotals(totals), waterMl, weight, bmi: bmi ? Math.round(bmi * 10) / 10 : null, goal });
  })
);

statsRouter.get(
  "/week",
  asyncHandler(async (req, res) => {
    const explicitStart = req.query.start ? startOfDay(new Date(String(req.query.start))) : null;
    const end = req.query.end
      ? startOfDay(new Date(String(req.query.end)))
      : explicitStart ? addDays(explicitStart, 6) : new Date();
    const start = explicitStart ?? subDays(startOfDay(end), 6);
    const [meals, water, weights] = await Promise.all([
      prisma.meal.findMany({
        where: { userId: req.user!.id, date: { gte: start, lte: endOfDay(end) } },
        include: { items: { include: { food: true } } }
      }),
      prisma.waterEntry.findMany({ where: { userId: req.user!.id, date: { gte: start, lte: endOfDay(end) } } }),
      prisma.weightEntry.findMany({ where: { userId: req.user!.id, date: { gte: start, lte: endOfDay(end) } }, orderBy: { date: "asc" } })
    ]);
    const days = Array.from({ length: 7 }, (_, index) => {
      const day = addDays(start, index);
      const dateKey = format(day, "yyyy-MM-dd");
      const dayMeals = meals.filter((meal) => format(meal.date, "yyyy-MM-dd") === dateKey);
      const waterMl = water.filter((entry) => format(entry.date, "yyyy-MM-dd") === dateKey).reduce((sum, entry) => sum + entry.amountMl, 0);
      const weight = weights.find((entry) => format(entry.date, "yyyy-MM-dd") === dateKey);
      const totals = dayMeals.reduce((acc, meal) => {
        const mealTotals = totalsForItems(meal.items);
        acc.calories += mealTotals.calories;
        acc.protein += mealTotals.protein;
        acc.carbs += mealTotals.carbs;
        acc.fat += mealTotals.fat;
        acc.fiber += mealTotals.fiber;
        acc.sugar += mealTotals.sugar;
        acc.salt += mealTotals.salt;
        return acc;
      }, emptyTotals());
      return {
        date: dateKey,
        ...roundTotals(totals),
        waterMl,
        weightKg: weight?.weightKg ?? null,
        bodyFatPercent: weight?.bodyFatPercent ?? null,
        muscleMassKg: weight?.muscleMassKg ?? null
      };
    });
    const nutritionAverages = roundTotals(days.reduce((acc, day) => {
      acc.calories += day.calories / 7;
      acc.protein += day.protein / 7;
      acc.carbs += day.carbs / 7;
      acc.fat += day.fat / 7;
      acc.fiber += day.fiber / 7;
      acc.sugar += day.sugar / 7;
      acc.salt += day.salt / 7;
      return acc;
    }, emptyTotals()));
    const averageWaterMl = Math.round(days.reduce((sum, day) => sum + day.waterMl, 0) / 7);
    res.json({ start: format(start, "yyyy-MM-dd"), end: format(end, "yyyy-MM-dd"), days, averages: { ...nutritionAverages, waterMl: averageWaterMl } });
  })
);
