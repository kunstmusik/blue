/**
 * Blue Live trigger test harness.
 *
 * Provides controllable deferred preparation, fake Java/JavaScript runtime
 * clients, a fake canonical-project owner, and fake Blue Live engine
 * submission helpers used by the main controller, contract, and engine
 * submission tests.
 *
 * The harness is dependency-injected: the {@link BlueLiveTriggerController}
 * (and the data-layer preparation service) receive these fakes through the
 * same abstract runtime/session contracts the production code uses, so tests
 * never depend on a live engine or a spawned Java helper.
 */
import { vi } from 'vitest';
import type {
  BlueData,
  JavaRuntimeClientContract,
  JavaRuntimeResponse,
  JavaRuntimeHealthResult,
  JavaRuntimeSessionInitResult,
  ClojureReinitializeResult,
  ClojureEvalResult,
  ClojureScoreObjectEvalResult,
  JythonImportCheckResult,
  JythonEvalScriptResult,
  JythonInstrumentEvalResult,
  JythonObjectBuilderEvalResult,
  JythonProcessNoteListResult,
  JythonReinitializeResult,
  JythonScoreObjectEvalResult,
  JavaScriptSession,
} from '@blue/data';

/**
 * A deferred preparation handle. The fake preparation/generation path can be
 * paused at an await point and resolved/rejected explicitly so tests can
 * simulate stop/recompile/project-replacement during preparation.
 */
export interface DeferredPreparation {
  promise: Promise<void>;
  resolve: (value?: void) => void;
  reject: (error: Error) => void;
  isSettled: boolean;
}

export function createDeferredPreparation(): DeferredPreparation {
  const handle = {
    isSettled: false,
    resolve: (_value?: void) => {
      /* replaced below */
    },
    reject: (_error: Error) => {
      /* replaced below */
    },
    promise: Promise.resolve(),
  } as DeferredPreparation;

  handle.promise = new Promise<void>((resolve, reject) => {
    handle.resolve = (value?: void) => {
      handle.isSettled = true;
      resolve(value);
    };
    handle.reject = (error: Error) => {
      handle.isSettled = true;
      reject(error);
    };
  });

  return handle;
}

/**
 * Options controlling what score text a fake generator emits and whether it
 * should fail.
 */
export interface FakeRuntimeGenerationOptions {
  /** Score text to return for any object; overrides per-type behavior. */
  scoreText?: string;
  /** When true, throw during generation instead of returning score text. */
  failWith?: Error;
  /** Delay generation resolution by awaiting this promise if provided. */
  waitFor?: Promise<void>;
}

/**
 * A minimal fake Java runtime client whose score-object evaluators return
 * configurable score text. Each evaluator is a spy so tests can assert that
 * the trigger path reached the runtime through the injected boundary.
 */
export class FakeJavaRuntimeClient implements JavaRuntimeClientContract {
  readonly calls = {
    clojureScore: 0,
    jythonScore: 0,
    jythonObjectBuilder: 0,
    health: 0,
  };

  private options: FakeRuntimeGenerationOptions = {};

  setOptions(options: FakeRuntimeGenerationOptions): void {
    this.options = options;
  }

  private async respond<T>(value: T): Promise<JavaRuntimeResponse<T>> {
    if (this.options.waitFor) {
      await this.options.waitFor;
    }
    if (this.options.failWith) {
      throw this.options.failWith;
    }
    return { ok: true, result: value };
  }

  health(): Promise<JavaRuntimeResponse<JavaRuntimeHealthResult>> {
    this.calls.health++;
    return this.respond<JavaRuntimeHealthResult>({
      version: 'fake',
      methods: [],
    });
  }

  initSession(): Promise<JavaRuntimeResponse<JavaRuntimeSessionInitResult>> {
    return this.respond<JavaRuntimeSessionInitResult>({
      projectSessionId: 0,
      clojureNamespace: 'blue.fake',
      dependenciesLoaded: [],
    });
  }

  reinitializeClojure(): Promise<JavaRuntimeResponse<ClojureReinitializeResult>> {
    return this.respond<ClojureReinitializeResult>({ clojureNamespace: 'blue.fake' });
  }

