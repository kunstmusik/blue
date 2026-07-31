/**
 * Blue Live Manual Trigger controller (main-process owned).
 *
 * Coordinates the single-flight preparation fence for Manual Trigger:
 *   1. Resolve canonical project session ID, document revision, and Blue Live
 *      session generation.
 *   2. Reject early when no project, not running, or another job owns the
 *      single-flight slot.
 *   3. Deep-copy the canonical project (isolated, immutable-for-the-operation).
 *   4. Acquire Java/JavaScript runtime clients through injected accessors.
 *   5. Await the pure preparation service.
 *   6. Re-check both fences (document revision + session generation) before and
 *      immediately before submission.
 *   7. Submit through the isolated Blue Live engine session.
 *
 * The controller accepts injected accessors so it can be unit-tested without
 * importing main.ts internals or spawning processes.
 */
import type { BlueData } from '@blue/data';
import {
  prepareTriggerBatch,
  type JavaRuntimeClientContract,
  type JavaScriptSession,
  type TriggerRuntimeContext,
} from '@blue/data';
import type {
  LegacyBlueLiveTriggerRequest,
  LegacyBlueLiveTriggerResult,
} from '../shared/project-editor';
import {
  validateLegacyBlueLiveTriggerRequest,
} from '../shared/project-editor';
import type { BlueLiveEngineSession, BlueLiveStatusSnapshot } from './blue-live-engine';

export interface BlueLiveJavaRuntimeSession {
  ensureReady(
    data: BlueData,
    projectSessionId: number,
    currentFilePath: string | null,
  ): Promise<JavaRuntimeClientContract>;
}

export interface BlueLiveTriggerEngineSession {
  isRunning(): boolean;
  getStatus(): BlueLiveStatusSnapshot;
  submitPreparedScore(
    scoreText: string,
    expectedSessionId: number,
  ): Promise<{ ok: boolean; message?: string }>;
}

/**
 * Injected accessors the controller uses to read canonical state. Keeping
 * these as callbacks lets main.ts retain ownership of the module-level state
 * while the controller remains testable.
 */
export interface BlueLiveTriggerControllerAccessors {
  /** Returns the canonical BlueData, or null when no project is loaded. */
  getCanonicalProject(): BlueData | null;
  /** Returns the canonical project session ID. */
  getProjectSessionId(): number;
  /** Returns the canonical document revision. */
  getDocumentRevision(): number;
  /** Returns the active Blue Live engine session, or null. */
  getBlueLiveSession(): BlueLiveTriggerEngineSession | null;
  /** Returns the active JavaScript session, or null. */
  getJavaScriptSession(): JavaScriptSession | null;
  /** Returns the active Java runtime session manager, or null. */
  getJavaRuntimeSessionManager(): BlueLiveJavaRuntimeSession | null;
  /** Returns the current project file path, or null for an unsaved project. */
  getCurrentFilePath(): string | null;
}

/**
 * Controls single-flight manual-trigger preparation and submission. At most
 * one preparation job may hold the active slot; a competing request returns
 * `busy`.
 */
export class BlueLiveTriggerController {
  private inFlight = false;
  private acceptingTriggers = true;

  constructor(private readonly accessors: BlueLiveTriggerControllerAccessors) {}

  /**
   * Returns true when a preparation job is currently in flight.
   */
  isBusy(): boolean {
    return this.inFlight;
  }

  closeGate(): void {
    this.acceptingTriggers = false;
  }

  openGate(): void {
    this.acceptingTriggers = true;
  }

  /**
   * Handle a trigger request end-to-end. Validates the request, fences by
   * canonical origin, prepares on an isolated copy, re-checks fences, and
   * submits through the engine session.
   */
  async trigger(request: LegacyBlueLiveTriggerRequest): Promise<LegacyBlueLiveTriggerResult> {
    if (!this.acceptingTriggers) {
      return rejectedResult('not-running', 'Blue Live is unavailable during project replacement');
    }

    const validationCode = validateLegacyBlueLiveTriggerRequest(request);
    if (validationCode) {
      return rejectedResult(validationCode, 'Invalid trigger request');
    }

    if (this.inFlight) {
      return busyResult();
    }

    const project = this.accessors.getCanonicalProject();
    if (!project) {
      return rejectedResult('no-project', 'No project is loaded');
    }

    const session = this.accessors.getBlueLiveSession();
    if (!session || !session.isRunning()) {
      return rejectedResult('not-running', 'Blue Live is not running');
    }

    const projectSessionId = this.accessors.getProjectSessionId();
    const documentRevision = this.accessors.getDocumentRevision();
    const blueLiveSessionId = session.getStatus().sessionId;

    // Acquire the single-flight slot.
    this.inFlight = true;
    try {
      return await this.runPreparation(
        request,
        project,
        projectSessionId,
        documentRevision,
        blueLiveSessionId,
      );
    } finally {
      this.inFlight = false;
    }
  }

