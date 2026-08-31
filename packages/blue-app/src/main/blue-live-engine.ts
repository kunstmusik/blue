import { BrowserWindow } from 'electron';
import { EngineBridge, EngineOutputCallback } from './engine-bridge';
import type { BlueData, JavaScriptSession, Parameter } from '@blue/data';
import type { CompiledBlueX7Binding, CompiledMidiInstrumentTarget } from '@blue/data';
import { LiveData, mapMidiTrigger } from '@blue/data';
import type { EngineStateSnapshot } from '@blue/engine-client';
import { formatRenderCommandLine, writeTempCsdSnapshot } from './render-command';
import { syncCompiledRuntimeParameterNames } from './runtime-parameter-sync';
import type {
  BlueLiveNoteTarget,
  BlueLiveNoteTriggerRequest,
  BlueLiveNoteTriggerResult,
} from '../shared/project-editor';
import {
  isBoundedTargetIdentity,
  isNonnegativeInteger,
} from '../shared/midi-input';
import type { EngineRuntimeService } from './engine-runtime';
import type { EngineControlTrafficObservation } from '../shared/track-instrument-editor-contract';

export type BlueLiveEngineStatus = 'idle' | 'starting' | 'running' | 'stopping' | 'stopped' | 'error';

export interface BlueLiveStatusSnapshot {
  status: BlueLiveEngineStatus;
  running: boolean;
  message?: string;
  sessionId: number;
  projectRevision?: number | null;
}

export type BlueLiveStateChangeCallback = (running: boolean) => void;

/**
 * Spec 067 — the disposable compiled target catalog owned by one Blue Live
 * session. Installed atomically only after a successful start; cleared on
 * cancellation, failure, stop, and cleanup. Resolves explicit Track/Orchestra
 * targets to their runtime instrument id without falling back.
 */
interface CompiledMidiTargetCatalog {
  liveSessionId: number;
  byTrackId: Map<string, CompiledMidiInstrumentTarget>;
  byAssignmentId: Map<string, CompiledMidiInstrumentTarget>;
}

interface PendingTerminalStateCandidate {
  snapshot: EngineStateSnapshot;
  firstSeenAt: number;
}

export interface BlueLiveEngineSessionDependencies {
  createBridge?: (
    mainWindow: BrowserWindow,
    enginePath: string,
    port: number,
    pubPort: number,
    engineRuntime: EngineRuntimeService | undefined,
  ) => EngineBridge;
  writeTempCsdSnapshot?: typeof writeTempCsdSnapshot;
  cleanupDelayMs?: number;
}

export class BlueLiveEngineSession {
  private status: BlueLiveEngineStatus = 'idle';
  private message = '';
  private sessionId = 0;
  private projectRevision: number | null = null;
  private bridge: EngineBridge | null = null;
  private mainWindow: BrowserWindow;
  private enginePath: string;
  private readonly engineRuntime: EngineRuntimeService | undefined;
  private port: number;
  private pubPort: number;
  private outputCallback: EngineOutputCallback | null = null;
  private namedInstrumentNumbers = new Map<string, number>();
  private projectDirectory: string | null = null;
  private projectData: BlueData | null = null;
  /**
   * Spec 067 compiled target catalog for the active session. `null` until a start
   * completes successfully and after cleanup; resolves focus-routing targets.
   */
  private targetCatalog: CompiledMidiTargetCatalog | null = null;
  private blueX7Bindings: readonly CompiledBlueX7Binding[] = [];
  private statePollingTimer: ReturnType<typeof setInterval> | null = null;
  private engineStateUnsubscribe: (() => void) | null = null;
  private awaitingTerminalState = false;
  private lastEngineStateSequence = 0;
  private pendingPolledTerminalState: PendingTerminalStateCandidate | null = null;
  private cleanupPromise: Promise<void> | null = null;
  private stopPromise: Promise<BlueLiveStatusSnapshot> | null = null;
  private startCompletion: Promise<void> | null = null;
  private lastDiagnosticReport: string | null = null;
  private lifecycleGeneration = 0;
  private runtimeStateChangeCallback: BlueLiveStateChangeCallback | null = null;
  private readonly dependencies: BlueLiveEngineSessionDependencies;

