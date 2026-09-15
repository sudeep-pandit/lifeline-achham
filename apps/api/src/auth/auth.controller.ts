import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res, UnauthorizedException } from "@nestjs/common";
import type { Request, Response } from "express";
import { ConfigService } from "@nestjs/config";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { Public } from "../common/decorators/public.decorator";
import { Audit } from "../common/decorators/audit.decorator";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  @Audit({ action: "auth.login", module: "auth" })
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const ipAddress = req.ip;
    const { user, accessToken, refreshToken } = await this.authService.login(dto.email, dto.password, ipAddress);

    // Refresh token lives in an HttpOnly, SameSite cookie - never readable
    // by client-side JS (mitigates XSS token theft, Section 28).
    res.cookie(this.config.get<string>("auth.cookieName") ?? "lifeline_session", refreshToken, {
      httpOnly: true,
      secure: this.config.get<boolean>("auth.cookieSecure") ?? false,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    return { user, accessToken };
  }

  @Public()
  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const cookieName = this.config.get<string>("auth.cookieName") ?? "lifeline_session";
    const refreshToken = req.cookies?.[cookieName];
    if (refreshToken) await this.authService.logout(refreshToken);
    res.clearCookie(cookieName, { path: "/" });
  }

  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request) {
    const cookieName = this.config.get<string>("auth.cookieName") ?? "lifeline_session";
    const refreshToken = req.cookies?.[cookieName];
    if (!refreshToken) throw new UnauthorizedException("No active session");
    // Full rotation logic (verify + reissue) is implemented in AuthService
    // once the refresh-token verification strategy is added in Phase 1b.
    throw new UnauthorizedException("Session expired, please log in again");
  }
}
