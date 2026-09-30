import {
  BlueData,
  CompileData,
  ClojureObject,
  JavaScriptObject,
  ObjectBuilder,
  PolyObject,
  PythonObject,
  getTotalDuration,
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
    options?: boolean,
  ): NoteList;
}

interface AsyncGenerateForCsdObject {
  generateForCSDAsync(
    context: TimeContext,
    compileData: CompileData,
    startTime: number,
    endTime: number,
    options?: boolean,
  ): Promise<NoteList>;
}

export interface ScoreObjectTestOptions {
  ensureJavaScriptEngine?: () => Promise<void>;
  javaScriptSession?: JavaScriptSession | null;
  javaRuntimeClient?: JavaRuntimeClientContract | null;
}

function getObjectBuilder(value: unknown): ObjectBuilder | undefined {
  return value instanceof ObjectBuilder ? value : undefined;
}

function canGenerateForCSD(value: unknown): value is GenerateForCsdObject {
  return typeof (value as { generateForCSD?: unknown } | null)?.generateForCSD === 'function';
}

function canGenerateForCSDAsync(value: unknown): value is AsyncGenerateForCsdObject {
  return (
    typeof (value as { generateForCSDAsync?: unknown } | null)?.generateForCSDAsync === 'function'
  );
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
  if (request.mode === 'objective-duration' && !(sObj instanceof PolyObject)) {
    return {
      ok: false,
      output: '',
      error: 'Objective-duration measurement requires a PolyObject.',
    };
  }
  if (!canGenerateForCSD(sObj)) {
    return { ok: false, output: '', error: 'Selected object cannot generate score.' };
  }

  const objectBuilder = getObjectBuilder(sObj);

  if (sObj instanceof ClojureObject && !options.javaRuntimeClient) {
    return {
      ok: false,
      output: '',
      error: 'Java runtime is unavailable. Install Java 17 or newer to test Clojure objects.',
    };
  }

  if (sObj instanceof PythonObject && !options.javaRuntimeClient) {
    return {
      ok: false,
      output: '',
      error: 'Java runtime is unavailable. Install Java 17 or newer to test Python objects.',
    };
  }

  if (objectBuilder?.usesJavaRuntime() && !options.javaRuntimeClient) {
    const languageLabel = objectBuilder.getLanguageType() === 'PYTHON' ? 'Python' : 'Clojure';
    return {
      ok: false,
      output: '',
      error: `Java runtime is unavailable. Install Java 17 or newer to test ${languageLabel} ObjectBuilder objects.`,
    };
  }

  const usesJavaScript =
    sObj instanceof JavaScriptObject ||
    sObj instanceof PolyObject ||
    objectBuilder?.getLanguageType() === 'JAVASCRIPT';
  if (usesJavaScript) {
    await options.ensureJavaScriptEngine?.();
  }

  try {
    const compileData = CompileData.createEmptyCompileData();
    if (options.javaScriptSession) {
      setJavaScriptSession(compileData, options.javaScriptSession);
    }
    if (options.javaRuntimeClient) {
      setJavaRuntimeClient(compileData, options.javaRuntimeClient);
    }

    const context = data.getScore().getTimeContext();
    const noteList =
      request.mode === 'objective-duration' && canGenerateForCSDAsync(sObj)
        ? await sObj.generateForCSDAsync(context, compileData, -1.0, -1.0, false)
        : canGenerateForCSDAsync(sObj) && options.javaRuntimeClient
          ? await sObj.generateForCSDAsync(context, compileData, 0.0, -1.0)
          : sObj.generateForCSD(context, compileData, 0.0, -1.0);

    if (request.mode === 'objective-duration') {
      const objectiveDurationBeats =
        getTotalDuration(noteList) - sObj.getStartTime().toBeats(context);
      if (
        noteList.length === 0 ||
        !Number.isFinite(objectiveDurationBeats) ||
        objectiveDurationBeats <= 0
      ) {
        return {
          ok: false,
          output: '',
          error: 'The PolyObject generated no notes with a positive objective duration.',
        };
      }
      return { ok: true, output: noteList.toScoreText(), objectiveDurationBeats };
    }

    return { ok: true, output: noteList.toScoreText() };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const error =
      request.mode === 'objective-duration' && /requires? (?:a )?Java runtime/i.test(message)
        ? 'Java runtime is unavailable. Install Java 17 or newer to measure this PolyObject and its children.'
        : message;
    return { ok: false, output: '', error };
  }
}
