import {
  CSOUND_IO_FEATURE,
  CSOUND_PERFORMANCE_FEATURE,
  CSOUND_UTILITY_FEATURE,
  hasEngineFeature,
  type EngineCapabilities,
} from '@blue/engine-client/capabilities';
import {
  boundedDiagnostic,
  decodeEngineCompatibilityReport,
  type CsoundCompatibility,
  type EngineProbeErrorCode,
  type EngineProbeRequest,
  type EngineSelection,
} from './engine-runtime';

export {
  CSOUND_IO_FEATURE,
  CSOUND_PERFORMANCE_FEATURE,
  CSOUND_UTILITY_FEATURE,
} from '@blue/engine-client/capabilities';

export type CsoundRuntimeModuleKind = 'audio' | 'midi';
export type CsoundRuntimeDeviceDirection = 'input' | 'output';

export interface CsoundRuntimeModule {
  name: string;
  kind: CsoundRuntimeModuleKind;
}

/**
 * Stable, human-readable names for the module identifiers used by Csound's
 * runtime backends. These labels are presentation-only: the exact discovered
 * identifier remains the option value and is what program settings persist.
 *
 * Keep this map deliberately small and additive. Runtime discovery remains
 * authoritative, so a backend that is not listed here still appears using its
 * raw name.
 */
const knownAudioModuleLabels: Record<string, string> = {
  auhal: 'CoreAudio',
  coreaudio: 'CoreAudio',
  pa_bl: 'PortAudio - Blocking',
  pa_cb: 'PortAudio - Callback',
  portaudio: 'PortAudio',
  pa: 'PortAudio',
  alsa: 'ALSA',
  pulse: 'PulseAudio',
  pulseaudio: 'PulseAudio',
  jack: 'JACK',
  rtpw: 'PipeWire',
  pw: 'PipeWire',
  pipewire: 'PipeWire',
  wasapi: 'WASAPI',
  mme: 'Windows Multimedia - MME',
  winmm: 'Windows Multimedia - WinMM',
};

const knownMidiModuleLabels: Record<string, string> = {
  coremidi: 'CoreMIDI',
  cm: 'CoreMIDI',
  portmidi: 'PortMIDI',
  pm: 'PortMIDI',
  alsaraw: 'ALSA Raw MIDI',
  alsaseq: 'ALSA Sequencer',
  devfile: 'Device File MIDI',
  mme: 'Windows Multimedia MIDI - MME',
  winmm: 'Windows Multimedia MIDI - WinMM',
  ipmidi: 'ipMIDI',
};

/**
 * Format one module choice for settings without changing its Csound value.
 * Known aliases are shown as `Friendly Name (exact-id)`; unknown identifiers
 * intentionally fall back to the identifier returned by the runtime.
 */
export function formatCsoundRuntimeModuleOption(
  kind: CsoundRuntimeModuleKind,
  name: string,
): string {
  const friendlyName = (kind === 'audio' ? knownAudioModuleLabels : knownMidiModuleLabels)[name.toLowerCase()];
  if (!friendlyName) return name;
  return friendlyName === name
    ? friendlyName
    : `${friendlyName} (${name})`;
}

export interface CsoundRuntimeDevice {
  kind: CsoundRuntimeModuleKind;
  direction: CsoundRuntimeDeviceDirection;
  module: string;
  deviceId: string;
  displayName: string;
  interfaceName: string | null;
  maxChannels: number | null;
}

export interface CsoundIoReport {
  schemaVersion: 1;
  engine: EngineCapabilities;
  csound: CsoundCompatibility;
  selectedAudioModule: string | null;
  selectedMidiModule: string | null;
  audioModules: CsoundRuntimeModule[];
  midiModules: CsoundRuntimeModule[];
  audioInputs: CsoundRuntimeDevice[];
  audioOutputs: CsoundRuntimeDevice[];
  midiInputs: CsoundRuntimeDevice[];
  midiOutputs: CsoundRuntimeDevice[];
  diagnostics: string[];
  ready: boolean;
}

export type CsoundIoQueryErrorCode =
  | EngineProbeErrorCode
  | 'ENGINE_CAPABILITY_MISSING'
  | 'CSOUND_IO_QUERY_TIMEOUT'
  | 'CSOUND_IO_QUERY_FAILED'
  | 'CSOUND_IO_QUERY_INVALID_JSON'
  | 'CSOUND_MODULE_UNAVAILABLE';

export interface CsoundIoQueryRequest extends EngineProbeRequest {
  audioModule?: string | null;
  midiModule?: string | null;
}

export interface CsoundIoQueryResult {
  ok: boolean;
  selection: EngineSelection | null;
  report: CsoundIoReport | null;
  errorCode: CsoundIoQueryErrorCode | null;
  message: string;
  durationMs: number;
}

