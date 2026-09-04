import React from 'react';
import type { ReactNode } from 'react';
import {
  APP_INSPECTOR_LABEL_TEXT_CLASS,
  COMPACT_FIELD_VALUE_CLASS,
} from '../shared/compactFieldStyles';
import { cn } from '../../../../lib/cn';

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}): React.ReactElement {
  return (
    <label className="grid gap-2 md:grid-cols-[200px_minmax(0,1fr)] md:items-start md:gap-5">
      <span className={cn('pt-1', APP_INSPECTOR_LABEL_TEXT_CLASS)}>
        {label}
      </span>
      {children}
    </label>
  );
}

function InputBase({
  value,
  disabled,
  onChange,
  placeholder,
  type = 'text',
  className,
}: {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void | Promise<void>;
  placeholder?: string;
  type?: string;
  className?: string;
}): React.ReactElement {
  return (
    <input
      type={type}
      className={cn(
        'w-full rounded-lg border border-app-border bg-app-input',
        COMPACT_FIELD_VALUE_CLASS,
        'text-app-text shadow-inner outline-none transition-colors placeholder:text-app-text-muted focus:border-app-accent disabled:cursor-not-allowed disabled:opacity-60',
        className
      )}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function TextAreaBase({
  value,
  disabled,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void | Promise<void>;
  placeholder?: string;
  className?: string;
}): React.ReactElement {
  return (
    <textarea
      className={cn(
        'min-h-28 w-full rounded-lg border border-app-border bg-app-input',
        COMPACT_FIELD_VALUE_CLASS,
        'text-app-text shadow-inner outline-none transition-colors placeholder:text-app-text-muted focus:border-app-accent disabled:cursor-not-allowed disabled:opacity-60',
        className
      )}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function CheckboxBase({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void | Promise<void>;
}): React.ReactElement {
  return (
    <input
      type="checkbox"
      className="mt-2 h-4 w-4 rounded border-app-border bg-app-input accent-app-accent focus:ring-app-accent disabled:cursor-not-allowed disabled:opacity-60"
      checked={checked}
      disabled={disabled}
      onChange={(event) => onChange(event.target.checked)}
    />
  );
}

export {
  FieldRow,
  InputBase,
  TextAreaBase,
  CheckboxBase,
};
