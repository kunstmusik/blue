/**
 * Tiny module-level pub/sub that routes a File Manager double-clicked .sf2
 * file to the SoundFont Viewer panel (SPEC 076).
 *
 * Mirrors the Audio File Player pending-file bus: the File Manager opens the
 * panel and emits the path; a mounted SoundFontViewerPanel subscribes and
 * inspects the file. When no panel is mounted yet, the path is held and
 * delivered on mount. No React context is needed because there is exactly one
 * consumer (the panel) and one producer (the File Manager).
 */

type SoundFontFileListener = (filePath: string) => void;

const listeners = new Set<SoundFontFileListener>();
let pendingFilePath: string | null = null;

export function subscribePendingSoundFontFile(listener: SoundFontFileListener): () => void {
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

export function emitPendingSoundFontFile(filePath: string): void {
  if (listeners.size === 0) {
    pendingFilePath = filePath;
    return;
  }
  for (const listener of listeners) {
    listener(filePath);
  }
}
