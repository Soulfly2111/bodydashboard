import { Router } from "express";
import { z } from "zod";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { AuditLogService } from "../../services/security/AuditLogService.js";
import { RoleService } from "../../services/security/RoleService.js";
import { Permissions, Roles } from "../../services/security/roles.js";
import { UserService } from "../../services/security/UserService.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const adminRouter = Router();
adminRouter.use(requireAuth);

const users = new UserService();
const roles = new RoleService();
const audit = new AuditLogService();

const userInput = z.object({
  username: z.string().min(2).optional(),
  name: z.string().min(2),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email(),
  password: z.string().min(10).optional(),
  role: z.enum([Roles.ADMIN, Roles.USER]).default(Roles.USER),
  language: z.string().default("de"),
  timezone: z.string().default("Europe/Berlin"),
  theme: z.string().default("system")
});

adminRouter.get(
  "/users",
  requirePermission(Permissions.USERS_READ),
  asyncHandler(async (req, res) => {
    const query = z.object({ q: z.string().optional(), role: z.string().optional(), status: z.string().optional() }).parse(req.query);
    res.json(await users.list(query));
  })
);

adminRouter.post(
  "/users",
  requirePermission(Permissions.USERS_WRITE),
  asyncHandler(async (req, res) => {
    const body = userInput.extend({ password: z.string().min(10) }).parse(req.body);
    const user = await users.create(body);
    await audit.log({ actorUserId: req.user!.id, userId: user.id, action: "admin.user_created", entityType: "User", entityId: user.id });
    res.status(201).json(user);
  })
);

adminRouter.put(
  "/users/:id",
  requirePermission(Permissions.USERS_WRITE),
  asyncHandler(async (req, res) => {
    const body = userInput.partial().extend({ status: z.enum(["ACTIVE", "DISABLED", "LOCKED"]).optional() }).parse(req.body);
    const user = await users.update(req.params.id, body);
    await audit.log({ actorUserId: req.user!.id, userId: user.id, action: "admin.user_updated", entityType: "User", entityId: user.id, metadata: body });
    res.json(user);
  })
);

adminRouter.post(
  "/users/:id/password",
  requirePermission(Permissions.USERS_WRITE),
  asyncHandler(async (req, res) => {
    const body = z.object({ password: z.string().min(10) }).parse(req.body);
    await users.setPassword(req.params.id, body.password);
    await audit.log({ actorUserId: req.user!.id, userId: req.params.id, action: "admin.password_reset", entityType: "User", entityId: req.params.id });
    res.status(204).end();
  })
);

adminRouter.delete(
  "/users/:id",
  requirePermission(Permissions.USERS_DELETE),
  asyncHandler(async (req, res) => {
    await users.delete(req.params.id);
    await audit.log({ actorUserId: req.user!.id, action: "admin.user_deleted", entityType: "User", entityId: req.params.id });
    res.status(204).end();
  })
);

adminRouter.get(
  "/roles",
  requirePermission(Permissions.USERS_READ),
  asyncHandler(async (_req, res) => {
    res.json({ roles: roles.listRoles(), permissions: roles.listPermissions() });
  })
);

adminRouter.get(
  "/audit-logs",
  requirePermission(Permissions.AUDIT_READ),
  asyncHandler(async (_req, res) => {
    res.json(await audit.list());
  })
);
