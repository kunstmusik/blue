import * as path from 'node:path';

export function normalizeWorkDirectory(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function resolveWorkDirectoryDefaultPath(
  workDirectory: string | null | undefined,
  fileName?: string,
): string | undefined {
  const normalized = normalizeWorkDirectory(workDirectory);
  if (!normalized || !fileName || path.isAbsolute(fileName)) {
    return fileName ?? normalized;
  }
  return path.join(normalized, fileName);
}
