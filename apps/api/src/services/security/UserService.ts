import bcrypt from "bcryptjs";
import { prisma } from "../../config/prisma.js";
import { Roles } from "./roles.js";

export class UserService {
  list(query?: { q?: string; role?: string; status?: string }) {
    return prisma.user.findMany({
      where: {
        role: query?.role || undefined,
        status: query?.status || undefined,
        OR: query?.q ? [
          { email: { contains: query.q } },
          { name: { contains: query.q } },
          { username: { contains: query.q } }
        ] : undefined
      },
      select: this.publicSelect(),
      orderBy: { createdAt: "desc" }
    });
  }

  get(id: string) {
    return prisma.user.findUnique({ where: { id }, select: this.publicSelect() });
  }

  async create(input: { username?: string; name: string; firstName?: string; lastName?: string; email: string; password: string; role?: string; language?: string; timezone?: string; theme?: string }) {
    const passwordHash = await bcrypt.hash(input.password, 12);
    return prisma.user.create({
      data: {
        username: input.username,
        name: input.name,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email.toLowerCase(),
        passwordHash,
        role: input.role ?? Roles.USER,
        language: input.language ?? "de",
        timezone: input.timezone ?? "Europe/Berlin",
        theme: input.theme ?? "system",
        goal: { create: {} }
      },
      select: this.publicSelect()
    });
  }

  update(id: string, input: { username?: string; name?: string; firstName?: string | null; lastName?: string | null; email?: string; role?: string; status?: string; language?: string; units?: string; timezone?: string; theme?: string; heightCm?: number | null; trackWeight?: boolean; trackBodyFat?: boolean; trackMuscleMass?: boolean; trackWater?: boolean; visiblePagesJson?: string | null; dashboardWidgetsJson?: string | null; dashboardMetricCardsJson?: string | null }) {
    return prisma.user.update({
      where: { id },
      data: { ...input, email: input.email?.toLowerCase() },
      select: this.publicSelect()
    });
  }

  delete(id: string) {
    return prisma.user.delete({ where: { id } });
  }

  setPassword(id: string, password: string) {
    return bcrypt.hash(password, 12).then((passwordHash) => prisma.user.update({ where: { id }, data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null } }));
  }

  publicSelect() {
    return {
      id: true,
      username: true,
      email: true,
      name: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      language: true,
      units: true,
      timezone: true,
      theme: true,
      heightCm: true,
      trackWeight: true,
      trackBodyFat: true,
      trackMuscleMass: true,
      trackWater: true,
      visiblePagesJson: true,
      dashboardWidgetsJson: true,
      dashboardMetricCardsJson: true,
      role: true,
      status: true,
      lockedUntil: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true
    };
  }
}
