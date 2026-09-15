import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SaveTemplateDto } from "./dto/save-template.dto";

const MAX_ASSET_BYTES = 5 * 1024 * 1024; // 5MB raw for logos/reference images/fonts

function validateBase64Asset(dataUrlOrRaw: string | undefined, label: string): string | undefined {
  if (!dataUrlOrRaw) return dataUrlOrRaw;
  const base64 = dataUrlOrRaw.includes(",") ? dataUrlOrRaw.split(",")[1] : dataUrlOrRaw;
  const approxBytes = (base64.length * 3) / 4;
  if (approxBytes > MAX_ASSET_BYTES) {
    throw new BadRequestException(`${label} must be under 5MB`);
  }
  return dataUrlOrRaw;
}

@Injectable()
export class DocumentTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(organizationId: string, type?: "CARD" | "CERTIFICATE") {
    return this.prisma.documentTemplate.findMany({
      where: { organizationId, type },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    });
  }

  async findOne(organizationId: string, id: string) {
    const template = await this.prisma.documentTemplate.findFirst({ where: { id, organizationId } });
    if (!template) throw new NotFoundException("Template not found");
    return template;
  }

  // Returns the org's default template for a type, or null if none has
  // been customized yet - callers fall back to the built-in hardcoded
  // layout in that case, so generation never breaks for an org that
  // hasn't touched the designer.
  findDefault(organizationId: string, type: "CARD" | "CERTIFICATE") {
    return this.prisma.documentTemplate.findFirst({ where: { organizationId, type, isDefault: true } });
  }

  async create(organizationId: string, userId: string, dto: SaveTemplateDto) {
    validateBase64Asset(dto.referenceImageFront, "Front reference image");
    validateBase64Asset(dto.referenceImageBack, "Back reference image");
    validateBase64Asset(dto.customFontData, "Custom font");

    const existingCount = await this.prisma.documentTemplate.count({ where: { organizationId, type: dto.type } });

    return this.prisma.documentTemplate.create({
      data: {
        organizationId,
        type: dto.type,
        name: dto.name,
        backgroundColor: dto.backgroundColor ?? "#FFFFFF",
        frontLayout: dto.frontLayout as any,
        backLayout: dto.backLayout as any,
        referenceImageFront: dto.referenceImageFront,
        referenceImageBack: dto.referenceImageBack,
        customFontData: dto.customFontData,
        isDefault: existingCount === 0, // first template of its type becomes the default automatically
        createdById: userId,
        updatedById: userId,
      },
    });
  }

  async update(organizationId: string, userId: string, id: string, dto: SaveTemplateDto) {
    await this.findOne(organizationId, id);
    validateBase64Asset(dto.referenceImageFront, "Front reference image");
    validateBase64Asset(dto.referenceImageBack, "Back reference image");
    validateBase64Asset(dto.customFontData, "Custom font");

    return this.prisma.documentTemplate.update({
      where: { id },
      data: {
        name: dto.name,
        backgroundColor: dto.backgroundColor ?? "#FFFFFF",
        frontLayout: dto.frontLayout as any,
        backLayout: dto.backLayout as any,
        referenceImageFront: dto.referenceImageFront,
        referenceImageBack: dto.referenceImageBack,
        customFontData: dto.customFontData,
        updatedById: userId,
      },
    });
  }

  async duplicate(organizationId: string, userId: string, id: string) {
    const original = await this.findOne(organizationId, id);
    return this.prisma.documentTemplate.create({
      data: {
        organizationId,
        type: original.type,
        name: `${original.name} (copy)`,
        backgroundColor: original.backgroundColor,
        frontLayout: original.frontLayout as any,
        backLayout: original.backLayout as any,
        referenceImageFront: original.referenceImageFront,
        referenceImageBack: original.referenceImageBack,
        customFontData: original.customFontData,
        isDefault: false,
        createdById: userId,
        updatedById: userId,
      },
    });
  }

  async setDefault(organizationId: string, id: string) {
    const template = await this.findOne(organizationId, id);
    await this.prisma.$transaction([
      this.prisma.documentTemplate.updateMany({
        where: { organizationId, type: template.type, isDefault: true },
        data: { isDefault: false },
      }),
      this.prisma.documentTemplate.update({ where: { id }, data: { isDefault: true } }),
    ]);
    return this.findOne(organizationId, id);
  }

  async remove(organizationId: string, id: string) {
    const template = await this.findOne(organizationId, id);
    if (template.isDefault) {
      const remaining = await this.prisma.documentTemplate.count({
        where: { organizationId, type: template.type, id: { not: id } },
      });
      if (remaining > 0) {
        throw new BadRequestException("Set a different template as default before deleting this one");
      }
    }
    await this.prisma.documentTemplate.delete({ where: { id } });
    return { deleted: true };
  }
}
