/**
 * Tiny module-level pub/sub that connects the Render-to-Disk-and-Play
 * interceptor hook to the AudioFilePanel.
 *
 * When a "play" disk render completes, the hook opens the panel and emits
 * the rendered file path on this bus. The mounted AudioFilePanel subscribes
 * and loads + autoplays the file. No React context is needed because there
 * is exactly one consumer (the panel) and one producer (the hook).
 */

type AudioFileListener = (filePath: string) => void;

const listeners = new Set<AudioFileListener>();
let pendingFilePath: string | null = null;

export function subscribePendingAudioFile(
  listener: AudioFileListener,
): () => void {
  listeners.add(listener);
  if (pendingFilePath !== null) {
    const filePath = pendingFilePath;
    pendingFilePath = null;
    listener(filePath);
  }
  return () => {
    listeners.delete(listener);
  };
}

export function emitPendingAudioFile(filePath: string): void {
  if (listeners.size === 0) {
    pendingFilePath = filePath;
    return;
  }
  for (const listener of listeners) {
    listener(filePath);
  }
}
