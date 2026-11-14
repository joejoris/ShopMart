import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { queryOne } from "../db/database";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? "dev-jwt-secret-change-me",
    });
  }

  // Resolve the user fresh from the database on every authenticated request so
  // role changes (e.g. promotion to admin) and account deletion take effect
  // immediately instead of waiting for the 15-minute access token to expire.
  async validate(payload: { sub: string; email: string; role: string }) {
    const user = await queryOne<{ id: string; email: string; role: string }>(
      `SELECT id, email, role FROM users WHERE id = ?`,
      [payload.sub]
    );
    if (!user) throw new UnauthorizedException();
    return user;
  }
}
