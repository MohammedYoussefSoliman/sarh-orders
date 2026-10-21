import { useEffect, useState } from 'react';

/**
 * Debounces a rapidly changing value (the search box).
 *
 * This is a network-chatter optimisation only. It is NOT what prevents stale
 * results — debouncing still lets a slow early request settle after a fast
 * later one. The ordering guarantee comes from per-filter query keys plus
 * request cancellation in `useOrdersQuery`.
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
