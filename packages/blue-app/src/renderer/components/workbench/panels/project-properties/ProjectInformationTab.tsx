import React from 'react';
import { APP_INSPECTOR_LABEL_TEXT_CLASS } from '../shared/compactFieldStyles';
import { FieldRow, InputBase, TextAreaBase } from './ProjectPropertyFields';
import type { ProjectPropertiesTabProps } from './types';
import { cn } from '../../../../lib/cn';
import { effectiveTrackLayerMuteSoloMode } from '../../../../../shared/project-editor';
import { useProjectStore } from '../../../../stores/project-store';

export default function ProjectInformationTab({
  disabled,
  properties,
  updateProjectProperties,
}: ProjectPropertiesTabProps): React.ReactElement {
  const mixerEnabled = useProjectStore((state) => state.mixer?.enabled ?? true);
  const legacyNotice = useProjectStore(
    (state) => state.mixer?.legacyActiveChannelStateNotice ?? false,
  );
  const effectiveMode = effectiveTrackLayerMuteSoloMode(
    properties.trackLayerMuteSoloMode,
    mixerEnabled,
  );

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-4">
        <FieldRow label="Title">
          <InputBase
            disabled={disabled}
            value={properties.title}
            label="Title"
            fieldId="project-properties:title"
            onChange={(title, metadata) => updateProjectProperties({ title }, metadata)}
          />
        </FieldRow>
        <FieldRow label="Author">
          <InputBase
            disabled={disabled}
            value={properties.author}
            label="Author"
            fieldId="project-properties:author"
            onChange={(author, metadata) => updateProjectProperties({ author }, metadata)}
          />
        </FieldRow>
        <FieldRow label="Track Header M/S">
          <div className="flex flex-col gap-1">
            <div
              role="radiogroup"
              aria-label="Track header mute/solo behavior"
              className="flex gap-2"
            >
              {(['audio', 'event'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={properties.trackLayerMuteSoloMode === mode}
                  disabled={disabled}
                  className={cn(
                    'rounded-sm border px-3 py-1 text-role-body transition-colors',
                    properties.trackLayerMuteSoloMode === mode
                      ? 'border-app-accent bg-app-accent/20 text-app-text-strong'
                      : 'border-app-border/40 text-app-text-muted hover:text-app-text',
                  )}
                  onClick={() =>
                    updateProjectProperties(
                      { trackLayerMuteSoloMode: mode },
                      {
                        label:
                          mode === 'audio'
                            ? 'Set Track Header Mode to Audio'
                            : 'Set Track Header Mode to Event',
                      },
                    )
                  }
                >
                  {mode === 'audio' ? 'Audio' : 'Event'}
                </button>
              ))}
            </div>
            <p className="text-role-caption text-app-text-muted">
              {properties.trackLayerMuteSoloModeRaw !== null
                ? `The saved value "${properties.trackLayerMuteSoloModeRaw}" is not supported; Event behavior is used until you choose a mode.`
                : 'Switching modes changes which independent state the track header M/S buttons control; both saved states are kept. Audio edits the tracks\u2019 mixer channels; Event omits and soloes events as before.'}{' '}
              {mixerEnabled
                ? `Effective behavior: ${effectiveMode === 'audio' ? 'Audio' : 'Event'}.`
                : 'Effective behavior: Event (the mixer is disabled).'}
            </p>
            {legacyNotice && (
              <p className="text-role-caption text-app-warning" role="status">
                Compatibility notice: this project has active channel Mute or Solo flags in its
                mixer. With this version those flags are audible during playback.
              </p>
            )}
          </div>
        </FieldRow>
      </div>
      <div className="mt-4 flex min-h-0 flex-1 flex-col">
        <span className={cn('mb-2', APP_INSPECTOR_LABEL_TEXT_CLASS)}>Notes</span>
        <TextAreaBase
          value={properties.notes}
          placeholder="Project notes"
          disabled={disabled}
          className="min-h-0 flex-1 resize-none"
          label="Notes"
          fieldId="project-properties:notes"
          onChange={(notes, metadata) => updateProjectProperties({ notes }, metadata)}
        />
      </div>
    </div>
  );
}
