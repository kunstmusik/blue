/**
 * Native audio-file identity used only for same-file comparison.
 *
 * The value returned here is never passed to fs, BlueData, or Csound. Callers
 * retain the original host path for those boundaries and use this helper only
 * to collapse aliases before doing expensive header inspection.
 */
import * as fs from 'node:fs';

import { canonicalProjectPathIdentity } from './project-path';

export interface AudioFileIdentityOptions {
  /** Override the host platform for deterministic path-sensitive tests. */
  readonly platform?: string;
  /** Inject realpath resolution; the native path is passed unchanged. */
  readonly realpath?: (filePath: string) => string;
}

function resolveNativeIdentityPath(
  filePath: string,
  realpath: ((filePath: string) => string) | undefined,
): string {
  try {
    return (realpath ?? fs.realpathSync.native)(filePath);
  } catch {
    // Missing/stale files still need a stable comparison key. The later
    // preflight probe reports their actual missing/unreadable state.
    return filePath;
  }
}

export function canonicalAudioFileIdentity(
  filePath: string,
  options: AudioFileIdentityOptions = {},
): string {
  return canonicalProjectPathIdentity(
    resolveNativeIdentityPath(filePath, options.realpath),
    options.platform,
  );
}
