import { Controller, type FieldValues, type Path } from 'react-hook-form';

import { type ControllerType } from '../form.types';

import { BaseInput, type BaseInputProps } from './BaseInput';

export type HookFormInputProps<T extends FieldValues> = ControllerType<T> &
  Omit<
    BaseInputProps,
    'name' | 'value' | 'defaultValue' | 'onChange' | 'onBlur' | 'error' | 'invalid' | 'inputRef'
  > & {
    name: Path<T>;
  };

/**
 * React Hook Form–ready text input. Drop it inside any form that exposes a
 * `control` object and it wires up `value`, `onChange`, `onBlur`, the ref, and
 * error display automatically — validation messages come from the form's
 * resolver (zod).
 *
 * ```tsx
 * <HookFormInput control={control} name="email" label="Email" required />
 * ```
 */
export function HookFormInput<T extends FieldValues>({
  control,
  name,
  ...props
}: HookFormInputProps<T>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field: { ref, ...field }, fieldState: { error } }) => (
        <BaseInput
          {...field}
          {...props}
          inputRef={ref}
          error={error?.message}
        />
      )}
    />
  );
}
