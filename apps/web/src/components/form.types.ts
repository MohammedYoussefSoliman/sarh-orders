import { type Control, type FieldValues } from 'react-hook-form';

/**
 * Shared contract for the `HookForm*` field components. A form passes its
 * `control` object down and the field wires up `value`/`onChange`/`onBlur`,
 * the ref, and error display through a react-hook-form `Controller` — the same
 * approach used across the field library (Select, Radio, Input).
 */
export type ControllerType<T extends FieldValues> = {
  control: Control<T>;
};
