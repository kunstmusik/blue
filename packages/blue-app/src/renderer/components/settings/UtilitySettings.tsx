import React from 'react';
import type { UtilitySettingsSnapshot } from '../../../shared/program-settings';
import SettingsSection from './SettingsSection';
import SettingsField from './SettingsField';

interface UtilitySettingsProps {
  settings: UtilitySettingsSnapshot;
  onChange: (settings: UtilitySettingsSnapshot) => void;
}

export default function UtilitySettings({
  settings,
  onChange,
}: UtilitySettingsProps): React.ReactElement {
  const set = <K extends keyof UtilitySettingsSnapshot>(
    key: K,
    value: UtilitySettingsSnapshot[K],
  ) => onChange({ ...settings, [key]: value });

  return (
    <SettingsSection
      title="Utility"
      dependencyNote="The Utility Csound executable and freeze flags are used by SoundObject freeze/unfreeze. SoundFont inspection remains unavailable."
    >
      <SettingsField
        label="Csound Executable"
        value={settings.csoundExecutable}
        onChange={(value) => set('csoundExecutable', value)}
        placeholder="/usr/local/bin/csound"
        description="Path to Csound executable for utility operations."
      />

      <SettingsField
        label="Freeze Flags"
        value={settings.freezeFlags}
        onChange={(value) => set('freezeFlags', value)}
        placeholder="-Ado"
        description="Csound flags for SoundObject freeze rendering."
      />
    </SettingsSection>
  );
}
