import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuthService } from "../auth/auth.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import type { UserListItemDto } from "@lifeline/types";

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async findAll(organizationId: string): Promise<UserListItemDto[]> {
    const users = await this.prisma.user.findMany({
      where: { organizationId, deletedAt: null },
      include: { roles: { include: { role: true } } },
      orderBy: { createdAt: "desc" },
    });

    return users.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      status: u.status,
      roles: u.roles.map((r) => r.role.name),
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
    }));
  }

  async create(organizationId: string, dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException("A user with this email already exists");

    const passwordHash = await this.authService.hashPassword(dto.password);

    return this.prisma.user.create({
      data: {
        organizationId,
        fullName: dto.fullName,
        email: dto.email,
        passwordHash,
        roles: { create: dto.roleIds.map((roleId) => ({ roleId })) },
      },
      include: { roles: { include: { role: true } } },
    });
  }

  async update(organizationId: string, id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findFirst({ where: { id, organizationId, deletedAt: null } });
    if (!user) throw new NotFoundException("User not found");

    if (dto.roleIds) {
      await this.prisma.userRole.deleteMany({ where: { userId: id } });
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        fullName: dto.fullName,
        email: dto.email,
        status: dto.status,
        roles: dto.roleIds ? { create: dto.roleIds.map((roleId) => ({ roleId })) } : undefined,
      },
    });
  }

  // Soft delete only - financial/audit trails must never disappear
  // silently (Section 48, rule 8).
  async remove(organizationId: string, id: string) {
    const user = await this.prisma.user.findFirst({ where: { id, organizationId, deletedAt: null } });
    if (!user) throw new NotFoundException("User not found");
    return this.prisma.user.update({ where: { id }, data: { deletedAt: new Date(), status: "DISABLED" } });
  }
}
