import { type ComponentPropsWithRef, type ReactNode, type Ref } from 'react';

import { Field } from '../Field';

import { Select, type SelectOption } from './Select';

export type BaseSelectProps = Omit<ComponentPropsWithRef<'select'>, 'ref'> & {
  options: SelectOption[];
  placeholder?: string;
  /** Field label. When omitted the bare select is rendered (no wrapper). */
  label?: ReactNode;
  /** Inline validation message shown beneath the select. */
  error?: string;
  /** Helper text shown beneath the select when there is no error. */
  hint?: ReactNode;
  required?: boolean;
  invalid?: boolean;
  /** Ref forwarded to the underlying `<select>` (used by RHF's Controller). */
  selectRef?: Ref<HTMLSelectElement>;
  /** Class applied to the Field wrapper (not the select). */
  fieldClassName?: string;
};

/**
 * Presentational select: the styled {@link Select} primitive wrapped in a
 * {@link Field} for label + validation. Usable standalone (controlled) or,
 * more commonly, through {@link HookFormSelect}.
 */
export function BaseSelect({
  label,
  error,
  hint,
  required,
  invalid,
  id,
  name,
  options,
  placeholder,
  selectRef,
  className,
  fieldClassName,
  ...props
}: BaseSelectProps) {
  const selectId = id ?? (name ? `${name}-input` : undefined);

  const control = (
    <Select
      id={selectId}
      name={name}
      ref={selectRef}
      options={options}
      placeholder={placeholder}
      invalid={invalid ?? Boolean(error)}
      className={className}
      {...props}
    />
  );

  if (!label) return control;

  return (
    <Field
      label={label}
      htmlFor={selectId}
      error={error}
      hint={hint}
      required={required}
      className={fieldClassName}
    >
      {control}
    </Field>
  );
}
