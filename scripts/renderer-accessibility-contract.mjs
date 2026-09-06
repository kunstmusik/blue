/**
 * Machine-readable accessibility contract for Blue Electron renderer surfaces.
 * Governs semantic color roles, WCAG 2.2 AA contrast floors, directional pairs,
 * focus indicators, and exception schemas.
 */

export const CONTRAST_FLOORS = Object.freeze({
  normalText: 4.5,
  largeText: 3.0,
  nonText: 3.0,
  targetHeadroomNormal: 4.75,
  targetHeadroomNonText: 3.25,
});

export const SEMANTIC_COLOR_ROLES = Object.freeze({
  'app-bg': {
    name: 'app-bg',
    purpose: 'surface',
    category: 'surface',
    description: 'Primary window background',
    ownership: 'application-owned',
  },
  'app-surface': {
    name: 'app-surface',
    purpose: 'surface',
    category: 'surface',
    description: 'Standard panel and card surface',
    ownership: 'application-owned',
  },
  'app-surface-raised': {
    name: 'app-surface-raised',
    purpose: 'surface',
    category: 'surface',
    description: 'Elevated panel, toolbar, or dropdown surface',
    ownership: 'application-owned',
  },
  'app-surface-strong': {
    name: 'app-surface-strong',
    purpose: 'surface',
    category: 'surface',
    description: 'Recessed or strongly contrasted panel surface',
    ownership: 'application-owned',
  },
  'app-surface-subtle': {
    name: 'app-surface-subtle',
    purpose: 'surface',
    category: 'surface',
    description: 'Subtle section or card surface',
    ownership: 'application-owned',
  },
  'app-canvas': {
    name: 'app-canvas',
    purpose: 'surface',
    category: 'surface',
    description: 'Editor, tracker, and visualization canvas background',
    ownership: 'application-owned',
  },
  'app-input': {
    name: 'app-input',
    purpose: 'surface',
    category: 'input',
    description: 'Text and numeric input background',
    ownership: 'application-owned',
  },
  'app-field': {
    name: 'app-field',
    purpose: 'surface',
    category: 'input',
    description: 'Dialog field and table cell input background',
    ownership: 'application-owned',
  },
  'app-menu': {
    name: 'app-menu',
    purpose: 'surface',
    category: 'surface',
    description: 'Context and dropdown menu container',
    ownership: 'application-owned',
  },
  'app-hover': {
    name: 'app-hover',
    purpose: 'surface',
    category: 'state',
    description: 'Interactive hover background',
    ownership: 'application-owned',
  },
  'app-border': {
    name: 'app-border',
    purpose: 'structural-boundary',
    category: 'boundary',
    description: 'Quiet structural and non-essential control boundary',
    ownership: 'application-owned',
  },
  'app-border-muted': {
    name: 'app-border-muted',
    purpose: 'control-boundary',
    category: 'boundary',
    description: 'Subtle/decorative border',
    ownership: 'application-owned',
  },
  'app-border-strong': {
    name: 'app-border-strong',
    purpose: 'control-boundary',
    category: 'boundary',
    description: 'High-contrast boundary for focused or active containers',
    ownership: 'application-owned',
  },
  'app-text': {
    name: 'app-text',
    purpose: 'text',
    category: 'text',
    description: 'Default body and label text',
    ownership: 'application-owned',
  },
  'app-text-strong': {
    name: 'app-text-strong',
    purpose: 'text',
    category: 'text',
    description: 'Emphasized headlines, active tabs, and primary titles',
    ownership: 'application-owned',
  },
  'app-text-soft': {
    name: 'app-text-soft',
    purpose: 'text',
    category: 'text',
    description: 'Secondary soft text for descriptions and hints',
    ownership: 'application-owned',
  },
  'app-text-muted': {
    name: 'app-text-muted',
    purpose: 'text',
    category: 'text',
    description: 'Muted secondary text, hints, and placeholder content',
    ownership: 'application-owned',
  },
  'app-text-subtle': {
    name: 'app-text-subtle',
    purpose: 'text',
    category: 'text',
    description: 'Subtle captions, timestamps, and metadata',
    ownership: 'application-owned',
  },
  'app-accent': {
    name: 'app-accent',
    purpose: 'accent-fill',
    category: 'accent',
    description: 'Primary accent color for active items, buttons, and selections',
    ownership: 'application-owned',
  },
  'app-accent-hover': {
    name: 'app-accent-hover',
    purpose: 'accent-fill',
    category: 'accent',
    description: 'Hover state for primary accent controls',
    ownership: 'application-owned',
  },
  'app-accent-foreground': {
    name: 'app-accent-foreground',
    purpose: 'on-fill-foreground',
    category: 'text',
    description: 'Text/icon foreground on app-accent fill',
    ownership: 'application-owned',
  },
  'app-warning': {
    name: 'app-warning',
    purpose: 'status',
    category: 'status',
    description: 'Warning status, solo state fill/text',
    ownership: 'application-owned',
  },
  'app-warning-foreground': {
    name: 'app-warning-foreground',
    purpose: 'on-fill-foreground',
    category: 'text',
    description: 'Text/icon foreground on app-warning fill (e.g. Solo active badge)',
    ownership: 'application-owned',
  },
  'app-success': {
    name: 'app-success',
    purpose: 'status',
    category: 'status',
    description: 'Success status, mute state fill/text',
    ownership: 'application-owned',
  },
  'app-success-foreground': {
    name: 'app-success-foreground',
    purpose: 'on-fill-foreground',
    category: 'text',
    description: 'Text/icon foreground on app-success fill (e.g. Mute active badge)',
    ownership: 'application-owned',
  },
  'app-danger': {
    name: 'app-danger',
    purpose: 'status',
    category: 'status',
    description: 'Danger/destructive fill or text',
    ownership: 'application-owned',
  },
  'app-danger-foreground': {
    name: 'app-danger-foreground',
    purpose: 'on-fill-foreground',
    category: 'text',
    description: 'Text/icon foreground on app-danger fill',
    ownership: 'application-owned',
  },
  'app-error': {
    name: 'app-error',
    purpose: 'status',
    category: 'status',
    description: 'Error status text and indicator fill',
    ownership: 'application-owned',
  },
  'app-focus': {
    name: 'app-focus',
    purpose: 'focus',
    category: 'focus',
    description: 'Author-supplied focus indicator ring/border',
    ownership: 'application-owned',
  },
  'app-bsb-control': {
    name: 'app-bsb-control',
    purpose: 'surface',
    category: 'bsb',
    description: 'Standard BSB widget control chrome background',
    ownership: 'application-owned',
  },
});

