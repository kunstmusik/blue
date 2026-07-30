import {
  BLUE_ENGINE_PROTOCOL_VERSION,
  decodeEngineCapabilities,
  type EngineCapabilities,
} from '@blue/engine-client/capabilities';

export type CsoundProbeStatus =
  | 'ready'
  | 'not-found'
  | 'load-failed'
  | 'missing-symbols'
  | 'unsupported-version'
  | 'internal-error';

export interface CsoundCompatibility {
  status: CsoundProbeStatus;
  requestedPath: string | null;
  loadedPath: string | null;
  versionRaw: number | null;
  major: number | null;
  minor: number | null;
  patch: number | null;
  supportedMajors: number[];
  missingSymbols: string[];
  message: string;
}

export interface EngineCompatibilityReport {
  schemaVersion: 1;
  engine: EngineCapabilities;
  csound: CsoundCompatibility;
  ready: boolean;
}

export type EngineSelectionSource =
  | 'environment-override'
  | 'settings-override'
  | 'bundled'
  | 'development';

export interface EngineSelection {
  source: EngineSelectionSource;
  executablePath: string;
  expectedProtocolVersion: number;
  artifactSha256: string | null;
  diagnostic: string | null;
}

export interface EngineProbeRequest {
  enginePathOverride?: string | null;
  csoundLibraryPath?: string | null;
}

export type EngineProbeErrorCode =
  | 'ENGINE_NOT_FOUND'
  | 'ENGINE_NOT_EXECUTABLE'
  | 'ENGINE_ARCH_MISMATCH'
  | 'ENGINE_PROBE_TIMEOUT'
  | 'ENGINE_PROBE_FAILED'
  | 'ENGINE_PROBE_INVALID_JSON'
  | 'ENGINE_PROTOCOL_MISMATCH'
  | 'CSOUND_UNAVAILABLE';

export interface EngineProbeResult {
  ok: boolean;
  selection: EngineSelection | null;
  report: EngineCompatibilityReport | null;
  errorCode: EngineProbeErrorCode | null;
  message: string;
  durationMs: number;
}

const csoundStatuses = new Set<CsoundProbeStatus>([
  'ready',
  'not-found',
  'load-failed',
  'missing-symbols',
  'unsupported-version',
  'internal-error',
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nullableString(value: unknown, field: string): string | null {
  if (value === null) return null;
  if (typeof value !== 'string') throw new Error(`${field} must be a string or null`);
  return value;
}

function nullableInteger(value: unknown, field: string): number | null {
  if (value === null) return null;
  if (!Number.isInteger(value)) throw new Error(`${field} must be an integer or null`);
  return Number(value);
}

export function decodeEngineCompatibilityReport(value: unknown): EngineCompatibilityReport {
  if (!isObject(value) || value.schemaVersion !== 1 || !isObject(value.csound)) {
    throw new Error('Unsupported engine compatibility report');
  }
  const engine = decodeEngineCapabilities(value.engine);
  const csound = value.csound;
  if (!csoundStatuses.has(csound.status as CsoundProbeStatus)) {
    throw new Error('Unknown Csound probe status');
  }
  if (!Array.isArray(csound.supportedMajors) ||
      csound.supportedMajors.some((major) => !Number.isInteger(major))) {
    throw new Error('supportedMajors must contain integers');
  }
  if (!Array.isArray(csound.missingSymbols) ||
      csound.missingSymbols.some((symbol) => typeof symbol !== 'string')) {
    throw new Error('missingSymbols must contain strings');
  }
  if (typeof csound.message !== 'string' || typeof value.ready !== 'boolean') {
    throw new Error('Compatibility readiness fields are invalid');
  }
  if ((value.ready && csound.status !== 'ready') ||
      (!value.ready && csound.status === 'ready')) {
    throw new Error('Compatibility ready/status fields are inconsistent');
  }
  return {
    schemaVersion: 1,
    engine,
    csound: {
      status: csound.status as CsoundProbeStatus,
      requestedPath: nullableString(csound.requestedPath, 'requestedPath'),
      loadedPath: nullableString(csound.loadedPath, 'loadedPath'),
      versionRaw: nullableInteger(csound.versionRaw, 'versionRaw'),
      major: nullableInteger(csound.major, 'major'),
      minor: nullableInteger(csound.minor, 'minor'),
      patch: nullableInteger(csound.patch, 'patch'),
      supportedMajors: csound.supportedMajors.map(Number),
      missingSymbols: [...csound.missingSymbols] as string[],
      message: csound.message,
    },
    ready: value.ready,
  };
}

export function decodeEngineCompatibilityReportJson(json: string): EngineCompatibilityReport {
  try {
    return decodeEngineCompatibilityReport(JSON.parse(json));
  } catch (error) {
    throw new Error(
      `Invalid engine probe response: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function normalizeEngineProbeRequest(value: unknown): EngineProbeRequest {
  if (value === undefined || value === null) return {};
  if (!isObject(value)) throw new Error('Engine probe request must be an object');
  const normalize = (field: string): string | null | undefined => {
    const item = value[field];
    if (item === undefined || item === null) return item;
    if (typeof item !== 'string') throw new Error(`${field} must be a string or null`);
    return item.trim() || null;
  };
  return {
    enginePathOverride: normalize('enginePathOverride'),
    csoundLibraryPath: normalize('csoundLibraryPath'),
  };
}

export function isProtocolCompatible(report: EngineCompatibilityReport): boolean {
  return report.engine.protocolVersion === BLUE_ENGINE_PROTOCOL_VERSION;
}

export function boundedDiagnostic(message: string, maximumLength = 4096): string {
  return message.replaceAll('\0', '').slice(0, maximumLength);
}
