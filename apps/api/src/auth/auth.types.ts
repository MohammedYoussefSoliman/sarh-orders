import type { Role } from '@sarh/shared';

/** The authenticated principal attached to every guarded request. */
export type AuthUser = {
  id: string;
  email: string;
  role: Role;
};

/** Claims we sign. `sub` is the user id; `exp` is added by @nestjs/jwt. */
export type JwtPayload = {
  sub: string;
  email: string;
  role: Role;
};

declare module 'express' {
  interface Request {
    user?: AuthUser;
  }
}