  constructor(
    mainWindow: BrowserWindow,
    enginePath?: string,
    port = 5560,
    pubPort = 5561,
    engineRuntime?: EngineRuntimeService,
    dependencies: BlueLiveEngineSessionDependencies = {},
  ) {
    this.mainWindow = mainWindow;
    this.enginePath = enginePath || 'blue-engine';
    this.port = port;
    this.pubPort = pubPort;
    this.engineRuntime = engineRuntime;
    this.dependencies = dependencies;
  }

  private getSnapshot(): BlueLiveStatusSnapshot {
    return {
      status: this.status,
      running: this.status === 'running',
      message: this.message || undefined,
      sessionId: this.sessionId,
      projectRevision: this.projectRevision,
    };
  }

  private setStatus(status: BlueLiveEngineStatus, message?: string): void {
    const wasRunning = this.status === 'running';
    this.status = status;
    this.message = message ?? '';
    const isRunning = this.status === 'running';
    if (wasRunning !== isRunning) {
      this.runtimeStateChangeCallback?.(isRunning);
    }
    this.mainWindow.webContents.send('blue-live-status', this.getSnapshot());
  }

  setRuntimeStateChangeCallback(cb: BlueLiveStateChangeCallback | null): void {
    this.runtimeStateChangeCallback = cb;
  }

  private isCurrentLifecycle(generation: number): boolean {
    return this.lifecycleGeneration === generation;
  }

  private async stopCancelledStart(generation: number): Promise<boolean> {
    if (this.isCurrentLifecycle(generation)) {
      return false;
    }
    await this.cleanup();
    return true;
  }

  setOutputCallback(cb: EngineOutputCallback | null): void {
    this.outputCallback = cb;
    if (this.bridge) {
      this.bridge.setOutputCallback(cb);
    }
  }

  private clearStateMonitoring(): void {
    this.awaitingTerminalState = false;
    this.lastEngineStateSequence = 0;
    this.pendingPolledTerminalState = null;

    if (this.statePollingTimer) {
      clearInterval(this.statePollingTimer);
      this.statePollingTimer = null;
    }

    if (this.engineStateUnsubscribe) {
      this.engineStateUnsubscribe();
      this.engineStateUnsubscribe = null;
    }
  }

  private startStatePolling(sessionId: number): void {
    if (this.statePollingTimer) {
      clearInterval(this.statePollingTimer);
    }

    this.statePollingTimer = setInterval(() => {
      void this.pollEngineState(sessionId);
    }, 250);
  }

  private beginTerminalStateMonitoring(): void {
    const client = this.bridge?.getClient();
    if (!client) {
      return;
    }

    this.clearStateMonitoring();
    this.awaitingTerminalState = true;
    this.engineStateUnsubscribe = client.onEngineState((snapshot) => {
      void this.handleEngineState(snapshot, 'pubsub');
    });
    this.startStatePolling(this.sessionId);
  }

