import { type ComponentPropsWithRef } from 'react';

import { cn } from '@/lib';

/** Shimmering placeholder block. Honours reduced-motion via index.css. */
export function Skeleton({
  className,
  ...props
}: ComponentPropsWithRef<'div'>) {
  return (
    <div
      className={cn('skeleton h-4 w-full rounded-md', className)}
      aria-hidden
      {...props}
    />
  );
}
