import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { UpsertRoleDto } from "./dto/upsert-role.dto";
import type { RoleDto } from "@lifeline/types";

function slugify(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string): Promise<RoleDto[]> {
    const roles = await this.prisma.role.findMany({
      where: { organizationId },
      include: { permissions: { include: { permission: true } } },
      orderBy: { createdAt: "asc" },
    });

    return roles.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      description: r.description,
      isSystem: r.isSystem,
      isActive: r.isActive,
      permissions: r.permissions.map((p) => p.permission.key),
    }));
  }

  async create(organizationId: string, dto: UpsertRoleDto) {
    const permissions = await this.prisma.permission.findMany({
      where: { key: { in: dto.permissionKeys } },
    });
    if (permissions.length !== dto.permissionKeys.length) {
      throw new BadRequestException("One or more permission keys are invalid");
    }

    return this.prisma.role.create({
      data: {
        organizationId,
        name: dto.name,
        slug: slugify(dto.name),
        description: dto.description,
        permissions: { create: permissions.map((p) => ({ permissionId: p.id })) },
      },
    });
  }

  async update(organizationId: string, id: string, dto: UpsertRoleDto) {
    const role = await this.prisma.role.findFirst({ where: { id, organizationId } });
    if (!role) throw new NotFoundException("Role not found");

    const permissions = await this.prisma.permission.findMany({
      where: { key: { in: dto.permissionKeys } },
    });

    await this.prisma.rolePermission.deleteMany({ where: { roleId: id } });

    return this.prisma.role.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        permissions: { create: permissions.map((p) => ({ permissionId: p.id })) },
      },
    });
  }

  async disable(organizationId: string, id: string) {
    const role = await this.prisma.role.findFirst({ where: { id, organizationId } });
    if (!role) throw new NotFoundException("Role not found");
    if (role.isSystem) throw new BadRequestException("System roles cannot be disabled");
    return this.prisma.role.update({ where: { id }, data: { isActive: false } });
  }
}