export interface CsoundExecutionCommonRequest {
  operationId: string;
  args: string[];
  cwd: string;
  csoundLibraryPath?: string | null;
}

export interface CsoundUtilityExecutionRequest extends CsoundExecutionCommonRequest {
  kind: 'utility';
  utilityName: string;
}

export interface CsoundPerformanceExecutionRequest extends CsoundExecutionCommonRequest {
  kind: 'performance';
}

export type CsoundExecutionRequest =
  | CsoundUtilityExecutionRequest
  | CsoundPerformanceExecutionRequest;

export type CsoundExecutionState = 'completed' | 'failed' | 'cancelled';

export interface CsoundExecutionResult {
  operationId: string;
  state: CsoundExecutionState;
  exitCode: number | null;
  signal: string | null;
  stdout: string;
  stderr: string;
  errorCode: string | null;
  message: string;
}

const moduleKinds = new Set<CsoundRuntimeModuleKind>(['audio', 'midi']);
const directions = new Set<CsoundRuntimeDeviceDirection>(['input', 'output']);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringField(value: unknown, field: string, allowEmpty = false): string {
  if (typeof value !== 'string' || (!allowEmpty && value.length === 0)) {
    throw new Error(`${field} must be a${allowEmpty ? ' ' : ' non-empty '}string`);
  }
  return value;
}

function nullableStringField(value: unknown, field: string): string | null {
  if (value === null) return null;
  return stringField(value, field);
}

function decodeModule(value: unknown): CsoundRuntimeModule {
  if (!isObject(value) || !moduleKinds.has(value.kind as CsoundRuntimeModuleKind)) {
    throw new Error('Invalid Csound runtime module');
  }
  return {
    name: stringField(value.name, 'module.name'),
    kind: value.kind as CsoundRuntimeModuleKind,
  };
}

function decodeDevice(value: unknown): CsoundRuntimeDevice {
  if (!isObject(value)
    || !moduleKinds.has(value.kind as CsoundRuntimeModuleKind)
    || !directions.has(value.direction as CsoundRuntimeDeviceDirection)) {
    throw new Error('Invalid Csound runtime device kind or direction');
  }
  const maxChannels = value.maxChannels;
  if (maxChannels !== null && (!Number.isInteger(maxChannels) || Number(maxChannels) < 0)) {
    throw new Error('Device maxChannels must be a non-negative integer or null');
  }
  return {
    kind: value.kind as CsoundRuntimeModuleKind,
    direction: value.direction as CsoundRuntimeDeviceDirection,
    module: stringField(value.module, 'device.module'),
    deviceId: stringField(value.deviceId, 'device.deviceId'),
    displayName: stringField(value.displayName, 'device.displayName', true),
    interfaceName: nullableStringField(value.interfaceName, 'device.interfaceName'),
    maxChannels: maxChannels === null ? null : Number(maxChannels),
  };
}

function decodeDeviceList(
  value: unknown,
  expectedKind: CsoundRuntimeModuleKind,
  expectedDirection: CsoundRuntimeDeviceDirection,
): CsoundRuntimeDevice[] {
  if (!Array.isArray(value)) throw new Error('Device lists must be arrays');
  return value.map((item) => {
    const device = decodeDevice(item);
    if (device.kind !== expectedKind || device.direction !== expectedDirection) {
      throw new Error('Device list contains an inconsistent kind or direction');
    }
    return device;
  });
}

