import React, { useState, useEffect, useCallback } from 'react';
import { convertFTableToFtgen } from './ftable-converter';

const SECONDARY_BUTTON_CLASS =
  'rounded border border-app-border/40 bg-app-surface px-3 py-1 text-role-body text-app-text transition-colors hover:bg-app-hover';

export default function FTableConverterModal(): React.ReactElement | null {
  const [isOpen, setIsOpen] = useState(false);
  const [fStatementText, setFStatementText] = useState('');
  const [ftgenText, setFtgenText] = useState('');

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('blue-open-ftable-converter', handleOpen);
    return () => window.removeEventListener('blue-open-ftable-converter', handleOpen);
  }, []);

  const handleConvert = useCallback(() => {
    setFtgenText(convertFTableToFtgen(fStatementText));
  }, [fStatementText]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    },
    [handleClose],
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={handleClose}
    >
      <div
        className="flex h-[75vh] w-[700px] max-w-[90vw] flex-col rounded-lg border border-app-border/40 bg-app-menu p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-role-title-2 font-bold text-app-text-bright">FTable Converter</h2>
          <button
            className="px-2 text-role-title-2 text-app-text-muted hover:text-app-text-bright"
            onClick={handleClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-3 min-h-0">
          <div className="flex flex-1 flex-col min-h-0">
            <label className="mb-1 text-role-callout text-app-text-muted font-medium">
              f-Statements (Input)
            </label>
            <textarea
              className="flex-1 rounded border border-app-border/30 bg-app-field p-2 font-mono text-role-body text-app-text outline-none focus:border-app-border/60 resize-none"
              placeholder="e.g. f 1 0 1024 10 1"
              value={fStatementText}
              onChange={(e) => setFStatementText(e.target.value)}
            />
          </div>

          <div className="flex justify-end">
            <button
              className="rounded border border-app-border/30 bg-app-surface px-4 py-1.5 text-role-body font-medium text-app-text hover:bg-app-hover active:bg-app-hover/80 transition-colors"
              onClick={handleConvert}
            >
              Convert to FTGEN
            </button>
          </div>

          <div className="flex flex-1 flex-col min-h-0">
            <label className="mb-1 text-role-callout text-app-text-muted font-medium">
              ftgen Statements (Output)
            </label>
            <textarea
              className="flex-1 rounded border border-app-border/30 bg-app-field p-2 font-mono text-role-body text-app-text outline-none focus:border-app-border/60 resize-none"
              placeholder="gi_ ftgen 0, 0, 1024, 10, 1"
              value={ftgenText}
              onChange={(e) => setFtgenText(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button className={SECONDARY_BUTTON_CLASS} onClick={handleClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