export const GOVERNED_CONTRAST_PAIRS = Object.freeze([
  // Text on standard surfaces
  {
    id: 'text-on-bg',
    foregroundToken: 'app-text',
    backgroundToken: 'app-bg',
    usage: 'normal-text',
    minRatio: CONTRAST_FLOORS.normalText,
    targetRatio: CONTRAST_FLOORS.targetHeadroomNormal,
    representativeSurfaces: ['Main window background', 'Settings section background'],
  },
  {
    id: 'text-on-surface',
    foregroundToken: 'app-text',
    backgroundToken: 'app-surface',
    usage: 'normal-text',
    minRatio: CONTRAST_FLOORS.normalText,
    targetRatio: CONTRAST_FLOORS.targetHeadroomNormal,
    representativeSurfaces: ['Workbench panels', 'Dialog cards'],
  },
  {
    id: 'text-on-surface-raised',
    foregroundToken: 'app-text',
    backgroundToken: 'app-surface-raised',
    usage: 'normal-text',
    minRatio: CONTRAST_FLOORS.normalText,
    targetRatio: CONTRAST_FLOORS.targetHeadroomNormal,
    representativeSurfaces: ['Toolbar containers', 'Dropdown containers'],
  },
  {
    id: 'text-on-input',
    foregroundToken: 'app-text',
    backgroundToken: 'app-input',
    usage: 'normal-text',
    minRatio: CONTRAST_FLOORS.normalText,
    targetRatio: CONTRAST_FLOORS.targetHeadroomNormal,
    representativeSurfaces: ['Text input', 'CommitNumberInput', 'Settings fields'],
  },
  {
    id: 'text-strong-on-bg',
    foregroundToken: 'app-text-strong',
    backgroundToken: 'app-bg',
    usage: 'normal-text',
    minRatio: CONTRAST_FLOORS.normalText,
    targetRatio: CONTRAST_FLOORS.targetHeadroomNormal,
    representativeSurfaces: ['Primary titles', 'Window headers'],
  },
  {
    id: 'text-strong-on-surface',
    foregroundToken: 'app-text-strong',
    backgroundToken: 'app-surface',
    usage: 'normal-text',
    minRatio: CONTRAST_FLOORS.normalText,
    targetRatio: CONTRAST_FLOORS.targetHeadroomNormal,
    representativeSurfaces: ['Dialog headers', 'Panel titles'],
  },
  {
    id: 'text-muted-on-bg',
    foregroundToken: 'app-text-muted',
    backgroundToken: 'app-bg',
    usage: 'normal-text',
    minRatio: CONTRAST_FLOORS.normalText,
    targetRatio: CONTRAST_FLOORS.targetHeadroomNormal,
    representativeSurfaces: ['Secondary labels', 'Descriptions on background'],
  },
  {
    id: 'text-muted-on-surface',
    foregroundToken: 'app-text-muted',
    backgroundToken: 'app-surface',
    usage: 'normal-text',
    minRatio: CONTRAST_FLOORS.normalText,
    targetRatio: CONTRAST_FLOORS.targetHeadroomNormal,
    representativeSurfaces: ['Panel subtitle', 'Form helper text'],
  },
  {
    id: 'text-muted-on-input',
    foregroundToken: 'app-text-muted',
    backgroundToken: 'app-input',
    usage: 'normal-text',
    minRatio: CONTRAST_FLOORS.normalText,
    targetRatio: CONTRAST_FLOORS.targetHeadroomNormal,
    representativeSurfaces: ['Input placeholder text'],
  },
  {
    id: 'text-subtle-on-bg',
    foregroundToken: 'app-text-subtle',
    backgroundToken: 'app-bg',
    usage: 'normal-text',
    minRatio: CONTRAST_FLOORS.normalText,
    targetRatio: CONTRAST_FLOORS.targetHeadroomNormal,
    representativeSurfaces: ['Metadata captions', 'Timeline timestamps'],
  },
  {
    id: 'text-subtle-on-surface',
    foregroundToken: 'app-text-subtle',
    backgroundToken: 'app-surface',
    usage: 'normal-text',
    minRatio: CONTRAST_FLOORS.normalText,
    targetRatio: CONTRAST_FLOORS.targetHeadroomNormal,
    representativeSurfaces: ['Status bar metadata', 'Panel item timestamps'],
  },
  // Accent text on surfaces
  {
    id: 'accent-on-bg',
    foregroundToken: 'app-accent',
    backgroundToken: 'app-bg',
    usage: 'normal-text',
    minRatio: CONTRAST_FLOORS.normalText,
    targetRatio: CONTRAST_FLOORS.targetHeadroomNormal,
    representativeSurfaces: ['Active link', 'Toolbar highlighted icon'],
  },
  {
    id: 'accent-on-surface',
    foregroundToken: 'app-accent',
    backgroundToken: 'app-surface',
    usage: 'normal-text',
    minRatio: CONTRAST_FLOORS.normalText,
    targetRatio: CONTRAST_FLOORS.targetHeadroomNormal,
    representativeSurfaces: ['Highlighted panel label', 'Active tab title'],
  },
  // On-fill text (directionality requirements)
  {
    id: 'accent-foreground-on-accent',
    foregroundToken: 'app-accent-foreground',
    backgroundToken: 'app-accent',
    usage: 'normal-text',
    minRatio: CONTRAST_FLOORS.normalText,
    targetRatio: CONTRAST_FLOORS.targetHeadroomNormal,
    representativeSurfaces: ['Primary button text on accent fill', 'Active badge text'],
  },
  {
    id: 'warning-foreground-on-warning',
    foregroundToken: 'app-warning-foreground',
    backgroundToken: 'app-warning',
    usage: 'normal-text',
    minRatio: CONTRAST_FLOORS.normalText,
    targetRatio: CONTRAST_FLOORS.targetHeadroomNormal,
    representativeSurfaces: ['Active Solo badge text', 'Warning alert badge text'],
  },
  {
    id: 'success-foreground-on-success',
    foregroundToken: 'app-success-foreground',
    backgroundToken: 'app-success',
    usage: 'normal-text',
    minRatio: CONTRAST_FLOORS.normalText,
    targetRatio: CONTRAST_FLOORS.targetHeadroomNormal,
    representativeSurfaces: ['Active Mute badge text', 'Success banner text'],
  },
  {
    id: 'danger-foreground-on-danger',
    foregroundToken: 'app-danger-foreground',
    backgroundToken: 'app-danger',
    usage: 'normal-text',
    minRatio: CONTRAST_FLOORS.normalText,
    targetRatio: CONTRAST_FLOORS.targetHeadroomNormal,
    representativeSurfaces: ['Destructive button text on danger fill'],
  },
  // Status text on surfaces
  {
    id: 'warning-on-bg',
    foregroundToken: 'app-warning',
    backgroundToken: 'app-bg',
    usage: 'normal-text',
    minRatio: CONTRAST_FLOORS.normalText,
    targetRatio: CONTRAST_FLOORS.targetHeadroomNormal,
    representativeSurfaces: ['Warning status text in settings', 'Solo inactive text'],
  },
  {
    id: 'danger-on-bg',
    foregroundToken: 'app-danger',
    backgroundToken: 'app-bg',
    usage: 'normal-text',
    minRatio: CONTRAST_FLOORS.normalText,
    targetRatio: CONTRAST_FLOORS.targetHeadroomNormal,
    representativeSurfaces: ['Error status message', 'Destructive action text'],
  },
  {
    id: 'error-on-surface',
    foregroundToken: 'app-error',
    backgroundToken: 'app-surface',
    usage: 'normal-text',
    minRatio: CONTRAST_FLOORS.normalText,
    targetRatio: CONTRAST_FLOORS.targetHeadroomNormal,
    representativeSurfaces: ['REPL console error message', 'Validation error text'],
  },
  // Non-text essential boundaries (WCAG 1.4.11)
  {
    id: 'border-against-bg',
    foregroundToken: 'app-border-strong',
    backgroundToken: 'app-bg',
    usage: 'essential-boundary',
    minRatio: CONTRAST_FLOORS.nonText,
    targetRatio: CONTRAST_FLOORS.targetHeadroomNonText,
    representativeSurfaces: ['Input border against window background', 'Panel outer border'],
  },
  {
    id: 'border-against-surface',
    foregroundToken: 'app-border-strong',
    backgroundToken: 'app-surface',
    usage: 'essential-boundary',
    minRatio: CONTRAST_FLOORS.nonText,
    targetRatio: CONTRAST_FLOORS.targetHeadroomNonText,
    representativeSurfaces: ['Control boundary against panel surface'],
  },
  // Focus indicators (WCAG 1.4.11)
  {
    id: 'focus-on-bg',
    foregroundToken: 'app-focus',
    backgroundToken: 'app-bg',
    usage: 'focus-indicator',
    minRatio: CONTRAST_FLOORS.nonText,
    targetRatio: CONTRAST_FLOORS.targetHeadroomNonText,
    representativeSurfaces: ['Focus ring against window background'],
  },
  {
    id: 'focus-on-surface',
    foregroundToken: 'app-focus',
    backgroundToken: 'app-surface',
    usage: 'focus-indicator',
    minRatio: CONTRAST_FLOORS.nonText,
    targetRatio: CONTRAST_FLOORS.targetHeadroomNonText,
    representativeSurfaces: ['Focus ring on panel controls and buttons'],
  },
  {
    id: 'focus-on-input',
    foregroundToken: 'app-focus',
    backgroundToken: 'app-input',
    usage: 'focus-indicator',
    minRatio: CONTRAST_FLOORS.nonText,
    targetRatio: CONTRAST_FLOORS.targetHeadroomNonText,
    representativeSurfaces: ['Focus ring on inputs and sliders'],
  },
]);

