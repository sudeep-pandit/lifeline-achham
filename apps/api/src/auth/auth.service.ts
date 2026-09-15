import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthUser, LoginResponse } from "@lifeline/types";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 15;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Loads a user plus their flattened role/permission set. Used both by the
   * JWT strategy (on every request) and right after login.
   */
  async loadAuthUser(userId: string): Promise<AuthUser | null> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: {
        roles: {
          include: {
            role: { include: { permissions: { include: { permission: true } } } },
          },
        },
      },
    });

    if (!user || user.status !== "ACTIVE") return null;

    const roles = user.roles.map((ur) => ur.role.slug);
    const permissions = Array.from(
      new Set(
        user.roles.flatMap((ur) => ur.role.permissions.map((rp) => rp.permission.key)),
      ),
    );

    return {
      id: user.id,
      organizationId: user.organizationId,
      fullName: user.fullName,
      email: user.email,
      avatarUrl: user.avatarUrl,
      isSuperAdmin: user.isSuperAdmin,
      status: user.status,
      roles,
      permissions,
    };
  }

  async validateCredentials(email: string, password: string, ipAddress?: string) {
    const user = await this.prisma.user.findFirst({ where: { email, deletedAt: null } });

    if (!user) {
      // Constant-shape response: don't reveal whether the email exists.
      throw new UnauthorizedException("Invalid email or password");
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException(
        `Account temporarily locked. Try again after ${user.lockedUntil.toLocaleTimeString()}.`,
      );
    }

    if (user.status !== "ACTIVE") {
      throw new ForbiddenException("This account is not active. Contact an administrator.");
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatches) {
      await this.recordFailedAttempt(user.id);
      await this.logLoginActivity(user.id, false, ipAddress, "invalid_password");
      throw new UnauthorizedException("Invalid email or password");
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date(), lastLoginIp: ipAddress },
    });
    await this.logLoginActivity(user.id, true, ipAddress);

    return user;
  }

  async login(email: string, password: string, ipAddress?: string): Promise<LoginResponse & { refreshToken: string }> {
    const user = await this.validateCredentials(email, password, ipAddress);
    const authUser = await this.loadAuthUser(user.id);
    if (!authUser) throw new UnauthorizedException("Unable to establish session");

    const accessToken = await this.jwt.signAsync(
      { sub: user.id },
      {
        secret: this.config.get<string>("auth.jwtSecret"),
        expiresIn: this.config.get<string>("auth.jwtExpiresIn"),
      },
    );

    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, type: "refresh" },
      {
        secret: this.config.get<string>("auth.refreshSecret"),
        expiresIn: this.config.get<string>("auth.refreshExpiresIn"),
      },
    );

    await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshToken,
        ipAddress,
        expiresAt: this.addDuration(new Date(), this.config.get<string>("auth.refreshExpiresIn") ?? "7d"),
      },
    });

    return { user: authUser, accessToken, refreshToken };
  }

  async logout(refreshToken: string) {
    await this.prisma.session.updateMany({
      where: { refreshToken, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async hashPassword(plain: string): Promise<string> {
    const saltRounds = this.config.get<number>("bcryptSaltRounds") ?? 12;
    return bcrypt.hash(plain, saltRounds);
  }

  private async recordFailedAttempt(userId: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginCount: { increment: 1 } },
    });

    if (user.failedLoginCount >= MAX_FAILED_ATTEMPTS) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          lockedUntil: new Date(Date.now() + LOCK_DURATION_MINUTES * 60 * 1000),
          failedLoginCount: 0,
        },
      });
    }
  }

  private async logLoginActivity(userId: string, success: boolean, ipAddress?: string, reason?: string) {
    await this.prisma.loginActivity.create({
      data: { userId, success, ipAddress, reason },
    });
  }

  private addDuration(base: Date, duration: string): Date {
    // Supports simple "Nd" / "Nh" / "Nm" formats, enough for env-configured TTLs.
    const match = /^(\d+)([dhm])$/.exec(duration);
    if (!match) return new Date(base.getTime() + 7 * 24 * 60 * 60 * 1000);
    const [, amountStr, unit] = match;
    const amount = Number(amountStr);
    const multiplier = unit === "d" ? 86400000 : unit === "h" ? 3600000 : 60000;
    return new Date(base.getTime() + amount * multiplier);
  }
}
