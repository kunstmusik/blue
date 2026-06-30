/**
 * EngineBridge — manages the blue-engine subprocess and ZMQ connection.
 * Bridges the Electron main process to the C++ blue-engine.
 *
 * Lifecycle: For each playback, a fresh engine is spawned.
 * After stop (or natural completion), the engine is force-killed.
 * A playback lock prevents concurrent operations.
 */
import { ChildProcess, spawn } from 'child_process';
import { EngineClient, AutomationCurveCode, type EngineStateSnapshot } from '@blue/engine-client';
import { BrowserWindow, dialog } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { Parameter, TempoMap } from '@blue/data';
import { AutomationCurve, getEngineAutomationPoints } from '@blue/data';
import type { PlaybackClockSnapshot } from '../shared/project-editor';
import { formatRenderCommandLine, writeTempCsdSnapshot } from './render-command';
import {
  registerEngineProcess,
  removeEngineProcessRecord,
  type EngineSessionKind,
} from './engine-process-registry';

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

interface EngineEndpoints {
  controlEndpoint: string;
  pubEndpoint: string;
}

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

function buildEngineEndpoints(transport: EngineTransport, port: number, pubPort: number, shmName: string): EngineEndpoints {
  if (transport === 'ipc') {
    const basePath = path.join(os.tmpdir(), shmName);
    return {
      controlEndpoint: `ipc://${basePath}-control.ipc`,
      pubEndpoint: `ipc://${basePath}-pub.ipc`,
    };
  }

  return {
    controlEndpoint: `tcp://localhost:${port}`,
    pubEndpoint: `tcp://localhost:${pubPort}`,
  };
}

function isUnsupportedIpcEndpointError(stderr: string): boolean {
  return stderr.includes('Unknown option: --control-endpoint') || stderr.includes('Unknown option: --pub-endpoint');
}

export type EngineOutputCallback = (text: string, type: 'stdout' | 'stderr') => void;
export type PlaybackCompleteCallback = (stopReason: string) => void;

export class EngineBridge {
  private engineProcess: ChildProcess | null = null;
  private client: EngineClient | null = null;
  private mainWindow: BrowserWindow;
  private isPlaying = false;
  private enginePath: string;
  private port: number;
  private pubPort: number;
  private stderr = '';
  private playbackLock = false;
  private playbackSessionId = 0;
  private statePollingTimer: ReturnType<typeof setInterval> | null = null;
  private engineStateUnsubscribe: (() => void) | null = null;
  private outputCallback: EngineOutputCallback | null = null;
  private playbackCompleteCallback: PlaybackCompleteCallback | null = null;
  private awaitingPlaybackTerminalState = false;
  private lastEngineStateSequence = 0;
  private pendingPolledTerminalState: PendingTerminalStateCandidate | null = null;
  private terminalCleanupPromise: Promise<void> | null = null;
  private workingDirectory: string | null = null;
  private engineProcessRecordPath: string | null = null;
  private readonly engineSessionKind: EngineSessionKind;
  private readonly automationSyncIntervalMs = 33;
  private readonly pendingAutomationSyncs = new Map<string, PendingAutomationSync>();
  private readonly lastAutomationSyncAt = new Map<string, number>();

  constructor(
    mainWindow: BrowserWindow,
    enginePath?: string,
    port?: number,
    pubPort?: number,
    engineSessionKind: EngineSessionKind = 'realtime',
  ) {
    this.mainWindow = mainWindow;
    this.enginePath = enginePath || 'blue-engine';
    this.port = port || 5555;
    this.pubPort = pubPort || this.port + 1;
    this.engineSessionKind = engineSessionKind;
  }

  setOutputCallback(cb: EngineOutputCallback | null): void {
    this.outputCallback = cb;
  }

  setPlaybackCompleteCallback(cb: PlaybackCompleteCallback | null): void {
    this.playbackCompleteCallback = cb;
  }

  setWorkingDirectory(directory?: string | null): void {
    this.workingDirectory = directory && directory.trim().length > 0 ? directory : null;
  }

