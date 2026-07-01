import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { PermissionService } from "../services/security/PermissionService.js";
import type { Permission } from "../services/security/roles.js";

export type AuthUser = {
  id: string;
  email: string;
  role: string;
  status?: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signAccessToken(user: AuthUser) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role, status: user.status }, env.JWT_SECRET, { expiresIn: "15m" });
}

export const signToken = signAccessToken;

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    req.user = jwt.verify(token, env.JWT_SECRET) as AuthUser;
    if (req.user.status && req.user.status !== "ACTIVE") {
      res.status(403).json({ error: "Account is disabled" });
      return;
    }
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requirePermission(permission: Permission) {
  const permissions = new PermissionService();
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !permissions.has(req.user.role, permission)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}
