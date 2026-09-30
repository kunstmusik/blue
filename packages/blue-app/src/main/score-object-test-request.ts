import type { BlueData, JavaRuntimeClientContract, JavaScriptSession } from '@blue/data';
import type { ScoreObjectEditorRequest, ScoreObjectTestResult } from '../shared/project-editor';
import { testScoreObject, type ScoreObjectTestOptions } from './score-object-test';

export interface ScoreObjectTestProjectState {
  data: BlueData | null;
  revision: number;
  sessionId: number;
}

export interface ScoreObjectTestRequestDependencies {
  getProjectState: () => ScoreObjectTestProjectState;
  prepareJavaRuntime: (data: BlueData) => Promise<JavaRuntimeClientContract | null>;
  ensureJavaScriptEngine?: () => Promise<void>;
  javaScriptSession?: JavaScriptSession | null;
  testScoreObject?: typeof testScoreObject;
}

function staleMeasurementResult(message: string): ScoreObjectTestResult {
  return { ok: false, output: '', error: message };
}

export async function runScoreObjectTestRequest(
  request: ScoreObjectEditorRequest,
  dependencies: ScoreObjectTestRequestDependencies,
): Promise<ScoreObjectTestResult> {
  const projectMatchesRequest = () => {
    if (request.mode !== 'objective-duration') return true;
    const project = dependencies.getProjectState();
    return (
      request.expectedProjectRevision === project.revision &&
      request.expectedProjectSessionId === project.sessionId
    );
  };

  if (!projectMatchesRequest()) {
    return staleMeasurementResult(
      'The project changed before duration measurement started. Run the command again.',
    );
  }

  const { data } = dependencies.getProjectState();
  let javaRuntimeClient: JavaRuntimeClientContract | null = null;

  try {
    if (data) {
      javaRuntimeClient = await dependencies.prepareJavaRuntime(data);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      output: '',
      error:
        request.mode === 'objective-duration' && /Java runtime/i.test(message)
          ? 'Java runtime is unavailable. Install Java 17 or newer to measure this PolyObject and its children.'
          : message,
    };
  }

  if (!projectMatchesRequest()) {
    return staleMeasurementResult(
      'The project changed while preparing duration measurement. Run the command again.',
    );
  }

  const result = await (dependencies.testScoreObject ?? testScoreObject)(data, request, {
    ensureJavaScriptEngine: dependencies.ensureJavaScriptEngine,
    javaScriptSession: dependencies.javaScriptSession,
    javaRuntimeClient,
  } satisfies ScoreObjectTestOptions);

  if (!projectMatchesRequest()) {
    return staleMeasurementResult(
      'The project changed while measuring duration. Run the command again.',
    );
  }
  return result;
}
