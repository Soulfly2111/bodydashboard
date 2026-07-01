import { createHash, randomBytes } from "crypto";
import { addDays } from "date-fns";
import { prisma } from "../../config/prisma.js";

export class SessionService {
  async create(input: { userId: string; rememberMe: boolean; userAgent?: string; ipAddress?: string }) {
    const refreshToken = randomBytes(48).toString("base64url");
    await prisma.userSession.create({
      data: {
        userId: input.userId,
        refreshTokenHash: this.hash(refreshToken),
        rememberMe: input.rememberMe,
        userAgent: input.userAgent,
        ipAddress: input.ipAddress,
        expiresAt: addDays(new Date(), input.rememberMe ? 30 : 7)
      }
    });
    return refreshToken;
  }

  async rotate(refreshToken: string, input: { userAgent?: string; ipAddress?: string }) {
    const session = await prisma.userSession.findUnique({ where: { refreshTokenHash: this.hash(refreshToken) }, include: { user: true } });
    if (!session || session.revokedAt || session.expiresAt < new Date() || session.user.status !== "ACTIVE") return null;
    await prisma.userSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    const nextRefreshToken = await this.create({ userId: session.userId, rememberMe: session.rememberMe, ...input });
    return { user: session.user, refreshToken: nextRefreshToken };
  }

  revoke(refreshToken: string) {
    return prisma.userSession.updateMany({ where: { refreshTokenHash: this.hash(refreshToken), revokedAt: null }, data: { revokedAt: new Date() } });
  }

  private hash(value: string) {
    return createHash("sha256").update(value).digest("hex");
  }
}
