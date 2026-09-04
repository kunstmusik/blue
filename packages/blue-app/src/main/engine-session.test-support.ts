import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import type { ChildProcess } from 'child_process';
import type {
  EngineCapabilities,
  EngineStateListener,
  EngineStateSnapshot,
} from '@blue/engine-client';
import { AUTOMATION_DECIMAL_FEATURE, BLUE_ENGINE_PROTOCOL_VERSION } from '@blue/engine-client';
import type { EngineProcessManifest } from './engine-process-registry';

export class FakeChildProcess extends EventEmitter {
  pid: number;
  exitCode: number | null = null;
  signalCode: NodeJS.Signals | null = null;
  killed = false;
  stdout: PassThrough = new PassThrough();
  stderr: PassThrough = new PassThrough();
  stdin: PassThrough = new PassThrough();

  killSignalsReceived: Array<NodeJS.Signals | number | undefined> = [];
  onKillBehavior: ((signal?: NodeJS.Signals | number) => void) | null = null;

  constructor(pid = 12345) {
    super();
    this.pid = pid;
  }

  kill(signal: NodeJS.Signals | number = 'SIGTERM'): boolean {
    this.killSignalsReceived.push(signal);
    this.killed = true;
    if (this.onKillBehavior) {
      this.onKillBehavior(signal);
    } else {
      // Default: immediately exit on signal
      this.emitExit(null, typeof signal === 'string' ? signal : 'SIGTERM');
    }
    return true;
  }

  emitStdout(text: string): void {
    this.stdout.write(Buffer.from(text, 'utf-8'));
  }

  emitStderr(text: string): void {
    this.stderr.write(Buffer.from(text, 'utf-8'));
  }

  emitExit(code: number | null = 0, signal: NodeJS.Signals | null = null): void {
    this.exitCode = code;
    this.signalCode = signal;
    this.emit('exit', code, signal);
    this.emit('close', code, signal);
  }

  emitError(err: Error): void {
    this.emit('error', err);
  }
}

export class FakeEngineClient {
  endpoint: string;
  pubEndpoint: string;
  connected = false;
  destroyed = false;
  createEngineCallCount = 0;
  startCallCount = 0;
  stopCallCount = 0;
  optionsSet: string[] = [];
  compiledOrcs: string[] = [];
  scoresRead: string[] = [];
  channels = new Map<string, number>();

  capabilities: EngineCapabilities = {
    schemaVersion: 1,
    protocolVersion: BLUE_ENGINE_PROTOCOL_VERSION,
    engineVersion: '0.1.0',
    sourceRevision: 'test',
    features: [AUTOMATION_DECIMAL_FEATURE, 'owner-liveness-v1'],
  };

  createEngineResponse: { ok: boolean; message: string } = { ok: true, message: '' };
  startResponse: { ok: boolean; message: string } = { ok: true, message: '' };
  stopResponse: { ok: boolean; message: string } = { ok: true, message: '' };
  compileOrcResponse: { ok: boolean; message: string } = { ok: true, message: '' };
  readScoreResponse: { ok: boolean; message: string } = { ok: true, message: '' };
  currentState: EngineStateSnapshot = {
    state: 'ready',
    running: false,
    engineCreated: true,
    sampleFrames: 0,
    sampleRate: 44100,
    ksmps: 64,
    sequence: 1,
    stopReason: 'none',
    lastError: '',
  };

  private stateListeners = new Set<EngineStateListener>();

