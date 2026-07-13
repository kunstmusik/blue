/**
 * Fake Web MIDI fixtures for testing the MIDI input service without browser hardware.
 *
 * Provides minimal, behavior-compatible `MIDIAccess`, `MIDIInput`, `MIDIOutput`,
 * and `MIDIMessageEvent` shims sufficient for discovery, reconciliation,
 * open/close, hot-plug statechange, and message dispatch tests.
 */

export type FakeMidiPortState = 'connected' | 'disconnected';
export type FakeMidiPortConnection = 'open' | 'closed';

export interface FakeMidiPortOptions {
  id: string;
  name?: string;
  manufacturer?: string;
  version?: string;
  state?: FakeMidiPortState;
  connection?: FakeMidiPortConnection;
  type?: 'input' | 'output';
  onopen?: () => void;
  onclose?: () => void;
}

interface FakeMidiPortLike {
  id: string;
  name: string;
  manufacturer: string;
  version: string;
  type: 'input' | 'output';
  state: FakeMidiPortState;
  connection: FakeMidiPortConnection;
  onstatechange: ((this: unknown, ev: unknown) => unknown) | null;
  open(): Promise<void>;
  close(): Promise<void>;
}

export class FakeMidiInput implements FakeMidiPortLike {
  readonly id: string;
  readonly name: string;
  readonly manufacturer: string;
  readonly version: string;
  readonly type = 'input' as const;
  state: FakeMidiPortState;
  connection: FakeMidiPortConnection;
  onmidimessage:
    | ((this: unknown, ev: { data: Uint8Array; target: unknown; timeStamp: number; srcElement?: unknown }) => unknown)
    | null = null;
  onstatechange: ((this: unknown, ev: unknown) => unknown) | null = null;
  private openImpl?: () => void;
  private closeImpl?: () => void;
  private listeners = new Map<string, Set<(ev: unknown) => void>>();

  constructor(opts: FakeMidiPortOptions) {
    this.id = opts.id;
    this.name = opts.name ?? opts.id;
    this.manufacturer = opts.manufacturer ?? '';
    this.version = opts.version ?? '';
    this.state = opts.state ?? 'connected';
    this.connection = opts.connection ?? 'closed';
    this.openImpl = opts.onopen;
    this.closeImpl = opts.onclose;
  }

  async open(): Promise<void> {
    this.connection = 'open';
    this.openImpl?.();
    this.emitStateChange();
  }

  async close(): Promise<void> {
    this.connection = 'closed';
    this.closeImpl?.();
    this.emitStateChange();
  }

  addEventListener(type: string, listener: (ev: unknown) => void): void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(listener);
  }

  removeEventListener(type: string, listener: (ev: unknown) => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  /**
   * Test-only: emit a parsed message to the registered handler. Bytes are
   * interpreted exactly as provided; the test is responsible for status format.
   */
  emitMessage(bytes: number[], timeStamp = 0): void {
    if (this.state !== 'connected' || this.connection !== 'open') {
      return;
    }
    const data = new Uint8Array(bytes);
    const ev = { data, target: this, timeStamp, srcElement: this };
    const direct = this.onmidimessage;
    if (typeof direct === 'function') {
      void direct.call(this, ev);
    }
    const set = this.listeners.get('midimessage');
    if (set) {
      for (const l of set) l(ev);
    }
  }

  /** Test-only: change state/connection and notify statechange listeners. */
  setState(state: FakeMidiPortState): void {
    this.state = state;
    if (state === 'disconnected') {
      this.connection = 'closed';
    }
    this.emitStateChange();
  }

  setConnection(connection: FakeMidiPortConnection): void {
    this.connection = connection;
    this.emitStateChange();
  }

  private emitStateChange(): void {
    const ev = { target: this, port: this };
    if (typeof this.onstatechange === 'function') {
      void this.onstatechange.call(this, ev);
    }
    const set = this.listeners.get('statechange');
    if (set) {
      for (const l of set) l(ev);
    }
  }
}

export class FakeMidiOutput implements FakeMidiPortLike {
  readonly id: string;
  readonly name: string;
  readonly manufacturer: string;
  readonly version: string;
  readonly type = 'output' as const;
  state: FakeMidiPortState;
  connection: FakeMidiPortConnection;
  onstatechange: ((this: unknown, ev: unknown) => unknown) | null = null;

  constructor(opts: FakeMidiPortOptions) {
    this.id = opts.id;
    this.name = opts.name ?? opts.id;
    this.manufacturer = opts.manufacturer ?? '';
    this.version = opts.version ?? '';
    this.state = opts.state ?? 'connected';
    this.connection = opts.connection ?? 'closed';
  }

