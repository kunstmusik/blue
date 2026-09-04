import { ChildProcess, spawn as defaultSpawn, type SpawnOptions } from 'child_process';
import { createHash, randomUUID } from 'crypto';
import * as os from 'os';
import * as path from 'path';
import {
  EngineClient,
  type EngineClientOptions,
  type EngineStateSnapshot,
  type EngineStateListener,
} from '@blue/engine-client';
import type {
  EngineProcessManifest,
  EngineProcessManifestV2,
  EngineSessionKind,
} from './engine-process-registry';
import {
  registerEngineProcess as defaultRegisterEngineProcess,
  removeEngineProcessRecord as defaultRemoveEngineProcessRecord,
} from './engine-process-registry';
import type {
  EngineRecoveryFailureCategory,
  EngineRecoverySessionKind,
} from '../shared/engine-recovery';

export type EngineSessionState =
  | 'allocated'
  | 'spawning'
  | 'connecting'
  | 'ready'
  | 'running'
  | 'stopping'
  | 'exited'
  | 'failed'
  | 'cleanup-failed';

export type EngineTransport = 'tcp' | 'ipc';

export interface EngineSessionEndpoints {
  readonly controlEndpoint: string;
  readonly pubEndpoint: string;
}

export interface EngineSessionCreationRequest {
  kind: EngineSessionKind;
  enginePath: string;
  generation?: number;
  ownerPid?: number;
  workingDirectory?: string | null;
  transport?: EngineTransport;
  port?: number;
  pubPort?: number;
  extraArgs?: string[];
  ownerLivenessCapability?: boolean;
}

export interface EngineSessionLifecycleResult {
  status: 'ready' | 'exited' | 'failed' | 'cleanup-failed';
  exitCode?: number | null;
  signalCode?: string | null;
  failureCategory?: EngineRecoveryFailureCategory;
  errorMessage?: string;
}

export interface EngineDiagnosticReport {
  sessionId: string;
  sessionKind: EngineRecoverySessionKind;
  ownerPid: number;
  transport: EngineTransport;
  sessionState: EngineSessionState;
  clientConnected: boolean;
  createdAt: number;
  exitedAt?: number;
  exitCode?: number | null;
  signalCode?: string | null;
  failureCategory?: EngineRecoveryFailureCategory;
  actionsPerformed: string[];
  rawStderrSummary?: string;
  outcomeMessage: string;
}

export interface EngineSessionClock {
  now(): number;
  setTimeout(callback: () => void, ms: number): ReturnType<typeof setTimeout> | number;
  clearTimeout(id: ReturnType<typeof setTimeout> | number): void;
  setInterval(callback: () => void, ms: number): ReturnType<typeof setInterval> | number;
  clearInterval(id: ReturnType<typeof setInterval> | number): void;
}

export interface EngineSessionDependencies {
  spawn?: (command: string, args: string[], options: SpawnOptions) => ChildProcess;
  createClient?: (options: EngineClientOptions) => EngineClient;
  registerManifest?: (manifest: EngineProcessManifest) => Promise<string>;
  removeManifest?: (path: string | null | undefined) => Promise<void>;
  clock?: EngineSessionClock;
  ownerPid?: number;
  gracefulShutdownTimeoutMs?: number;
  forceShutdownTimeoutMs?: number;
}

const defaultClock: EngineSessionClock = {
  now: () => Date.now(),
  setTimeout: (cb, ms) => setTimeout(cb, ms),
  clearTimeout: (id) => clearTimeout(id),
  setInterval: (cb, ms) => setInterval(cb, ms),
  clearInterval: (id) => clearInterval(id),
};

export function createEngineSharedMemoryName(
  kind: EngineSessionKind,
  ownerPid = process.pid,
  token: string = randomUUID(),
): string {
  const kindCode = kind === 'realtime' ? 'r' : 'l';
  const compactPid = ownerPid.toString(36);
  const compactToken = createHash('sha256').update(token).digest('hex').slice(0, 16);
  return `be-${kindCode}-${compactPid}-${compactToken}`;
}

