import React from 'react';
import type { GeneralSettingsSnapshot } from '../../../shared/program-settings';
import SettingsSection from './SettingsSection';
import SettingsField, { SettingsCheckboxField, SETTINGS_NARROW_FIELD_CLASS } from './SettingsField';

interface GeneralSettingsProps {
  settings: GeneralSettingsSnapshot;
  onChange: (settings: GeneralSettingsSnapshot) => void;
}

export default function GeneralSettings({
  settings,
  onChange,
}: GeneralSettingsProps): React.ReactElement {
  const set = <K extends keyof GeneralSettingsSnapshot>(
    key: K,
    value: GeneralSettingsSnapshot[K],
  ) => onChange({ ...settings, [key]: value });

  return (
    <SettingsSection title="General">
      <SettingsField
        label="Work Directory"
        value={settings.workDirectory}
        onChange={(value) => set('workDirectory', value)}
        placeholder="(default user directory)"
        description="Default directory for file choosers and import/export operations."
      />

      <SettingsCheckboxField
        label="New User Defaults Enabled"
        checked={settings.newUserDefaultsEnabled}
        onChange={(checked) => set('newUserDefaultsEnabled', checked)}
      />

      <SettingsCheckboxField
        label="Message Colors Enabled"
        checked={settings.messageColorsEnabled}
        onChange={(checked) => set('messageColorsEnabled', checked)}
      />

      <SettingsCheckboxField
        label="Csound Error Warning Enabled"
        checked={settings.csoundErrorWarningEnabled}
        onChange={(checked) => set('csoundErrorWarningEnabled', checked)}
      />

      <SettingsField
        label="Max Temp Files per Directory"
        type="number"
        min={1}
        value={settings.directoryTempFileLimit}
        onChange={(value) => set('directoryTempFileLimit', Number.parseInt(value, 10) || 3)}
        inputClassName={SETTINGS_NARROW_FIELD_CLASS}
      />
    </SettingsSection>
  );
}
