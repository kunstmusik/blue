export const JAVA_RUNTIME_METHODS = {
  HEALTH: 'runtime.health',
  INIT_SESSION: 'session.init',
  EVAL_CLOJURE: 'clojure.eval',
  EVAL_CLOJURE_SCORE_OBJECT: 'clojure.evalScoreObject',
  JYTHON_IMPORT_CHECK: 'jython.importCheck',
  JYTHON_EVAL_SCRIPT: 'jython.evalScript',
  JYTHON_EVAL_SCORE_OBJECT: 'jython.evalScoreObject',
  JYTHON_EVAL_OBJECT_BUILDER: 'jython.evalObjectBuilder',
  JYTHON_EVAL_INSTRUMENT: 'jython.evalInstrument',
  JYTHON_PROCESS_NOTE_LIST: 'jython.processNoteList',
  REINITIALIZE_CLOJURE: 'clojure.reinitialize',
  REINITIALIZE_JYTHON: 'jython.reinitialize',
  SHUTDOWN: 'runtime.shutdown',
} as const;

export type JavaRuntimeMethod =
  (typeof JAVA_RUNTIME_METHODS)[keyof typeof JAVA_RUNTIME_METHODS];

export interface JavaRuntimeDependencySpec {
  coordinates: string;
  version: string;
}

export interface JavaRuntimeDependencyLoadResult extends JavaRuntimeDependencySpec {
  status: 'loaded' | 'failed';
  message?: string;
}

export interface JavaRuntimeHealthResult {
  version: string;
  capabilities: string[];
  cwd: string;
  methods: string[];
}

export interface JavaRuntimeSessionInitParams extends Record<string, unknown> {
  projectSessionId: number;
  projectDir: string | null;
  clojureDependencies?: JavaRuntimeDependencySpec[];
  jythonPythonLibRoot?: string | null;
  jythonUserPythonLibRoot?: string | null;
}

export interface JavaRuntimeSessionInitResult {
  projectSessionId: number;
  clojureNamespace: string;
  dependenciesLoaded: JavaRuntimeDependencyLoadResult[];
  jythonReady?: boolean;
  jythonLibraryPaths?: string[];
}

export interface ClojureEvalParams extends Record<string, unknown> {
  code: string;
  bindings?: Record<string, unknown>;
  returnVariableName?: string | null;
}

export interface ClojureEvalResult {
  value: string;
  namespace: string;
}

export interface ClojureEvalScoreObjectParams extends Record<string, unknown> {
  code: string;
  blueDuration: number;
  blueProjectDir?: string | null;
}

export interface ClojureEvalScoreObjectResult {
  scoreText: string;
  namespace: string;
}

export interface ClojureReinitializeResult {
  clojureNamespace: string;
}

export interface JythonImportCheckParams extends Record<string, unknown> {
  modules: string[];
}

export interface JythonImportCheckResult {
  importedModules: string[];
  libraryPaths: string[];
}

export interface JythonEvalScriptParams extends Record<string, unknown> {
  code: string;
  bindings?: Record<string, unknown>;
  returnVariableName?: string | null;
}

export interface JythonEvalScriptResult {
  value: string;
}

export interface JythonEvalScoreObjectParams extends Record<string, unknown> {
  code: string;
  blueDuration: number;
  blueProjectDir?: string | null;
}

export interface JythonEvalScoreObjectResult {
  scoreText: string;
}

export interface JythonEvalObjectBuilderParams extends Record<string, unknown> {
  code: string;
  blueDuration: number;
  commandline: string;
  blueProjectDir?: string | null;
}

export interface JythonEvalObjectBuilderResult {
  scoreText: string;
}

export interface JythonEvalInstrumentParams extends Record<string, unknown> {
  code: string;
}

export interface JythonEvalInstrumentResult {
  instrumentText: string;
}

export interface JythonSerializedNote {
  pfields: string[];
  subjectiveDuration: number;
  tied: boolean;
}

export interface JythonProcessNoteListParams extends Record<string, unknown> {
  code: string;
  notes: JythonSerializedNote[];
}

export interface JythonProcessNoteListResult {
  notes: JythonSerializedNote[];
}

export interface JythonReinitializeResult {
  libraryPaths: string[];
}

export interface JavaRuntimeShutdownResult {
  accepted: boolean;
}

export interface JavaRuntimeRequestEnvelope<TParams extends Record<string, unknown>> {
  id: string;
  method: JavaRuntimeMethod;
  authToken: string;
  params: TParams;
}

export interface JavaRuntimeErrorEnvelope {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  stack?: string;
  line?: number;
  column?: number;
}

export interface JavaRuntimeSuccessResponseEnvelope<TResult> {
  id: string;
  ok: true;
  result: TResult;
  stdout: string;
  stderr: string;
  elapsedMs: number;
}

export interface JavaRuntimeFailureResponseEnvelope {
  id: string | null;
  ok: false;
  error: JavaRuntimeErrorEnvelope;
  stdout: string;
  stderr: string;
  elapsedMs: number;
}

export type JavaRuntimeResponseEnvelope<TResult> =
  | JavaRuntimeSuccessResponseEnvelope<TResult>
  | JavaRuntimeFailureResponseEnvelope;

export function createJavaRuntimeRequest<TParams extends Record<string, unknown>>(
  id: string,
  method: JavaRuntimeMethod,
  authToken: string,
  params: TParams,
): JavaRuntimeRequestEnvelope<TParams> {
  return { id, method, authToken, params };
}

export function encodeJavaRuntimeRequest<TParams extends Record<string, unknown>>(
  request: JavaRuntimeRequestEnvelope<TParams>,
): Buffer {
  return Buffer.from(JSON.stringify(request), 'utf-8');
}

export function decodeJavaRuntimeResponse<TResult>(
  raw: Buffer | string,
): JavaRuntimeResponseEnvelope<TResult> {
  const parsed = JSON.parse(Buffer.isBuffer(raw) ? raw.toString('utf-8') : raw) as
    Partial<JavaRuntimeResponseEnvelope<TResult>>;

  if (typeof parsed !== 'object' || parsed === null || typeof parsed.ok !== 'boolean') {
    throw new Error('Invalid Java runtime response payload');
  }

  if (parsed.ok) {
    if (typeof parsed.id !== 'string') {
      throw new Error('Java runtime success response is missing an id');
    }

    return {
      id: parsed.id,
      ok: true,
      result: parsed.result as TResult,
      stdout: typeof parsed.stdout === 'string' ? parsed.stdout : '',
      stderr: typeof parsed.stderr === 'string' ? parsed.stderr : '',
      elapsedMs: typeof parsed.elapsedMs === 'number' ? parsed.elapsedMs : 0,
    };
  }

  const parsedFailure = parsed as Partial<JavaRuntimeFailureResponseEnvelope>;

  if (!parsedFailure.error || typeof parsedFailure.error.code !== 'string' || typeof parsedFailure.error.message !== 'string') {
    throw new Error('Java runtime failure response is missing error details');
  }

  return {
    id: typeof parsed.id === 'string' ? parsed.id : null,
    ok: false,
    error: parsedFailure.error,
    stdout: typeof parsed.stdout === 'string' ? parsed.stdout : '',
    stderr: typeof parsed.stderr === 'string' ? parsed.stderr : '',
    elapsedMs: typeof parsed.elapsedMs === 'number' ? parsed.elapsedMs : 0,
  };
}