  constructor(options: { endpoint?: string; pubEndpoint?: string } = {}) {
    this.endpoint = options.endpoint ?? 'tcp://localhost:5555';
    this.pubEndpoint = options.pubEndpoint ?? 'tcp://localhost:5556';
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(destroyEngine = true): Promise<void> {
    this.connected = false;
    if (destroyEngine) {
      this.destroyed = true;
    }
  }

  async getCapabilities(): Promise<{
    ok: boolean;
    capabilities?: EngineCapabilities;
    message: string;
  }> {
    return { ok: true, capabilities: this.capabilities, message: '' };
  }

  async createEngine(): Promise<{ ok: boolean; message: string }> {
    this.createEngineCallCount += 1;
    return this.createEngineResponse;
  }

  async destroyEngine(): Promise<{ ok: boolean; message: string }> {
    this.destroyed = true;
    return { ok: true, message: '' };
  }

  async setOption(option: string): Promise<{ ok: boolean; message: string }> {
    this.optionsSet.push(option);
    return { ok: true, message: '' };
  }

  async compileOrc(orchestra: string): Promise<{ ok: boolean; message: string }> {
    this.compiledOrcs.push(orchestra);
    return this.compileOrcResponse;
  }

  async readScore(score: string): Promise<{ ok: boolean; message: string }> {
    this.scoresRead.push(score);
    return this.readScoreResponse;
  }

  async start(): Promise<{ ok: boolean; message: string }> {
    this.startCallCount += 1;
    if (this.startResponse.ok) {
      this.currentState = {
        ...this.currentState,
        state: 'running',
        running: true,
        sequence: this.currentState.sequence + 1,
      };
      this.emitState(this.currentState);
    }
    return this.startResponse;
  }

  async stop(): Promise<{ ok: boolean; message: string }> {
    this.stopCallCount += 1;
    if (this.stopResponse.ok) {
      this.currentState = {
        ...this.currentState,
        state: 'stopped',
        running: false,
        stopReason: 'stop-requested',
        sequence: this.currentState.sequence + 1,
      };
      this.emitState(this.currentState);
    }
    return this.stopResponse;
  }

  async getEngineState(): Promise<{ ok: boolean; state?: EngineStateSnapshot; message: string }> {
    return { ok: true, state: this.currentState, message: '' };
  }

  onEngineState(listener: EngineStateListener): () => void {
    this.stateListeners.add(listener);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  emitState(snapshot: EngineStateSnapshot): void {
    this.currentState = snapshot;
    for (const listener of this.stateListeners) {
      listener(snapshot);
    }
  }

  async createChannel(
    name: string,
    initialValue: number,
  ): Promise<{ ok: boolean; message: string }> {
    this.channels.set(name, initialValue);
    return { ok: true, message: '' };
  }

  async setChannel(name: string, value: number): Promise<{ ok: boolean; message: string }> {
    this.channels.set(name, value);
    return { ok: true, message: '' };
  }

  async getChannel(name: string): Promise<{ ok: boolean; value: number }> {
    return { ok: true, value: this.channels.get(name) ?? 0 };
  }

  async clearAutomations(): Promise<{ ok: boolean; message: string }> {
    return { ok: true, message: '' };
  }

  async createAutomation(): Promise<{ ok: boolean; message: string }> {
    return { ok: true, message: '' };
  }

  async updateAutomation(): Promise<{ ok: boolean; message: string }> {
    return { ok: true, message: '' };
  }

  async deleteAutomation(): Promise<{ ok: boolean; message: string }> {
    return { ok: true, message: '' };
  }
}

export class ControllableClock {
  private currentTime = 1000000;
  private nextTimerId = 1;
  private activeTimers = new Map<
    number,
    { dueTime: number; callback: () => void; intervalMs?: number }
  >();

  now(): number {
    return this.currentTime;
  }

  setTimeout(callback: () => void, delayMs: number): number {
    const id = this.nextTimerId++;
    this.activeTimers.set(id, {
      dueTime: this.currentTime + Math.max(0, delayMs),
      callback,
    });
    return id;
  }

  clearTimeout(id: number | ReturnType<typeof setTimeout> | null | undefined): void {
    if (typeof id === 'number') {
      this.activeTimers.delete(id);
    }
  }

  setInterval(callback: () => void, intervalMs: number): number {
    const id = this.nextTimerId++;
    this.activeTimers.set(id, {
      dueTime: this.currentTime + Math.max(0, intervalMs),
      callback,
      intervalMs,
    });
    return id;
  }

  clearInterval(id: number | ReturnType<typeof setInterval> | null | undefined): void {
    if (typeof id === 'number') {
      this.activeTimers.delete(id);
    }
  }

  async advanceBy(ms: number): Promise<void> {
    const targetTime = this.currentTime + ms;
    while (true) {
      let nextDueId: number | null = null;
      let lowestDueTime = Infinity;

      for (const [id, timer] of this.activeTimers.entries()) {
        if (timer.dueTime <= targetTime && timer.dueTime < lowestDueTime) {
          lowestDueTime = timer.dueTime;
          nextDueId = id;
        }
      }

      if (nextDueId === null) {
        break;
      }

      const timer = this.activeTimers.get(nextDueId)!;
      this.currentTime = timer.dueTime;
      if (timer.intervalMs !== undefined) {
        timer.dueTime = this.currentTime + timer.intervalMs;
      } else {
        this.activeTimers.delete(nextDueId);
      }

      timer.callback();
      for (let i = 0; i < 20; i++) {
        await Promise.resolve();
      }
    }

    this.currentTime = targetTime;
  }
}

export class FakeProcessRegistry {
  private records = new Map<string, EngineProcessManifest>();
  private nextRecordId = 1;

  async registerEngineProcess(manifest: EngineProcessManifest): Promise<string> {
    const key = `/tmp/fake-registry/manifest-${manifest.pid}-${this.nextRecordId++}.json`;
    this.records.set(key, { ...manifest });
    return key;
  }

  async removeEngineProcessRecord(filePath: string | null | undefined): Promise<void> {
    if (filePath) {
      this.records.delete(filePath);
    }
  }

  getRecord(filePath: string): EngineProcessManifest | undefined {
    return this.records.get(filePath);
  }

  getAllRecords(): Map<string, EngineProcessManifest> {
    return new Map(this.records);
  }

  clear(): void {
    this.records.clear();
  }
}
