import React, { useCallback, useEffect, useRef, useState } from 'react';

interface ValuePanelProps {
  value: string;
  width: number;
  height: number;
  onCommit?: (text: string) => void;
}

export function ValuePanel({ value, width, height, onCommit }: ValuePanelProps): React.ReactElement {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = useCallback(() => {
    if (!onCommit) return;
    setEditText(value);
    setEditing(true);
  }, [onCommit, value]);

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
          className="h-full w-full rounded border border-blue-accent bg-app-bsb-control px-1 text-center font-mono text-[11px] text-app-text outline-none"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
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
      <rect x={0} y={0} width={width} height={height} rx={6} ry={6} fill="rgb(20,29,45)" />
      <text
        x={width / 2}
        y={height / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill="rgb(240,240,255)"
        fontFamily="Roboto, sans-serif"
        fontSize={11}
      >
        {value}
      </text>
    </svg>
  );
}

export function formatValue(v: number): string {
  const s = v.toFixed(4);
  const trimmed = s.replace(/\.?0+$/, '');
  return trimmed === '' ? '0' : trimmed;
}