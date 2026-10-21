import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { createTestApp } from './setup-app';

/**
 * Finding #7: the login route had no rate limit, making it an open password
 * oracle. This suite stands alone so it starts with an empty throttler counter.
 */
describe('POST /api/auth/login — rate limiting (finding #7)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('blocks the sixth attempt within a minute', async () => {
    const attempt = () =>
      request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'admin@sarh.test', password: 'wrong-on-purpose' });

    for (let i = 0; i < 5; i += 1) {
      await attempt().expect(401);
    }

    // Sixth attempt is refused by the throttler, before any password check.
    await attempt().expect(429);

    // A correct password is refused too: the limit is on the route, not on
    // whether the guess happened to be right.
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@sarh.test', password: 'Admin123!' })
      .expect(429);
  });
});
