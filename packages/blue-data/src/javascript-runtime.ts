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

export class JavaScriptSession {
  private _context: QuickJSContext | null = null;

  constructor() {
    const quickJS = getQuickJSSync();
    this._context = quickJS.newContext();
  }

  getContext(): QuickJSContext {
    if (!this._context) {
      throw new Error('JavaScriptSession has been disposed');
    }
    return this._context;
  }

  reinitialize(): void {
    if (this._context) {
      this._context.dispose();
    }
    const quickJS = getQuickJSSync();
    this._context = quickJS.newContext();
  }

  dispose(): void {
    if (this._context) {
      this._context.dispose();
      this._context = null;
    }
  }

  isDisposed(): boolean {
    return this._context === null;
  }
}

export function setJavaScriptSession(compileData: CompileData, session: JavaScriptSession): void {
  compileData.setCompilationVariable(JAVASCRIPT_SESSION_KEY, session);
}

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

export async function initializeJavaScriptRuntime(): Promise<void> {
  await getQuickJS();
}

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
