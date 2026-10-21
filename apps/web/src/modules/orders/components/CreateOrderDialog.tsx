import { useEffect } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  computeOrderTotal,
  createOrderSchema,
  MAX_ORDER_ITEMS,
  type CreateOrderInput,
} from '@sarh/shared';
import { Plus, Trash2 } from 'lucide-react';
import { useFieldArray, useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Banner, Button, Dialog, Field, Input } from '@/components';
import { formatCurrency } from '@/helpers';
import { normalizeError } from '@/lib';

import { useCreateOrder, useIdempotencyKey } from '../services';

const EMPTY_ITEM = { productName: '', quantity: 1, unitPrice: 0 };

type CreateOrderDialogProps = {
  open: boolean;
  onClose: () => void;
};

export function CreateOrderDialog({ open, onClose }: CreateOrderDialogProps) {
  const createOrder = useCreateOrder();
  const { idempotencyKey, rotate } = useIdempotencyKey();

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<CreateOrderInput>({
    // The very same schema the API validates with, so the two cannot drift.
    resolver: zodResolver(createOrderSchema),
    defaultValues: { customerName: '', customerEmail: '', items: [{ ...EMPTY_ITEM }] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  const items = watch('items');
  const total = computeOrderTotal(
    (items ?? []).map((item) => ({
      productName: item?.productName ?? '',
      quantity: Number(item?.quantity) || 0,
      unitPrice: Number(item?.unitPrice) || 0,
    })),
  );

  useEffect(() => {
    if (open) createOrder.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onSubmit = handleSubmit((values) => {
    createOrder.mutate(
      { input: values, idempotencyKey },
      {
        onSuccess: ({ created }) => {
          toast.success(
            created
              ? 'Order created.'
              : 'That order had already been submitted — showing the original.',
          );
          // Only now is the key safe to retire: the server has the order.
          rotate();
          reset({ customerName: '', customerEmail: '', items: [{ ...EMPTY_ITEM }] });
          onClose();
        },
        onError: (error) => {
          // A reused key with changed contents can never succeed as-is; the
          // user needs a fresh key, so start a new draft.
          if (normalizeError(error).status === 422) rotate();
        },
      },
    );
  });

  const error = createOrder.error ? normalizeError(createOrder.error) : null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New order"
      description="Add the customer and at least one item."
      size="lg"
      footer={
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm text-ink-muted">
            Total <strong className="text-ink">{formatCurrency(total)}</strong>
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" form="create-order" isLoading={createOrder.isPending}>
              Create order
            </Button>
          </div>
        </div>
      }
    >
      {error && (
        <Banner tone="danger" className="mb-4">
          {error.message}
        </Banner>
      )}

      <form id="create-order" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Customer name" htmlFor="customerName" error={errors.customerName?.message} required>
            <Input id="customerName" invalid={!!errors.customerName} {...register('customerName')} />
          </Field>

          <Field label="Customer email" htmlFor="customerEmail" error={errors.customerEmail?.message} required>
            <Input
              id="customerEmail"
              type="email"
              invalid={!!errors.customerEmail}
              {...register('customerEmail')}
            />
          </Field>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-ink">Items</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={fields.length >= MAX_ORDER_ITEMS}
              onClick={() => append({ ...EMPTY_ITEM })}
            >
              <Plus className="size-4" aria-hidden /> Add item
            </Button>
          </div>

          {errors.items?.root?.message && (
            <p role="alert" className="text-[12px] font-medium text-danger">
              {errors.items.root.message}
            </p>
          )}

          {fields.map((field, index) => (
            <div key={field.id} className="grid items-start gap-3 sm:grid-cols-[1fr_6rem_8rem_auto]">
              <Field
                label={index === 0 ? 'Product' : ''}
                htmlFor={`items.${index}.productName`}
                error={errors.items?.[index]?.productName?.message}
              >
                <Input
                  id={`items.${index}.productName`}
                  invalid={!!errors.items?.[index]?.productName}
                  {...register(`items.${index}.productName`)}
                />
              </Field>

              <Field
                label={index === 0 ? 'Qty' : ''}
                htmlFor={`items.${index}.quantity`}
                error={errors.items?.[index]?.quantity?.message}
              >
                <Input
                  id={`items.${index}.quantity`}
                  type="number"
                  min={1}
                  invalid={!!errors.items?.[index]?.quantity}
                  {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                />
              </Field>

              <Field
                label={index === 0 ? 'Unit price' : ''}
                htmlFor={`items.${index}.unitPrice`}
                error={errors.items?.[index]?.unitPrice?.message}
              >
                <Input
                  id={`items.${index}.unitPrice`}
                  type="number"
                  min={0}
                  step="0.01"
                  invalid={!!errors.items?.[index]?.unitPrice}
                  {...register(`items.${index}.unitPrice`, { valueAsNumber: true })}
                />
              </Field>

              <div className={index === 0 ? 'pt-[26px]' : ''}>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove item ${index + 1}`}
                  disabled={fields.length === 1}
                  onClick={() => remove(index)}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </form>
    </Dialog>
  );
}
