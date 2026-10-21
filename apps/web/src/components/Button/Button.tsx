import { type ComponentPropsWithRef } from 'react';

import { Loader2 } from 'lucide-react';

import { cn } from '@/lib';

import { buttonVariants, type ButtonVariantProps } from './Button.variants';

export type ButtonProps = ComponentPropsWithRef<'button'> &
  ButtonVariantProps & {
    isLoading?: boolean;
  };

export function Button({
  className,
  variant,
  size,
  block,
  isLoading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size, block }), className)}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}
