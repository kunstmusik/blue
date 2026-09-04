type RgbaColor = {
  r: number;
  g: number;
  b: number;
  a: number;
};

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function componentToHex(value: number): string {
  return clampByte(value).toString(16).padStart(2, '0');
}

function parseHexColor(raw: string): RgbaColor | null {
  const hex = raw.trim().replace(/^0x/i, '').replace(/^#/, '');
  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    return {
      r: parseInt(hex.substring(0, 2), 16),
      g: parseInt(hex.substring(2, 4), 16),
      b: parseInt(hex.substring(4, 6), 16),
      a: 255,
    };
  }

  if (/^[0-9a-fA-F]{8}$/.test(hex)) {
    return {
      r: parseInt(hex.substring(0, 2), 16),
      g: parseInt(hex.substring(2, 4), 16),
      b: parseInt(hex.substring(4, 6), 16),
      a: parseInt(hex.substring(6, 8), 16),
    };
  }

  return null;
}

function parseCssColor(raw: string): RgbaColor | null {
  const trimmed = raw.trim();
  const rgbaMatch = trimmed.match(/^rgba?\((.+)\)$/i);
  if (!rgbaMatch) {
    return null;
  }

  const parts = rgbaMatch[1]!.split(',').map((part) => part.trim());
  if (parts.length < 3) {
    return null;
  }

  const r = Number.parseFloat(parts[0]!);
  const g = Number.parseFloat(parts[1]!);
  const b = Number.parseFloat(parts[2]!);
  const a = parts.length >= 4 ? Number.parseFloat(parts[3]!) : 1;

  if (![r, g, b, a].every((value) => Number.isFinite(value))) {
    return null;
  }

  return {
    r: clampByte(r),
    g: clampByte(g),
    b: clampByte(b),
    a: clampByte(a <= 1 ? a * 255 : a),
  };
}

function parseColor(raw: string | number | undefined): RgbaColor | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const value = raw >>> 0;
    return {
      r: (value >>> 16) & 0xff,
      g: (value >>> 8) & 0xff,
      b: value & 0xff,
      a: (value >>> 24) & 0xff,
    };
  }

  if (typeof raw !== 'string') {
    return null;
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  if (/^-?\d+$/.test(trimmed)) {
    const value = Number.parseInt(trimmed, 10) >>> 0;
    return {
      r: (value >>> 16) & 0xff,
      g: (value >>> 8) & 0xff,
      b: value & 0xff,
      a: (value >>> 24) & 0xff,
    };
  }

  return parseHexColor(trimmed) ?? parseCssColor(trimmed);
}

function rgbaToCss(color: RgbaColor): string {
  const a = color.a / 255;
  if (Math.abs(a - 1) < 0.0001) {
    return `#${componentToHex(color.r).toUpperCase()}${componentToHex(color.g).toUpperCase()}${componentToHex(color.b).toUpperCase()}`;
  }

  return `rgba(${clampByte(color.r)},${clampByte(color.g)},${clampByte(color.b)},${Number(a.toFixed(2))})`;
}

export function decodeBsbColorToCss(
  raw: string | number | undefined,
  fallback = '#808080',
): string {
  const parsed = parseColor(raw);
  return parsed ? rgbaToCss(parsed) : fallback;
}

export function encodeCssColorToJavaHex(color: string, fallback = '0x808080ff'): string {
  const parsed = parseColor(color);
  if (!parsed) {
    return fallback;
  }

  return `0x${componentToHex(parsed.r)}${componentToHex(parsed.g)}${componentToHex(parsed.b)}${componentToHex(parsed.a)}`;
}

export function encodeCssColorToJavaInt(color: string, fallback = '-8355712'): string {
  const parsed = parseColor(color);
  if (!parsed) {
    return fallback;
  }

  const unsigned =
    (((clampByte(parsed.a) << 24) >>> 0) |
      (clampByte(parsed.r) << 16) |
      (clampByte(parsed.g) << 8) |
      clampByte(parsed.b)) >>>
    0;
  return unsigned > 0x7fffffff ? String(unsigned - 0x100000000) : String(unsigned);
}
