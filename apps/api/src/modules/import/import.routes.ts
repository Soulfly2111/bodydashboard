import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { ImportService } from "../../services/import/importService.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { encryptSecret } from "../../utils/crypto.js";

export const importRouter = Router();
const service = new ImportService();
importRouter.use(requireAuth);

const sourceSchema = z.object({
  provider: z.enum(["CONFLUENCE"]).default("CONFLUENCE"),
  name: z.string().min(1),
  baseUrl: z.string().url(),
  spaceKey: z.string().optional(),
  pageId: z.string().optional(),
  pageTitle: z.string().optional(),
  username: z.string().optional(),
  apiToken: z.string().min(1),
  authType: z.enum(["apiToken", "pat"]).default("apiToken"),
  mapping: z.object({
    recordType: z.enum(["food", "recipe"]).optional(),
    columns: z.record(z.string())
  }),
  syncMode: z.enum(["IMPORT_ONLY", "UPSERT", "UPSERT_AND_DELETE_MISSING"]).default("UPSERT"),
  autoImportCron: z.string().optional().nullable()
});

importRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const sources = await prisma.importSource.findMany({
      where: { userId: req.user!.id },
      select: {
        id: true,
        provider: true,
        name: true,
        baseUrl: true,
        spaceKey: true,
        pageId: true,
        pageTitle: true,
        authType: true,
        mappingJson: true,
        syncMode: true,
        autoImportCron: true,
        lastImportedAt: true
      }
    });
    res.json(sources.map((source) => ({ ...source, mapping: JSON.parse(source.mappingJson) })));
  })
);

importRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = sourceSchema.parse(req.body);
    const source = await prisma.importSource.create({
      data: {
        userId: req.user!.id,
        provider: body.provider,
        name: body.name,
        baseUrl: body.baseUrl,
        spaceKey: body.spaceKey,
        pageId: body.pageId,
        pageTitle: body.pageTitle,
        encryptedUsername: body.username ? encryptSecret(body.username) : null,
        encryptedApiToken: encryptSecret(body.apiToken),
        authType: body.authType,
        mappingJson: JSON.stringify(body.mapping),
        syncMode: body.syncMode,
        autoImportCron: body.autoImportCron
      }
    });
    res.status(201).json({ ...source, encryptedUsername: undefined, encryptedApiToken: undefined });
  })
);

importRouter.post(
  "/:id/preview",
  asyncHandler(async (req, res) => {
    res.json(await service.preview(req.params.id, req.user!.id));
  })
);

importRouter.post(
  "/:id/run",
  asyncHandler(async (req, res) => {
    res.json(await service.run(req.params.id, req.user!.id));
  })
);

importRouter.get(
  "/:id/logs",
  asyncHandler(async (req, res) => {
    const logs = await prisma.importLog.findMany({
      where: { sourceId: req.params.id, source: { userId: req.user!.id } },
      orderBy: { createdAt: "desc" }
    });
    res.json(logs);
  })
);
