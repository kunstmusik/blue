const BLUE_NUMBER_FORMATTER = new Intl.NumberFormat('en-US', {
  useGrouping: false,
  minimumFractionDigits: 0,
  maximumFractionDigits: 10,
});

/**
 * Mirrors blue's NumberUtilities.formatDouble():
 * - no grouping
 * - up to 10 fractional digits
 * - trims unnecessary trailing zeros
 * - avoids scientific notation within the retained precision
 * - non-finite values use Java DecimalFormat symbols ("∞"/"-∞"/"NaN")
 */
export function formatBlueNumber(value: number): string {
  if (!Number.isFinite(value)) {
    if (Number.isNaN(value)) return 'NaN';
    return value > 0 ? '∞' : '-∞';
  }

  const normalized = Object.is(value, -0) ? 0 : value;
  return BLUE_NUMBER_FORMATTER.format(normalized);
}

/**
 * Mirrors the Double.toString() usage blue relies on for note start times
 * and tempo values. In particular, integral values render with a trailing .0.
 */
export function formatJavaDouble(value: number): string {
  if (!Number.isFinite(value)) {
    return String(value);
  }

  const normalized = Object.is(value, -0) ? 0 : value;
  if (Number.isInteger(normalized)) {
    return normalized.toFixed(1);
  }

  const str = normalized.toString();
  if (!str.includes('e')) {
    return str;
  }

  const [mantissa, exponent] = str.split('e');
  const normalizedMantissa = mantissa.includes('.') ? mantissa : `${mantissa}.0`;
  return `${normalizedMantissa}E${exponent}`;
}
