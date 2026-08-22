/**
 * Platform-aware canonical project path identity for same-file comparison.
 *
 * Identity values are only for comparing two host paths; the native path
 * passed to fs and BlueData loading must remain the original host path.
 * The helper performs no file I/O or realpath resolution so missing targets
 * (for example a stale recent-project path) still produce an identity before
 * the later read reports the load error.
 */
import * as path from 'node:path';

type PathPlatformImplementation = typeof path.posix;

function getPlatformImplementation(platform: string): PathPlatformImplementation {
  return platform === 'win32' ? path.win32 : path.posix;
}

/**
 * Resolve and normalize a host path into a canonical identity for same-file
 * comparison. Windows identity folds case and accepts equivalent slash forms;
 * POSIX identity preserves case.
 */
export function canonicalProjectPathIdentity(
  filePath: string,
  platform: string = process.platform,
): string {
  const platformPath = getPlatformImplementation(platform);
  const resolved = platformPath.resolve(platformPath.normalize(filePath));
  return platform === 'win32' ? resolved.toLowerCase() : resolved;
}

/**
 * Compare two host paths for same-file identity using canonical rules.
 */
export function isSameProjectPathIdentity(
  a: string,
  b: string,
  platform: string = process.platform,
): boolean {
  return canonicalProjectPathIdentity(a, platform) === canonicalProjectPathIdentity(b, platform);
}
