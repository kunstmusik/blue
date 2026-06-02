import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LibraryBig, RefreshCcw, X, Plus, Download, Upload } from 'lucide-react';

import type {
  EffectsLibraryCategorySnapshot,
  EffectsLibrarySnapshot,
  EffectEditorRequest,
  EffectEditorSnapshot,
  EffectEditablePatch,
  LibraryEffectSnapshot,
} from '../../../../shared/project-editor';
import { useProjectStore } from '../../../stores/project-store';
import { useUIStore } from '../../../stores/ui-store';
import { getDefaultUdoStyle } from '../../../utils/program-settings-defaults';
import SplitPane from './orchestra/SplitPane';
import EffectEditorPanel from '../../effect-editor/EffectEditorPanel';
import EffectLibraryTree, {
  snapshotToTreeNodes,
  type LibraryTreeNode,
  type TreeContextActions,
} from './effects-library/EffectLibraryTree';

type ClipboardItem =
  | { kind: 'effect'; effect: LibraryEffectSnapshot }
  | { kind: 'category'; snapshot: EffectsLibraryCategorySnapshot };

function EffectEditorPlaceholder(): React.ReactElement {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-blue-muted">
      <LibraryBig className="h-10 w-10 opacity-40" />
      <div className="text-sm">Select an effect in the tree to edit</div>
    </div>
  );
}

function findCategoryRecursive(
  category: EffectsLibraryCategorySnapshot | undefined,
  categoryId: string,
): EffectsLibraryCategorySnapshot | undefined {
  if (!category) return undefined;
  if (category.categoryId === categoryId) return category;
  for (const child of category.categories) {
    const found = findCategoryRecursive(child, categoryId);
    if (found) return found;
  }
  return undefined;
}

