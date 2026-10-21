import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  MIN_SEARCH_LENGTH,
  type OrderDto,
  type OrderSort,
  type ParsedListOrdersQuery,
} from '@sarh/shared';

import { PrismaService } from '../prisma/prisma.service';
import { decodeCursor, encodeCursor } from './cursor';

/** Raw shape returned by the list query. */
type OrderRow = {
  id: string;
  customer_name: string;
  customer_email: string;
  status: OrderDto['status'];
  total_amount: Prisma.Decimal;
  created_at: Date;
  item_count: number;
};

/**
 * Sort field -> SQL column. Nothing from the request ever reaches the query
 * text: `sort` and `dir` are Zod enums, and this map is the only place the
 * column name is written.
 */
const SORT_COLUMNS: Record<OrderSort, string> = {
  createdAt: 'o.created_at',
  totalAmount: 'o.total_amount',
};

/** Escape LIKE wildcards so a literal `%` or `_` in a search term is not a wildcard. */
function escapeLikeTerm(term: string): string {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}

@Injectable()
export class OrdersRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Keyset page.
   *
   * The predicate is a row-value comparison — `(sort_col, id) < (v, id)` — which
   * matches the composite index `(… DESC, id DESC)` exactly, so each page is a
   * range scan from the cursor rather than a scan-and-discard of everything
   * before it. One extra row is fetched to decide whether a next page exists,
   * which avoids a `COUNT(*)` over the whole filtered set.
   */
  async list(query: ParsedListOrdersQuery): Promise<{ items: OrderDto[]; nextCursor: string | null }> {
    const { search, status, sort, dir, cursor, limit } = query;

    const sortColumn = Prisma.raw(SORT_COLUMNS[sort]);
    const direction = Prisma.raw(dir === 'asc' ? 'ASC' : 'DESC');
    // Ascending pages walk forward, descending pages walk backward; the
    // tiebreaker must move in the same direction as the sort column.
    const comparator = Prisma.raw(dir === 'asc' ? '>' : '<');

    const conditions: Prisma.Sql[] = [];

    if (status) {
      conditions.push(Prisma.sql`o.status = ${status}::"OrderStatus"`);
    }

    // Terms shorter than two characters match most of the table; trigram
    // indexes cannot help there, so they are ignored rather than scanned.
    const term = search?.trim() ?? '';
    if (term.length >= MIN_SEARCH_LENGTH) {
      const pattern = `%${escapeLikeTerm(term.toLowerCase())}%`;
      conditions.push(
        Prisma.sql`(lower(o.customer_name) LIKE ${pattern} ESCAPE '\\'
                 OR lower(o.customer_email) LIKE ${pattern} ESCAPE '\\')`,
      );
    }

    if (cursor) {
      const { v, id } = decodeCursor(cursor, sort);
      const typedValue =
        sort === 'createdAt'
          ? Prisma.sql`${v}::timestamptz`
          : Prisma.sql`${v}::numeric`;
      conditions.push(
        Prisma.sql`(${sortColumn}, o.id) ${comparator} (${typedValue}, ${id}::uuid)`,
      );
    }

    const where = conditions.length
      ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<OrderRow[]>(Prisma.sql`
      SELECT
        o.id,
        o.customer_name,
        o.customer_email,
        o.status,
        o.total_amount,
        o.created_at,
        (SELECT COUNT(*)::int FROM order_items oi WHERE oi.order_id = o.id) AS item_count
      FROM orders o
      ${where}
      ORDER BY ${sortColumn} ${direction}, o.id ${direction}
      LIMIT ${limit + 1}
    `);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page.at(-1);

    const nextCursor =
      hasMore && last
        ? encodeCursor(
            sort,
            sort === 'createdAt' ? last.created_at.toISOString() : last.total_amount.toString(),
            last.id,
          )
        : null;

    return { items: page.map(toOrderDto), nextCursor };
  }
}

export function toOrderDto(row: OrderRow): OrderDto {
  return {
    id: row.id,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    status: row.status,
    totalAmount: Number(row.total_amount),
    itemCount: row.item_count,
    createdAt: row.created_at.toISOString(),
  };
}
