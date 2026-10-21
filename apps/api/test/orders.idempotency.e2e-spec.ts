import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { CreateOrderInput } from '@sarh/shared';

import type { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './setup-app';

/**
 * R2: the same order must never be created twice, even when two requests race.
 *
 * These tests go through the real HTTP stack against the real database — the
 * guarantee is the UNIQUE index, so mocking the database would prove nothing.
 */
describe('POST /api/orders — idempotency (R2)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cookie: string;

  const body: CreateOrderInput = {
    customerName: 'Race Condition Tester',
    customerEmail: 'race@sarh.test',
    items: [
      { productName: 'Wireless Keyboard', quantity: 2, unitPrice: 149.5 },
      { productName: 'USB-C Hub', quantity: 1, unitPrice: 79.99 },
    ],
  };

  const expectedTotal = 149.5 * 2 + 79.99;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'agent@sarh.test', password: 'Agent123!' })
      .expect(200);

    const setCookie = login.headers['set-cookie'] as unknown as string[];
    cookie = setCookie[0]!;
  });

  afterAll(async () => {
    await prisma.order.deleteMany({ where: { customerEmail: { contains: '@sarh.test' } } });
    await app.close();
  });

  const post = (key: string, payload: object = body) =>
    request(app.getHttpServer())
      .post('/api/orders')
      .set('Cookie', cookie)
      .set('Idempotency-Key', key)
      .send(payload);

  it('creates exactly one order when two identical requests race', async () => {
    const key = randomUUID();

    const [first, second] = await Promise.all([post(key), post(key)]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 201]);

    // Both callers must be told about the same order.
    expect(first.body.id).toBe(second.body.id);

    const stored = await prisma.order.count({ where: { idempotencyKey: key } });
    expect(stored).toBe(1);

    const order = await prisma.order.findUniqueOrThrow({
      where: { idempotencyKey: key },
      include: { items: true },
    });
    // The losing request must not have appended a second set of items.
    expect(order.items).toHaveLength(2);
    expect(Number(order.totalAmount)).toBeCloseTo(expectedTotal, 2);
  });

  it('creates exactly one order when ten requests race', async () => {
    const key = randomUUID();

    const responses = await Promise.all(Array.from({ length: 10 }, () => post(key)));

    expect(responses.filter((r) => r.status === 201)).toHaveLength(1);
    expect(responses.filter((r) => r.status === 200)).toHaveLength(9);

    const ids = new Set(responses.map((r) => r.body.id));
    expect(ids.size).toBe(1);

    expect(await prisma.order.count({ where: { idempotencyKey: key } })).toBe(1);
  });

  it('replays the original order for a later retry with the same key', async () => {
    const key = randomUUID();

    const created = await post(key).expect(201);
    const replayed = await post(key).expect(200);

    expect(replayed.body.id).toBe(created.body.id);
    expect(await prisma.order.count({ where: { idempotencyKey: key } })).toBe(1);
  });

  it('rejects the same key reused for a different body with 422', async () => {
    const key = randomUUID();

    await post(key).expect(201);

    const changed: CreateOrderInput = {
      ...body,
      items: [{ productName: 'Standing Desk', quantity: 1, unitPrice: 2400 }],
    };

    await post(key, changed).expect(422);

    // The original order is untouched.
    const order = await prisma.order.findUniqueOrThrow({ where: { idempotencyKey: key } });
    expect(Number(order.totalAmount)).toBeCloseTo(expectedTotal, 2);
  });

  it('requires a UUID Idempotency-Key', async () => {
    await request(app.getHttpServer())
      .post('/api/orders')
      .set('Cookie', cookie)
      .send(body)
      .expect(400);

    await post('not-a-uuid').expect(400);
  });

  it('rejects a body whose declared total disagrees with its items', async () => {
    await post(randomUUID(), { ...body, totalAmount: 1 }).expect(422);
  });
});
