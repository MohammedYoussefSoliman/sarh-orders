import type { CreateOrderInput, OrderDto } from '@sarh/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QUERY_KEYS } from '@/helpers';
import { useAxiosInstance } from '@/hooks';

export type CreateOrderResult = {
  order: OrderDto;
  /** False when the server replayed an order this key had already created. */
  created: boolean;
};

/**
 * Creates an order (R2, client half).
 *
 * The caller owns the idempotency key and keeps it stable across retries; this
 * hook just forwards it. A 200 means the server recognised the key and returned
 * the order it already had, which is a success, not an error.
 */
export function useCreateOrder() {
  const axios = useAxiosInstance();
  const queryClient = useQueryClient();

  return useMutation<CreateOrderResult, unknown, { input: CreateOrderInput; idempotencyKey: string }>({
    mutationFn: async ({ input, idempotencyKey }) => {
      const response = await axios.post<OrderDto>('/orders', input, {
        headers: { 'Idempotency-Key': idempotencyKey },
      });
      return { order: response.data, created: response.status === 201 };
    },
    onSuccess: () => {
      // Every filter combination may now be out of date.
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.orders.all });
    },
  });
}
