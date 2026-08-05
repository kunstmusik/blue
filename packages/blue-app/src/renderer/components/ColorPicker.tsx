import {
  type CSSProperties,
  type ReactElement,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useDocumentMouseDownOutside } from '../hooks/use-document-mousedown-outside';
import {
  COLOR_PICKER_MARGIN,
  COLOR_PICKER_SIZE,
  computeColorPickerPosition,
  hexToHsl,
  hslToHex,
  normalizeHex,
  type ColorPickerAnchorRect,
  type ColorPickerPosition,
} from './color-picker-utils';

export { computeColorPickerPosition } from './color-picker-utils';
export type { ColorPickerAnchorRect } from './color-picker-utils';

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6',
  '#8b5cf6', '#ec4899', '#ffffff', '#94a3b8', '#475569', '#111827',
];

function PresetPalette({ onChange }: { onChange: (value: string) => void }): ReactElement {
  return (
    <div className="mb-3 grid grid-cols-6 gap-1.5">
      {PRESET_COLORS.map((preset) => (
        <button
          key={preset}
          type="button"
          aria-label={`Set color ${preset}`}
          className="h-5 rounded border border-app-border hover:ring-1 hover:ring-app-accent"
          style={{ backgroundColor: preset }}
          onClick={() => onChange(preset)}
        />
      ))}
    </div>
  );
}

function ColorSlider({
  label,
  value,
  maximum,
  onChange,
  last = false,
}: {
  label: string;
  value: number;
  maximum: number;
  onChange: (value: number) => void;
  last?: boolean;
}): ReactElement {
  return (
    <label className={`${last ? 'mb-3' : 'mb-2'} grid grid-cols-[54px_1fr_34px] items-center gap-2`}>
      <span>{label}</span>
      <input
        aria-label={label}
        type="range"
        min={0}
        max={maximum}
        value={value}
        className="w-full accent-app-accent"
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="text-right tabular-nums text-app-text-muted">{value}</span>
    </label>
  );
}

interface ColorPickerPopoverProps {
  open: boolean;
  value: string;
  anchor: ColorPickerAnchorRect | null;
  anchorElement?: HTMLElement | null;
  onChange: (value: string) => void;
  onClose: () => void;
}

export function ColorPickerPopover({
  open,
  value,
  anchor,
  anchorElement,
  onChange,
  onClose,
}: ColorPickerPopoverProps): ReactElement | null {
  const popoverRef = useRef<HTMLDivElement>(null);
  const normalizedValue = normalizeHex(value);
  const [draftHex, setDraftHex] = useState(normalizedValue);
  const [position, setPosition] = useState<ColorPickerPosition>(() => ({
    left: COLOR_PICKER_MARGIN,
    top: COLOR_PICKER_MARGIN,
    placement: 'bottom',
  }));
  const hsl = hexToHsl(normalizedValue);

  useEffect(() => setDraftHex(normalizedValue), [normalizedValue]);

  useLayoutEffect(() => {
    if (!open || !anchor) return;
    const bounds = popoverRef.current?.getBoundingClientRect();
    setPosition(computeColorPickerPosition(
      anchor,
      {
        width: bounds && bounds.width > 0 ? bounds.width : COLOR_PICKER_SIZE.width,
        height: bounds && bounds.height > 0 ? bounds.height : COLOR_PICKER_SIZE.height,
      },
      { width: window.innerWidth, height: window.innerHeight },
    ));
  }, [anchor, open]);

  const isInside = useCallback((target: EventTarget | null) => (
    target instanceof Node
      && (popoverRef.current?.contains(target) === true || anchorElement?.contains(target) === true)
  ), [anchorElement]);
  useDocumentMouseDownOutside({ enabled: open, isInside, onMouseDownOutside: onClose });

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  if (!open || !anchor) return null;

  const updateHsl = (next: Partial<typeof hsl>): void => {
    onChange(hslToHex(next.h ?? hsl.h, next.s ?? hsl.s, next.l ?? hsl.l));
  };

  return createPortal(
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="Color picker"
      data-placement={position.placement}
      className="fixed z-[10000] w-60 rounded-md border border-app-border bg-app-menu p-3 text-tiny text-app-text shadow-xl"
      style={{ left: position.left, top: position.top }}
    >
      <div className="mb-3 h-9 rounded border border-app-border" style={{ backgroundColor: normalizedValue }} />
      <PresetPalette onChange={onChange} />
      <ColorSlider label="Hue" value={hsl.h} maximum={359} onChange={(h) => updateHsl({ h })} />
      <ColorSlider label="Saturation" value={hsl.s} maximum={100} onChange={(s) => updateHsl({ s })} />
      <ColorSlider label="Lightness" value={hsl.l} maximum={100} onChange={(l) => updateHsl({ l })} last />
      <label className="flex items-center gap-2">
        <span>Hex</span>
        <input
          aria-label="Hex color"
          value={draftHex}
          maxLength={7}
          spellCheck={false}
          className="min-w-0 flex-1 rounded border border-app-border bg-app-input px-2 py-1 font-mono text-app-text outline-none focus:border-app-accent"
          onInput={(event) => {
            const next = event.currentTarget.value.toLowerCase();
            setDraftHex(next);
            if (/^#[0-9a-f]{6}$/.test(next)) onChange(next);
          }}
          onBlur={() => setDraftHex(normalizedValue)}
        />
      </label>
    </div>,
    document.body,
  );
}

interface ColorPickerButtonProps {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  title?: string;
  className?: string;
  style?: CSSProperties;
}

export default function ColorPickerButton({
  value,
  onChange,
  ariaLabel,
  title,
  className = 'h-6 w-7 rounded border border-app-border',
  style,
}: ColorPickerButtonProps): ReactElement {
  const triggerRef: RefObject<HTMLButtonElement | null> = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<ColorPickerAnchorRect | null>(null);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={title}
        className={`cursor-pointer ${className}`}
        style={{ backgroundColor: normalizeHex(value), ...style }}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          if (open) {
            return;
          }
          const rect = event.currentTarget.getBoundingClientRect();
          setAnchor({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom });
          setOpen(true);
        }}
      />
      <ColorPickerPopover
        open={open}
        value={value}
        anchor={anchor}
        anchorElement={triggerRef.current}
        onChange={onChange}
        onClose={close}
      />
    </>
  );
}
