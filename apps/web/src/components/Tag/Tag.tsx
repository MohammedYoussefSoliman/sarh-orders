import { type ComponentPropsWithRef } from 'react';

import { cn } from '@/lib';

import { tagVariants, type TagVariantProps } from './Tag.variants';

export type TagProps = ComponentPropsWithRef<'span'> & TagVariantProps;

export function Tag({ className, tone, children, ...props }: TagProps) {
  return (
    <span className={cn(tagVariants({ tone }), className)} {...props}>
      {children}
    </span>
  );
}
