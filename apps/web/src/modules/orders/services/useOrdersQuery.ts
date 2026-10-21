import type { ListOrdersResponse, OrderSort, OrderStatus, SortDir } from '@sarh/shared';
import {
  keepPreviousData,
  useInfiniteQuery,
  type InfiniteData,
} from '@tanstack/react-query';

import { QUERY_KEYS } from '@/helpers';
import { useAxiosInstance } from '@/hooks';

export type OrdersFilters = {
  search: string;
  status: OrderStatus | '';
  sort: OrderSort;
  dir: SortDir;
};

/**
 * The orders list (R1).
 *
 * STALE-RESULT GUARANTEE — two mechanisms, and both are needed:
 *
 *  1. The query key embeds every filter. Each filter combination is its own
 *     cache entry, so a response can only ever be written under the key it was
 *     requested for. When the user changes a filter, React Query switches to a
 *     *different* entry; a late response for the old filter lands on the old
 *     entry and is never rendered.
 *
 *  2. `signal` is forwarded to axios. Changing a filter makes React Query abort
 *     the superseded request at the network level, so the browser stops waiting
 *     on work whose result is already irrelevant.
 *
 * Debouncing the search box (in the page) reduces how many requests are made.
 * It does not order them, which is why it is not relied on here: a slow early
 * query can still settle after a fast later one.
 */
export function useOrdersQuery(filters: OrdersFilters) {
  const axios = useAxiosInstance();
  const { search, status, sort, dir } = filters;

  return useInfiniteQuery<
    ListOrdersResponse,
    Error,
    InfiniteData<ListOrdersResponse>,
    ReturnType<typeof QUERY_KEYS.orders.list>,
    string | null
  >({
    queryKey: QUERY_KEYS.orders.list({ search, status: status || undefined, sort, dir }),
    initialPageParam: null,
    queryFn: async ({ pageParam, signal }) => {
      const { data } = await axios.get<ListOrdersResponse>('/orders', {
        params: {
          ...(search ? { search } : {}),
          ...(status ? { status } : {}),
          sort,
          dir,
          ...(pageParam ? { cursor: pageParam } : {}),
          limit: 50,
        },
        signal,
      });
      return data;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    // Keep the previous filter's rows on screen while the new ones load, so
    // the table does not flash empty. The page dims them to show they are stale.
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  });
}
