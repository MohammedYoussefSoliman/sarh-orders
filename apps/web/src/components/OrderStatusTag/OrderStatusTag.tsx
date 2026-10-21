import type { OrderStatus } from '@sarh/shared';
import {
  CheckCircle2,
  Clock,
  CreditCard,
  PackageCheck,
  Truck,
  XCircle,
  type LucideIcon,
} from 'lucide-react';

import { Tag, type TagVariantProps } from '../Tag';

type Descriptor = {
  tone: NonNullable<TagVariantProps['tone']>;
  label: string;
  Icon: LucideIcon;
};

const STATUS: Record<OrderStatus, Descriptor> = {
  pending: { tone: 'warn', label: 'Pending', Icon: Clock },
  paid: { tone: 'info', label: 'Paid', Icon: CreditCard },
  shipped: { tone: 'violet', label: 'Shipped', Icon: Truck },
  delivered: { tone: 'success', label: 'Delivered', Icon: PackageCheck },
  cancelled: { tone: 'danger', label: 'Cancelled', Icon: XCircle },
};

/**
 * Status pills pair colour with an icon AND a text label, so the meaning never
 * depends on colour alone.
 */
export function OrderStatusTag({ status }: { status: OrderStatus }) {
  const descriptor = STATUS[status] ?? {
    tone: 'neutral' as const,
    label: status,
    Icon: CheckCircle2,
  };

  return (
    <Tag tone={descriptor.tone}>
      <descriptor.Icon className="size-3" aria-hidden />
      {descriptor.label}
    </Tag>
  );
}
