import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { Role } from '@sarh/shared';

import type { AuthUser } from './auth.types';

export const IS_PUBLIC_KEY = 'auth:isPublic';
/** Opt a route out of the globally applied JWT guard. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = 'auth:roles';
/**
 * Fix #3: authorisation is declared on the route and enforced by `RolesGuard`
 * on the server. The contractor build only hid the control in a React
 * `<AdminOnly>` wrapper, which any caller could bypass with curl.
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Fix #10: handlers receive a typed `AuthUser` instead of reaching into an
 * untyped `req` and re-deriving identity inline.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<Request>();
    if (!request.user) {
      throw new Error('CurrentUser used on a route that is not guarded');
    }
    return request.user;
  },
);
