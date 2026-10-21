import { Controller, type FieldValues, type Path } from 'react-hook-form';

import { type ControllerType } from '../form.types';

import { BaseSelect, type BaseSelectProps } from './BaseSelect';

export type HookFormSelectProps<T extends FieldValues> = ControllerType<T> &
  Omit<
    BaseSelectProps,
    'name' | 'value' | 'defaultValue' | 'onChange' | 'onBlur' | 'error' | 'invalid' | 'selectRef'
  > & {
    name: Path<T>;
  };

/**
 * React Hook Form–ready select. Wires up `value`, `onChange`, `onBlur`, the
 * ref, and error display through a `Controller` — the same approach as
 * {@link HookFormInput} and the radio group.
 *
 * ```tsx
 * <HookFormSelect control={control} name="region" label="Region" options={regions} />
 * ```
 */
export function HookFormSelect<T extends FieldValues>({
  control,
  name,
  ...props
}: HookFormSelectProps<T>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field: { ref, ...field }, fieldState: { error } }) => (
        <BaseSelect
          {...field}
          {...props}
          selectRef={ref}
          error={error?.message}
        />
      )}
    />
  );
}
