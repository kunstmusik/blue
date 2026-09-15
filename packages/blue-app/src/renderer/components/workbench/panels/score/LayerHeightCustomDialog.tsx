import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useDialogFocus } from '../../../dialogs/use-dialog-focus';
import { MIN_LAYER_HEIGHT, MAX_LAYER_HEIGHT } from './layer-selection-utils';

const SECONDARY_BUTTON_CLASS =
  'rounded border border-app-border/40 bg-app-surface px-3 py-1 text-role-body text-app-text transition-colors hover:bg-app-hover focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-app-focus cursor-pointer';

const PRIMARY_BUTTON_CLASS =
  'rounded border border-app-accent/60 bg-app-accent px-3 py-1 text-role-body text-white transition-colors hover:bg-app-accent/80 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-app-focus cursor-pointer';

export interface LayerHeightCustomDialogProps {
  initialHeight?: number;
  title?: string;
  onConfirm: (height: number) => void;
  onClose: () => void;
}

export const LayerHeightCustomDialog: React.FC<LayerHeightCustomDialogProps> = ({
  initialHeight,
  title = 'Set Custom Layer Height',
  onConfirm,
  onClose,
}) => {
  const [heightText, setHeightText] = useState(
    initialHeight !== undefined ? String(initialHeight) : '',
  );
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const dialogRef = useDialogFocus(true, onClose, {
    initialFocusSelector: '#custom-layer-height-input',
  });

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const handleApply = useCallback(() => {
    const trimmed = heightText.trim();
    if (!trimmed) {
      setError('Height cannot be empty.');
      return;
    }

    if (!/^\s*[0-9]+\s*$/.test(trimmed)) {
      setError('Height must be an integer.');
      return;
    }

    const val = Number.parseInt(trimmed, 10);
    if (!Number.isInteger(val)) {
      setError('Height must be an integer.');
      return;
    }

    if (val < MIN_LAYER_HEIGHT || val > MAX_LAYER_HEIGHT) {
      setError(`Height must be between ${MIN_LAYER_HEIGHT} and ${MAX_LAYER_HEIGHT} pixels.`);
      return;
    }

    setError(null);
    onConfirm(val);
    onClose();
  }, [heightText, onConfirm, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleApply();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [handleApply, onClose],
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
        aria-labelledby="custom-layer-height-dialog-title"
        className="min-w-72 rounded-lg border border-app-border/40 bg-app-menu p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <h3
          id="custom-layer-height-dialog-title"
          className="mb-3 text-role-title-3 font-semibold text-app-text"
        >
          {title}
        </h3>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label
              htmlFor="custom-layer-height-input"
              className="text-role-body text-app-text-muted whitespace-nowrap"
            >
              Height (px):
            </label>
            <input
              id="custom-layer-height-input"
              ref={inputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={heightText}
              onChange={(e) => {
                setHeightText(e.target.value);
                setError(null);
              }}
              className="w-full rounded border border-app-border/30 bg-app-field px-2 py-1 text-role-body text-app-text outline-none focus:border-app-border/60"
            />
          </div>
          <p className="text-role-callout text-app-text-muted">
            Range: {MIN_LAYER_HEIGHT} – {MAX_LAYER_HEIGHT} pixels
          </p>
          {error && <p className="text-role-callout text-app-danger">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button data-cancel-dialog className={SECONDARY_BUTTON_CLASS} onClick={onClose}>
            Cancel
          </button>
          <button data-apply-dialog className={PRIMARY_BUTTON_CLASS} onClick={handleApply}>
            Apply
          </button>
        </div>
      </div>
    </div>
  );
};
