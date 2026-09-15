import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { DocumentTemplatesService } from "./document-templates.service";
import { SaveTemplateDto } from "./dto/save-template.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Audit } from "../common/decorators/audit.decorator";
import type { AuthUser } from "@lifeline/types";

// Section: "Create/edit/duplicate/delete/set default/preview template" for
// both cards and certificates - gated per-type on the matching existing
// permission (documents.cards / documents.certificates) rather than a new
// permission, since editing a document's theme is the same authority as
// generating that document type.
function requireTypePermission(user: AuthUser, type: "CARD" | "CERTIFICATE") {
  const key = type === "CARD" ? "documents.cards" : "documents.certificates";
  if (!user.isSuperAdmin && !user.permissions.includes(key)) {
    throw new ForbiddenException(`Missing required permission(s): ${key}`);
  }
}

@Controller("document-templates")
export class DocumentTemplatesController {
  constructor(private readonly templatesService: DocumentTemplatesService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query("type") type?: "CARD" | "CERTIFICATE") {
    return this.templatesService.findAll(user.organizationId, type);
  }

  @Get(":id")
  findOne(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.templatesService.findOne(user.organizationId, id);
  }

  @Post()
  @Audit({ action: "document_template.create", module: "document_templates" })
  create(@CurrentUser() user: AuthUser, @Body() dto: SaveTemplateDto) {
    requireTypePermission(user, dto.type);
    return this.templatesService.create(user.organizationId, user.id, dto);
  }

  @Patch(":id")
  @Audit({ action: "document_template.update", module: "document_templates" })
  async update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: SaveTemplateDto) {
    requireTypePermission(user, dto.type);
    return this.templatesService.update(user.organizationId, user.id, id, dto);
  }

  @Post(":id/duplicate")
  @Audit({ action: "document_template.duplicate", module: "document_templates" })
  async duplicate(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    const existing = await this.templatesService.findOne(user.organizationId, id);
    requireTypePermission(user, existing.type);
    return this.templatesService.duplicate(user.organizationId, user.id, id);
  }

  @Patch(":id/set-default")
  @Audit({ action: "document_template.set_default", module: "document_templates" })
  async setDefault(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    const existing = await this.templatesService.findOne(user.organizationId, id);
    requireTypePermission(user, existing.type);
    return this.templatesService.setDefault(user.organizationId, id);
  }

  @Delete(":id")
  @Audit({ action: "document_template.delete", module: "document_templates" })
  async remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    const existing = await this.templatesService.findOne(user.organizationId, id);
    requireTypePermission(user, existing.type);
    return this.templatesService.remove(user.organizationId, id);
  }
}
