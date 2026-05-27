import React from 'react';
import type { ReactNode } from 'react';

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}): React.ReactElement {
  return (
    <label className="grid gap-2 md:grid-cols-[200px_minmax(0,1fr)] md:items-start md:gap-5">
      <span className="pt-2 text-xs font-medium uppercase tracking-[0.18em] text-blue-muted">
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
      className={[
        'w-full rounded-lg border border-blue-border bg-[#0d1524] px-3 py-2 text-sm text-gray-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] outline-none transition-colors placeholder:text-blue-muted focus:border-blue-accent disabled:cursor-not-allowed disabled:opacity-60',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
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
      className={[
        'min-h-28 w-full rounded-lg border border-blue-border bg-[#0d1524] px-3 py-2 text-sm text-gray-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] outline-none transition-colors placeholder:text-blue-muted focus:border-blue-accent disabled:cursor-not-allowed disabled:opacity-60',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
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
      className="mt-2 h-4 w-4 rounded border-blue-border bg-[#0d1524] text-blue-accent focus:ring-blue-accent disabled:cursor-not-allowed disabled:opacity-60"
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
