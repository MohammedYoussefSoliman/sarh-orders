/**
 * Seeds two users and 50,000 orders with items.
 *
 * Rows are generated client-side (ids included) and inserted with `createMany`
 * in batches, so the whole seed is a handful of round trips rather than 50k.
 * Seeded orders deliberately leave `idempotency_key` NULL: they predate any
 * client key, and Postgres allows unlimited NULLs under a UNIQUE index.
 */
import { randomUUID } from 'node:crypto';

import { PrismaClient, type OrderStatus, type Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const ORDER_COUNT = Number(process.env.SEED_ORDER_COUNT ?? 50_000);
const BATCH_SIZE = 2_000;

const STATUSES: OrderStatus[] = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'];
// Weighted so the list looks like a real pipeline rather than a uniform mix.
const STATUS_WEIGHTS = [0.18, 0.22, 0.2, 0.33, 0.07];

const FIRST_NAMES = [
  'Omar', 'Layla', 'Yousef', 'Noura', 'Khalid', 'Sara', 'Faisal', 'Huda',
  'Tariq', 'Maha', 'Ahmed', 'Reem', 'Bandar', 'Jana', 'Saleh', 'Lina',
  'Nasser', 'Dana', 'Majed', 'Aisha', 'Ibrahim', 'Fatima', 'Rayan', 'Salma',
];
const LAST_NAMES = [
  'Al-Harbi', 'Al-Qahtani', 'Al-Dossari', 'Al-Shehri', 'Al-Otaibi', 'Al-Ghamdi',
  'Al-Zahrani', 'Al-Mutairi', 'Al-Subaie', 'Al-Anzi', 'Haddad', 'Nasser',
  'Khoury', 'Mansour', 'Darwish', 'Sayegh',
];
const DOMAINS = ['example.com', 'mail.sa', 'corp.sa', 'shop.example', 'inbox.com'];
const PRODUCTS = [
  'Wireless Keyboard', 'USB-C Hub', '27" Monitor', 'Ergonomic Chair',
  'Standing Desk', 'Noise-Cancelling Headset', 'Webcam 4K', 'Laptop Stand',
  'Mechanical Switch Set', 'Docking Station', 'Portable SSD 1TB', 'Label Printer',
  'Conference Speaker', 'Cable Organiser', 'Monitor Arm', 'Desk Lamp',
];

const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]!;

function pickStatus(): OrderStatus {
  const r = Math.random();
  let acc = 0;
  for (let i = 0; i < STATUSES.length; i += 1) {
    acc += STATUS_WEIGHTS[i]!;
    if (r <= acc) return STATUSES[i]!;
  }
  return 'pending';
}

/** A timestamp inside the last 18 months, skewed towards recent. */
function randomCreatedAt(): Date {
  const now = Date.now();
  const span = 1000 * 60 * 60 * 24 * 548;
  const skewed = Math.random() ** 1.6;
  return new Date(now - skewed * span);
}

function money(cents: number): Prisma.Decimal.Value {
  return (cents / 100).toFixed(2);
}

async function seedUsers() {
  // Cost 10 keeps login responsive while staying a real bcrypt work factor.
  const [adminHash, agentHash] = await Promise.all([
    bcrypt.hash('Admin123!', 10),
    bcrypt.hash('Agent123!', 10),
  ]);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@sarh.test' },
    update: { passwordHash: adminHash, role: 'admin' },
    create: { email: 'admin@sarh.test', passwordHash: adminHash, role: 'admin' },
  });
  const agent = await prisma.user.upsert({
    where: { email: 'agent@sarh.test' },
    update: { passwordHash: agentHash, role: 'agent' },
    create: { email: 'agent@sarh.test', passwordHash: agentHash, role: 'agent' },
  });

  return [admin.id, agent.id] as const;
}

async function main() {
  const startedAt = Date.now();
  console.log('Seeding users…');
  const userIds = await seedUsers();

  const existing = await prisma.order.count();
  if (existing > 0) {
    console.log(`Clearing ${existing} existing orders…`);
    // order_items cascade on delete.
    await prisma.order.deleteMany({});
  }

  console.log(`Seeding ${ORDER_COUNT.toLocaleString()} orders…`);

  for (let offset = 0; offset < ORDER_COUNT; offset += BATCH_SIZE) {
    const size = Math.min(BATCH_SIZE, ORDER_COUNT - offset);
    const orders: Prisma.OrderCreateManyInput[] = [];
    const items: Prisma.OrderItemCreateManyInput[] = [];

    for (let i = 0; i < size; i += 1) {
      const orderId = randomUUID();
      const first = pick(FIRST_NAMES);
      const last = pick(LAST_NAMES);
      const slug = `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, '');

      const itemCount = 1 + Math.floor(Math.random() * 4);
      let totalCents = 0;

      for (let j = 0; j < itemCount; j += 1) {
        const quantity = 1 + Math.floor(Math.random() * 5);
        const unitCents = 500 + Math.floor(Math.random() * 120_000);
        totalCents += unitCents * quantity;
        items.push({
          id: randomUUID(),
          orderId,
          productName: pick(PRODUCTS),
          quantity,
          unitPrice: money(unitCents),
        });
      }

      orders.push({
        id: orderId,
        customerName: `${first} ${last}`,
        customerEmail: `${slug}${Math.floor(Math.random() * 900) + 100}@${pick(DOMAINS)}`,
        status: pickStatus(),
        totalAmount: money(totalCents),
        createdAt: randomCreatedAt(),
        createdById: Math.random() < 0.35 ? pick(userIds) : null,
      });
    }

    await prisma.order.createMany({ data: orders });
    await prisma.orderItem.createMany({ data: items });

    const done = offset + size;
    if (done % 10_000 === 0 || done === ORDER_COUNT) {
      console.log(`  ${done.toLocaleString()} / ${ORDER_COUNT.toLocaleString()}`);
    }
  }

  // Keyset pages and the planner both depend on fresh statistics.
  console.log('Running ANALYZE…');
  await prisma.$executeRawUnsafe('ANALYZE orders');
  await prisma.$executeRawUnsafe('ANALYZE order_items');

  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\nDone in ${seconds}s.`);
  console.log('  admin@sarh.test / Admin123!  (admin)');
  console.log('  agent@sarh.test / Agent123!  (agent)');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
