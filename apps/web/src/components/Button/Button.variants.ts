import { cva, type VariantProps } from 'class-variance-authority';

export const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap',
    'rounded-lg border font-semibold select-none',
    'transition-colors duration-150',
    'disabled:pointer-events-none disabled:opacity-50',
  ],
  {
    variants: {
      variant: {
        primary:
          'border-accent bg-accent text-white hover:bg-accent-700 active:bg-accent-800',
        secondary:
          'border-divider bg-surface text-ink hover:bg-surface-2 active:bg-neutral-200',
        ghost:
          'border-transparent bg-transparent text-ink-muted hover:bg-surface-2 hover:text-ink',
        danger:
          'border-danger bg-danger text-white hover:brightness-110 active:brightness-95',
        outline:
          'border-accent-200 bg-transparent text-accent-700 hover:bg-accent-50',
      },
      size: {
        sm: 'h-8 px-3 text-[13px]',
        md: 'h-10 px-4 text-sm',
        lg: 'h-11 px-6 text-sm',
        icon: 'h-9 w-9 p-0',
      },
      block: { true: 'w-full', false: '' },
    },
    defaultVariants: { variant: 'secondary', size: 'md', block: false },
  },
);

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;
