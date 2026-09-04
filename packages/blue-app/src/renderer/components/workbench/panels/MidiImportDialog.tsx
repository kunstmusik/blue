import React, { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { isMidiImportInstrumentIdZero } from '@blue/data';
import type { MidiImportPreview, MidiImportSettings } from '../../../../shared/midi-import';
import MidiImportStreamTable from './MidiImportStreamTable';

const PRIMARY_BUTTON_CLASS =
  'rounded border border-app-border/40 bg-app-accent/20 px-4 py-1.5 text-role-body font-medium text-app-text hover:bg-app-accent/30 active:bg-app-accent/40 transition-colors disabled:cursor-not-allowed disabled:opacity-50';
const SECONDARY_BUTTON_CLASS =
  'rounded border border-app-border/40 bg-app-surface px-3 py-1.5 text-role-body text-app-text transition-colors hover:bg-app-hover disabled:cursor-not-allowed disabled:opacity-50';

function createDefaultRows(preview: MidiImportPreview): MidiImportSettings[] {
  return preview.streams.map((stream) => ({ ...stream.defaults }));
}

export default function MidiImportDialog(): React.ReactElement | null {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [preview, setPreview] = useState<MidiImportPreview | null>(null);
  const [rows, setRows] = useState<MidiImportSettings[]>([]);
  const [error, setError] = useState<string | null>(null);

  const beginImport = useCallback(async () => {
    if (!window.blueAPI?.startMidiImport) return;
    setIsOpen(true);
    setIsLoading(true);
    setIsSubmitting(false);
    setError(null);
    setPreview(null);
    setRows([]);

    try {
      const result = await window.blueAPI.startMidiImport();
      if (result.status === 'cancelled') {
        setIsOpen(false);
        setIsLoading(false);
        return;
      }
      if (result.status === 'error') {
        setError(result.message);
        setIsLoading(false);
        return;
      }

      setToken(result.token);
      setPreview(result.preview);
      setRows(createDefaultRows(result.preview));
      setIsLoading(false);
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : String(startError));
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const handleOpen = () => {
      void beginImport();
    };
    window.addEventListener('blue-open-midi-import', handleOpen);
    return () => window.removeEventListener('blue-open-midi-import', handleOpen);
  }, [beginImport]);

  const close = useCallback(() => {
    const currentToken = token;
    setIsOpen(false);
    setIsLoading(false);
    setIsSubmitting(false);
    setToken(null);
    setPreview(null);
    setRows([]);
    setError(null);
    if (currentToken && window.blueAPI?.cancelMidiImport) {
      void window.blueAPI.cancelMidiImport(currentToken);
    }
  }, [token]);

  const updateRow = useCallback((streamKey: string, patch: Partial<MidiImportSettings>) => {
    setRows((currentRows) =>
      currentRows.map((row) => (row.streamKey === streamKey ? { ...row, ...patch } : row)),
    );
  }, []);

  const submit = useCallback(async () => {
    if (!token || !window.blueAPI?.commitMidiImport) return;
    const invalidRow = rows.find(
      (row) =>
        row.instrumentId.trim().length === 0 ||
        isMidiImportInstrumentIdZero(row.instrumentId) ||
        row.noteTemplate.trim().length === 0,
    );
    if (invalidRow) {
      setError(
        isMidiImportInstrumentIdZero(invalidRow.instrumentId)
          ? `Instrument ID must not be zero for ${invalidRow.streamKey}.`
          : `Instrument ID and note template are required for ${invalidRow.streamKey}.`,
      );
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const result = await window.blueAPI.commitMidiImport(token, rows);
      if (result.status === 'installed') {
        setIsOpen(false);
        setIsSubmitting(false);
        setToken(null);
        setPreview(null);
        setRows([]);
        return;
      }
      if (result.status === 'error') {
        setError(result.message);
      }
    } catch (commitError) {
      setError(commitError instanceof Error ? commitError.message : String(commitError));
    }
    setIsSubmitting(false);
  }, [rows, token]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmitting) {
        event.preventDefault();
        close();
      }
    },
    [close, isSubmitting],
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) close();
      }}
      onKeyDown={handleKeyDown}
    >
      <div className="flex max-h-[85vh] w-[960px] max-w-[94vw] flex-col rounded-lg border border-app-border/40 bg-app-menu p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-role-title-2 font-bold text-app-text-bright">
              MIDI Import Settings
            </h2>
            {preview ? (
              <p className="mt-1 text-role-callout text-app-text-muted">
                {preview.fileName} · format {preview.format} · {preview.ticksPerBeat} PPQ
              </p>
            ) : null}
          </div>
          <button
            className="p-1 text-role-body text-app-text-muted hover:text-app-text-bright disabled:opacity-50"
            onClick={close}
            disabled={isSubmitting}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex min-h-[220px] items-center justify-center text-role-body text-app-text-muted">
            Reading MIDI file…
          </div>
        ) : (
          <>
            {error ? (
              <div
                className="mb-3 rounded border border-red-400/40 bg-red-400/10 px-3 py-2 text-role-callout text-red-200"
                role="alert"
              >
                {error}
              </div>
            ) : null}
            {preview ? (
              <MidiImportStreamTable preview={preview} rows={rows} onUpdate={updateRow} />
            ) : null}
            <p className="mt-2 text-role-callout text-app-text-muted">
              Trim removes leading silence for that stream: its layer starts at the first note,
              while the first note is written at beat 0.
            </p>

            <details className="mt-3 text-role-callout text-app-text-muted">
              <summary className="cursor-pointer text-app-text">Template placeholders</summary>
              <p className="mt-1">
                Use &lt;INSTR_ID&gt;, &lt;START&gt;, &lt;DUR&gt;, &lt;KEY&gt;, &lt;KEY_PCH&gt;,
                &lt;KEY_OCT&gt;, &lt;KEY_CPS&gt;, &lt;VELOCITY&gt;, or &lt;VELOCITY_AMP&gt;.
              </p>
            </details>

            <div className="mt-4 flex justify-end gap-2">
              <button className={SECONDARY_BUTTON_CLASS} onClick={close} disabled={isSubmitting}>
                Cancel
              </button>
              <button
                className={PRIMARY_BUTTON_CLASS}
                onClick={() => {
                  void submit();
                }}
                disabled={isSubmitting || rows.length === 0}
              >
                {isSubmitting ? 'Importing…' : 'Import'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
