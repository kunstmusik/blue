import type { LibraryContextRequest } from '../../shared/unified-library';
import { useLibraryStore } from './library-store';
import { useWorkbenchStore } from './workbench-store';
import { useUIStore } from './ui-store';

export async function openUnifiedLibraries(request: LibraryContextRequest): Promise<void> {
  const type = request.type === 'browseType'
    ? request.libraryType
      : request.type === 'instrumentTarget' || request.type === 'trackInstrumentTarget'
      ? 'instrument'
      : request.type === 'udoTarget'
        ? 'udo'
        : request.type === 'effectTarget'
          ? 'effect'
          : 'soundObject';
  useLibraryStore.getState().setTypeFilter(type);
  useUIStore.getState().setActivePanel('workspace');
  useWorkbenchStore.getState().openPanel('LibrariesTopComponent');
}
