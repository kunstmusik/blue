import React from 'react';
import type { GeneralSettingsSnapshot } from '../../../shared/program-settings';
import { DEFAULT_CSOUND_MANUAL_URL } from '../../../shared/csound-manual';
import SettingsSection from './SettingsSection';
import SettingsField, {
  SettingsCheckboxField,
  SettingsNumberField,
  SETTINGS_NARROW_FIELD_CLASS,
} from './SettingsField';

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

      <SettingsField
        label="Csound Manual URL"
        value={settings.csoundManualUrl}
        onChange={(value) => set('csoundManualUrl', value)}
        placeholder={DEFAULT_CSOUND_MANUAL_URL}
        description="Base URL for Csound 7 manual documentation (https: or local file: URL)."
        action={
          <button
            type="button"
            aria-label="Reset Csound Manual URL to default"
            disabled={settings.csoundManualUrl === DEFAULT_CSOUND_MANUAL_URL}
            onClick={() => set('csoundManualUrl', DEFAULT_CSOUND_MANUAL_URL)}
            className="rounded-md border border-app-border bg-app-surface px-3 py-1.5 text-role-body text-app-text transition-colors hover:border-app-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reset
          </button>
        }
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

      <SettingsNumberField
        label="Max Temp Files per Directory"
        min={1}
        step={1}
        value={settings.directoryTempFileLimit}
        resolveValue={(text) => (text.trim() === '' ? 3 : Number.parseInt(text, 10) || 3)}
        onChange={(value) => set('directoryTempFileLimit', value)}
        inputClassName={SETTINGS_NARROW_FIELD_CLASS}
      />
    </SettingsSection>
  );
}