export const EXCEPTION_SCHEMA = Object.freeze({
  requiredFields: ['path', 'value', 'kind', 'reason', 'ownerSurface', 'reviewBy'],
  validKinds: ['syntax-palette', 'project-authored', 'decorative', 'inactive', 'platform-native'],
});

/**
 * Parses a hex, rgb, rgba, or named color into { r, g, b, a }.
 */
export function parseColor(colorStr) {
  if (typeof colorStr !== 'string') return null;
  const str = colorStr.trim().toLowerCase();

  if (str === 'transparent') {
    return { r: 0, g: 0, b: 0, a: 0 };
  }
  if (str === 'white') {
    return { r: 255, g: 255, b: 255, a: 1 };
  }
  if (str === 'black') {
    return { r: 0, g: 0, b: 0, a: 1 };
  }

  // Hex colors: #rgb, #rgba, #rrggbb, #rrggbbaa
  const hexMatch = str.match(/^#([0-9a-f]{3,8})$/i);
  if (hexMatch) {
    const raw = hexMatch[1];
    if (raw.length === 3) {
      return {
        r: parseInt(raw[0] + raw[0], 16),
        g: parseInt(raw[1] + raw[1], 16),
        b: parseInt(raw[2] + raw[2], 16),
        a: 1,
      };
    }
    if (raw.length === 4) {
      return {
        r: parseInt(raw[0] + raw[0], 16),
        g: parseInt(raw[1] + raw[1], 16),
        b: parseInt(raw[2] + raw[2], 16),
        a: parseInt(raw[3] + raw[3], 16) / 255,
      };
    }
    if (raw.length === 6) {
      return {
        r: parseInt(raw.slice(0, 2), 16),
        g: parseInt(raw.slice(2, 4), 16),
        b: parseInt(raw.slice(4, 6), 16),
        a: 1,
      };
    }
    if (raw.length === 8) {
      return {
        r: parseInt(raw.slice(0, 2), 16),
        g: parseInt(raw.slice(2, 4), 16),
        b: parseInt(raw.slice(4, 6), 16),
        a: parseInt(raw.slice(6, 8), 16) / 255,
      };
    }
  }

  // rgb/rgba
  const rgbMatch = str.match(
    /^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)(?:\s*[,/]\s*([\d.%]+))?\s*\)$/i,
  );
  if (rgbMatch) {
    let alpha = 1;
    if (rgbMatch[4] !== undefined) {
      alpha = rgbMatch[4].endsWith('%') ? parseFloat(rgbMatch[4]) / 100 : parseFloat(rgbMatch[4]);
    }
    return {
      r: Math.round(parseFloat(rgbMatch[1])),
      g: Math.round(parseFloat(rgbMatch[2])),
      b: Math.round(parseFloat(rgbMatch[3])),
      a: isNaN(alpha) ? 1 : Math.max(0, Math.min(1, alpha)),
    };
  }

  return null;
}

