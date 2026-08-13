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
      dependencyNote="Freeze and SoundFont inspection use the managed Blue Engine Csound runtime. Freeze flags remain configurable; the legacy executable is retained only for downgrade compatibility."
    >
      <div className="mb-4 text-ui text-app-text-subtle">
        SoundFont inspection and freeze rendering use the managed Blue Engine Csound runtime. The legacy executable value is preserved for downgrade compatibility.
      </div>

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
