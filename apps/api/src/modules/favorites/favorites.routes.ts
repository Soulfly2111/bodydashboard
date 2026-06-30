import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const favoritesRouter = Router();
favoritesRouter.use(requireAuth);

favoritesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const favorites = await prisma.favorite.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: "desc" } });
    res.json(favorites);
  })
);

favoritesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = z.object({ type: z.enum(["FOOD", "MEAL", "RECIPE"]), targetId: z.string(), label: z.string().min(1) }).parse(req.body);
    const favorite = await prisma.favorite.upsert({
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
    await prisma.favorite.deleteMany({ where: { id: req.params.id, userId: req.user!.id } });
    res.status(204).end();
  })
);
