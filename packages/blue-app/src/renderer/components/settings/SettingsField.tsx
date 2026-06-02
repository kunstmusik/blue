import React from 'react';
import { cn } from '../../lib/cn';

const FIELD_CONTAINER_CLASS = 'mb-4';
const FIELD_LABEL_CLASS = 'mb-1 block text-body font-medium text-app-text-muted';
const FIELD_DESCRIPTION_CLASS = 'mb-1.5 text-ui leading-4 text-app-text-subtle';
const FIELD_INPUT_CLASS =
  'w-full max-w-[400px] rounded-md border border-app-border bg-app-canvas px-2.5 py-1.5 text-content text-app-text outline-none transition-colors placeholder:text-app-text-muted focus:border-app-accent disabled:cursor-not-allowed disabled:opacity-50';
const FIELD_SELECT_CLASS =
  'min-w-[140px] max-w-[400px] rounded-md border border-app-border bg-app-canvas px-2.5 py-1.5 text-content text-app-text outline-none transition-colors focus:border-app-accent disabled:cursor-not-allowed disabled:opacity-50';
const FIELD_CHECKBOX_CLASS = 'mb-3 flex cursor-pointer items-start gap-2 text-content text-app-text';
const FIELD_CHECKBOX_INPUT_CLASS =
  'mt-0.5 h-4 w-4 rounded border-app-border bg-app-canvas accent-app-accent disabled:cursor-not-allowed';

export const SETTINGS_NARROW_FIELD_CLASS = 'w-[120px] max-w-none';
export const SETTINGS_MEDIUM_FIELD_CLASS = 'max-w-[300px]';
export const SETTINGS_INDENT_CLASS = 'pl-6';

interface SettingsFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'children' | 'onChange' | 'value'> {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  description?: string;
  containerClassName?: string;
  inputClassName?: string;
}

export default function SettingsField({
  label,
  value,
  onChange,
  description,
  containerClassName,
  inputClassName,
  ...inputProps
}: SettingsFieldProps): React.ReactElement {
  return (
    <div className={cn(FIELD_CONTAINER_CLASS, containerClassName)}>
      <label className={FIELD_LABEL_CLASS}>
        {label}
      </label>
      {description && (
        <div className={FIELD_DESCRIPTION_CLASS}>
          {description}
        </div>
      )}
      <input
        {...inputProps}
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        className={cn(FIELD_INPUT_CLASS, inputClassName)}
      />
    </div>
  );
}

interface SettingsSelectFieldProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'children' | 'onChange' | 'value'> {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  description?: string;
  containerClassName?: string;
  selectClassName?: string;
  children: React.ReactNode;
}

export function SettingsSelectField({
  label,
  value,
  onChange,
  description,
  containerClassName,
  selectClassName,
  children,
  ...selectProps
}: SettingsSelectFieldProps): React.ReactElement {
  return (
    <div className={cn(FIELD_CONTAINER_CLASS, containerClassName)}>
      <label className={FIELD_LABEL_CLASS}>{label}</label>
      {description ? <div className={FIELD_DESCRIPTION_CLASS}>{description}</div> : null}
      <select
        {...selectProps}
        value={value}
        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}
        className={cn(FIELD_SELECT_CLASS, selectClassName)}
      >
        {children}
      </select>
    </div>
  );
}

interface SettingsCheckboxFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'checked' | 'children' | 'onChange' | 'type'> {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  description?: string;
  containerClassName?: string;
}

export function SettingsCheckboxField({
  label,
  checked,
  onChange,
  description,
  containerClassName,
  disabled,
  ...inputProps
}: SettingsCheckboxFieldProps): React.ReactElement {
  return (
    <label
      className={cn(
        FIELD_CHECKBOX_CLASS,
        disabled && 'cursor-default opacity-50',
        containerClassName,
      )}
    >
      <input
        {...inputProps}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.checked)}
        className={FIELD_CHECKBOX_INPUT_CLASS}
      />
      <span className="flex flex-col gap-0.5">
        <span>{label}</span>
        {description ? <span className={FIELD_DESCRIPTION_CLASS}>{description}</span> : null}
      </span>
    </label>
  );
}

export function SettingsSubsectionTitle({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <h3 className="mb-3 mt-5 border-b border-app-border pb-1 text-sm font-semibold text-app-text-strong">
      {children}
    </h3>
  );
}
