import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useDialogFocus } from '../../../dialogs/use-dialog-focus';

const PRIMARY_BUTTON_CLASS =
  'rounded border border-app-border/40 bg-app-accent/20 px-4 py-1.5 text-role-body font-medium text-app-text hover:bg-app-accent/30 active:bg-app-accent/40 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-app-focus';
const SECONDARY_BUTTON_CLASS =
  'rounded border border-app-border/40 bg-app-surface px-3 py-1.5 text-role-body text-app-text transition-colors hover:bg-app-hover focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-app-focus';

export default function CsoundRCEditorModal(): React.ReactElement | null {
  const [isOpen, setIsOpen] = useState(false);
  const [filePath, setFilePath] = useState('');
  const [content, setContent] = useState('');

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const dialogRef = useDialogFocus(isOpen, handleClose);

  const loadCsoundRC = useCallback(async () => {
    if (!window.blueAPI?.readCsoundRC) return;
    try {
      const res = await window.blueAPI.readCsoundRC();
      setFilePath(res.filePath);
      setContent(res.content);
    } catch {
      toast.error('Failed to read .csound7rc file');
    }
  }, []);

  useEffect(() => {
    const handleOpen = () => {
      setIsOpen(true);
      void loadCsoundRC();
    };
    window.addEventListener('blue-open-csoundrc-editor', handleOpen);
    return () => window.removeEventListener('blue-open-csoundrc-editor', handleOpen);
  }, [loadCsoundRC]);

  const handleSave = useCallback(async () => {
    if (!window.blueAPI?.writeCsoundRC) return;
    try {
      const res = await window.blueAPI.writeCsoundRC(content);
      if (res.success) {
        toast.success(`Saved ${res.filePath}`);
        setIsOpen(false);
      }
    } catch (err) {
      toast.error(`Failed to save .csound7rc: ${String(err)}`);
    }
  }, [content]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={handleClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="csoundrc-editor-title"
        className="flex h-[75vh] w-[700px] max-w-[90vw] flex-col rounded-lg border border-app-border/40 bg-app-menu p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2
            id="csoundrc-editor-title"
            className="text-role-title-2 font-bold text-app-text-bright"
          >
            .csound7rc Editor
          </h2>
          <button
            className="rounded px-2 text-role-title-2 text-app-text-muted hover:text-app-text-bright focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-app-focus"
            onClick={handleClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="flex flex-1 flex-col min-h-0">
          <textarea
            className="flex-1 rounded border border-app-border/30 bg-app-field p-2 font-mono text-role-body text-app-text outline-none focus:border-app-border/60 resize-none"
            placeholder="Csound runtime configuration flags (e.g. -m0 -d)"
            aria-label=".csound7rc configuration content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-between mt-4">
          <span
            className="text-role-callout text-app-text-muted truncate max-w-[400px]"
            title={filePath}
          >
            {filePath}
          </span>
          <div className="flex gap-2">
            <button className={SECONDARY_BUTTON_CLASS} onClick={handleClose}>
              Cancel
            </button>
            <button className={PRIMARY_BUTTON_CLASS} onClick={() => void handleSave()}>
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