export function buildSessionEndpoints(
  transport: EngineTransport,
  port: number,
  pubPort: number,
  shmName: string,
): EngineSessionEndpoints {
  if (transport === 'ipc') {
    const basePath = path.join(os.tmpdir(), shmName);
    return {
      controlEndpoint: `ipc://${basePath}-control.ipc`,
      pubEndpoint: `ipc://${basePath}-pub.ipc`,
    };
  }

  return {
    controlEndpoint: `tcp://127.0.0.1:${port}`,
    pubEndpoint: `tcp://127.0.0.1:${pubPort}`,
  };
}

export function isSessionActive(
  candidate: EngineSession | null | undefined,
  activeSession: EngineSession | null | undefined,
): boolean {
  if (!candidate || !activeSession) {
    return false;
  }
  return (
    candidate.sessionId === activeSession.sessionId &&
    candidate.getState() !== 'exited' &&
    candidate.getState() !== 'cleanup-failed'
  );
}

export function validateSessionAuthority(
  session: EngineSession,
  activeSession: EngineSession | null | undefined,
): boolean {
  if (!activeSession) {
    return false;
  }
  return session.sessionId === activeSession.sessionId;
}

export function classifyProcessError(
  error: Error | string | null | undefined,
  stderr = '',
  exitCode: number | null = null,
  signalCode: string | null = null,
): EngineRecoveryFailureCategory {
  const message =
    `${error instanceof Error ? error.message : (error ?? '')} ${stderr}`.toLowerCase();

  if (
    message.includes('address already in use') ||
    message.includes('eaddrinuse') ||
    message.includes('zmq_bind') ||
    message.includes('bind error') ||
    message.includes('endpoint contention')
  ) {
    return 'address-contention';
  }

  if (
    message.includes('timed out') ||
    message.includes('timeout') ||
    message.includes('readiness')
  ) {
    return 'readiness-timeout';
  }

  if (
    message.includes('csound is not available') ||
    message.includes('csound 7 was not found') ||
    message.includes('csound_unavailable') ||
    message.includes('csoundloader') ||
    message.includes('shared library not found') ||
    message.includes('dlopen') ||
    message.includes('loadlibrary')
  ) {
    return 'runtime-unavailable';
  }

  if (
    message.includes('enoent') ||
    message.includes('not found') ||
    message.includes('cannot find') ||
    (exitCode !== null && exitCode === 127)
  ) {
    return 'engine-unavailable';
  }

  if (
    message.includes('unresponsive') ||
    message.includes('socket closed') ||
    message.includes('connection reset')
  ) {
    return 'session-unresponsive';
  }

  if (
    message.includes('cleanup failed') ||
    message.includes('failed to kill') ||
    message.includes('unconfirmed exit')
  ) {
    return 'cleanup-failed';
  }

  return 'unexpected';
}

export function sanitizeDiagnosticText(text: string): string {
  if (!text) return '';
  let sanitized = text
    .replace(/(?:\/Users\/[^\s\/\\]+|\/home\/[^\s\/\\]+|C:\\Users\\[^\s\/\\]+)/gi, '<user-dir>')
    .replace(/<CsoundSynthesizer>[\s\S]*?<\/CsoundSynthesizer>/gi, '<csd-content-redacted>')
    .replace(/<CsInstruments>[\s\S]*?<\/CsInstruments>/gi, '<orchestra-redacted>')
    .replace(/<CsScore>[\s\S]*?<\/CsScore>/gi, '<score-redacted>');

  if (sanitized.length > 2000) {
    sanitized = sanitized.slice(0, 1997) + '...';
  }
  return sanitized;
}

export function formatLifecycleDiagnosticReport(report: EngineDiagnosticReport): string {
  const lines: string[] = [
    `=== Blue Engine Diagnostic Report ===`,
    `Session ID: ${report.sessionId}`,
    `Kind: ${report.sessionKind}`,
    `Owner PID: ${report.ownerPid}`,
    `Transport: ${report.transport}`,
    `Session State: ${report.sessionState}`,
    `Client Connection: ${report.clientConnected ? 'connected' : 'disconnected'}`,
    `Created At: ${new Date(report.createdAt).toISOString()}`,
  ];

  if (report.exitedAt) {
    lines.push(
      `Exited At: ${new Date(report.exitedAt).toISOString()} (Duration: ${report.exitedAt - report.createdAt}ms)`,
    );
  }

  if (report.exitCode !== undefined && report.exitCode !== null) {
    lines.push(`Exit Code: ${report.exitCode}`);
  }
  if (report.signalCode) {
    lines.push(`Signal: ${report.signalCode}`);
  }
  if (report.failureCategory) {
    lines.push(`Failure Category: ${report.failureCategory}`);
  }

  lines.push(`Outcome: ${sanitizeDiagnosticText(report.outcomeMessage)}`);

  if (report.actionsPerformed && report.actionsPerformed.length > 0) {
    lines.push(`Actions:`);
    for (const action of report.actionsPerformed) {
      lines.push(`  - ${action}`);
    }
  }

  if (report.rawStderrSummary) {
    lines.push(`Stderr Summary:`);
    lines.push(sanitizeDiagnosticText(report.rawStderrSummary));
  }

  lines.push(`=====================================`);
  return lines.join('\n');
}

