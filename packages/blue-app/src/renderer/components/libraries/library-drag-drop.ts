import type {
  LibraryBrowseNode,
  LibraryDragDescriptor,
  LibraryTransferSourceReference,
} from '../../../shared/unified-library';

export const BLUE_LIBRARY_DRAG_MIME = 'application/x-blue-library-drag';

export function beginLibraryNodeDrag(
  node: LibraryBrowseNode,
): LibraryDragDescriptor | null {
  if (!node.key || node.nodeKind !== 'item') return null;
  const descriptor: LibraryDragDescriptor = {
    dragSessionId: crypto.randomUUID(),
    libraryType: node.libraryType,
  };
  void window.blueAPI
    .beginLibraryDrag({
      dragSessionId: descriptor.dragSessionId,
      key: node.key,
      revision: node.revision,
    })
    .catch(() => undefined);
  return descriptor;
}

export function writeLibraryDragDescriptor(
  dataTransfer: DataTransfer,
  descriptor: LibraryDragDescriptor,
): void {
  dataTransfer.effectAllowed = 'copy';
  dataTransfer.setData(BLUE_LIBRARY_DRAG_MIME, JSON.stringify(descriptor));
  dataTransfer.setData('text/plain', 'Blue Library Item');
}

export function readLibraryDragSource(dataTransfer: DataTransfer): LibraryTransferSourceReference | null {
  const descriptor = readLibraryDragDescriptor(dataTransfer);
  return descriptor ? { kind: 'drag', dragSessionId: descriptor.dragSessionId } : null;
}

export function readLibraryDragDescriptor(dataTransfer: DataTransfer): LibraryDragDescriptor | null {
  try {
    const parsed = JSON.parse(dataTransfer.getData(BLUE_LIBRARY_DRAG_MIME)) as Partial<LibraryDragDescriptor>;
    return typeof parsed.dragSessionId === 'string' && typeof parsed.libraryType === 'string'
      ? parsed as LibraryDragDescriptor
      : null;
  } catch {
    return null;
  }
}

export async function cancelLibraryNodeDrag(descriptor: LibraryDragDescriptor | null): Promise<void> {
  if (descriptor) await window.blueAPI.cancelLibraryDrag(descriptor.dragSessionId);
}
