import { endOfDay, startOfDay } from "date-fns";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const waterRouter = Router();
waterRouter.use(requireAuth);

waterRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const date = req.query.date ? new Date(String(req.query.date)) : new Date();
    const entries = await prisma.waterEntry.findMany({
      where: { userId: req.user!.id, date: { gte: startOfDay(date), lte: endOfDay(date) } },
      orderBy: { createdAt: "desc" }
    });
    res.json({ entries, totalMl: entries.reduce((sum, item) => sum + item.amountMl, 0) });
  })
);

waterRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = z.object({ date: z.coerce.date().default(new Date()), amountMl: z.coerce.number().int().positive() }).parse(req.body);
    const entry = await prisma.waterEntry.create({
      data: { userId: req.user!.id, date: startOfDay(body.date), amountMl: body.amountMl }
    });
    res.status(201).json(entry);
  })
);