const MAX_STDOUT_BUFFER_CHARS = 16384;
const MAX_STDERR_BUFFER_CHARS = 8192;

function appendBoundedBuffer(buffer: string, text: string, maxChars: number): string {
  const combined = buffer + text;
  return combined.length > maxChars ? combined.slice(combined.length - maxChars) : combined;
}

export class EngineSession {
  readonly sessionId: string;
  readonly generation: number;
  readonly kind: EngineSessionKind;
  readonly transport: EngineTransport;
  readonly shmName: string;
  readonly endpoints: EngineSessionEndpoints;
  readonly enginePath: string;
  readonly spawnArgs: readonly string[];
  readonly ownerPid: number;
  readonly createdAt: number;

  private state: EngineSessionState = 'allocated';
  private childProcess: ChildProcess | null = null;
  private client: EngineClient | null = null;
  private hasSpawned = false;
  private manifestPath: string | null = null;
  private manifestRegistered = false;
  private manifestRegistrationPromise: Promise<string | null> | null = null;
  private stdoutBuffer = '';
  private stderrBuffer = '';
  private exitCode: number | null = null;
  private signalCode: string | null = null;
  private exitPromise: Promise<EngineSessionLifecycleResult>;
  private resolveExit!: (result: EngineSessionLifecycleResult) => void;
  private shutdownPromise: Promise<EngineSessionLifecycleResult> | null = null;
  private actionsPerformed: string[] = [];
  private failureCategory?: EngineRecoveryFailureCategory;
  private outcomeMessage = '';
  private stateListeners = new Set<EngineStateListener>();
  private outputCallbacks = new Set<(text: string, type: 'stdout' | 'stderr') => void>();

  private readonly spawnFn: (
    command: string,
    args: string[],
    options: SpawnOptions,
  ) => ChildProcess;
  private readonly createClientFn: (options: EngineClientOptions) => EngineClient;
  private readonly registerManifestFn: (manifest: EngineProcessManifest) => Promise<string>;
  private readonly removeManifestFn: (path: string | null | undefined) => Promise<void>;
  private readonly clock: EngineSessionClock;
  private readonly gracefulShutdownTimeoutMs: number;
  private readonly forceShutdownTimeoutMs: number;

  constructor(request: EngineSessionCreationRequest, dependencies: EngineSessionDependencies = {}) {
    this.sessionId = randomUUID();
    this.generation = request.generation ?? 1;
    this.kind = request.kind;
    this.transport = request.transport ?? (process.platform === 'win32' ? 'tcp' : 'ipc');
    this.ownerPid = request.ownerPid ?? dependencies.ownerPid ?? process.pid;
    this.shmName = createEngineSharedMemoryName(this.kind, this.ownerPid, this.sessionId);
    this.enginePath = request.enginePath;
    this.clock = dependencies.clock ?? defaultClock;
    this.createdAt = this.clock.now();

    const port = request.port ?? 5555;
    const pubPort = request.pubPort ?? port + 1;
    this.endpoints = buildSessionEndpoints(this.transport, port, pubPort, this.shmName);

    const spawnArgs =
      this.transport === 'ipc'
        ? [
            '--control-endpoint',
            this.endpoints.controlEndpoint,
            '--pub-endpoint',
            this.endpoints.pubEndpoint,
            '--shm',
            this.shmName,
          ]
        : ['--port', `${port}`, '--pub-port', `${pubPort}`, '--shm', this.shmName];

    if (request.ownerLivenessCapability) {
      spawnArgs.push('--owner-pid', `${this.ownerPid}`);
    }

    if (request.extraArgs && request.extraArgs.length > 0) {
      spawnArgs.push(...request.extraArgs);
    }

    this.spawnArgs = spawnArgs;
    this.spawnFn = dependencies.spawn ?? defaultSpawn;
    this.createClientFn = dependencies.createClient ?? ((opts) => new EngineClient(opts));
    this.registerManifestFn = dependencies.registerManifest ?? defaultRegisterEngineProcess;
    this.removeManifestFn = dependencies.removeManifest ?? defaultRemoveEngineProcessRecord;
    this.gracefulShutdownTimeoutMs = dependencies.gracefulShutdownTimeoutMs ?? 2000;
    this.forceShutdownTimeoutMs = dependencies.forceShutdownTimeoutMs ?? 1500;

    this.exitPromise = new Promise<EngineSessionLifecycleResult>((resolve) => {
      this.resolveExit = resolve;
    });
  }

