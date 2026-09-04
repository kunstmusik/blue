export const TYPOGRAPHY_ROLES = [
  'large-title',
  'title-2',
  'title-3',
  'headline',
  'body',
  'callout',
  'subheadline',
] as const;

export type TypographyRoleId = (typeof TYPOGRAPHY_ROLES)[number];

export interface TypographyFontOptions {
  family?: 'proportional' | 'monospace' | string;
  weight?: 'normal' | 'semibold' | 'bold' | number | string;
}

const DEFAULT_PROPORTIONAL_FAMILY =
  "'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const DEFAULT_MONOSPACE_FAMILY =
  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";

/**
 * Resolves a semantic typography role into a valid CSS font string suitable for Canvas 2D context.
 * Reads the role's CSS custom property from the provided element or document root without duplicating metric tables.
 */
export function resolveTypographyRoleFont(
  element: Element | HTMLElement | null | undefined,
  role: TypographyRoleId,
  options?: TypographyFontOptions,
): string {
  if (!TYPOGRAPHY_ROLES.includes(role)) {
    throw new Error(`Unknown typography role: ${String(role)}`);
  }

  const varName = `--text-role-${role}`;
  let fontSize = '';

  if (element && typeof window !== 'undefined') {
    if (element instanceof HTMLElement && element.style.getPropertyValue(varName)) {
      fontSize = element.style.getPropertyValue(varName).trim();
    } else {
      const computed = window.getComputedStyle(element);
      fontSize = computed.getPropertyValue(varName).trim();
    }
  }

  if (!fontSize && typeof document !== 'undefined') {
    const rootComputed = window.getComputedStyle(document.documentElement);
    fontSize = rootComputed.getPropertyValue(varName).trim();
  }

  if (!fontSize) {
    throw new Error(
      `Unable to resolve CSS variable ${varName} for role "${role}". Ensure styles/index.css is loaded.`,
    );
  }

  // Weight resolution
  let weight = options?.weight;
  if (!weight) {
    weight = role === 'headline' ? '700' : '400';
  } else if (weight === 'normal') {
    weight = '400';
  } else if (weight === 'semibold') {
    weight = '600';
  } else if (weight === 'bold') {
    weight = '700';
  }

  // Family resolution
  let family = options?.family;
  if (!family || family === 'proportional') {
    family = DEFAULT_PROPORTIONAL_FAMILY;
  } else if (family === 'monospace') {
    family = DEFAULT_MONOSPACE_FAMILY;
  }

  return `${weight} ${fontSize} ${family}`;
}
