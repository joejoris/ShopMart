import { Body, Controller, Get, Post, UnauthorizedException, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsEmail, IsString, MinLength } from "class-validator";
import { AuthService } from "./auth.service";
import { Public, CurrentUser } from "../common/decorators";
import { JwtAuthGuard } from "../common/guards";

class RegisterDto {
  @IsString() name: string;
  @IsEmail() email: string;
  @MinLength(8) password: string;
}

class LoginDto {
  @IsEmail() email: string;
  @IsString() password: string;
}

class RefreshDto {
  @IsString() refreshToken: string;
}

class ForgotPasswordDto {
  @IsEmail() email: string;
}

class ResetPasswordDto {
  @IsString() token: string;
  @MinLength(8) password: string;
}

class VerifyEmailDto {
  @IsString() token: string;
}

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Post("register")
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public()
  @Post("login")
  async login(@Body() dto: LoginDto) {
    const user = await this.auth.validateUser(dto.email, dto.password);
    if (!user) throw new UnauthorizedException("Invalid credentials");
    return this.auth.login(user);
  }

  @Public()
  @Post("refresh")
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Public()
  @Post("forgot-password")
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto.email);
  }

  @Public()
  @Post("reset-password")
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.token, dto.password);
  }

  @Public()
  @Post("verify-email")
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.auth.verifyEmail(dto.token);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post("resend-verification")
  resendVerification(@CurrentUser() user: any) {
    return this.auth.resendVerification(user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get("me")
  me(@CurrentUser() user: any) {
    return this.auth.me(user.id);
  }
}
