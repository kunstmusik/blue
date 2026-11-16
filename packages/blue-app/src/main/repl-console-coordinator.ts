import * as path from 'node:path';
import type { BlueData, JavaScriptSession } from '@blue/data';
import type { JavaRuntimeClient } from './java-runtime/java-runtime-client';
import type { JavaRuntimeSessionManager } from './java-runtime/java-runtime-session';
import { evaluateJavaScriptConsole } from './repl-console-runtime';
import {
  isReplConsoleLanguage,
  type ReplConsoleEvaluateRequest,
  type ReplConsoleEvaluateResult,
  type ReplConsoleLanguage,
  type ReplConsoleOpenResult,
  type ReplConsoleProjectContext,
  type ReplConsoleReinitializeRequest,
  type ReplConsoleReinitializeResult,
} from '../shared/repl-console';
import type { ScriptRuntimeReinitializeResult } from '../shared/script-runtime';

const REPL_CONSOLE_PROMPTS: Record<ReplConsoleLanguage, string> = {
  javascript: 'js> ',
  python: '>>> ',
  clojure: 'user=> ',
};

// Interactive JVM evaluations can legitimately spend longer than the short
// transport deadline used by score-object/runtime requests, especially while
// a project dependency or a user expression is being compiled.
const REPL_CONSOLE_EVALUATION_TIMEOUT_MS = 30_000;

export interface ReplConsoleCoordinatorDeps {
  getCurrentData: () => BlueData | null;
  getCurrentFilePath: () => string | null;
  getCurrentProjectSessionId: () => number;
  ensureJavaScriptSession: () => Promise<JavaScriptSession>;
  getJavaRuntimeSessionManager: () => JavaRuntimeSessionManager | null;
  invalidateProjectOnLoadCache: () => void;
  runProjectOnLoad: (data: BlueData) => Promise<JavaRuntimeClient | null>;
}

export interface ReplConsoleCoordinator {
  createReplOpenResult: (
    language: ReplConsoleLanguage,
    runtime: ReplConsoleOpenResult['runtime'],
    error?: string,
  ) => ReplConsoleOpenResult;
  openReplConsole: (language: ReplConsoleLanguage) => Promise<ReplConsoleOpenResult>;
  evaluateReplConsole: (request: ReplConsoleEvaluateRequest) => Promise<ReplConsoleEvaluateResult>;
  reinitializeReplConsole: (
    request: ReplConsoleReinitializeRequest,
  ) => Promise<ReplConsoleReinitializeResult>;
  reinitializeJavaScriptRuntime: () => Promise<ScriptRuntimeReinitializeResult>;
  reinitializeJythonRuntime: () => Promise<ScriptRuntimeReinitializeResult>;
}

