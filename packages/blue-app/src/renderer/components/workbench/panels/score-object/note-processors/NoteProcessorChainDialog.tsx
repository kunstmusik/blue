import React, { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { NoteProcessorChainSnapshot } from '../../../../../../shared/project-editor';
import { useProjectStore } from '../../../../../stores/project-store';
import NoteProcessorChainEditor from './NoteProcessorChainEditor';
import { useDialogFocus } from '../../../../dialogs/use-dialog-focus';

interface NoteProcessorChainDialogProps {
  title: string;
  chain: NoteProcessorChainSnapshot;
  onClose: () => void;
  onCommit: (chain: NoteProcessorChainSnapshot) => void;
}

export default function NoteProcessorChainDialog({
  title,
  chain,
  onClose,
  onCommit,
}: NoteProcessorChainDialogProps): React.ReactElement {
  const [localChain, setLocalChain] = useState<NoteProcessorChainSnapshot>(chain);
  const [namedChainNames, setNamedChainNames] = useState<string[]>([]);
  const applyProjectDocumentPatch = useProjectStore((s) => s.applyProjectDocumentPatch);
  const dialogRef = useDialogFocus(true, onClose);

  useEffect(() => {
    window.blueAPI
      .getNamedChainNames()
      .then((names) => {
        if (names) setNamedChainNames(names);
      })
      .catch(() => {});
  }, []);

  const handleCommit = useCallback((updated: NoteProcessorChainSnapshot) => {
    setLocalChain(updated);
  }, []);

  const handleSave = useCallback(() => {
    onCommit(localChain);
    onClose();
  }, [localChain, onCommit, onClose]);

  const handleImportNamedChain = useCallback(
    async (name: string): Promise<NoteProcessorChainSnapshot | null> => {
      try {
        const result = await window.blueAPI.getNamedChain(name);
        return result ?? null;
      } catch {
        return null;
      }
    },
    [],
  );

  const handleSaveNamedChain = useCallback(
    (name: string, chainToSave: NoteProcessorChainSnapshot) => {
      void applyProjectDocumentPatch({
        score: { type: 'saveNamedNoteProcessorChain', name, chain: chainToSave },
      });
      setNamedChainNames((prev) => (prev.includes(name) ? prev : [...prev, name]));
    },
    [applyProjectDocumentPatch],
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="note-processor-chain-dialog-title"
        className="bg-blue-bg border border-blue-border rounded-lg shadow-xl w-[420px] max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-blue-border">
          <h3
            id="note-processor-chain-dialog-title"
            className="text-role-title-3 font-semibold text-gray-200"
          >
            {title}
          </h3>
          <button
            className="rounded p-1 text-gray-400 hover:text-gray-200 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-app-focus"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1">
          <NoteProcessorChainEditor
            chain={localChain}
            onCommit={handleCommit}
            namedChainNames={namedChainNames}
            onImportNamedChain={handleImportNamedChain}
            onSaveNamedChain={handleSaveNamedChain}
          />
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-blue-border">
          <button
            className="px-3 py-1.5 text-role-body rounded border border-blue-border text-gray-300 hover:bg-blue-border/40 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-app-focus"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-3 py-1.5 text-role-body rounded bg-blue-accent text-white hover:bg-blue-accent/80 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-app-focus"
            onClick={handleSave}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
