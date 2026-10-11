import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import { AuthService } from './auth.service.js';
import { AuthUser, SessionUser, toSessionUser } from './auth-user.js';
import { CurrentUser, Public } from './decorators.js';

class LoginDto {
  @IsString()
  @IsNotEmpty()
  username!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto): Promise<{ token: string; user: SessionUser }> {
    return this.authService.login(dto.username, dto.password, false);
  }

  @Public()
  @Post('superadmin-login')
  superadminLogin(
    @Body() dto: LoginDto,
  ): Promise<{ token: string; user: SessionUser }> {
    return this.authService.login(dto.username, dto.password, true);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser): SessionUser {
    return toSessionUser(user);
  }
}