function getReplProjectLabel(data: BlueData | null, filePath: string | null): string {
  if (data) {
    const title = data.getProjectProperties().title?.trim();
    if (title) return title;
  }

  return filePath ? path.basename(filePath) : data ? 'Untitled' : 'No Project';
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createReplConsoleCoordinator(
  deps: ReplConsoleCoordinatorDeps,
): ReplConsoleCoordinator {
  let replRuntimeQueue: Promise<unknown> = Promise.resolve();

  function enqueueReplRuntime<T>(operation: () => Promise<T>): Promise<T> {
    const next = replRuntimeQueue.then(operation, operation);
    replRuntimeQueue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  function createReplProjectContext(): ReplConsoleProjectContext {
    const data = deps.getCurrentData();
    const filePath = deps.getCurrentFilePath();
    return {
      loaded: data !== null,
      sessionId: deps.getCurrentProjectSessionId(),
      label: getReplProjectLabel(data, filePath),
      filePath,
      projectDir: filePath ? path.dirname(filePath) : null,
    };
  }

  function createReplProjectDataSnapshot(): Record<string, unknown> | null {
    const data = deps.getCurrentData();
    if (!data) return null;

    const filePath = deps.getCurrentFilePath();
    const properties = data.getProjectProperties();
    const globalOrcSco = data.getGlobalOrcSco();
    return {
      sessionId: deps.getCurrentProjectSessionId(),
      filePath,
      projectDir: filePath ? path.dirname(filePath) : null,
      projectProperties: {
        title: properties.title,
        author: properties.author,
        notes: properties.notes,
        sampleRate: properties.sampleRate,
        ksmps: properties.ksmps,
        nchnls: properties.nchnls,
        useZeroDbFS: properties.useZeroDbFS,
        zeroDbFS: properties.zeroDbFS,
        diskSampleRate: properties.diskSampleRate,
        diskKsmps: properties.diskKsmps,
      },
      globalOrc: globalOrcSco.getGlobalOrc(),
      globalSco: globalOrcSco.getGlobalSco(),
      tablesText: data.getTableSet().getTables(),
      scratchPad: {
        text: data.getScratchPadData().getScratchText(),
        wordWrapEnabled: data.getScratchPadData().isWordWrapEnabled(),
      },
    };
  }

  function createReplRuntimeContext(): {
    project: ReplConsoleProjectContext;
    projectDir: string;
    data: Record<string, unknown> | null;
  } {
    const project = createReplProjectContext();
    return {
      project,
      projectDir: project.projectDir ? `${project.projectDir}${path.sep}` : '',
      data: createReplProjectDataSnapshot(),
    };
  }

  function createReplOpenResult(
    language: ReplConsoleLanguage,
    runtime: ReplConsoleOpenResult['runtime'],
    error?: string,
  ): ReplConsoleOpenResult {
    return {
      ok: runtime === 'ready',
      language,
      prompt: REPL_CONSOLE_PROMPTS[language],
      project: createReplProjectContext(),
      runtime,
      ...(error ? { error } : {}),
    };
  }

  async function reinitializeJavaScriptRuntimeNow(): Promise<void> {
    const session = await deps.ensureJavaScriptSession();
    session.reinitialize();
  }

  async function reinitializeJythonRuntimeNow(): Promise<void> {
    const data = deps.getCurrentData();
    if (!data) {
      throw new Error('No project loaded.');
    }
    if (!data.usesJavaRuntime()) {
      throw new Error('Active project does not use the Java runtime.');
    }
    const javaRuntimeSessionManager = deps.getJavaRuntimeSessionManager();
    if (!javaRuntimeSessionManager) {
      throw new Error('Java runtime manager is unavailable.');
    }

    await javaRuntimeSessionManager.reinitializeJython(
      data,
      deps.getCurrentProjectSessionId(),
      deps.getCurrentFilePath(),
    );
  }

  async function ensureJavaRuntimeConsoleSession(): Promise<JavaRuntimeClient> {
    const data = deps.getCurrentData();
    if (!data) {
      throw new Error('No project loaded.');
    }
    const javaRuntimeSessionManager = deps.getJavaRuntimeSessionManager();
    if (!javaRuntimeSessionManager) {
      throw new Error('Java runtime is unavailable.');
    }

    return javaRuntimeSessionManager.ensureReady(
      data,
      deps.getCurrentProjectSessionId(),
      deps.getCurrentFilePath(),
    );
  }

  async function openReplConsoleNow(language: ReplConsoleLanguage): Promise<ReplConsoleOpenResult> {
    try {
      if (language === 'javascript') {
        await deps.ensureJavaScriptSession();
      } else {
        await ensureJavaRuntimeConsoleSession();
      }
      return createReplOpenResult(language, 'ready');
    } catch (error: unknown) {
      return createReplOpenResult(
        language,
        deps.getCurrentData() ? 'error' : 'unavailable',
        getErrorMessage(error),
      );
    }
  }

  function createReplEvaluationFailure(
    language: ReplConsoleLanguage,
    message: string,
    projectSessionId = deps.getCurrentProjectSessionId(),
  ): ReplConsoleEvaluateResult {
    return {
      ok: false,
      language,
      projectSessionId,
      value: '',
      stdout: '',
      stderr: '',
      elapsedMs: 0,
      error: { message },
    };
  }

  async function evaluateReplConsoleNow(
    language: ReplConsoleLanguage,
    code: string,
  ): Promise<ReplConsoleEvaluateResult> {
    const runtimeContext = createReplRuntimeContext();
    if (language === 'javascript') {
      const session = await deps.ensureJavaScriptSession();
      return evaluateJavaScriptConsole(
        session,
        { code, projectSessionId: runtimeContext.project.sessionId },
        {
          projectDir: runtimeContext.projectDir,
          data: runtimeContext.data,
          project: runtimeContext.project,
        },
      );
    }

    if (!runtimeContext.project.loaded) {
      return createReplEvaluationFailure(
        language,
        'No project loaded.',
        runtimeContext.project.sessionId,
      );
    }

    const startedAt = Date.now();
    const client = await ensureJavaRuntimeConsoleSession();
    const bindings = {
      blueData: runtimeContext.data,
      blueProjectDir: runtimeContext.projectDir,
      blueProject: runtimeContext.project,
    };
    const response =
      language === 'python'
        ? await client.evaluateJythonScript(
            { code, bindings },
            { timeout: REPL_CONSOLE_EVALUATION_TIMEOUT_MS },
          )
        : await client.evaluateClojure(
            { code, bindings, returnVariableName: null },
            { timeout: REPL_CONSOLE_EVALUATION_TIMEOUT_MS },
          );

    if (response.ok) {
      return {
        ok: true,
        language,
        projectSessionId: runtimeContext.project.sessionId,
        value: response.result.value,
        stdout: response.stdout,
        stderr: response.stderr,
        elapsedMs: response.elapsedMs ?? Date.now() - startedAt,
      };
    }

    return {
      ok: false,
      language,
      projectSessionId: runtimeContext.project.sessionId,
      value: '',
      stdout: response.stdout,
      stderr: response.stderr,
      elapsedMs: response.elapsedMs ?? Date.now() - startedAt,
      error: {
        code: response.error.code,
        message: response.error.message,
        ...(response.error.stack ? { stack: response.error.stack } : {}),
        ...(response.error.line !== undefined ? { line: response.error.line } : {}),
        ...(response.error.column !== undefined ? { column: response.error.column } : {}),
      },
    };
  }

  return {
    createReplOpenResult,
    openReplConsole: (language) => enqueueReplRuntime(() => openReplConsoleNow(language)),
    evaluateReplConsole: async (request) => {
      if (!isReplConsoleLanguage(request?.language)) {
        return createReplEvaluationFailure('javascript', 'Invalid console language.');
      }
      if (typeof request.code !== 'string' || request.code.trim().length === 0) {
        return createReplEvaluationFailure(request.language, 'Enter code before evaluating.');
      }

      try {
        return await enqueueReplRuntime(() =>
          evaluateReplConsoleNow(request.language, request.code),
        );
      } catch (error: unknown) {
        return createReplEvaluationFailure(request.language, getErrorMessage(error));
      }
    },
    reinitializeReplConsole: async (request) => {
      if (!isReplConsoleLanguage(request?.language)) {
        return {
          ...createReplOpenResult('javascript', 'error', 'Invalid console language.'),
          message: 'Invalid console language.',
        };
      }

      return enqueueReplRuntime(async () => {
        try {
          if (request.language === 'javascript') {
            await reinitializeJavaScriptRuntimeNow();
          } else if (request.language === 'python') {
            await reinitializeJythonRuntimeNow();
          } else {
            const data = deps.getCurrentData();
            const javaRuntimeSessionManager = deps.getJavaRuntimeSessionManager();
            if (!javaRuntimeSessionManager || !data) {
              throw new Error('Java runtime is unavailable.');
            }
            await javaRuntimeSessionManager.reinitializeClojure(
              data,
              deps.getCurrentProjectSessionId(),
              deps.getCurrentFilePath(),
            );
          }

          const data = deps.getCurrentData();
          if (data) {
            deps.invalidateProjectOnLoadCache();
            await deps.runProjectOnLoad(data);
          }

          return {
            ...createReplOpenResult(request.language, 'ready'),
            message: `${request.language} interpreter reinitialized.`,
          };
        } catch (error: unknown) {
          const message = getErrorMessage(error);
          return {
            ...createReplOpenResult(
              request.language,
              deps.getCurrentData() ? 'error' : 'unavailable',
              message,
            ),
            message,
          };
        }
      });
    },
    reinitializeJavaScriptRuntime: () =>
      enqueueReplRuntime(async () => {
        try {
          await reinitializeJavaScriptRuntimeNow();
          const data = deps.getCurrentData();
          if (data) {
            deps.invalidateProjectOnLoadCache();
            await deps.runProjectOnLoad(data);
          }
          return { ok: true };
        } catch (error: unknown) {
          return { ok: false, error: getErrorMessage(error) };
        }
      }),
    reinitializeJythonRuntime: () =>
      enqueueReplRuntime(async () => {
        try {
          await reinitializeJythonRuntimeNow();
          const data = deps.getCurrentData();
          if (data) {
            deps.invalidateProjectOnLoadCache();
            await deps.runProjectOnLoad(data);
          }
          return { ok: true };
        } catch (error: unknown) {
          return { ok: false, error: getErrorMessage(error) };
        }
      }),
  };
}
