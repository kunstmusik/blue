/**
 * Renderer-side MIDI input service (SPEC 058).
 *
 * Owns raw Web MIDI access for the lifetime of the primary application
 * renderer. Discovery, port open/close, hot-plug statechange, byte decoding,
 * and note forwarding all live here. Raw browser MIDI objects never leave this
 * module — only serializable snapshots and note events cross IPC.
 *
 * Idempotent under React Strict Mode mount/unmount/mount, rescan, and partial
 * failure: one access `statechange` listener, at most one `midimessage`
 * listener per live input, and per-port generation guards that invalidate
 * stale callbacks.
 */

import {
  compareMidiInputDevicePreference,
  getHardwareMidiSourceId,
  isValidMidiChannel,
  isValidMidiNote,
  isValidMidiVelocity,
  type MidiInputConnection,
  type MidiInputDevicePreference,
  type MidiInputDeviceRuntime,
  type MidiInputPreferences,
  type MidiInputServicePhase,
  type MidiInputServiceSnapshot,
  type MidiNoteEvent,
  type MidiNoteRouteResult,
} from '../../shared/midi-input';

export type RequestMidiAccess = () => Promise<unknown>;

export interface MidiInputServiceDependencies {
  requestAccess: RequestMidiAccess;
  now: () => number;
  routeNote: (event: MidiNoteEvent) => Promise<MidiNoteRouteResult>;
  releaseSource: (sourceId: string) => Promise<void>;
  publishSnapshot: (snapshot: MidiInputServiceSnapshot) => void;
}

interface PortRuntime {
  id: string;
  /** Generation increments each time we install a listener; stale callbacks compare against this. */
  generation: number;
  /** Last known port reference from MIDIAccess.inputs. */
  port: MidiInputPortLike;
  connection: 'connecting' | 'connected' | 'disconnecting';
}

interface MidiInputPortLike {
  id: string;
  name?: string;
  manufacturer?: string;
  version?: string;
  state?: string;
  connection?: string;
  onmidimessage: ((ev: { data: Uint8Array; timeStamp?: number; target?: unknown }) => void) | null;
  open(): Promise<unknown>;
  close(): Promise<unknown>;
}

interface MidiAccessLike {
  inputs: Map<string, MidiInputPortLike>;
  onstatechange: ((ev: { port?: MidiInputPortLike }) => void) | null;
  addEventListener?(type: string, listener: (ev: unknown) => void): void;
  removeEventListener?(type: string, listener: (ev: unknown) => void): void;
}

export class MidiInputService {
  readonly instanceId: string;
  private deps: MidiInputServiceDependencies;
  private access: MidiAccessLike | null = null;
  private accessListener: ((ev: unknown) => void) | null = null;
  private ports = new Map<string, PortRuntime>();
  private preferences: MidiInputPreferences = { devices: [] };
  private revision = 0;
  private phase: MidiInputServicePhase = 'idle';
  private aggregateMessage: string | null = null;
  private lastErrors = new Map<string, string>();
  private accessInFlight = false;
  private rescanInFlight = false;
  private pendingRescan = false;
  private stopped = false;
  private generationCounter = 0;
  private reconciliationQueue: Promise<void> = Promise.resolve();

  constructor(deps: MidiInputServiceDependencies, instanceId?: string) {
    this.deps = deps;
    this.instanceId = instanceId ?? makeInstanceId();
  }

  /**
   * Begin discovery using the injected access requester. Calling start more
   * than once reuses the in-flight access request and listener set.
   */
  async start(): Promise<void> {
    if (this.stopped) return;
    if (this.access || this.accessInFlight) return;

    this.setPhase('requestingAccess');
    this.accessInFlight = true;
    try {
      const access = (await this.deps.requestAccess()) as MidiAccessLike | undefined;
      this.accessInFlight = false;
      if (!access) {
        this.setPhase('unsupported', 'Web MIDI is not available');
        this.publish();
        return;
      }
      if (this.stopped) return;
      this.access = access;
      this.attachAccessListener(access);
      this.setPhase('discovering');
      await this.reconcile(this.preferences);
    } catch (err) {
      this.accessInFlight = false;
      if (this.stopped) return;
      const message = err instanceof Error ? err.message : String(err);
      this.setPhase(classifyAccessFailure(err), message);
      this.publish();
    }
  }

