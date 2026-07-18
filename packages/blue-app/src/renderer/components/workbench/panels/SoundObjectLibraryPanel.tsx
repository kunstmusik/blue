import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import type { LibraryBrowseNode } from '../../../../shared/unified-library';
import { LibraryTree } from '../../libraries/LibraryTree';
import { useLibraryStore } from '../../../stores/library-store';
import { useProjectStore } from '../../../stores/project-store';

export default function SoundObjectLibraryPanel(): React.ReactElement {
  const loaded = useProjectStore((state) => state.loaded);
  const projectSessionId = useProjectStore((state) => state.sessionId);
  const [nodes, setNodes] = useState<LibraryBrowseNode[]>([]);
  const [error, setError] = useState<string | null>(null);
  const openEditor = useLibraryStore((state) => state.openEditor);
  const captureClipboard = useLibraryStore((state) => state.captureClipboard);

  const refresh = useCallback(async () => {
    if (!loaded) {
      setNodes([]);
      setError(null);
      return;
    }
    const result = await window.blueAPI.browseLibraries({
      parent: {
        scope: 'projectShared',
        libraryType: 'soundObject',
        projectSessionId,
      },
    });
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setNodes([...result.value.children]);
    setError(null);
  }, [loaded, projectSessionId]);

  useEffect(() => {
    void refresh();
    return window.blueAPI.onLibraryChanged(() => {
      void refresh();
    });
  }, [refresh]);

  const deleteNode = (node: LibraryBrowseNode): void => {
    if (!node.key || node.key.scope !== 'projectShared') return;
    void (async () => {
      const preview = await window.blueAPI.previewProjectLibraryDelete(node.key!);
      if (!preview.ok) {
        setError(preview.error.message);
        return;
      }
      const linkedInstances = preview.value.linkedInstanceCount;
      const usage = linkedInstances > 0
        ? ` and ${linkedInstances} linked score instance${linkedInstances === 1 ? '' : 's'}`
        : '';
      if (!window.confirm(`Delete “${node.displayName}”${usage}? This cannot be undone.`)) return;
      const result = await window.blueAPI.deleteProjectLibraryItem(node.key!, preview.value.confirmationToken);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      toast.success(`${node.displayName} deleted from the project SoundObject Library.`);
      await refresh();
    })();
  };

  const copyToUser = (node: LibraryBrowseNode): void => {
    if (!node.key || node.key.scope !== 'projectShared') return;
    void (async () => {
      const destination = await window.blueAPI.browseLibraries({
        parent: { scope: 'user', libraryType: 'soundObject' },
      });
      if (!destination.ok) {
        setError(destination.error.message);
        return;
      }
      const result = await window.blueAPI.copyProjectLibraryItemToUser(
        node.key!,
        destination.value.parent.nodeId,
      );
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      toast.success(`${node.displayName} copied to User Libraries.`);
    })();
  };

  if (!loaded) {
    return (
      <div className="flex h-full items-center justify-center bg-app-panel px-4 text-sm text-app-text-muted">
        No project loaded
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto bg-app-panel p-1 text-app-text">
      {error && <p role="alert" className="px-2 py-1 text-xs text-red-400">{error}</p>}
      <LibraryTree
        label="Project SoundObject Library"
        nodes={nodes}
        onSelect={(key) => { void openEditor(key, false); }}
        onOpen={(key) => { void openEditor(key, true); }}
        onCopy={(node) => captureClipboard(node, 'copy')}
        onCopyToUser={copyToUser}
        onDelete={deleteNode}
      />
    </div>
  );
}
