import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { roleSchema } from '@sarh/shared';

import { SESSION_COOKIE, type Env } from '../config/env';
import type { AuthUser, JwtPayload } from './auth.types';

/**
 * Reads the session JWT and verifies its signature.
 *
 * Fix #1: passport-jwt calls `jwt.verify`, so a tampered payload is rejected.
 * The contractor build used `jwt.decode`, which parses without checking the
 * signature at all — anyone could mint `{ role: "admin" }`.
 * Fix #5: `ignoreExpiration` stays false, so `exp` is enforced.
 * Fix #6: the token is read from the httpOnly cookie only. The contractor
 * build also accepted `?token=`, which leaks into access logs, browser history
 * and the Referer header of every outbound link.
 * Fix #8: the Authorization header, when present, is parsed by passport's own
 * scheme-aware extractor rather than `split(' ')[1]`.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService<Env, true>) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors<Request>([
        (request) => (request.cookies?.[SESSION_COOKIE] as string | undefined) ?? null,
      ]),
      ignoreExpiration: false,
      algorithms: ['HS256'],
      secretOrKey: config.get('JWT_SECRET', { infer: true }),
    });
  }

  validate(payload: JwtPayload): AuthUser {
    const role = roleSchema.safeParse(payload.role);
    if (!payload.sub || !role.success) {
      throw new UnauthorizedException('Malformed session');
    }

    return { id: payload.sub, email: payload.email, role: role.data };
  }
}
