import { CompileData } from './compile-data';

/** A project-declared Clojure dependency, identified by its coordinates and version. */
export interface JavaRuntimeDependencySpec {
  /** Dependency coordinates as declared by the Clojure project. */
  coordinates: string;
  /** Version of the declared dependency to load. */
  version: string;
}

/** The runtime’s loading outcome for one project-declared dependency. */
export interface JavaRuntimeDependencyLoadResult extends JavaRuntimeDependencySpec {
  /** Reports whether this dependency loaded successfully. */
  status: 'loaded' | 'failed';
  /** Optional explanation from the helper about this dependency. */
  message?: string;
}

/** Lifecycle states reported by a host that manages the Java helper. */
export type JavaRuntimeStatus =
  | 'stopped'
  | 'starting'
  | 'ready'
  | 'unavailable'
  | 'error'
  | 'stopping';

/** Structured diagnostic from the Java runtime. Source coordinates are supplied when available. */
export interface JavaRuntimeError {
  /** Machine-readable error code returned by the helper. */
  code: string;
  /** Human-readable error description. */
  message: string;
  /** Optional operation-specific diagnostic values. */
  details?: Record<string, unknown>;
  /** Stack trace from the runtime when supplied. */
  stack?: string;
  /** Source line reported by the runtime, when available. */
  line?: number;
  /** Source column reported by the runtime, when available. */
  column?: number;
}

/** Result of one host runtime request, optionally including captured output, timing, or an error. */
export interface JavaRuntimeResponse<T = unknown> {
  /** Reports whether the helper completed the requested operation. */
  ok: boolean;
  /** Operation-specific result on success when supplied. */
  result?: T;
  /** Structured failure information from the helper when supplied. */
  error?: JavaRuntimeError;
  /** Captured standard output when supplied. */
  stdout?: string;
  /** Captured standard error when supplied. */
  stderr?: string;
  /** Reported operation duration in milliseconds. */
  elapsedMs?: number;
}

/** The helper’s version and callable methods, with optional capabilities and working directory. */
export interface JavaRuntimeHealthResult {
  /** Helper version reported by the runtime. */
  version: string;
  /** Optional capability identifiers advertised by the helper. */
  capabilities?: string[];
  /** Helper's reported working directory. */
  cwd?: string;
  /** Operation names supported by the helper. */
  methods: string[];
}

/** Project identity, working directory, and dependency or library paths for a new runtime session. */
export interface JavaRuntimeSessionInitRequest {
  /** Host-assigned identifier for the project session to initialize. */
  projectSessionId: number;
  /** Native project directory, or `null` for a project without a directory. */
  projectDir: string | null;
  /** Clojure dependencies declared by this project. */
  clojureDependencies?: JavaRuntimeDependencySpec[];
  /** Native path to the bundled Python libraries, when provided. */
  jythonPythonLibRoot?: string | null;
  /** Native path to additional user Python libraries, when provided. */
  jythonUserPythonLibRoot?: string | null;
}

/** The initialized session identity and environment, including dependency load results. */
export interface JavaRuntimeSessionInitResult {
  /** Identifier of the project session the helper initialized. */
  projectSessionId: number;
  /** Active Clojure namespace for the initialized session. */
  clojureNamespace: string;
  /** Loading results for the requested Clojure dependencies. */
  dependenciesLoaded: JavaRuntimeDependencyLoadResult[];
  /** Reports whether Jython initialized, when the helper reports its state. */
  jythonReady?: boolean;
  /** Python library paths active in this session, when reported. */
  jythonLibraryPaths?: string[];
}

/** Clojure code with optional bindings and a named result to retrieve. */
export interface ClojureEvalRequest {
  /** Clojure source to evaluate in the project session. */
  code: string;
  /** Values to make available to the evaluated source. */
  bindings?: Record<string, unknown>;
  /** Name of a binding to retrieve as the result, if requested. */
  returnVariableName?: string | null;
}

