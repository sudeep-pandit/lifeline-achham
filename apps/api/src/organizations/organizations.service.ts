import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateSettingsDto } from "./dto/update-settings.dto";

type TxClient = Prisma.TransactionClient;

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(organizationId: string) {
    const settings = await this.prisma.organizationSettings.findUnique({ where: { organizationId } });
    if (!settings) throw new NotFoundException("Organization settings not found");
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    return { ...settings, name: org?.name };
  }

  async updateSettings(organizationId: string, dto: UpdateSettingsDto) {
    return this.prisma.organizationSettings.update({
      where: { organizationId },
      data: dto,
    });
  }

  // Transaction-safe numbering engine (Section 37). Every module (members,
  // receipts, certificates, cards, ...) calls this instead of building IDs
  // itself, guaranteeing no duplicates even under concurrent requests.
  //
  // Accepts an optional `tx` (a Prisma transaction client) so callers that
  // need the sequence increment to be part of a larger atomic operation -
  // e.g. "approve application" also creates the Member row - can pass their
  // own transaction instead of this method opening a second, separate one.
  async nextSequenceNumber(organizationId: string, key: string, prefix: string, tx?: TxClient): Promise<string> {
    const run = async (client: TxClient | PrismaService) => {
      const seq = await client.documentSequence.upsert({
        where: { organizationId_key: { organizationId, key } },
        create: { organizationId, key, prefix, lastNumber: 1 },
        update: { lastNumber: { increment: 1 } },
      });
      const padded = String(seq.lastNumber).padStart(seq.padLength, "0");
      return `${seq.prefix}${seq.separator}${padded}`;
    };

    if (tx) return run(tx);
    return this.prisma.$transaction((txClient) => run(txClient));
  }
}
