import { X } from 'lucide-react';
import type { TrackLayerMuteSoloMode } from '@blue/data';
import type { ProjectPropertiesSnapshot } from '../../../../../shared/project-editor';
import { effectiveTrackLayerMuteSoloMode } from '../../../../../shared/project-editor';
import { cn } from '../../../../lib/cn';
import { useDialogFocus } from '../../../dialogs/use-dialog-focus';

interface Props {
  properties: ProjectPropertiesSnapshot;
  mixerEnabled: boolean;
  legacyNotice: boolean;
  onModeChange: (mode: TrackLayerMuteSoloMode) => void;
  onClose: () => void;
}

const MODE_OPTIONS: Array<{ value: TrackLayerMuteSoloMode; label: string }> = [
  { value: 'audio', label: 'Audio' },
  { value: 'event', label: 'Event' },
];

export default function ScoreSettingsDialog({
  properties,
  mixerEnabled,
  legacyNotice,
  onModeChange,
  onClose,
}: Props) {
  const effectiveMode = effectiveTrackLayerMuteSoloMode(
    properties.trackLayerMuteSoloMode,
    mixerEnabled,
  );
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
                const selected = properties.trackLayerMuteSoloMode === option.value;
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
              {properties.trackLayerMuteSoloModeRaw !== null
                ? `The saved value "${properties.trackLayerMuteSoloModeRaw}" is not supported; Event behavior is used until you choose a mode.`
                : 'Audio and Event keep independent saved states. Audio edits the track’s mixer channel; Event omits and soloes events as before.'}{' '}
            </p>
            {legacyNotice && (
              <p className="text-role-caption text-app-warning" role="status">
                Compatibility notice: this project has active channel Mute or Solo flags in its
                mixer. With this version those flags are audible during playback.
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