  /**
   * Stop discovery and close all ports. Safe to call multiple times.
   */
  async stop(): Promise<void> {
    this.stopped = true;
    await this.enqueueReconciliation(() => this.closeAllPortsAndReleaseSources());
    if (this.access && this.accessListener) {
      try {
        this.access.removeEventListener?.('statechange', this.accessListener);
      } catch {
        // ignore
      }
      this.accessListener = null;
    }
    if (this.access) {
      this.access.onstatechange = null;
      this.access = null;
    }
    this.setPhase('idle');
    this.publish();
  }

  /**
   * Apply a new preference set (called from main reconcile command). Closes
   * ports that are no longer enabled, opens newly enabled ports, and refreshes
   * metadata without disturbing unrelated connections.
   */
  async reconcile(preferences: MidiInputPreferences): Promise<void> {
    if (this.stopped) return;
    this.preferences = preferences;
    if (!this.access) {
      // Discovery has not completed yet; preferences are stored so the access
      // handler will apply them once discovery runs.
      return;
    }
    await this.enqueueReconciliation(() => this.runReconciliation(false));
  }

  /**
   * Re-enumerate live inputs and reapply preferences. Coalesces repeated
   * requests while one is in flight.
   */
  async rescan(): Promise<void> {
    if (this.stopped) return;
    if (!this.access) {
      await this.start();
      return;
    }
    if (this.rescanInFlight) {
      this.pendingRescan = true;
      return;
    }
    this.rescanInFlight = true;
    try {
      await this.enqueueReconciliation(() => this.runReconciliation(true));
      while (this.pendingRescan) {
        this.pendingRescan = false;
        await this.enqueueReconciliation(() => this.runReconciliation(true));
      }
    } finally {
      this.rescanInFlight = false;
    }
  }

  private async runReconciliation(fromRescan: boolean): Promise<void> {
    if (this.stopped || !this.access) return;
    if (fromRescan) this.setPhase('discovering');

    const liveInputs = this.collectLiveInputs();
    // Build the union: all live inputs + all remembered preferences.
    const seen = new Set<string>();
    const desired: Array<{
      id: string;
      enabled: boolean;
      live: boolean;
    }> = [];

    for (const entry of liveInputs) {
      const [id, port] = entry;
      seen.add(id);
      const pref = this.preferences.devices.find((p) => p.id === id);
      desired.push({
        id,
        enabled: pref?.enabled ?? true,
        live: true,
      });
    }
    for (const pref of this.preferences.devices) {
      if (seen.has(pref.id)) continue;
      desired.push({
        id: pref.id,
        enabled: pref.enabled,
        live: false,
      });
    }

    // Close ports whose preference is disabled or whose port disappeared.
    for (const [id, runtime] of Array.from(this.ports.entries())) {
      const d = desired.find((x) => x.id === id);
      const shouldClose = !d || !d.live || !d.enabled;
      if (shouldClose) {
        await this.closePort(runtime);
      }
    }

    // Open enabled + available ports. One device failure never cancels another.
    for (const d of desired) {
      if (!d.live || !d.enabled) continue;
      const port = liveInputs.get(d.id);
      if (!port) continue;
      const existing = this.ports.get(d.id);
      if (existing && existing.port === port && port.connection === 'open') continue;
      await this.openPort(d.id, port);
    }

    this.refreshAggregatePhase();
    this.publish();
  }

  private collectLiveInputs(): Map<string, MidiInputPortLike> {
    const result = new Map<string, MidiInputPortLike>();
    if (!this.access?.inputs) return result;
    for (const [id, port] of this.access.inputs) {
      if (port.state === 'disconnected') continue;
      result.set(id, port);
    }
    return result;
  }

  private async openPort(id: string, port: MidiInputPortLike): Promise<void> {
    // Replace any existing generation so stale callbacks cannot route.
    const generation = ++this.generationCounter;
    let runtime = this.ports.get(id);
    if (runtime) {
      // Detach and release the previous port generation before re-attaching.
      // A host may reuse the same stable ID for a replacement port object;
      // notes held by the disappeared generation must not survive that swap.
      runtime.generation = generation;
      runtime.port.onmidimessage = null;
      try {
        await this.deps.releaseSource(getHardwareMidiSourceId(id));
      } catch {
        // best-effort cleanup must not prevent the replacement from opening
      }
      if (runtime.port !== port) {
        try {
          await runtime.port.close();
        } catch {
          /* ignore */
        }
      }
      runtime.port = port;
      runtime.connection = 'connecting';
    } else {
      runtime = { id, generation, port, connection: 'connecting' };
      this.ports.set(id, runtime);
    }

    // Install our handler.
    port.onmidimessage = (ev) => {
      this.onMidiMessage(id, generation, ev);
    };
    this.publish();

    try {
      await port.open();
      if (runtime.generation !== generation) return;
      runtime.connection = 'connected';
      this.lastErrors.delete(id);
      // connection established; phase will refresh in runReconciliation
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.lastErrors.set(id, message);
      // Detach and release source notes that this port may have generated.
      try {
        port.onmidimessage = null;
      } catch {
        /* ignore */
      }
      if (this.ports.get(id) === runtime && runtime.generation === generation) {
        this.ports.delete(id);
      }
      await this.deps.releaseSource(getHardwareMidiSourceId(id));
    }
  }

