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
import { getFloatingViewport } from './floating-position-utils';

export { computeColorPickerPosition } from './color-picker-utils';
export type { ColorPickerAnchorRect } from './color-picker-utils';

/**
 * Cross-realm Node check. Portal children are created by the container's own
 * document, and Dockview popout documents use a different JS realm from this
 * module, so `instanceof Node` fails for exactly the nodes this component must
 * recognize. Structural duck-typing works across realms.
 */
function isNodeLike(target: EventTarget | null): target is Node {
  return target != null
    && typeof (target as Node).nodeType === 'number'
    && typeof (target as Node).contains === 'function';
}

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
  // Floating workbench panels live in a popout document while sharing this
  // renderer context; the popover must render, listen, and dismiss within the
  // document that contains its anchor, not the main window's document. Node
  // SSR environments have no document; the popover renders nothing there.
  const popoverDocument: Document | null = anchorElement?.ownerDocument
    ?? (typeof document === 'undefined' ? null : document);

  useEffect(() => setDraftHex(normalizedValue), [normalizedValue]);

  useLayoutEffect(() => {
    if (!open || !anchor || !popoverDocument) return;
    const bounds = popoverRef.current?.getBoundingClientRect();
    const viewport = anchorElement
      ? getFloatingViewport(anchorElement)
      : {
          width: popoverDocument.defaultView?.innerWidth ?? COLOR_PICKER_SIZE.width,
          height: popoverDocument.defaultView?.innerHeight ?? COLOR_PICKER_SIZE.height,
        };
    setPosition(computeColorPickerPosition(
      anchor,
      {
        width: bounds && bounds.width > 0 ? bounds.width : COLOR_PICKER_SIZE.width,
        height: bounds && bounds.height > 0 ? bounds.height : COLOR_PICKER_SIZE.height,
      },
      viewport,
    ));
  }, [anchor, anchorElement, open, popoverDocument]);

  // Containment must not use `instanceof Node`: portal children are created by
  // the anchor's own document, whose realm differs from this module's in
  // floating workbench popouts, so cross-realm nodes fail that check and any
  // mousedown inside the popover would be misread as an outside dismissal.
  const isInside = useCallback((target: EventTarget | null) => (
    isNodeLike(target)
      && (popoverRef.current?.contains(target) === true || anchorElement?.contains(target) === true)
  ), [anchorElement]);
  useDocumentMouseDownOutside({ enabled: open, isInside, onMouseDownOutside: onClose, targetDocument: popoverDocument });

  useEffect(() => {
    if (!open || !popoverDocument) return;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    popoverDocument.addEventListener('keydown', handleKeyDown);
    return () => popoverDocument.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open, popoverDocument]);

  if (!open || !anchor || !popoverDocument) return null;

  const updateHsl = (next: Partial<typeof hsl>): void => {
    onChange(hslToHex(next.h ?? hsl.h, next.s ?? hsl.s, next.l ?? hsl.l));
  };

  return createPortal(
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="Color picker"
      data-placement={position.placement}
      className="fixed z-[10000] w-60 rounded-md border border-app-border bg-app-menu p-3 text-role-body text-app-text shadow-xl"
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
    popoverDocument.body,
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
