import React from 'react';
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
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex h-[400px] w-[760px] max-w-[calc(100vw-32px)] flex-col rounded-lg border border-app-border bg-app-overlay shadow-2xl">
        <div className="flex items-center justify-between border-b border-app-border px-4 py-3">
          <h2 className="text-sm font-medium text-app-text-bright">Generated Score</h2>
          <button
            className="px-2 text-lg leading-none text-app-text-muted hover:text-app-text-bright"
            onClick={onClose}
            aria-label="Close"
          >
            x
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
