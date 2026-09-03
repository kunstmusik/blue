import {
  type CSSProperties,
  type ReactElement,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useHostDocument } from '../hooks/use-host-document';
import { HostSurfacePortal } from './host-surface/HostSurfacePortal';
import { useHostSurface } from './host-surface/use-host-surface';
import {
  COLOR_PICKER_MARGIN,
  hexToHsl,
  hslToHex,
  normalizeHex,
  type ColorPickerAnchorRect,
} from './color-picker-utils';

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
  /** Element used to resolve the hosting document (and, by default, hit containment). */
  anchorElement?: HTMLElement | null;
  /**
   * Element treated as "inside the picker" for dismissal. Defaults to
   * `anchorElement`. Canvas callers pass the timeline container as
   * `anchorElement` (document resolution) but `null` here — the whole
   * timeline must NOT count as inside the picker.
   */
  anchorHitTarget?: HTMLElement | null;
  onChange: (value: string) => void;
  onClose: () => void;
}

export function ColorPickerPopover({
  open,
  value,
  anchor,
  anchorElement,
  anchorHitTarget,
  onChange,
  onClose,
}: ColorPickerPopoverProps): ReactElement | null {
  const normalizedValue = normalizeHex(value);
  const [draftHex, setDraftHex] = useState(normalizedValue);
  const hsl = hexToHsl(normalizedValue);
  // Floating workbench panels live in a popout document while sharing this
  // renderer context; the popover must render, listen, and dismiss within the
  // document that contains its anchor, not the main window's document. The
  // anchor's own document is authoritative; the panel-provided host document
  // is the fallback. Node/SSR environments have no document: render nothing.
  const contextHostDocument = useHostDocument({ fallbackToGlobal: true });
  const popoverDocument: Document | null = anchorElement?.ownerDocument
    ?? contextHostDocument;

  // Canvas callers pass `anchorHitTarget === null`: the whole timeline must
  // NOT count as inside the picker, so a plain rect anchor positions the
  // popover and every press outside it (canvas included) dismisses. Other
  // callers anchor to their trigger element, whose presses toggle the
  // picker instead of dismissing it.
  const rectAnchor = anchor
    ? {
        type: 'rect' as const,
        getRect: () => ({ left: anchor.left, top: anchor.top, right: anchor.right, bottom: anchor.bottom }),
      }
    : null;
  const surfaceAnchor = open && anchorHitTarget !== null && anchorElement
    ? { type: 'element' as const, element: anchorElement }
    : open && rectAnchor
      ? rectAnchor
      : null;
  const surface = useHostSurface(surfaceAnchor, {
    kind: 'popover',
    gap: COLOR_PICKER_MARGIN,
    align: 'center',
    hostDocument: popoverDocument,
    onDismiss: () => onClose(),
  });

  useEffect(() => setDraftHex(normalizedValue), [normalizedValue]);

  if (!open || !anchor || !popoverDocument) return null;

  const updateHsl = (next: Partial<typeof hsl>): void => {
    onChange(hslToHex(next.h ?? hsl.h, next.s ?? hsl.s, next.l ?? hsl.l));
  };

  return (
    <HostSurfacePortal
      session={surface}
      role="dialog"
      ariaLabel="Color picker"
      className="z-[10000] w-60 rounded-md border border-app-border bg-app-menu p-3 text-role-body text-app-text shadow-xl"
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
    </HostSurfacePortal>
  );
}

interface ColorPickerButtonProps {
  value: string;
  onChange: (value: string) => void;
  onGestureComplete?: (context: { initialValue: string; finalValue: string }) => void;
  ariaLabel: string;
  title?: string;
  className?: string;
  style?: CSSProperties;
}

export default function ColorPickerButton({
  value,
  onChange,
  onGestureComplete,
  ariaLabel,
  title,
  className = 'h-6 w-7 rounded border border-app-border',
  style,
}: ColorPickerButtonProps): ReactElement {
  const triggerRef: RefObject<HTMLButtonElement | null> = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<ColorPickerAnchorRect | null>(null);
  const initialValueRef = useRef<string | null>(null);
  const latestValueRef = useRef<string | null>(null);

  const handleChange = useCallback((nextValue: string) => {
    latestValueRef.current = nextValue;
    onChange(nextValue);
  }, [onChange]);

  const close = useCallback(() => {
    setOpen(false);
    const initial = initialValueRef.current;
    const final = latestValueRef.current ?? value;
    if (onGestureComplete && initial !== null && final !== null && normalizeHex(initial) !== normalizeHex(final)) {
      onGestureComplete({ initialValue: initial, finalValue: final });
    }
  }, [onGestureComplete, value]);

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
          initialValueRef.current = value;
          latestValueRef.current = value;
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
        onChange={handleChange}
        onClose={close}
      />
    </>
  );
}
