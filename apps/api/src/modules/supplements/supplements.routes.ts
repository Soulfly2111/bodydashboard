import { Router, type RequestHandler } from "express";
import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { requireIntegrationAuth, requireIntegrationScope } from "../../middleware/integrationAuth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { dateSchema, entrySchema, initializeSupplements, logSupplement, ownSupplement, problem, supplementSchema } from "../../services/supplements/supplements.js";

function createRouter(integration: boolean) {
  const router = Router();
  router.use(integration ? requireIntegrationAuth : requireAuth);
  const access = (write: boolean): RequestHandler => (req, res, next) => {
    if (req.user?.status !== "ACTIVE") { res.status(403).json({ error: "Account is disabled" }); return; }
    if (req.integration) return requireIntegrationScope(`supplements:${write ? "write" : "read"}`)(req, res, next);
    next();
  };
  router.get("/", access(false), asyncHandler(async (req, res) => {
    await initializeSupplements(req.user!.id);
    res.json(await prisma.supplement.findMany({ where: { userId: req.user!.id,
      archived: req.query.archived === "true" ? undefined : false,
      name: req.query.q ? { contains: String(req.query.q) } : undefined }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }));
  }));
  router.post("/", access(true), asyncHandler(async (req, res) => {
    res.status(201).json(await prisma.supplement.create({ data: { ...supplementSchema.parse(req.body), userId: req.user!.id } }));
  }));
  router.get("/:id", access(false), asyncHandler(async (req, res) => {
    const item = await ownSupplement(req.user!.id, req.params.id);
    const from = req.query.from ? dateSchema.parse(req.query.from) : undefined;
    const to = req.query.to ? dateSchema.parse(req.query.to) : undefined;
    if (from && to && from > to) return problem("Zeitraum ist ungültig");
    const entries = await prisma.supplementEntry.findMany({ where: { userId: req.user!.id, supplementId: item.id, date: { gte: from, lte: to } }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] });
    res.json({ ...item, entries });
  }));
  router.patch("/:id", access(true), asyncHandler(async (req, res) => {
    const item = await ownSupplement(req.user!.id, req.params.id);
    const input = supplementSchema.partial().parse(req.body);
    if (input.unit && input.unit !== item.unit && await prisma.supplementEntry.count({ where: { supplementId: item.id } }))
      return problem("Einheit nach der ersten Einnahme nicht änderbar; bitte neues Supplement anlegen");
    res.json(await prisma.supplement.update({ where: { id: item.id }, data: input }));
  }));
  router.post("/:id/entries", access(true), asyncHandler(async (req, res) => {
    res.status(201).json(await logSupplement(req.user!.id, req.params.id, entrySchema.parse(req.body)));
  }));
  router.patch("/:id/entries/:entryId", access(true), asyncHandler(async (req, res) => {
    const entry = await prisma.supplementEntry.findFirst({ where: { id: req.params.entryId, supplementId: req.params.id, userId: req.user!.id } });
    if (!entry) return problem("Einnahme nicht gefunden", 404);
    const input = entrySchema.omit({ externalId: true, unit: true }).partial().parse(req.body);
    res.json(await prisma.supplementEntry.update({ where: { id: entry.id }, data: input }));
  }));
  router.delete("/:id/entries/:entryId", access(true), asyncHandler(async (req, res) => {
    const result = await prisma.supplementEntry.deleteMany({ where: { id: req.params.entryId, supplementId: req.params.id, userId: req.user!.id } });
    if (!result.count) return problem("Einnahme nicht gefunden", 404);
    res.status(204).end();
  }));
  return router;
}
export const supplementsRouter = createRouter(false);
export const supplementIntegrationRouter = createRouter(true);
