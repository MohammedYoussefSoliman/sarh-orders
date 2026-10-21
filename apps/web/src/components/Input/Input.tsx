import { type ComponentPropsWithRef } from 'react';

import { cn } from '@/lib';

export type InputProps = ComponentPropsWithRef<'input'> & {
  invalid?: boolean;
};

export function Input({ className, invalid, ...props }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(
        'h-10 w-full rounded-lg border bg-surface px-3 text-sm text-ink',
        'placeholder:text-ink-subtle',
        'transition-colors focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20',
        invalid ? 'border-danger' : 'border-divider hover:border-neutral-400',
        'disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
