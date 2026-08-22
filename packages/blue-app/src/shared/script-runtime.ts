export interface ScriptRuntimeReinitializeResult {
  ok: boolean;
  error?: string;
}

export const JAVASCRIPT_RUNTIME_REINITIALIZE_CHANNEL = 'javascript-runtime:reinitialize';
