import React, { useState } from 'react';
import type { RealtimeRenderSettingsSnapshot } from '../../../shared/program-settings';
import type { EngineProbeResult } from '../../../shared/engine-runtime';
import { getAudioDrivers, getMidiDrivers } from '../../../shared/program-settings';
import SettingsSection from './SettingsSection';
import SettingsField, {
  SettingsCheckboxField,
  SettingsSelectField,
  SettingsSubsectionTitle,
  SETTINGS_MEDIUM_FIELD_CLASS,
  SETTINGS_NARROW_FIELD_CLASS,
} from './SettingsField';

interface RealtimeRenderSettingsProps {
  settings: RealtimeRenderSettingsSnapshot;
  enginePath: string;
  onChange: (settings: RealtimeRenderSettingsSnapshot) => void;
  onEnginePathChange: (enginePath: string) => void;
}

export default function RealtimeRenderSettings({
  settings,
  enginePath,
  onChange,
  onEnginePathChange,
}: RealtimeRenderSettingsProps): React.ReactElement {
  const [probeResult, setProbeResult] = useState<EngineProbeResult | null>(null);
  const [probing, setProbing] = useState(false);
  const set = <K extends keyof RealtimeRenderSettingsSnapshot>(
    key: K,
    value: RealtimeRenderSettingsSnapshot[K],
  ) => onChange({ ...settings, [key]: value });

  const platform = navigator.platform.toLowerCase().includes('mac') ? 'darwin'
    : navigator.platform.toLowerCase().includes('win') ? 'win32'
    : 'linux';
  const audioDrivers = getAudioDrivers(platform);
  const midiDrivers = getMidiDrivers(platform);
  const usesBundledEngine = enginePath.trim() === '' || enginePath.trim() === 'blue-engine';
  const externalEnginePath = usesBundledEngine ? '' : enginePath;

  const checkEngine = async () => {
    setProbing(true);
    try {
      setProbeResult(await window.blueAPI.probeEngineRuntime({
        enginePathOverride: usesBundledEngine ? null : externalEnginePath,
      }));
    } finally {
      setProbing(false);
    }
  };

  return (
    <SettingsSection title="Realtime Render">
      <SettingsSubsectionTitle>Blue Engine</SettingsSubsectionTitle>

      <div className="mb-3 text-content text-app-text-muted">
        {usesBundledEngine ? 'Bundled Blue Engine' : 'External Blue Engine override'}
      </div>
      <SettingsField
        label="External Engine Path"
        value={externalEnginePath}
        onChange={(value) => {
          setProbeResult(null);
          onEnginePathChange(value.trim() === '' ? 'blue-engine' : value);
        }}
        placeholder="Leave empty to use the bundled engine"
        description="Development uses the current workspace artifact; installed builds use the application resource."
      />
      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => {
            onEnginePathChange('blue-engine');
            setProbeResult(null);
          }}
          className="rounded-md border border-app-border px-3 py-1.5 text-content text-app-text-muted hover:border-app-accent/60"
        >
          Use Bundled Blue Engine
        </button>
        <button
          type="button"
          disabled={probing}
          onClick={() => { void checkEngine(); }}
          className="rounded-md bg-app-accent px-3 py-1.5 text-content text-white disabled:opacity-50"
        >
          {probing ? 'Checking…' : 'Check Engine and Csound'}
        </button>
      </div>
      {probeResult && (
        <div
          role="status"
          className={`mb-4 rounded-md border px-3 py-2 text-content ${
            probeResult.ok
              ? 'border-app-success/40 bg-app-success/10 text-app-text'
              : 'border-app-danger/40 bg-app-danger/10 text-app-danger'
          }`}
        >
          <div>{probeResult.message}</div>
          {probeResult.selection && (
            <div>Source: {probeResult.selection.source} — {probeResult.selection.executablePath}</div>
          )}
          {probeResult.report && (
            <div>
              Engine {probeResult.report.engine.engineVersion}, protocol{' '}
              {probeResult.report.engine.protocolVersion}; Csound{' '}
              {probeResult.report.csound.major ?? 'unavailable'}
              {probeResult.report.csound.loadedPath ? ` — ${probeResult.report.csound.loadedPath}` : ''}
            </div>
          )}
        </div>
      )}

      <SettingsField
        label="Csound Executable"
        value={settings.csoundExecutable}
        onChange={(value) => set('csoundExecutable', value)}
        placeholder="/usr/local/bin/csound"
      />

      <SettingsSubsectionTitle>Project Settings</SettingsSubsectionTitle>

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
        disabled={!settings.useZeroDbfs}
        inputClassName={SETTINGS_NARROW_FIELD_CLASS}
      />

      <SettingsSubsectionTitle>Audio</SettingsSubsectionTitle>

      <SettingsCheckboxField
        label="Audio Driver Enabled"
        checked={settings.audioDriverEnabled}
        onChange={(checked) => set('audioDriverEnabled', checked)}
      />
      <SettingsSelectField
        label="Audio Driver"
        value={settings.audioDriver}
        onChange={(value) => set('audioDriver', value)}
        disabled={!settings.audioDriverEnabled}
      >
        {audioDrivers.map((driver) => <option key={driver} value={driver}>{driver}</option>)}
      </SettingsSelectField>

      <SettingsCheckboxField
        label="Audio Out Enabled"
        checked={settings.audioOutEnabled}
        onChange={(checked) => set('audioOutEnabled', checked)}
      />
      <SettingsField
        label="Audio Out"
        value={settings.audioOutText}
        onChange={(value) => set('audioOutText', value)}
        inputClassName={SETTINGS_MEDIUM_FIELD_CLASS}
      />

      <SettingsCheckboxField
        label="Audio In Enabled"
        checked={settings.audioInEnabled}
        onChange={(checked) => set('audioInEnabled', checked)}
      />
      <SettingsField
        label="Audio In"
        value={settings.audioInText}
        onChange={(value) => set('audioInText', value)}
        inputClassName={SETTINGS_MEDIUM_FIELD_CLASS}
      />

      <SettingsSubsectionTitle>MIDI</SettingsSubsectionTitle>

      <SettingsCheckboxField
        label="MIDI Driver Enabled"
        checked={settings.midiDriverEnabled}
        onChange={(checked) => set('midiDriverEnabled', checked)}
      />
      <SettingsSelectField
        label="MIDI Driver"
        value={settings.midiDriver}
        onChange={(value) => set('midiDriver', value)}
        disabled={!settings.midiDriverEnabled}
      >
        {midiDrivers.map((driver) => <option key={driver} value={driver}>{driver}</option>)}
      </SettingsSelectField>

      <SettingsCheckboxField
        label="MIDI Out Enabled"
        checked={settings.midiOutEnabled}
        onChange={(checked) => set('midiOutEnabled', checked)}
      />
      <SettingsField
        label="MIDI Out"
        value={settings.midiOutText}
        onChange={(value) => set('midiOutText', value)}
        inputClassName={SETTINGS_MEDIUM_FIELD_CLASS}
      />

      <SettingsCheckboxField
        label="MIDI In Enabled"
        checked={settings.midiInEnabled}
        onChange={(checked) => set('midiInEnabled', checked)}
      />
      <SettingsField
        label="MIDI In"
        value={settings.midiInText}
        onChange={(value) => set('midiInText', value)}
        inputClassName={SETTINGS_MEDIUM_FIELD_CLASS}
      />

      <SettingsSubsectionTitle>Buffer Settings</SettingsSubsectionTitle>

      <SettingsCheckboxField
        label="Software Buffer Enabled"
        checked={settings.softwareBufferEnabled}
        onChange={(checked) => set('softwareBufferEnabled', checked)}
      />
      <SettingsField
        label="Software Buffer Size"
        type="number"
        value={settings.softwareBufferSize}
        onChange={(value) => set('softwareBufferSize', Number.parseInt(value, 10) || 1024)}
        disabled={!settings.softwareBufferEnabled}
        inputClassName={SETTINGS_NARROW_FIELD_CLASS}
      />

      <SettingsCheckboxField
        label="Hardware Buffer Enabled"
        checked={settings.hardwareBufferEnabled}
        onChange={(checked) => set('hardwareBufferEnabled', checked)}
      />
      <SettingsField
        label="Hardware Buffer Size"
        type="number"
        value={settings.hardwareBufferSize}
        onChange={(value) => set('hardwareBufferSize', Number.parseInt(value, 10) || 4096)}
        disabled={!settings.hardwareBufferEnabled}
        inputClassName={SETTINGS_NARROW_FIELD_CLASS}
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
    </SettingsSection>
  );
}
