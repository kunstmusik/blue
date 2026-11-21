import { getQuickJS, getQuickJSSync } from 'quickjs-emscripten';
import type { QuickJSContext } from 'quickjs-emscripten';
import { CompileData } from './compile-data';

const JAVASCRIPT_COMPILE_STATE_KEY = '__blue_javascript_runtime_context__';
const JAVASCRIPT_SESSION_KEY = '__blue_javascript_session__';
const JAVASCRIPT_RUNTIME_INIT_MESSAGE =
  'QuickJS is not initialized. Await initializeJavaScriptRuntime() before generating score from JavaScriptObject.';

type JavaScriptCompileState = {
  context: QuickJSContext;
};

/** Owns a reusable QuickJS context so related on-load and compilation scripts can share definitions. */
export class JavaScriptSession {
  private _context: QuickJSContext | null = null;

  /** Creates a session after {@link initializeJavaScriptRuntime} has resolved. */
  constructor() {
    const quickJS = getQuickJSSync();
    this._context = quickJS.newContext();
  }

  /** Returns the borrowed context. The session owns its disposal and throws if it has been disposed. */
  getContext(): QuickJSContext {
    if (!this._context) {
      throw new Error('JavaScriptSession has been disposed');
    }
    return this._context;
  }

  /** Replaces the context with an empty one, discarding definitions and invalidating previous handles. */
  reinitialize(): void {
    if (this._context) {
      this._context.dispose();
    }
    const quickJS = getQuickJSSync();
    this._context = quickJS.newContext();
  }

  /** Releases the current context. Repeated calls are safe. */
  dispose(): void {
    if (this._context) {
      this._context.dispose();
      this._context = null;
    }
  }

  /** Reports whether this session currently has no context. */
  isDisposed(): boolean {
    return this._context === null;
  }
}

/** Supplies a caller-owned QuickJS session for a compilation. */
export function setJavaScriptSession(compileData: CompileData, session: JavaScriptSession): void {
  compileData.setCompilationVariable(JAVASCRIPT_SESSION_KEY, session);
}

/** Returns the caller-owned session attached to a compilation, if one was supplied. */
export function getJavaScriptSession(compileData: CompileData): JavaScriptSession | undefined {
  const val = compileData.getCompilationVariable(JAVASCRIPT_SESSION_KEY);
  return val instanceof JavaScriptSession ? val : undefined;
}

function getStoredCompileState(compileData: CompileData): JavaScriptCompileState | undefined {
  const state = compileData.getCompilationVariable(JAVASCRIPT_COMPILE_STATE_KEY);

  if (
    state &&
    typeof state === 'object' &&
    'context' in state &&
    state.context !== null &&
    typeof state.context === 'object'
  ) {
    return state as JavaScriptCompileState;
  }

  return undefined;
}

/** Loads QuickJS before the first script-backed operation. Await this before constructing a session. */
export async function initializeJavaScriptRuntime(): Promise<void> {
  await getQuickJS();
}

/** Tests whether QuickJS is available for synchronous use without starting initialization. */
export function isJavaScriptRuntimeInitialized(): boolean {
  try {
    getQuickJSSync();
    return true;
  } catch {
    return false;
  }
}

export function getJavaScriptCompileContext(compileData: CompileData): QuickJSContext {
  const session = getJavaScriptSession(compileData);
  if (session) {
    return session.getContext();
  }

  const existing = getStoredCompileState(compileData);
  if (existing) {
    return existing.context;
  }

  let quickJS;
  try {
    quickJS = getQuickJSSync();
  } catch {
    throw new Error(JAVASCRIPT_RUNTIME_INIT_MESSAGE);
  }

  const state: JavaScriptCompileState = {
    context: quickJS.newContext(),
  };
  compileData.setCompilationVariable(JAVASCRIPT_COMPILE_STATE_KEY, state);
  return state.context;
}

/** Releases the implicit QuickJS context for a compilation. A caller-supplied session is left to its owner. */
export function disposeJavaScriptCompileState(compileData: CompileData): void {
  const session = getJavaScriptSession(compileData);
  if (session) {
    return;
  }

  const existing = getStoredCompileState(compileData);
  if (!existing) {
    return;
  }

  compileData.clearCompilationVariable(JAVASCRIPT_COMPILE_STATE_KEY);
  existing.context.dispose();
}
