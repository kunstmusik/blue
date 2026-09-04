import React from 'react';
import { CheckboxBase, FieldRow, InputBase, TextAreaBase } from './ProjectPropertyFields';
import type { ProjectPropertiesTabProps } from './types';

export default function RealtimeRenderTab({
  disabled,
  properties,
  updateProjectProperties,
}: ProjectPropertiesTabProps): React.ReactElement {
  return (
    <div className="space-y-4">
      <FieldRow label="Sample Rate">
        <InputBase
          disabled={disabled}
          value={properties.sampleRate}
          onChange={(sampleRate) => updateProjectProperties({ sampleRate })}
        />
      </FieldRow>
      <FieldRow label="Ksmps">
        <InputBase
          disabled={disabled}
          value={properties.ksmps}
          onChange={(ksmps) => updateProjectProperties({ ksmps })}
        />
      </FieldRow>
      <FieldRow label="Channels">
        <InputBase
          disabled={disabled}
          value={properties.nchnls}
          onChange={(nchnls) => updateProjectProperties({ nchnls })}
        />
      </FieldRow>
      <FieldRow label="Use Audio Out">
        <CheckboxBase
          disabled={disabled}
          checked={properties.useAudioOut}
          onChange={(useAudioOut) => updateProjectProperties({ useAudioOut })}
        />
      </FieldRow>
      <FieldRow label="Use Audio In">
        <CheckboxBase
          disabled={disabled}
          checked={properties.useAudioIn}
          onChange={(useAudioIn) => updateProjectProperties({ useAudioIn })}
        />
      </FieldRow>
      <FieldRow label="Use MIDI In">
        <CheckboxBase
          disabled={disabled}
          checked={properties.useMidiIn}
          onChange={(useMidiIn) => updateProjectProperties({ useMidiIn })}
        />
      </FieldRow>
      <FieldRow label="Use MIDI Out">
        <CheckboxBase
          disabled={disabled}
          checked={properties.useMidiOut}
          onChange={(useMidiOut) => updateProjectProperties({ useMidiOut })}
        />
      </FieldRow>
      <div className="h-px bg-blue-border/70" />
      <FieldRow label="Note Amps">
        <CheckboxBase
          disabled={disabled}
          checked={properties.noteAmpsEnabled}
          onChange={(noteAmpsEnabled) => updateProjectProperties({ noteAmpsEnabled })}
        />
      </FieldRow>
      <FieldRow label="Out Of Range">
        <CheckboxBase
          disabled={disabled}
          checked={properties.outOfRangeEnabled}
          onChange={(outOfRangeEnabled) => updateProjectProperties({ outOfRangeEnabled })}
        />
      </FieldRow>
      <FieldRow label="Warnings">
        <CheckboxBase
          disabled={disabled}
          checked={properties.warningsEnabled}
          onChange={(warningsEnabled) => updateProjectProperties({ warningsEnabled })}
        />
      </FieldRow>
      <FieldRow label="Benchmark">
        <CheckboxBase
          disabled={disabled}
          checked={properties.benchmarkEnabled}
          onChange={(benchmarkEnabled) => updateProjectProperties({ benchmarkEnabled })}
        />
      </FieldRow>
      <div className="h-px bg-blue-border/70" />
      <FieldRow label="Zero dBFS">
        <CheckboxBase
          disabled={disabled}
          checked={properties.useZeroDbFS}
          onChange={(useZeroDbFS) => updateProjectProperties({ useZeroDbFS })}
        />
      </FieldRow>
      <FieldRow label="Zero dBFS Value">
        <InputBase
          disabled={disabled}
          value={properties.zeroDbFS}
          onChange={(zeroDbFS) => updateProjectProperties({ zeroDbFS })}
        />
      </FieldRow>
      <FieldRow label="Advanced Settings">
        <TextAreaBase
          disabled={disabled}
          value={properties.advancedSettings}
          onChange={(advancedSettings) => updateProjectProperties({ advancedSettings })}
          placeholder="Csound command line flags"
        />
      </FieldRow>
      <FieldRow label="Complete Override">
        <CheckboxBase
          disabled={disabled}
          checked={properties.completeOverride}
          onChange={(completeOverride) => updateProjectProperties({ completeOverride })}
        />
      </FieldRow>
    </div>
  );
}
