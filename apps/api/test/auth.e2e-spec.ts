import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import type { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './setup-app';

/**
 * Covers the security findings that are observable over HTTP.
 *
 * Logins happen once per role in `beforeAll` and the cookies are reused: the
 * login route is deliberately rate limited to 5/min, and a suite that logs in
 * per test would exhaust that budget against itself. The limit gets its own
 * suite (auth-ratelimit.e2e-spec.ts) so it starts with a fresh counter.
 */
describe('Auth and authorisation', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminLogin: request.Response;
  let adminCookie: string;
  let agentCookie: string;

  const login = (email: string, password: string) =>
    request(app.getHttpServer()).post('/api/auth/login').send({ email, password });

  const cookieFrom = (res: request.Response) =>
    (res.headers['set-cookie'] as unknown as string[])[0]!;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());

    adminLogin = await login('admin@sarh.test', 'Admin123!').expect(200);
    adminCookie = cookieFrom(adminLogin);
    agentCookie = cookieFrom(await login('agent@sarh.test', 'Agent123!').expect(200));
  });

  afterAll(async () => {
    await app.close();
  });

  it('issues an httpOnly, SameSite=Strict session cookie (finding #6, token storage)', () => {
    expect(adminCookie).toMatch(/HttpOnly/i);
    expect(adminCookie).toMatch(/SameSite=Strict/i);
    // The token must never reach the body, where page script could read it.
    expect(JSON.stringify(adminLogin.body)).not.toMatch(/eyJ/);
  });

  it('signs tokens with an expiry (finding #5)', () => {
    const token = /sarh_session=([^;]+)/.exec(adminCookie)![1]!;
    const payload = JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString());

    expect(payload.exp).toBeDefined();
    expect(payload.exp - payload.iat).toBe(8 * 60 * 60);
  });

  it('rejects a forged token with a bad signature (finding #1)', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const claims = Buffer.from(
      JSON.stringify({
        sub: randomUUID(),
        email: 'attacker@evil.test',
        role: 'admin',
        exp: 9_999_999_999,
      }),
    ).toString('base64url');

    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', `sarh_session=${header}.${claims}.forged`)
      .expect(401);
  });

  it('ignores a token supplied in the query string or Authorization header (findings #6, #8)', async () => {
    const token = /sarh_session=([^;]+)/.exec(adminCookie)![1]!;

    await request(app.getHttpServer()).get(`/api/auth/me?token=${token}`).expect(401);
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('stores passwords as bcrypt hashes, never plaintext (finding #4)', async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@sarh.test' } });

    expect(user.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(user.passwordHash).not.toContain('Admin123!');
  });

  it('enforces admin-only delete on the server, not just in the UI (finding #3)', async () => {
    // A throwaway order, so the test never erodes the seeded data set.
    const order = await prisma.order.create({
      data: {
        customerName: 'Delete Guard Fixture',
        customerEmail: 'delete-guard@sarh.test',
        totalAmount: '10.00',
      },
      select: { id: true },
    });

    await request(app.getHttpServer())
      .delete(`/api/orders/${order.id}`)
      .set('Cookie', agentCookie)
      .expect(403);

    // Still present after the agent's attempt.
    expect(await prisma.order.count({ where: { id: order.id } })).toBe(1);

    await request(app.getHttpServer())
      .delete(`/api/orders/${order.id}`)
      .set('Cookie', adminCookie)
      .expect(204);

    expect(await prisma.order.count({ where: { id: order.id } })).toBe(0);
  });

  it('validates the order id and 404s on a missing order (finding #9)', async () => {
    await request(app.getHttpServer())
      .delete('/api/orders/not-a-uuid')
      .set('Cookie', adminCookie)
      .expect(400);

    await request(app.getHttpServer())
      .delete(`/api/orders/${randomUUID()}`)
      .set('Cookie', adminCookie)
      .expect(404);
  });

  it('requires authentication for the orders list', async () => {
    await request(app.getHttpServer()).get('/api/orders').expect(401);
  });

  it('returns the same error for an unknown email and a wrong password', async () => {
    const unknown = await login('nobody@sarh.test', 'whatever').expect(401);
    const wrong = await login('admin@sarh.test', 'whatever').expect(401);

    expect(unknown.body.message).toBe(wrong.body.message);
  });
});
