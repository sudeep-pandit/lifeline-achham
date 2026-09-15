import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { MembersService, type MemberFilters } from "./members.service";
import { UpdateMemberDto } from "./dto/update-member.dto";
import { CreateMemberDto } from "./dto/create-member.dto";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Audit } from "../common/decorators/audit.decorator";
import type { AuthUser } from "@lifeline/types";

@Controller("members")
@RequirePermissions("members.view")
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: Record<string, string>) {
    const filters: MemberFilters = {
      search: query.search,
      membershipTypeId: query.membershipTypeId,
      districtId: query.districtId,
      status: query.status as MemberFilters["status"],
      page: query.page ? Number(query.page) : undefined,
      pageSize: query.pageSize ? Number(query.pageSize) : undefined,
    };
    return this.membersService.findAll(user.organizationId, filters);
  }

  @Post()
  @RequirePermissions("members.create")
  @Audit({ action: "member.create_direct", module: "members" })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateMemberDto) {
    return this.membersService.create(user.organizationId, user.id, dto);
  }

  @Get(":id")
  findOne(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.membersService.findOne(user.organizationId, id);
  }

  @Patch(":id")
  @RequirePermissions("members.edit")
  @Audit({ action: "member.edit", module: "members" })
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateMemberDto) {
    return this.membersService.update(user.organizationId, id, dto);
  }
}
