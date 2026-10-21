import { cva, type VariantProps } from 'class-variance-authority';

export const tagVariants = cva(
  [
    'inline-flex items-center gap-1.5 rounded-full border',
    'px-2.5 py-0.5 text-[11px] font-semibold',
    'leading-tight',
  ],
  {
    variants: {
      tone: {
        success: 'border-transparent bg-[#dcfce7] text-[#15803d]',
        warn: 'border-transparent bg-[#fef3c7] text-[#b45309]',
        danger: 'border-transparent bg-[#fee2e2] text-[#b91c1c]',
        info: 'border-transparent bg-[#dbeafe] text-[#1d4ed8]',
        accent: 'border-transparent bg-accent-50 text-accent-700',
        teal: 'border-transparent bg-[#ccfbf1] text-[#0f766e]',
        violet: 'border-transparent bg-[#ede9fe] text-[#6d28d9]',
        neutral: 'border-transparent bg-surface-2 text-ink-muted',
        outline: 'border-divider bg-transparent text-ink-muted',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export type TagVariantProps = VariantProps<typeof tagVariants>;
