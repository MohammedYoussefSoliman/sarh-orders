import type { AuthUser } from '@sarh/shared';
import { useQuery } from '@tanstack/react-query';

import { QUERY_KEYS } from '@/helpers';
import { useAxiosInstance } from '@/hooks';
import { isStatus } from '@/lib';

/**
 * The app's single source of truth for identity and role.
 *
 * The session is an httpOnly cookie, so the client cannot read who it is from
 * the token — it has to ask. A 401 is a normal answer here (signed out), not a
 * failure, so it resolves to null instead of retrying.
 */
export function useMe() {
  const axios = useAxiosInstance();

  return useQuery<AuthUser | null>({
    queryKey: QUERY_KEYS.me,
    queryFn: async () => {
      try {
        const { data } = await axios.get<AuthUser>('/auth/me');
        return data;
      } catch (error) {
        if (isStatus(error, 401)) return null;
        throw error;
      }
    },
    retry: false,
    staleTime: 5 * 60_000,
  });
}
