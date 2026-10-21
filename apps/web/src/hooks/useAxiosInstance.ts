import { useMemo } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import axios, { type AxiosInstance } from 'axios';
import { useNavigate } from 'react-router-dom';

import { QUERY_KEYS, URLS } from '@/helpers';

/**
 * The single HTTP client for the app.
 *
 * TOKEN STORAGE: there is no token here, and no `Authorization` header. The
 * session is an httpOnly cookie the browser attaches on its own because
 * `withCredentials` is set and the API is same-origin through the Vite proxy.
 * Script on the page — including injected script — cannot read it.
 *
 * A 401 means the session expired or was revoked: the cached identity is
 * dropped and the user is sent to /login. The backend stays authoritative;
 * 400/403/404/409/422 are passed through for per-call handling.
 */
export function useAxiosInstance(): AxiosInstance {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMemo(() => {
    const instance = axios.create({
      baseURL: '/api',
      withCredentials: true,
      headers: { 'Content-Type': 'application/json' },
    });

    instance.interceptors.response.use(
      (response) => response,
      (error) => {
        const status = error?.response?.status;
        if (status === 401 && window.location.pathname !== URLS.login) {
          queryClient.setQueryData(QUERY_KEYS.me, null);
          navigate(URLS.login, { replace: true });
        }
        return Promise.reject(error);
      },
    );

    return instance;
  }, [navigate, queryClient]);
}