  getState(): EngineSessionState {
    return this.state;
  }

  getChildProcess(): ChildProcess | null {
    return this.childProcess;
  }

  getClient(): EngineClient | null {
    return this.client;
  }

  getStderr(): string {
    return this.stderrBuffer;
  }

  getStdout(): string {
    return this.stdoutBuffer;
  }

  getEnginePid(): number | null {
    return typeof this.childProcess?.pid === 'number' ? this.childProcess.pid : null;
  }

  isActive(): boolean {
    return (
      this.state === 'spawning' ||
      this.state === 'connecting' ||
      this.state === 'ready' ||
      this.state === 'running' ||
      this.state === 'stopping'
    );
  }

  isCommandAccepting(): boolean {
    return this.state === 'ready' || this.state === 'running';
  }

  onOutput(callback: (text: string, type: 'stdout' | 'stderr') => void): () => void {
    this.outputCallbacks.add(callback);
    return () => {
      this.outputCallbacks.delete(callback);
    };
  }

  onEngineState(listener: EngineStateListener): () => void {
    this.stateListeners.add(listener);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  awaitExit(): Promise<EngineSessionLifecycleResult> {
    return this.exitPromise;
  }

  getDiagnostics(outcomeOverride?: string): EngineDiagnosticReport {
    return {
      sessionId: this.sessionId,
      sessionKind: this.kind,
      ownerPid: this.ownerPid,
      transport: this.transport,
      sessionState: this.state,
      clientConnected: this.client !== null,
      createdAt: this.createdAt,
      exitedAt:
        this.state === 'exited' || this.state === 'failed' || this.state === 'cleanup-failed'
          ? this.clock.now()
          : undefined,
      exitCode: this.exitCode,
      signalCode: this.signalCode,
      failureCategory: this.failureCategory,
      actionsPerformed: [...this.actionsPerformed],
      rawStderrSummary: this.stderrBuffer.slice(-1000),
      outcomeMessage:
        outcomeOverride ??
        (this.outcomeMessage ||
          (this.state === 'ready' || this.state === 'running' ? 'Active' : 'Stopped')),
    };
  }

  async spawn(workingDirectory?: string | null): Promise<void> {
    if (this.state !== 'allocated') {
      throw new Error(`Cannot spawn session in state: ${this.state}`);
    }

    this.state = 'spawning';
    this.actionsPerformed.push('spawn');

    const spawnCwd =
      workingDirectory && workingDirectory.trim().length > 0 ? workingDirectory : undefined;

    let child: ChildProcess;
    try {
      child = this.spawnFn(this.enginePath, [...this.spawnArgs], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: spawnCwd,
      });
    } catch (error: unknown) {
      const processError = error instanceof Error ? error : new Error(String(error));
      this.handleProcessError(processError);
      throw processError;
    }

    this.hasSpawned = true;

    this.childProcess = child;

    child.stdout?.on('data', (data: Buffer | string) => {
      const text = data.toString();
      this.stdoutBuffer = appendBoundedBuffer(this.stdoutBuffer, text, MAX_STDOUT_BUFFER_CHARS);
      for (const cb of this.outputCallbacks) {
        cb(text, 'stdout');
      }
    });

    child.stderr?.on('data', (data: Buffer | string) => {
      const text = data.toString();
      this.stderrBuffer = appendBoundedBuffer(this.stderrBuffer, text, MAX_STDERR_BUFFER_CHARS);
      for (const cb of this.outputCallbacks) {
        cb(text, 'stderr');
      }
    });

    child.on('exit', (code: number | null, signal: string | null) => {
      this.handleProcessExit(code, signal);
    });

    child.on('error', (err: Error) => {
      this.handleProcessError(err);
    });

    if (typeof child.pid === 'number') {
      const manifest: EngineProcessManifestV2 = {
        version: 2,
        sessionId: this.sessionId,
        kind: this.kind,
        pid: child.pid,
        ownerPid: this.ownerPid,
        enginePath: this.enginePath,
        spawnArgs: [...this.spawnArgs],
        controlEndpoint: this.endpoints.controlEndpoint,
        pubEndpoint: this.endpoints.pubEndpoint,
        shmName: this.shmName,
        startedAt: this.createdAt,
      };

      this.manifestRegistrationPromise = this.registerManifestFn(manifest)
        .then((recordPath) => {
          this.manifestPath = recordPath;
          this.manifestRegistered = true;
          this.actionsPerformed.push('registered-manifest');
          return recordPath;
        })
        .catch((error) => {
          console.warn(
            `[EngineSession] Manifest registration failed: ${error instanceof Error ? error.message : String(error)}`,
          );
          return null;
        });
    }
  }

