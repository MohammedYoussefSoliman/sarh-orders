import { type ReactNode } from 'react';

import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Lock,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib';

type BannerTone = 'info' | 'success' | 'warn' | 'danger' | 'locked';

const TONE: Record<
  BannerTone,
  { color: string; icon: LucideIcon; iconColor: string }
> = {
  info: { color: '#2563eb', icon: Info, iconColor: 'text-info' },
  success: { color: '#16a34a', icon: CheckCircle2, iconColor: 'text-success' },
  warn: { color: '#d97706', icon: AlertTriangle, iconColor: 'text-warn' },
  danger: { color: '#dc2626', icon: AlertTriangle, iconColor: 'text-danger' },
  locked: { color: '#64748b', icon: Lock, iconColor: 'text-ink-muted' },
};

type BannerProps = {
  tone?: BannerTone;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
};

/** Left-bordered notice used to explain approved / rejected / locked records. */
export function Banner({
  tone = 'info',
  title,
  children,
  className,
}: BannerProps) {
  const t = TONE[tone];
  return (
    <div
      className={cn(
        'flex gap-3 rounded-lg border border-divider bg-surface-2 px-4 py-3',
        className,
      )}
      style={{ borderInlineStartWidth: 3, borderInlineStartColor: t.color }}
      role="note"
    >
      <t.icon
        className={cn('mt-0.5 size-4 shrink-0', t.iconColor)}
        aria-hidden
      />
      <div className="text-[13px] leading-relaxed">
        {title && <p className="font-semibold text-ink">{title}</p>}
        <div className="text-ink-muted">{children}</div>
      </div>
    </div>
  );
}
