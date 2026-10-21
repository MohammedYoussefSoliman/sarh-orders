import type { ReactNode } from 'react';

export type VirtualColumn<T> = {
  key: string;
  header: ReactNode;
  /** Any CSS grid track size: '1fr', '160px', 'minmax(120px, 1fr)'. */
  width: string;
  align?: 'start' | 'end';
  /** Clip overflowing text with an ellipsis. Off for cells holding controls. */
  truncate?: boolean;
  /** Sort field this column controls; omit for non-sortable columns. */
  sortKey?: string;
  render: (row: T) => ReactNode;
};

export type VirtualTableProps<T> = {
  columns: VirtualColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  rowHeight?: number;

  hasMore: boolean;
  isFetchingMore: boolean;
  onEndReached: () => void;

  /** Scroll back to the top whenever this changes (filters changed). */
  resetKey: string;

  isLoading?: boolean;
  emptyState?: ReactNode;
  /** Dim the body while a superseding fetch is in flight. */
  isStale?: boolean;

  sortKey?: string;
  sortDir?: 'asc' | 'desc';
  onSortChange?: (key: string) => void;

  caption?: string;
};
