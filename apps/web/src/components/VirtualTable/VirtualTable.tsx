import { useCallback, useEffect, useRef } from 'react';

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { FixedSizeList, type ListOnItemsRenderedProps } from 'react-window';

import { useElementSize } from '@/hooks';
import { cn } from '@/lib';

import { Skeleton } from '../Skeleton';

import { VirtualRow, type RowData } from './VirtualRow';
import type { VirtualTableProps } from './VirtualTable.types';

/** Start fetching this many rows before the end, so scrolling never stalls. */
const PREFETCH_THRESHOLD = 10;
const DEFAULT_ROW_HEIGHT = 52;

/**
 * A virtualized, infinitely-loading table.
 *
 * Only the visible rows exist in the DOM, so the list stays smooth at 50,000
 * rows and beyond. The header sits outside the scrolling list and shares one
 * `grid-template-columns` string with every row, which is what keeps the
 * columns aligned while the body scrolls under a fixed header.
 */
export function VirtualTable<T>({
  columns,
  rows,
  getRowId,
  rowHeight = DEFAULT_ROW_HEIGHT,
  hasMore,
  isFetchingMore,
  onEndReached,
  resetKey,
  isLoading = false,
  emptyState,
  isStale = false,
  sortKey,
  sortDir,
  onSortChange,
  caption,
}: VirtualTableProps<T>) {
  const listRef = useRef<FixedSizeList>(null);
  const { ref: bodyRef, height } = useElementSize<HTMLDivElement>();

  const template = columns.map((column) => column.width).join(' ');

  // A filter change produces a different data set under the same scroll
  // offset, so the viewport must return to the top or the user lands in the
  // middle of unrelated rows.
  useEffect(() => {
    listRef.current?.scrollToItem(0);
  }, [resetKey]);

  const handleItemsRendered = useCallback(
    ({ visibleStopIndex }: ListOnItemsRenderedProps) => {
      if (hasMore && !isFetchingMore && visibleStopIndex >= rows.length - PREFETCH_THRESHOLD) {
        onEndReached();
      }
    },
    [hasMore, isFetchingMore, onEndReached, rows.length],
  );

  const itemData: RowData<T> = { rows, columns, template, getRowId, hasMore };
  const itemCount = rows.length + (hasMore ? 1 : 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-divider bg-surface">
      {caption && <span className="sr-only">{caption}</span>}

      <div role="table" aria-rowcount={rows.length} className="flex min-h-0 flex-1 flex-col">
        <div
          role="row"
          style={{ gridTemplateColumns: template }}
          className="grid items-center border-b border-divider bg-surface-2 px-1"
        >
          {columns.map((column) => {
            const isActive = !!column.sortKey && column.sortKey === sortKey;
            const Icon = !isActive ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown;

            return (
              <div
                key={column.key}
                role="columnheader"
                aria-sort={
                  isActive ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined
                }
                className={cn(
                  'px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-subtle',
                  column.align === 'end' && 'text-end',
                )}
              >
                {column.sortKey && onSortChange ? (
                  <button
                    type="button"
                    onClick={() => onSortChange(column.sortKey!)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded hover:text-ink',
                      column.align === 'end' && 'flex-row-reverse',
                      isActive && 'text-accent',
                    )}
                  >
                    {column.header}
                    <Icon className="size-3" aria-hidden />
                  </button>
                ) : (
                  column.header
                )}
              </div>
            );
          })}
        </div>

        <div ref={bodyRef} className="min-h-0 flex-1">
          {isLoading ? (
            <div className="space-y-px p-1">
              {Array.from({ length: 10 }).map((_, index) => (
                <div key={index} style={{ height: rowHeight }} className="flex items-center px-3">
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="flex h-full items-center justify-center p-8">{emptyState}</div>
          ) : (
            height > 0 && (
              <div
                className={cn(
                  'transition-opacity',
                  // Dimmed while a newer filter's results are still loading, so
                  // the user can see the rows are about to be replaced.
                  isStale && 'pointer-events-none opacity-50',
                )}
              >
                <FixedSizeList
                  ref={listRef}
                  height={height}
                  width="100%"
                  itemCount={itemCount}
                  itemSize={rowHeight}
                  itemKey={(index) => {
                    const row = rows[index];
                    return row ? getRowId(row) : `loader-${index}`;
                  }}
                  itemData={itemData}
                  onItemsRendered={handleItemsRendered}
                  overscanCount={6}
                >
                  {VirtualRow as never}
                </FixedSizeList>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
