import { startOfDay } from "date-fns";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { DefaultFoodMatchingService } from "../../services/aiMealRecognition/FoodMatchingService.js";
import { LocalImageUploadService } from "../../services/aiMealRecognition/ImageUploadService.js";
import { DefaultMealCreationService } from "../../services/aiMealRecognition/MealCreationService.js";
import { DefaultNutritionEstimationService } from "../../services/aiMealRecognition/NutritionEstimationService.js";
import { ProviderRegistryRecognitionService } from "../../services/aiMealRecognition/AIRecognitionService.js";
import type { AiMealMode, AiProviderId, RecognizedFoodDraft } from "../../services/aiMealRecognition/types.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const aiMealsRouter = Router();
aiMealsRouter.use(requireAuth);

const uploads = new LocalImageUploadService();
const recognition = new ProviderRegistryRecognitionService();
const matcher = new DefaultFoodMatchingService();
const nutrition = new DefaultNutritionEstimationService();
const mealCreator = new DefaultMealCreationService();

const providerSchema = z.enum(["local", "openai", "gemini", "anthropic", "azure_openai", "ollama"]);
const modeSchema = z.enum(["AUTO", "REVIEW_REQUIRED", "ALWAYS_EDIT"]);

const itemSchema = z.object({
  foodId: z.string().optional(),
  name: z.string().min(1),
  category: z.string().optional(),
  amount: z.coerce.number().positive(),
  weightGrams: z.coerce.number().positive(),
  servingName: z.string().optional(),
  calories: z.coerce.number().nonnegative(),
  protein: z.coerce.number().nonnegative(),
  carbs: z.coerce.number().nonnegative(),
  fat: z.coerce.number().nonnegative(),
  fiber: z.coerce.number().nonnegative().default(0),
  sugar: z.coerce.number().nonnegative().default(0),
  salt: z.coerce.number().nonnegative().default(0),
  confidence: z.coerce.number().int().min(0).max(100),
  source: z.string().default("ai_estimate")
});

function defaultSettings(userId: string) {
  return {
    userId,
    mode: "REVIEW_REQUIRED",
    minConfidence: 90,
    storeImages: false,
    deleteAfterAnalysis: true,
    linkImageToMeal: false,
    provider: "local"
  };
}

async function getSettings(userId: string) {
  return await prisma.aiRecognitionSetting.findUnique({ where: { userId } }) ?? defaultSettings(userId);
}

aiMealsRouter.get(
  "/settings",
  asyncHandler(async (req, res) => {
    res.json(await getSettings(req.user!.id));
  })
);

aiMealsRouter.put(
  "/settings",
  asyncHandler(async (req, res) => {
    const body = z.object({
      mode: modeSchema,
      minConfidence: z.coerce.number().int().min(0).max(100),
      storeImages: z.boolean(),
      deleteAfterAnalysis: z.boolean(),
      linkImageToMeal: z.boolean(),
      provider: providerSchema
    }).parse(req.body);

    const settings = await prisma.aiRecognitionSetting.upsert({
      where: { userId: req.user!.id },
      update: body,
      create: { userId: req.user!.id, ...body }
    });
    res.json(settings);
  })
);

