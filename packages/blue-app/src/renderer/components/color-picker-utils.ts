export interface ColorPickerAnchorRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface ColorPickerPosition {
  left: number;
  top: number;
  placement: 'top' | 'bottom';
}

export interface ColorPickerSize {
  width: number;
  height: number;
}

export const COLOR_PICKER_SIZE: ColorPickerSize = { width: 240, height: 260 };
export const COLOR_PICKER_MARGIN = 8;
const ANCHOR_GAP = 8;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

export function computeColorPickerPosition(
  anchor: ColorPickerAnchorRect,
  popup: ColorPickerSize,
  viewport: ColorPickerSize,
): ColorPickerPosition {
  const availableBelow = viewport.height - anchor.bottom - ANCHOR_GAP - COLOR_PICKER_MARGIN;
  const availableAbove = anchor.top - ANCHOR_GAP - COLOR_PICKER_MARGIN;
  const placement = availableBelow >= popup.height || availableBelow >= availableAbove
    ? 'bottom'
    : 'top';
  const requestedTop = placement === 'bottom'
    ? anchor.bottom + ANCHOR_GAP
    : anchor.top - ANCHOR_GAP - popup.height;
  const requestedLeft = (anchor.left + anchor.right - popup.width) / 2;

  return {
    left: clamp(requestedLeft, COLOR_PICKER_MARGIN, viewport.width - popup.width - COLOR_PICKER_MARGIN),
    top: clamp(requestedTop, COLOR_PICKER_MARGIN, viewport.height - popup.height - COLOR_PICKER_MARGIN),
    placement,
  };
}

export function normalizeHex(value: string): string {
  const normalized = value.trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(normalized) ? normalized : '#000000';
}

export function hexToHsl(value: string): { h: number; s: number; l: number } {
  const hex = normalizeHex(value);
  const r = Number.parseInt(hex.slice(1, 3), 16) / 255;
  const g = Number.parseInt(hex.slice(3, 5), 16) / 255;
  const b = Number.parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const l = (max + min) / 2;
  let h = 0;

  if (delta > 0) {
    if (max === r) h = 60 * (((g - b) / delta) % 6);
    else if (max === g) h = 60 * (((b - r) / delta) + 2);
    else h = 60 * (((r - g) / delta) + 4);
  }

  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  return { h: Math.round((h + 360) % 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function hslToHex(h: number, s: number, l: number): string {
  const saturation = s / 100;
  const lightness = l / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const segment = h / 60;
  const x = chroma * (1 - Math.abs((segment % 2) - 1));
  const m = lightness - chroma / 2;
  const colors: Array<[number, number, number]> = [
    [chroma, x, 0], [x, chroma, 0], [0, chroma, x],
    [0, x, chroma], [x, 0, chroma], [chroma, 0, x],
  ];
  const rgb = colors[Math.min(5, Math.floor(segment))]!;

  return `#${rgb.map((channel) => Math.round((channel + m) * 255)
    .toString(16).padStart(2, '0')).join('')}`;
}
