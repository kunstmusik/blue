export const DEFAULT_CSOUND_MANUAL_URL = 'https://csound.com/manual';
export const CSOUND_MANUAL_OPEN_CHANNEL = 'csound-manual:open';

export interface OpenCsoundManualRequest {
  manualId: string;
}

export type ManualAvailability = 'available' | 'missing' | 'indeterminate';

export type ManualFailureReason =
  | 'invalid-request'
  | 'invalid-setting'
  | 'missing'
  | 'probe-failed'
  | 'open-failed';

export interface OpenCsoundManualResult {
  disposition: 'opened' | 'fallback';
  availability: ManualAvailability;
  reason?: ManualFailureReason;
  targetUrl?: string;
  message?: string;
}

export interface CsoundManualRootValidationResult {
  valid: boolean;
  normalizedUrl?: string;
  error?: string;
}

function hasLoneSurrogates(str: string): boolean {
  if (typeof (str as unknown as { isWellFormed?: () => boolean }).isWellFormed === 'function') {
    return !(str as unknown as { isWellFormed: () => boolean }).isWellFormed();
  }
  return /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(str);
}

export function validateAndNormalizeCsoundManualRoot(
  rawUrl: unknown,
): CsoundManualRootValidationResult {
  if (typeof rawUrl !== 'string') {
    return { valid: false, error: 'Csound manual URL must be a string' };
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { valid: false, error: 'Csound manual URL cannot be empty' };
  }

  if (hasLoneSurrogates(trimmed)) {
    return { valid: false, error: 'Csound manual URL contains malformed Unicode surrogates' };
  }

  const lowerTrimmed = trimmed.toLowerCase();
  if (lowerTrimmed.startsWith('https:') && !lowerTrimmed.startsWith('https://')) {
    return { valid: false, error: 'Csound manual URL must begin with https://' };
  }

  if (lowerTrimmed.startsWith('file:') && !lowerTrimmed.startsWith('file://')) {
    return { valid: false, error: 'Csound manual URL must begin with file://' };
  }

  try {
    decodeURI(trimmed);
  } catch {
    return { valid: false, error: 'Csound manual URL contains invalid percent-encoding' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: 'Csound manual URL must be a valid absolute URL' };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'file:') {
    return {
      valid: false,
      error: 'Csound manual URL must use https: or file: protocol',
    };
  }

  if (parsed.username || parsed.password) {
    return {
      valid: false,
      error: 'Csound manual URL must not contain credentials',
    };
  }

  if (parsed.search) {
    return {
      valid: false,
      error: 'Csound manual URL must not contain query parameters',
    };
  }

  if (parsed.hash) {
    return {
      valid: false,
      error: 'Csound manual URL must not contain a fragment',
    };
  }

  // Normalize by removing trailing slashes from pathname (unless pathname is just "/")
  if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
    parsed.pathname = parsed.pathname.replace(/\/+$/, '');
  }

  return {
    valid: true,
    normalizedUrl: parsed.href,
  };
}

export function normalizeCsoundManualRoot(rawUrl: string): string {
  const result = validateAndNormalizeCsoundManualRoot(rawUrl);
  return result.normalizedUrl ?? rawUrl.trim();
}

export function validateManualId(manualId: unknown): { valid: boolean; error?: string } {
  if (typeof manualId !== 'string') {
    return { valid: false, error: 'Manual ID must be a string' };
  }

  if (hasLoneSurrogates(manualId)) {
    return { valid: false, error: 'Manual ID contains malformed Unicode surrogates' };
  }

  if (/[\x00-\x1f\x7f]/.test(manualId)) {
    return { valid: false, error: 'Manual ID must not contain control characters' };
  }

  const trimmed = manualId.trim();
  if (!trimmed) {
    return { valid: false, error: 'Manual ID cannot be empty' };
  }

  if (trimmed.includes('/') || trimmed.includes('\\')) {
    return { valid: false, error: 'Manual ID must not contain path separators' };
  }

  if (trimmed === '.' || trimmed === '..' || trimmed.includes('..')) {
    return { valid: false, error: 'Manual ID must not be or contain dot segments' };
  }

  try {
    const decoded = decodeURIComponent(trimmed);
    if (
      decoded === '.' ||
      decoded === '..' ||
      decoded.includes('..') ||
      decoded.includes('/') ||
      decoded.includes('\\') ||
      /[\x00-\x1f\x7f]/.test(decoded)
    ) {
      return { valid: false, error: 'Manual ID contains invalid decoded sequences' };
    }
  } catch {
    return { valid: false, error: 'Manual ID contains invalid URI encoding' };
  }

  return { valid: true };
}

export function deriveCsoundManualTargetUrl(
  rootUrl: string,
  manualId: string,
): { valid: true; targetUrl: string } | { valid: false; error: string } {
  const rootValidation = validateAndNormalizeCsoundManualRoot(rootUrl);
  if (!rootValidation.valid || !rootValidation.normalizedUrl) {
    return { valid: false, error: rootValidation.error ?? 'Invalid manual root URL' };
  }

  const idValidation = validateManualId(manualId);
  if (!idValidation.valid) {
    return { valid: false, error: idValidation.error ?? 'Invalid manual ID' };
  }

  const cleanId = manualId.trim();
  let encodedId: string;
  try {
    encodedId = encodeURIComponent(cleanId);
  } catch {
    return { valid: false, error: 'Failed to encode manual ID' };
  }
  const normalizedRoot = rootValidation.normalizedUrl;
  const rootWithoutTrailingSlash = normalizedRoot.endsWith('/')
    ? normalizedRoot.slice(0, -1)
    : normalizedRoot;

  const targetUrl = `${rootWithoutTrailingSlash}/opcodes/${encodedId}/`;

  let targetParsed: URL;
  let rootParsed: URL;
  try {
    targetParsed = new URL(targetUrl);
    rootParsed = new URL(normalizedRoot);
  } catch {
    return { valid: false, error: 'Failed to construct target URL' };
  }

  if (targetParsed.protocol !== rootParsed.protocol) {
    return { valid: false, error: 'Target protocol mismatch' };
  }

  if (rootParsed.protocol === 'https:' && targetParsed.origin !== rootParsed.origin) {
    return { valid: false, error: 'Target origin mismatch' };
  }

  const expectedPrefix = `${rootParsed.pathname.endsWith('/') ? rootParsed.pathname : `${rootParsed.pathname}/`}opcodes/`;
  if (!targetParsed.pathname.startsWith(expectedPrefix)) {
    return { valid: false, error: 'Target path escapes configured root' };
  }

  return { valid: true, targetUrl: targetParsed.href };
}
