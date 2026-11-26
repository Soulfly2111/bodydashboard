import type { RequestHandler } from "express";

export function plannerScope(access: "read" | "write" | "browser", legacyScope?: string): RequestHandler {
  return (req, res, next) => {
    const scopes = req.integration?.scopes ?? [];
    if (req.authType === "jwt" || (access !== "browser" &&
      (scopes.includes("*") || scopes.includes("meal-planner:" + access) || (legacyScope && scopes.includes(legacyScope))))) {
      next();
      return;
    }
    res.status(403).json({ error: "Für diese Aktion fehlt die Berechtigung zur Essensplanung." });
  };
}
