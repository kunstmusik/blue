import { CompileData } from './compile-data';

export interface JavaRuntimeDependencySpec {
  coordinates: string;
  version: string;
}

export interface JavaRuntimeDependencyLoadResult extends JavaRuntimeDependencySpec {
  status: 'loaded' | 'failed';
  message?: string;
}

export type JavaRuntimeStatus =
  | 'stopped'
  | 'starting'
  | 'ready'
  | 'unavailable'
  | 'error'
  | 'stopping';

export interface JavaRuntimeError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  stack?: string;
  line?: number;
  column?: number;
}

export interface JavaRuntimeResponse<T = unknown> {
  ok: boolean;
  result?: T;
  error?: JavaRuntimeError;
  stdout?: string;
  stderr?: string;
  elapsedMs?: number;
}

export interface JavaRuntimeHealthResult {
  version: string;
  capabilities?: string[];
  cwd?: string;
  methods: string[];
}

export interface JavaRuntimeSessionInitRequest {
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

export interface ClojureEvalRequest {
  code: string;
  bindings?: Record<string, unknown>;
  returnVariableName?: string | null;
}

export interface ClojureEvalResult {
  value: string;
  namespace: string;
}

export interface ClojureScoreObjectEvalRequest {
  code: string;
  blueDuration: number;
  commandline?: string;
  blueProjectDir?: string | null;
}

export interface ClojureScoreObjectEvalResult {
  scoreText: string;
  namespace: string;
}

export interface ClojureReinitializeResult {
  clojureNamespace: string;
}

export interface JythonImportCheckRequest {
  modules: string[];
}

export interface JythonImportCheckResult {
  importedModules: string[];
  libraryPaths: string[];
}

export interface JythonEvalScriptRequest {
  code: string;
  bindings?: Record<string, unknown>;
  returnVariableName?: string | null;
}

export interface JythonEvalScriptResult {
  value: string;
}

export interface JythonScoreObjectEvalRequest {
  code: string;
  blueDuration: number;
  blueProjectDir?: string | null;
}

export interface JythonScoreObjectEvalResult {
  scoreText: string;
}

export interface JythonObjectBuilderEvalRequest {
  code: string;
  blueDuration: number;
  commandline: string;
  blueProjectDir?: string | null;
}

export interface JythonObjectBuilderEvalResult {
  scoreText: string;
}

export interface JythonInstrumentEvalRequest {
  code: string;
}

export interface JythonInstrumentEvalResult {
  instrumentText: string;
}

export interface JythonSerializedNote {
  pfields: string[];
  subjectiveDuration: number;
  tied: boolean;
}

export interface JythonProcessNoteListRequest {
  code: string;
  notes: JythonSerializedNote[];
}

export interface JythonProcessNoteListResult {
  notes: JythonSerializedNote[];
}

export interface JythonReinitializeResult {
  libraryPaths: string[];
}

export interface JavaRuntimeClientContract {
  health(): Promise<JavaRuntimeResponse<JavaRuntimeHealthResult>>;
  initSession(
    request: JavaRuntimeSessionInitRequest,
  ): Promise<JavaRuntimeResponse<JavaRuntimeSessionInitResult>>;
  reinitializeClojure(): Promise<JavaRuntimeResponse<ClojureReinitializeResult>>;
  evaluateClojure(request: ClojureEvalRequest): Promise<JavaRuntimeResponse<ClojureEvalResult>>;
  evaluateClojureScoreObject(
    request: ClojureScoreObjectEvalRequest,
  ): Promise<JavaRuntimeResponse<ClojureScoreObjectEvalResult>>;
  jythonImportCheck(
    request: JythonImportCheckRequest,
  ): Promise<JavaRuntimeResponse<JythonImportCheckResult>>;
  evaluateJythonScript(
    request: JythonEvalScriptRequest,
  ): Promise<JavaRuntimeResponse<JythonEvalScriptResult>>;
  evaluateJythonScoreObject(
    request: JythonScoreObjectEvalRequest,
  ): Promise<JavaRuntimeResponse<JythonScoreObjectEvalResult>>;
  evaluateJythonObjectBuilder(
    request: JythonObjectBuilderEvalRequest,
  ): Promise<JavaRuntimeResponse<JythonObjectBuilderEvalResult>>;
  evaluateJythonInstrument(
    request: JythonInstrumentEvalRequest,
  ): Promise<JavaRuntimeResponse<JythonInstrumentEvalResult>>;
  processJythonNoteList(
    request: JythonProcessNoteListRequest,
  ): Promise<JavaRuntimeResponse<JythonProcessNoteListResult>>;
  reinitializeJython(): Promise<JavaRuntimeResponse<JythonReinitializeResult>>;
}

const JAVA_RUNTIME_CLIENT_KEY = Symbol('javaRuntimeClient');

export function setJavaRuntimeClient(
  compileData: CompileData,
  runtimeClient: JavaRuntimeClientContract | null,
): void {
  if (runtimeClient) {
    compileData.setCompilationVariable(JAVA_RUNTIME_CLIENT_KEY, runtimeClient);
    return;
  }

  compileData.clearCompilationVariable(JAVA_RUNTIME_CLIENT_KEY);
}

export function getJavaRuntimeClient(
  compileData: CompileData,
): JavaRuntimeClientContract | null {
  const runtimeClient = compileData.getCompilationVariable(JAVA_RUNTIME_CLIENT_KEY);
  return (runtimeClient as JavaRuntimeClientContract | null | undefined) ?? null;
}
