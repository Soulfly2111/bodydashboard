import { addDays, endOfDay, startOfDay, subDays, subMonths, subYears } from "date-fns";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { ActivityService } from "../../services/activities/ActivityService.js";
import { activityTypes, Intensities, metForIntensity } from "../../services/activities/activityCatalog.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const activitiesRouter = Router();
activitiesRouter.use(requireAuth);

const service = new ActivityService();

const activitySchema = z.object({
  typeName: z.string().min(2),
  date: z.coerce.date().default(new Date()),
  startTime: z.string().optional().nullable(),
  endTime: z.string().optional().nullable(),
  durationMinutes: z.coerce.number().int().positive(),
  intensity: z.enum(["VERY_LIGHT", "LIGHT", "MEDIUM", "HIGH", "VERY_HIGH"]).default("MEDIUM"),
  distanceKm: z.coerce.number().nonnegative().optional().nullable(),
  averageSpeedKmh: z.coerce.number().nonnegative().optional().nullable(),
  averageHeartRate: z.coerce.number().int().positive().optional().nullable(),
  maxHeartRate: z.coerce.number().int().positive().optional().nullable(),
  calories: z.coerce.number().nonnegative().optional().nullable(),
  notes: z.string().optional().nullable(),
  steps: z.coerce.number().int().nonnegative().optional().nullable(),
  elevationGainM: z.coerce.number().nonnegative().optional().nullable(),
  powerWatts: z.coerce.number().nonnegative().optional().nullable(),
  cadence: z.coerce.number().nonnegative().optional().nullable(),
  pace: z.string().optional().nullable(),
  source: z.string().default("manual"),
  externalId: z.string().optional().nullable(),
  muscleGroups: z.array(z.string()).optional(),
  exercisesCount: z.coerce.number().int().nonnegative().optional().nullable(),
  setsCount: z.coerce.number().int().nonnegative().optional().nullable(),
  repsCount: z.coerce.number().int().nonnegative().optional().nullable(),
  trainingVolume: z.coerce.number().nonnegative().optional().nullable()
});

const activityGoalSchema = z.object({
  trainingDaysPerWeek: z.coerce.number().int().nonnegative(),
  trainingMinutesPerWeek: z.coerce.number().int().nonnegative(),
  caloriesPerWeek: z.coerce.number().int().nonnegative(),
  stepsPerDay: z.coerce.number().int().nonnegative(),
  strengthSessionsPerWeek: z.coerce.number().int().nonnegative(),
  cardioSessionsPerWeek: z.coerce.number().int().nonnegative()
});

activitiesRouter.get(
  "/types",
  asyncHandler(async (_req, res) => {
    const dbTypes = await prisma.activityType.findMany({ include: { metValues: true }, orderBy: { name: "asc" } });
    if (dbTypes.length) return res.json(dbTypes);
    res.json(activityTypes.map((type) => ({
      ...type,
      metValues: Object.keys(Intensities).map((intensity) => ({ intensity, met: metForIntensity(type.defaultMet, intensity) }))
    })));
  })
);

activitiesRouter.get(
  "/goals",
  asyncHandler(async (req, res) => {
    const goal = await prisma.activityGoal.upsert({ where: { userId: req.user!.id }, update: {}, create: { userId: req.user!.id } });
    res.json(goal);
  })
);

activitiesRouter.put(
  "/goals",
  asyncHandler(async (req, res) => {
    const data = activityGoalSchema.parse(req.body);
    const goal = await prisma.activityGoal.upsert({ where: { userId: req.user!.id }, update: data, create: { ...data, userId: req.user!.id } });
    res.json(goal);
  })
);

activitiesRouter.get(
  "/statistics",
  asyncHandler(async (req, res) => {
    const from = req.query.from ? new Date(String(req.query.from)) : subDays(new Date(), 30);
    const to = req.query.to ? new Date(String(req.query.to)) : new Date();
    res.json(await service.stats(req.user!.id, from, to));
  })
);

activitiesRouter.get("/today", asyncHandler(async (req, res) => res.json(await service.stats(req.user!.id, new Date(), new Date()))));
activitiesRouter.get("/week", asyncHandler(async (req, res) => res.json(await service.stats(req.user!.id, subDays(new Date(), 6), new Date()))));
activitiesRouter.get("/month", asyncHandler(async (req, res) => res.json(await service.stats(req.user!.id, subMonths(new Date(), 1), new Date()))));
activitiesRouter.get("/year", asyncHandler(async (req, res) => res.json(await service.stats(req.user!.id, subYears(new Date(), 1), new Date()))));

activitiesRouter.get(
  "/calendar",
  asyncHandler(async (req, res) => {
    const start = req.query.start ? startOfDay(new Date(String(req.query.start))) : startOfDay(subDays(new Date(), 30));
    const end = req.query.end ? endOfDay(new Date(String(req.query.end))) : endOfDay(addDays(start, 30));
    const activities = await service.list(req.user!.id, { from: start, to: end, limit: 500 });
    res.json(activities.reduce<Record<string, typeof activities>>((acc, item) => {
      const key = item.date.toISOString().slice(0, 10);
      acc[key] ??= [];
      acc[key].push(item);
      return acc;
    }, {}));
  })
);

activitiesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const from = req.query.from ? new Date(String(req.query.from)) : undefined;
    const to = req.query.to ? new Date(String(req.query.to)) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    res.json(await service.list(req.user!.id, { from, to, limit }));
  })
);

activitiesRouter.get("/:id", asyncHandler(async (req, res) => res.json(await service.get(req.user!.id, req.params.id))));

activitiesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const activity = await service.create(req.user!.id, activitySchema.parse(req.body));
    res.status(201).json(activity);
  })
);

activitiesRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json(await service.update(req.user!.id, req.params.id, activitySchema.partial().parse(req.body)));
  })
);

activitiesRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await service.delete(req.user!.id, req.params.id);
    res.status(204).end();
  })
);
