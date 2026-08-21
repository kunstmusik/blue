import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';

export interface FontChoice {
  name: string;
  size: number;
  style: number;
}

const STYLE_OPTIONS = [
  { value: 0, label: 'Plain' },
  { value: 1, label: 'Bold' },
  { value: 2, label: 'Italic' },
  { value: 3, label: 'Bold Italic' },
];

let cachedFontFamilies: string[] | null = null;

async function getSystemFontFamilies(): Promise<string[]> {
  if (cachedFontFamilies) return cachedFontFamilies;
  try {
    if (typeof window !== 'undefined' && typeof window.queryLocalFonts === 'function') {
      const fonts = await window.queryLocalFonts();
      const families = [...new Set(fonts.map(f => f.family))];
      const sorted = families.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
      if (!sorted.includes('Roboto')) {
        sorted.unshift('Roboto');
      }
      cachedFontFamilies = sorted;
      return cachedFontFamilies;
    }
  } catch { /* fallback below */ }
  return ['Roboto', 'Arial', 'Arial Black', 'Comic Sans MS', 'Courier New', 'Georgia',
    'Impact', 'Lucida Console', 'Palatino Linotype', 'Segoe UI',
    'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana', 'Helvetica',
    'Monaco', 'Menlo', 'SF Mono'];
}

interface FontChooserDialogProps {
  open: boolean;
  font: FontChoice;
  onConfirm: (font: FontChoice) => void;
  onCancel: () => void;
}

export default function FontChooserDialog({
  open,
  font,
  onConfirm,
  onCancel,
}: FontChooserDialogProps): React.ReactElement | null {
  const [name, setName] = useState(font.name);
  const [size, setSize] = useState(font.size);
  const [style, setStyle] = useState(font.style);
  const [fontFamilies, setFontFamilies] = useState<string[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setName(font.name);
      setSize(font.size);
      setStyle(font.style);
      setFilter('');
      setDropdownOpen(false);
      getSystemFontFamilies().then(setFontFamilies);
    }
  }, [open, font.name, font.size, font.style]);

  const handleConfirm = useCallback(() => {
    onConfirm({ name: name.trim() || 'Roboto', size: Math.max(1, Math.round(size)), style });
  }, [name, size, style, onConfirm]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onCancel();
    }
    if (e.key === 'Enter') {
      e.stopPropagation();
      handleConfirm();
    }
  }, [onCancel, handleConfirm]);

  if (!open) return null;

  const fontWeight = style === 1 || style === 3 ? 'bold' : 'normal';
  const fontStyleStr = style === 2 || style === 3 ? 'italic' : 'normal';
  const displayStyle = STYLE_OPTIONS.find(s => s.value === style)?.label ?? 'Plain';

  const filtered = filter
    ? fontFamilies.filter(f => f.toLowerCase().includes(filter.toLowerCase()))
    : fontFamilies;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onKeyDown={handleKeyDown}
      onClick={(e) => { if (e.target === overlayRef.current) onCancel(); }}
    >
      <div
        className="flex w-[420px] flex-col gap-4 rounded-lg border border-app-border bg-app-surface p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-role-title-2 font-bold text-app-text-strong">Choose Font</div>

        <div className="grid grid-cols-[1fr_80px_100px] gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-role-body uppercase tracking-wider text-app-text-muted">Font</label>
            <div className="relative">
              <button
                className="flex w-full items-center justify-between rounded border border-app-border bg-app-surface-raised px-2 py-1.5 text-left text-role-body text-app-text-strong outline-none hover:border-app-accent focus:border-app-accent"
                onClick={() => { setDropdownOpen(!dropdownOpen); setFilter(''); }}
              >
                <span className="truncate" style={{ fontFamily: `'${name}', sans-serif` }}>{name}</span>
                <ChevronDown className="ml-1 h-3.5 w-3.5 text-app-text-muted" />
              </button>
              {dropdownOpen && (
                <div className="absolute left-0 top-full z-10 mt-1 flex max-h-48 w-full flex-col rounded border border-app-border bg-app-surface-raised shadow-lg">
                  <input
                    className="border-b border-app-border bg-transparent px-2 py-1 text-role-body text-app-text-strong outline-none placeholder:text-app-text-muted"
                    placeholder="Filter fonts..."
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (filtered.length > 0) {
                          setName(filtered[0]);
                          setDropdownOpen(false);
                        }
                      }
                      if (e.key === 'Escape') {
                        e.stopPropagation();
                        setDropdownOpen(false);
                      }
                    }}
                    autoFocus
                  />
                  <div ref={listRef} className="max-h-36 overflow-y-auto overscroll-contain">
                    {filtered.map(f => (
                      <button
                        key={f}
                        className={
                          'w-full px-2 py-1 text-left text-role-body outline-none ' +
                          (f === name
                            ? 'bg-app-accent/30 text-app-text-strong'
                            : 'text-app-text-strong hover:bg-app-accent/20')
                        }
                        style={{ fontFamily: `'${f}', sans-serif` }}
                        onClick={() => { setName(f); setDropdownOpen(false); }}
                      >
                        {f}
                      </button>
                    ))}
                    {filtered.length === 0 && (
                      <div className="px-2 py-2 text-role-body text-app-text-muted">No matching fonts</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-role-body uppercase tracking-wider text-app-text-muted">Size</label>
            <input
              className="w-full rounded border border-app-border bg-app-surface-raised px-2 py-1.5 text-role-body text-app-text-strong outline-none focus:border-app-accent"
              type="number"
              min={1}
              max={200}
              value={size}
              onChange={(e) => setSize(e.target.value === '' ? 12 : parseFloat(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); handleConfirm(); }
                if (e.key === 'Escape') { e.stopPropagation(); onCancel(); }
              }}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-role-body uppercase tracking-wider text-app-text-muted">Style</label>
            <select
              className="w-full rounded border border-app-border bg-app-surface-raised px-2 py-1.5 text-role-body text-app-text-strong outline-none focus:border-app-accent"
              value={style}
              onChange={(e) => setStyle(parseInt(e.target.value, 10))}
            >
              {STYLE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-role-body uppercase tracking-wider text-app-text-muted">Preview</label>
          <div
            className="flex h-16 items-center justify-center rounded border border-app-border bg-app-surface-raised"
            style={{ fontFamily: `'${name}', sans-serif`, fontSize: `${size}px`, fontWeight, fontStyle: fontStyleStr }}
          >
            <span className="text-app-text-strong">Aa Bb Cc 123</span>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-app-border pt-3">
          <span className="text-role-callout text-app-text-muted">
            {name} {size} {displayStyle}
          </span>
          <div className="flex gap-2">
            <button
              className="rounded border border-app-border bg-app-surface px-3 py-1 text-role-body text-app-text transition-colors hover:bg-app-hover"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              className="rounded bg-app-accent px-3 py-1 text-role-body text-app-text-strong hover:bg-app-accent-hover"
              onClick={handleConfirm}
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
