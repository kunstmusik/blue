import { X } from 'lucide-react';
import type { TrackLayerMuteSoloMode, PanLawDb } from '@blue/data';
import type { ScoreDocumentSnapshot } from '../../../../../shared/project-editor';
import { effectiveTrackLayerMuteSoloMode } from '../../../../../shared/project-editor';
import { cn } from '../../../../lib/cn';
import { useDialogFocus } from '../../../dialogs/use-dialog-focus';

interface Props {
  score: ScoreDocumentSnapshot;
  mixerEnabled: boolean;
  legacyNotice: boolean;
  onModeChange: (mode: TrackLayerMuteSoloMode) => void;
  onPanningChange?: (enabled: boolean) => void;
  onPanLawChange?: (panLawDb: PanLawDb) => void;
  onPanBoostChange?: (boost: boolean) => void;
  onClose: () => void;
}

const MODE_OPTIONS: Array<{ value: TrackLayerMuteSoloMode; label: string }> = [
  { value: 'audio', label: 'Audio' },
  { value: 'event', label: 'Event' },
];

const PAN_LAW_OPTIONS: Array<{ value: PanLawDb; label: string }> = [
  { value: 0, label: '0 dB' },
  { value: -3, label: '-3 dB (Default)' },
  { value: -4.5, label: '-4.5 dB' },
  { value: -6, label: '-6 dB' },
];

