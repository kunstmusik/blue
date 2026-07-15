import type { LibraryContextRequest } from '../../shared/unified-library';
import { useLibraryStore } from './library-store';
import { useWorkbenchStore } from './workbench-store';

export async function openUnifiedLibraries(request: LibraryContextRequest): Promise<void> {
  await useLibraryStore.getState().setContext(request);
  useWorkbenchStore.getState().openPanel('LibrariesTopComponent');
}