  evaluateClojure(): Promise<JavaRuntimeResponse<ClojureEvalResult>> {
    return this.respond<ClojureEvalResult>({ value: '', namespace: 'blue.fake' });
  }

  async evaluateClojureScoreObject(): Promise<JavaRuntimeResponse<ClojureScoreObjectEvalResult>> {
    this.calls.clojureScore++;
    return this.respond<ClojureScoreObjectEvalResult>({
      scoreText: this.options.scoreText ?? 'i1 0 1 440',
      namespace: 'blue.fake',
    });
  }

  jythonImportCheck(): Promise<JavaRuntimeResponse<JythonImportCheckResult>> {
    return this.respond<JythonImportCheckResult>({ importedModules: [], libraryPaths: [] });
  }

  evaluateJythonScript(): Promise<JavaRuntimeResponse<JythonEvalScriptResult>> {
    return this.respond<JythonEvalScriptResult>({ value: '' });
  }

  async evaluateJythonScoreObject(): Promise<JavaRuntimeResponse<JythonScoreObjectEvalResult>> {
    this.calls.jythonScore++;
    return this.respond<JythonScoreObjectEvalResult>({
      scoreText: this.options.scoreText ?? 'i1 0 1 220',
    });
  }

  async evaluateJythonObjectBuilder(): Promise<JavaRuntimeResponse<JythonObjectBuilderEvalResult>> {
    this.calls.jythonObjectBuilder++;
    return this.respond<JythonObjectBuilderEvalResult>({
      scoreText: this.options.scoreText ?? 'i1 0 1 330',
    });
  }

  evaluateJythonInstrument(): Promise<JavaRuntimeResponse<JythonInstrumentEvalResult>> {
    return this.respond<JythonInstrumentEvalResult>({ instrumentText: '' });
  }

  processJythonNoteList(): Promise<JavaRuntimeResponse<JythonProcessNoteListResult>> {
    return this.respond<JythonProcessNoteListResult>({ notes: [] });
  }

  reinitializeJython(): Promise<JavaRuntimeResponse<JythonReinitializeResult>> {
    return this.respond<JythonReinitializeResult>({ libraryPaths: [] });
  }
}

/**
 * A fake Java runtime client whose every method rejects, used to simulate an
 * unavailable runtime without depending on a specific transport error.
 */
export class UnavailableJavaRuntimeClient implements JavaRuntimeClientContract {
  private async fail<T>(): Promise<JavaRuntimeResponse<T>> {
    throw new Error('Java runtime unavailable (fake)');
  }
  health = this.fail;
  initSession = this.fail;
  reinitializeClojure = this.fail;
  evaluateClojure = this.fail;
  evaluateClojureScoreObject = this.fail;
  jythonImportCheck = this.fail;
  evaluateJythonScript = this.fail;
  evaluateJythonScoreObject = this.fail;
  evaluateJythonObjectBuilder = this.fail;
  evaluateJythonInstrument = this.fail;
  processJythonNoteList = this.fail;
  reinitializeJython = this.fail;
}

/**
 * A fake JavaScript session that records generation. The real QuickJS-backed
 * session is heavyweight; tests only need a stand-in that satisfies the
 * `instanceof JavaScriptSession` check used by the data layer's session
 * lookup. We expose a typed spy surface instead.
 */
export class FakeJavaScriptSession {
  readonly evaluate = vi.fn(async (_code: string): Promise<string> => {
    return 'i1 0 1 220';
  });
}

/**
 * A fake canonical-project owner that mirrors the small slice of main-process
 * state the trigger controller reads: project session ID, document revision,
 * and the active `BlueData`.
 */
export interface FakeCanonicalProject {
  sessionId: number;
  revision: number;
  data: BlueData | null;
  /** Bump the document revision as if a canonical edit landed. */
  advanceRevision(): number;
  /** Replace the canonical project data entirely. */
  replaceData(data: BlueData | null): void;
}

