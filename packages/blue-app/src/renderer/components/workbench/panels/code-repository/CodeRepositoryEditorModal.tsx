import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import CodeRepositoryDialog from './CodeRepositoryDialog';
import { useCodeRepositoryStore } from '../../../../stores/code-repository-store';

/**
 * Self-opening modal wrapper for the Code Repository Editor. Listens for the
 * `blue-open-code-repository-editor` window event (dispatched from the Tools
 * menu), loads the canonical snapshot, and renders the split-pane editor.
 * Mirrors CsoundRCEditorModal's open/close conventions.
 *
 * Always opens on the event so the user gets feedback; if the snapshot is
 * unavailable (storage not initialized or failed), the dialog surfaces a clear
 * message instead of vanishing silently.
 */
export default function CodeRepositoryEditorModal(): React.ReactElement | null {
  const [isOpen, setIsOpen] = useState(false);
  const [draftResetToken, setDraftResetToken] = useState(0);
  const [newSnippetCode, setNewSnippetCode] = useState('Insert your code here');
  const snapshot = useCodeRepositoryStore((s) => s.snapshot);
  const loading = useCodeRepositoryStore((s) => s.loading);
  const loadError = useCodeRepositoryStore((s) => s.loadError);
  const openEditor = useCodeRepositoryStore((s) => s.openEditor);
  const save = useCodeRepositoryStore((s) => s.save);
  const closeEditor = useCodeRepositoryStore((s) => s.closeEditor);
  const importFile = useCodeRepositoryStore((s) => s.importFile);
  const retry = useCodeRepositoryStore((s) => s.retry);
  const conflict = useCodeRepositoryStore((s) => s.conflict);
  const reloadConflict = useCodeRepositoryStore((s) => s.reloadConflict);
  const status = useCodeRepositoryStore((s) => s.status);

  const loadNewSnippetDefault = useCallback(async () => {
    const getProgramSettings = window.blueAPI?.getProgramSettings;
    if (!getProgramSettings) return;
    try {
      const settings = await getProgramSettings();
      setNewSnippetCode(settings.general.newUserDefaultsEnabled ? 'Insert your code here' : '');
    } catch {
      // Keep the Java-compatible enabled default when settings are unavailable.
    }
  }, []);

  useEffect(() => {
    const handleOpen = () => {
      // Open immediately so the user sees feedback, then refresh the snapshot.
      setIsOpen(true);
      void loadNewSnippetDefault();
      void openEditor().catch((error) => {
        toast.error(`Failed to load Code Repository: ${String(error)}`);
      });
    };
    window.addEventListener('blue-open-code-repository-editor', handleOpen);
    return () => window.removeEventListener('blue-open-code-repository-editor', handleOpen);
  }, [loadNewSnippetDefault, openEditor]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    closeEditor();
  }, [closeEditor]);

  const handleSave = useCallback(
    async (root: Parameters<React.ComponentProps<typeof CodeRepositoryDialog>['onSave']>[0]) => {
      const result = await save(root);
      if (result.ok) return { ok: true as const };
      return { ok: false as const, error: { message: result.error.message } };
    },
    [save],
  );

  const handleExport = useCallback(async () => {
    if (!window.blueAPI?.exportCodeRepositoryXml) return;
    try {
      const result = await window.blueAPI.exportCodeRepositoryXml();
      if (result && result.ok) {
        toast.success(`Exported ${result.value.basename}`);
      } else if (result && !result.ok) {
        toast.error(result.error.message);
      }
    } catch (err) {
      toast.error(`Export failed: ${String(err)}`);
    }
  }, []);

  const handleImport = useCallback(async () => {
    const result = await importFile();
    if (result === null) return;
    if (result.ok) {
      setDraftResetToken((value) => value + 1);
      toast.success('Code Repository imported');
    } else {
      toast.error(result.error.message);
    }
  }, [importFile]);

  const handleRetry = useCallback(async () => {
    try {
      await retry();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Code Repository retry failed');
    }
  }, [retry]);

  if (!isOpen) return null;

  // Surface a clear message when the snapshot is unavailable rather than
  // rendering nothing — the user clicked the menu and expects feedback.
  if (!snapshot) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={handleClose}>
        <div
          className="flex w-[440px] max-w-[90vw] flex-col rounded-lg border border-app-border/40 bg-app-menu p-6 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="code-repository-unavailable-title"
          onKeyDown={(event) => {
            if (event.key === 'Escape') handleClose();
          }}
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 id="code-repository-unavailable-title" className="text-sm font-medium text-app-text-bright">
              Code Repository Editor
            </h2>
            <button
              type="button"
              className="px-2 text-lg leading-none text-app-text-muted hover:text-app-text-bright"
              onClick={handleClose}
              aria-label="Close"
              autoFocus
            >
              ×
            </button>
          </div>
          <p className="break-words text-ui text-app-text-muted" role="status">
            {loading ? 'Loading the Code Repository…' : (loadError?.message ?? 'The Code Repository is not available.')}
          </p>
          <div className="mt-4 flex justify-end gap-2">
            {!loading && (
              <button
                type="button"
                className="rounded border border-app-border/40 bg-app-surface px-3 py-1.5 text-ui text-app-text hover:bg-app-hover"
                onClick={() => void handleImport()}
              >
                Recover from XML…
              </button>
            )}
            {!loading && (
              <button
                type="button"
                className="rounded border border-app-border/40 bg-app-surface px-3 py-1.5 text-ui text-app-text hover:bg-app-hover"
                onClick={() => void handleRetry()}
              >
                Retry
              </button>
            )}
            <button
              type="button"
              className="rounded border border-app-border/40 bg-app-surface px-3 py-1.5 text-ui text-app-text hover:bg-app-hover"
              onClick={handleClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <CodeRepositoryDialog
      snapshot={snapshot}
      onClose={handleClose}
      onSave={handleSave}
      onExport={handleExport}
      onImport={handleImport}
      onRetry={handleRetry}
      draftResetToken={draftResetToken}
      migrationDiagnostic={status?.diagnostic}
      conflict={conflict}
      onReloadConflict={() => {
        reloadConflict();
        setDraftResetToken((value) => value + 1);
      }}
      newSnippetCode={newSnippetCode}
    />
  );
}