  async awaitReady(): Promise<EngineSessionLifecycleResult> {
    if (this.state === 'exited' || this.state === 'failed' || this.state === 'cleanup-failed') {
      // The process died between spawn and this readiness wait (for example
      // a legacy engine rejecting an unknown argument). Fail fast with the
      // captured evidence instead of throwing a state-machine guard error.
      this.failureCategory =
        this.failureCategory ??
        classifyProcessError(null, this.stderrBuffer, this.exitCode, this.signalCode);
      this.outcomeMessage =
        this.outcomeMessage ||
        `Engine exited before becoming ready (code: ${this.exitCode}, signal: ${this.signalCode})`;
      this.actionsPerformed.push('readiness-failure:already-exited');
      return {
        status: 'failed',
        failureCategory: this.failureCategory,
        errorMessage: this.outcomeMessage,
      };
    }

    if (this.state !== 'spawning') {
      throw new Error(`Cannot await readiness from state: ${this.state}`);
    }

    this.state = 'connecting';
    this.actionsPerformed.push('connecting');

    try {
      const readiness = (async () => {
        const client = this.createClientFn({
          endpoint: this.endpoints.controlEndpoint,
          pubEndpoint: this.endpoints.pubEndpoint,
          timeout: 8000,
        });
        this.client = client;

        await client.connect();
        client.onEngineState((snapshot) => {
          for (const listener of this.stateListeners) {
            listener(snapshot);
          }
        });

        const createResp = await client.createEngine();
        if (!createResp.ok) {
          throw new Error(createResp.message || 'Failed to create engine');
        }

        await client.setOption('-d');
      })();

      // A process that exits during startup (for example a legacy engine
      // rejecting an unknown argument) must fail readiness immediately
      // instead of waiting out the full connection timeout.
      const earlyExit = this.exitPromise.then((result) => {
        throw new Error(
          `Engine exited before becoming ready (code: ${result.exitCode}, signal: ${result.signalCode})`,
        );
      });

      await Promise.race([readiness, earlyExit]);

      this.state = 'ready';
      this.actionsPerformed.push('ready');
      return { status: 'ready' };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.failureCategory = classifyProcessError(
        err instanceof Error ? err : String(err),
        this.stderrBuffer,
      );
      this.outcomeMessage = `Readiness failed: ${errorMessage}`;
      this.actionsPerformed.push(`readiness-failure:${this.failureCategory}`);

      await this.shutdown('readiness-failure');
      return {
        status: 'failed',
        failureCategory: this.failureCategory,
        errorMessage,
      };
    }
  }

  async shutdown(reason = 'shutdown'): Promise<EngineSessionLifecycleResult> {
    if (this.shutdownPromise) {
      return this.shutdownPromise;
    }

    this.shutdownPromise = this.performShutdown(reason);
    return this.shutdownPromise;
  }

