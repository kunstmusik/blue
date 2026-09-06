import { useState, useCallback, useEffect, useRef } from 'react';
import { DraftNumberInput } from '../../../CommitNumberInput';
import { useDialogFocus } from '../../../dialogs/use-dialog-focus';

const SECONDARY_BUTTON_CLASS =
  'rounded border border-app-border/40 bg-app-surface px-3 py-1 text-role-body text-app-text transition-colors hover:bg-app-hover focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-app-focus';

interface ShiftObjectsDialogProps {
  onConfirm: (amountBeats: number) => void;
  onClose: () => void;
  minStartBeats?: number;
}

export default function ShiftObjectsDialog({
  onConfirm,
  onClose,
  minStartBeats = 0,
}: ShiftObjectsDialogProps) {
  const [shiftText, setShiftText] = useState('0');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useDialogFocus(true, onClose, {
    initialFocusSelector: '#shift-by-beats-input',
  });

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const handleOk = useCallback(() => {
    const amount = Number(shiftText);
    if (!Number.isFinite(amount)) {
      setError('Shift must be a valid number of beats.');
      return;
    }
    if (minStartBeats + amount < 0) {
      setError('Shift would move an object before beat 0.');
      return;
    }
    setError(null);
    onConfirm(amount);
    onClose();
  }, [shiftText, minStartBeats, onConfirm, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleOk();
      }
    },
    [handleOk],
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
        aria-labelledby="shift-objects-dialog-title"
        className="min-w-64 rounded-lg border border-app-border/40 bg-app-menu p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <h3
          id="shift-objects-dialog-title"
          className="mb-3 text-role-title-3 font-semibold text-app-text"
        >
          Shift Selected Objects
        </h3>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label
              htmlFor="shift-by-beats-input"
              className="text-role-body text-app-text-muted whitespace-nowrap"
            >
              Shift by beats:
            </label>
            <DraftNumberInput
              id="shift-by-beats-input"
              aria-label="Shift by beats"
              ref={inputRef}
              step="any"
              stepBase={0}
              className="w-full rounded border border-app-border/30 bg-app-field px-2 py-1 text-role-body text-app-text outline-none focus:border-app-border/60"
              containerClassName="flex-1"
              value={shiftText}
              onChange={(val) => {
                setShiftText(val);
                setError(null);
              }}
              resolveStep={(text) => {
                const amount = Number(text);
                return Number.isFinite(amount) ? amount : 0;
              }}
            />
          </div>
          {error && <p className="text-role-callout text-app-danger">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button className={SECONDARY_BUTTON_CLASS} onClick={onClose}>
            Cancel
          </button>
          <button
            className="rounded border border-app-border/30 bg-app-surface px-3 py-1 text-role-body text-app-text hover:bg-app-hover focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-app-focus"
            onClick={handleOk}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
