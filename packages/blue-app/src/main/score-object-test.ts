import {
  BlueData,
  CompileData,
  ClojureObject,
  JavaScriptObject,
  setJavaRuntimeClient,
  setJavaScriptSession,
  type JavaRuntimeClientContract,
  type JavaScriptSession,
  type NoteList,
  type TimeContext,
} from '@blue/data';
import {
  resolveEditorTarget,
  type ScoreObjectEditorRequest,
  type ScoreObjectTestResult,
} from '../shared/project-editor';

interface GenerateForCsdObject {
  generateForCSD(
    context: TimeContext,
    compileData: CompileData,
    startTime: number,
    endTime: number,
  ): NoteList;
}

interface AsyncGenerateForCsdObject {
  generateForCSDAsync(
    context: TimeContext,
    compileData: CompileData,
    startTime: number,
    endTime: number,
  ): Promise<NoteList>;
}

export interface ScoreObjectTestOptions {
  ensureJavaScriptEngine?: () => Promise<void>;
  javaScriptSession?: JavaScriptSession | null;
  javaRuntimeClient?: JavaRuntimeClientContract | null;
}

function canGenerateForCSD(value: unknown): value is GenerateForCsdObject {
  return typeof (value as { generateForCSD?: unknown } | null)?.generateForCSD === 'function';
}

function canGenerateForCSDAsync(value: unknown): value is AsyncGenerateForCsdObject {
  return typeof (value as { generateForCSDAsync?: unknown } | null)?.generateForCSDAsync === 'function';
}

export async function testScoreObject(
  data: BlueData | null,
  request: ScoreObjectEditorRequest,
  options: ScoreObjectTestOptions = {},
): Promise<ScoreObjectTestResult> {
  if (!data) {
    return { ok: false, output: '', error: 'No project loaded.' };
  }

  const resolved = resolveEditorTarget(data, request.target);
  if (!resolved) {
    return { ok: false, output: '', error: 'Selected object not found.' };
  }

  const { sObj } = resolved;
  if (!canGenerateForCSD(sObj)) {
    return { ok: false, output: '', error: 'Selected object cannot generate score.' };
  }

  if (sObj instanceof ClojureObject && !options.javaRuntimeClient) {
    return {
      ok: false,
      output: '',
      error: 'Java runtime is unavailable. Install Java 17 or newer to test Clojure objects.',
    };
  }

  if (sObj instanceof JavaScriptObject) {
    await options.ensureJavaScriptEngine?.();
  }

  try {
    const compileData = CompileData.createEmptyCompileData();
    if (sObj instanceof JavaScriptObject && options.javaScriptSession) {
      setJavaScriptSession(compileData, options.javaScriptSession);
    }
    if (options.javaRuntimeClient) {
      setJavaRuntimeClient(compileData, options.javaRuntimeClient);
    }

    const noteList = canGenerateForCSDAsync(sObj) && options.javaRuntimeClient
      ? await sObj.generateForCSDAsync(
        data.getScore().getTimeContext(),
        compileData,
        0.0,
        -1.0,
      )
      : sObj.generateForCSD(
        data.getScore().getTimeContext(),
        compileData,
        0.0,
        -1.0,
      );

    return { ok: true, output: noteList.toScoreText() };
  } catch (err) {
    return { ok: false, output: '', error: err instanceof Error ? err.message : String(err) };
  }
}
