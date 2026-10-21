import { LogOut, Package } from 'lucide-react';
import { Outlet, useNavigate } from 'react-router-dom';

import { Button, Tag } from '@/components';
import { URLS } from '@/helpers';
import { useLogout, useMe } from '@/modules/authentication/services';

export function Layout() {
  const navigate = useNavigate();
  const { data: user } = useMe();
  const logout = useLogout();

  return (
    <div className="flex h-screen flex-col bg-canvas">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-divider bg-surface px-5 py-3">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-accent text-white">
            <Package className="size-4" aria-hidden />
          </span>
          <span className="font-semibold text-ink">Orders Console</span>
        </div>

        <div className="flex items-center gap-3">
          {user && (
            <div className="flex items-center gap-2 text-[13px]">
              <span className="text-ink-muted">{user.email}</span>
              <Tag tone={user.role === 'admin' ? 'accent' : 'neutral'}>{user.role}</Tag>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            isLoading={logout.isPending}
            onClick={() =>
              logout.mutate(undefined, {
                onSuccess: () => navigate(URLS.login, { replace: true }),
              })
            }
          >
            <LogOut className="size-4" aria-hidden /> Sign out
          </Button>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col p-5">
        <Outlet />
      </main>
    </div>
  );
}
