import { describe, expect, it } from 'vitest';
import {
  BLUE_ENGINE_PROTOCOL_VERSION,
  CSOUND_IO_FEATURE,
  CSOUND_PERFORMANCE_FEATURE,
  CSOUND_UTILITY_FEATURE,
  decodeEngineCapabilities,
  decodeEngineCapabilitiesJson,
  hasEngineFeature,
} from '../src/capabilities';

const validCapabilities = {
  schemaVersion: 1,
  engineVersion: '0.1.0',
  protocolVersion: BLUE_ENGINE_PROTOCOL_VERSION,
  sourceRevision: 'abc123',
  features: ['engine-state-v1', 'unknown-future-feature'],
};

describe('engine capabilities decoder', () => {
  it('decodes the strict schema and preserves unknown features', () => {
    expect(decodeEngineCapabilities(validCapabilities)).toEqual(validCapabilities);
  });

  it('recognizes the additive Csound runtime feature names', () => {
    const capabilities = {
      ...validCapabilities,
      features: [CSOUND_IO_FEATURE, CSOUND_UTILITY_FEATURE, CSOUND_PERFORMANCE_FEATURE],
    };
    expect(hasEngineFeature(capabilities, CSOUND_IO_FEATURE)).toBe(true);
    expect(hasEngineFeature(capabilities, CSOUND_UTILITY_FEATURE)).toBe(true);
    expect(hasEngineFeature(capabilities, 'future-feature')).toBe(false);
  });

  it.each([
    null,
    [],
    { ...validCapabilities, schemaVersion: 2 },
    { ...validCapabilities, engineVersion: '' },
    { ...validCapabilities, protocolVersion: 1.5 },
    { ...validCapabilities, sourceRevision: '' },
    { ...validCapabilities, features: [1] },
  ])('rejects malformed capabilities %#', (value) => {
    expect(() => decodeEngineCapabilities(value)).toThrow();
  });

  it('normalizes JSON parser failures', () => {
    expect(() => decodeEngineCapabilitiesJson('{')).toThrow('not valid JSON');
  });
});
