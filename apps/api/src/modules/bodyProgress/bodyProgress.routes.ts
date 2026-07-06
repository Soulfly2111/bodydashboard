import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { bodyMeasurementTypes } from "../../services/bodyProgress/bodyMeasurementCatalog.js";
import { BodyMeasurementService } from "../../services/bodyProgress/BodyMeasurementService.js";
import { BodyPhotoAnalysisService } from "../../services/bodyProgress/BodyPhotoAnalysisService.js";
import { BodyPhotoService } from "../../services/bodyProgress/BodyPhotoService.js";
import { BodyProgressComparisonService } from "../../services/bodyProgress/BodyProgressComparisonService.js";
import { BodyProgressStatisticsService } from "../../services/bodyProgress/BodyProgressStatisticsService.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const bodyProgressRouter = Router();
bodyProgressRouter.use(requireAuth);

const photos = new BodyPhotoService();
const measurements = new BodyMeasurementService();
const analysis = new BodyPhotoAnalysisService();
const statistics = new BodyProgressStatisticsService();
const comparison = new BodyProgressComparisonService();

const photoSchema = z.object({
  date: z.coerce.date().default(new Date()),
  viewType: z.enum(["FRONT", "BACK", "LEFT", "RIGHT", "CUSTOM"]).default("FRONT"),
  imageUrl: z.string().min(1),
  thumbnailUrl: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  linkedWeightEntryId: z.string().optional().nullable(),
  trainingPhase: z.string().optional().nullable(),
  dietPhase: z.string().optional().nullable(),
  referenceObject: z.string().optional().nullable()
});

const measurementSchema = z.object({
  date: z.coerce.date().default(new Date()),
  measurementType: z.string().min(2),
  value: z.coerce.number().positive(),
  unit: z.string().default("cm"),
  source: z.string().default("manual"),
  confidence: z.coerce.number().int().min(0).max(100).optional().nullable(),
  confirmedByUser: z.boolean().default(true),
  notes: z.string().optional().nullable()
});

const settingsSchema = z.object({
  aiMode: z.enum(["SHOW_ONLY", "DRAFT", "CONFIRM", "AUTO_CONFIDENCE"]).default("SHOW_ONLY"),
  minConfidenceForAutoApply: z.coerce.number().int().min(0).max(100).default(90),
  useHeightAsReference: z.boolean().default(true),
  localStorageOnly: z.boolean().default(true),
  encryptedStorage: z.boolean().default(false),
  deletePhotosAfterAnalysis: z.boolean().default(false),
  maxImageSizeMb: z.coerce.number().int().positive().default(8),
  stripExif: z.boolean().default(true)
});

bodyProgressRouter.get("/measurement-types", asyncHandler(async (_req, res) => res.json(bodyMeasurementTypes)));
bodyProgressRouter.get("/photos", asyncHandler(async (req, res) => res.json(await photos.list(req.user!.id))));
bodyProgressRouter.get("/photos/:id", asyncHandler(async (req, res) => res.json(await photos.get(req.user!.id, req.params.id))));
bodyProgressRouter.post("/photos", asyncHandler(async (req, res) => res.status(201).json(await photos.create(req.user!.id, photoSchema.parse(req.body)))));
bodyProgressRouter.put("/photos/:id", asyncHandler(async (req, res) => res.json(await photos.update(req.user!.id, req.params.id, photoSchema.partial().parse(req.body)))));
bodyProgressRouter.delete("/photos/:id", asyncHandler(async (req, res) => { await photos.delete(req.user!.id, req.params.id); res.status(204).end(); }));
bodyProgressRouter.post("/photos/:id/analyze", asyncHandler(async (req, res) => res.status(201).json(await analysis.analyze(req.user!.id, req.params.id))));
bodyProgressRouter.get("/photos/:id/analysis", asyncHandler(async (req, res) => res.json(await analysis.getForPhoto(req.user!.id, req.params.id))));

bodyProgressRouter.get("/measurements", asyncHandler(async (req, res) => res.json(await measurements.list(req.user!.id))));
bodyProgressRouter.get("/measurements/:id", asyncHandler(async (req, res) => res.json(await measurements.get(req.user!.id, req.params.id))));
bodyProgressRouter.post("/measurements", asyncHandler(async (req, res) => res.status(201).json(await measurements.create(req.user!.id, measurementSchema.parse(req.body)))));
bodyProgressRouter.put("/measurements/:id", asyncHandler(async (req, res) => res.json(await measurements.update(req.user!.id, req.params.id, measurementSchema.partial().parse(req.body)))));
bodyProgressRouter.delete("/measurements/:id", asyncHandler(async (req, res) => { await measurements.delete(req.user!.id, req.params.id); res.status(204).end(); }));

bodyProgressRouter.get("/statistics", asyncHandler(async (req, res) => res.json(await statistics.statistics(req.user!.id))));
bodyProgressRouter.get("/timeline", asyncHandler(async (req, res) => {
  const [photoList, measurementList] = await Promise.all([photos.list(req.user!.id), measurements.list(req.user!.id)]);
  res.json([...photoList.map((item) => ({ type: "photo", date: item.date, item })), ...measurementList.map((item) => ({ type: "measurement", date: item.date, item }))].sort((a, b) => String(b.date).localeCompare(String(a.date))));
}));
bodyProgressRouter.get("/compare", asyncHandler(async (req, res) => {
  const from = req.query.from ? new Date(String(req.query.from)) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const to = req.query.to ? new Date(String(req.query.to)) : new Date();
  res.json(await comparison.compare(req.user!.id, from, to));
}));

bodyProgressRouter.get("/settings", asyncHandler(async (req, res) => {
  const settings = await prisma.bodyProgressSettings.upsert({ where: { userId: req.user!.id }, update: {}, create: { userId: req.user!.id } });
  res.json(settings);
}));
bodyProgressRouter.put("/settings", asyncHandler(async (req, res) => {
  const data = settingsSchema.parse(req.body);
  const settings = await prisma.bodyProgressSettings.upsert({ where: { userId: req.user!.id }, update: data, create: { ...data, userId: req.user!.id } });
  res.json(settings);
}));
