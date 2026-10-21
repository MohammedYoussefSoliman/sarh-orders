import { z } from 'zod';

export const ORDER_STATUSES = [
  'pending',
  'paid',
  'shipped',
  'delivered',
  'cancelled',
] as const;

export const orderStatusSchema = z.enum(ORDER_STATUSES);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

export const ORDER_SORT_FIELDS = ['createdAt', 'totalAmount'] as const;
export const orderSortSchema = z.enum(ORDER_SORT_FIELDS);
export type OrderSort = z.infer<typeof orderSortSchema>;

export const sortDirSchema = z.enum(['asc', 'desc']);
export type SortDir = z.infer<typeof sortDirSchema>;

export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 50;
/** Search terms shorter than this are ignored rather than scanned for. */
export const MIN_SEARCH_LENGTH = 2;

/**
 * Query contract for `GET /api/orders`.
 *
 * `sort` and `dir` are enums, never free text: the repository maps them through
 * a whitelist into SQL identifiers, so no caller input reaches the query text.
 */
export const listOrdersQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: orderStatusSchema.optional(),
  sort: orderSortSchema.default('createdAt'),
  dir: sortDirSchema.default('desc'),
  cursor: z.string().max(500).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

export type ListOrdersQuery = z.input<typeof listOrdersQuerySchema>;
export type ParsedListOrdersQuery = z.output<typeof listOrdersQuerySchema>;

export const MAX_ORDER_ITEMS = 5;

export const orderItemInputSchema = z.object({
  productName: z.string().trim().min(1, 'Product name is required').max(200),
  quantity: z.number().int().positive().max(10_000),
  unitPrice: z.number().nonnegative().max(1_000_000).refine(
    (n) => Number.isInteger(Math.round(n * 100)) && Math.abs(n * 100 - Math.round(n * 100)) < 1e-6,
    'Unit price supports at most 2 decimal places',
  ),
});

export type OrderItemInput = z.infer<typeof orderItemInputSchema>;

/**
 * Body contract for `POST /api/orders`.
 *
 * `totalAmount` is optional and advisory: the server always recomputes the
 * total from the items and rejects a client-supplied value that disagrees, so
 * a tampered or stale total can never be persisted.
 */
export const createOrderSchema = z.object({
  customerName: z.string().trim().min(1, 'Customer name is required').max(200),
  customerEmail: z.string().trim().toLowerCase().email('Enter a valid email').max(320),
  items: z
    .array(orderItemInputSchema)
    .min(1, 'Add at least one item')
    .max(MAX_ORDER_ITEMS, `At most ${MAX_ORDER_ITEMS} items`),
  totalAmount: z.number().nonnegative().optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

/** Sum the items in integer cents, so repeated float addition cannot drift. */
export function computeOrderTotal(items: readonly OrderItemInput[]): number {
  const cents = items.reduce(
    (sum, item) => sum + Math.round(item.unitPrice * 100) * item.quantity,
    0,
  );
  return cents / 100;
}

export type OrderItemDto = {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
};

export type OrderDto = {
  id: string;
  customerName: string;
  customerEmail: string;
  status: OrderStatus;
  totalAmount: number;
  itemCount: number;
  createdAt: string;
  items?: OrderItemDto[];
};

export type ListOrdersResponse = {
  items: OrderDto[];
  nextCursor: string | null;
};
