// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultRealtimeRenderSettings, type RealtimeRenderSettingsSnapshot } from '../../shared/program-settings';
import RealtimeRenderSettings from '../components/settings/RealtimeRenderSettings';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
const probeEngineRuntime = vi.fn();
const queryCsoundIo = vi.fn();

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  (window as any).blueAPI = { probeEngineRuntime, queryCsoundIo };
  probeEngineRuntime.mockReset();
  queryCsoundIo.mockReset();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(
  enginePath: string,
  onEnginePathChange = vi.fn(),
  onChange = vi.fn(),
  settingsOverrides: Partial<RealtimeRenderSettingsSnapshot> = {},
) {
  const settings = {
    ...createDefaultRealtimeRenderSettings('darwin'),
    ...settingsOverrides,
  };
  act(() => {
    root.render(
      <RealtimeRenderSettings
        settings={settings}
        enginePath={enginePath}
        onChange={onChange}
        onEnginePathChange={onEnginePathChange}
      />,
    );
  });
  return onEnginePathChange;
}

describe('RealtimeRenderSettings engine controls', () => {
  const readyReport = {
    schemaVersion: 1,
    engine: {
      schemaVersion: 1,
      engineVersion: '0.1.0',
      protocolVersion: 1,
      sourceRevision: 'test',
      features: ['csound-io-v1', 'csound-utility-v1', 'csound-performance-v1'],
    },
    csound: {
      status: 'ready',
      requestedPath: null,
      loadedPath: '/Library/Csound',
      versionRaw: 7000,
      major: 7,
      minor: 0,
      patch: 0,
      supportedMajors: [7],
      missingSymbols: [],
      message: 'Csound 7 is ready',
    },
    ready: true,
  };

  function ioResult(overrides: Record<string, unknown> = {}) {
    return {
      ok: true,
      selection: null,
      report: {
        ...readyReport,
        selectedAudioModule: null,
        selectedMidiModule: null,
        audioModules: [{ name: 'pa_bl', kind: 'audio' }],
        midiModules: [{ name: 'coremidi', kind: 'midi' }],
        audioInputs: [],
        audioOutputs: [],
        midiInputs: [],
        midiOutputs: [],
        diagnostics: [],
        ...overrides,
      },
      errorCode: null,
      message: 'Csound modules and devices discovered',
      durationMs: 10,
    };
  }

  it('labels the legacy sentinel as bundled and resets an override', () => {
    const onEnginePathChange = render('blue-engine');
    expect(container.textContent).toContain('Bundled Blue Engine');
    const input = container.querySelector('input[placeholder*="bundled engine"]') as HTMLInputElement;
    expect(input.value).toBe('');

    const reset = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent === 'Use Bundled Blue Engine');
    act(() => reset?.click());
    expect(onEnginePathChange).toHaveBeenCalledWith('blue-engine');
  });

  it('probes the draft external path and displays a structured mismatch', async () => {
    probeEngineRuntime.mockResolvedValue({
      ok: false,
      selection: { source: 'settings-override', executablePath: '/external/blue-engine' },
      report: null,
      errorCode: 'ENGINE_PROTOCOL_MISMATCH',
      message: 'Blue Engine protocol mismatch: expected 1, received 99',
      durationMs: 10,
    });
    render('/external/blue-engine');
    const check = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent === 'Check Engine and Csound');
    await act(async () => check?.click());

    expect(probeEngineRuntime).toHaveBeenCalledWith({
      enginePathOverride: '/external/blue-engine',
    });
    expect(container.textContent).toContain('protocol mismatch');
    expect(container.textContent).toContain('settings-override');
  });

  it('reports recoverable missing Csound details for the bundled engine', async () => {
    probeEngineRuntime.mockResolvedValue({
      ok: false,
      selection: {
        source: 'development',
        executablePath: '/workspace/native/blue-engine',
      },
      report: {
        schemaVersion: 1,
        engine: {
          schemaVersion: 1,
          engineVersion: '0.1.0',
          protocolVersion: 1,
          sourceRevision: 'test',
          features: [],
        },
        csound: {
          status: 'not-found',
          requestedPath: null,
          loadedPath: null,
          versionRaw: null,
          major: null,
          minor: null,
          patch: null,
          supportedMajors: [7],
          missingSymbols: [],
          message: 'No supported Csound library was found',
        },
        ready: false,
      },
      errorCode: 'CSOUND_UNAVAILABLE',
      message: 'No supported Csound library was found',
      durationMs: 10,
    });
    render('blue-engine');
    const check = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent === 'Check Engine and Csound');
    await act(async () => check?.click());
    expect(container.textContent).toContain('No supported Csound library was found');
    expect(container.textContent).toContain('Csound unavailable');
  });

  it('runs a fresh retry when the compatibility action is pressed again', async () => {
    probeEngineRuntime
      .mockResolvedValueOnce({
        ok: false,
        selection: null,
        report: null,
        errorCode: 'ENGINE_PROBE_TIMEOUT',
        message: 'Probe timed out',
        durationMs: 3000,
      })
      .mockResolvedValueOnce({
        ok: true,
        selection: {
          source: 'development',
          executablePath: '/workspace/native/blue-engine',
        },
        report: {
          schemaVersion: 1,
          engine: {
            schemaVersion: 1,
            engineVersion: '0.1.0',
            protocolVersion: 1,
            sourceRevision: 'test',
            features: [],
          },
          csound: {
            status: 'ready',
            requestedPath: null,
            loadedPath: '/Library/Csound',
            versionRaw: 7000,
            major: 7,
            minor: 0,
            patch: 0,
            supportedMajors: [7],
            missingSymbols: [],
            message: 'Csound 7 is ready',
          },
          ready: true,
        },
        errorCode: null,
        message: 'Csound 7 is ready',
        durationMs: 12,
      });
    render('blue-engine');
    const check = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent === 'Check Engine and Csound');
    await act(async () => check?.click());
    expect(container.textContent).toContain('Probe timed out');
    await act(async () => check?.click());
    expect(probeEngineRuntime).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('Csound 7 is ready');
  });

  it('loads runtime modules and devices automatically for the selected modules', async () => {
    probeEngineRuntime.mockResolvedValue({
      ok: true,
      selection: null,
      report: readyReport,
      errorCode: null,
      message: 'Csound 7 is ready',
      durationMs: 10,
    });
    queryCsoundIo.mockImplementation(async (request: any) => (
      request.audioModule
        ? ioResult({
            selectedAudioModule: request.audioModule,
            audioOutputs: [{
              kind: 'audio', direction: 'output', module: request.audioModule,
              deviceId: 'hw:exact-output', displayName: 'Exact Output',
              interfaceName: null, maxChannels: 2,
            }],
          })
        : ioResult()
    ));
    const onChange = vi.fn();
    render('blue-engine', vi.fn(), onChange);
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(queryCsoundIo).toHaveBeenCalledWith({
      enginePathOverride: null,
      csoundLibraryPath: null,
      audioModule: 'auhal',
    });
    expect(queryCsoundIo).toHaveBeenCalledWith({
      enginePathOverride: null,
      csoundLibraryPath: null,
      midiModule: 'portmidi',
    });
    expect(container.textContent).toContain('pa_bl');
    expect(Array.from(container.querySelectorAll('button')).some((button) => button.textContent === 'Rescan Audio Devices')).toBe(true);
    expect(Array.from(container.querySelectorAll('button')).some((button) => button.textContent === 'Rescan MIDI Devices')).toBe(true);
    const audioInput = container.querySelector<HTMLInputElement>('input[aria-controls="runtime-devices-audio-out"]');
    act(() => audioInput?.click());
    expect(document.body.querySelector('[role="listbox"][aria-label="Audio Out devices"]')?.textContent)
      .toContain('Exact Output');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows friendly labels while preserving exact discovered module values', async () => {
    queryCsoundIo.mockResolvedValue(ioResult({
      audioModules: [
        { name: 'pa_bl', kind: 'audio' },
        { name: 'auhal', kind: 'audio' },
        { name: 'third-party-backend', kind: 'audio' },
      ],
      midiModules: [
        { name: 'portmidi', kind: 'midi' },
        { name: 'coremidi', kind: 'midi' },
      ],
    }));
    render('blue-engine', vi.fn(), vi.fn(), { audioDriver: 'auhal', midiDriver: 'coremidi' });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });

    const selects = container.querySelectorAll<HTMLSelectElement>('select');
    expect(Array.from(selects[0]?.options ?? []).map((option) => [option.value, option.textContent])).toEqual([
      ['auhal', 'CoreAudio (auhal)'],
      ['pa_bl', 'PortAudio - Blocking (pa_bl)'],
      ['third-party-backend', 'third-party-backend'],
    ]);
    expect(Array.from(selects[1]?.options ?? []).map((option) => [option.value, option.textContent])).toEqual([
      ['coremidi', 'CoreMIDI (coremidi)'],
      ['portmidi', 'PortMIDI (portmidi)'],
    ]);
  });

  it('manually rescans the selected device list without rescanning the other side', async () => {
    queryCsoundIo.mockResolvedValue(ioResult());
    render('blue-engine');
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    const audioRescan = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent === 'Rescan Audio Devices');
    await act(async () => {
      audioRescan?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(queryCsoundIo.mock.calls.filter(([request]) => request.audioModule)).toHaveLength(2);
    expect(queryCsoundIo.mock.calls.filter(([request]) => request.midiModule)).toHaveLength(1);
  });

  it('refreshes only the device list for a changed module', async () => {
    queryCsoundIo.mockResolvedValue(ioResult());
    const initialSettings = { ...createDefaultRealtimeRenderSettings('darwin'), audioDriver: 'pa_bl' };
    const onEnginePathChange = vi.fn();
    const onChange = vi.fn();
    const renderSettings = (settings: RealtimeRenderSettingsSnapshot) => {
      act(() => {
        root.render(
          <RealtimeRenderSettings
            settings={settings}
            enginePath="blue-engine"
            onChange={onChange}
            onEnginePathChange={onEnginePathChange}
          />,
        );
      });
    };
    renderSettings(initialSettings);
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(queryCsoundIo).toHaveBeenCalledTimes(2);

    renderSettings({ ...initialSettings, audioDriver: 'auhal' });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(queryCsoundIo).toHaveBeenCalledWith({
      enginePathOverride: null,
      csoundLibraryPath: null,
      audioModule: 'auhal',
    });
    expect(queryCsoundIo.mock.calls.filter(([request]) => request.midiModule)).toHaveLength(1);
  });

  it('labels an unavailable saved module and keeps retry diagnostics visible', async () => {
    probeEngineRuntime.mockResolvedValue({
      ok: true,
      selection: null,
      report: readyReport,
      errorCode: null,
      message: 'Csound 7 is ready',
      durationMs: 10,
    });
    queryCsoundIo.mockResolvedValue({
      ...ioResult({ audioModules: [{ name: 'other-audio', kind: 'audio' }] }),
      ok: false,
      errorCode: 'CSOUND_MODULE_UNAVAILABLE',
      message: 'Audio module is unavailable: auhal',
    });
    render('blue-engine');
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(container.textContent).toContain('saved audio module is currently unavailable');
    expect(container.textContent).toContain('Audio module is unavailable');
    expect(container.querySelector('option[value="auhal"]')).toBeTruthy();
  });

  it('keeps device fields editable when defaults are disabled and exposes default entries', () => {
    render('blue-engine', vi.fn(), vi.fn(), {
      audioOutEnabled: false,
      audioInEnabled: false,
      midiOutEnabled: false,
      midiInEnabled: false,
      audioDriverEnabled: false,
      midiDriverEnabled: false,
    });
    expect(container.querySelector<HTMLInputElement>('input[aria-controls="runtime-devices-audio-out"]')?.disabled).toBe(false);
    expect(container.querySelector<HTMLInputElement>('input[aria-controls="runtime-devices-audio-in"]')?.disabled).toBe(false);
    expect(container.querySelector<HTMLInputElement>('input[aria-controls="runtime-devices-midi-out"]')?.disabled).toBe(false);
    expect(container.querySelector<HTMLInputElement>('input[aria-controls="runtime-devices-midi-in"]')?.disabled).toBe(false);
    expect(container.querySelector<HTMLSelectElement>('select')?.disabled).toBe(false);
    expect(container.querySelectorAll<HTMLSelectElement>('select')[1]?.disabled).toBe(false);
    const audioOutInput = container.querySelector<HTMLInputElement>('input[aria-controls="runtime-devices-audio-out"]');
    const audioInInput = container.querySelector<HTMLInputElement>('input[aria-controls="runtime-devices-audio-in"]');
    act(() => audioOutInput?.click());
    expect(document.body.querySelector('[role="listbox"][aria-label="Audio Out devices"]')?.textContent)
      .toContain('Default (dac) - 2 channels');
    act(() => audioInInput?.click());
    expect(document.body.querySelector('[role="listbox"][aria-label="Audio In devices"]')?.textContent)
      .toContain('Default (adc) - 2 channels');
    expect(container.querySelector('button[aria-label*="Choose"]')).toBeNull();
  });

  it('shows runtime device names and audio channel capacity in the full option list', async () => {
    queryCsoundIo.mockResolvedValue(ioResult({
      audioOutputs: [{
        kind: 'audio', direction: 'output', module: 'pa_bl', deviceId: 'hw:exact-output',
        displayName: 'Headphones', interfaceName: 'Built-in Output', maxChannels: 2,
      }],
      midiInputs: [{
        kind: 'midi', direction: 'input', module: 'coremidi', deviceId: 'midi:controller',
        displayName: 'Controller', interfaceName: 'CoreMIDI', maxChannels: null,
      }],
    }));
    render('blue-engine', vi.fn(), vi.fn(), { audioOutText: 'dac1' });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(queryCsoundIo).toHaveBeenCalledWith({
      enginePathOverride: null,
      csoundLibraryPath: null,
      audioModule: 'auhal',
    });
    const audioOutInput = container.querySelector<HTMLInputElement>('input[aria-controls="runtime-devices-audio-out"]');
    act(() => audioOutInput?.click());
    const audioOption = Array.from(document.body.querySelectorAll('[role="listbox"][aria-label="Audio Out devices"] button[role="option"]'))
      .find((option) => option.textContent?.includes('Headphones'));
    expect(audioOption?.textContent).toBe('Headphones — Built-in Output (hw:exact-output) - 2 channels');
  });
});
