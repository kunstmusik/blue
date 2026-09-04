const SWING_HTML_PREFIX_RE = /^\s*<html(?:\s|>)/i;
const OUTER_HTML_OPEN_RE = /^\s*<html[^>]*>/i;
const OUTER_HTML_CLOSE_RE = /<\/html>\s*$/i;
const BREAK_TAG_RE = /<(?:br\b[^>]*\/?|\/?p\b[^>]*|\/?div\b[^>]*|\/?center\b[^>]*)>/gi;
const TAG_RE = /<[^>]+>/g;
const FONT_SIZE_RE = /<font\b[^>]*\bsize\s*=\s*(['"]?)([^'"\s>]+)\1[^>]*>/gi;
const SWING_HTML_DEFAULT_BASE_FONT_SIZE = 4;
const SWING_HTML_FONT_SIZE_BUCKETS = [8, 10, 12, 14, 18, 24, 36] as const;

export function isBsbSwingHtmlText(text: string): boolean {
  return SWING_HTML_PREFIX_RE.test(text);
}

export function stripBsbSwingHtmlText(text: string): string {
  if (!text) return '';
  if (!isBsbSwingHtmlText(text)) {
    return decodeBsbHtmlEntities(text);
  }

  const withoutOuterHtml = text.replace(OUTER_HTML_OPEN_RE, '').replace(OUTER_HTML_CLOSE_RE, '');

  return decodeBsbHtmlEntities(withoutOuterHtml.replace(BREAK_TAG_RE, '\n').replace(TAG_RE, ''))
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();
}

export function resolveBsbSwingHtmlFontSizePx(rawSize: string): number | null {
  const slot = resolveSwingFontSizeSlot(rawSize);
  return slot === null ? null : swingFontSizeSlotToPx(slot);
}

export function getBsbSwingHtmlMaxFontSizePx(text: string, inheritedFontSize = 12): number {
  if (!isBsbSwingHtmlText(text)) {
    return inheritedFontSize;
  }

  let maxFontSize = inheritedFontSize;
  for (const match of text.matchAll(FONT_SIZE_RE)) {
    const rawSize = match[2];
    if (!rawSize) continue;
    const fontSizePx = resolveBsbSwingHtmlFontSizePx(rawSize);
    if (fontSizePx !== null) {
      maxFontSize = Math.max(maxFontSize, fontSizePx);
    }
  }

  return maxFontSize;
}

function resolveSwingFontSizeSlot(rawSize: string): number | null {
  const trimmed = rawSize.trim();
  if (/^[+-]\d+$/.test(trimmed)) {
    return normalizeSwingFontSizeSlot(
      SWING_HTML_DEFAULT_BASE_FONT_SIZE + Number.parseInt(trimmed, 10),
    );
  }
  if (/^\d+$/.test(trimmed)) {
    return normalizeSwingFontSizeSlot(Number.parseInt(trimmed, 10));
  }
  return null;
}

function normalizeSwingFontSizeSlot(size: number): number {
  return Math.max(1, Math.min(7, size));
}

function swingFontSizeSlotToPx(slot: number): number {
  return (
    SWING_HTML_FONT_SIZE_BUCKETS[normalizeSwingFontSizeSlot(slot) - 1] ??
    SWING_HTML_FONT_SIZE_BUCKETS[2]
  );
}

function decodeBsbHtmlEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_match, entity: string) => {
    const normalized = entity.toLowerCase();
    switch (normalized) {
      case 'amp':
        return '&';
      case 'lt':
        return '<';
      case 'gt':
        return '>';
      case 'quot':
        return '"';
      case 'apos':
      case '#39':
        return "'";
      case 'nbsp':
        return ' ';
      default:
        break;
    }

    if (normalized.startsWith('#x')) {
      const codePoint = Number.parseInt(normalized.slice(2), 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : `&${entity};`;
    }

    if (normalized.startsWith('#')) {
      const codePoint = Number.parseInt(normalized.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : `&${entity};`;
    }

    return `&${entity};`;
  });
}
