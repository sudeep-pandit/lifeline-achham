import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { UsersService } from "./users.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Audit } from "../common/decorators/audit.decorator";
import type { AuthUser } from "@lifeline/types";

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermissions("users.view")
  findAll(@CurrentUser() user: AuthUser) {
    return this.usersService.findAll(user.organizationId);
  }

  @Post()
  @RequirePermissions("users.create")
  @Audit({ action: "user.create", module: "users" })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateUserDto) {
    return this.usersService.create(user.organizationId, dto);
  }

  @Patch(":id")
  @RequirePermissions("users.edit")
  @Audit({ action: "user.edit", module: "users" })
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(user.organizationId, id, dto);
  }

  @Delete(":id")
  @RequirePermissions("users.delete")
  @Audit({ action: "user.delete", module: "users" })
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.usersService.remove(user.organizationId, id);
  }
}
