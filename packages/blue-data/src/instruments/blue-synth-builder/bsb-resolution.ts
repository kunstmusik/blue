import {
  JavaDecimal,
  normalizeLegacyResolution,
  parseJavaDecimal,
} from '../../automation/java-decimal';

function requireResolution(result: ReturnType<typeof parseJavaDecimal>): JavaDecimal {
  if (!result.ok) {
    throw new Error(`${result.code}: ${result.message}`);
  }
  return result.value;
}

export function defaultBsbResolution(): JavaDecimal {
  return requireResolution(parseJavaDecimal('0.1'));
}

/** Parse a Java BSB legacy `<resolution>` number using Java's load rule. */
export function parseLegacyBsbResolution(text: string): JavaDecimal {
  const value = Number.parseFloat(text);
  const result = normalizeLegacyResolution(value);
  if (!result.ok) {
    throw new Error(`${result.code}: ${result.message}`);
  }
  return result.value;
}

/** Parse an exact Java BSB `<bdresolution>` value without numeric conversion. */
export function parseExactBsbResolution(text: string): JavaDecimal {
  return requireResolution(parseJavaDecimal(text));
}
