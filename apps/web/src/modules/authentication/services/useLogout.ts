import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAxiosInstance } from '@/hooks';

export function useLogout() {
  const axios = useAxiosInstance();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await axios.post('/auth/logout');
    },
    onSuccess: () => {
      // Drop every cached response: the next user on this machine must not see
      // the previous session's orders.
      queryClient.clear();
    },
  });
}
