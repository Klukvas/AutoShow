import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Admin login (brute-force protected)' })
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const ip = req.ip ?? 'unknown';
    const result = await this.auth.login({
      email: dto.email.toLowerCase(),
      password: dto.password,
      ip,
    });
    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      accessExpiresIn: result.accessExpiresIn,
      refreshExpiresIn: result.refreshExpiresIn,
      user: {
        id: result.user.id,
        email: result.user.email,
        role: result.user.role,
      },
    };
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotate refresh token, issue new access+refresh pair' })
  async refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Revoke refresh token (denylist + family kill)' })
  async logout(@Body() dto: RefreshDto) {
    await this.auth.logout(dto.refreshToken);
  }
}