/** Text representation of a Clojure evaluation result and the namespace used. */
export interface ClojureEvalResult {
  /** Text representation of the returned Clojure value. */
  value: string;
  /** Namespace in which the helper evaluated the source. */
  namespace: string;
}

/** Clojure score-generator input, including the object duration and optional project context. */
export interface ClojureScoreObjectEvalRequest {
  /** Clojure source for the score object. */
  code: string;
  /** Object duration in Csound beats, exposed to the script as `blueDuration`. */
  blueDuration: number;
  /** Optional ObjectBuilder command line supplied to the script. */
  commandline?: string;
  /** Native project directory exposed to the script, if available. */
  blueProjectDir?: string | null;
}

/** Generated Csound score text and the namespace used by a Clojure sound object. */
export interface ClojureScoreObjectEvalResult {
  /** Csound score text produced by the generator. */
  scoreText: string;
  /** Namespace in which the helper evaluated the object. */
  namespace: string;
}

/** Namespace reported after resetting the Clojure evaluator. */
export interface ClojureReinitializeResult {
  /** Active Clojure namespace after reset. */
  clojureNamespace: string;
}

/** Python module names to resolve in the current Jython session. */
export interface JythonImportCheckRequest {
  /** Python module names to import in the current environment. */
  modules: string[];
}

/** Imported modules and the Jython library paths used to resolve them. */
export interface JythonImportCheckResult {
  /** Names of the requested modules the helper imported. */
  importedModules: string[];
  /** Active library search paths reported by Jython. */
  libraryPaths: string[];
}

/** Jython code with optional bindings and a named result to retrieve. */
export interface JythonEvalScriptRequest {
  /** Python source to evaluate in the project session. */
  code: string;
  /** Values to make available to the Python source. */
  bindings?: Record<string, unknown>;
  /** Name of a Python variable to retrieve as the result, if requested. */
  returnVariableName?: string | null;
}

/** Text representation of a Jython evaluation result. */
export interface JythonEvalScriptResult {
  /** Text representation of the returned Python value. */
  value: string;
}

/** Python sound-object code, its duration, and the optional project directory. */
export interface JythonScoreObjectEvalRequest {
  /** Python source for the score object. */
  code: string;
  /** Object duration in Csound beats, exposed to the script as `blueDuration`. */
  blueDuration: number;
  /** Native project directory exposed to the script, if available. */
  blueProjectDir?: string | null;
}

/** Csound score text generated by a Python sound object. */
export interface JythonScoreObjectEvalResult {
  /** Csound score text emitted by the Python score object. */
  scoreText: string;
}

/** Python ObjectBuilder code and its duration, command line, and optional project directory. */
export interface JythonObjectBuilderEvalRequest {
  /** Python source for the ObjectBuilder. */
  code: string;
  /** Object duration in Csound beats, exposed to the script as `blueDuration`. */
  blueDuration: number;
  /** Command line text made available to the ObjectBuilder script. */
  commandline: string;
  /** Native project directory exposed to the script, if available. */
  blueProjectDir?: string | null;
}

/** Csound score text generated by a Python ObjectBuilder. */
export interface JythonObjectBuilderEvalResult {
  /** Csound score text emitted by the Python ObjectBuilder. */
  scoreText: string;
}

/** Python code evaluated to produce a Csound instrument body. */
export interface JythonInstrumentEvalRequest {
  /** Python source for the instrument generator. */
  code: string;
}

/** Csound instrument body emitted by a Python instrument. */
export interface JythonInstrumentEvalResult {
  /** Generated Csound code for the body of the instrument. */
  instrumentText: string;
}

/** Transport form of a Csound note used when invoking a Python note processor. */
export interface JythonSerializedNote {
  /** Ordered Csound p-fields as text. */
  pfields: string[];
  /** Note duration in Csound beats. */
  subjectiveDuration: number;
  /** Indicates that the note's duration carries Csound tie semantics. */
  tied: boolean;
  /** Opaque render-only identity; never exposed on the Python note adapter. */
  renderMetadataId?: string;
}

