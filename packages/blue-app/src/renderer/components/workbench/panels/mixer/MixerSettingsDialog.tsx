import React from 'react';
import { createPortal } from 'react-dom';
import { usePortalContainer } from '../../../../hooks/use-host-document';
import { useDialogFocus } from '../../../dialogs/use-dialog-focus';
import { portalEventIsolationProps } from '../../../../hooks/host-portals';

export interface MixerSettingsDialogProps {
  readonly isOpen: boolean;
  readonly enableMeters: boolean;
  readonly onToggleEnableMeters: (enabled: boolean) => void;
  readonly onClose: () => void;
}

export function MixerSettingsDialog({
  isOpen,
  enableMeters,
  onToggleEnableMeters,
  onClose,
}: MixerSettingsDialogProps): React.ReactElement | null {
  const container = usePortalContainer();
  const dialogRef = useDialogFocus(isOpen, onClose, {
    initialFocusSelector: 'input[type="checkbox"]',
  });

  if (!isOpen || !container) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 mixer-settings-dialog-backdrop"
      onClick={onClose}
      {...portalEventIsolationProps}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mixer-settings-dialog-title"
        className="w-96 rounded-lg border border-blue-border/50 bg-blue-bg shadow-2xl overflow-hidden focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-blue-border/30 px-4 py-3 text-role-headline font-bold text-blue-text flex items-center justify-between">
          <h2
            id="mixer-settings-dialog-title"
            className="text-role-headline font-bold text-blue-text"
          >
            Mixer Settings
          </h2>
        </div>

        <div className="px-4 py-4 space-y-4">
          <p className="text-role-callout text-blue-muted">
            Settings apply to this project and persist in the project file.
          </p>

          <label className="flex items-center gap-2 cursor-pointer select-none text-role-body text-blue-text">
            <input
              type="checkbox"
              checked={enableMeters}
              onChange={(e) => onToggleEnableMeters(e.target.checked)}
              className="rounded border-blue-border/70 bg-blue-surface/60 text-blue-accent focus:ring-1 focus:ring-blue-accent"
              aria-label="Enable Meters"
            />
            <span>Enable Meters</span>
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-blue-border/30 px-4 py-3 bg-blue-surface/20">
          <button
            type="button"
            className="rounded px-3 py-1 text-role-callout font-medium text-blue-muted hover:text-blue-text hover:bg-blue-surface/60 border border-blue-border/40 transition-colors focus:ring-1 focus:ring-blue-accent focus:outline-none"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    container,
  );
}
