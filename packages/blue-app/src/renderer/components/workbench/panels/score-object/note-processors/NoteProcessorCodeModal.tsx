import React, { useCallback, useEffect, useState } from 'react';
import SelectedCodeEditor from '../../editors/SelectedCodeEditor';

interface NoteProcessorCodeModalProps {
  title?: string;
  code: string;
  onClose: () => void;
  onSave: (updatedCode: string) => void;
}

export default function NoteProcessorCodeModal({
  title = 'Edit Python Code',
  code,
  onClose,
  onSave,
}: NoteProcessorCodeModalProps): React.ReactElement {
  const [localCode, setLocalCode] = useState<string>(code);

  const handleSave = useCallback(() => {
    onSave(localCode);
    onClose();
  }, [localCode, onSave, onClose]);

  useEffect(() => {
    const onWindowKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', onWindowKeyDown);
    return () => window.removeEventListener('keydown', onWindowKeyDown);
  }, [onClose, handleSave]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="note-processor-code-title"
    >
      <div
        className="flex h-[75vh] min-h-[420px] max-h-[85vh] w-[760px] max-w-[calc(100vw-32px)] flex-col rounded-lg border border-blue-border bg-blue-bg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-blue-border px-4 py-3">
          <h2 id="note-processor-code-title" className="text-sm font-medium text-gray-200">
            {title}
          </h2>
          <button
            type="button"
            className="text-lg leading-none text-gray-400 hover:text-gray-200"
            onClick={onClose}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Code editor body */}
        <div className="min-h-0 flex-1 p-3">
          <SelectedCodeEditor
            value={localCode}
            onChange={setLocalCode}
            mode="python"
            placeholder="Enter Python code..."
            ariaLabel="Python code editor"
          />
        </div>

        {/* Footer actions */}
        <div className="flex justify-end gap-2 border-t border-blue-border px-4 py-3">
          <button
            type="button"
            className="rounded border border-blue-border px-3 py-1.5 text-body text-gray-300 hover:bg-blue-border/40"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded bg-blue-accent px-3 py-1.5 text-body text-white hover:bg-blue-accent/80"
            onClick={handleSave}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
