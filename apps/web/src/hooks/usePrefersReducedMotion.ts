import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(callback: () => void): () => void {
  const media = window.matchMedia(QUERY);
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
}

function getSnapshot(): boolean {
  return window.matchMedia(QUERY).matches;
}

/**
 * Reactive `prefers-reduced-motion` reader. Components use this to skip or
 * shorten JS-driven (framer-motion) animation; CSS animations are also
 * neutralised globally in index.css. Uses `useSyncExternalStore` per the
 * external-store guidance (no effect needed).
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