/** Python note-processor code and its input note list. */
export interface JythonProcessNoteListRequest {
  /** Python source for the note processor. */
  code: string;
  /** Serialized notes supplied to the processor in input order. */
  notes: JythonSerializedNote[];
}

/** Output note list returned by a Python note processor. */
export interface JythonProcessNoteListResult {
  /** Serialized notes returned by the processor in output order. */
  notes: JythonSerializedNote[];
}

/** Active Python library paths after resetting the Jython evaluator. */
export interface JythonReinitializeResult {
  /** Library search paths active after resetting Jython. */
  libraryPaths: string[];
}

/** Host-provided operations for project-scoped Clojure and Jython execution. The host owns the helper process and session lifetime. */
export interface JavaRuntimeClientContract {
  /** Queries the helper’s version and supported operations. */
  health(): Promise<JavaRuntimeResponse<JavaRuntimeHealthResult>>;
  /** Initializes the runtime environment for a project, including its dependencies and library paths. */
  initSession(
    request: JavaRuntimeSessionInitRequest,
  ): Promise<JavaRuntimeResponse<JavaRuntimeSessionInitResult>>;
  /** Resets the Clojure evaluator and reports the active namespace. */
  reinitializeClojure(): Promise<JavaRuntimeResponse<ClojureReinitializeResult>>;
  /** Evaluates Clojure code with optional caller-supplied bindings. */
  evaluateClojure(request: ClojureEvalRequest): Promise<JavaRuntimeResponse<ClojureEvalResult>>;
  /** Evaluates a Clojure sound object to produce Csound score text. */
  evaluateClojureScoreObject(
    request: ClojureScoreObjectEvalRequest,
  ): Promise<JavaRuntimeResponse<ClojureScoreObjectEvalResult>>;
  /** Checks Python imports in the current Jython environment. */
  jythonImportCheck(
    request: JythonImportCheckRequest,
  ): Promise<JavaRuntimeResponse<JythonImportCheckResult>>;
  /** Evaluates standalone Jython code with optional bindings. */
  evaluateJythonScript(
    request: JythonEvalScriptRequest,
  ): Promise<JavaRuntimeResponse<JythonEvalScriptResult>>;
  /** Evaluates a Python sound object to produce Csound score text. */
  evaluateJythonScoreObject(
    request: JythonScoreObjectEvalRequest,
  ): Promise<JavaRuntimeResponse<JythonScoreObjectEvalResult>>;
  /** Evaluates the Python code in an ObjectBuilder. */
  evaluateJythonObjectBuilder(
    request: JythonObjectBuilderEvalRequest,
  ): Promise<JavaRuntimeResponse<JythonObjectBuilderEvalResult>>;
  /** Evaluates a Python instrument to produce its Csound body. */
  evaluateJythonInstrument(
    request: JythonInstrumentEvalRequest,
  ): Promise<JavaRuntimeResponse<JythonInstrumentEvalResult>>;
  /** Applies a Python note processor to a serialized Csound note list. */
  processJythonNoteList(
    request: JythonProcessNoteListRequest,
  ): Promise<JavaRuntimeResponse<JythonProcessNoteListResult>>;
  /** Resets the Jython evaluator and reports the active library paths. */
  reinitializeJython(): Promise<JavaRuntimeResponse<JythonReinitializeResult>>;
}

const JAVA_RUNTIME_CLIENT_KEY = Symbol('javaRuntimeClient');

/** Attaches a host-owned Java runtime client to a compilation. Pass `null` to clear it. */
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

/** Returns the Java runtime client attached to a compilation, or `null` when none was supplied. */
export function getJavaRuntimeClient(compileData: CompileData): JavaRuntimeClientContract | null {
  const runtimeClient = compileData.getCompilationVariable(JAVA_RUNTIME_CLIENT_KEY);
  return (runtimeClient as JavaRuntimeClientContract | null | undefined) ?? null;
}