export default function ScoreSettingsDialog({
  score,
  mixerEnabled,
  legacyNotice,
  onModeChange,
  onPanningChange,
  onPanLawChange,
  onPanBoostChange,
  onClose,
}: Props) {
  const effectiveMode = effectiveTrackLayerMuteSoloMode(score.trackLayerMuteSoloMode, mixerEnabled);
  const dialogRef = useDialogFocus(true, onClose, {
    initialFocusSelector: '[role="radio"][aria-checked="true"]',
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="score-settings-dialog-title"
        className="w-full max-w-lg rounded-lg border border-app-border/50 bg-app-menu text-app-text shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-app-border/30 px-4 py-3">
          <div>
            <h2 id="score-settings-dialog-title" className="text-role-title-2 font-semibold">
              Score Settings
            </h2>
            <p className="mt-1 text-role-caption text-app-text-muted">
              Settings for the current score view and its track headers.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close Score Settings"
            title="Close Score Settings"
            className="rounded p-1 text-app-text-muted transition-colors hover:bg-app-hover hover:text-app-text focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-app-focus"
            onClick={onClose}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <fieldset className="space-y-3">
            <legend className="text-role-headline font-bold text-app-text">
              Track Layer M/S Mode
            </legend>
            <p className="text-role-body text-app-text-muted">
              Choose whether Track Layer header M/S buttons control the associated mixer channel or
              filter score events.
            </p>
            <div
              role="radiogroup"
              aria-label="Track header mute/solo behavior"
              className="flex gap-2"
            >
              {MODE_OPTIONS.map((option) => {
                const selected = score.trackLayerMuteSoloMode === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className={cn(
                      'rounded border px-3 py-1 text-role-body transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-app-focus',
                      selected
                        ? 'border-app-accent bg-app-accent/20 text-app-text-strong'
                        : 'border-app-border/40 text-app-text-muted hover:bg-app-hover hover:text-app-text',
                    )}
                    onClick={() => onModeChange(option.value)}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <p className="text-role-caption text-app-text-muted">
              Effective behavior: {effectiveMode === 'audio' ? 'Audio' : 'Event'}
              {!mixerEnabled && ' (mixer is disabled)'}.
            </p>
            <p className="text-role-caption text-app-text-muted">
              Audio and Event keep independent saved states. Audio edits the track’s mixer channel;
              Event omits and soloes events as before.
            </p>
            {legacyNotice && (
              <p className="text-role-caption text-app-warning" role="status">
                Compatibility notice: this project has active channel Mute or Solo flags in its
                mixer. With this version those flags are audible during playback.
              </p>
            )}
          </fieldset>

          <fieldset className="space-y-3 border-t border-app-border/30 pt-4">
            <legend className="text-role-headline font-bold text-app-text">Panning</legend>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                aria-label="Enable Panning"
                checked={score.panningEnabled}
                onChange={(event) => onPanningChange?.(event.target.checked)}
                className="rounded border-app-border/40 focus-visible:ring-2 focus-visible:ring-app-focus"
              />
              <span className="text-role-body text-app-text">Enable Panning</span>
            </label>
            <p className="text-role-caption text-app-text-muted">
              When enabled, mono audio clips are centered into stereo and channel Pan/Balance
              controls are active. When disabled, legacy audio routing is preserved.
            </p>

            <div className="space-y-2 pt-2">
              <label className="text-role-body font-medium text-app-text">Pan Law</label>
              <p className="text-role-caption text-app-text-muted">
                Governs center attenuation for Mono Pan and true-stereo (Stereo Pan and Dual Pan)
                source-side panners. Balance channels are unaffected. -3 dB is the default
                equal-power law.
              </p>
              <div
                role="radiogroup"
                aria-label="Score pan law"
                className="flex flex-wrap gap-2"
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    const currentIndex = PAN_LAW_OPTIONS.findIndex(
                      (opt) => opt.value === score.panLawDb,
                    );
                    const nextIndex = (currentIndex + 1) % PAN_LAW_OPTIONS.length;
                    onPanLawChange?.(PAN_LAW_OPTIONS[nextIndex].value);
                  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    const currentIndex = PAN_LAW_OPTIONS.findIndex(
                      (opt) => opt.value === score.panLawDb,
                    );
                    const prevIndex =
                      (currentIndex - 1 + PAN_LAW_OPTIONS.length) % PAN_LAW_OPTIONS.length;
                    onPanLawChange?.(PAN_LAW_OPTIONS[prevIndex].value);
                  }
                }}
              >
                {PAN_LAW_OPTIONS.map((option) => {
                  const selected = score.panLawDb === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      tabIndex={selected ? 0 : -1}
                      className={cn(
                        'rounded border px-3 py-1 text-role-body transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-app-focus',
                        selected
                          ? 'border-app-accent bg-app-accent/20 text-app-text-strong'
                          : 'border-app-border/40 text-app-text-muted hover:bg-app-hover hover:text-app-text',
                      )}
                      onClick={() => onPanLawChange?.(option.value)}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  aria-label="Off-center boost"
                  checked={score.panOffCenterBoost}
                  onChange={(event) => onPanBoostChange?.(event.target.checked)}
                  className="rounded border-app-border/40 focus-visible:ring-2 focus-visible:ring-app-focus"
                />
                <span className="text-role-body text-app-text">Off-center boost</span>
              </label>
              <p className="text-role-caption text-app-text-muted">
                Boosts endpoints by the center depth magnitude to keep center level unattenuated.
              </p>
              {score.panOffCenterBoost && score.panLawDb !== 0 && (
                <p className="text-role-caption text-app-warning" role="status">
                  Warning: Off-center boost raises endpoint gains up to {Math.abs(score.panLawDb)}{' '}
                  dB above unity; boosted signals may clip.
                </p>
              )}
            </div>

            {!score.panningEnabled && (
              <p className="text-role-caption text-app-text-muted italic pt-1" role="note">
                Panning is currently disabled. Pan law and boost settings reflect future intent and
                will apply once Enable Panning is turned on.
              </p>
            )}
          </fieldset>
        </div>

        <div className="flex justify-end border-t border-app-border/30 px-4 py-3">
          <button
            type="button"
            className="rounded border border-app-border/40 bg-app-surface px-3 py-1 text-role-body text-app-text transition-colors hover:bg-app-hover focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-app-focus"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
