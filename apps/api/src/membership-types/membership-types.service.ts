import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { UpsertMembershipTypeDto } from "./dto/upsert-membership-type.dto";

@Injectable()
export class MembershipTypesService {
  constructor(private readonly prisma: PrismaService) {}

  // Public list is used by the application form; it only ever returns
  // active types (Section 7 fields: Name, Description, Price, Duration).
  findActive(organizationId: string) {
    return this.prisma.membershipType.findMany({
      where: { organizationId, isActive: true },
      orderBy: { displayOrder: "asc" },
    });
  }

  findAll(organizationId: string) {
    return this.prisma.membershipType.findMany({
      where: { organizationId },
      orderBy: { displayOrder: "asc" },
    });
  }

  create(organizationId: string, dto: UpsertMembershipTypeDto) {
    return this.prisma.membershipType.create({
      data: { organizationId, ...dto },
    });
  }

  async update(organizationId: string, id: string, dto: UpsertMembershipTypeDto) {
    const type = await this.prisma.membershipType.findFirst({ where: { id, organizationId } });
    if (!type) throw new NotFoundException("Membership type not found");
    return this.prisma.membershipType.update({ where: { id }, data: dto });
  }

  async setActive(organizationId: string, id: string, isActive: boolean) {
    const type = await this.prisma.membershipType.findFirst({ where: { id, organizationId } });
    if (!type) throw new NotFoundException("Membership type not found");
    return this.prisma.membershipType.update({ where: { id }, data: { isActive } });
  }
}