  private async closePort(runtime: PortRuntime): Promise<void> {
    const generation = ++this.generationCounter;
    const port = runtime.port;
    runtime.generation = generation;
    runtime.connection = 'disconnecting';
    try {
      port.onmidimessage = null;
    } catch {
      // ignore
    }
    this.publish();
    const sourceId = getHardwareMidiSourceId(runtime.id);
    try {
      await this.deps.releaseSource(sourceId);
    } catch {
      // ignore — best effort
    }
    try {
      await port.close();
    } catch {
      // ignore — close failures should not block reconciliation
    }
    if (this.ports.get(runtime.id) === runtime && runtime.generation === generation) {
      this.ports.delete(runtime.id);
    }
  }

  private async closeAllPortsAndReleaseSources(): Promise<void> {
    const runtimes = Array.from(this.ports.values());
    this.ports.clear();
    await Promise.all(
      runtimes.map(async (runtime) => {
        runtime.generation = ++this.generationCounter;
        try {
          runtime.port.onmidimessage = null;
        } catch {
          /* ignore */
        }
        try {
          await this.deps.releaseSource(getHardwareMidiSourceId(runtime.id));
        } catch {
          /* ignore */
        }
        try {
          await runtime.port.close();
        } catch {
          /* ignore */
        }
      }),
    );
  }

  private onMidiMessage(
    portId: string,
    generation: number,
    ev: { data: Uint8Array; timeStamp?: number; target?: unknown },
  ): void {
    const runtime = this.ports.get(portId);
    if (!runtime || runtime.generation !== generation) return;
    const preference = this.preferences.devices.find((p) => p.id === portId);
    if (preference?.enabled === false) return;

    const bytes = ev.data;
    if (!bytes || bytes.length < 2) return;
    const status = bytes[0];
    if (status === undefined) return;
    const statusHigh = status & 0xf0;
    const channel = status & 0x0f;
    const midiNote = bytes[1];
    const velocity = bytes.length >= 3 ? bytes[2] : 0;
    if (midiNote === undefined || velocity === undefined) return;

    let type: 'noteOn' | 'noteOff';
    if (statusHigh === 0x80) {
      type = 'noteOff';
    } else if (statusHigh === 0x90) {
      type = velocity === 0 ? 'noteOff' : 'noteOn';
    } else {
      // Non-note messages are ignored (FR-026).
      return;
    }

    if (!isValidMidiChannel(channel)) return;
    if (!isValidMidiNote(midiNote)) return;
    if (!isValidMidiVelocity(velocity)) return;

    const event: MidiNoteEvent = {
      type,
      sourceKind: 'hardware',
      sourceId: getHardwareMidiSourceId(portId),
      deviceId: portId,
      channel,
      midiNote,
      velocity,
      timestamp: typeof ev.timeStamp === 'number' ? ev.timeStamp : this.deps.now(),
    };
    // The router serializes work without blocking this browser event callback.
    void this.deps.routeNote(event).catch(() => {
      // Swallow routing errors; the engine logs diagnostics.
    });
  }

  private attachAccessListener(access: MidiAccessLike): void {
    this.accessListener = () => {
      void this.rescan().catch(() => {
        // ignore
      });
    };
    if (access.addEventListener) {
      access.addEventListener('statechange', this.accessListener);
    } else {
      access.onstatechange = this.accessListener;
    }
  }

  private setPhase(phase: MidiInputServicePhase, message?: string): void {
    this.phase = phase;
    if (message !== undefined) this.aggregateMessage = message;
    else if (phase === 'idle' || phase === 'ready' || phase === 'discovering') {
      this.aggregateMessage = null;
    }
  }

