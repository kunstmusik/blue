/**
 * MIDI Device Input And Blue Live Routing (SPEC 058).
 *
 * Shared serializable contracts used by main, preload, and renderer. Raw Web MIDI
 * objects (`MIDIAccess`, `MIDIInput`, `MIDIMessageEvent`) never cross IPC and
 * are never persisted. Project MIDI processing continues to live in the
 * canonical `.blue` project model.
 */

// ─── Durable preferences ───

export interface MidiInputDevicePreference {
  /** Non-empty host-supplied stable port ID; primary preference key. */
  id: string;
  /** Last known display name (possibly empty). */
  name: string;
  /** Last known manufacturer (possibly empty). */
  manufacturer: string;
  /** Last known device version (possibly empty). */
  version: string;
  /** The sole user-controlled connection state. */
  enabled: boolean;
}

export interface MidiInputPreferences {
  /** Unique by `id`, deterministically ordered; may contain unavailable devices. */
  devices: MidiInputDevicePreference[];
}

// ─── Transient runtime state ───

export type MidiInputAvailability = 'available' | 'unavailable';

export type MidiInputConnection =
  | 'closed'
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'error';

export interface MidiInputDeviceRuntime {
  id: string;
  name: string;
  manufacturer: string;
  version: string;
  enabled: boolean;
  availability: MidiInputAvailability;
  connection: MidiInputConnection;
  lastError: string | null;
}

export type MidiInputServicePhase =
  | 'idle'
  | 'requestingAccess'
  | 'discovering'
  | 'ready'
  | 'partial'
  | 'unsupported'
  | 'denied'
  | 'error';

export interface MidiInputServiceSnapshot {
  /** Unique per primary-renderer service lifetime. */
  instanceId: string;
  /** Monotonically increases on each published change. */
  revision: number;
  phase: MidiInputServicePhase;
  /** Stable UI ordering: enabled first, then name, then ID. */
  devices: MidiInputDeviceRuntime[];
  /** Aggregate user-facing diagnostic when relevant. */
  message: string | null;
  /** Epoch milliseconds for display/diagnostics. */
  updatedAt: number;
}

// ─── Main-to-primary commands ───

export interface MidiInputReconcileCommand {
  commandId: string;
  type: 'reconcile';
  preferences: MidiInputPreferences;
}

export interface MidiInputRescanCommand {
  commandId: string;
  type: 'rescan';
}

export interface MidiInputShutdownCommand {
  commandId: string;
  type: 'shutdown';
}

export type MidiInputServiceCommand =
  | MidiInputReconcileCommand
  | MidiInputRescanCommand
  | MidiInputShutdownCommand;

export interface MidiInputServiceInitialization {
  preferences: MidiInputPreferences;
  cachedSnapshot: MidiInputServiceSnapshot | null;
}

export interface MidiInputCommandAck {
  commandId: string;
  accepted: boolean;
  message?: string;
}

// ─── Normalized note events ───

export type MidiNoteType = 'noteOn' | 'noteOff';

export type MidiNoteSourceKind = 'hardware' | 'mouse' | 'computer';

export interface MidiNoteEvent {
  type: MidiNoteType;
  sourceKind: MidiNoteSourceKind;
  /** Stable runtime source identity (e.g. `midi:<port-id>` or `virtual-keyboard:mouse`). */
  sourceId: string;
  /** Present only for hardware events. */
  deviceId: string | null;
  /** Zero-based MIDI channel, 0 through 15. */
  channel: number;
  /** 0 through 127. */
  midiNote: number;
  /** 0 through 127; note-off may retain release velocity. */
  velocity: number;
  /** Source high-resolution timestamp when available; otherwise renderer's monotonic time. */
  timestamp: number;
}

export interface MidiNoteRouteResult {
  accepted: boolean;
  message?: string;
}

// ─── IPC channel names ───

export const MIDI_INPUT_INITIALIZE_CHANNEL = 'midi-input:initialize-service';
export const MIDI_INPUT_SERVICE_COMMAND_CHANNEL = 'midi-input:service-command';
export const MIDI_INPUT_COMMAND_ACK_CHANNEL = 'midi-input:command-ack';
export const MIDI_INPUT_REPORT_SNAPSHOT_CHANNEL = 'midi-input:report-snapshot';
export const MIDI_INPUT_GET_SNAPSHOT_CHANNEL = 'midi-input:get-snapshot';
export const MIDI_INPUT_REQUEST_RESCAN_CHANNEL = 'midi-input:request-rescan';
export const MIDI_INPUT_SNAPSHOT_CHANGED_CHANNEL = 'midi-input:snapshot-changed';

// ─── Defaults and validation ───

export function createDefaultMidiInputPreferences(): MidiInputPreferences {
  return { devices: [] };
}

/**
 * Deterministic ordering: enabled first, then lexicographic name, then ID.
 * Stable across renderer reloads and consistent in snapshots and persistence.
 */
export function compareMidiInputDevicePreference(
  a: MidiInputDevicePreference,
  b: MidiInputDevicePreference,
): number {
  if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
  const aName = a.name || '';
  const bName = b.name || '';
  if (aName !== bName) return aName < bName ? -1 : 1;
  const aId = a.id || '';
  const bId = b.id || '';
  if (aId !== bId) return aId < bId ? -1 : 1;
  return 0;
}

/**
 * Normalize and deduplicate raw device preferences by ID. The last valid enabled
 * choice wins; freshest non-empty metadata wins. Empty IDs are dropped.
 */
export function normalizeMidiInputPreferences(
  raw: unknown,
): MidiInputPreferences {
  if (!raw || typeof raw !== 'object') {
    return createDefaultMidiInputPreferences();
  }
  const devicesRaw = (raw as { devices?: unknown }).devices;
  if (!Array.isArray(devicesRaw)) {
    return createDefaultMidiInputPreferences();
  }
  const byId = new Map<string, MidiInputDevicePreference>();
  for (const entry of devicesRaw) {
    if (!entry || typeof entry !== 'object') continue;
    const r = entry as Record<string, unknown>;
    const id = typeof r.id === 'string' ? r.id.trim() : '';
    if (!id) continue;
    const existing = byId.get(id);
    const candidate: MidiInputDevicePreference = {
      id,
      name: typeof r.name === 'string' ? r.name : (existing?.name ?? ''),
      manufacturer:
        typeof r.manufacturer === 'string'
          ? r.manufacturer
          : (existing?.manufacturer ?? ''),
      version:
        typeof r.version === 'string' ? r.version : (existing?.version ?? ''),
      enabled:
        typeof r.enabled === 'boolean'
          ? r.enabled
          : (existing?.enabled ?? false),
    };
    byId.set(id, candidate);
  }
  const devices = Array.from(byId.values()).sort(
    compareMidiInputDevicePreference,
  );
  return { devices };
}

/**
 * Returns the MIDI source identifier used by the note router for hardware events.
 */
export function getHardwareMidiSourceId(deviceId: string): string {
  return `midi:${deviceId}`;
}

export const MIDI_INPUT_PANEL_ID = 'midi';

/**
 * Channel range / note validation used by the note router before submission.
 */
export function isValidMidiChannel(channel: number): boolean {
  return Number.isInteger(channel) && channel >= 0 && channel <= 15;
}

export function isValidMidiNote(note: number): boolean {
  return Number.isInteger(note) && note >= 0 && note <= 127;
}

export function isValidMidiVelocity(velocity: number): boolean {
  return Number.isInteger(velocity) && velocity >= 0 && velocity <= 127;
}
