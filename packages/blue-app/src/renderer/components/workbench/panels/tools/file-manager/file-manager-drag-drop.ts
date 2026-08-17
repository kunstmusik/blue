/**
 * File Manager drag/drop helpers (SPEC 076).
 *
 * The File Manager regular-file row is a copy-only drag source using a
 * versioned custom MIME payload. The Track audio-layer target reads either
 * that payload or a single external OS file/URI drop; both source classes
 * are revalidated by the main process before any project mutation.
 */
import {
  BLUE_FILE_MANAGER_DRAG_MIME,
  isCsoundAudioSourcePath,
  parseExternalOsFileDrop,
  parseFileManagerDragPayload,
  serializeFileManagerDragPayload,
  type FileManagerDragPayload,
} from '../../../../../../shared/file-manager';
import { BLUE_LIBRARY_DRAG_MIME } from '../../../../libraries/library-drag-drop';

export type AudioDropSource =
  | { kind: 'file-manager'; path: string; name: string }
  | { kind: 'external-os'; path: string };

let activeFileManagerDragPayload: FileManagerDragPayload | null = null;

export function getActiveFileManagerDragPayload(): FileManagerDragPayload | null {
  return activeFileManagerDragPayload;
}

export function clearActiveFileManagerDragPayload(): void {
  activeFileManagerDragPayload = null;
}

if (typeof window !== 'undefined') {
  window.addEventListener('dragend', () => {
    clearActiveFileManagerDragPayload();
  });
  window.addEventListener('drop', () => {
    clearActiveFileManagerDragPayload();
  });
}

/** Writes the versioned copy-only payload for a regular-file row drag start. */
export function writeFileManagerDragPayload(
  dataTransfer: DataTransfer,
  payload: FileManagerDragPayload,
): void {
  activeFileManagerDragPayload = payload;
  dataTransfer.setData(BLUE_FILE_MANAGER_DRAG_MIME, serializeFileManagerDragPayload(payload));
  dataTransfer.setData('text/plain', payload.path);
  dataTransfer.effectAllowed = 'copy';
}

/**
 * Reads one supported audio drop source from a DataTransfer: the File Manager
 * custom MIME payload first, then a single external OS file (path resolved
 * through the preload bridge) or one `file://` URI. Multi-file, multi-URI,
 * and non-file payloads return null so the target can reject the drop.
 */
export function readAudioDropSource(
  dataTransfer: DataTransfer,
  getPathForFile: (file: File) => string,
): AudioDropSource | null {
  const raw = dataTransfer.getData(BLUE_FILE_MANAGER_DRAG_MIME);
  const internal = (raw ? parseFileManagerDragPayload(raw) : null)
    ?? (dataTransfer.types.includes(BLUE_FILE_MANAGER_DRAG_MIME) ? activeFileManagerDragPayload : null);
  if (internal) {
    return { kind: 'file-manager', path: internal.path, name: internal.name };
  }

  const firstFile = dataTransfer.files.length > 0 ? dataTransfer.files[0]! : null;
  const external = parseExternalOsFileDrop({
    fileCount: dataTransfer.files.length,
    firstFilePath: firstFile
      ? (() => {
          try {
            return getPathForFile(firstFile);
          } catch {
            return null;
          }
        })()
      : null,
    uriList: dataTransfer.getData('text/uri-list'),
    textPlain: dataTransfer.getData('text/plain'),
  });
  if (external.status === 'ok') {
    return { kind: 'external-os', path: external.path };
  }
  return null;
}

/**
 * True when the DataTransfer could carry either supported source shape.
 * Unified-library drags carry text/plain too, so an explicit library payload
 * is excluded here to leave those drags to the score-timeline target.
 */
export function dataTransferMayCarryAudioDrop(dataTransfer: DataTransfer): boolean {
  if (dataTransfer.types.includes(BLUE_LIBRARY_DRAG_MIME)) return false;
  return (
    dataTransfer.types.includes(BLUE_FILE_MANAGER_DRAG_MIME)
    || dataTransfer.types.includes('Files')
    || dataTransfer.types.includes('text/uri-list')
    || dataTransfer.types.includes('text/plain')
  );
}

/** True only when the current transfer resolves to one allowed audio source. */
export function dataTransferCanAcceptAudioDrop(
  dataTransfer: DataTransfer,
  getPathForFile: (file: File) => string,
): boolean {
  const source = readAudioDropSource(dataTransfer, getPathForFile);
  if (source) {
    return isCsoundAudioSourcePath(source.path);
  }
  // During dragover from external OS, dataTransfer.getData is inaccessible in Chromium,
  // but 'Files' type indicates a file drop is in progress.
  return dataTransfer.types.includes('Files') && !dataTransfer.types.includes(BLUE_LIBRARY_DRAG_MIME);
}
