import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QUERY_KEYS } from '@/helpers';
import { useAxiosInstance } from '@/hooks';

/** Admin-only. The server enforces the role; hiding the button is only UX. */
export function useDeleteOrder() {
  const axios = useAxiosInstance();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: string) => {
      await axios.delete(`/orders/${orderId}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.orders.all });
    },
  });
}
