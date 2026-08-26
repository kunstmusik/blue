import * as Select from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { PopoutSelectPortal, portalEventIsolationProps } from '../hooks/host-portals';
import { cn } from '../lib/cn';

export interface AppSelectOption {
  value: string | number;
  label: ReactNode;
  /** Plain text used by Radix typeahead when label is not a string. */
  textValue?: string;
  disabled?: boolean;
}

interface AppSelectProps extends Omit<
  React.ComponentPropsWithoutRef<typeof Select.Trigger>,
  'children' | 'defaultValue' | 'onChange' | 'value'
> {
  value: string | number;
  options: readonly AppSelectOption[];
  onValueChange: (value: string) => void;
  placeholder?: string;
  name?: string;
  required?: boolean;
  form?: string;
  contentClassName?: string;
}

const TRIGGER_CLASS =
  'inline-flex min-w-0 items-center justify-between gap-1 rounded border border-app-border bg-app-input px-2 py-1 text-left text-role-body text-app-text-strong outline-none transition-colors hover:border-app-accent focus-visible:border-app-accent disabled:cursor-not-allowed disabled:opacity-50';

const ITEM_CLASS =
  'relative flex cursor-default select-none items-center rounded px-2 py-1 pr-7 text-role-body text-app-text-strong outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-app-accent/20';

const EMPTY_OPTION_VALUE = '__blue_app_select_empty_option__';

function encodeValue(value: string | number): string {
  return value === '' ? EMPTY_OPTION_VALUE : String(value);
}

/**
 * Blue's application-owned select control. Radix owns native-equivalent
 * keyboard, typeahead, focus, and selection semantics; this module owns the
 * app styling and host-window portal policy.
 */
export function AppSelect({
  value,
  options,
  onValueChange,
  placeholder,
  disabled,
  name,
  required,
  form,
  className,
  contentClassName,
  ...triggerProps
}: AppSelectProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const selectedOption = options.find((option) => String(option.value) === String(value));

  return (
    <Select.Root
      value={encodeValue(value)}
      onValueChange={(nextValue) => onValueChange(nextValue === EMPTY_OPTION_VALUE ? '' : nextValue)}
      disabled={disabled}
      name={name}
      required={required}
      form={form}
      open={open}
      onOpenChange={setOpen}
    >
      <Select.Trigger
        {...triggerProps}
        disabled={disabled}
        className={cn(TRIGGER_CLASS, className)}
      >
        <Select.Value placeholder={placeholder}>{selectedOption?.label}</Select.Value>
        <Select.Icon asChild>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-app-text-muted" aria-hidden="true" />
        </Select.Icon>
      </Select.Trigger>
      {open ? <PopoutSelectPortal>
        <Select.Content
          position="popper"
          sideOffset={4}
          collisionPadding={8}
          className={cn(
            'z-[1000] min-w-[var(--radix-select-trigger-width)] max-w-[var(--radix-select-content-available-width)] overflow-hidden rounded border border-app-border bg-app-menu shadow-lg',
            contentClassName,
          )}
          data-auxiliary-portal="true"
          {...portalEventIsolationProps}
        >
          <Select.ScrollUpButton className="flex h-5 items-center justify-center text-app-text-muted">
            <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
          </Select.ScrollUpButton>
          <Select.Viewport className="max-h-[var(--radix-select-content-available-height)] p-1">
            {options.map((option) => (
              <Select.Item
                key={encodeValue(option.value)}
                value={encodeValue(option.value)}
                textValue={option.textValue ?? (typeof option.label === 'string' ? option.label : undefined)}
                disabled={option.disabled}
                className={ITEM_CLASS}
              >
                <Select.ItemText>{option.label}</Select.ItemText>
                <Select.ItemIndicator className="absolute right-2 inline-flex items-center">
                  <Check className="h-3.5 w-3.5 text-app-accent" aria-hidden="true" />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
          <Select.ScrollDownButton className="flex h-5 items-center justify-center text-app-text-muted">
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
          </Select.ScrollDownButton>
        </Select.Content>
      </PopoutSelectPortal> : null}
    </Select.Root>
  );
}
