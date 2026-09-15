import { Controller, Get } from "@nestjs/common";
import { DashboardService } from "./dashboard.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthUser } from "@lifeline/types";

@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get("summary")
  getSummary(@CurrentUser() user: AuthUser) {
    return this.dashboardService.getSummary(user);
  }
}
