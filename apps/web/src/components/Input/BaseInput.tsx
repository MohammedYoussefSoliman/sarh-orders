import { type ComponentPropsWithRef, type ReactNode, type Ref } from 'react';

import { Field } from '../Field';

import { Input } from './Input';

export type BaseInputProps = Omit<ComponentPropsWithRef<'input'>, 'ref'> & {
  /** Field label. When omitted the bare input is rendered (no wrapper). */
  label?: ReactNode;
  /** Inline validation message shown beneath the input. */
  error?: string;
  /** Helper text shown beneath the input when there is no error. */
  hint?: ReactNode;
  required?: boolean;
  invalid?: boolean;
  /** Ref forwarded to the underlying `<input>` (used by RHF's Controller). */
  inputRef?: Ref<HTMLInputElement>;
  /** Class applied to the Field wrapper (not the input). */
  fieldClassName?: string;
};

/**
 * Presentational input: the styled {@link Input} primitive wrapped in a
 * {@link Field} for label + validation. Usable standalone (controlled) or,
 * more commonly, through {@link HookFormInput}.
 */
export function BaseInput({
  label,
  error,
  hint,
  required,
  invalid,
  id,
  name,
  inputRef,
  className,
  fieldClassName,
  ...props
}: BaseInputProps) {
  const inputId = id ?? (name ? `${name}-input` : undefined);

  const control = (
    <Input
      id={inputId}
      name={name}
      ref={inputRef}
      invalid={invalid ?? Boolean(error)}
      className={className}
      {...props}
    />
  );

  if (!label) return control;

  return (
    <Field
      label={label}
      htmlFor={inputId}
      error={error}
      hint={hint}
      required={required}
      className={fieldClassName}
    >
      {control}
    </Field>
  );
}
