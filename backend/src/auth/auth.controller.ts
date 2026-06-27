import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  Res,
  UseGuards,
  Request,
} from '@nestjs/common';
import type { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { SignupDto, LoginDto } from './auth.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

const COOKIE_OPTIONS = {
  httpOnly: true, // ← JS cannot read this — XSS protection
  secure: process.env.NODE_ENV === 'production', // HTTPS-only in prod
  sameSite: 'lax' as const,
  maxAge: 15 * 60 * 1000, // 15 minutes in ms (matches JWT expiry)
  path: '/',
};

@Throttle({ default: { limit: 5, ttl: 60000 } })
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  async signup(
    @Body() dto: SignupDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.signup(dto);
    res.cookie('access_token', result.access_token, COOKIE_OPTIONS);
    return { message: 'Account created successfully' };
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto);
    res.cookie('access_token', result.access_token, COOKIE_OPTIONS);
    return { message: 'Logged in successfully' };
  }

  @HttpCode(HttpStatus.OK)
  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('access_token', { path: '/' });
    return { message: 'Logged out successfully' };
  }

  // Used by the frontend to check if the user is still authenticated
  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@Request() req) {
    return { id: req.user.id, email: req.user.email };
  }
}