  private sendPlaybackStatus(status: 'starting' | 'playing' | 'stopping' | 'stopped' | 'error', message?: string): void {
    this.mainWindow.webContents.send('playback-status', message ? { status, message } : { status });
  }

  private sendPlaybackClock(snapshot: PlaybackClockSnapshot): void {
    this.mainWindow.webContents.send('playback-clock', snapshot);
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

  private detachEngineStateListener(): void {
    if (this.engineStateUnsubscribe) {
      this.engineStateUnsubscribe();
      this.engineStateUnsubscribe = null;
    }
  }

  private attachEngineStateListener(client: EngineClient): void {
    this.detachEngineStateListener();
    this.engineStateUnsubscribe = client.onEngineState((snapshot) => {
      void this.handleEngineState(snapshot, 'pubsub');
    });
  }

  private startStatePolling(sessionId: number): void {
    this.clearStatePolling();
    this.statePollingTimer = setInterval(() => {
      void this.pollEngineState(sessionId);
    }, 250);
  }

  private async pollEngineState(sessionId: number): Promise<void> {
    if (sessionId !== this.playbackSessionId || !this.client || !this.awaitingPlaybackTerminalState) {
      return;
    }

    try {
      const resp = await this.client.getEngineState();
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

  private describeTerminalState(snapshot: EngineStateSnapshot, source: 'pubsub' | 'poll'): {
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

  private async teardownClient(): Promise<void> {
    const client = this.client;
    this.client = null;
    this.detachEngineStateListener();

    if (!client) {
      return;
    }

    try {
      await client.disconnect();
    } catch (error: unknown) {
      console.warn(`[EngineBridge] client disconnect failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private clearPendingAutomationSyncs(): void {
    for (const pending of this.pendingAutomationSyncs.values()) {
      clearTimeout(pending.timer);
    }
    this.pendingAutomationSyncs.clear();
    this.lastAutomationSyncAt.clear();
  }

  private killEngineProcess(): void {
    if (this.engineProcess && !this.engineProcess.killed) {
      try {
        this.engineProcess.kill('SIGKILL');
      } catch {
        // Process already dead
      }
    }

    this.engineProcess = null;
    if (this.engineProcessRecordPath) {
      void removeEngineProcessRecord(this.engineProcessRecordPath);
      this.engineProcessRecordPath = null;
    }
  }

  private async resetEngineResources(): Promise<void> {
    this.resetPlaybackTracking();
    this.clearPendingAutomationSyncs();
    await this.teardownClient();
    this.killEngineProcess();
    this.isPlaying = false;
    this.terminalCleanupPromise = null;
  }

  private async finalizePlaybackFromEngine(snapshot: EngineStateSnapshot, source: 'pubsub' | 'poll'): Promise<void> {
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
      await this.teardownClient();
      this.killEngineProcess();
      this.sendPlaybackStatus(status, message);
      this.playbackCompleteCallback?.(stopReason);
    })().finally(() => {
      this.terminalCleanupPromise = null;
    });

    return this.terminalCleanupPromise;
  }

  /**
   * Find the blue-engine binary. Checks common locations.
   */
  private findEngine(): string | null {
    if (fs.existsSync(this.enginePath)) {
      return this.enginePath;
    }

    const candidates = [
      '/usr/local/bin/blue-engine',
      '/opt/homebrew/bin/blue-engine',
      path.join(process.env.HOME || '', '.local', 'bin', 'blue-engine'),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    return null;
  }

  /**
   * Force-kill the engine process and clean up all resources.
   * Does NOT send playback status.
   */
  private async killEngine(): Promise<void> {
    await this.resetEngineResources();
  }

  /**
   * Start a fresh blue-engine process and connect via ZMQ.
   */
  async startEngine(): Promise<boolean> {
    // Ensure no leftover process
    await this.killEngine();

    const enginePath = this.findEngine();
    if (!enginePath) {
      await dialog.showErrorBox(
        'blue-engine Not Found',
        `Could not find the blue-engine binary.\n\n` +
        `Searched: ${this.enginePath}, /usr/local/bin/blue-engine, /opt/homebrew/bin/blue-engine\n\n` +
        `Please install blue-engine or set the engine path in preferences.`,
      );
      return false;
    }

    // Use unique port and shm name per instance to avoid stale shm collisions
    const shmName = `blue-engine-${Date.now()}`;
    const transport = resolveEngineTransport();
    const transportsToTry: EngineTransport[] = transport === 'ipc' ? ['ipc', 'tcp'] : ['tcp'];
    let lastError = '';

    for (const currentTransport of transportsToTry) {
      const result = await this.startEngineWithTransport(enginePath, shmName, currentTransport);
      if (result.ok) {
        return true;
      }

      lastError = result.errorMessage;
      if (currentTransport === 'ipc' && result.fallbackToTcp) {
        console.warn('[EngineBridge] Installed blue-engine does not support IPC endpoints yet; retrying with TCP.');
        continue;
      }

      break;
    }

    await dialog.showErrorBox(
      'blue-engine Failed',
      `The blue-engine process exited immediately.\n\n` +
      `Error output:\n${lastError || '(no output)'}`,
    );
    return false;
  }

  private async startEngineWithTransport(
    enginePath: string,
    shmName: string,
    transport: EngineTransport,
  ): Promise<{ ok: boolean; fallbackToTcp: boolean; errorMessage: string }> {
    const endpoints = buildEngineEndpoints(transport, this.port, this.pubPort, shmName);
    const sharedMemoryDisabled = process.env.BLUE_ENGINE_DISABLE_SHARED_MEMORY === '1';
    const channelMirroringDisabled = process.env.BLUE_ENGINE_DISABLE_CHANNEL_MIRRORING === '1';
    const threadPriorityElevationDisabled = process.env.BLUE_ENGINE_DISABLE_THREAD_PRIORITY_ELEVATION === '1';
    const spawnArgs = transport === 'ipc'
      ? ['--control-endpoint', endpoints.controlEndpoint, '--pub-endpoint', endpoints.pubEndpoint, '--shm', shmName]
      : ['--port', `${this.port}`, '--pub-port', `${this.pubPort}`, '--shm', shmName];

    if (sharedMemoryDisabled) {
      spawnArgs.push('--disable-shared-memory');
    }

    if (channelMirroringDisabled) {
      spawnArgs.push('--disable-channel-mirroring');
    }

    if (threadPriorityElevationDisabled) {
      spawnArgs.push('--disable-thread-priority-elevation');
    }

    this.stderr = '';
    console.log(`[EngineBridge] Shared memory: ${sharedMemoryDisabled ? 'disabled' : 'enabled'}`);
    console.log(`[EngineBridge] Channel mirroring: ${channelMirroringDisabled ? 'disabled' : 'enabled'}`);
    console.log(`[EngineBridge] Thread priority elevation: ${threadPriorityElevationDisabled ? 'disabled' : 'enabled'}`);
    console.log(`[EngineBridge] Starting (${transport}): ${enginePath} ${spawnArgs.join(' ')}`);

    const spawnWorkingDirectory =
      this.workingDirectory &&
      fs.existsSync(this.workingDirectory) &&
      fs.statSync(this.workingDirectory).isDirectory()
        ? this.workingDirectory
        : undefined;

    this.engineProcess = spawn(
      enginePath,
      spawnArgs,
      {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: spawnWorkingDirectory,
      },
    );

    if (typeof this.engineProcess.pid === 'number') {
      try {
        this.engineProcessRecordPath = await registerEngineProcess({
          version: 1,
          kind: this.engineSessionKind,
          pid: this.engineProcess.pid,
          ownerPid: process.pid,
          enginePath,
          spawnArgs,
          controlEndpoint: endpoints.controlEndpoint,
          pubEndpoint: endpoints.pubEndpoint,
          shmName,
          startedAt: Date.now(),
        });
      } catch (error) {
        console.warn(`[EngineBridge] Failed to register engine process: ${error instanceof Error ? error.message : String(error)}`);
        this.engineProcessRecordPath = null;
      }
    }

    this.engineProcess.stderr?.on('data', (data: Buffer) => {
      const text = data.toString();
      this.stderr += text;
      console.error(`[EngineBridge] stderr: ${text.trim()}`);
      this.outputCallback?.(text, 'stderr');
    });

    this.engineProcess.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      console.log(`[EngineBridge] stdout: ${text.trim()}`);
    });

    this.engineProcess.on('exit', (code, signal) => {
      console.log(`[EngineBridge] Engine exited: code=${code}, signal=${signal}`);
      const awaitingTerminalState = this.awaitingPlaybackTerminalState;
      const stderrMessage = this.stderr.trim();
      const exitingClient = this.client;

      this.resetPlaybackTracking();
      this.clearPendingAutomationSyncs();
      this.detachEngineStateListener();
      this.engineProcess = null;
      this.client = null;
      this.isPlaying = false;
      if (this.engineProcessRecordPath) {
        void removeEngineProcessRecord(this.engineProcessRecordPath);
        this.engineProcessRecordPath = null;
      }

      if (exitingClient) {
        void exitingClient.disconnect(false).catch(() => undefined);
      }

      if (awaitingTerminalState && !this.terminalCleanupPromise) {
        const detail = stderrMessage
          ? `Engine error: ${stderrMessage.split('\n').pop()}`
          : `Engine exited before publishing terminal playback state (code: ${code}, signal: ${signal})`;
        this.sendPlaybackStatus('error', detail);
      }
    });

    this.engineProcess.on('error', (err) => {
      console.error(`[EngineBridge] Spawn error: ${err.message}`);
      this.isPlaying = false;
      this.mainWindow.webContents.send('playback-error', `Engine error: ${err.message}`);
    });

    await new Promise((resolve) => setTimeout(resolve, 500));

    if (!this.engineProcess || this.engineProcess.killed || this.engineProcess.exitCode !== null) {
      const stderrMessage = this.stderr.trim();
      const fallbackToTcp = transport === 'ipc' && isUnsupportedIpcEndpointError(stderrMessage);
      const errorMessage = stderrMessage || 'The blue-engine process exited immediately.';
      await this.killEngine();
      return { ok: false, fallbackToTcp, errorMessage };
    }

    try {
      this.client = new EngineClient({
        endpoint: endpoints.controlEndpoint,
        pubEndpoint: endpoints.pubEndpoint,
        timeout: 10000,
      });
      await this.client.connect();
      this.attachEngineStateListener(this.client);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`[EngineBridge] ZMQ connect failed: ${errorMessage}`);
      await this.killEngine();
      return { ok: false, fallbackToTcp: false, errorMessage };
    }

    try {
      const createResp = await this.client.createEngine();
      if (!createResp.ok) {
        console.error(`[EngineBridge] createEngine failed: ${createResp.message}`);
        await this.killEngine();
        return { ok: false, fallbackToTcp: false, errorMessage: createResp.message };
      }

      const optResp = await this.client.setOption('-d');
      if (!optResp.ok) {
        console.warn(`[EngineBridge] setOption(-d) warning: ${optResp.message}`);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`[EngineBridge] Engine init failed: ${errorMessage}`);
      await this.killEngine();
      return { ok: false, fallbackToTcp: false, errorMessage };
    }

    console.log('[EngineBridge] Engine started successfully');
    return { ok: true, fallbackToTcp: false, errorMessage: '' };
  }

  /**
   * Stop playback, kill the engine, and reset state.
   */
  async stopEngine(emitStatus = true, message?: string): Promise<void> {
    // Send stop command if client is available and playing
    if (this.client && this.isPlaying) {
      if (emitStatus) {
        this.sendPlaybackStatus('stopping', message ?? 'Stopping playback...');
      }

      try {
        const resp = await this.client.stop();
        console.log(`[EngineBridge] stop: ${resp.ok ? 'OK' : 'FAILED'} ${resp.message}`);
        if (!resp.ok) {
          await this.killEngine();
          if (emitStatus) {
            this.sendPlaybackStatus('error', `Engine stop failed: ${resp.message}`);
          }
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
  ): Promise<boolean> {
    // Prevent concurrent playback
    if (this.playbackLock) {
      console.warn('[EngineBridge] Playback already in progress, ignoring');
      return false;
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

      // Emit first so the output tab always starts with Java-style render command text.
      const tempCsdPath = await writeTempCsdSnapshot(csd, this.workingDirectory);
      const renderCommandOptions = options.includes('-d') ? [...options] : ['-d', ...options];
      this.outputCallback?.(
        formatRenderCommandLine(renderCommandOptions, tempCsdPath, this.enginePath),
        'stdout',
      );

      const started = await this.startEngine();
      if (!started) return false;
      if (!this.client) return false;

      // Check if we have anything to play
      if (!orchestra && !score) {
        console.warn('[EngineBridge] Empty CSD — no orchestra or score to play');
        this.mainWindow.webContents.send('playback-status', {
          status: 'error',
          message: 'No instruments or score events to play',
        });
        return false;
      }

      // Set options (skip ones that cause errors)
      for (const opt of options) {
        console.log(`[EngineBridge] setOption: ${opt}`);
        try {
          const resp = await this.client.setOption(opt);
          if (!resp.ok) {
            console.warn(`[EngineBridge] setOption skipped: ${opt} — ${resp.message}`);
          }
        } catch (err: unknown) {
          console.error(`[EngineBridge] setOption error: ${opt} — ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      // Compile orchestra first so Csound exports control channels before
      // fixed values and automation definitions are applied through the engine.
      if (orchestra) {
        console.log(`[EngineBridge] compileOrc (${orchestra.length} chars)`);
        const resp = await this.client.compileOrc(orchestra);
        console.log(`[EngineBridge] compileOrc: ${resp.ok ? 'OK' : 'FAILED'} ${resp.message}`);
        if (!resp.ok) {
          this.mainWindow.webContents.send('playback-status', {
            status: 'error',
            message: `Orchestra compile failed: ${resp.message}`,
          });
          return false;
        }
      }

      // Send automation definitions after compileOrc so exported channels exist.
      if (parameters && parameters.length > 0) {
        await this.sendAutomationDefinitions(this.client, parameters, automationTiming);
      }

      // Read score
      if (score) {
        console.log(`[EngineBridge] readScore (${score.length} chars)`);
        const resp = await this.client.readScore(score);
        console.log(`[EngineBridge] readScore: ${resp.ok ? 'OK' : 'FAILED'} ${resp.message}`);
        if (!resp.ok) {
          this.mainWindow.webContents.send('playback-status', {
            status: 'error',
            message: `Score read failed: ${resp.message}`,
          });
          return false;
        }
      }

      // Start performance
      console.log(`[EngineBridge] start()`);
      const startResp = await this.client.start();
      console.log(`[EngineBridge] start: ${startResp.ok ? 'OK' : 'FAILED'} ${startResp.message}`);
      if (!startResp.ok) {
        this.mainWindow.webContents.send('playback-status', {
          status: 'error',
          message: `Engine start failed: ${startResp.message}`,
        });
        return false;
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

      return true;
    } finally {
      this.playbackLock = false;
    }
  }

  /**
   * Send automation definitions from all Parameters to the engine.
   * Called after compileOrc so the engine can bind them to exported channels.
   */
  private async sendAutomationDefinitions(
    client: EngineClient,
    parameters: Parameter[],
    automationTiming?: AutomationTimingContext,
  ): Promise<void> {
    // Clear any stale automation from previous playbacks
    try {
      await client.clearAutomations();
    } catch (err) {
      console.warn(`[EngineBridge] clearAutomations failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    for (const param of parameters) {
      const varName = param.getCompilationVarName();
      if (!varName) continue;

      if (param.isAutomationEnabled() && param.getPoints().length >= 2) {
        // Map AutomationCurve enum to protocol codes
        const curveCode = mapAutomationCurve(param.getCurve());

        // Java stores automation points in beat time. blue-engine currently
        // evaluates automation in elapsed seconds, so convert the point times
        // before sending them over the protocol.
        const points = getEngineAutomationPoints(
          param,
          automationTiming?.renderStartTime ?? 0,
          automationTiming?.tempoMap,
        );

        try {
          const resp = await client.createAutomation(
            varName,
            curveCode,
            true, // enabled
            param.getResolution(),
            param.getResolutionScale(),
            param.isHighPrecision(),
            points,
          );
          if (!resp.ok) {
            console.warn(`[EngineBridge] createAutomation(${varName}) failed: ${resp.message}`);
          }
        } catch (err) {
          console.warn(`[EngineBridge] createAutomation(${varName}) error: ${err instanceof Error ? err.message : String(err)}`);
        }
      } else {
        // Non-automated parameter: create/update the channel value. The engine
        // treats createChannel as a compatible "set or stage initial value"
        // command and falls back to setChannel when the channel already exists.
        try {
          const fixedVal = getRuntimeFixedChannelValue(param, automationTiming);
          const resp = await client.createChannel(varName, fixedVal);
          if (!resp.ok) {
            // Channel might already exist after orchestra export, try setChannel
            await client.setChannel(varName, fixedVal);
          }
        } catch (err) {
          console.warn(`[EngineBridge] createChannel(${varName}) error: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    console.log(`[EngineBridge] Sent ${parameters.length} parameter definitions`);
  }

  /**
   * Synchronize one automation parameter to the running engine.
   *
   * Default calls are coalesced per Csound channel to approximately 30 Hz so
   * mouse-drag automation edits do not flood the engine request socket.
   */
  async syncAutomationParameter(
    parameter: Parameter,
    automationTiming?: AutomationTimingContext,
    options: AutomationSyncOptions = {},
  ): Promise<void> {
    const client = this.client;
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
      const client = this.client;
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
      const client = this.client;
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
        parameter.getResolution(),
        parameter.getResolutionScale(),
        parameter.isHighPrecision(),
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
        parameter.getResolution(),
        parameter.getResolutionScale(),
        parameter.isHighPrecision(),
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
    if (!this.isPlaying && !this.client) {
      // Nothing to stop
      this.sendPlaybackStatus('stopped');
      return;
    }

    this.playbackLock = false; // Release lock so next playCSD can proceed
    await this.stopEngine();
  }

  /**
   * Set a channel value during playback.
   */
  async setChannel(name: string, value: number): Promise<void> {
    if (this.client) {
      const resp = await this.client.setChannel(name, value);
      if (!resp.ok) {
        console.warn(`[EngineBridge] setChannel(${name}) failed: ${resp.message}`);
      }
    }
  }

  /**
   * Get a channel value during playback.
   */
  async getChannel(name: string): Promise<number> {
    if (this.client) {
      const resp = await this.client.getChannel(name);
      if (resp.ok) return resp.value;
    }
    return 0;
  }

  getClient(): EngineClient | null {
    return this.client;
  }

  isCurrentlyPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Clean up all resources.
   */
  async dispose(): Promise<void> {
    this.playbackLock = false;
    await this.killEngine();
  }

  async killAndWait(): Promise<void> {
    this.playbackLock = false;
    await this.killEngine();
  }
}

/**
 * Parse a CSD string into its components.
 */
function parseCSD(csd: string): { orchestra: string; score: string; options: string[] } {
  const options: string[] = [];
  let orchestra = '';
  let score = '';

  // Extract CsOptions
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

  // Extract CsInstruments (orchestra)
  const orcMatch = csd.match(/<CsInstruments>([\s\S]*?)<\/CsInstruments>/);
  if (orcMatch) {
    orchestra = orcMatch[1].trim();
  }

  // Extract CsScore
  const scoMatch = csd.match(/<CsScore>([\s\S]*?)<\/CsScore>/);
  if (scoMatch) {
    score = scoMatch[1].trim();
  }

  return { orchestra, score, options };
}

/**
 * Map blue-data AutomationCurve enum to blue-engine protocol AutomationCurveCode.
 */
function mapAutomationCurve(curve: AutomationCurve): AutomationCurveCode {
  switch (curve) {
    case AutomationCurve.STEP: return AutomationCurveCode.STEP;
    case AutomationCurve.LINEAR: return AutomationCurveCode.LINEAR;
    case AutomationCurve.EXPONENTIAL: return AutomationCurveCode.EXPONENTIAL;
    default: return AutomationCurveCode.LINEAR;
  }
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
