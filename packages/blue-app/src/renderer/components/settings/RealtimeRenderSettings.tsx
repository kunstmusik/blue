import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeRenderSettingsSnapshot } from '../../../shared/program-settings';
import type { EngineProbeResult } from '../../../shared/engine-runtime';
import {
  formatCsoundRuntimeModuleOption,
  type CsoundIoQueryResult,
  type CsoundRuntimeDevice,
} from '../../../shared/csound-runtime';
import SettingsSection from './SettingsSection';
import SettingsField, {
  SettingsCheckboxField,
  SettingsSelectField,
  SettingsSubsectionTitle,
  SETTINGS_NARROW_FIELD_CLASS,
} from './SettingsField';
import RuntimeDeviceField from './RuntimeDeviceField';
import { cn } from '../../lib/cn';

interface RealtimeRenderSettingsProps {
  settings: RealtimeRenderSettingsSnapshot;
  enginePath: string;
  csoundLibraryPath?: string;
  onChange: (settings: RealtimeRenderSettingsSnapshot) => void;
  onEnginePathChange: (enginePath: string) => void;
  onCsoundLibraryPathChange?: (libraryPath: string) => void;
}

export default function RealtimeRenderSettings({
  settings,
  enginePath,
  csoundLibraryPath,
  onChange,
  onEnginePathChange,
  onCsoundLibraryPathChange,
}: RealtimeRenderSettingsProps): React.ReactElement {
  const effectiveCsoundLibraryPath = csoundLibraryPath ?? '';
  const [probeResult, setProbeResult] = useState<EngineProbeResult | null>(null);
  const [probing, setProbing] = useState(false);
  const [ioResult, setIoResult] = useState<CsoundIoQueryResult | null>(null);
  const [ioLoading, setIoLoading] = useState<{ audio: boolean; midi: boolean }>({ audio: false, midi: false });
  const ioRequestGeneration = useRef<{ audio: number; midi: number }>({ audio: 0, midi: 0 });
  const set = <K extends keyof RealtimeRenderSettingsSnapshot>(
    key: K,
    value: RealtimeRenderSettingsSnapshot[K],
  ) => onChange({ ...settings, [key]: value });

  const usesBundledEngine = enginePath.trim() === '' || enginePath.trim() === 'blue-engine';
  const externalEnginePath = usesBundledEngine ? '' : enginePath;

  const audioModules = useMemo(() => {
    const runtime = ioResult?.report?.audioModules.map((module) => module.name) ?? [];
    return settings.audioDriver
      ? [settings.audioDriver, ...runtime.filter((module) => module !== settings.audioDriver)]
      : runtime;
  }, [ioResult, settings.audioDriver]);
  const midiModules = useMemo(() => {
    const runtime = ioResult?.report?.midiModules.map((module) => module.name) ?? [];
    return settings.midiDriver
      ? [settings.midiDriver, ...runtime.filter((module) => module !== settings.midiDriver)]
      : runtime;
  }, [ioResult, settings.midiDriver]);
  const audioInputs: CsoundRuntimeDevice[] = ioResult?.report?.audioInputs ?? [];
  const audioOutputs: CsoundRuntimeDevice[] = ioResult?.report?.audioOutputs ?? [];
  const midiInputs: CsoundRuntimeDevice[] = ioResult?.report?.midiInputs ?? [];
  const midiOutputs: CsoundRuntimeDevice[] = ioResult?.report?.midiOutputs ?? [];
  const savedAudioModuleUnavailable = Boolean(
    ioResult?.report && settings.audioDriver
      && !ioResult.report.audioModules.some((module) => module.name === settings.audioDriver),
  );
  const savedMidiModuleUnavailable = Boolean(
    ioResult?.report && settings.midiDriver
      && !ioResult.report.midiModules.some((module) => module.name === settings.midiDriver),
  );
  const audioModuleLabel = (name: string) => {
    const label = formatCsoundRuntimeModuleOption('audio', name);
    return savedAudioModuleUnavailable && name === settings.audioDriver
      ? `${label} — saved/unavailable`
      : label;
  };
  const midiModuleLabel = (name: string) => {
    const label = formatCsoundRuntimeModuleOption('midi', name);
    return savedMidiModuleUnavailable && name === settings.midiDriver
      ? `${label} — saved/unavailable`
      : label;
  };

  const checkEngine = async () => {
    setProbing(true);
    try {
      const request = {
        enginePathOverride: usesBundledEngine ? null : externalEnginePath,
        ...(effectiveCsoundLibraryPath.trim() ? { csoundLibraryPath: effectiveCsoundLibraryPath.trim() } : {}),
      };
      const result = await window.blueAPI.probeEngineRuntime(request);
      setProbeResult(result);
    } finally {
      setProbing(false);
    }
  };

  const queryIo = async (scope: 'audio' | 'midi'): Promise<CsoundIoQueryResult | null> => {
    const requestId = ++ioRequestGeneration.current[scope];
    setIoLoading((current) => ({ ...current, [scope]: true }));
    try {
      const result = await window.blueAPI.queryCsoundIo({
        enginePathOverride: usesBundledEngine ? null : externalEnginePath,
        csoundLibraryPath: effectiveCsoundLibraryPath.trim() || null,
        ...(scope === 'audio' ? { audioModule: settings.audioDriver } : {}),
        ...(scope === 'midi' ? { midiModule: settings.midiDriver } : {}),
      });
      if (!result || requestId !== ioRequestGeneration.current[scope]) return null;
      setIoResult((previous) => {
        if (!previous?.report || !result.report) return result;
        const report = scope === 'audio'
          ? {
              ...previous.report,
              ...result.report,
              selectedMidiModule: previous.report.selectedMidiModule,
              midiInputs: previous.report.midiInputs,
              midiOutputs: previous.report.midiOutputs,
            }
          : {
              ...previous.report,
              ...result.report,
              selectedAudioModule: previous.report.selectedAudioModule,
              audioInputs: previous.report.audioInputs,
              audioOutputs: previous.report.audioOutputs,
            };
        return { ...result, report };
      });
      return result;
    } catch {
      return null;
    } finally {
      if (requestId === ioRequestGeneration.current[scope]) {
        setIoLoading((current) => ({ ...current, [scope]: false }));
      }
    }
  };

  useEffect(() => {
    if (!settings.audioDriver || typeof window.blueAPI.queryCsoundIo !== 'function') return;
    void queryIo('audio');
  }, [settings.audioDriver, externalEnginePath, effectiveCsoundLibraryPath]);

  useEffect(() => {
    if (!settings.midiDriver || typeof window.blueAPI.queryCsoundIo !== 'function') return;
    void queryIo('midi');
  }, [settings.midiDriver, externalEnginePath, effectiveCsoundLibraryPath]);

  const selectedStatus = ioResult?.report
    ? `${ioResult.report.audioModules.length} audio module(s), ${ioResult.report.midiModules.length} MIDI module(s)`
    : null;

  return (
    <SettingsSection title="Realtime Render">
      <SettingsSubsectionTitle>Blue Engine</SettingsSubsectionTitle>

      <div className="mb-3 text-role-body text-app-text-muted">
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
          className="rounded-md border border-app-border px-3 py-1.5 text-role-body text-app-text-muted hover:border-app-accent/60"
        >
          Use Bundled Blue Engine
        </button>
        <button
          type="button"
          disabled={probing}
          onClick={() => { void checkEngine(); }}
          className="rounded-md bg-app-accent px-3 py-1.5 text-role-body text-white disabled:opacity-50"
        >
          {probing ? 'Checking…' : 'Check Engine and Csound'}
        </button>
      </div>
      {probeResult && (
        <div
          role="status"
          className={cn(
            'mb-4 rounded-md border px-3 py-2 text-role-body',
            probeResult.ok
              ? 'border-app-success/40 bg-app-success/10 text-app-text'
              : 'border-app-danger/40 bg-app-danger/10 text-app-danger',
          )}
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

      <div className="mb-4 text-role-callout text-app-text-subtle">
        Realtime and offline work use the managed Blue Engine Csound runtime; legacy executable settings remain preserved for downgrade compatibility.
      </div>
      <SettingsField
        label="Csound Library Override"
        value={effectiveCsoundLibraryPath}
        onChange={onCsoundLibraryPathChange ?? (() => undefined)}
        placeholder="Leave empty to auto-detect"
        description="Optional absolute path to a supported Csound shared library."
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
        label="Audio Module"
        value={settings.audioDriver}
        onChange={(value) => set('audioDriver', value)}
      >
        {audioModules.length === 0 && <option value={settings.audioDriver}>{settings.audioDriver ? audioModuleLabel(settings.audioDriver) : 'Scan modules'}</option>}
        {audioModules.map((driver) => <option key={driver} value={driver}>{audioModuleLabel(driver)}</option>)}
      </SettingsSelectField>
      <div className="mb-4">
        <button
          type="button"
          disabled={ioLoading.audio}
          onClick={() => { void queryIo('audio'); }}
          className="rounded-md border border-app-border px-3 py-1.5 text-role-body text-app-text-muted hover:border-app-accent/60 disabled:cursor-default disabled:opacity-50"
        >
          {ioLoading.audio ? 'Scanning Audio Devices…' : 'Rescan Audio Devices'}
        </button>
      </div>

      <SettingsCheckboxField
        label="Audio Out Enabled"
        checked={settings.audioOutEnabled}
        onChange={(checked) => set('audioOutEnabled', checked)}
      />
      <RuntimeDeviceField
        label="Audio Out"
        value={settings.audioOutText}
        onChange={(value) => set('audioOutText', value)}
        devices={audioOutputs}
        defaultDevice={{ deviceId: 'dac', label: 'Default (dac) - 2 channels' }}
      />

      <SettingsCheckboxField
        label="Audio In Enabled"
        checked={settings.audioInEnabled}
        onChange={(checked) => set('audioInEnabled', checked)}
      />
      <RuntimeDeviceField
        label="Audio In"
        value={settings.audioInText}
        onChange={(value) => set('audioInText', value)}
        devices={audioInputs}
        defaultDevice={{ deviceId: 'adc', label: 'Default (adc) - 2 channels' }}
      />

      <SettingsSubsectionTitle>MIDI</SettingsSubsectionTitle>

      <SettingsCheckboxField
        label="MIDI Driver Enabled"
        checked={settings.midiDriverEnabled}
        onChange={(checked) => set('midiDriverEnabled', checked)}
      />
      <SettingsSelectField
        label="MIDI Module"
        value={settings.midiDriver}
        onChange={(value) => set('midiDriver', value)}
      >
        {midiModules.length === 0 && <option value={settings.midiDriver}>{settings.midiDriver ? midiModuleLabel(settings.midiDriver) : 'Scan modules'}</option>}
        {midiModules.map((driver) => <option key={driver} value={driver}>{midiModuleLabel(driver)}</option>)}
      </SettingsSelectField>
      <div className="mb-4">
        <button
          type="button"
          disabled={ioLoading.midi}
          onClick={() => { void queryIo('midi'); }}
          className="rounded-md border border-app-border px-3 py-1.5 text-role-body text-app-text-muted hover:border-app-accent/60 disabled:cursor-default disabled:opacity-50"
        >
          {ioLoading.midi ? 'Scanning MIDI Devices…' : 'Rescan MIDI Devices'}
        </button>
      </div>

      <SettingsCheckboxField
        label="MIDI Out Enabled"
        checked={settings.midiOutEnabled}
        onChange={(checked) => set('midiOutEnabled', checked)}
      />
      <RuntimeDeviceField
        label="MIDI Out"
        value={settings.midiOutText}
        onChange={(value) => set('midiOutText', value)}
        devices={midiOutputs}
      />

      <SettingsCheckboxField
        label="MIDI In Enabled"
        checked={settings.midiInEnabled}
        onChange={(checked) => set('midiInEnabled', checked)}
      />
      <RuntimeDeviceField
        label="MIDI In"
        value={settings.midiInText}
        onChange={(value) => set('midiInText', value)}
        devices={midiInputs}
      />

      <div role="status" className="mb-3 text-role-callout text-app-text-muted">
        {selectedStatus ?? 'Runtime modules and devices load automatically for the selected audio and MIDI modules. Use Rescan when devices are attached or detached.'}
        {savedAudioModuleUnavailable ? ' — saved audio module is currently unavailable' : ''}
        {savedMidiModuleUnavailable ? ' — saved MIDI module is currently unavailable' : ''}
        {ioResult && !ioResult.ok ? ` — ${ioResult.message}` : ''}
      </div>

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
