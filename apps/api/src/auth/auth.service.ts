import { Injectable, UnauthorizedException, ConflictException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { queryOne, execute, newId } from "../db/database";
import { EmailService } from "../email/email.service";

type UserRow = { id: string; email: string; password_hash: string; name: string; role: string; email_verified_at?: string | null };

@Injectable()
export class AuthService {
  constructor(private jwt: JwtService, private email: EmailService) {}

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
    // Fire-and-forget verification email (console sender logs it in dev).
    this.email.sendVerifyEmail(user.email, user.name, this.email.createToken(user.id, "verify")).catch((e) =>
      console.error("verify email failed", e)
    );
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

  async me(userId: string) {
    const user = queryOne<UserRow>(`SELECT * FROM users WHERE id = ?`, [userId]);
    if (!user) throw new UnauthorizedException();
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      emailVerified: !!user.email_verified_at,
    };
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

  async resendVerification(userId: string) {
    const user = queryOne<UserRow>(`SELECT * FROM users WHERE id = ?`, [userId]);
    if (!user) throw new UnauthorizedException();
    if (user.email_verified_at) return { ok: true, alreadyVerified: true };
    const token = this.email.createToken(user.id, "verify");
    this.email.sendVerifyEmail(user.email, user.name, token).catch((e) => console.error("resend verify email failed", e));
    return { ok: true };
  }

  async forgotPassword(email: string) {
    const user = queryOne<UserRow>(`SELECT * FROM users WHERE email = ?`, [email]);
    // Always return success to avoid leaking which emails exist.
    if (user) {
      const token = this.email.createToken(user.id, "reset");
      this.email.sendPasswordResetEmail(user.email, user.name, token).catch((e) =>
        console.error("reset email failed", e)
      );
    }
    return { ok: true };
  }

  async resetPassword(token: string, password: string) {
    const consumed = this.email.consumeToken(token, "reset");
    if (!consumed) return { ok: false, message: "Invalid or expired reset token" };
    const passwordHash = await bcrypt.hash(password, 10);
    execute(`UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`, [passwordHash, consumed.userId]);
    return { ok: true };
  }

  async verifyEmail(token: string) {
    const consumed = this.email.consumeToken(token, "verify");
    if (!consumed) return { ok: false, message: "Invalid or expired verification token" };
    execute(`UPDATE users SET email_verified_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`, [consumed.userId]);
    return { ok: true };
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
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: !!user.email_verified_at,
      },
    };
  }
}