  private async runPreparation(
    request: LegacyBlueLiveTriggerRequest,
    project: BlueData,
    projectSessionId: number,
    documentRevision: number,
    blueLiveSessionId: number,
  ): Promise<LegacyBlueLiveTriggerResult> {
    // Deep-copy the canonical project for isolated preparation.
    const isolatedCopy = project.deepCopy() as BlueData;

    const runtime = await this.resolveRuntime(project, projectSessionId);

    const result = await prepareTriggerBatch(
      isolatedCopy,
      request.mode,
      'liveObjectId' in request ? request.liveObjectId : undefined,
      runtime,
    );

    // Fence: check document revision and session generation after preparation.
    const currentRevision = this.accessors.getDocumentRevision();
    const currentSessionId = this.accessors.getProjectSessionId();
    const currentBlueLiveSessionId = this.accessors.getBlueLiveSession()?.getStatus().sessionId ?? 0;

    if (!this.acceptingTriggers) {
      return staleResult('stale-session', currentRevision, currentBlueLiveSessionId);
    }
    if (currentSessionId !== projectSessionId || currentRevision !== documentRevision) {
      return staleResult('stale-document', currentRevision, currentBlueLiveSessionId);
    }
    if (currentBlueLiveSessionId !== blueLiveSessionId) {
      return staleResult('stale-session', currentRevision, currentBlueLiveSessionId);
    }

    if (result.kind === 'failure') {
      if (
        result.failure.code === 'invalid-request'
        || result.failure.code === 'target-not-found'
        || result.failure.code === 'invalid-tempo'
      ) {
        return rejectedResult(
          result.failure.code,
          result.failure.message,
          currentRevision,
          currentBlueLiveSessionId,
        );
      }
      return failedResult(
        result.failure.code,
        result.failure.message,
        0,
        0,
        currentRevision,
        currentBlueLiveSessionId,
      );
    }

    if (result.kind === 'empty') {
      return {
        ok: true,
        status: 'empty',
        targetCount: result.empty.targetCount,
        noteCount: 0,
        documentRevision: currentRevision,
        blueLiveSessionId: currentBlueLiveSessionId,
      };
    }

    // Final fence immediately before submission.
    if (!this.acceptingTriggers) {
      return staleResult('stale-session', currentRevision, currentBlueLiveSessionId);
    }
    const finalSession = this.accessors.getBlueLiveSession();
    if (!finalSession || !finalSession.isRunning()) {
      return rejectedResult('not-running', 'Blue Live stopped before submission');
    }
    const finalRevision = this.accessors.getDocumentRevision();
    const finalSessionId = this.accessors.getProjectSessionId();
    const finalBlueLiveSessionId = finalSession.getStatus().sessionId;
    if (finalSessionId !== projectSessionId || finalRevision !== documentRevision) {
      return staleResult('stale-document', finalRevision, finalBlueLiveSessionId);
    }
    if (finalBlueLiveSessionId !== blueLiveSessionId) {
      return staleResult('stale-session', finalRevision, finalBlueLiveSessionId);
    }

    const submission = await finalSession.submitPreparedScore(
      result.batch.scoreText,
      blueLiveSessionId,
    );

    if (!submission.ok) {
      return failedResult(
        'engine-rejected',
        submission.message ?? 'Engine rejected the prepared score',
        result.batch.targetCount,
        result.batch.noteCount,
        finalRevision,
        finalBlueLiveSessionId,
      );
    }

    return {
      ok: true,
      status: 'submitted',
      targetCount: result.batch.targetCount,
      noteCount: result.batch.noteCount,
      documentRevision: finalRevision,
      blueLiveSessionId: finalBlueLiveSessionId,
    };
  }

  /**
   * Resolve the runtime context for preparation. Acquires the Java runtime
   * client when the copied project reports it uses one, and always supplies
   * the active JavaScript session.
   */
  private async resolveRuntime(
    project: BlueData,
    projectSessionId: number,
  ): Promise<TriggerRuntimeContext> {
    const context: TriggerRuntimeContext = {};

    const jsSession = this.accessors.getJavaScriptSession();
    if (jsSession) {
      context.javaScriptSession = jsSession;
    }

    if (project.usesJavaRuntime()) {
      const manager = this.accessors.getJavaRuntimeSessionManager();
      if (manager) {
        try {
          context.javaRuntimeClient = await manager.ensureReady(
            project,
            projectSessionId,
            this.accessors.getCurrentFilePath(),
          );
        } catch {
          context.javaRuntimeClient = null;
        }
      }
    }

    return context;
  }
}

/**
 * Close the trigger admission gate and await complete engine cancellation
 * before a caller installs a replacement canonical project.
 */
export async function stopBlueLiveForProjectReplacement(
  controller: BlueLiveTriggerController,
  session: Pick<BlueLiveEngineSession, 'stop'> | null,
): Promise<void> {
  controller.closeGate();
  if (session) {
    await session.stop();
  }
}

// ─── Result constructors ───

function busyResult(): LegacyBlueLiveTriggerResult {
  return {
    ok: false,
    status: 'busy',
    code: undefined,
    message: 'A trigger is already in progress',
    targetCount: 0,
    noteCount: 0,
    documentRevision: 0,
    blueLiveSessionId: 0,
  };
}

function rejectedResult(
  code: LegacyBlueLiveTriggerResult['code'],
  message: string,
  documentRevision = 0,
  blueLiveSessionId = 0,
): LegacyBlueLiveTriggerResult {
  return {
    ok: false,
    status: 'rejected',
    code,
    message,
    targetCount: 0,
    noteCount: 0,
    documentRevision,
    blueLiveSessionId,
  };
}

function failedResult(
  code: LegacyBlueLiveTriggerResult['code'],
  message: string,
  targetCount: number,
  noteCount: number,
  documentRevision: number,
  blueLiveSessionId: number,
): LegacyBlueLiveTriggerResult {
  return {
    ok: false,
    status: 'failed',
    code,
    message,
    targetCount,
    noteCount,
    documentRevision,
    blueLiveSessionId,
  };
}

function staleResult(
  code: 'stale-document' | 'stale-session',
  documentRevision: number,
  blueLiveSessionId: number,
): LegacyBlueLiveTriggerResult {
  return {
    ok: false,
    status: 'stale',
    code,
    message: code === 'stale-document'
      ? 'The project changed before the trigger could complete'
      : 'The Blue Live session changed before the trigger could complete',
    targetCount: 0,
    noteCount: 0,
    documentRevision,
    blueLiveSessionId,
  };
}