export function decodeCsoundIoReport(value: unknown): CsoundIoReport {
  if (!isObject(value) || value.schemaVersion !== 1 || !isObject(value.csound)) {
    throw new Error('Unsupported Csound I/O report');
  }
  const engine = decodeEngineCompatibilityReport({
    schemaVersion: 1,
    engine: value.engine,
    csound: value.csound,
    ready: value.ready,
  });
  if (!hasEngineFeature(engine.engine, CSOUND_IO_FEATURE)) {
    throw new Error(`Engine does not advertise ${CSOUND_IO_FEATURE}`);
  }
  if (typeof value.ready !== 'boolean' || value.ready !== engine.ready) {
    throw new Error('Csound I/O readiness is inconsistent');
  }
  if (!Array.isArray(value.diagnostics) || value.diagnostics.some((item) => typeof item !== 'string')) {
    throw new Error('Csound I/O diagnostics must be strings');
  }
  const decodeModules = (items: unknown, expectedKind: CsoundRuntimeModuleKind) => {
    if (!Array.isArray(items)) throw new Error('Runtime module lists must be arrays');
    return items.map((item) => {
      const module = decodeModule(item);
      if (module.kind !== expectedKind) throw new Error('Runtime module kind is inconsistent');
      return module;
    });
  };
  const selectedAudioModule = value.selectedAudioModule === null
    ? null : stringField(value.selectedAudioModule, 'selectedAudioModule');
  const selectedMidiModule = value.selectedMidiModule === null
    ? null : stringField(value.selectedMidiModule, 'selectedMidiModule');
  const audioModules = decodeModules(value.audioModules, 'audio');
  const midiModules = decodeModules(value.midiModules, 'midi');
  if (selectedAudioModule && !audioModules.some((module) => module.name === selectedAudioModule)) {
    throw new Error('Selected audio module is not present in the report');
  }
  if (selectedMidiModule && !midiModules.some((module) => module.name === selectedMidiModule)) {
    throw new Error('Selected MIDI module is not present in the report');
  }
  return {
    schemaVersion: 1,
    engine: engine.engine,
    csound: engine.csound,
    selectedAudioModule,
    selectedMidiModule,
    audioModules,
    midiModules,
    audioInputs: decodeDeviceList(value.audioInputs, 'audio', 'input'),
    audioOutputs: decodeDeviceList(value.audioOutputs, 'audio', 'output'),
    midiInputs: decodeDeviceList(value.midiInputs, 'midi', 'input'),
    midiOutputs: decodeDeviceList(value.midiOutputs, 'midi', 'output'),
    diagnostics: value.diagnostics.map((item) => boundedDiagnostic(item)),
    ready: engine.ready,
  };
}

export function decodeCsoundIoReportJson(json: string): CsoundIoReport {
  try {
    return decodeCsoundIoReport(JSON.parse(json));
  } catch (error) {
    throw new Error(
      `Invalid Csound I/O response: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function normalizeString(value: unknown, field: string): string | null | undefined {
  if (value === undefined || value === null) return value;
  if (typeof value !== 'string') throw new Error(`${field} must be a string or null`);
  const normalized = value.replaceAll('\0', '').trim();
  return normalized.length === 0 ? null : normalized;
}

function normalizeModuleName(value: unknown, field: string): string | null | undefined {
  const normalized = normalizeString(value, field);
  if (normalized && normalized.length >= 128) {
    throw new Error(`${field} exceeds the native Csound module name limit`);
  }
  return normalized;
}

function normalizePathValue(value: unknown, field: string): string | null | undefined {
  if (value === undefined || value === null) return value;
  if (typeof value !== 'string') throw new Error(`${field} must be a string or null`);
  if (value.includes('\0')) throw new Error(`${field} must be NUL-free`);
  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
}

export function normalizeCsoundIoQueryRequest(value: unknown): CsoundIoQueryRequest {
  if (value === undefined || value === null) return {};
  if (!isObject(value)) throw new Error('Csound I/O query request must be an object');
  return {
    enginePathOverride: normalizePathValue(value.enginePathOverride, 'enginePathOverride'),
    csoundLibraryPath: normalizePathValue(value.csoundLibraryPath, 'csoundLibraryPath'),
    audioModule: normalizeModuleName(value.audioModule, 'audioModule'),
    midiModule: normalizeModuleName(value.midiModule, 'midiModule'),
  };
}

export function normalizeCsoundExecutionRequest(
  value: CsoundExecutionRequest,
): CsoundExecutionRequest {
  if (!isObject(value) || (value.kind !== 'utility' && value.kind !== 'performance')) {
    throw new Error('Csound execution kind must be utility or performance');
  }
  if (typeof value.operationId !== 'string') throw new Error('Csound execution operationId is required');
  if (typeof value.cwd !== 'string') throw new Error('Csound execution cwd is required');
  const operationId = value.operationId.trim();
  if (!operationId) throw new Error('Csound execution operationId is required');
  if (!Array.isArray(value.args) || value.args.some((arg) => typeof arg !== 'string' || arg.includes('\0'))) {
    throw new Error('Csound execution args must be NUL-free strings');
  }
  if (!value.cwd.trim()) throw new Error('Csound execution cwd is required');
  const csoundLibraryPath = normalizePathValue(value.csoundLibraryPath, 'csoundLibraryPath');
  if (value.kind === 'utility') {
    const utilityName = value.utilityName.trim();
    if (!utilityName || utilityName === '--' || utilityName.length >= 128 || utilityName.includes('/') || utilityName.includes('\\') || utilityName.includes('\0')) {
      throw new Error('Csound utility name must be a simple registered name');
    }
    return { ...value, operationId, csoundLibraryPath, utilityName };
  }
  return { ...value, operationId, csoundLibraryPath };
}

export function requiredFeatureForExecution(kind: CsoundExecutionRequest['kind']): string {
  return kind === 'utility' ? CSOUND_UTILITY_FEATURE : CSOUND_PERFORMANCE_FEATURE;
}
