import { Controller, Get } from "@nestjs/common";
import { Public } from "../common/decorators/public.decorator";

// Section 42-adjacent, not from the spec directly: a minimal unauthenticated
// endpoint for infrastructure to check "is this process alive and
// responding" - used by Railway's healthcheck (railway.json) and useful
// for any external uptime monitor. Deliberately returns nothing about the
// database or downstream services - it only proves the HTTP server itself
// is up, which is exactly what a deploy healthcheck needs.
@Controller("health")
@Public()
export class HealthController {
  @Get()
  check() {
    return { status: "ok", timestamp: new Date().toISOString() };
  }
}
