/**
 * RFC4122 v4 UUID generator delegating to the standard Web Crypto API.
 */
export function generateUuid(): string {
  return crypto.randomUUID();
}

export function generatePrefixedUuid(prefix: string): string {
  return `${prefix}-${generateUuid()}`;
}
