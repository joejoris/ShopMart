import { Injectable, UnauthorizedException, ConflictException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { queryOne, execute, newId } from "../db/database";
import { camel } from "../db/map";

type UserRow = { id: string; email: string; password_hash: string; name: string; role: string };

@Injectable()
export class AuthService {
  constructor(private jwt: JwtService) {}

  async register(input: { name: string; email: string; password: string }) {
    const existing = queryOne(`SELECT id FROM users WHERE email = ?`, [input.email]);
    if (existing) throw new ConflictException("Email already registered");
    const id = newId();
    const passwordHash = await bcrypt.hash(input.password, 10);
    execute(
      `INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, 'customer')`,
      [id, input.email, passwordHash, input.name]
    );
    const user = queryOne<UserRow>(`SELECT * FROM users WHERE id = ?`, [id])!;
    return this.issueTokens(user);
  }

  async validateUser(email: string, password: string) {
    const user = queryOne<UserRow>(`SELECT * FROM users WHERE email = ?`, [email]);
    if (!user) return null;
    const ok = await bcrypt.compare(password, user.password_hash);
    return ok ? user : null;
  }

  async login(user: { id: string }) {
    const full = queryOne<UserRow>(`SELECT * FROM users WHERE id = ?`, [user.id]);
    if (!full) throw new UnauthorizedException();
    return this.issueTokens(full);
  }

  async refresh(refreshToken: string) {
    try {
      const payload = await this.jwt.verifyAsync(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET ?? "dev-refresh-secret-change-me",
      });
      const user = queryOne<UserRow>(`SELECT * FROM users WHERE id = ?`, [payload.sub]);
      if (!user) throw new UnauthorizedException();
      return this.issueTokens(user);
    } catch {
      throw new UnauthorizedException("Invalid refresh token");
    }
  }

  private async issueTokens(user: UserRow) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: process.env.JWT_SECRET ?? "dev-jwt-secret-change-me",
      expiresIn: "15m",
    });
    const refreshToken = await this.jwt.signAsync(payload, {
      secret: process.env.JWT_REFRESH_SECRET ?? "dev-refresh-secret-change-me",
      expiresIn: "7d",
    });
    return {
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    };
  }
}
