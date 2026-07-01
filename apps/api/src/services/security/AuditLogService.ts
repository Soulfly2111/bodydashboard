import { prisma } from "../../config/prisma.js";

export class AuditLogService {
  log(input: { userId?: string; actorUserId?: string; action: string; entityType?: string; entityId?: string; ipAddress?: string; userAgent?: string; metadata?: unknown }) {
    return prisma.auditLog.create({
      data: {
        userId: input.userId,
        actorUserId: input.actorUserId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        metadataJson: input.metadata ? JSON.stringify(input.metadata) : undefined
      }
    });
  }

  list(limit = 100) {
    return prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: limit });
  }
}
