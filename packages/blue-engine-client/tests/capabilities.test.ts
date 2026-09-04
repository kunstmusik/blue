import { describe, expect, it } from 'vitest';
import {
  BLUE_ENGINE_PROTOCOL_VERSION,
  AUTOMATION_DECIMAL_FEATURE,
  CSOUND_IO_FEATURE,
  CSOUND_PERFORMANCE_FEATURE,
  CSOUND_UTILITY_FEATURE,
  OWNER_LIVENESS_FEATURE,
  BATCH_CHANNELS_FEATURE,
  decodeEngineCapabilities,
  decodeEngineCapabilitiesJson,
  hasEngineFeature,
} from '../src/capabilities';

const validCapabilities = {
  schemaVersion: 1,
  engineVersion: '0.1.0',
  protocolVersion: BLUE_ENGINE_PROTOCOL_VERSION,
  sourceRevision: 'abc123',
  features: ['engine-state-v1', AUTOMATION_DECIMAL_FEATURE, 'unknown-future-feature'],
};

describe('engine capabilities decoder', () => {
  it('decodes the strict schema and preserves unknown features', () => {
    expect(decodeEngineCapabilities(validCapabilities)).toEqual(validCapabilities);
  });

  it('recognizes the additive Csound runtime feature names and owner-liveness capability', () => {
    const capabilities = {
      ...validCapabilities,
      features: [
        CSOUND_IO_FEATURE,
        CSOUND_UTILITY_FEATURE,
        CSOUND_PERFORMANCE_FEATURE,
        OWNER_LIVENESS_FEATURE,
      ],
    };
    expect(hasEngineFeature(capabilities, CSOUND_IO_FEATURE)).toBe(true);
    expect(hasEngineFeature(capabilities, CSOUND_UTILITY_FEATURE)).toBe(true);
    expect(hasEngineFeature(capabilities, OWNER_LIVENESS_FEATURE)).toBe(true);
    expect(hasEngineFeature(capabilities, 'future-feature')).toBe(false);
  });

  it('exposes the exact-decimal automation capability', () => {
    expect(hasEngineFeature(validCapabilities, AUTOMATION_DECIMAL_FEATURE)).toBe(true);
  });

  it('recognizes the batch-channels feature and rejects old-engine capability sets for batch commands', () => {
    const withBatch = { ...validCapabilities, features: [BATCH_CHANNELS_FEATURE] };
    expect(hasEngineFeature(withBatch, BATCH_CHANNELS_FEATURE)).toBe(true);
    // an old engine without the feature must not negotiate batch commands
    const legacyEngine = { ...validCapabilities, features: ['engine-state-v1'] };
    expect(hasEngineFeature(legacyEngine, BATCH_CHANNELS_FEATURE)).toBe(false);
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
