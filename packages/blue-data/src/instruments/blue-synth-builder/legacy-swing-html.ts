import type { BSBFont } from './bsb-knob';

const LEGACY_HTML_SIZE_RE = /size\s*=\s*['"]([^'"]*)['"]/i;
const LEGACY_HTML_TAG_RE = /<[^>]*?>/g;
const LEGACY_HTML_SIZE_MAP = [8, 10, 12, 14, 18, 24, 36] as const;

export function parseLegacySwingHtmlFont(text: string): BSBFont {
  let sizeIndex = 2;
  const match = LEGACY_HTML_SIZE_RE.exec(text);

  if (match) {
    const rawSize = match[1] ?? '';
    try {
      const parsed = Number.parseInt(rawSize, 10);
      if (!Number.isFinite(parsed)) {
        sizeIndex = 0;
      } else if (rawSize.startsWith('+') || rawSize.startsWith('-')) {
        sizeIndex += parsed + 1;
      } else {
        sizeIndex = parsed - 1;
      }
    } catch {
      sizeIndex = 0;
    }
  }

  sizeIndex = Math.min(Math.max(0, sizeIndex), LEGACY_HTML_SIZE_MAP.length - 1);
  const style = /<b>/i.test(text) || sizeIndex > 2 ? 1 : 0;

  return {
    name: 'Roboto',
    size: LEGACY_HTML_SIZE_MAP[sizeIndex] ?? 12,
    style,
  };
}

export function stripLegacySwingHtml(text: string): string {
  return text.replace(LEGACY_HTML_TAG_RE, '').replace(/&nbsp;/gi, ' ');
}