aiMealsRouter.post(
  "/analyze",
  asyncHandler(async (req, res) => {
    const body = z.object({
      date: z.coerce.date().default(new Date()),
      mealType: z.string().default("SNACK"),
      customMealTag: z.string().optional(),
      mode: modeSchema.optional(),
      provider: providerSchema.optional(),
      images: z.array(z.object({
        fileName: z.string(),
        mimeType: z.string(),
        dataUrl: z.string()
      })).min(1).max(5)
    }).parse(req.body);

    const settings = await getSettings(req.user!.id);
    const mode = (body.mode ?? settings.mode) as AiMealMode;
    const provider = (body.provider ?? settings.provider) as AiProviderId;
    const storedImages = await uploads.accept(body.images, {
      userId: req.user!.id,
      storeImages: settings.storeImages,
      deleteAfterAnalysis: settings.deleteAfterAnalysis
    });

    const result = await recognition.analyze({ images: storedImages, provider, locale: "de-DE" });
    const matchedItems = await Promise.all(result.items.map((item) => matcher.match(req.user!.id, item)));
    const totals = nutrition.recalculate(matchedItems);
    const canAutoSave = mode === "AUTO" && matchedItems.every((item) => item.confidence >= settings.minConfidence);

    const analysis = await prisma.aiMealAnalysis.create({
      data: {
        userId: req.user!.id,
        date: startOfDay(body.date),
        mealType: body.mealType,
        customMealTag: body.customMealTag,
        provider: result.provider,
        mode,
        status: canAutoSave ? "AUTO_PENDING" : "DRAFT",
        confidence: result.confidence,
        imagePath: storedImages[0]?.path,
        imageFileName: storedImages.map((image) => image.fileName).join(", "),
        imageMimeType: storedImages[0]?.mimeType,
        imageSha256: storedImages.map((image) => image.sha256).join(","),
        rawResultJson: JSON.stringify(result.rawResult ?? result),
        totalsJson: JSON.stringify(totals),
        items: {
          create: matchedItems.map((item) => ({
            foodId: item.foodId,
            name: item.name,
            category: item.category,
            amount: item.amount,
            weightGrams: item.weightGrams,
            servingName: item.servingName,
            calories: item.calories,
            protein: item.protein,
            carbs: item.carbs,
            fat: item.fat,
            fiber: item.fiber,
            sugar: item.sugar,
            salt: item.salt,
            confidence: item.confidence,
            source: item.source ?? "ai_estimate"
          }))
        }
      },
      include: { items: true }
    });

    if (canAutoSave) {
      const saved = await mealCreator.createFromAnalysis({
        userId: req.user!.id,
        analysisId: analysis.id,
        date: body.date,
        mealType: body.mealType,
        customMealTag: body.customMealTag,
        items: matchedItems,
        saveUnknownFoods: false
      });
      const updated = await prisma.aiMealAnalysis.findUnique({ where: { id: analysis.id }, include: { items: true } });
      res.status(201).json({ analysis: updated, totals, autoSaved: true, mealId: saved.mealId });
      return;
    }

    res.status(201).json({ analysis, totals, autoSaved: false });
  })
);

aiMealsRouter.post(
  "/analyses/:id/confirm",
  asyncHandler(async (req, res) => {
    const body = z.object({
      date: z.coerce.date(),
      mealType: z.string(),
      customMealTag: z.string().optional(),
      saveUnknownFoods: z.boolean().default(true),
      items: z.array(itemSchema).min(1)
    }).parse(req.body);

    const analysis = await prisma.aiMealAnalysis.findFirstOrThrow({ where: { id: req.params.id, userId: req.user!.id } });
    const totals = nutrition.recalculate(body.items as RecognizedFoodDraft[]);
    await prisma.aiMealAnalysis.update({
      where: { id: analysis.id },
      data: {
        manualChangesJson: JSON.stringify(body.items),
        totalsJson: JSON.stringify(totals),
        items: {
          deleteMany: {},
          create: body.items.map((item) => ({
            foodId: item.foodId,
            name: item.name,
            category: item.category,
            amount: item.amount,
            weightGrams: item.weightGrams,
            servingName: item.servingName,
            calories: item.calories,
            protein: item.protein,
            carbs: item.carbs,
            fat: item.fat,
            fiber: item.fiber,
            sugar: item.sugar,
            salt: item.salt,
            confidence: item.confidence,
            source: item.source
          }))
        }
      }
    });

    const saved = await mealCreator.createFromAnalysis({
      userId: req.user!.id,
      analysisId: analysis.id,
      date: body.date,
      mealType: body.mealType,
      customMealTag: body.customMealTag,
      items: body.items as RecognizedFoodDraft[],
      saveUnknownFoods: body.saveUnknownFoods
    });

    res.status(201).json({ ...saved, totals });
  })
);

aiMealsRouter.get(
  "/history",
  asyncHandler(async (req, res) => {
    const analyses = await prisma.aiMealAnalysis.findMany({
      where: { userId: req.user!.id },
      include: { items: true },
      orderBy: { analyzedAt: "desc" },
      take: 30
    });
    res.json(analyses);
  })
);
