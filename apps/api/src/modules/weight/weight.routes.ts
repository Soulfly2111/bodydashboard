import { startOfDay, subDays } from "date-fns";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const weightRouter = Router();
weightRouter.use(requireAuth);

const bodyMetricSchema = z.object({
  date: z.coerce.date().default(new Date()),
  weightKg: z.coerce.number().positive().optional().nullable(),
  bodyFatPercent: z.coerce.number().min(0).max(100).optional().nullable(),
  muscleMassKg: z.coerce.number().positive().optional().nullable()
}).refine((value) => value.weightKg != null || value.bodyFatPercent != null || value.muscleMassKg != null, {
  message: "At least one body metric is required"
});

weightRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const range = Number(req.query.days ?? 30);
    const entries = await prisma.weightEntry.findMany({
      where: { userId: req.user!.id, date: { gte: subDays(new Date(), range) } },
      orderBy: { date: "asc" }
    });
    res.json(entries);
  })
);

weightRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = bodyMetricSchema.parse(req.body);
    const entry = await prisma.weightEntry.upsert({
      where: { userId_date: { userId: req.user!.id, date: startOfDay(body.date) } },
      update: { weightKg: body.weightKg, bodyFatPercent: body.bodyFatPercent, muscleMassKg: body.muscleMassKg },
      create: { userId: req.user!.id, date: startOfDay(body.date), weightKg: body.weightKg, bodyFatPercent: body.bodyFatPercent, muscleMassKg: body.muscleMassKg }
    });
    res.status(201).json(entry);
  })
);
