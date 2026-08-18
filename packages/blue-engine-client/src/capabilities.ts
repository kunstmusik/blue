/**
 * Protocol version 2: automation create/update payloads carry the
 * authoritative Java-canonical decimal resolution text (see protocol.ts).
 * The app, engine client, and bundled engine change atomically; version 2 is
 * an incompatible schema marker so an accidentally mixed pairing fails the
 * handshake before any automation command is published.
 */
export const BLUE_ENGINE_PROTOCOL_VERSION = 2;
export const BLUE_ENGINE_CAPABILITIES_SCHEMA_VERSION = 1;
export const CSOUND_IO_FEATURE = 'csound-io-v1';
export const CSOUND_UTILITY_FEATURE = 'csound-utility-v1';
export const CSOUND_PERFORMANCE_FEATURE = 'csound-performance-v1';
/** Declared by engines whose automation payload uses exact decimal text. */
export const AUTOMATION_DECIMAL_FEATURE = 'automation-decimal-v1';
/** Declared by engines supporting the native owner lifetime monitor. */
export const OWNER_LIVENESS_FEATURE = 'owner-liveness-v1';

export interface EngineCapabilities {
  schemaVersion: 1;
  engineVersion: string;
  protocolVersion: number;
  sourceRevision: string;
  features: string[];
}

export function hasEngineFeature(
  capabilities: EngineCapabilities,
  feature: string,
): boolean {
  return capabilities.features.includes(feature);
}

export class EngineCapabilitiesDecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EngineCapabilitiesDecodeError';
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function decodeEngineCapabilities(value: unknown): EngineCapabilities {
  if (!isObject(value)) {
    throw new EngineCapabilitiesDecodeError('Engine capabilities must be an object');
  }
  if (value.schemaVersion !== BLUE_ENGINE_CAPABILITIES_SCHEMA_VERSION) {
    throw new EngineCapabilitiesDecodeError('Unsupported engine capabilities schema');
  }
  if (typeof value.engineVersion !== 'string' || value.engineVersion.trim() === '') {
    throw new EngineCapabilitiesDecodeError('Engine version is required');
  }
  if (!Number.isInteger(value.protocolVersion) || Number(value.protocolVersion) <= 0) {
    throw new EngineCapabilitiesDecodeError('Protocol version must be a positive integer');
  }
  if (typeof value.sourceRevision !== 'string' || value.sourceRevision.trim() === '') {
    throw new EngineCapabilitiesDecodeError('Source revision is required');
  }
  if (!Array.isArray(value.features) || value.features.some((feature) => typeof feature !== 'string')) {
    throw new EngineCapabilitiesDecodeError('Engine features must be strings');
  }
  return {
    schemaVersion: 1,
    engineVersion: value.engineVersion,
    protocolVersion: Number(value.protocolVersion),
    sourceRevision: value.sourceRevision,
    features: [...value.features],
  };
}

export function decodeEngineCapabilitiesJson(json: string): EngineCapabilities {
  try {
    return decodeEngineCapabilities(JSON.parse(json));
  } catch (error) {
    if (error instanceof EngineCapabilitiesDecodeError) {
      throw error;
    }
    throw new EngineCapabilitiesDecodeError('Engine capabilities are not valid JSON');
  }
}
