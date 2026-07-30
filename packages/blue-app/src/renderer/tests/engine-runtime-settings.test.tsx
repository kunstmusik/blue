// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultRealtimeRenderSettings } from '../../shared/program-settings';
import RealtimeRenderSettings from '../components/settings/RealtimeRenderSettings';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
const probeEngineRuntime = vi.fn();

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  (window as any).blueAPI = { probeEngineRuntime };
  probeEngineRuntime.mockReset();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(enginePath: string, onEnginePathChange = vi.fn()) {
  act(() => {
    root.render(
      <RealtimeRenderSettings
        settings={createDefaultRealtimeRenderSettings('darwin')}
        enginePath={enginePath}
        onChange={vi.fn()}
        onEnginePathChange={onEnginePathChange}
      />,
    );
  });
  return onEnginePathChange;
}

describe('RealtimeRenderSettings engine controls', () => {
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
});
