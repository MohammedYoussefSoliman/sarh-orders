import { createHash } from 'node:crypto';

import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  computeOrderTotal,
  type CreateOrderInput,
  type ListOrdersResponse,
  type OrderDto,
  type ParsedListOrdersQuery,
} from '@sarh/shared';

import { PrismaService } from '../prisma/prisma.service';
import { OrdersRepository } from './orders.repository';

export type CreateOrderResult = {
  order: OrderDto;
  /** False when an identical request had already created this order. */
  created: boolean;
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: OrdersRepository,
  ) {}

  list(query: ParsedListOrdersQuery): Promise<ListOrdersResponse> {
    return this.repository.list(query);
  }

  /**
   * Idempotent create (R2).
   *
   * The guarantee is the UNIQUE index on `idempotency_key`, not application
   * logic: two concurrent inserts with the same key both reach the index, the
   * second blocks until the first commits, and then takes the conflict branch.
   * No lock, queue or time window is involved, so it holds across restarts and
   * across however many API instances are running.
   */
  async create(
    input: CreateOrderInput,
    idempotencyKey: string,
    userId: string,
  ): Promise<CreateOrderResult> {
    const total = computeOrderTotal(input.items);

    // A client-supplied total is advisory; a disagreement means the body was
    // built from stale prices or tampered with, so it is refused outright.
    if (input.totalAmount !== undefined && Math.abs(input.totalAmount - total) > 0.001) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        message: 'Submitted total does not match the order items',
        expectedTotal: total,
      });
    }

    const requestHash = hashRequest(input, total);

    const existing = await this.prisma.order.findUnique({
      where: { idempotencyKey },
      select: { id: true, requestHash: true },
    });

    if (existing) {
      return { order: await this.requireOrder(existing.id, requestHash, existing.requestHash), created: false };
    }

    const orderId = await this.prisma.$transaction(async (tx) => {
      // DO NOTHING returns no row when the key already exists, which is how a
      // racing duplicate is detected without an exception round trip.
      const inserted = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
        INSERT INTO orders (id, customer_name, customer_email, status, total_amount, idempotency_key, request_hash, created_by_id)
        VALUES (gen_random_uuid(), ${input.customerName}, ${input.customerEmail}, 'pending'::"OrderStatus",
                ${total}::numeric, ${idempotencyKey}, ${requestHash}, ${userId}::uuid)
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING id
      `);

      const row = inserted.at(0);
      if (!row) return null;

      await tx.orderItem.createMany({
        data: input.items.map((item) => ({
          orderId: row.id,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: new Prisma.Decimal(item.unitPrice.toFixed(2)),
        })),
      });

      return row.id;
    });

    if (orderId) {
      return { order: await this.findOne(orderId), created: true };
    }

    // The insert conflicted: another request with this key committed first.
    const winner = await this.prisma.order.findUnique({
      where: { idempotencyKey },
      select: { id: true, requestHash: true },
    });

    if (!winner) {
      // Only reachable if the winning row was deleted between the conflict and
      // this read; the client can safely retry with a new key.
      throw new ConflictException('Order creation conflicted, please retry');
    }

    return { order: await this.requireOrder(winner.id, requestHash, winner.requestHash), created: false };
  }

  async findOne(id: string): Promise<OrderDto> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return {
      id: order.id,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      status: order.status,
      totalAmount: Number(order.totalAmount),
      itemCount: order.items.length,
      createdAt: order.createdAt.toISOString(),
      items: order.items.map((item) => ({
        id: item.id,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
      })),
    };
  }

  async remove(id: string): Promise<void> {
    try {
      await this.prisma.order.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Order not found');
      }
      throw error;
    }
  }

  /**
   * Replay check: the same key with the same body is an honest retry and gets
   * the original order back. The same key with a *different* body means the
   * client reused a key for new content, which would otherwise silently
   * discard that order, so it is a 422.
   */
  private async requireOrder(
    id: string,
    incomingHash: string,
    storedHash: string | null,
  ): Promise<OrderDto> {
    if (storedHash && storedHash !== incomingHash) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        message:
          'This idempotency key was already used for a different order. Start a new order.',
      });
    }

    return this.findOne(id);
  }
}

/**
 * Stable fingerprint of the request body. Field order is written out
 * explicitly rather than relying on `JSON.stringify` key order, so the hash
 * cannot change just because the client serialised its object differently.
 */
function hashRequest(input: CreateOrderInput, total: number): string {
  const canonical = JSON.stringify({
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    total: total.toFixed(2),
    items: input.items.map((item) => [
      item.productName,
      item.quantity,
      item.unitPrice.toFixed(2),
    ]),
  });

  return createHash('sha256').update(canonical).digest('hex');
}
