import { Router } from "express";
import type { Request } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { AuthService } from "../../services/security/AuthService.js";
import { UserService } from "../../services/security/UserService.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const authRouter = Router();
const auth = new AuthService();
const users = new UserService();

const passwordSchema = z.string().min(10);

function clientMeta(req: Request) {
  return { ipAddress: req.ip, userAgent: req.header("user-agent") };
}

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const body = z.object({ name: z.string().min(2), email: z.string().email(), password: passwordSchema }).parse(req.body);
    const user = await auth.register({ ...body, ...clientMeta(req) });
    res.status(201).json({ user });
  })
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const body = z.object({
      email: z.string().min(2),
      password: z.string().min(8),
      rememberMe: z.boolean().default(false)
    }).parse(req.body);
    try {
      res.json(await auth.login({ emailOrUsername: body.email, password: body.password, rememberMe: body.rememberMe, ...clientMeta(req) }));
    } catch (error) {
      res.status(401).json({ error: error instanceof Error ? error.message : "Invalid credentials" });
    }
  })
);

authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const body = z.object({ refreshToken: z.string().min(20) }).parse(req.body);
    try {
      res.json(await auth.refresh(body.refreshToken, clientMeta(req)));
    } catch {
      res.status(401).json({ error: "Invalid refresh token" });
    }
  })
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const body = z.object({ refreshToken: z.string().optional() }).parse(req.body);
    if (body.refreshToken) await auth.logout(body.refreshToken);
    res.status(204).end();
  })
);

authRouter.post(
  "/change-password",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = z.object({ currentPassword: z.string(), nextPassword: passwordSchema }).parse(req.body);
    await auth.changePassword(req.user!.id, body.currentPassword, body.nextPassword);
    res.status(204).end();
  })
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: users.publicSelect() });
    res.json(user);
  })
);

authRouter.put(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = z.object({
      name: z.string().min(2).optional(),
      firstName: z.string().optional().nullable(),
      lastName: z.string().optional().nullable(),
      language: z.string().optional(),
      units: z.enum(["metric", "imperial"]).optional(),
      timezone: z.string().optional(),
      theme: z.string().optional(),
      heightCm: z.coerce.number().positive().optional().nullable(),
      trackWeight: z.boolean().optional(),
      trackBodyFat: z.boolean().optional(),
      trackMuscleMass: z.boolean().optional(),
      trackWater: z.boolean().optional()
    }).parse(req.body);
    res.json(await users.update(req.user!.id, body));
  })
);
