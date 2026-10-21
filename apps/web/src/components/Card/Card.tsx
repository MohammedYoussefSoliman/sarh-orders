import { type ComponentPropsWithRef } from 'react';

import { cn } from '@/lib';

type CardProps = ComponentPropsWithRef<'section'>;

/** Rounded, softly-elevated surface — the primary content container. */
export function Card({ className, children, ...props }: CardProps) {
  return (
    <section
      className={cn(
        'rounded-xl border border-divider bg-surface shadow-sm',
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}

export function CardHeader({
  className,
  ...props
}: ComponentPropsWithRef<'header'>) {
  return (
    <header
      className={cn(
        'flex items-center justify-between gap-3 border-b border-divider px-5 py-4',
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({
  className,
  ...props
}: ComponentPropsWithRef<'h3'>) {
  return (
    <h3
      className={cn('text-sm font-semibold text-ink', className)}
      {...props}
    />
  );
}

export function CardBody({
  className,
  ...props
}: ComponentPropsWithRef<'div'>) {
  return <div className={cn('p-5', className)} {...props} />;
}
