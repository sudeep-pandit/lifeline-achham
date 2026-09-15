import { Body, Controller, Post } from "@nestjs/common";
import { AiAssistantService } from "./ai-assistant.service";
import { AskDto } from "./dto/ask.dto";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthUser } from "@lifeline/types";

@Controller("ai")
@RequirePermissions("ai_assistant.use")
export class AiAssistantController {
  constructor(private readonly aiAssistantService: AiAssistantService) {}

  @Post("ask")
  ask(@CurrentUser() user: AuthUser, @Body() dto: AskDto) {
    return this.aiAssistantService.ask(user, dto.question);
  }
}
