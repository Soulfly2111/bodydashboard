import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { IntegrationApiKeyService, IntegrationScopes } from "../services/integrations/IntegrationApiKeyService.js";
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
      authType?: "jwt" | "integration";
    }
  }
}

const integrationKeys = new IntegrationApiKeyService();

export function signAccessToken(user: AuthUser) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role, status: user.status }, env.JWT_SECRET, { expiresIn: "15m" });
}

export const signToken = signAccessToken;

export const requireAuth = authenticate(false);
export const requireMealPlannerAuth = authenticate(true);

function authenticate(allowMealPlannerKey: boolean) {
  return async (req: Request, res: Response, next: NextFunction) => {
    await authenticateRequest(req, res, next, allowMealPlannerKey);
  };
}

async function authenticateRequest(req: Request, res: Response, next: NextFunction, allowMealPlannerKey: boolean) {
  const token = readBearerToken(req);
  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    req.user = jwt.verify(token, env.JWT_SECRET) as AuthUser;
    req.authType = "jwt";
    if (req.user.status && req.user.status !== "ACTIVE") {
      res.status(403).json({ error: "Account is disabled" });
      return;
    }
    next();
  } catch {
    try {
      const integration = await integrationKeys.authenticate(token);
      if (!integration) {
        res.status(401).json({ error: "Invalid or expired token" });
        return;
      }
      const plannerOnly = integration.scopes.length > 0 && integration.scopes.every((scope) => scope === IntegrationScopes.MEAL_PLANNER_READ || scope === IntegrationScopes.MEAL_PLANNER_WRITE);
      if (plannerOnly && !allowMealPlannerKey) {
        res.status(403).json({ error: "Meal-planner integration key is limited to meal-planner endpoints" });
        return;
      }
      if (integration.user.status && integration.user.status !== "ACTIVE") {
        res.status(403).json({ error: "Account is disabled" });
        return;
      }
      req.user = { id: integration.userId, email: integration.user.email, role: integration.user.role, status: integration.user.status };
      req.integration = { id: integration.id, userId: integration.userId, provider: integration.provider, scopes: integration.scopes };
      req.authType = "integration";
      next();
    } catch {
      res.status(401).json({ error: "Invalid or expired token" });
    }
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

function readBearerToken(req: Request) {
  const header = req.header("authorization");
  if (header?.startsWith("Bearer ")) return header.slice(7);
  return req.header("x-api-key") ?? undefined;
}