/**
 * Composites a foreground color with potential alpha over a background color.
 */
export function compositeAlpha(fg, bg) {
  const alpha = fg.a !== undefined ? fg.a : 1;
  if (alpha >= 1) {
    return { r: fg.r, g: fg.g, b: fg.b, a: 1 };
  }
  const bgA = bg.a !== undefined ? bg.a : 1;
  const outA = alpha + bgA * (1 - alpha);
  if (outA <= 0) {
    return { r: 0, g: 0, b: 0, a: 0 };
  }
  const r = Math.round((fg.r * alpha + bg.r * bgA * (1 - alpha)) / outA);
  const g = Math.round((fg.g * alpha + bg.g * bgA * (1 - alpha)) / outA);
  const b = Math.round((fg.b * alpha + bg.b * bgA * (1 - alpha)) / outA);
  return { r, g, b, a: Math.min(1, outA) };
}

/**
 * Returns sRGB relative luminance according to WCAG 2.1 / 2.2 formula.
 */
export function relativeLuminance({ r, g, b }) {
  const sRgbToLinear = (c) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * sRgbToLinear(r) + 0.7152 * sRgbToLinear(g) + 0.0722 * sRgbToLinear(b);
}

/**
 * Calculates WCAG contrast ratio between two colors without rounding upward.
 */
export function contrastRatio(colorA, colorB) {
  const lumA = relativeLuminance(colorA);
  const lumB = relativeLuminance(colorB);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Validates an exception record against the exact schema.
 * Returns array of validation error strings (empty if valid).
 */
export function validateException(exception) {
  const errors = [];
  if (!exception || typeof exception !== 'object') {
    return ['Exception record must be an object'];
  }

  for (const field of EXCEPTION_SCHEMA.requiredFields) {
    if (!exception[field] || typeof exception[field] !== 'string' || !exception[field].trim()) {
      errors.push(`Missing or empty required field: ${field}`);
    }
  }

  if (exception.kind && !EXCEPTION_SCHEMA.validKinds.includes(exception.kind)) {
    errors.push(
      `Invalid exception kind '${exception.kind}'. Must be one of: ${EXCEPTION_SCHEMA.validKinds.join(', ')}`,
    );
  }

  if (exception.path && typeof exception.path === 'string') {
    if (exception.path.includes('\\')) {
      errors.push('Path must use POSIX forward slashes');
    }
  }

  return errors;
}
