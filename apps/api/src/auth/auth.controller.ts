import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UsePipes,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { loginSchema, type AuthUser as SharedAuthUser, type LoginInput } from '@sarh/shared';

import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { SESSION_COOKIE } from '../config/env';
import { AuthService } from './auth.service';
import { CurrentUser, Public } from './decorators';
import type { AuthUser } from './auth.types';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /**
   * Fix #7: login is rate limited to 5 attempts per minute per IP. The
   * contractor build had no limit, so the endpoint was an open password oracle.
   */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(loginSchema))
  async login(
    @Body() body: LoginInput,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SharedAuthUser> {
    const user = await this.auth.validateCredentials(body);
    response.cookie(SESSION_COOKIE, this.auth.signSession(user), this.auth.cookieOptions());
    return user;
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Res({ passthrough: true }) response: Response): void {
    response.clearCookie(SESSION_COOKIE, { ...this.auth.cookieOptions(), maxAge: undefined });
  }

  /** The client's source of truth for identity and role. */
  @Get('me')
  me(@CurrentUser() user: AuthUser): SharedAuthUser {
    return user;
  }
}
