import React, { useCallback, useEffect, useRef, useState } from 'react';
import { formatBlueNumber } from '@blue/data';

interface ValuePanelProps {
  value: string;
  fullValue?: string;
  width: number;
  height: number;
  onCommit?: (text: string) => void;
}

export const VALUE_DISPLAY_MAX_LENGTH = 6;

export function formatDisplayValue(value: string): string {
  return value.length > VALUE_DISPLAY_MAX_LENGTH
    ? value.substring(0, VALUE_DISPLAY_MAX_LENGTH)
    : value;
}

export function ValuePanel({
  value,
  fullValue = value,
  width,
  height,
  onCommit,
}: ValuePanelProps): React.ReactElement {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = useCallback(() => {
    if (!onCommit) return;
    setEditText(fullValue);
    setEditing(true);
  }, [fullValue, onCommit]);

  const commit = useCallback(() => {
    setEditing(false);
    onCommit?.(editText);
  }, [editText, onCommit]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  if (editing) {
    return (
      <div className="relative shrink-0" style={{ width, height }}>
        <input
          ref={inputRef}
          className="h-full w-full rounded border border-blue-accent bg-app-bsb-control px-1 text-center font-mono text-role-callout text-app-text outline-none"
          title={fullValue}
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') setEditing(false);
          }}
          onBlur={commit}
        />
      </div>
    );
  }

  return (
    <svg
      width={width}
      height={height}
      className="block shrink-0"
      onDoubleClick={startEdit}
      style={{ cursor: onCommit ? 'text' : 'default' }}
    >
      <title>{fullValue}</title>
      <rect x={0} y={0} width={width} height={height} rx={6} ry={6} fill="rgb(20,29,45)" />
      <text
        x={width / 2}
        y={height / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill="rgb(240,240,255)"
        fontFamily="Roboto, sans-serif"
        style={{
          fontSize: 'var(--text-role-callout)',
          lineHeight: 'var(--text-role-callout--line-height)',
        }}
      >
        {value}
      </text>
    </svg>
  );
}

export function formatValue(v: number): string {
  return formatBlueNumber(v);
}
