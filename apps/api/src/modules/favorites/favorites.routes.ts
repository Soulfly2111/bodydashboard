import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { FavoriteService } from "../../services/favorites/FavoriteService.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const favoritesRouter = Router();
const favoriteService = new FavoriteService();
favoritesRouter.use(requireAuth);

favoritesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json(await favoriteService.list(req.user!.id));
  })
);

favoritesRouter.get(
  "/foods",
  asyncHandler(async (req, res) => {
    res.json(await favoriteService.listFoods(req.user!.id));
  })
);

favoritesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = z.object({ type: z.enum(["FOOD", "MEAL", "RECIPE"]), targetId: z.string(), label: z.string().min(1) }).parse(req.body);
    const favorite = body.type === "FOOD"
      ? await favoriteService.upsertFood(req.user!.id, body.targetId, body.label)
      : await prisma.favorite.upsert({
          where: { userId_type_targetId: { userId: req.user!.id, type: body.type, targetId: body.targetId } },
          update: { label: body.label },
          create: { ...body, userId: req.user!.id }
        });
    res.status(201).json(favorite);
  })
);

favoritesRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await favoriteService.delete(req.user!.id, req.params.id);
    res.status(204).end();
  })
);
