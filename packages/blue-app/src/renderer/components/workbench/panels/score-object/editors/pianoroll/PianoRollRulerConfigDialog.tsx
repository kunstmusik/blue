import React, { useEffect, useState } from 'react';
import { TIME_DISPLAY_OPTIONS } from './types';

const SECONDARY_BUTTON_CLASS = 'px-3 py-1 text-ui text-blue-text bg-blue-surface/40 hover:bg-blue-surface/70 rounded border border-blue-border/40 transition-colors cursor-pointer';

export interface PianoRollRulerConfigChanges {
  useGlobalRuler: boolean;
  primaryTimeDisplay: string;
  secondaryRulerEnabled: boolean;
  secondaryTimeDisplay: string;
}

interface PianoRollRulerConfigDialogProps {
  useGlobalRuler: boolean;
  primaryTimeDisplay: string;
  secondaryRulerEnabled: boolean;
  secondaryTimeDisplay: string;
  onApply: (changes: PianoRollRulerConfigChanges) => void;
  onClose: () => void;
}

export default function PianoRollRulerConfigDialog({
  useGlobalRuler: initialUseGlobalRuler,
  primaryTimeDisplay: initialPrimaryTimeDisplay,
  secondaryRulerEnabled: initialSecondaryRulerEnabled,
  secondaryTimeDisplay: initialSecondaryTimeDisplay,
  onApply,
  onClose,
}: PianoRollRulerConfigDialogProps): React.ReactElement {
  const [useGlobalRuler, setUseGlobalRuler] = useState(initialUseGlobalRuler);
  const [primaryTimeDisplay, setPrimaryTimeDisplay] = useState(initialPrimaryTimeDisplay);
  const [secondaryRulerEnabled, setSecondaryRulerEnabled] = useState(initialSecondaryRulerEnabled);
  const [secondaryTimeDisplay, setSecondaryTimeDisplay] = useState(initialSecondaryTimeDisplay);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleOk = () => {
    onApply({
      useGlobalRuler,
      primaryTimeDisplay,
      secondaryRulerEnabled,
      secondaryTimeDisplay,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-sm rounded-lg border border-blue-border/50 bg-app-menu text-blue-text shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 space-y-4">
          <h2 className="text-sm font-semibold border-b border-blue-border/30 pb-2">PianoRoll Ruler Configuration</h2>

          <label className="flex items-center gap-2 text-ui text-blue-text cursor-pointer">
            <input
              type="checkbox"
              className="w-3.5 h-3.5 cursor-pointer"
              checked={useGlobalRuler}
              onChange={(e) => setUseGlobalRuler(e.target.checked)}
            />
            Use Global Ruler Settings
          </label>

          <fieldset className="space-y-3 rounded border border-blue-border/35 px-3 pb-3 pt-2">
            <legend className="px-1 text-body font-bold text-blue-text">Local Ruler Settings</legend>

            <div className="space-y-2">
              <div className="text-body font-bold text-blue-text">Primary Ruler</div>
              <div className="flex items-center gap-2">
                <label className="text-ui text-blue-muted w-16 shrink-0">Format:</label>
                <select
                  className="flex-1 bg-blue-surface border border-blue-border/40 rounded px-2 py-1 text-ui text-blue-text cursor-pointer disabled:opacity-50"
                  value={primaryTimeDisplay}
                  onChange={(e) => setPrimaryTimeDisplay(e.target.value)}
                  disabled={useGlobalRuler}
                >
                  {TIME_DISPLAY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-body font-bold text-blue-text">Secondary Ruler</div>
              <label className="flex items-center gap-2 text-ui text-blue-text cursor-pointer">
                <input
                  type="checkbox"
                  className="w-3.5 h-3.5 cursor-pointer disabled:opacity-50"
                  checked={secondaryRulerEnabled}
                  onChange={(e) => setSecondaryRulerEnabled(e.target.checked)}
                  disabled={useGlobalRuler}
                />
                Enabled
              </label>
              <div className="flex items-center gap-2">
                <label className="text-ui text-blue-muted w-16 shrink-0">Format:</label>
                <select
                  className="flex-1 bg-blue-surface border border-blue-border/40 rounded px-2 py-1 text-ui text-blue-text cursor-pointer disabled:opacity-50"
                  value={secondaryTimeDisplay}
                  onChange={(e) => setSecondaryTimeDisplay(e.target.value)}
                  disabled={useGlobalRuler || !secondaryRulerEnabled}
                >
                  {TIME_DISPLAY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </fieldset>

          <div className="flex justify-end gap-2 pt-2 border-t border-blue-border/30">
            <button
              className={SECONDARY_BUTTON_CLASS}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="px-3 py-1 text-ui text-blue-text bg-blue-accent/20 hover:bg-blue-accent/30 rounded transition-colors font-medium cursor-pointer"
              onClick={handleOk}
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
