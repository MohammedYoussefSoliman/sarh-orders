import { useMemo, useState } from 'react';

import type { OrderDto, OrderSort, OrderStatus } from '@sarh/shared';
import { Inbox, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  Banner,
  Button,
  ConfirmDialog,
  EmptyState,
  OrderStatusTag,
  VirtualTable,
  type VirtualColumn,
} from '@/components';
import { formatCurrency, formatDateTime } from '@/helpers';
import { useDebouncedValue } from '@/hooks';
import { normalizeError } from '@/lib';
import { useMe } from '@/modules/authentication/services';

import { CreateOrderDialog, OrdersToolbar } from '../components';
import { useDeleteOrder, useOrdersQuery } from '../services';

export function OrdersPage() {
  const { data: user } = useMe();
  const isAdmin = user?.role === 'admin';

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [sort, setSort] = useState<OrderSort>('createdAt');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<OrderDto | null>(null);

  // Debounced only to cut request volume while typing. Correctness under
  // rapid changes comes from the query key + abort in useOrdersQuery.
  const debouncedSearch = useDebouncedValue(search, 300);

  const filters = { search: debouncedSearch, status, sort, dir };
  const query = useOrdersQuery(filters);
  const deleteOrder = useDeleteOrder();

  const rows = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data],
  );

  const handleSort = (key: string) => {
    const field = key as OrderSort;
    if (field === sort) {
      setDir((current) => (current === 'desc' ? 'asc' : 'desc'));
    } else {
      setSort(field);
      setDir('desc');
    }
  };

  const columns: VirtualColumn<OrderDto>[] = useMemo(
    () => [
      {
        key: 'createdAt',
        header: 'Created',
        width: '180px',
        sortKey: 'createdAt',
        render: (order) => (
          <span className="text-ink-muted">{formatDateTime(order.createdAt)}</span>
        ),
      },
      {
        key: 'customer',
        header: 'Customer',
        width: 'minmax(220px, 1fr)',
        render: (order) => (
          <div className="min-w-0">
            <div className="truncate font-medium text-ink">{order.customerName}</div>
            <div className="truncate text-[12px] text-ink-subtle">{order.customerEmail}</div>
          </div>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        width: '140px',
        render: (order) => <OrderStatusTag status={order.status} />,
      },
      {
        key: 'items',
        header: 'Items',
        width: '80px',
        align: 'end',
        render: (order) => <span className="tabular-nums text-ink-muted">{order.itemCount}</span>,
      },
      {
        key: 'total',
        header: 'Total',
        width: '140px',
        align: 'end',
        sortKey: 'totalAmount',
        render: (order) => (
          <span className="tabular-nums font-medium text-ink">
            {formatCurrency(order.totalAmount)}
          </span>
        ),
      },
      {
        key: 'actions',
        header: '',
        width: '72px',
        align: 'end',
        truncate: false,
        render: (order) =>
          // Hidden for agents purely as UX; the API enforces the role.
          isAdmin ? (
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Delete order for ${order.customerName}`}
              onClick={() => setPendingDelete(order)}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          ) : null,
      },
    ],
    [isAdmin],
  );

  const error = query.error ? normalizeError(query.error) : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Orders</h1>
          <p className="mt-0.5 text-[13px] text-ink-muted">
            {query.isPending
              ? 'Loading…'
              : `${rows.length.toLocaleString()} loaded${query.hasNextPage ? ' — scroll for more' : ''}`}
          </p>
        </div>
      </div>

      <OrdersToolbar
        search={search}
        onSearchChange={setSearch}
        status={status}
        onStatusChange={setStatus}
        onCreate={() => setCreateOpen(true)}
      />

      {error && <Banner tone="danger">{error.message}</Banner>}

      <VirtualTable<OrderDto>
        caption="Orders, newest first"
        columns={columns}
        rows={rows}
        getRowId={(order) => order.id}
        hasMore={!!query.hasNextPage}
        isFetchingMore={query.isFetchingNextPage}
        onEndReached={() => void query.fetchNextPage()}
        // Returning to the top whenever the filters change.
        resetKey={`${debouncedSearch}|${status}|${sort}|${dir}`}
        isLoading={query.isPending}
        // True while showing the previous filter's rows under a new key.
        isStale={query.isPlaceholderData}
        emptyState={
          <EmptyState
            icon={Inbox}
            title="No orders match these filters"
            description="Try a different search term or clear the status filter."
          />
        }
        sortKey={sort}
        sortDir={dir}
        onSortChange={handleSort}
      />

      <CreateOrderDialog open={isCreateOpen} onClose={() => setCreateOpen(false)} />

      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        title="Delete this order?"
        description={
          pendingDelete
            ? `The order for ${pendingDelete.customerName} will be permanently removed.`
            : ''
        }
        confirmLabel="Delete order"
        tone="danger"
        isLoading={deleteOrder.isPending}
        onConfirm={() => {
          if (!pendingDelete) return;
          deleteOrder.mutate(pendingDelete.id, {
            onSuccess: () => {
              toast.success('Order deleted.');
              setPendingDelete(null);
            },
            onError: (deleteError) => {
              toast.error(normalizeError(deleteError).message);
              setPendingDelete(null);
            },
          });
        }}
      />
    </div>
  );
}
