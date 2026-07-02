import type { NextFunction, Request, Response } from "express";
import { IntegrationApiKeyService, type IntegrationScope } from "../services/integrations/IntegrationApiKeyService.js";

type IntegrationAuth = {
  id: string;
  userId: string;
  provider: string;
  scopes: string[];
};

declare global {
  namespace Express {
    interface Request {
      integration?: IntegrationAuth;
    }
  }
}

const keys = new IntegrationApiKeyService();

export async function requireIntegrationAuth(req: Request, res: Response, next: NextFunction) {
  const apiKey = readApiKey(req);
  if (!apiKey) {
    res.status(401).json({ error: "Integration API key required" });
    return;
  }

  const auth = await keys.authenticate(apiKey);
  if (!auth) {
    res.status(401).json({ error: "Invalid integration API key" });
    return;
  }

  req.integration = { id: auth.id, userId: auth.userId, provider: auth.provider, scopes: auth.scopes };
  req.user = { id: auth.userId, email: auth.user.email, role: auth.user.role, status: auth.user.status };
  next();
}

export function requireIntegrationScope(scope: IntegrationScope) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.integration || !keys.hasScope(req.integration.scopes, scope)) {
      res.status(403).json({ error: "Integration scope missing" });
      return;
    }
    next();
  };
}

function readApiKey(req: Request) {
  const header = req.header("authorization");
  if (header?.startsWith("Bearer ")) return header.slice(7);
  return req.header("x-api-key") ?? undefined;
}