  private async pollEngineState(sessionId: number): Promise<void> {
    if (sessionId !== this.sessionId || !this.awaitingTerminalState || !this.bridge) {
      return;
    }

    const client = this.bridge.getClient();
    if (!client) {
      await this.handleEngineExit('poll');
      return;
    }

    try {
      const resp = await client.getEngineState();
      if (resp.ok && resp.state) {
        await this.handleEngineState(resp.state, 'poll');
      }
    } catch (error: unknown) {
      if (sessionId === this.sessionId && this.awaitingTerminalState) {
        console.warn(`[BlueLive] getEngineState poll failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  private async handleEngineExit(source: 'poll'): Promise<void> {
    if (!this.awaitingTerminalState) {
      return;
    }

    await this.finalizeFromEngine({
      state: 'stopped',
      stopReason: 'error',
      engineCreated: false,
      running: false,
      sampleFrames: 0,
      sampleRate: 0,
      ksmps: 0,
      sequence: this.lastEngineStateSequence,
      lastError: 'Blue Live engine exited unexpectedly',
    }, source);
  }

  private async handleEngineState(snapshot: EngineStateSnapshot, source: 'pubsub' | 'poll'): Promise<void> {
    if (!this.awaitingTerminalState) {
      return;
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
      await this.finalizeFromEngine(snapshot, source);
      return;
    }

    const now = Date.now();
    if (!this.pendingPolledTerminalState ||
        this.pendingPolledTerminalState.snapshot.sequence !== snapshot.sequence) {
      this.pendingPolledTerminalState = { snapshot, firstSeenAt: now };
      return;
    }

    if (now - this.pendingPolledTerminalState.firstSeenAt >= 400) {
      await this.finalizeFromEngine(snapshot, source);
    }
  }

  private describeTerminalState(snapshot: EngineStateSnapshot, source: 'pubsub' | 'poll'): {
    status: 'stopped' | 'error';
    message: string;
  } {
    const sourceSuffix = source === 'poll' ? ' (reconciled via poll)' : '';

    switch (snapshot.stopReason) {
      case 'completed':
        return { status: 'stopped', message: `Blue Live finished${sourceSuffix}` };
      case 'stop-requested':
      case 'destroyed':
        return { status: 'stopped', message: `Blue Live stopped${sourceSuffix}` };
      case 'error':
        return {
          status: 'error',
          message: snapshot.lastError
            ? `Blue Live error: ${snapshot.lastError}${sourceSuffix}`
            : `Blue Live error${sourceSuffix}`,
        };
      case 'none':
      default:
        return { status: 'stopped', message: `Blue Live stopped${sourceSuffix}` };
    }
  }

  private async finalizeFromEngine(snapshot: EngineStateSnapshot, source: 'pubsub' | 'poll'): Promise<void> {
    if (!this.awaitingTerminalState) {
      return;
    }

    this.clearStateMonitoring();
    const { status, message } = this.describeTerminalState(snapshot, source);
    await this.cleanup();
    this.setStatus(status, message);
  }

  async start(
    data: BlueData,
    revision: number,
    projectDirectory?: string | null,
    session?: JavaScriptSession,
  ): Promise<BlueLiveStatusSnapshot> {
    if (this.status === 'starting' || this.status === 'running' || this.status === 'stopping') {
      return this.getSnapshot();
    }

    const lifecycleGeneration = ++this.lifecycleGeneration;
    this.lastDiagnosticReport = null;
    this.setStatus('starting', 'Starting Blue Live...');
    this.sessionId++;
    this.projectRevision = revision;
    this.projectDirectory = projectDirectory && projectDirectory.trim().length > 0 ? projectDirectory : null;
    this.projectData = data;

    let resolveStartCompletion = (): void => {};
    const startCompletion = new Promise<void>((resolve) => {
      resolveStartCompletion = resolve;
    });
    this.startCompletion = startCompletion;

    try {
      const liveData = data.getLiveData();
      const csd = data.toBlueLiveCSD(session);
      const runtimeParameterSync = syncCompiledRuntimeParameterNames(
        data.getArrangement(),
        data.getMixer(),
        csd.parameters,
        data.getScore(),
      );
      if (runtimeParameterSync.liveCount !== runtimeParameterSync.compiledCount) {
        console.warn(
          '[BlueLive] Runtime parameter sync count mismatch:',
          runtimeParameterSync.liveCount,
          runtimeParameterSync.compiledCount,
        );
      }
      const { orchestra, score, options } = parseCSD(csd.csdText);
      this.namedInstrumentNumbers = resolveNamedInstrumentNumbers(orchestra);
      const runtimeScore = normalizeScoreForEngineApi(score, this.namedInstrumentNumbers);

      const liveOptions = this.buildLiveOptions(liveData, options);
      const tempCsdPath = await (
        this.dependencies.writeTempCsdSnapshot ?? writeTempCsdSnapshot
      )(csd.csdText, this.projectDirectory);
      if (await this.stopCancelledStart(lifecycleGeneration)) {
        return this.getSnapshot();
      }

      this.outputCallback?.(
        formatRenderCommandLine(liveOptions, tempCsdPath, this.enginePath),
        'stdout',
      );

      const bridge = this.dependencies.createBridge
        ? this.dependencies.createBridge(
          this.mainWindow,
          this.enginePath,
          this.port,
          this.pubPort,
          this.engineRuntime,
        )
        : new EngineBridge(
          this.mainWindow,
          this.enginePath,
          this.port,
          this.pubPort,
          'blue-live',
          this.engineRuntime,
        );
      this.bridge = bridge;
      bridge.setWorkingDirectory(this.projectDirectory);

      bridge.setOutputCallback((text, type) => {
        this.outputCallback?.(text, type);
      });

      const started = await bridge.startEngine();
      if (await this.stopCancelledStart(lifecycleGeneration)) {
        return this.getSnapshot();
      }
      if (!started.ok) {
        this.setStatus('error', started.errorMessage || 'Failed to start Blue Live engine');
        await this.cleanup();
        return this.getSnapshot();
      }

      const client = bridge.getClient();
      if (!client) {
        this.setStatus('error', 'Blue Live engine client unavailable');
        await this.cleanup();
        return this.getSnapshot();
      }

      for (const opt of liveOptions) {
        try {
          await client.setOption(opt);
        } catch (err) {
          console.warn(`[BlueLive] setOption skipped: ${opt}`);
        }
        if (await this.stopCancelledStart(lifecycleGeneration)) {
          return this.getSnapshot();
        }
      }

      if (orchestra) {
        const resp = await client.compileOrc(orchestra);
        if (await this.stopCancelledStart(lifecycleGeneration)) {
          return this.getSnapshot();
        }
        if (!resp.ok) {
          this.setStatus('error', `Blue Live orchestra compile failed: ${resp.message}`);
          await this.cleanup();
          return this.getSnapshot();
        }
      }

      if (runtimeScore) {
        const resp = await client.readScore(runtimeScore);
        if (await this.stopCancelledStart(lifecycleGeneration)) {
          return this.getSnapshot();
        }
        if (!resp.ok) {
          this.setStatus('error', `Blue Live score failed: ${resp.message}`);
          await this.cleanup();
          return this.getSnapshot();
        }
      }

      const startResp = await client.start();
      if (await this.stopCancelledStart(lifecycleGeneration)) {
        return this.getSnapshot();
      }
      if (!startResp.ok) {
        this.setStatus('error', `Blue Live start failed: ${startResp.message}`);
        await this.cleanup();
        return this.getSnapshot();
      }

      // Spec 067: install the validated compiled target catalog atomically, fenced
      // by this session id, only after the engine has started successfully.
      const targetCatalog = this.buildTargetCatalog(csd.midiInstrumentTargets, this.sessionId);
      if (!targetCatalog) {
        this.setStatus('error', 'Blue Live target catalog is invalid');
        await this.cleanup();
        return this.getSnapshot();
      }
      this.targetCatalog = targetCatalog;
      this.blueX7Bindings = csd.blueX7Bindings;
      this.beginTerminalStateMonitoring();
      this.setStatus('running', 'Blue Live running');
      return this.getSnapshot();
    } catch (err) {
      if (await this.stopCancelledStart(lifecycleGeneration)) {
        return this.getSnapshot();
      }
      const msg = err instanceof Error ? err.message : String(err);
      this.setStatus('error', `Blue Live error: ${msg}`);
      await this.cleanup();
      return this.getSnapshot();
    } finally {
      resolveStartCompletion();
      if (this.startCompletion === startCompletion) {
        this.startCompletion = null;
      }
    }
  }

  async stop(): Promise<BlueLiveStatusSnapshot> {
    if (this.stopPromise) {
      return this.stopPromise;
    }

    if (this.status !== 'running' && this.status !== 'starting') {
      if (this.cleanupPromise) {
        await this.cleanupPromise;
      }
      return this.getSnapshot();
    }

    this.lifecycleGeneration += 1;
    this.setStatus('stopping', 'Stopping Blue Live...');
    const activeStartCompletion = this.startCompletion;
    const stopping = (async (): Promise<BlueLiveStatusSnapshot> => {
      this.clearStateMonitoring();
      await this.cleanup();
      if (activeStartCompletion) {
        await activeStartCompletion;
      }
      if (this.status === 'stopping') {
        this.setStatus('stopped', 'Blue Live stopped');
      }
      return this.getSnapshot();
    })();
    this.stopPromise = stopping;

    try {
      return await stopping;
    } finally {
      if (this.stopPromise === stopping) {
        this.stopPromise = null;
      }
    }
  }

  async recompile(
    data: BlueData,
    revision: number,
    projectDirectory?: string | null,
    session?: JavaScriptSession,
  ): Promise<BlueLiveStatusSnapshot> {
    await this.stop();
    return this.start(data, revision, projectDirectory ?? this.projectDirectory, session);
  }

  async sendAllNotesOff(): Promise<{ ok: boolean; message?: string }> {
    const client = this.bridge?.getClient();
    if (this.status !== 'running' || !client) {
      return { ok: false, message: 'Blue Live is not running' };
    }

    try {
      const resp = await client.readScore(this.getAllNotesOffScoreEvent());
      return { ok: resp.ok, message: resp.ok ? undefined : resp.message };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  }

  async evaluateOrchestra(text: string): Promise<{ ok: boolean; message?: string }> {
    const client = this.bridge?.getClient();
    if (this.status !== 'running' || !client) {
      return { ok: false, message: 'Blue Live is not running' };
    }

    try {
      const resp = await client.compileOrc(text);
      return { ok: resp.ok, message: resp.ok ? undefined : resp.message };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  }

  async sendScore(text: string): Promise<{ ok: boolean; message?: string }> {
    const client = this.bridge?.getClient();
    if (this.status !== 'running' || !client) {
      return { ok: false, message: 'Blue Live is not running' };
    }

    try {
      const resp = await client.readScore(
        normalizeScoreForEngineApi(text, this.namedInstrumentNumbers),
      );
      return { ok: resp.ok, message: resp.ok ? undefined : resp.message };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Submit a prepared Manual Trigger score batch, gated by the expected Blue
   * Live session generation. Rejects without an engine call when the session
   * is not running, the generation no longer matches, there is no engine
   * client, or the score text is empty. Reuses the existing score
   * normalization and `readScore` path without routing through realtime
   * playback.
   */
  async submitPreparedScore(
    scoreText: string,
    expectedSessionId: number,
  ): Promise<{ ok: boolean; message?: string }> {
    if (this.status !== 'running') {
      return { ok: false, message: 'Blue Live is not running' };
    }
    if (expectedSessionId !== this.sessionId) {
      return { ok: false, message: 'Stale Blue Live session' };
    }
    const client = this.bridge?.getClient();
    if (!client) {
      return { ok: false, message: 'Blue Live engine client is not available' };
    }
    if (!scoreText || scoreText.length === 0) {
      return { ok: false, message: 'Empty prepared score' };
    }

    try {
      const resp = await client.readScore(
        normalizeScoreForEngineApi(scoreText, this.namedInstrumentNumbers),
      );
      return { ok: resp.ok, message: resp.ok ? undefined : resp.message };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Whether the Blue Live session is in any non-idle lifecycle state
   * (`starting`, `running`, or `stopping`). Used by project replacement to
   * await full cancellation before installing a new project.
   */
  isActive(): boolean {
    return this.status === 'starting' || this.status === 'running' || this.status === 'stopping';
  }

  isRunning(): boolean {
    return this.status === 'running';
  }

  /** Last lifecycle diagnostic report from this session's engine bridge, for the Show Diagnostics action. */
  getLastDiagnosticReport(): string | null {
    return this.lastDiagnosticReport ?? this.bridge?.getLastDiagnosticReport?.() ?? null;
  }

  async setChannel(name: string, value: number): Promise<void> {
    if (this.status !== 'running' || !this.bridge) {
      return;
    }

    await this.bridge.setChannel(name, value);
  }

  async setChannels(
    entries: readonly { name: string; value: number }[],
  ): Promise<{ ok: boolean; message: string }> {
    if (this.status !== 'running' || !this.bridge) {
      return { ok: false, message: 'no-active-blue-live-session' };
    }
    return this.bridge.setChannels(entries);
  }

  async getChannels(
    names: readonly string[],
  ): Promise<{ ok: true; values: number[] } | { ok: false; message: string }> {
    if (this.status !== 'running' || !this.bridge) {
      return { ok: false, message: 'no-active-blue-live-session' };
    }
    return this.bridge.getChannels(names);
  }

  getControlTrafficSnapshot(): EngineControlTrafficObservation {
    return this.bridge?.getControlTrafficSnapshot() ?? {
      readCommands: 0,
      readEntries: 0,
      writeCommands: 0,
      writeEntries: 0,
    };
  }

  async syncAutomationParameter(
    parameter: Parameter,
    automationTiming?: Parameters<EngineBridge['syncAutomationParameter']>[1],
  ): Promise<void> {
    if (this.status !== 'running' || !this.bridge) {
      return;
    }
    await this.bridge.syncAutomationParameter(parameter, automationTiming);
  }

  async triggerNote(
    request: BlueLiveNoteTriggerRequest,
  ): Promise<BlueLiveNoteTriggerResult> {
    const client = this.bridge?.getClient();
    const projectData = this.projectData;

    if (this.status !== 'running' || !client || !projectData) {
      return { ok: false, message: 'Blue Live is not running' };
    }

    // Spec 067: resolve the target (and validate the session fence) before any
    // score submission. A stale/missing/malformed target fails closed with no
    // wrong-instrument fallback and no successful submitted score text.
    const runtimeInstrumentId = this.resolveRequestTarget(request);
    if (runtimeInstrumentId === null) {
      return { ok: false, message: 'Unresolved MIDI target' };
    }
    const scoreInstrumentId = this.resolveRuntimeInstrumentNumber(runtimeInstrumentId);
    if (scoreInstrumentId === null) {
      return { ok: false, message: 'Unresolved MIDI target' };
    }

    const mapped = mapMidiTrigger(projectData.getMidiInputProcessor(), {
      midiNote: request.midiNote,
      velocity: request.velocity,
      channel: request.channel,
    });

    const paddedNoteNum = this.getPaddedNoteNum(mapped.originalMidiNote);
    const scoreText = request.type === 'noteOff'
      ? `i-${scoreInstrumentId}.${paddedNoteNum} 0 0`
      : `i${scoreInstrumentId}.${paddedNoteNum} 0 -1 ${mapped.mappedPitchValue} ${mapped.mappedAmplitudeValue}`;

    try {
      const resp = await client.readScore(
        normalizeScoreForEngineApi(scoreText, this.namedInstrumentNumbers),
      );
      if (!resp.ok) {
        return { ok: false, message: resp.message };
      }
      return { ok: true, submittedScoreText: scoreText };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  getStatus(): BlueLiveStatusSnapshot {
    return this.getSnapshot();
  }

  getBlueX7Bindings(): readonly CompiledBlueX7Binding[] {
    return this.blueX7Bindings;
  }

  private async cleanup(): Promise<void> {
    if (this.cleanupPromise) {
      return this.cleanupPromise;
    }

    const cleanup = (async () => {
      this.clearStateMonitoring();
      this.namedInstrumentNumbers.clear();
      this.targetCatalog = null;
      this.blueX7Bindings = [];
      this.projectData = null;
      if (this.bridge) {
        const bridge = this.bridge;
        this.lastDiagnosticReport = bridge.getLastDiagnosticReport?.() ?? this.lastDiagnosticReport;
        this.bridge = null;
        await bridge.killAndWait();
      }
      const delayMs = this.dependencies.cleanupDelayMs ?? 0;
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    })().finally(() => {
      this.cleanupPromise = null;
    });

    this.cleanupPromise = cleanup;
    return cleanup;
  }

  private getAllNotesOffScoreEvent(): string {
    const instrNum = this.namedInstrumentNumbers.get('blueAllNotesOff');
    if (instrNum !== undefined) {
      return `i ${instrNum} 0 1`;
    }
    return 'i "blueAllNotesOff" 0 1';
  }

  private getPaddedNoteNum(noteNum: number): string {
    const noteStr = String(noteNum);
    let buffer = '';
    if (noteStr.length < 3) {
      buffer += '0';
    }
    if (noteStr.length < 2) {
      buffer += '1';
    }
    buffer += noteStr;
    return buffer;
  }

  /**
   * Spec 067 — build the validated compiled target catalog from the disposable
   * render snapshot. Duplicate stable identities are reported as invalid and the
   * whole catalog is rejected (returns null) so the session fail-closes rather
   * than first-match routing.
   */
  private buildTargetCatalog(
    targets: readonly CompiledMidiInstrumentTarget[],
    liveSessionId: number,
  ): CompiledMidiTargetCatalog | null {
    const catalog: CompiledMidiTargetCatalog = {
      liveSessionId,
      byTrackId: new Map(),
      byAssignmentId: new Map(),
    };
    for (const target of targets) {
      if (target.kind === 'track') {
        if (!isBoundedTargetIdentity(target.trackId)) return null;
        if (catalog.byTrackId.has(target.trackId)) return null;
        catalog.byTrackId.set(target.trackId, target);
      } else {
        if (!isBoundedTargetIdentity(target.assignmentId)) return null;
        if (catalog.byAssignmentId.has(target.assignmentId)) return null;
        catalog.byAssignmentId.set(target.assignmentId, target);
      }
    }
    return catalog;
  }

  /**
   * Spec 067 — resolve an explicit request target against the installed compiled
   * catalog. Channel targets are normalized for compatibility and resolved through
   * the preserved channel-index behavior. Returns null on any validation failure
   * (stale session, missing/malformed target, unmapped channel) so the caller
   * fail-closes without a wrong-instrument fallback.
   */
  private resolveRequestTarget(
    request: BlueLiveNoteTriggerRequest,
  ): number | string | null {
    // Validate the optional Blue Live session fence before any target lookup.
    if (request.liveSessionId !== undefined) {
      if (!isNonnegativeInteger(request.liveSessionId)) return null;
      if (request.liveSessionId !== this.sessionId) return null;
    }

    const target = request.target;
    // Omitted target normalizes to the compatibility channel target.
    const normalizedTarget: BlueLiveNoteTarget = target ?? {
      kind: 'channel',
      channel: request.channel,
    };

    if (normalizedTarget.kind === 'channel') {
      // A channel target that disagrees with the request channel is malformed.
      if (normalizedTarget.channel !== request.channel) return null;
      if (!Number.isInteger(normalizedTarget.channel) || normalizedTarget.channel < 0 || normalizedTarget.channel > 15) {
        return null;
      }
      const projectData = this.projectData;
      if (!projectData) return null;
      const catalog = this.targetCatalog;
      if (!catalog) return null;
      const arrangement = projectData.getArrangement().getArrangement();
      const assignment = arrangement[normalizedTarget.channel];
      if (!assignment?.enabled || !assignment.instr) return null;
      const compiled = catalog.byAssignmentId.get(assignment.arrangementId);
      if (!compiled) return null;
      return compiled.runtimeInstrumentId;
    }

    // Track/Orchestra targets resolve only from the installed compiled catalog.
    const catalog = this.targetCatalog;
    if (!catalog) return null;

    if (normalizedTarget.kind === 'track') {
      if (!isBoundedTargetIdentity(normalizedTarget.trackId)) return null;
      const compiled = catalog.byTrackId.get(normalizedTarget.trackId);
      if (!compiled) return null;
      return compiled.runtimeInstrumentId;
    }

    if (!isBoundedTargetIdentity(normalizedTarget.assignmentId)) return null;
    const compiled = catalog.byAssignmentId.get(normalizedTarget.assignmentId);
    if (!compiled) return null;
    return compiled.runtimeInstrumentId;
  }

  private resolveRuntimeInstrumentNumber(runtimeInstrumentId: number | string): string | null {
    if (typeof runtimeInstrumentId === 'number') {
      return Number.isInteger(runtimeInstrumentId) && runtimeInstrumentId >= 0
        ? String(runtimeInstrumentId)
        : null;
    }
    if (/^\d+$/.test(runtimeInstrumentId)) {
      return runtimeInstrumentId;
    }
    const namedNumber = this.namedInstrumentNumbers.get(runtimeInstrumentId);
    return namedNumber === undefined ? null : String(namedNumber);
  }

  private buildLiveOptions(liveData: LiveData, csdOptions: string[]): string[] {
    const options = [...csdOptions];

    if (liveData.isCommandLineEnabled()) {
      if (liveData.isCommandLineOverride()) {
        const cmdLine = liveData.getCommandLine().trim();
        if (cmdLine) {
          options.length = 0;
          options.push(...cmdLine.split(/\s+/));
        }
      } else {
        const cmdLine = liveData.getCommandLine().trim();
        if (cmdLine) {
          options.push(...cmdLine.split(/\s+/));
        }
      }
    }

    if (!options.includes('-Lstdin')) {
      options.push('-Lstdin');
    }
    if (!options.includes('--omacro:BLUE_LIVE=1')) {
      options.push('--omacro:BLUE_LIVE=1');
    }
    if (!options.includes('--smacro:BLUE_LIVE=1')) {
      options.push('--smacro:BLUE_LIVE=1');
    }

    return options;
  }
}

export function resolveNamedInstrumentNumbers(orchestra: string): Map<string, number> {
  const namedNumbers = new Map<string, number>();
  let maxNumericId = 0;
  const namedIdsInOrder: string[] = [];

  for (const line of orchestra.split('\n')) {
    const match = line.trim().match(/^instr\s+("[^"]+"|[^\s;]+)/);
    if (!match) {
      continue;
    }

    const rawId = match[1] ?? '';
    const instrId = rawId.startsWith('"') && rawId.endsWith('"')
      ? rawId.slice(1, -1)
      : rawId;

    if (/^\d+$/.test(instrId)) {
      maxNumericId = Math.max(maxNumericId, Number.parseInt(instrId, 10));
      continue;
    }

    namedIdsInOrder.push(instrId);
  }

  let nextInstrumentNumber = maxNumericId + 1;
  for (const namedId of namedIdsInOrder) {
    if (!namedNumbers.has(namedId)) {
      namedNumbers.set(namedId, nextInstrumentNumber);
      nextInstrumentNumber += 1;
    }
  }

  return namedNumbers;
}

export function normalizeScoreForEngineApi(
  score: string,
  namedInstrumentNumbers: ReadonlyMap<string, number>,
): string {
  if (namedInstrumentNumbers.size === 0 || !score.trim()) {
    return score;
  }

  return score
    .split('\n')
    .map((line) => {
      const match = line.match(/^(\s*i\s*)"([^"]+)"(\s+.*)$/);
      if (!match) {
        return line;
      }

      const instrumentName = match[2] ?? '';
      const instrumentNumber = namedInstrumentNumbers.get(instrumentName);
      if (instrumentNumber === undefined) {
        return line;
      }

      return `${match[1]}${instrumentNumber}${match[3]}`;
    })
    .join('\n');
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
