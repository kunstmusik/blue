/**
 * EngineBridge — manages the blue-engine subprocess and ZMQ connection.
 * Bridges the Electron main process to the C++ blue-engine.
 *
 * Lifecycle: For each playback, a fresh engine session is spawned.
 * After stop (or natural completion), the engine session is shut down.
 * A playback lock prevents concurrent operations.
 */
import { EngineClient, AutomationCurveCode, type EngineStateSnapshot } from '@blue/engine-client';
import { BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import type { Parameter, TempoMap } from '@blue/data';
import { AutomationCurve, getEngineAutomationPoints } from '@blue/data';
import type { PlaybackClockSnapshot } from '../shared/project-editor';
import { formatRenderCommandLine, writeTempCsdSnapshot } from './render-command';
import type { EngineSessionKind } from './engine-process-registry';
import { broadcastToWorkbenchWindows } from './workbench-window-host';
import type { EngineRuntimeService } from './engine-runtime';
import type { EngineProbeErrorCode } from '../shared/engine-runtime';
import type { EngineRecoveryFailureCategory } from '../shared/engine-recovery';
import {
  hasEngineFeature,
  OWNER_LIVENESS_FEATURE,
} from '@blue/engine-client/capabilities';
import { allocateTcpEndpointPair, type EndpointAllocationOptions, type TcpEndpointPair } from './engine-endpoints';
import {
  EngineSession,
  classifyProcessError,
  formatLifecycleDiagnosticReport,
  isSessionActive,
  validateSessionAuthority,
  type EngineSessionCreationRequest,
} from './engine-session';

// Keep the existing test/helper import surface while keeping endpoint and
// shared-memory construction in the session boundary.
export {
  buildSessionEndpoints as buildEngineEndpoints,
  createEngineSharedMemoryName,
} from './engine-session';

export interface AutomationTimingContext {
  renderStartTime: number;
  sampleRate?: number;
  ksmps?: number;
  tempoMap?: TempoMap | null;
}

interface AutomationSyncOptions {
  coalesce?: boolean;
}

interface PendingAutomationSync {
  parameter: Parameter;
  automationTiming?: AutomationTimingContext;
  timer: ReturnType<typeof setTimeout>;
}

interface PendingTerminalStateCandidate {
  snapshot: EngineStateSnapshot;
  firstSeenAt: number;
}

type EngineTransport = 'tcp' | 'ipc';

function resolveEngineTransport(): EngineTransport {
  const requestedTransport = process.env.BLUE_ENGINE_TRANSPORT?.toLowerCase();

  if (requestedTransport === 'ipc' || requestedTransport === 'tcp') {
    if (requestedTransport === 'ipc' && process.platform === 'win32') {
      console.warn('[EngineBridge] BLUE_ENGINE_TRANSPORT=ipc is not supported on Windows; falling back to tcp.');
      return 'tcp';
    }

    return requestedTransport;
  }

  if (requestedTransport && requestedTransport !== 'tcp') {
    console.warn(`[EngineBridge] Unknown BLUE_ENGINE_TRANSPORT=${requestedTransport}; falling back to tcp.`);
  }

  return process.platform === 'win32' ? 'tcp' : 'ipc';
}

function isUnsupportedIpcEndpointError(stderr: string): boolean {
  return stderr.includes('Unknown option: --control-endpoint') || stderr.includes('Unknown option: --pub-endpoint');
}

function isUnknownOwnerPidOptionError(stderr: string): boolean {
  return stderr.includes('Unknown option: --owner-pid');
}

function classifyEngineProbeFailure(
  errorCode: EngineProbeErrorCode | null,
): EngineRecoveryFailureCategory {
  switch (errorCode) {
    case 'CSOUND_UNAVAILABLE':
      return 'runtime-unavailable';
    case 'ENGINE_PROBE_TIMEOUT':
      return 'readiness-timeout';
    case 'ENGINE_NOT_FOUND':
    case 'ENGINE_NOT_EXECUTABLE':
    case 'ENGINE_ARCH_MISMATCH':
    case 'ENGINE_PROBE_FAILED':
    case 'ENGINE_PROBE_INVALID_JSON':
    case 'ENGINE_PROTOCOL_MISMATCH':
      return 'engine-unavailable';
    default:
      return 'unexpected';
  }
}

function isExpectedCsoundSourceError(message: string): boolean {
  const normalized = message.toLowerCase();
  return [
    'orchestra compile failed',
    'failed to compile orchestra',
    'score read failed',
    'invalid orchestra',
    'syntax error',
    'parser failure',
  ].some((marker) => normalized.includes(marker));
}

export type EngineOutputCallback = (text: string, type: 'stdout' | 'stderr') => void;
export type PlaybackCompleteCallback = (stopReason: string) => void;
export type PlaybackErrorWarningCallback = (message: string) => void;

export interface EngineOperationResult {
  ok: boolean;
  /** Distinguishes invalid project source from an engine/runtime failure. */
  failureKind?: 'engine' | 'project';
  failureCategory?: EngineRecoveryFailureCategory;
  errorMessage?: string;
}

interface EngineTransportStartResult extends EngineOperationResult {
  fallbackToTcp: boolean;
  retryWithoutOwnerPid: boolean;
}

export interface EngineBridgeDependencies {
  /** Creates the captured session for each engine launch. Injectable for tests. */
  createSession?: (request: EngineSessionCreationRequest) => EngineSession;
  /** Selects isolated TCP endpoint pairs. Injectable for tests. */
  allocateEndpoints?: (options: EndpointAllocationOptions) => Promise<TcpEndpointPair>;
}

export class EngineBridge {
  private activeSession: EngineSession | null = null;
  private mainWindow: BrowserWindow;
  private isPlaying = false;
  private enginePath: string;
  private port: number;
  private pubPort: number;
  private stderr = '';
  private playbackLock = false;
  private playbackSessionId = 0;
  private statePollingTimer: ReturnType<typeof setInterval> | null = null;
  private outputCallback: EngineOutputCallback | null = null;
  private playbackCompleteCallback: PlaybackCompleteCallback | null = null;
  private playbackErrorWarningCallback: PlaybackErrorWarningCallback | null = null;
  private awaitingPlaybackTerminalState = false;
  private lastEngineStateSequence = 0;
  private pendingPolledTerminalState: PendingTerminalStateCandidate | null = null;
  private terminalCleanupPromise: Promise<void> | null = null;
  private workingDirectory: string | null = null;
  private lastDiagnosticReport: string | null = null;
  private ownerLivenessSupported = false;
  private readonly engineSessionKind: EngineSessionKind;
  private readonly engineRuntime: EngineRuntimeService | null;
  private readonly automationSyncIntervalMs = 33;
  private readonly pendingAutomationSyncs = new Map<string, PendingAutomationSync>();
  private readonly lastAutomationSyncAt = new Map<string, number>();
  private readonly bridgeDependencies: EngineBridgeDependencies;

  constructor(
    mainWindow: BrowserWindow,
    enginePath?: string,
    port?: number,
    pubPort?: number,
    engineSessionKind: EngineSessionKind = 'realtime',
    engineRuntime?: EngineRuntimeService,
    dependencies: EngineBridgeDependencies = {},
  ) {
    this.mainWindow = mainWindow;
    this.enginePath = enginePath || 'blue-engine';
    this.port = port || 5555;
    this.pubPort = pubPort || this.port + 1;
    this.engineSessionKind = engineSessionKind;
    this.engineRuntime = engineRuntime ?? null;
    this.bridgeDependencies = dependencies;
  }

  setOutputCallback(cb: EngineOutputCallback | null): void {
    this.outputCallback = cb;
  }

  /**
   * Last formatted lifecycle diagnostic report for the most recent failed or
   * abnormally terminated session, or null when every session ended cleanly.
   */
  getLastDiagnosticReport(): string | null {
    return this.lastDiagnosticReport;
  }

  /**
   * Formats a session's lifecycle diagnostics, retains them for the Show
   * Diagnostics action, and appends the bounded report to the engine output
   * tab so failures leave operational evidence next to Csound output.
   */
  private recordSessionDiagnostics(session: EngineSession, outcome: string): void {
    const text = formatLifecycleDiagnosticReport(session.getDiagnostics(outcome));
    this.lastDiagnosticReport = text;
    this.outputCallback?.(`${text}\n`, 'stdout');
  }

  setPlaybackCompleteCallback(cb: PlaybackCompleteCallback | null): void {
    this.playbackCompleteCallback = cb;
  }

  setPlaybackErrorWarningCallback(cb: PlaybackErrorWarningCallback | null): void {
    this.playbackErrorWarningCallback = cb;
  }

  setWorkingDirectory(directory?: string | null): void {
    this.workingDirectory = directory && directory.trim().length > 0 ? directory : null;
  }

  private sendPlaybackStatus(status: 'starting' | 'playing' | 'stopping' | 'stopped' | 'error', message?: string): void {
    broadcastToWorkbenchWindows('playback-status', message ? { status, message } : { status });
  }

  private sendPlaybackError(message: string): void {
    this.sendPlaybackStatus('error', message);
    if (!isExpectedCsoundSourceError(message)) {
      this.playbackErrorWarningCallback?.(message);
    }
  }

  private sendPlaybackClock(snapshot: PlaybackClockSnapshot): void {
    broadcastToWorkbenchWindows('playback-clock', snapshot);
  }

  private clearStatePolling(): void {
    if (this.statePollingTimer) {
      clearInterval(this.statePollingTimer);
      this.statePollingTimer = null;
    }
  }

  private resetPlaybackTracking(): void {
    this.clearStatePolling();
    this.awaitingPlaybackTerminalState = false;
    this.pendingPolledTerminalState = null;
    this.lastEngineStateSequence = 0;
  }

  private startStatePolling(sessionId: number): void {
    this.clearStatePolling();
    this.statePollingTimer = setInterval(() => {
      void this.pollEngineState(sessionId);
    }, 250);
  }

  private async pollEngineState(sessionId: number): Promise<void> {
    const client = this.activeSession?.getClient();
    if (sessionId !== this.playbackSessionId || !client || !this.awaitingPlaybackTerminalState) {
      return;
    }

    try {
      const resp = await client.getEngineState();
      if (resp.ok && resp.state) {
        await this.handleEngineState(resp.state, 'poll');
      }
    } catch (error: unknown) {
      if (sessionId === this.playbackSessionId && this.awaitingPlaybackTerminalState) {
        console.warn(`[EngineBridge] getEngineState poll failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  private async handleEngineState(snapshot: EngineStateSnapshot, source: 'pubsub' | 'poll'): Promise<void> {
    if (!this.awaitingPlaybackTerminalState) {
      return;
    }

    if (source === 'pubsub' && snapshot.running) {
      this.sendPlaybackClock({
        sessionId: this.playbackSessionId,
        sampleFrames: snapshot.sampleFrames,
        sequence: snapshot.sequence,
        sampleRate: snapshot.sampleRate,
        ksmps: snapshot.ksmps,
      });
    }

    if (snapshot.sequence < this.lastEngineStateSequence) {
      return;
    }

    if (snapshot.sequence > this.lastEngineStateSequence) {
      this.lastEngineStateSequence = snapshot.sequence;
      if (snapshot.state !== 'stopped') {
        this.pendingPolledTerminalState = null;
      }
    }

    if (snapshot.state !== 'stopped') {
      return;
    }

    if (source === 'pubsub') {
      this.pendingPolledTerminalState = null;
      await this.finalizePlaybackFromEngine(snapshot, 'pubsub');
      return;
    }

    const now = Date.now();
    if (!this.pendingPolledTerminalState ||
        this.pendingPolledTerminalState.snapshot.sequence !== snapshot.sequence) {
      this.pendingPolledTerminalState = { snapshot, firstSeenAt: now };
      return;
    }

    if (now - this.pendingPolledTerminalState.firstSeenAt >= 400) {
      await this.finalizePlaybackFromEngine(snapshot, 'poll');
    }
  }

  private describeTerminalState(snapshot: EngineStateSnapshot, source: 'pubsub' | 'poll' | 'stop-command'): {
    status: 'stopped' | 'error';
    message: string;
  } {
    const sourceSuffix = source === 'poll' ? ' (reconciled via poll)' : '';

    switch (snapshot.stopReason) {
      case 'completed':
        return { status: 'stopped', message: `Playback finished${sourceSuffix}` };
      case 'stop-requested':
        return { status: 'stopped', message: `Playback stopped${sourceSuffix}` };
      case 'destroyed':
        return { status: 'stopped', message: `Playback stopped${sourceSuffix}` };
      case 'error':
        return {
          status: 'error',
          message: snapshot.lastError
            ? `Engine error: ${snapshot.lastError}${sourceSuffix}`
            : `Engine error${sourceSuffix}`,
        };
      case 'none':
      default:
        return { status: 'stopped', message: `Playback stopped${sourceSuffix}` };
    }
  }

  private clearPendingAutomationSyncs(): void {
    for (const pending of this.pendingAutomationSyncs.values()) {
      clearTimeout(pending.timer);
    }
    this.pendingAutomationSyncs.clear();
    this.lastAutomationSyncAt.clear();
  }

  private async finalizePlaybackFromEngine(snapshot: EngineStateSnapshot, source: 'pubsub' | 'poll' | 'stop-command'): Promise<void> {
    if (!this.awaitingPlaybackTerminalState) {
      return;
    }

    if (this.terminalCleanupPromise) {
      return this.terminalCleanupPromise;
    }

    this.awaitingPlaybackTerminalState = false;
    this.clearStatePolling();
    this.pendingPolledTerminalState = null;
    const { status, message } = this.describeTerminalState(snapshot, source);

    this.terminalCleanupPromise = (async () => {
      this.isPlaying = false;
      const stopReason = snapshot.stopReason ?? 'none';
      const session = this.activeSession;
      this.activeSession = null;
      if (session) {
        await session.shutdown('terminal-state');
      }
      if (status === 'error') {
        this.sendPlaybackError(message);
      } else {
        this.sendPlaybackStatus(status, message);
      }
      this.playbackCompleteCallback?.(stopReason);
    })().finally(() => {
      this.terminalCleanupPromise = null;
    });

    return this.terminalCleanupPromise;
  }

  /** Resolve an explicit legacy constructor path without searching PATH. */
  private findEngine(): string | null {
    if (path.isAbsolute(this.enginePath) && fs.existsSync(this.enginePath)) {
      return this.enginePath;
    }
    return null;
  }

  private async killEngine(): Promise<boolean> {
    const pendingTerminalCleanup = this.terminalCleanupPromise;
    if (pendingTerminalCleanup) {
      try {
        await pendingTerminalCleanup;
      } catch (error: unknown) {
        console.warn(
          `[EngineBridge] Pending terminal cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    this.resetPlaybackTracking();
    this.clearPendingAutomationSyncs();
    this.isPlaying = false;
    this.terminalCleanupPromise = null;
    const session = this.activeSession;
    this.activeSession = null;
    if (session) {
      try {
        const result = await session.shutdown('kill');
        if (result.status !== 'cleanup-failed') {
          return true;
        }
        this.recordSessionDiagnostics(session, 'Cleanup failed: process exit could not be confirmed');
      } catch (error: unknown) {
        this.recordSessionDiagnostics(
          session,
          `Cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      return false;
    }
    return true;
  }

  /**
   * Start a fresh blue-engine process and connect via ZMQ.
   */
  async startEngine(): Promise<EngineOperationResult> {
    // Ensure no leftover process
    this.lastDiagnosticReport = null;
    if (!(await this.killEngine())) {
      return {
        ok: false,
        failureCategory: 'cleanup-failed',
        errorMessage: 'The previous Blue Engine session could not be confirmed stopped.',
      };
    }

    let enginePath: string | null = null;
    if (this.engineRuntime) {
      const probeResult = await this.engineRuntime.probe();
      if (!probeResult.ok || !probeResult.selection) {
        return {
          ok: false,
          failureCategory: classifyEngineProbeFailure(probeResult.errorCode),
          errorMessage: probeResult.message,
        };
      }
      enginePath = probeResult.selection.executablePath;
      this.enginePath = enginePath;
      this.ownerLivenessSupported = Boolean(
        probeResult.report && hasEngineFeature(probeResult.report.engine, OWNER_LIVENESS_FEATURE),
      );
    } else {
      this.ownerLivenessSupported = false;
      enginePath = this.findEngine();
    }

    if (!enginePath) {
      return {
        ok: false,
        failureCategory: 'engine-unavailable',
        errorMessage:
          'Could not resolve an absolute Blue Engine path. Build the workspace engine or select an explicit external engine in Settings.',
      };
    }

    const transport = resolveEngineTransport();
    const transportsToTry: EngineTransport[] = transport === 'ipc' ? ['ipc', 'tcp'] : ['tcp'];
    let lastResult: EngineTransportStartResult = {
      ok: false,
      failureCategory: 'unexpected',
      errorMessage: 'The blue-engine process failed to start.',
      fallbackToTcp: false,
      retryWithoutOwnerPid: false,
    };
    let tcpAttempts = 0;

    let transportIndex = 0;
    while (transportIndex < transportsToTry.length) {
      const currentTransport = transportsToTry[transportIndex];
      const result = await this.startEngineWithTransport(enginePath, currentTransport);
      lastResult = result;
      if (result.ok) {
        return result;
      }

      if (result.retryWithoutOwnerPid) {
        // Keep compatibility with an engine whose probe report was stale or
        // inaccurate, but never optimistically pass the flag to unknown engines.
        continue;
      }
      if (currentTransport === 'ipc' && result.fallbackToTcp) {
        console.warn('[EngineBridge] Installed blue-engine does not support IPC endpoints yet; retrying with TCP.');
        transportIndex++;
        continue;
      }

      if (
        currentTransport === 'tcp' &&
        result.failureCategory === 'address-contention' &&
        tcpAttempts < 2
      ) {
        tcpAttempts += 1;
        continue;
      }

      break;
    }

    return lastResult;
  }

  private async startEngineWithTransport(
    enginePath: string,
    transport: EngineTransport,
  ): Promise<EngineTransportStartResult> {
    const sharedMemoryDisabled = process.env.BLUE_ENGINE_DISABLE_SHARED_MEMORY === '1';
    const channelMirroringDisabled = process.env.BLUE_ENGINE_DISABLE_CHANNEL_MIRRORING === '1';
    const threadPriorityElevationDisabled = process.env.BLUE_ENGINE_DISABLE_THREAD_PRIORITY_ELEVATION === '1';

    const extraArgs: string[] = [];
    if (sharedMemoryDisabled) {
      extraArgs.push('--disable-shared-memory');
    }
    if (channelMirroringDisabled) {
      extraArgs.push('--disable-channel-mirroring');
    }
    if (threadPriorityElevationDisabled) {
      extraArgs.push('--disable-thread-priority-elevation');
    }

    this.stderr = '';
    console.log(`[EngineBridge] Shared memory: ${sharedMemoryDisabled ? 'disabled' : 'enabled'}`);
    console.log(`[EngineBridge] Channel mirroring: ${channelMirroringDisabled ? 'disabled' : 'enabled'}`);
    console.log(`[EngineBridge] Thread priority elevation: ${threadPriorityElevationDisabled ? 'disabled' : 'enabled'}`);
    console.log(`[EngineBridge] Starting session (${transport}): ${enginePath}`);

    const spawnWorkingDirectory =
      this.workingDirectory &&
      fs.existsSync(this.workingDirectory) &&
      fs.statSync(this.workingDirectory).isDirectory()
        ? this.workingDirectory
        : undefined;

    let port = this.port;
    let pubPort = this.pubPort;
    if (transport === 'tcp') {
      try {
        const tcpPair = await (this.bridgeDependencies.allocateEndpoints ?? allocateTcpEndpointPair)({
          basePort: this.port,
        });
        port = tcpPair.controlPort;
        pubPort = tcpPair.pubPort;
      } catch (err) {
        // Report bounded address exhaustion instead of silently falling back
        // to the fixed default pair, which another owner may already hold.
        const errorMessage =
          `No isolated TCP endpoint pair available (address-contention): ` +
          `${err instanceof Error ? err.message : String(err)}`;
        console.error(`[EngineBridge] ${errorMessage}`);
        return {
          ok: false,
          failureCategory: 'address-contention',
          fallbackToTcp: false,
          retryWithoutOwnerPid: false,
          errorMessage,
        };
      }
    }

    const session = (this.bridgeDependencies.createSession ?? ((request: EngineSessionCreationRequest) => new EngineSession(request)))({
      kind: this.engineSessionKind,
      enginePath,
      generation: ++this.playbackSessionId,
      transport,
      port,
      pubPort,
      workingDirectory: spawnWorkingDirectory,
      extraArgs,
      ownerLivenessCapability: this.ownerLivenessSupported,
    });

    session.onOutput((text, type) => {
      if (type === 'stderr') {
        this.stderr += text;
        console.error(`[EngineBridge] stderr: ${text.trim()}`);
      } else {
        console.log(`[EngineBridge] stdout: ${text.trim()}`);
      }
      this.outputCallback?.(text, type);
    });

    try {
      await session.spawn(spawnWorkingDirectory);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`[EngineBridge] Spawn error: ${errorMessage}`);
      this.recordSessionDiagnostics(session, `Spawn failed: ${errorMessage}`);
      return {
        ok: false,
        failureCategory: 'engine-unavailable',
        fallbackToTcp: false,
        retryWithoutOwnerPid: false,
        errorMessage,
      };
    }

    const readyResult = await session.awaitReady();
    if (readyResult.status !== 'ready') {
      const stderrMessage = session.getStderr().trim();
      const fallbackToTcp = transport === 'ipc' && isUnsupportedIpcEndpointError(stderrMessage);

      let retryWithoutOwnerPid = false;
      if (this.ownerLivenessSupported && isUnknownOwnerPidOptionError(stderrMessage)) {
        this.ownerLivenessSupported = false;
        retryWithoutOwnerPid = true;
        console.warn(
          '[EngineBridge] Selected blue-engine does not support --owner-pid; ' +
          'retrying without owner lifetime monitoring for this engine.',
        );
      }

      const errorMessage = readyResult.errorMessage || stderrMessage || 'The blue-engine process exited immediately.';
      const failureCategory = readyResult.failureCategory ?? 'unexpected';
      this.recordSessionDiagnostics(session, `Startup failed: ${errorMessage}`);
      const cleanupResult = await session.shutdown('readiness-failed');
      if (cleanupResult.status === 'cleanup-failed') {
        const cleanupMessage = 'Startup failed and the engine process could not be confirmed stopped.';
        this.recordSessionDiagnostics(session, cleanupMessage);
        return {
          ok: false,
          failureCategory: 'cleanup-failed',
          fallbackToTcp: false,
          retryWithoutOwnerPid: false,
          errorMessage: `${errorMessage} ${cleanupMessage}`,
        };
      }
      return {
        ok: false,
        failureCategory,
        fallbackToTcp,
        retryWithoutOwnerPid,
        errorMessage,
      };
    }

    this.activeSession = session;

    session.onEngineState((snapshot) => {
      if (isSessionActive(session, this.activeSession)) {
        void this.handleEngineState(snapshot, 'pubsub');
      }
    });

    void session.awaitExit().then(async (lifecycleResult) => {
      if (validateSessionAuthority(session, this.activeSession)) {
        console.log(`[EngineBridge] Engine exited: code=${lifecycleResult.exitCode}, signal=${lifecycleResult.signalCode}`);
        const awaitingTerminalState = this.awaitingPlaybackTerminalState;
        const hadPendingTerminalCleanup = this.terminalCleanupPromise !== null;
        const stderrMessage = session.getStderr().trim();

        const cleanup = (async () => {
          this.recordSessionDiagnostics(
            session,
            `Engine exited unexpectedly (code: ${lifecycleResult.exitCode}, signal: ${lifecycleResult.signalCode})`,
          );

          this.resetPlaybackTracking();
          this.clearPendingAutomationSyncs();
          this.activeSession = null;
          this.isPlaying = false;

          const cleanupResult = await session.shutdown('process-exit');
          if (cleanupResult.status === 'cleanup-failed') {
            this.recordSessionDiagnostics(session, 'Cleanup failed after process exit');
          }

          if (awaitingTerminalState && !hadPendingTerminalCleanup) {
            const detail = stderrMessage
              ? `Engine error: ${stderrMessage.split('\n').pop()}`
              : `Engine exited before publishing terminal playback state (code: ${lifecycleResult.exitCode}, signal: ${lifecycleResult.signalCode})`;
            this.sendPlaybackError(detail);
          }
        })();
        let trackedCleanup!: Promise<void>;
        trackedCleanup = cleanup.finally(() => {
          if (this.terminalCleanupPromise === trackedCleanup) {
            this.terminalCleanupPromise = null;
          }
        });
        this.terminalCleanupPromise = trackedCleanup;
        await trackedCleanup;
      }
    }).catch((error: unknown) => {
      console.error(`[EngineBridge] Exit cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
    });

    console.log('[EngineBridge] Engine started successfully');
    return { ok: true, fallbackToTcp: false, retryWithoutOwnerPid: false };
  }

  /**
   * Stop playback, kill the engine, and reset state.
   */
  async stopEngine(emitStatus = true, message?: string): Promise<void> {
    const session = this.activeSession;
    const client = session?.getClient();

    if (session && client && this.isPlaying) {
      if (emitStatus) {
        this.sendPlaybackStatus('stopping', message ?? 'Stopping playback...');
      }

      try {
        const resp = await client.stop();
        console.log(`[EngineBridge] stop: ${resp.ok ? 'OK' : 'FAILED'} ${resp.message}`);
        if (!resp.ok) {
          await this.killEngine();
          if (emitStatus) {
            this.sendPlaybackStatus('error', `Engine stop failed: ${resp.message}`);
          }
        } else if (this.terminalCleanupPromise) {
          await this.terminalCleanupPromise;
        } else if (this.awaitingPlaybackTerminalState) {
          const stateResp = await client.getEngineState();
          if (!stateResp.ok || !stateResp.state || stateResp.state.state !== 'stopped') {
            throw new Error(stateResp.message || 'Engine did not reach the stopped state');
          }
          await this.finalizePlaybackFromEngine(stateResp.state, 'stop-command');
        }
      } catch (err) {
        console.warn(`[EngineBridge] stop command error: ${err instanceof Error ? err.message : String(err)}`);
        await this.killEngine();
        if (emitStatus) {
          this.sendPlaybackStatus('error', err instanceof Error ? err.message : String(err));
        }
      }

      return;
    }

    await this.killEngine();
    if (emitStatus) {
      this.sendPlaybackStatus('stopped', message);
    }
  }

  /**
   * Play a CSD string — compile and start performance.
   * Destroys any existing engine and starts fresh.
   * Uses a lock to prevent concurrent playback attempts.
   */
  async playCSD(
    csd: string,
    parameters?: Parameter[],
    automationTiming?: AutomationTimingContext,
    workingDirectory?: string | null,
    extraOptions: string[] = [],
  ): Promise<EngineOperationResult> {
    if (this.playbackLock) {
      console.warn('[EngineBridge] Playback already in progress, ignoring');
      return {
        ok: false,
        failureCategory: 'unexpected',
        errorMessage: 'Playback is already in progress.',
      };
    }
    this.playbackLock = true;
    this.setWorkingDirectory(workingDirectory);

    try {
      const { orchestra, score } = parseCSD(csd);
      const options = [...new Set(extraOptions.filter((opt) => opt.trim().length > 0))];

      console.log(`[EngineBridge] CSD: ${csd.length} bytes`);
      console.log(`[EngineBridge] Options: ${JSON.stringify(options)}`);
      console.log(`[EngineBridge] Orchestra: ${orchestra?.length || 0} chars`);
      console.log(`[EngineBridge] Score: ${score?.length || 0} chars`);

      const tempCsdPath = await writeTempCsdSnapshot(csd, this.workingDirectory);
      const renderCommandOptions = options.includes('-d') ? [...options] : ['-d', ...options];
      this.outputCallback?.(
        formatRenderCommandLine(renderCommandOptions, tempCsdPath, this.enginePath),
        'stdout',
      );

      const started = await this.startEngine();
      if (!started.ok) return started;
      const client = this.activeSession?.getClient();
      if (!client) {
        const cleaned = await this.killEngine();
        return {
          ok: false,
          failureCategory: cleaned ? 'session-unresponsive' : 'cleanup-failed',
          errorMessage: 'Blue Engine client was not ready after startup.',
        };
      }

      if (!orchestra && !score) {
        console.warn('[EngineBridge] Empty CSD — no orchestra or score to play');
        this.sendPlaybackStatus('error', 'No instruments or score events to play');
        const cleaned = await this.killEngine();
        return {
          ok: false,
          failureCategory: cleaned ? 'unexpected' : 'cleanup-failed',
          errorMessage: 'No instruments or score events to play.',
        };
      }

      for (const opt of options) {
        console.log(`[EngineBridge] setOption: ${opt}`);
        try {
          const resp = await client.setOption(opt);
          if (!resp.ok) {
            console.warn(`[EngineBridge] setOption skipped: ${opt} — ${resp.message}`);
          }
        } catch (err: unknown) {
          console.error(`[EngineBridge] setOption error: ${opt} — ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      if (orchestra) {
        console.log(`[EngineBridge] compileOrc (${orchestra.length} chars)`);
        const resp = await client.compileOrc(orchestra);
        console.log(`[EngineBridge] compileOrc: ${resp.ok ? 'OK' : 'FAILED'} ${resp.message}`);
        if (!resp.ok) {
          this.sendPlaybackError(`Orchestra compile failed: ${resp.message}`);
          const cleaned = await this.killEngine();
          return {
            ok: false,
            failureKind: cleaned ? 'project' : 'engine',
            failureCategory: cleaned ? classifyProcessError(null, resp.message) : 'cleanup-failed',
            errorMessage: `Orchestra compile failed: ${resp.message}`,
          };
        }
      }

      if (parameters && parameters.length > 0) {
        await this.sendAutomationDefinitions(client, parameters, automationTiming);
      }

      if (score) {
        console.log(`[EngineBridge] readScore (${score.length} chars)`);
        const resp = await client.readScore(score);
        console.log(`[EngineBridge] readScore: ${resp.ok ? 'OK' : 'FAILED'} ${resp.message}`);
        if (!resp.ok) {
          this.sendPlaybackError(`Score read failed: ${resp.message}`);
          const cleaned = await this.killEngine();
          return {
            ok: false,
            failureKind: cleaned ? 'project' : 'engine',
            failureCategory: cleaned ? classifyProcessError(null, resp.message) : 'cleanup-failed',
            errorMessage: `Score read failed: ${resp.message}`,
          };
        }
      }

      console.log(`[EngineBridge] start()`);
      const startResp = await client.start();
      console.log(`[EngineBridge] start: ${startResp.ok ? 'OK' : 'FAILED'} ${startResp.message}`);
      if (!startResp.ok) {
        this.sendPlaybackError(`Engine start failed: ${startResp.message}`);
        const cleaned = await this.killEngine();
        return {
          ok: false,
          failureCategory: cleaned ? classifyProcessError(null, startResp.message) : 'cleanup-failed',
          errorMessage: `Engine start failed: ${startResp.message}`,
        };
      }

      this.isPlaying = true;
      this.playbackSessionId += 1;
      this.awaitingPlaybackTerminalState = true;
      this.pendingPolledTerminalState = null;
      this.lastEngineStateSequence = 0;
      this.startStatePolling(this.playbackSessionId);
      this.sendPlaybackClock({
        sessionId: this.playbackSessionId,
        sampleFrames: 0,
        sequence: 0,
        sampleRate: automationTiming?.sampleRate,
        ksmps: automationTiming?.ksmps,
      });
      this.sendPlaybackStatus('playing', 'Playing via blue-engine');

      return { ok: true };
    } catch (error) {
      const cleaned = await this.killEngine();
      if (!cleaned) {
        return {
          ok: false,
          failureCategory: 'cleanup-failed',
          errorMessage: 'Engine operation failed and the process could not be confirmed stopped.',
        };
      }
      throw error;
    } finally {
      this.playbackLock = false;
    }
  }

  private async sendAutomationDefinitions(
    client: EngineClient,
    parameters: Parameter[],
    automationTiming?: AutomationTimingContext,
  ): Promise<void> {
    try {
      await client.clearAutomations();
    } catch (err) {
      console.warn(`[EngineBridge] clearAutomations failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    for (const param of parameters) {
      const varName = param.getCompilationVarName();
      if (!varName) continue;

      if (param.isAutomationEnabled() && param.getPoints().length >= 2) {
        const curveCode = mapAutomationCurve(param.getCurve());
        const points = getEngineAutomationPoints(
          param,
          automationTiming?.renderStartTime ?? 0,
          automationTiming?.tempoMap,
        );

        try {
          const resp = await client.createAutomation(
            varName,
            curveCode,
            true,
            getAutomationResolutionText(param),
            points,
          );
          if (!resp.ok) {
            console.warn(`[EngineBridge] createAutomation(${varName}) failed: ${resp.message}`);
          }
        } catch (err) {
          console.warn(`[EngineBridge] createAutomation(${varName}) error: ${err instanceof Error ? err.message : String(err)}`);
        }
      } else {
        try {
          const fixedVal = getRuntimeFixedChannelValue(param, automationTiming);
          const resp = await client.createChannel(varName, fixedVal);
          if (!resp.ok) {
            await client.setChannel(varName, fixedVal);
          }
        } catch (err) {
          console.warn(`[EngineBridge] createChannel(${varName}) error: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    console.log(`[EngineBridge] Sent ${parameters.length} parameter definitions`);
  }

  async syncAutomationParameter(
    parameter: Parameter,
    automationTiming?: AutomationTimingContext,
    options: AutomationSyncOptions = {},
  ): Promise<void> {
    const client = this.activeSession?.getClient();
    const varName = parameter.getCompilationVarName();
    if (!client || !varName) {
      return;
    }

    if (options.coalesce === false) {
      await this.sendAutomationParameterSync(client, parameter, automationTiming);
      return;
    }

    this.queueAutomationParameterSync(varName, parameter, automationTiming);
  }

  private queueAutomationParameterSync(
    varName: string,
    parameter: Parameter,
    automationTiming?: AutomationTimingContext,
  ): void {
    const now = Date.now();
    const lastSentAt = this.lastAutomationSyncAt.get(varName) ?? 0;
    const elapsed = now - lastSentAt;

    const existing = this.pendingAutomationSyncs.get(varName);
    if (existing) {
      clearTimeout(existing.timer);
      this.pendingAutomationSyncs.delete(varName);
    }

    if (elapsed >= this.automationSyncIntervalMs) {
      const client = this.activeSession?.getClient();
      if (!client) {
        return;
      }

      this.lastAutomationSyncAt.set(varName, now);
      void this.sendAutomationParameterSync(client, parameter, automationTiming);
      return;
    }

    const delayMs = this.automationSyncIntervalMs - elapsed;
    const timer = setTimeout(() => {
      const pending = this.pendingAutomationSyncs.get(varName);
      this.pendingAutomationSyncs.delete(varName);
      const client = this.activeSession?.getClient();
      if (!pending || !client) {
        return;
      }

      this.lastAutomationSyncAt.set(varName, Date.now());
      void this.sendAutomationParameterSync(
        client,
        pending.parameter,
        pending.automationTiming,
      );
    }, delayMs);

    this.pendingAutomationSyncs.set(varName, {
      parameter,
      automationTiming,
      timer,
    });
  }

  private async sendAutomationParameterSync(
    client: EngineClient,
    parameter: Parameter,
    automationTiming?: AutomationTimingContext,
  ): Promise<void> {
    const varName = parameter.getCompilationVarName();
    if (!varName) {
      return;
    }

    const shouldAutomate = parameter.isAutomationEnabled() && parameter.getPoints().length >= 2;
    if (shouldAutomate) {
      await this.updateOrCreateAutomation(client, parameter, varName, automationTiming);
      return;
    }

    await this.deleteAutomationAndRestoreChannel(client, parameter, varName, automationTiming);
  }

  private async updateOrCreateAutomation(
    client: EngineClient,
    parameter: Parameter,
    varName: string,
    automationTiming?: AutomationTimingContext,
  ): Promise<void> {
    const curveCode = mapAutomationCurve(parameter.getCurve());
    const points = getEngineAutomationPoints(
      parameter,
      automationTiming?.renderStartTime ?? 0,
      automationTiming?.tempoMap,
    );

    try {
      const updateResp = await client.updateAutomation(
        varName,
        curveCode,
        true,
        getAutomationResolutionText(parameter),
        points,
      );
      if (updateResp.ok) {
        return;
      }

      if (!isAutomationNotFoundMessage(updateResp.message)) {
        console.warn(`[EngineBridge] updateAutomation(${varName}) failed: ${updateResp.message}`);
        return;
      }

      const createResp = await client.createAutomation(
        varName,
        curveCode,
        true,
        getAutomationResolutionText(parameter),
        points,
      );
      if (!createResp.ok) {
        console.warn(`[EngineBridge] createAutomation(${varName}) failed after update miss: ${createResp.message}`);
      }
    } catch (err) {
      console.warn(`[EngineBridge] updateAutomation(${varName}) error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async deleteAutomationAndRestoreChannel(
    client: EngineClient,
    parameter: Parameter,
    varName: string,
    automationTiming?: AutomationTimingContext,
  ): Promise<void> {
    try {
      const deleteResp = await client.deleteAutomation(varName);
      if (!deleteResp.ok && !isAutomationNotFoundMessage(deleteResp.message)) {
        console.warn(`[EngineBridge] deleteAutomation(${varName}) failed: ${deleteResp.message}`);
      }
    } catch (err) {
      console.warn(`[EngineBridge] deleteAutomation(${varName}) error: ${err instanceof Error ? err.message : String(err)}`);
    }

    const value = getRuntimeFixedChannelValue(parameter, automationTiming);
    try {
      const setResp = await client.setChannel(varName, value);
      if (!setResp.ok) {
        const createResp = await client.createChannel(varName, value);
        if (!createResp.ok) {
          console.warn(`[EngineBridge] setChannel(${varName}) failed after automation delete: ${setResp.message}`);
        }
      }
    } catch (err) {
      console.warn(`[EngineBridge] setChannel(${varName}) error after automation delete: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Stop playback. Kills the engine and resets state.
   */
  async stopPlayback(): Promise<void> {
    if (!this.isPlaying && !this.activeSession) {
      this.sendPlaybackStatus('stopped');
      return;
    }

    this.playbackLock = false;
    await this.stopEngine();
  }

  async setChannel(name: string, value: number): Promise<void> {
    const client = this.activeSession?.getClient();
    if (client) {
      const resp = await client.setChannel(name, value);
      if (!resp.ok) {
        console.warn(`[EngineBridge] setChannel(${name}) failed: ${resp.message}`);
      }
    }
  }

  async getChannel(name: string): Promise<number> {
    const client = this.activeSession?.getClient();
    if (client) {
      const resp = await client.getChannel(name);
      if (resp.ok) return resp.value;
    }
    return 0;
  }

  getClient(): EngineClient | null {
    return this.activeSession?.getClient() ?? null;
  }

  getActiveSession(): EngineSession | null {
    return this.activeSession;
  }

  isCurrentlyPlaying(): boolean {
    return this.isPlaying;
  }

  async dispose(): Promise<void> {
    this.playbackLock = false;
    await this.killEngine();
  }

  async killAndWait(): Promise<void> {
    this.playbackLock = false;
    await this.killEngine();
  }
}

function parseCSD(csd: string): { orchestra: string; score: string; options: string[] } {
  const options: string[] = [];
  let orchestra = '';
  let score = '';

  const optsMatch = csd.match(/<CsOptions>([\s\S]*?)<\/CsOptions>/);
  if (optsMatch) {
    const optsText = optsMatch[1].trim();
    for (const line of optsText.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith(';')) {
        options.push(trimmed);
      }
    }
  }

  const orcMatch = csd.match(/<CsInstruments>([\s\S]*?)<\/CsInstruments>/);
  if (orcMatch) {
    orchestra = orcMatch[1].trim();
  }

  const scoMatch = csd.match(/<CsScore>([\s\S]*?)<\/CsScore>/);
  if (scoMatch) {
    score = scoMatch[1].trim();
  }

  return { orchestra, score, options };
}

function mapAutomationCurve(curve: AutomationCurve): AutomationCurveCode {
  switch (curve) {
    case AutomationCurve.STEP: return AutomationCurveCode.STEP;
    case AutomationCurve.LINEAR: return AutomationCurveCode.LINEAR;
    case AutomationCurve.EXPONENTIAL: return AutomationCurveCode.EXPONENTIAL;
    default: return AutomationCurveCode.LINEAR;
  }
}

function getAutomationResolutionText(parameter: Parameter): string {
  const exactParameter = parameter as Parameter & {
    getResolutionText?: () => string;
  };
  if (typeof exactParameter.getResolutionText === 'function') {
    return exactParameter.getResolutionText();
  }
  return String(parameter.getResolution());
}

function isAutomationNotFoundMessage(message: string): boolean {
  return /automation\s+not\s+found/i.test(message)
    || /not\s+found.*automation/i.test(message);
}

function getRuntimeFixedChannelValue(
  parameter: Parameter,
  automationTiming?: AutomationTimingContext,
): number {
  return parameter.getValue(automationTiming?.renderStartTime ?? 0);
}
