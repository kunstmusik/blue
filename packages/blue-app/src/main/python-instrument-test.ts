import type { JavaRuntimeClientContract } from '@blue/data';

export interface PythonInstrumentTestRequest {
  code: string;
  assignmentId?: string;
}

export interface PythonInstrumentTestResult {
  ok: boolean;
  output: string;
  error?: string;
}

export interface PythonInstrumentTestOptions {
  javaRuntimeClient?: JavaRuntimeClientContract | null;
}

export async function testPythonInstrument(
  request: PythonInstrumentTestRequest,
  options: PythonInstrumentTestOptions = {},
): Promise<PythonInstrumentTestResult> {
  if (!options.javaRuntimeClient) {
    return {
      ok: false,
      output: '',
      error: 'Java runtime is unavailable. Install Java 17 or newer to test Python instruments.',
    };
  }

  try {
    const response = await options.javaRuntimeClient.evaluateJythonInstrument({
      code: request.code,
    });

    if (!response.ok) {
      return {
        ok: false,
        output: '',
        error: response.error?.message || 'Failed to evaluate Python instrument.',
      };
    }

    return {
      ok: true,
      output: response.result?.instrumentText ?? '',
    };
  } catch (error) {
    return {
      ok: false,
      output: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
