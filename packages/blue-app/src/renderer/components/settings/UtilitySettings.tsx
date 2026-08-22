import React from 'react';
import {
  FREEZE_MAX_JOBS_MAX,
  FREEZE_MAX_JOBS_MIN,
  type UtilitySettingsSnapshot,
} from '../../../shared/program-settings';
import SettingsSection from './SettingsSection';
import SettingsField, { SETTINGS_NARROW_FIELD_CLASS } from './SettingsField';

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

  const setFreezeMaxJobsDraft = (value: string): void => {
    const numericValue = Number(value);
    const nextValue = value.trim() !== ''
      && Number.isInteger(numericValue)
      && numericValue >= FREEZE_MAX_JOBS_MIN
      && numericValue <= FREEZE_MAX_JOBS_MAX
      ? numericValue
      // Preserve invalid drafts so the main-process settings validator can
      // reject them with the actionable utility.freezeMaxJobs issue.
      : (value as unknown as UtilitySettingsSnapshot['freezeMaxJobs']);
    set('freezeMaxJobs', nextValue);
  };

  return (
    <SettingsSection
      title="Utility"
      dependencyNote="Freeze and SoundFont inspection use the managed Blue Engine Csound runtime. Freeze flags remain configurable; the legacy executable is retained only for downgrade compatibility."
    >
      <div className="mb-4 text-role-callout text-app-text-subtle">
        SoundFont inspection and freeze rendering use the managed Blue Engine Csound runtime. The legacy executable value is preserved for downgrade compatibility.
      </div>

      <SettingsField
        label="Freeze Flags"
        value={settings.freezeFlags}
        onChange={(value) => set('freezeFlags', value)}
        placeholder="-Ado"
        description="Csound flags for SoundObject freeze rendering."
      />

      <SettingsField
        label="Maximum Freeze Jobs"
        type="number"
        min={FREEZE_MAX_JOBS_MIN}
        max={FREEZE_MAX_JOBS_MAX}
        value={settings.freezeMaxJobs}
        onChange={setFreezeMaxJobsDraft}
        inputClassName={SETTINGS_NARROW_FIELD_CLASS}
        description="Maximum number of Csound renders to run at once when freezing multiple objects (1–32)."
      />
    </SettingsSection>
  );
}
