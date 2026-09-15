import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { AuthService } from "../auth.service";
import type { AuthUser } from "@lifeline/types";
import type { Request } from "express";

interface JwtPayload {
  sub: string; // user id
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly config: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      // Accept the token either from the Authorization header (mobile/API
      // clients) or from the HttpOnly session cookie (web app), never from
      // query params.
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: Request) => req?.cookies?.[config.get<string>("auth.cookieName") ?? "lifeline_session"] ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get<string>("auth.jwtSecret"),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.authService.loadAuthUser(payload.sub);
    if (!user) throw new UnauthorizedException("Session is no longer valid");
    return user;
  }
}
