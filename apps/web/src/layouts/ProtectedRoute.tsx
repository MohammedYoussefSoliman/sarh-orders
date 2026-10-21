import { Navigate, Outlet } from 'react-router-dom';

import { PageLoader } from '@/components';
import { URLS } from '@/helpers';
import { useMe } from '@/modules/authentication/services';

/**
 * Gate for authenticated routes. This is navigation convenience only — every
 * API route is guarded server-side, so bypassing this in the browser gains
 * nothing but an empty screen.
 */
export function ProtectedRoute() {
  const { data: user, isPending } = useMe();

  if (isPending) return <PageLoader label="Checking your session…" />;
  if (!user) return <Navigate to={URLS.login} replace />;

  return <Outlet />;
}
