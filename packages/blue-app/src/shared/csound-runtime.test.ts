import { describe, expect, it } from 'vitest';
import {
  decodeCsoundIoReport,
  formatCsoundRuntimeModuleOption,
  normalizeCsoundExecutionRequest,
  normalizeCsoundIoQueryRequest,
} from './csound-runtime';

const ioReport = {
  schemaVersion: 1,
  engine: {
    schemaVersion: 1,
    engineVersion: '0.1.0',
    protocolVersion: 2,
    sourceRevision: 'test',
    features: ['csound-probe-v1', 'csound-io-v1'],
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
  selectedAudioModule: 'pa_bl',
  selectedMidiModule: null,
  audioModules: [{ name: 'pa_bl', kind: 'audio' }],
  midiModules: [],
  audioInputs: [],
  audioOutputs: [
    {
      kind: 'audio',
      direction: 'output',
      module: 'pa_bl',
      deviceId: 'Built-in Output',
      displayName: 'Built-in Output',
      interfaceName: null,
      maxChannels: 2,
    },
  ],
  midiInputs: [],
  midiOutputs: [],
  diagnostics: [],
  ready: true,
};

describe('Csound runtime shared contract', () => {
  it('formats known module identifiers without changing their exact values', () => {
    expect(formatCsoundRuntimeModuleOption('audio', 'auhal')).toBe('CoreAudio (auhal)');
    expect(formatCsoundRuntimeModuleOption('audio', 'pa_bl')).toBe('PortAudio - Blocking (pa_bl)');
    expect(formatCsoundRuntimeModuleOption('audio', 'pa_cb')).toBe('PortAudio - Callback (pa_cb)');
    expect(formatCsoundRuntimeModuleOption('audio', 'PortAudio')).toBe('PortAudio');
    expect(formatCsoundRuntimeModuleOption('audio', 'pulse')).toBe('PulseAudio (pulse)');
    expect(formatCsoundRuntimeModuleOption('audio', 'wasapi')).toBe('WASAPI (wasapi)');
    expect(formatCsoundRuntimeModuleOption('audio', 'mme')).toBe('Windows Multimedia - MME (mme)');
    expect(formatCsoundRuntimeModuleOption('midi', 'coremidi')).toBe('CoreMIDI (coremidi)');
    expect(formatCsoundRuntimeModuleOption('midi', 'alsaseq')).toBe('ALSA Sequencer (alsaseq)');
    expect(formatCsoundRuntimeModuleOption('audio', 'third-party-backend')).toBe(
      'third-party-backend',
    );
  });

  it('decodes modules, exact device identifiers, and successful empty lists', () => {
    expect(decodeCsoundIoReport(ioReport).audioOutputs[0]?.deviceId).toBe('Built-in Output');
    expect(decodeCsoundIoReport(ioReport).audioInputs).toEqual([]);
  });

  it('rejects missing capabilities and inconsistent selections', () => {
    expect(() =>
      decodeCsoundIoReport({
        ...ioReport,
        engine: { ...ioReport.engine, features: ['csound-probe-v1'] },
      }),
    ).toThrow('csound-io-v1');
    expect(() =>
      decodeCsoundIoReport({
        ...ioReport,
        selectedAudioModule: 'missing',
      }),
    ).toThrow('not present');
  });

  it('rejects malformed report schemas, device directions, and diagnostics', () => {
    expect(() => decodeCsoundIoReport({ ...ioReport, schemaVersion: 2 })).toThrow('Unsupported');
    expect(() =>
      decodeCsoundIoReport({
        ...ioReport,
        audioModules: [{ name: 'pa_bl', kind: 'midi' }],
      }),
    ).toThrow('module kind');
    expect(() =>
      decodeCsoundIoReport({
        ...ioReport,
        audioOutputs: [{ ...ioReport.audioOutputs[0], direction: 'sideways' }],
      }),
    ).toThrow('kind or direction');
    expect(() =>
      decodeCsoundIoReport({
        ...ioReport,
        audioOutputs: [{ ...ioReport.audioOutputs[0], maxChannels: -1 }],
      }),
    ).toThrow('maxChannels');
    expect(() => decodeCsoundIoReport({ ...ioReport, diagnostics: [42] })).toThrow('diagnostics');
  });

  it('normalizes query input and ignores unknown properties', () => {
    expect(
      normalizeCsoundIoQueryRequest({
        audioModule: ' pa_bl\0 ',
        unknown: 'discarded',
      }),
    ).toEqual({ audioModule: 'pa_bl' });
    expect(
      normalizeCsoundIoQueryRequest({
        csoundLibraryPath: 'C:\\Csound\\CsoundLib64.dll',
        enginePathOverride: '/tmp/blue-engine',
      }),
    ).toEqual({
      csoundLibraryPath: 'C:\\Csound\\CsoundLib64.dll',
      enginePathOverride: '/tmp/blue-engine',
    });
    expect(() =>
      normalizeCsoundIoQueryRequest({
        audioModule: 'x'.repeat(128),
      }),
    ).toThrow('native Csound module name limit');
  });

  it('rejects shell-like utility names while preserving ordered arguments', () => {
    expect(
      normalizeCsoundExecutionRequest({
        kind: 'utility',
        operationId: 'utility-1',
        utilityName: 'sndinfo',
        args: ['C:\\Users\\Blue User\\file.aif'],
        cwd: '/tmp',
      }).args,
    ).toEqual(['C:\\Users\\Blue User\\file.aif']);
    expect(() =>
      normalizeCsoundExecutionRequest({
        kind: 'utility',
        operationId: 'utility-2',
        utilityName: '../csound',
        args: [],
        cwd: '/tmp',
      }),
    ).toThrow('simple registered name');
    expect(() =>
      normalizeCsoundExecutionRequest({
        kind: 'unknown',
        operationId: 'utility-3',
        utilityName: 'sndinfo',
        args: [],
        cwd: '/tmp',
      } as any),
    ).toThrow('utility or performance');
  });
});
