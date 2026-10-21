import { ORDER_STATUSES, type OrderStatus } from '@sarh/shared';
import { Plus, Search, X } from 'lucide-react';

import { Button, Input, Select } from '@/components';

const STATUS_OPTIONS = ORDER_STATUSES.map((status) => ({
  value: status,
  label: status.charAt(0).toUpperCase() + status.slice(1),
}));

type OrdersToolbarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  status: OrderStatus | '';
  onStatusChange: (value: OrderStatus | '') => void;
  onCreate: () => void;
};

export function OrdersToolbar({
  search,
  onSearchChange,
  status,
  onStatusChange,
  onCreate,
}: OrdersToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-56 flex-1">
        <Search
          className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle"
          aria-hidden
        />
        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search customer name or email…"
          aria-label="Search orders"
          className="ps-9 pe-9"
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            aria-label="Clear search"
            className="absolute end-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-ink-subtle hover:text-ink"
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
      </div>

      <div className="w-44">
        <Select
          value={status}
          onChange={(event) => onStatusChange(event.target.value as OrderStatus | '')}
          options={STATUS_OPTIONS}
          placeholder="All statuses"
          aria-label="Filter by status"
        />
      </div>

      <Button onClick={onCreate}>
        <Plus className="size-4" aria-hidden /> New order
      </Button>
    </div>
  );
}
