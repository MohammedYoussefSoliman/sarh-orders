import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import type { CookieOptions } from 'express';
import type { LoginInput } from '@sarh/shared';

import { PrismaService } from '../prisma/prisma.service';
import type { Env } from '../config/env';
import type { AuthUser, JwtPayload } from './auth.types';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * Fix #4: passwords are bcrypt hashes, compared with `bcrypt.compare`. The
   * contractor build stored and compared plaintext.
   *
   * A wrong email and a wrong password return the same error, so the endpoint
   * does not confirm which addresses exist.
   */
  async validateCredentials({ email, password }: LoginInput): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Hash anyway: skipping the work on a missing user makes response time a
      // reliable oracle for which emails are registered.
      await bcrypt.compare(password, '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv');
      throw new UnauthorizedException('Incorrect email or password');
    }

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Incorrect email or password');
    }

    return { id: user.id, email: user.email, role: user.role };
  }

  /** Fix #5: every token carries an `exp` (default one 8-hour working shift). */
  signSession(user: AuthUser): string {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    return this.jwt.sign(payload);
  }

  /**
   * Cookie flags are the whole token-storage decision:
   *  - httpOnly  : script on the page cannot read or exfiltrate the token
   *  - sameSite  : strict, so a cross-site request never carries the session
   *  - secure    : production only, so local http development still works
   */
  cookieOptions(): CookieOptions {
    const isProd = this.config.get('NODE_ENV', { infer: true }) === 'production';
    return {
      httpOnly: true,
      sameSite: 'strict',
      secure: isProd,
      path: '/',
      maxAge: 8 * 60 * 60 * 1000,
    };
  }
}
