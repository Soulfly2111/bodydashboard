import { startOfDay } from "date-fns";
import { Router } from "express";
import type { Request } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { requireIntegrationAuth, requireIntegrationScope } from "../../middleware/integrationAuth.js";
import { IntegrationApiKeyService, IntegrationScopes } from "../../services/integrations/IntegrationApiKeyService.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const integrationsRouter = Router();

const keys = new IntegrationApiKeyService();

const scopesSchema = z.array(z.enum([
  IntegrationScopes.FOODS_WRITE,
  IntegrationScopes.MEALS_WRITE,
  IntegrationScopes.WATER_WRITE,
  IntegrationScopes.WEIGHT_WRITE
]));

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
  salt: z.coerce.number().nonnegative().default(0),
  externalId: z.string().optional().nullable()
});

const mealItemSchema = z.object({
  date: z.coerce.date(),
  type: z.enum(["BREAKFAST", "LUNCH", "DINNER", "SNACK"]),
  foodId: z.string(),
  amount: z.coerce.number().positive(),
  unit: z.string().default("g"),
  servingName: z.string().optional()
});

const mealItemUpdateSchema = z.object({
  foodId: z.string().optional(),
  amount: z.coerce.number().positive().optional(),
  unit: z.string().optional(),
  servingName: z.string().optional().nullable()
});

const quickAddSchema = mealItemSchema.omit({ foodId: true }).extend({
  food: foodSchema
});

const bodyMetricSchema = z.object({
  date: z.coerce.date().default(new Date()),
  weightKg: z.coerce.number().positive().optional().nullable(),
  bodyFatPercent: z.coerce.number().min(0).max(100).optional().nullable(),
  muscleMassKg: z.coerce.number().positive().optional().nullable()
}).refine((value) => value.weightKg != null || value.bodyFatPercent != null || value.muscleMassKg != null, {
  message: "At least one body metric is required"
});

function clientMeta(req: Request) {
  return { ipAddress: req.ip, userAgent: req.header("user-agent") };
}

integrationsRouter.get(
  "/api-keys",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await keys.list(req.user!.id));
  })
);

integrationsRouter.post(
  "/api-keys",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = z.object({
      name: z.string().min(2).default("OpenClaw"),
      provider: z.string().min(2).default("openclaw"),
      scopes: scopesSchema.optional(),
      expiresAt: z.coerce.date().optional().nullable()
    }).parse(req.body);
    res.status(201).json(await keys.create({ userId: req.user!.id, ...body, ...clientMeta(req) }));
  })
);

integrationsRouter.delete(
  "/api-keys/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    await keys.revoke(req.user!.id, req.params.id, clientMeta(req));
    res.status(204).end();
  })
);

integrationsRouter.get(
  "/openclaw/health",
  requireIntegrationAuth,
  asyncHandler(async (req, res) => {
    res.json({ ok: true, provider: req.integration!.provider, scopes: req.integration!.scopes });
  })
);

integrationsRouter.post(
  "/openclaw/foods",
  requireIntegrationAuth,
  requireIntegrationScope(IntegrationScopes.FOODS_WRITE),
  asyncHandler(async (req, res) => {
    const body = foodSchema.parse(req.body);
    const food = await upsertOpenClawFood(req.user!.id, body);
    res.status(201).json(food);
  })
);

integrationsRouter.post(
  "/openclaw/meals/items",
  requireIntegrationAuth,
  requireIntegrationScope(IntegrationScopes.MEALS_WRITE),
  asyncHandler(async (req, res) => {
    const body = mealItemSchema.parse(req.body);
    const item = await createMealItem(req.user!.id, body);
    res.status(201).json(item);
  })
);

integrationsRouter.put(
  "/openclaw/meals/items/:id",
  requireIntegrationAuth,
  requireIntegrationScope(IntegrationScopes.MEALS_WRITE),
  asyncHandler(async (req, res) => {
    const body = mealItemUpdateSchema.parse(req.body);
    const item = await updateMealItem(req.user!.id, req.params.id, body);
    res.json(item);
  })
);

