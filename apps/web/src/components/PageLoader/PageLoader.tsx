import { Loader2 } from 'lucide-react';

/** Full-area loading indicator for route-level suspense/fetch states. */
export function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div
      className="flex min-h-64 flex-col items-center justify-center gap-3 text-ink-muted"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="size-6 animate-spin text-accent-500" aria-hidden />
      <span className="text-sm">{label}</span>
    </div>
  );
}