  private async performShutdown(reason: string): Promise<EngineSessionLifecycleResult> {
    this.actionsPerformed.push(`shutdown:${reason}`);

    // Nothing was ever spawned: there is no process, client, or record to
    // clean up, so shutdown succeeds trivially instead of reporting a
    // spurious cleanup failure.
    if (!this.hasSpawned) {
      this.state = 'exited';
      return { status: 'exited' };
    }

    this.state = 'stopping';

    let clientDisconnectPromise: Promise<void> | null = null;
    if (this.client) {
      const clientToDisconnect = this.client;
      this.client = null;
      try {
        // The child is about to be terminated, so the protocol-level destroy
        // command is unnecessary. Closing and awaiting the sockets here is
        // essential: letting ZeroMQ teardown continue after app.quit() can
        // invoke the native addon after Electron has started unloading it.
        clientDisconnectPromise = clientToDisconnect.disconnect(false).catch(() => {});
      } catch {
        // Socket cleanup is best effort; continue to terminate the child.
      }
    }

    const child = this.childProcess;
    let exited = this.exitCode !== null || this.signalCode !== null;

    if (child && !child.killed && !exited) {
      try {
        child.kill('SIGTERM');
        this.actionsPerformed.push('sent-sigterm');
      } catch {
        // Already dead
      }

      // Wait bounded time for graceful exit
      exited = await this.waitForExitTimeout(this.gracefulShutdownTimeoutMs);
      if (!exited && this.exitCode === null && this.signalCode === null) {
        try {
          child.kill('SIGKILL');
          this.actionsPerformed.push('sent-sigkill-escalation');
        } catch {
          // Already dead
        }
        exited = await this.waitForExitTimeout(this.forceShutdownTimeoutMs);
      }
    } else if (child && !exited) {
      exited = await this.waitForExitTimeout(this.gracefulShutdownTimeoutMs);
    }

    if (clientDisconnectPromise) {
      await clientDisconnectPromise;
    }

    // Await manifest registration settling before attempting record cleanup
    if (this.manifestRegistrationPromise) {
      await this.manifestRegistrationPromise;
    }

    if (exited) {
      if (this.manifestPath) {
        await this.removeManifestFn(this.manifestPath);
        this.actionsPerformed.push('removed-manifest');
        this.manifestPath = null;
      }
      this.state = 'exited';
      return {
        status: 'exited',
        exitCode: this.exitCode,
        signalCode: this.signalCode,
      };
    }

    // Process exit could not be confirmed: retain manifest for recovery evidence
    this.state = 'cleanup-failed';
    this.failureCategory = 'cleanup-failed';
    this.actionsPerformed.push('unconfirmed-exit');
    return {
      status: 'cleanup-failed',
      failureCategory: 'cleanup-failed',
      errorMessage: 'Process exit could not be confirmed',
    };
  }

  private waitForExitTimeout(timeoutMs: number): Promise<boolean> {
    if (this.exitCode !== null || this.signalCode !== null) {
      return Promise.resolve(true);
    }

    return new Promise<boolean>((resolve) => {
      let settled = false;
      const timer = this.clock.setTimeout(() => {
        if (!settled) {
          settled = true;
          resolve(this.exitCode !== null || this.signalCode !== null);
        }
      }, timeoutMs);

      this.exitPromise.finally(() => {
        if (!settled) {
          settled = true;
          this.clock.clearTimeout(timer);
          resolve(true);
        }
      });
    });
  }

  private handleProcessExit(code: number | null, signal: string | null): void {
    this.exitCode = code;
    this.signalCode = signal;
    this.actionsPerformed.push(`process-exit:${code}:${signal}`);

    if (this.state !== 'stopping' && this.state !== 'exited') {
      this.state = 'exited';
    }

    this.resolveExit({
      status: 'exited',
      exitCode: code,
      signalCode: signal,
    });
  }

  private handleProcessError(err: Error): void {
    this.actionsPerformed.push(`process-error:${err.message}`);
    this.failureCategory = classifyProcessError(err, this.stderrBuffer);
    this.outcomeMessage = `Process error: ${err.message}`;
    this.state = 'failed';

    this.resolveExit({
      status: 'failed',
      failureCategory: this.failureCategory,
      errorMessage: err.message,
    });
  }
}
