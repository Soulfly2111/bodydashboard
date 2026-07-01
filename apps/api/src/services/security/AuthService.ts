import bcrypt from "bcryptjs";
import { addMinutes } from "date-fns";
import { prisma } from "../../config/prisma.js";
import { signAccessToken } from "../../middleware/auth.js";
import { AuditLogService } from "./AuditLogService.js";
import { SessionService } from "./SessionService.js";
import { UserService } from "./UserService.js";

const maxFailedAttempts = 5;

export class AuthService {
  private sessions = new SessionService();
  private audit = new AuditLogService();
  private users = new UserService();

  validatePassword(password: string) {
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{10,}$/.test(password)) {
      throw new Error("Password must contain upper/lowercase letters, a number, a special character and at least 10 characters");
    }
  }

  async login(input: { emailOrUsername: string; password: string; rememberMe: boolean; userAgent?: string; ipAddress?: string }) {
    const user = await prisma.user.findFirst({
      where: { OR: [{ email: input.emailOrUsername.toLowerCase() }, { username: input.emailOrUsername }] }
    });
    if (!user) throw new Error("Invalid credentials");
    if (user.status !== "ACTIVE") throw new Error("Account is disabled");
    if (user.lockedUntil && user.lockedUntil > new Date()) throw new Error("Account is temporarily locked");

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      const failedLoginAttempts = user.failedLoginAttempts + 1;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts,
          lockedUntil: failedLoginAttempts >= maxFailedAttempts ? addMinutes(new Date(), 15) : null
        }
      });
      await this.audit.log({ userId: user.id, action: "auth.login_failed", ipAddress: input.ipAddress, userAgent: input.userAgent });
      throw new Error("Invalid credentials");
    }

    await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() } });
    const refreshToken = await this.sessions.create({ userId: user.id, rememberMe: input.rememberMe, userAgent: input.userAgent, ipAddress: input.ipAddress });
    await this.audit.log({ userId: user.id, action: "auth.login", ipAddress: input.ipAddress, userAgent: input.userAgent });
    return { accessToken: signAccessToken(user), refreshToken, user: this.toPublicUser(user) };
  }

  async register(input: { name: string; email: string; password: string; userAgent?: string; ipAddress?: string }) {
    this.validatePassword(input.password);
    const created = await this.users.create({ name: input.name, email: input.email, password: input.password });
    await this.audit.log({ userId: created.id, action: "auth.register", ipAddress: input.ipAddress, userAgent: input.userAgent });
    return created;
  }

  async refresh(refreshToken: string, input: { userAgent?: string; ipAddress?: string }) {
    const rotated = await this.sessions.rotate(refreshToken, input);
    if (!rotated) throw new Error("Invalid refresh token");
    return { accessToken: signAccessToken(rotated.user), refreshToken: rotated.refreshToken, user: this.toPublicUser(rotated.user) };
  }

  logout(refreshToken: string) {
    return this.sessions.revoke(refreshToken);
  }

  async changePassword(userId: string, currentPassword: string, nextPassword: string) {
    this.validatePassword(nextPassword);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) throw new Error("Current password is invalid");
    await this.users.setPassword(userId, nextPassword);
    await this.audit.log({ userId, action: "auth.password_changed" });
  }

  private toPublicUser(user: { id: string; email: string; name: string; username?: string | null; role: string; status: string }) {
    return { id: user.id, email: user.email, name: user.name, username: user.username, role: user.role, status: user.status };
  }
}
