import type { ListOrdersQuery } from '@sarh/shared';

/**
 * Central React Query key factory.
 *
 * R1 STALE-RESULT GUARANTEE: the orders list key embeds every input that
 * changes the result — search text, status, sort field and direction. Each
 * combination is therefore a separate cache entry, so a response for one filter
 * can never be rendered under another. Changing a filter switches to a
 * different key rather than overwriting the current one.
 */
export const QUERY_KEYS = {
  me: ['auth', 'me'] as const,

  orders: {
    all: ['orders'] as const,
    list: (params: Omit<ListOrdersQuery, 'cursor' | 'limit'>) =>
      ['orders', 'list', params] as const,
    detail: (orderId: string) => ['orders', 'detail', orderId] as const,
  },
} as const;
