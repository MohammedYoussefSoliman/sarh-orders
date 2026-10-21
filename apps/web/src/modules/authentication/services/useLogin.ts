import type { AuthUser, LoginInput } from '@sarh/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QUERY_KEYS } from '@/helpers';
import { useAxiosInstance } from '@/hooks';

/**
 * Signing in sets the httpOnly session cookie server-side; nothing about the
 * token is stored here, because nothing about it is readable here.
 */
export function useLogin() {
  const axios = useAxiosInstance();
  const queryClient = useQueryClient();

  return useMutation<AuthUser, unknown, LoginInput>({
    mutationFn: async (credentials) => {
      const { data } = await axios.post<AuthUser>('/auth/login', credentials);
      return data;
    },
    onSuccess: (user) => {
      queryClient.setQueryData(QUERY_KEYS.me, user);
    },
  });
}
