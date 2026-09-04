import { describe, expect, it } from 'vitest';
import {
  boundedDiagnostic,
  decodeEngineCompatibilityReport,
  normalizeEngineProbeRequest,
} from './engine-runtime';

const report = {
  schemaVersion: 1,
  engine: {
    schemaVersion: 1,
    engineVersion: '0.1.0',
    protocolVersion: 2,
    sourceRevision: 'test',
    features: ['csound-probe-v1'],
  },
  csound: {
    status: 'ready',
    requestedPath: null,
    loadedPath: '/library',
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

describe('engine runtime shared contract', () => {
  it('decodes a serializable compatibility report', () => {
    expect(decodeEngineCompatibilityReport(report)).toEqual(report);
  });

  it('rejects inconsistent readiness and malformed arrays', () => {
    expect(() =>
      decodeEngineCompatibilityReport({
        ...report,
        ready: false,
      }),
    ).toThrow('inconsistent');
    expect(() =>
      decodeEngineCompatibilityReport({
        ...report,
        csound: { ...report.csound, missingSymbols: [1] },
      }),
    ).toThrow('missingSymbols');
  });

  it('normalizes transient requests without retaining unknown fields', () => {
    expect(
      normalizeEngineProbeRequest({
        enginePathOverride: ' /engine ',
        csoundLibraryPath: '',
        projectData: 'must-not-cross-ipc',
      }),
    ).toEqual({
      enginePathOverride: '/engine',
      csoundLibraryPath: null,
    });
  });

  it('bounds and strips NUL diagnostics', () => {
    expect(boundedDiagnostic(`abc\0${'x'.repeat(20)}`, 8)).toBe('abcxxxxx');
  });
});
