import type { JavaScriptSession } from '@blue/data';
import type {
  ReplConsoleEvaluateResult,
  ReplConsoleEvaluationError,
} from '../shared/repl-console';

export interface JavaScriptReplProjectContext {
  projectDir: string;
  data: unknown;
  project: unknown;
}

type QuickJSContext = ReturnType<JavaScriptSession['getContext']>;
type QuickJSHandle = ReturnType<QuickJSContext['newObject']>;

interface DumpedError {
  name?: unknown;
  message?: unknown;
  stack?: unknown;
}

function formatDumpedValue(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2) ?? String(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function formatQuickJSError(value: unknown): ReplConsoleEvaluationError {
  if (value && typeof value === 'object') {
    const error = value as DumpedError;
    const message = typeof error.message === 'string'
      ? error.message
      : formatDumpedValue(value);
    return {
      message,
      ...(typeof error.name === 'string' ? { code: error.name } : {}),
      ...(typeof error.stack === 'string' ? { stack: error.stack } : {}),
    };
  }

  return { message: formatDumpedValue(value) };
}

function disposeEvalResult(context: QuickJSContext, result: { value?: QuickJSHandle; error?: QuickJSHandle }): void {
  if (result.value) {
    result.value.dispose();
  }
  if (result.error) {
    result.error.dispose();
  }
}

function setGlobalJson(context: QuickJSContext, name: string, value: unknown): void {
  const serialized = JSON.stringify(value) ?? 'null';
  const result = context.evalCode(
    `globalThis[${JSON.stringify(name)}] = ${serialized};`,
    'blue-console-bindings.js',
    { type: 'global' },
  );

  if (result.error) {
    const error = formatQuickJSError(context.dump(result.error));
    disposeEvalResult(context, result);
    throw new Error(`Unable to install ${name}: ${error.message}`);
  }

  disposeEvalResult(context, result);
}

function installConsole(
  context: QuickJSContext,
  stdout: string[],
  stderr: string[],
): void {
  const formatArguments = (args: QuickJSHandle[]): string =>
    args.map((arg) => formatDumpedValue(context.dump(arg))).join(' ');
  const writer = (target: string[], name: string) => context.newFunction(
    name,
    (...args: QuickJSHandle[]) => {
      target.push(formatArguments(args));
    },
  );

  const consoleHandle = context.newObject();
  const logHandle = writer(stdout, 'log');
  const infoHandle = writer(stdout, 'info');
  const warnHandle = writer(stderr, 'warn');
  const errorHandle = writer(stderr, 'error');
  const printHandle = writer(stdout, 'print');

  context.setProp(consoleHandle, 'log', logHandle);
  context.setProp(consoleHandle, 'info', infoHandle);
  context.setProp(consoleHandle, 'warn', warnHandle);
  context.setProp(consoleHandle, 'error', errorHandle);
  context.setProp(context.global, 'console', consoleHandle);
  context.setProp(context.global, 'print', printHandle);

  consoleHandle.dispose();
  logHandle.dispose();
  infoHandle.dispose();
  warnHandle.dispose();
  errorHandle.dispose();
  printHandle.dispose();
}

export function evaluateJavaScriptConsole(
  session: JavaScriptSession,
  request: { code: string; projectSessionId: number },
  project: JavaScriptReplProjectContext,
): ReplConsoleEvaluateResult {
  const startedAt = Date.now();
  const stdout: string[] = [];
  const stderr: string[] = [];
  const context = session.getContext();

  try {
    setGlobalJson(context, 'blueProjectDir', project.projectDir);
    setGlobalJson(context, 'blueData', project.data);
    setGlobalJson(context, 'blueProject', project.project);
    installConsole(context, stdout, stderr);

    const result = context.evalCode(request.code, 'blue-console.js', { type: 'global' });
    if (result.error) {
      const error = formatQuickJSError(context.dump(result.error));
      disposeEvalResult(context, result);
      return {
        ok: false,
        language: 'javascript',
        projectSessionId: request.projectSessionId,
        value: '',
        stdout: stdout.join('\n'),
        stderr: stderr.join('\n'),
        elapsedMs: Date.now() - startedAt,
        error,
      };
    }

    const value = formatDumpedValue(context.dump(result.value));
    disposeEvalResult(context, result);
    return {
      ok: true,
      language: 'javascript',
      projectSessionId: request.projectSessionId,
      value,
      stdout: stdout.join('\n'),
      stderr: stderr.join('\n'),
      elapsedMs: Date.now() - startedAt,
    };
  } catch (error: unknown) {
    const evaluationError = error instanceof Error ? error : new Error(String(error));
    return {
      ok: false,
      language: 'javascript',
      projectSessionId: request.projectSessionId,
      value: '',
      stdout: stdout.join('\n'),
      stderr: stderr.join('\n'),
      elapsedMs: Date.now() - startedAt,
      error: {
        message: evaluationError.message,
        ...(evaluationError.stack ? { stack: evaluationError.stack } : {}),
      },
    };
  }
}
