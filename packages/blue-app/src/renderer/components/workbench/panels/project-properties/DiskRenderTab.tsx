import React from 'react';
import { CheckboxBase, FieldRow, InputBase, TextAreaBase } from './ProjectPropertyFields';
import type { ProjectPropertiesTabProps } from './types';

export default function DiskRenderTab({
  disabled,
  properties,
  updateProjectProperties,
}: ProjectPropertiesTabProps): React.ReactElement {
  return (
    <div className="space-y-4">
      <FieldRow label="Sample Rate">
        <InputBase
          disabled={disabled}
          value={properties.diskSampleRate}
          onChange={(diskSampleRate) => updateProjectProperties({ diskSampleRate })}
        />
      </FieldRow>
      <FieldRow label="Ksmps">
        <InputBase
          disabled={disabled}
          value={properties.diskKsmps}
          onChange={(diskKsmps) => updateProjectProperties({ diskKsmps })}
        />
      </FieldRow>
      <FieldRow label="Channels">
        <InputBase
          disabled={disabled}
          value={properties.diskChannels}
          onChange={(diskChannels) => updateProjectProperties({ diskChannels })}
        />
      </FieldRow>
      <FieldRow label="Use Zero dBFS">
        <CheckboxBase
          disabled={disabled}
          checked={properties.diskUseZeroDbFS}
          onChange={(diskUseZeroDbFS) => updateProjectProperties({ diskUseZeroDbFS })}
        />
      </FieldRow>
      <FieldRow label="Zero dBFS Value">
        <InputBase
          disabled={disabled}
          value={properties.diskZeroDbFS}
          onChange={(diskZeroDbFS) => updateProjectProperties({ diskZeroDbFS })}
        />
      </FieldRow>
      <FieldRow label="File Name">
        <InputBase
          disabled={disabled}
          value={properties.fileName}
          onChange={(fileName) => updateProjectProperties({ fileName })}
        />
      </FieldRow>
      <FieldRow label="Ask on Render">
        <CheckboxBase
          disabled={disabled}
          checked={properties.askOnRender}
          onChange={(askOnRender) => updateProjectProperties({ askOnRender })}
        />
      </FieldRow>
      <div className="h-px bg-blue-border/70" />
      <FieldRow label="Disk Note Amps">
        <CheckboxBase
          disabled={disabled}
          checked={properties.diskNoteAmpsEnabled}
          onChange={(diskNoteAmpsEnabled) => updateProjectProperties({ diskNoteAmpsEnabled })}
        />
      </FieldRow>
      <FieldRow label="Disk Out Of Range">
        <CheckboxBase
          disabled={disabled}
          checked={properties.diskOutOfRangeEnabled}
          onChange={(diskOutOfRangeEnabled) => updateProjectProperties({ diskOutOfRangeEnabled })}
        />
      </FieldRow>
      <FieldRow label="Disk Warnings">
        <CheckboxBase
          disabled={disabled}
          checked={properties.diskWarningsEnabled}
          onChange={(diskWarningsEnabled) => updateProjectProperties({ diskWarningsEnabled })}
        />
      </FieldRow>
      <FieldRow label="Disk Benchmark">
        <CheckboxBase
          disabled={disabled}
          checked={properties.diskBenchmarkEnabled}
          onChange={(diskBenchmarkEnabled) => updateProjectProperties({ diskBenchmarkEnabled })}
        />
      </FieldRow>
      <div className="h-px bg-blue-border/70" />
      <FieldRow label="Disk Advanced Settings">
        <TextAreaBase
          disabled={disabled}
          value={properties.diskAdvancedSettings}
          onChange={(diskAdvancedSettings) => updateProjectProperties({ diskAdvancedSettings })}
          placeholder="Disk render command line flags"
        />
      </FieldRow>
      <FieldRow label="Disk Complete Override">
        <CheckboxBase
          disabled={disabled}
          checked={properties.diskCompleteOverride}
          onChange={(diskCompleteOverride) => updateProjectProperties({ diskCompleteOverride })}
        />
      </FieldRow>
      <FieldRow label="Render Entire Project">
        <CheckboxBase
          disabled={disabled}
          checked={properties.diskAlwaysRenderEntireProject}
          onChange={(diskAlwaysRenderEntireProject) =>
            updateProjectProperties({ diskAlwaysRenderEntireProject })
          }
        />
      </FieldRow>
    </div>
  );
}
