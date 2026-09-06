import React from 'react';
import { X } from 'lucide-react';
import SelectedCodeEditor from '../editors/SelectedCodeEditor';
import { useDialogFocus } from '../../../dialogs/use-dialog-focus';

export default function GeneratedInstrumentModal({
  text,
  onClose,
}: {
  text: string;
  onClose: () => void;
}): React.ReactElement {
  const dialogRef = useDialogFocus(true, onClose);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="generated-instrument-title"
        className="flex h-[400px] w-[760px] max-w-[calc(100vw-32px)] flex-col rounded-lg border border-app-border bg-app-overlay shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-app-border px-4 py-3">
          <h2
            id="generated-instrument-title"
            className="text-role-title-2 font-bold text-app-text-bright"
          >
            Generated Instrument
          </h2>
          <button
            className="rounded p-1 text-role-body text-app-text-muted hover:text-app-text-bright focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-app-focus"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1">
          <SelectedCodeEditor
            value={text.length > 0 ? text : '; empty instrument'}
            onChange={() => {}}
            ariaLabel="Generated instrument"
            readOnly
            mode="orc"
          />
        </div>
      </div>
    </div>
  );
}
