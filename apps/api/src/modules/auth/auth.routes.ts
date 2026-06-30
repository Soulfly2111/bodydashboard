import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { requireAuth, signToken } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const authRouter = Router();

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const body = credentialsSchema.extend({ name: z.string().min(2) }).parse(req.body);
    const passwordHash = await bcrypt.hash(body.password, 12);
    const user = await prisma.user.create({
      data: {
        email: body.email.toLowerCase(),
        name: body.name,
        passwordHash,
        goal: { create: {} }
      }
    });
    res.status(201).json({ token: signToken(user), user: { id: user.id, email: user.email, name: user.name } });
  })
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const body = credentialsSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    res.json({ token: signToken(user), user: { id: user.id, email: user.email, name: user.name } });
  })
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, email: true, name: true, language: true, units: true, theme: true, heightCm: true }
    });
    res.json(user);
  })
);