export default function EffectLibraryModal(): React.ReactElement | null {
  const open = useUIStore((state) => state.effectsLibraryOpen);
  const target = useUIStore((state) => state.effectsLibraryTarget);
  const closeEffectsLibrary = useUIStore((state) => state.closeEffectsLibrary);
  const applyProjectDocumentPatch = useProjectStore((state) => state.applyProjectDocumentPatch);

  const [snapshot, setSnapshot] = useState<EffectsLibrarySnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedEffect, setSelectedEffect] = useState<LibraryEffectSnapshot | null>(null);
  const [effectEditorSnapshot, setEffectEditorSnapshot] = useState<EffectEditorSnapshot | null>(null);
  const [clipboard, setClipboard] = useState<ClipboardItem | null>(null);
  const [hasSessionMutations, setHasSessionMutations] = useState(false);
  const editorContainerRef = useRef<HTMLDivElement | null>(null);

  const refreshSnapshot = useCallback(async () => {
    setLoading(true);
    try {
      const next = await window.blueAPI.getEffectsLibrary();
      setSnapshot(next);
      setHasSessionMutations(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleImportEffect = useCallback(async () => {
    const next = await window.blueAPI.importEffectFile();
    if (next) {
      setSnapshot(next);
      setHasSessionMutations(true);
    }
  }, []);

  const handleExportEffect = useCallback(async () => {
    if (!selectedEffect) return;
    await window.blueAPI.exportEffectFile(selectedEffect.libraryEffectId);
  }, [selectedEffect]);

  const handleReloadFromDisk = useCallback(async () => {
    if (hasSessionMutations) {
      const confirmed = window.confirm(
        'Reload will discard all session-local changes. Continue?',
      );
      if (!confirmed) return;
    }
    setLoading(true);
    try {
      const next = await window.blueAPI.reloadEffectsLibrary();
      setSnapshot(next);
      setHasSessionMutations(false);
      setSelectedEffect(null);
      setEffectEditorSnapshot(null);
    } finally {
      setLoading(false);
    }
  }, [hasSessionMutations]);

  useEffect(() => {
    if (!open) return;
    void refreshSnapshot();
  }, [open, refreshSnapshot]);

  useEffect(() => {
    if (!open) return;
    const handleFocus = () => { void refreshSnapshot(); };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [open, refreshSnapshot]);

  useEffect(() => {
    if (!selectedEffect || !open) {
      setEffectEditorSnapshot(null);
      return;
    }

    let cancelled = false;
    const request: EffectEditorRequest = {
      effectId: selectedEffect.libraryEffectId,
      ownerType: 'library',
      libraryRef: { libraryEffectId: selectedEffect.libraryEffectId },
    };

    void window.blueAPI.getEffectEditorDocument(request).then((loaded) => {
      if (cancelled || !loaded) return;
      setEffectEditorSnapshot(loaded);
    });

    return () => { cancelled = true; };
  }, [selectedEffect, open]);

  const refreshEffectEditor = useCallback(async () => {
    if (!selectedEffect) return;
    const request: EffectEditorRequest = {
      effectId: selectedEffect.libraryEffectId,
      ownerType: 'library',
      libraryRef: { libraryEffectId: selectedEffect.libraryEffectId },
    };
    const refreshed = await window.blueAPI.getEffectEditorDocument(request);
    if (refreshed) setEffectEditorSnapshot(refreshed);
  }, [selectedEffect]);

  const handleAddToMixer = useCallback(
    (effect: LibraryEffectSnapshot) => {
      if (!target) return;
      void applyProjectDocumentPatch({
        mixer: {
          type: 'addEffectFromLibrary',
          channelId: target.channelId,
          chain: target.chain,
          libraryEffectId: effect.libraryEffectId,
          effectXml: effect.effectXml,
          entryId: crypto.randomUUID(),
        },
      });
    },
    [applyProjectDocumentPatch, target],
  );

  const handleRename = useCallback(
    async (node: LibraryTreeNode, newName: string) => {
      if (node.kind === 'effect') {
      const next = await window.blueAPI.updateEffectsLibrary({
        type: 'renameEffect',
        effectId: node.id,
        name: newName,
      });
      setSnapshot(next);
      setHasSessionMutations(true);
      } else {
        const next = await window.blueAPI.updateEffectsLibrary({
          type: 'renameCategory',
          categoryId: node.categoryId ?? node.id,
          name: newName,
        });
        setSnapshot(next);
        setHasSessionMutations(true);
      }
    },
    [],
  );

  const handleMove = useCallback(
    async (dragIds: string[], parentId: string | null, index: number) => {
      if (dragIds.length === 0) return;
      const dragId = dragIds[0];
      const next = await window.blueAPI.updateEffectsLibrary({
        type: 'moveNode',
        nodeId: dragId,
        targetParentCategoryId: parentId ?? undefined,
        targetIndex: index,
      });
      setSnapshot(next);
    },
    [],
  );

  const handleEffectPatch = useCallback(
    async (patch: EffectEditablePatch) => {
      if (!selectedEffect) return;
      const next = await window.blueAPI.updateEffectsLibrary({
        type: 'updateEffect',
        effectId: selectedEffect.libraryEffectId,
        patch,
      });
      setSnapshot(next);
      setHasSessionMutations(true);
      await refreshEffectEditor();
    },
    [selectedEffect, refreshEffectEditor],
  );

  const contextActions: TreeContextActions = useMemo(() => ({
    onAddCategory: async (parentId: string) => {
      const next = await window.blueAPI.updateEffectsLibrary({
        type: 'addCategory',
        parentCategoryId: parentId,
      });
      setSnapshot(next);
      setHasSessionMutations(true);
    },
    onRemoveCategory: async (categoryId: string) => {
      if (!window.confirm('Remove this group and all its contents?')) return;
      const next = await window.blueAPI.updateEffectsLibrary({
        type: 'removeCategory',
        categoryId,
      });
      setSnapshot(next);
      setHasSessionMutations(true);
      setSelectedEffect(null);
      setEffectEditorSnapshot(null);
    },
    onAddEffect: async (parentId: string) => {
      const style = await getDefaultUdoStyle();
      const next = await window.blueAPI.updateEffectsLibrary({
        type: 'addEffect',
        parentCategoryId: parentId,
        style,
      });
      setSnapshot(next);
      setHasSessionMutations(true);
    },
    onCutEffect: (effect: LibraryEffectSnapshot) => {
      setClipboard({ kind: 'effect', effect });
      void window.blueAPI.updateEffectsLibrary({
        type: 'removeEffect',
        effectId: effect.libraryEffectId,
      }).then((next) => {
        setSnapshot(next);
        setHasSessionMutations(true);
      });
      if (selectedEffect?.libraryEffectId === effect.libraryEffectId) {
        setSelectedEffect(null);
        setEffectEditorSnapshot(null);
      }
    },
    onCopyEffect: (effect: LibraryEffectSnapshot) => {
      setClipboard({ kind: 'effect', effect });
    },
    onRemoveEffect: async (effectId: string) => {
      if (!window.confirm('Remove this effect?')) return;
      const next = await window.blueAPI.updateEffectsLibrary({
        type: 'removeEffect',
        effectId,
      });
      setSnapshot(next);
      setHasSessionMutations(true);
      if (selectedEffect?.libraryEffectId === effectId) {
        setSelectedEffect(null);
        setEffectEditorSnapshot(null);
      }
    },
    onCutCategory: async (categoryId: string) => {
      const cat = findCategoryRecursive(snapshot?.root, categoryId);
      if (cat) setClipboard({ kind: 'category', snapshot: cat });
      const next = await window.blueAPI.updateEffectsLibrary({
        type: 'removeCategory',
        categoryId,
      });
      setSnapshot(next);
      setHasSessionMutations(true);
      setSelectedEffect(null);
      setEffectEditorSnapshot(null);
    },
    onCopyCategory: (categoryId: string) => {
      const cat = findCategoryRecursive(snapshot?.root, categoryId);
      if (cat) setClipboard({ kind: 'category', snapshot: cat });
    },
    onPaste: async (targetCategoryId: string) => {
      if (!clipboard) return;
      if (clipboard.kind === 'effect') {
        const next = await window.blueAPI.updateEffectsLibrary({
          type: 'pasteEffect',
          parentCategoryId: targetCategoryId,
          sourceEffect: clipboard.effect,
        });
        setSnapshot(next);
        setHasSessionMutations(true);
      } else {
        const next = await window.blueAPI.updateEffectsLibrary({
          type: 'pasteCategory',
          parentCategoryId: targetCategoryId,
          sourceSnapshot: clipboard.snapshot,
        });
        setSnapshot(next);
        setHasSessionMutations(true);
      }
    },
    onImportIntoCategory: async (categoryId: string) => {
      const next = await window.blueAPI.importEffectFile(categoryId);
      if (next) {
        setSnapshot(next);
        setHasSessionMutations(true);
      }
    },
    onExportEffect: async (effectId: string) => {
      await window.blueAPI.exportEffectFile(effectId);
    },
    canPaste: clipboard !== null,
    isRoot: (id: string) => id === 'root',
    addToMixerLabel: target ? `Add to ${target.channelId} / ${target.chain}` : null,
    onAddToMixer: handleAddToMixer,
  }), [clipboard, snapshot, selectedEffect, target, handleAddToMixer]);

  const treeNode = useMemo(
    () => (snapshot ? snapshotToTreeNodes(snapshot.root) : { id: 'empty', name: '', kind: 'category' as const }),
    [snapshot],
  );

  if (!open) return null;

  const treeContent = (
    <EffectLibraryTree
      rootNode={treeNode}
      selectedId={selectedEffect?.libraryEffectId}
      onSelectEffect={setSelectedEffect}
      onRename={handleRename}
      onMove={handleMove}
      contextActions={contextActions}
    />
  );

  const detailContent = effectEditorSnapshot ? (
    <EffectEditorPanel
      snapshot={effectEditorSnapshot}
      onPatch={handleEffectPatch}
      showNameField={false}
    />
  ) : (
    <EffectEditorPlaceholder />
  );

  const mainContent = snapshot ? (
    <SplitPane
      orientation="horizontal"
      ariaLabel="Effects Library split pane"
      initialSplit={0.28}
      minFirstSize={160}
      minSecondSize={300}
      firstClassName="h-full bg-app-bg"
      secondClassName="overflow-hidden"
      first={treeContent}
      second={detailContent}
    />
  ) : (
    <div className="flex h-full items-center justify-center p-4 text-sm text-blue-muted">
      {loading ? 'Loading effects library...' : 'No library data loaded.'}
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center bg-black/60"
      onClick={(event) => {
        if (event.target === event.currentTarget) closeEffectsLibrary();
      }}
    >
      <div className="flex h-[82vh] w-[88vw] max-w-7xl flex-col overflow-hidden rounded-md border border-app-border bg-app-overlay shadow-2xl">
        <div className="flex flex-none items-center justify-between gap-3 border-b border-app-border bg-app-surface-strong px-4 py-3">
          <div className="min-w-0">
            <div className="text-sm font-medium text-app-text-strong">Effects Library</div>
            {target && (
              <div className="text-xs text-app-text-muted">
                Target: {target.channelId} / {target.chain}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {target && selectedEffect && (
              <button
                type="button"
                className="toolbar-text-button"
                onClick={() => handleAddToMixer(selectedEffect)}
              >
                <Plus className="h-3.5 w-3.5" />
                Add to Mixer
              </button>
            )}
            <button type="button" className="toolbar-text-button" onClick={() => void handleImportEffect()}>
              <Upload className="h-3.5 w-3.5" />
              Import
            </button>
            <button
              type="button"
              className="toolbar-text-button"
              disabled={!selectedEffect}
              onClick={() => void handleExportEffect()}
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </button>
            <button type="button" className="toolbar-text-button" onClick={() => void handleReloadFromDisk()}>
              <RefreshCcw className="h-3.5 w-3.5" />
              Reload from Disk
            </button>
            <button
              type="button"
              className="toolbar-icon-button"
              onClick={closeEffectsLibrary}
              aria-label="Close effects library"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          {snapshot && !snapshot.loaded && snapshot.loadError ? (
            <div className="border-b border-app-border/60 bg-app-surface-raised px-4 py-3 text-sm text-app-text-muted">
              {snapshot.loadError}
            </div>
          ) : null}
          {mainContent}
        </div>

        <div className="flex flex-none items-center justify-between gap-3 border-t border-app-border bg-app-surface-strong px-4 py-2 text-[11px] text-app-text-muted">
          <div className="inline-flex items-center gap-2">
            <LibraryBig className="h-3.5 w-3.5" />
            Session-only mutations. No writes to `~/.blue`.
            {hasSessionMutations && (
              <span className="text-app-warning">Unsaved changes</span>
            )}
          </div>
          <div>{snapshot?.loaded ? 'Loaded' : 'Using fallback empty library'}</div>
        </div>
      </div>
    </div>
  );
}
