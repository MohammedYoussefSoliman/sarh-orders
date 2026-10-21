import { memo } from 'react';

import { cn } from '@/lib';

import type { VirtualColumn } from './VirtualTable.types';

export type RowData<T> = {
  rows: T[];
  columns: VirtualColumn<T>[];
  template: string;
  getRowId: (row: T) => string;
  hasMore: boolean;
};

type VirtualRowProps<T> = {
  index: number;
  style: React.CSSProperties;
  data: RowData<T>;
};

/**
 * One rendered row.
 *
 * Memoised and fed through react-window's `itemData` rather than a closure, so
 * scrolling does not re-create the component's props on every frame and
 * unchanged rows bail out of re-rendering.
 *
 * react-window positions rows absolutely, so real <tr>/<td> elements cannot be
 * used; the ARIA roles restore the table semantics for screen readers.
 */
function VirtualRowInner<T>({ index, style, data }: VirtualRowProps<T>) {
  const { rows, columns, template, hasMore } = data;
  const row = rows[index];

  // The index past the last row is the loader sentinel that triggers the
  // next page fetch.
  if (!row) {
    return (
      <div style={style} className="flex items-center justify-center" role="row">
        <span role="cell" className="text-[13px] text-ink-subtle">
          {hasMore ? 'Loading more orders…' : null}
        </span>
      </div>
    );
  }

  return (
    <div
      style={{ ...style, gridTemplateColumns: template }}
      role="row"
      className="grid items-center border-b border-divider px-1 text-[13px] hover:bg-surface-2"
    >
      {columns.map((column) => (
        <div
          key={column.key}
          role="cell"
          className={cn(
            'min-w-0 px-3',
            column.truncate === false
              ? 'flex items-center justify-end'
              : 'truncate',
            column.align === 'end' && column.truncate !== false && 'text-end',
          )}
        >
          {column.render(row)}
        </div>
      ))}
    </div>
  );
}

export const VirtualRow = memo(VirtualRowInner) as typeof VirtualRowInner;
