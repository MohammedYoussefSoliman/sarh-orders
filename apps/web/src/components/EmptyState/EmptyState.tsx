import { type ReactNode } from 'react';

import { type LucideIcon } from 'lucide-react';

import { cn } from '@/lib';

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  /** Visual tone: neutral (default) or a restricted/denied treatment. */
  tone?: 'neutral' | 'restricted' | 'error';
};

const TONE_ICON: Record<NonNullable<EmptyStateProps['tone']>, string> = {
  neutral: 'text-ink-subtle',
  restricted: 'text-warn',
  error: 'text-danger',
};

/** Consistent empty / restricted / error placeholder. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  tone = 'neutral',
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-12 text-center',
        className,
      )}
    >
      {Icon && (
        <Icon className={cn('size-8', TONE_ICON[tone])} aria-hidden />
      )}
      <div className="space-y-1">
        <p className="text-sm font-semibold text-ink">{title}</p>
        {description && (
          <p className="mx-auto max-w-sm text-[13px] text-ink-muted">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