  async open(): Promise<void> {
    this.connection = 'open';
  }

  async close(): Promise<void> {
    this.connection = 'closed';
  }

  send(): void {
    // No-op for tests; output is out of scope for SPEC 058.
  }
}

export interface FakeMidiAccessOptions {
  inputs?: FakeMidiInput[];
  outputs?: FakeMidiOutput[];
  /** When set, `requestMIDIAccess` rejects with this error. */
  rejectWith?: Error;
  /** When true, the `inputs`/`outputs` Map objects support `statechange`. */
  trackStateChange?: boolean;
}

type MapLike<T> = Map<string, T> & {
  onstatechange: ((this: unknown, ev: unknown) => unknown) | null;
  addEventListener?(type: string, listener: (ev: unknown) => void): void;
  removeEventListener?(type: string, listener: (ev: unknown) => void): void;
};

function createPortMap<T extends FakeMidiPortLike>(
  ports: T[],
): MapLike<T> {
  const map = new Map<string, T>(ports.map((p) => [p.id, p])) as MapLike<T>;
  const stateListeners = new Set<(ev: unknown) => void>();
  (map as unknown as { onstatechange: null }).onstatechange = null;
  map.addEventListener = (type: string, listener: (ev: unknown) => void) => {
    if (type === 'statechange') stateListeners.add(listener);
  };
  map.removeEventListener = (type: string, listener: (ev: unknown) => void) => {
    if (type === 'statechange') stateListeners.delete(listener);
  };
  const dispatch = (ev: unknown): void => {
    const direct = (map as unknown as { onstatechange: ((ev: unknown) => unknown) | null }).onstatechange;
    if (typeof direct === 'function') void direct.call(map, ev);
    for (const l of stateListeners) l(ev);
  };
  (map as unknown as { __dispatch: typeof dispatch }).__dispatch = dispatch;
  return map;
}

export class FakeMidiAccess {
  readonly sysexEnabled = false;
  readonly inputs: MapLike<FakeMidiInput>;
  readonly outputs: MapLike<FakeMidiOutput>;
  onstatechange: ((this: unknown, ev: unknown) => unknown) | null = null;
  private accessListeners = new Set<(ev: unknown) => void>();

  constructor(opts: FakeMidiAccessOptions = {}) {
    this.inputs = createPortMap(opts.inputs ?? []);
    this.outputs = createPortMap(opts.outputs ?? []);
    // Cascade per-port statechange events up to access-level statechange so the
    // service's `access.onstatechange` listener can reconcile hot-plug.
    const cascade = (ev: unknown): void => {
      this.dispatchAccessStateChange(ev);
    };
    (this.inputs as unknown as { onstatechange: typeof cascade }).onstatechange = cascade;
    (this.outputs as unknown as { onstatechange: typeof cascade }).onstatechange = cascade;
  }

  addEventListener(type: string, listener: (ev: unknown) => void): void {
    if (type === 'statechange') this.accessListeners.add(listener);
  }

  removeEventListener(type: string, listener: (ev: unknown) => void): void {
    if (type === 'statechange') this.accessListeners.delete(listener);
  }

  /**
   * Test-only: simulate physically attaching a new port.
   */
  addInput(port: FakeMidiInput): void {
    this.inputs.set(port.id, port);
    this.dispatchAccessStateChange({ port });
  }

  /**
   * Test-only: simulate physically removing a port (sets state to disconnected
   * and emits both port-level and access-level statechange events).
   */
  removeInput(id: string): void {
    const port = this.inputs.get(id);
    if (!port) return;
    port.setState('disconnected');
    this.inputs.delete(id);
    this.dispatchAccessStateChange({ port });
  }

  private dispatchAccessStateChange(ev: unknown): void {
    if (typeof this.onstatechange === 'function') {
      void this.onstatechange.call(this, ev);
    }
    for (const l of this.accessListeners) l(ev);
  }
}

/**
 * Returns a fake `requestMIDIAccess` factory that resolves with the provided
 * access (or rejects on demand). Mirrors the shape of
 * `navigator.requestMIDIAccess({ sysex: false })`.
 */
export function createFakeRequestMidiAccess(
  access: FakeMidiAccess,
  opts: { rejectWith?: Error } = {},
): () => Promise<FakeMidiAccess> {
  return async () => {
    if (opts.rejectWith) throw opts.rejectWith;
    return access;
  };
}