export function createFakeCanonicalProject(
  data: BlueData | null,
  sessionId = 1,
): FakeCanonicalProject {
  const state = { sessionId, revision: 0, data };
  return {
    get sessionId() {
      return state.sessionId;
    },
    get revision() {
      return state.revision;
    },
    get data() {
      return state.data;
    },
    advanceRevision(): number {
      state.revision += 1;
      return state.revision;
    },
    replaceData(replacement: BlueData | null): void {
      state.data = replacement;
      state.sessionId += 1;
      state.revision = 0;
    },
  };
}

/**
 * Result of a fake engine score submission.
 */
export interface FakeEngineSubmission {
  scoreText: string;
  sessionId: number;
  submittedAt: number;
}

/**
 * A fake Blue Live engine submission boundary that records every accepted
 * score batch and exposes a configurable running/session state. This stands
 * in for {@link BlueLiveEngineSession} during controller tests.
 */
export class FakeBlueLiveEngine {
  status: 'idle' | 'starting' | 'running' | 'stopping' | 'stopped' | 'error' = 'idle';
  sessionId = 0;
  readonly submissions: FakeEngineSubmission[] = [];
  /** When set, submitPreparedScore rejects with this error. */
  rejectSubmitWith: Error | null = null;
  /** When set, submitPreparedScore returns this ok flag instead of true. */
  submitOk = true;

  isRunning(): boolean {
    return this.status === 'running';
  }

  isActive(): boolean {
    return this.status === 'starting' || this.status === 'running' || this.status === 'stopping';
  }

  getStatus() {
    return {
      status: this.status,
      running: this.status === 'running',
      sessionId: this.sessionId,
      projectRevision: null as number | null,
    };
  }

  /** Simulate a successful start, bumping the session generation. */
  start(): void {
    this.sessionId += 1;
    this.status = 'running';
  }

  /** Simulate stop moving to a terminal state. */
  stop(): void {
    this.status = 'stopped';
  }

  /** Simulate recompile bumping the session generation while staying running. */
  recompile(): void {
    this.sessionId += 1;
    this.status = 'running';
  }

  /** Reset the fake to its initial idle state, clearing recorded submissions. */
  reset(): void {
    this.status = 'idle';
    this.sessionId = 0;
    this.submissions.length = 0;
    this.rejectSubmitWith = null;
    this.submitOk = true;
  }

  submitPreparedScore(
    scoreText: string,
    expectedSessionId: number,
  ): Promise<{ ok: boolean; message?: string }> {
    if (this.rejectSubmitWith) {
      return Promise.reject(this.rejectSubmitWith);
    }
    if (!this.isRunning()) {
      return Promise.resolve({ ok: false, message: 'Blue Live is not running' });
    }
    if (expectedSessionId !== this.sessionId) {
      return Promise.resolve({ ok: false, message: 'Stale Blue Live session' });
    }
    this.submissions.push({
      scoreText,
      sessionId: this.sessionId,
      submittedAt: Date.now(),
    });
    return Promise.resolve({ ok: this.submitOk });
  }
}

/**
 * A bundle of all the fakes a trigger controller test needs.
 */
export interface BlueLiveTriggerHarness {
  canonicalProject: FakeCanonicalProject;
  engine: FakeBlueLiveEngine;
  javaRuntime: FakeJavaRuntimeClient;
  javaScriptSession: FakeJavaScriptSession;
  /** Reset every fake to its initial state. */
  reset(): void;
}

export function createBlueLiveTriggerHarness(data: BlueData | null): BlueLiveTriggerHarness {
  return {
    canonicalProject: createFakeCanonicalProject(data),
    engine: new FakeBlueLiveEngine(),
    javaRuntime: new FakeJavaRuntimeClient(),
    javaScriptSession: new FakeJavaScriptSession(),
    reset(): void {
      this.engine.reset();
      this.javaRuntime.setOptions({});
    },
  };
}

/**
 * Helper to satisfy the TypeScript `JavaScriptSession` type for data-layer
 * injection without instantiating the real QuickJS-backed session. Casts the
 * fake through `unknown` because the real class performs QuickJS work in its
 * constructor that is unnecessary and slow for trigger tests.
 */
export function asJavaScriptSession(fake: FakeJavaScriptSession): JavaScriptSession {
  return fake as unknown as JavaScriptSession;
}
