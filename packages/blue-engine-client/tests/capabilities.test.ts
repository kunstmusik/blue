import { describe, expect, it } from 'vitest';
import {
  BLUE_ENGINE_PROTOCOL_VERSION,
  decodeEngineCapabilities,
  decodeEngineCapabilitiesJson,
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
