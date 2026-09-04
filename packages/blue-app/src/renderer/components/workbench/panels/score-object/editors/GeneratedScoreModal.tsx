import React from 'react';
import { X } from 'lucide-react';
import SelectedCodeEditor from '../../editors/SelectedCodeEditor';

export default function GeneratedScoreModal({
  text,
  onClose,
}: {
  text: string;
  onClose: () => void;
}): React.ReactElement {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex h-[400px] w-[760px] max-w-[calc(100vw-32px)] flex-col rounded-lg border border-app-border bg-app-overlay shadow-2xl">
        <div className="flex items-center justify-between border-b border-app-border px-4 py-3">
          <h2 className="text-role-title-2 font-bold text-app-text-bright">Generated Score</h2>
          <button
            className="rounded p-1 text-app-text-muted hover:bg-app-hover hover:text-app-text-bright"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1">
          <SelectedCodeEditor
            value={text.length > 0 ? text : '; no notes'}
            onChange={() => {}}
            ariaLabel="Generated score"
            readOnly
            mode="sco"
          />
        </div>
      </div>
    </div>
  );
}