integrationsRouter.delete(
  "/openclaw/meals/items/:id",
  requireIntegrationAuth,
  requireIntegrationScope(IntegrationScopes.MEALS_WRITE),
  asyncHandler(async (req, res) => {
    await prisma.mealItem.deleteMany({ where: { id: req.params.id, meal: { userId: req.user!.id } } });
    res.status(204).end();
  })
);

integrationsRouter.post(
  "/openclaw/meals/quick-add",
  requireIntegrationAuth,
  requireIntegrationScope(IntegrationScopes.FOODS_WRITE),
  requireIntegrationScope(IntegrationScopes.MEALS_WRITE),
  asyncHandler(async (req, res) => {
    const body = quickAddSchema.parse(req.body);
    const food = await upsertOpenClawFood(req.user!.id, body.food);
    const item = await createMealItem(req.user!.id, { ...body, foodId: food.id });
    res.status(201).json({ food, item });
  })
);

integrationsRouter.post(
  "/openclaw/water",
  requireIntegrationAuth,
  requireIntegrationScope(IntegrationScopes.WATER_WRITE),
  asyncHandler(async (req, res) => {
    const body = z.object({ date: z.coerce.date().default(new Date()), amountMl: z.coerce.number().int().positive() }).parse(req.body);
    const entry = await prisma.waterEntry.create({
      data: { userId: req.user!.id, date: startOfDay(body.date), amountMl: body.amountMl }
    });
    res.status(201).json(entry);
  })
);

integrationsRouter.post(
  "/openclaw/weight",
  requireIntegrationAuth,
  requireIntegrationScope(IntegrationScopes.WEIGHT_WRITE),
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

async function upsertOpenClawFood(userId: string, body: z.infer<typeof foodSchema>) {
  const externalId = body.externalId ?? body.barcode ?? null;
  if (externalId) {
    return prisma.food.upsert({
      where: { userId_externalId_source: { userId, externalId, source: "openclaw" } },
      update: { ...body, externalId, sourcePayload: JSON.stringify(body), lastSyncedAt: new Date() },
      create: { ...body, userId, externalId, source: "openclaw", importedAt: new Date(), lastSyncedAt: new Date(), sourcePayload: JSON.stringify(body) }
    });
  }

  return prisma.food.create({
    data: { ...body, userId, source: "openclaw", importedAt: new Date(), sourcePayload: JSON.stringify(body) }
  });
}

async function createMealItem(userId: string, body: z.infer<typeof mealItemSchema>) {
  const food = await prisma.food.findFirstOrThrow({ where: { id: body.foodId, OR: [{ userId }, { isPublic: true }] } });
  const meal = await prisma.meal.upsert({
    where: {
      userId_date_type: { userId, date: startOfDay(body.date), type: body.type }
    },
    update: {},
    create: { userId, date: startOfDay(body.date), type: body.type }
  });
  const item = await prisma.mealItem.create({
    data: {
      mealId: meal.id,
      foodId: food.id,
      amount: body.amount,
      unit: body.unit,
      servingName: body.servingName
    },
    include: { food: true }
  });
  await prisma.food.update({ where: { id: food.id }, data: { lastUsedAt: new Date() } });
  return item;
}

async function updateMealItem(userId: string, id: string, body: z.infer<typeof mealItemUpdateSchema>) {
  if (body.foodId) {
    await prisma.food.findFirstOrThrow({ where: { id: body.foodId, OR: [{ userId }, { isPublic: true }] } });
  }
  const existing = await prisma.mealItem.findFirstOrThrow({ where: { id, meal: { userId } } });
  const item = await prisma.mealItem.update({
    where: { id: existing.id },
    data: body,
    include: { food: true }
  });
  if (body.foodId) await prisma.food.update({ where: { id: body.foodId }, data: { lastUsedAt: new Date() } });
  return item;
}
