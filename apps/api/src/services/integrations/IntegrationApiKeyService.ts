import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "../../config/prisma.js";
import { AuditLogService } from "../security/AuditLogService.js";

export const IntegrationScopes = {
  FOODS_WRITE: "foods:write",
  MEALS_WRITE: "meals:write",
  WATER_WRITE: "water:write",
  WEIGHT_WRITE: "weight:write"
} as const;

export type IntegrationScope = typeof IntegrationScopes[keyof typeof IntegrationScopes];

const defaultScopes = Object.values(IntegrationScopes);
const keyPrefix = "bdoc";

export class IntegrationApiKeyService {
  private audit = new AuditLogService();

  async list(userId: string) {
    return prisma.integrationApiKey.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        provider: true,
        keyPrefix: true,
        keyLast4: true,
        scopesJson: true,
        lastUsedAt: true,
        expiresAt: true,
        revokedAt: true,
        createdAt: true
      }
    });
  }

  async create(input: { userId: string; name: string; provider?: string; scopes?: IntegrationScope[]; expiresAt?: Date | null; ipAddress?: string; userAgent?: string }) {
    const apiKey = this.generateKey();
    const scopes = input.scopes?.length ? input.scopes : defaultScopes;
    const record = await prisma.integrationApiKey.create({
      data: {
        userId: input.userId,
        name: input.name,
        provider: input.provider ?? "openclaw",
        keyHash: this.hash(apiKey),
        keyPrefix,
        keyLast4: apiKey.slice(-4),
        scopesJson: JSON.stringify(scopes),
        expiresAt: input.expiresAt ?? null
      }
    });
    await this.audit.log({
      actorUserId: input.userId,
      userId: input.userId,
      action: "integration.api_key_created",
      entityType: "IntegrationApiKey",
      entityId: record.id,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      metadata: { provider: record.provider, scopes }
    });
    return { apiKey, key: this.toPublic(record) };
  }

  async revoke(userId: string, id: string, input: { ipAddress?: string; userAgent?: string } = {}) {
    const result = await prisma.integrationApiKey.updateMany({
      where: { id, userId, revokedAt: null },
      data: { revokedAt: new Date() }
    });
    if (result.count > 0) {
      await this.audit.log({
        actorUserId: userId,
        userId,
        action: "integration.api_key_revoked",
        entityType: "IntegrationApiKey",
        entityId: id,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent
      });
    }
  }

  async authenticate(apiKey: string) {
    const hash = this.hash(apiKey);
    const record = await prisma.integrationApiKey.findUnique({ where: { keyHash: hash }, include: { user: true } });
    if (!record || record.revokedAt || (record.expiresAt && record.expiresAt < new Date())) return null;
    if (!this.constantTimeEqual(record.keyHash, hash)) return null;

    await prisma.integrationApiKey.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } });
    return {
      id: record.id,
      userId: record.userId,
      provider: record.provider,
      scopes: this.parseScopes(record.scopesJson),
      user: record.user
    };
  }

  hasScope(scopes: string[], required: IntegrationScope) {
    return scopes.includes(required);
  }

  private generateKey() {
    return `${keyPrefix}_${randomBytes(32).toString("base64url")}`;
  }

  private hash(apiKey: string) {
    return createHash("sha256").update(apiKey).digest("hex");
  }

  private parseScopes(scopesJson: string) {
    try {
      const scopes = JSON.parse(scopesJson);
      return Array.isArray(scopes) ? scopes.filter((scope): scope is string => typeof scope === "string") : [];
    } catch {
      return [];
    }
  }

  private constantTimeEqual(left: string, right: string) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
  }

  private toPublic(record: { id: string; name: string; provider: string; keyPrefix: string; keyLast4: string; scopesJson: string; lastUsedAt: Date | null; expiresAt: Date | null; revokedAt: Date | null; createdAt: Date }) {
    return {
      id: record.id,
      name: record.name,
      provider: record.provider,
      keyPreview: `${record.keyPrefix}_...${record.keyLast4}`,
      scopes: this.parseScopes(record.scopesJson),
      lastUsedAt: record.lastUsedAt,
      expiresAt: record.expiresAt,
      revokedAt: record.revokedAt,
      createdAt: record.createdAt
    };
  }
}
