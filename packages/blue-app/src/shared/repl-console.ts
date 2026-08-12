export type ReplConsoleLanguage = 'javascript' | 'python' | 'clojure';

export interface ReplConsoleProjectContext {
  loaded: boolean;
  sessionId: number;
  label: string;
  filePath: string | null;
  projectDir: string | null;
}

export type ReplConsoleRuntimeState = 'ready' | 'unavailable' | 'error';

export interface ReplConsoleOpenRequest {
  language: ReplConsoleLanguage;
}

export interface ReplConsoleOpenResult {
  ok: boolean;
  language: ReplConsoleLanguage;
  prompt: string;
  project: ReplConsoleProjectContext;
  runtime: ReplConsoleRuntimeState;
  error?: string;
}

export interface ReplConsoleEvaluateRequest {
  language: ReplConsoleLanguage;
  code: string;
}

export interface ReplConsoleEvaluationError {
  code?: string;
  message: string;
  stack?: string;
  line?: number;
  column?: number;
}

export interface ReplConsoleEvaluateResult {
  ok: boolean;
  language: ReplConsoleLanguage;
  projectSessionId: number;
  value: string;
  stdout: string;
  stderr: string;
  elapsedMs: number;
  error?: ReplConsoleEvaluationError;
}

export interface ReplConsoleReinitializeRequest {
  language: ReplConsoleLanguage;
}

export interface ReplConsoleReinitializeResult extends ReplConsoleOpenResult {
  message?: string;
}

export interface ReplConsoleCloseRequest {
  language: ReplConsoleLanguage;
}

export interface ReplConsoleCloseResult {
  ok: boolean;
}

export const REPL_CONSOLE_OPEN_CHANNEL = 'repl-console:open';
export const REPL_CONSOLE_EVALUATE_CHANNEL = 'repl-console:evaluate';
export const REPL_CONSOLE_REINITIALIZE_CHANNEL = 'repl-console:reinitialize';
export const REPL_CONSOLE_CLOSE_CHANNEL = 'repl-console:close';

export function isReplConsoleLanguage(value: unknown): value is ReplConsoleLanguage {
  return value === 'javascript' || value === 'python' || value === 'clojure';
}
