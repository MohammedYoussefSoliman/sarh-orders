import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import {
  createOrderSchema,
  listOrdersQuerySchema,
  type CreateOrderInput,
  type ListOrdersResponse,
  type OrderDto,
  type ParsedListOrdersQuery,
} from '@sarh/shared';

import { CurrentUser, Roles } from '../auth/decorators';
import type { AuthUser } from '../auth/auth.types';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { OrdersService } from './orders.service';

const idempotencyKeySchema = z.string().uuid();

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  /**
   * Keyset-paginated list. Responses are per-user and must never be cached by
   * a shared proxy, and a cached page would also defeat the stale-result
   * guarantee the client relies on.
   */
  @Get()
  @Header('Cache-Control', 'no-store')
  list(
    @Query(new ZodValidationPipe(listOrdersQuerySchema)) query: ParsedListOrdersQuery,
  ): Promise<ListOrdersResponse> {
    return this.orders.list(query);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<OrderDto> {
    return this.orders.findOne(id);
  }

  /**
   * Create an order (R2).
   *
   * Replies 201 for a new order and 200 when an identical request had already
   * created it, so a retrying client can tell the two apart without guessing.
   */
  @Post()
  async create(
    @Body(new ZodValidationPipe(createOrderSchema)) body: CreateOrderInput,
    @Headers('idempotency-key') rawKey: string | undefined,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<OrderDto> {
    const key = idempotencyKeySchema.safeParse(rawKey);
    if (!key.success) {
      throw new BadRequestException('An Idempotency-Key header with a UUID value is required');
    }

    const { order, created } = await this.orders.create(body, key.data, user.id);
    response.status(created ? HttpStatus.CREATED : HttpStatus.OK);
    return order;
  }

  /** Admin-only, enforced by `RolesGuard` on the server (fix #3). */
  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<void> {
    return this.orders.remove(id);
  }
}
