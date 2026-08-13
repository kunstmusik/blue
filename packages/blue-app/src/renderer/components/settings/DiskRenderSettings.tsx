import React from 'react';
import type { DiskRenderSettingsSnapshot } from '../../../shared/program-settings';
import { FILE_FORMAT_CHOICES, SAMPLE_FORMAT_CHOICES } from '../../../shared/program-settings';
import SettingsSection from './SettingsSection';
import SettingsField, {
  SettingsCheckboxField,
  SettingsSelectField,
  SettingsSubsectionTitle,
  SETTINGS_NARROW_FIELD_CLASS,
} from './SettingsField';

interface DiskRenderSettingsProps {
  settings: DiskRenderSettingsSnapshot;
  onChange: (settings: DiskRenderSettingsSnapshot) => void;
}

export default function DiskRenderSettings({
  settings,
  onChange,
}: DiskRenderSettingsProps): React.ReactElement {
  const set = <K extends keyof DiskRenderSettingsSnapshot>(
    key: K,
    value: DiskRenderSettingsSnapshot[K],
  ) => onChange({ ...settings, [key]: value });

  return (
    <SettingsSection
      title="Disk Render"
      dependencyNote="These settings are used by Render to Disk, Render and Play, and Render and Open. Project settings supply the CSD header and advanced disk options."
    >
      <div className="mb-4 text-ui text-app-text-subtle">
        Disk rendering runs through the managed Blue Engine Csound runtime. The legacy executable value remains preserved for downgrade compatibility.
      </div>

      <SettingsSubsectionTitle>Project Setting Defaults</SettingsSubsectionTitle>

      <SettingsField
        label="Default Sample Rate (sr)"
        value={settings.defaultSr}
        onChange={(value) => set('defaultSr', value)}
        inputClassName={SETTINGS_NARROW_FIELD_CLASS}
      />
      <SettingsField
        label="Default ksmps"
        value={settings.defaultKsmps}
        onChange={(value) => set('defaultKsmps', value)}
        inputClassName={SETTINGS_NARROW_FIELD_CLASS}
      />
      <SettingsField
        label="Default nchnls"
        value={settings.defaultNchnls}
        onChange={(value) => set('defaultNchnls', value)}
        inputClassName={SETTINGS_NARROW_FIELD_CLASS}
      />

      <SettingsCheckboxField
        label="Use 0dbfs"
        checked={settings.useZeroDbfs}
        onChange={(checked) => set('useZeroDbfs', checked)}
      />
      <SettingsField
        label="0dbfs Value"
        value={settings.zeroDbfs}
        onChange={(value) => set('zeroDbfs', value)}
        inputClassName={SETTINGS_NARROW_FIELD_CLASS}
      />

      <SettingsSubsectionTitle>File Output Settings</SettingsSubsectionTitle>

      <SettingsCheckboxField
        label="File Format Enabled"
        checked={settings.fileFormatEnabled}
        onChange={(checked) => set('fileFormatEnabled', checked)}
      />
      <SettingsSelectField
        label="File Format"
        value={settings.fileFormat}
        onChange={(value) => set('fileFormat', value)}
      >
        {FILE_FORMAT_CHOICES.map((format) => <option key={format} value={format}>{format}</option>)}
      </SettingsSelectField>

      <SettingsCheckboxField
        label="Sample Format Enabled"
        checked={settings.sampleFormatEnabled}
        onChange={(checked) => set('sampleFormatEnabled', checked)}
      />
      <SettingsSelectField
        label="Sample Format"
        value={settings.sampleFormat}
        onChange={(value) => set('sampleFormat', value)}
      >
        {SAMPLE_FORMAT_CHOICES.map((format) => <option key={format} value={format}>{format}</option>)}
      </SettingsSelectField>

      <SettingsCheckboxField
        label="Save Peak Information in Header"
        checked={settings.savePeakInformation}
        onChange={(checked) => set('savePeakInformation', checked)}
      />

      <SettingsCheckboxField
        label="Dither Output"
        checked={settings.ditherOutput}
        onChange={(checked) => set('ditherOutput', checked)}
      />

      <SettingsCheckboxField
        label="Rewrite Header While Rendering"
        checked={settings.rewriteHeader}
        onChange={(checked) => set('rewriteHeader', checked)}
      />

      <SettingsSubsectionTitle>Message Level</SettingsSubsectionTitle>

      <SettingsCheckboxField
        label="Note Amplitudes"
        checked={settings.noteAmpsEnabled}
        onChange={(checked) => set('noteAmpsEnabled', checked)}
      />
      <SettingsCheckboxField
        label="Out-of-Range Messages"
        checked={settings.outOfRangeEnabled}
        onChange={(checked) => set('outOfRangeEnabled', checked)}
      />
      <SettingsCheckboxField
        label="Warnings"
        checked={settings.warningsEnabled}
        onChange={(checked) => set('warningsEnabled', checked)}
      />
      <SettingsCheckboxField
        label="Benchmark Information"
        checked={settings.benchmarkEnabled}
        onChange={(checked) => set('benchmarkEnabled', checked)}
      />

      <SettingsSubsectionTitle>Other Settings</SettingsSubsectionTitle>

      <SettingsCheckboxField
        label="Disable Displays"
        checked={settings.displaysDisabled}
        onChange={(checked) => set('displaysDisabled', checked)}
      />

      <SettingsField
        label="Advanced Settings"
        value={settings.advancedSettings}
        onChange={(value) => set('advancedSettings', value)}
        placeholder="Additional Csound command-line options"
      />

      <SettingsSubsectionTitle>Render and Play / Open</SettingsSubsectionTitle>

      <SettingsCheckboxField
        label="Render and Play Enabled"
        checked={settings.externalPlayCommandEnabled}
        onChange={(checked) => set('externalPlayCommandEnabled', checked)}
      />
      <SettingsField
        label="Render and Play Command"
        value={settings.externalPlayCommand}
        onChange={(value) => set('externalPlayCommand', value)}
        placeholder="command $outfile"
      />

      <SettingsField
        label="Render and Open Command"
        value={settings.externalOpenCommand}
        onChange={(value) => set('externalOpenCommand', value)}
        placeholder="command $outfile"
      />
    </SettingsSection>
  );
}
