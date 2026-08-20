import React, { useCallback, useEffect, useRef, useState } from 'react';

const INPUT_CLASS = 'w-20 rounded border border-blue-border bg-blue-bg px-1.5 py-0.5 text-role-body text-gray-100 focus:border-blue-accent focus:outline-none';

export default function CommitNumberInput({
  value,
  step = 0.1,
  min,
  max,
  className,
  onChange,
  onClick,
}: {
  value: number;
  step?: number;
  min?: number;
  max?: number;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLInputElement>;
  onChange: (v: number) => void;
}): React.ReactElement {
  const stringVal = String(value);
  const [localValue, setLocalValue] = useState(stringVal);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!focused) {
      setLocalValue(stringVal);
    }
  }, [stringVal, focused]);

  const commit = useCallback(() => {
    if (localValue === stringVal) return;
    const num = parseFloat(localValue);
    if (isNaN(num)) {
      setLocalValue(stringVal);
      return;
    }
    let accepted = num;
    if (min !== undefined && accepted < min) accepted = min;
    if (max !== undefined && accepted > max) accepted = max;
    if (accepted === value) {
      setLocalValue(String(accepted));
      return;
    }
    onChange(accepted);
  }, [localValue, stringVal, value, min, max, onChange]);

  return (
    <input
      ref={inputRef}
      type="number"
      step={step}
      min={min}
      max={max}
      className={`${INPUT_CLASS}${className ? ` ${className}` : ''}`}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => { setFocused(false); commit(); }}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
          inputRef.current?.blur();
        }
        if (e.key === 'Escape') {
          setLocalValue(stringVal);
          inputRef.current?.blur();
        }
      }}
    />
  );
}

export function CommitNumberField({
  label,
  value,
  step = 0.1,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
}): React.ReactElement {
  return (
    <div className="flex items-center gap-2">
      <label className="shrink-0 text-role-body text-gray-300">{label}</label>
      <CommitNumberInput value={value} step={step} min={min} max={max} onChange={onChange} />
    </div>
  );
}
