let cacheGeneration = 0;
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

  if (!pendingDurationLoads.has(filePath) && window.blueAPI?.getAudioFileMetadata) {
    pendingDurationLoads.add(filePath);
    const generation = cacheGeneration;
    window.blueAPI
      .getAudioFileMetadata(filePath)
      .then((metadata) => {
        if (generation !== cacheGeneration) return;
        if (metadata && metadata.durationSeconds > 0) {
          setCachedAudioFileDuration(filePath, metadata.durationSeconds);
        }
      })
      .catch(() => {
        // Read failed; ignore.
      })
      .finally(() => {
        if (generation === cacheGeneration) pendingDurationLoads.delete(filePath);
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
  audioDurationCache.delete(filePath);
  if (audioDurationCache.size >= 256)
    audioDurationCache.delete(audioDurationCache.keys().next().value!);
  audioDurationCache.set(filePath, durationSeconds);
  emitDurationUpdate();
}

/**
 * Clears the duration cache (useful for tests).
 */
export function clearAudioFileDurationCache(): void {
  cacheGeneration += 1;
  audioDurationCache.clear();
  pendingDurationLoads.clear();
}
