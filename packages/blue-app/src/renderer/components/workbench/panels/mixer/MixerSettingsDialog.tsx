import React from 'react';
import { createPortal } from 'react-dom';
import type { PanLawDb } from '@blue/data';
import type { MixerSnapshot } from '../../../../../shared/project-editor';
import { usePortalContainer } from '../../../../hooks/use-host-document';
import { useDialogFocus } from '../../../dialogs/use-dialog-focus';
import { portalEventIsolationProps } from '../../../../hooks/host-portals';

export interface MixerSettingsDialogProps {
  readonly isOpen: boolean;
  readonly enableMeters: boolean;
  readonly mixer: MixerSnapshot;
  readonly onToggleEnableMeters: (enabled: boolean) => void;
  readonly onToggleEnablePanning: (enabled: boolean) => void;
  readonly onPanLawChange: (panLawDb: PanLawDb) => void;
  readonly onPanBoostChange: (boost: boolean) => void;
  readonly onClose: () => void;
}

const PAN_LAW_OPTIONS: Array<{ value: PanLawDb; label: string }> = [
  { value: 0, label: '0 dB' },
  { value: -3, label: '-3 dB (Default)' },
  { value: -4.5, label: '-4.5 dB' },
  { value: -6, label: '-6 dB' },
];

export function MixerSettingsDialog({
  isOpen,
  enableMeters,
  mixer,
  onToggleEnableMeters,
  onToggleEnablePanning,
  onPanLawChange,
  onPanBoostChange,
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
      {...portalEventIsolationProps}
      onClick={(event) => {
        portalEventIsolationProps.onClick(event);
        onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mixer-settings-dialog-title"
        className="w-full max-w-lg rounded-lg border border-blue-border/50 bg-blue-bg shadow-2xl overflow-hidden focus:outline-none"
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

          <fieldset className="space-y-3 border-t border-blue-border/30 pt-4">
            <legend className="text-role-headline font-bold text-blue-text">Panning</legend>
            <label className="flex items-center gap-2 cursor-pointer select-none text-role-body text-blue-text">
              <input
                type="checkbox"
                checked={mixer.panningEnabled}
                onChange={(e) => onToggleEnablePanning(e.target.checked)}
                className="rounded border-blue-border/70 bg-blue-surface/60 text-blue-accent focus:ring-1 focus:ring-blue-accent"
                aria-label="Enable Panning"
              />
              <span>Enable Panning</span>
            </label>
            <p className="-mt-2 text-role-caption text-blue-muted">
              Show Pan/Balance controls and enable panning-aware audio routing. When disabled, the
              controls are hidden and legacy routing is preserved.
            </p>

            <div className="space-y-2 pt-2">
              <label className="text-role-body font-medium text-blue-text">Pan Law</label>
              <p className="text-role-caption text-blue-muted">
                Governs center attenuation for Mono Pan and true-stereo (Stereo Pan and Dual Pan)
                source-side panners. Balance channels are unaffected. -3 dB is the default
                equal-power law.
              </p>
              <div
                role="radiogroup"
                aria-label="Mixer pan law"
                className="flex flex-wrap gap-2"
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    const currentIndex = PAN_LAW_OPTIONS.findIndex(
                      (option) => option.value === mixer.panLawDb,
                    );
                    const nextIndex = (currentIndex + 1) % PAN_LAW_OPTIONS.length;
                    onPanLawChange(PAN_LAW_OPTIONS[nextIndex].value);
                  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    const currentIndex = PAN_LAW_OPTIONS.findIndex(
                      (option) => option.value === mixer.panLawDb,
                    );
                    const previousIndex =
                      (currentIndex - 1 + PAN_LAW_OPTIONS.length) % PAN_LAW_OPTIONS.length;
                    onPanLawChange(PAN_LAW_OPTIONS[previousIndex].value);
                  }
                }}
              >
                {PAN_LAW_OPTIONS.map((option) => {
                  const selected = mixer.panLawDb === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      tabIndex={selected ? 0 : -1}
                      className={
                        selected
                          ? 'rounded border border-blue-accent bg-blue-accent/20 px-3 py-1 text-role-body text-blue-text transition-colors focus:outline-none focus:ring-1 focus:ring-blue-accent'
                          : 'rounded border border-blue-border/40 px-3 py-1 text-role-body text-blue-muted transition-colors hover:bg-blue-surface/60 hover:text-blue-text focus:outline-none focus:ring-1 focus:ring-blue-accent'
                      }
                      onClick={() => onPanLawChange(option.value)}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <label className="flex items-center gap-2 cursor-pointer select-none text-role-body text-blue-text">
                <input
                  type="checkbox"
                  aria-label="Off-center boost"
                  checked={mixer.panOffCenterBoost}
                  onChange={(event) => onPanBoostChange(event.target.checked)}
                  className="rounded border-blue-border/70 bg-blue-surface/60 text-blue-accent focus:ring-1 focus:ring-blue-accent"
                />
                <span>Off-center boost</span>
              </label>
              <p className="text-role-caption text-blue-muted">
                Boosts endpoints by the center depth magnitude while leaving center attenuation
                unchanged.
              </p>
              {mixer.panOffCenterBoost && mixer.panLawDb !== 0 && (
                <p className="text-role-caption text-app-warning" role="status">
                  Warning: Off-center boost raises endpoint gains up to {Math.abs(mixer.panLawDb)}{' '}
                  dB above unity; boosted signals may clip.
                </p>
              )}
            </div>

            {!mixer.panningEnabled && (
              <p className="text-role-caption text-blue-muted italic pt-1" role="note">
                Panning is currently disabled. Pan law and boost settings reflect future intent and
                will apply once Enable Panning is turned on.
              </p>
            )}
          </fieldset>
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