  private refreshAggregatePhase(): void {
    if (!this.access) {
      return;
    }
    const liveInputs = this.collectLiveInputs();
    const consideredIds = new Set([
      ...this.preferences.devices.map((pref) => pref.id),
      ...liveInputs.keys(),
    ]);
    const enabledDeviceIds = Array.from(consideredIds).filter(
      (id) => this.preferences.devices.find((pref) => pref.id === id)?.enabled ?? true,
    );
    if (enabledDeviceIds.length === 0) {
      this.setPhase('ready');
      this.aggregateMessage = this.aggregateMessage ?? null;
      return;
    }
    const runtimeById = new Map<string, PortRuntime>();
    for (const [id, rt] of this.ports) runtimeById.set(id, rt);

    let connectedCount = 0;
    let failedOrMissing = 0;
    for (const id of enabledDeviceIds) {
      const port = liveInputs.get(id);
      const runtime = runtimeById.get(id);
      const isOpen = !!port && !!runtime && port.connection === 'open';
      if (isOpen) {
        connectedCount++;
      } else {
        failedOrMissing++;
      }
    }
    if (connectedCount === 0) {
      const hasOpenFailure = enabledDeviceIds.some((id) => this.lastErrors.has(id));
      this.setPhase(
        'error',
        hasOpenFailure
          ? 'No enabled MIDI input device could be opened.'
          : 'No enabled MIDI input device is currently available.',
      );
    } else if (failedOrMissing > 0) {
      this.setPhase(
        'partial',
        'Some enabled MIDI input devices are unavailable or could not be opened.',
      );
    } else {
      this.setPhase('ready');
    }
  }

  private buildSnapshot(): MidiInputServiceSnapshot {
    const liveInputs = this.collectLiveInputs();
    const prefById = new Map<string, MidiInputDevicePreference>();
    for (const pref of this.preferences.devices) prefById.set(pref.id, pref);

    const seen = new Set<string>();
    const devices: MidiInputDeviceRuntime[] = [];

    for (const [id, port] of liveInputs) {
      seen.add(id);
      const pref = prefById.get(id);
      const runtime = this.ports.get(id);
      const enabled = pref?.enabled ?? true;
      const lastError = this.lastErrors.get(id) ?? null;
      const connection: MidiInputConnection = runtime
        ? runtime.connection
        : enabled && lastError
          ? 'error'
          : 'closed';
      devices.push({
        id,
        name: port.name ?? pref?.name ?? '',
        manufacturer: port.manufacturer ?? pref?.manufacturer ?? '',
        version: port.version ?? pref?.version ?? '',
        enabled,
        availability: 'available',
        connection,
        lastError,
      });
    }
    for (const pref of this.preferences.devices) {
      if (seen.has(pref.id)) continue;
      const runtime = this.ports.get(pref.id);
      devices.push({
        id: pref.id,
        name: pref.name,
        manufacturer: pref.manufacturer,
        version: pref.version,
        enabled: pref.enabled,
        availability: 'unavailable',
        connection: runtime?.connection ?? 'closed',
        lastError: null,
      });
    }

    devices.sort((a, b) => {
      // enabled-first, then name, then id — same comparator as preferences
      return compareMidiInputDevicePreference(
        {
          id: a.id,
          name: a.name,
          manufacturer: a.manufacturer,
          version: a.version,
          enabled: a.enabled,
        },
        {
          id: b.id,
          name: b.name,
          manufacturer: b.manufacturer,
          version: b.version,
          enabled: b.enabled,
        },
      );
    });

    return {
      instanceId: this.instanceId,
      revision: ++this.revision,
      phase: this.phase,
      devices,
      message: this.aggregateMessage,
      updatedAt: Date.now(),
    };
  }

  private publish(): void {
    if (this.stopped && this.phase !== 'idle') return;
    const snapshot = this.buildSnapshot();
    this.deps.publishSnapshot(snapshot);
  }

  private enqueueReconciliation(operation: () => Promise<void>): Promise<void> {
    const result = this.reconciliationQueue.then(operation, operation);
    this.reconciliationQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

function makeInstanceId(): string {
  return `midi-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function classifyAccessFailure(error: unknown): MidiInputServicePhase {
  const name = error instanceof Error ? error.name : '';
  const message = error instanceof Error ? error.message : String(error);
  if (name === 'NotSupportedError' || /not supported|unavailable/i.test(message)) {
    return 'unsupported';
  }
  if (
    name === 'NotAllowedError' ||
    name === 'SecurityError' ||
    /not allowed|denied|permission/i.test(message)
  ) {
    return 'denied';
  }
  return 'error';
}
