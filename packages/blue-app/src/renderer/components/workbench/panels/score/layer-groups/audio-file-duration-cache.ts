import { parseAudioFileMetadata } from '@blue/data';

const audioDurationCache = new Map<string, number>();
const pendingDurationLoads = new Set<string>();
const durationListeners = new Set<() => void>();

function emitDurationUpdate(): void {
  for (const listener of durationListeners) {
    listener();
  }
}

/**
 * Returns the cached duration (in seconds) for a given audio file path, or null
 * if not yet loaded. If not cached, initiates an asynchronous read and metadata parse.
 */
export function getAudioFileDuration(filePath: string): number | null {
  if (!filePath) return null;
  const cached = audioDurationCache.get(filePath);
  if (cached !== undefined) return cached;

  if (!pendingDurationLoads.has(filePath) && window.blueAPI?.readAudioFileBytes) {
    pendingDurationLoads.add(filePath);
    window.blueAPI.readAudioFileBytes(filePath)
      .then((bytes) => {
        if (bytes) {
          try {
            const metadata = parseAudioFileMetadata(
              bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes),
            );
            if (metadata.durationSeconds > 0) {
              audioDurationCache.set(filePath, metadata.durationSeconds);
              emitDurationUpdate();
            }
          } catch {
            // Header parsing failed or unsupported; ignore and use default duration.
          }
        }
      })
      .catch(() => {
        // Read failed; ignore.
      })
      .finally(() => {
        pendingDurationLoads.delete(filePath);
      });
  }

  return null;
}

/**
 * Subscribes to updates when newly loaded audio file durations become available.
 */
export function subscribeAudioFileDuration(listener: () => void): () => void {
  durationListeners.add(listener);
  return () => {
    durationListeners.delete(listener);
  };
}

/**
 * Manually sets a duration in the cache (useful for testing or pre-populating).
 */
export function setCachedAudioFileDuration(filePath: string, durationSeconds: number): void {
  audioDurationCache.set(filePath, durationSeconds);
  emitDurationUpdate();
}

/**
 * Clears the duration cache (useful for tests).
 */
export function clearAudioFileDurationCache(): void {
  audioDurationCache.clear();
  pendingDurationLoads.clear();
  durationListeners.clear();
}
