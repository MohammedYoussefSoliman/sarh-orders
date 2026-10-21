import { type ComponentPropsWithRef } from 'react';

import { ChevronDown } from 'lucide-react';

import { cn } from '@/lib';

export type SelectOption = { label: string; value: string };

export type SelectProps = ComponentPropsWithRef<'select'> & {
  options: SelectOption[];
  placeholder?: string;
  invalid?: boolean;
};

/** Styled native <select> — keyboard/screen-reader behaviour comes for free. */
export function Select({
  className,
  options,
  placeholder,
  invalid,
  ...props
}: SelectProps) {
  return (
    <div className="relative">
      <select
        aria-invalid={invalid || undefined}
        className={cn(
          'h-10 w-full appearance-none rounded-lg border bg-surface',
          'ps-3 pe-9 text-sm text-ink',
          'transition-colors focus-visible:border-accent',
          invalid ? 'border-danger' : 'border-divider hover:border-neutral-400',
          'disabled:opacity-50',
          className,
        )}
        {...props}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute end-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-subtle"
        aria-hidden
      />
    </div>
  );
}
