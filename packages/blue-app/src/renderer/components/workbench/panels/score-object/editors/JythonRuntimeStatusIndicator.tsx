import React, { useCallback, useState } from 'react';

export default function JythonRuntimeStatusIndicator(): React.ReactElement {
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [reinitializing, setReinitializing] = useState(false);

  const handleReinitialize = useCallback(async () => {
    if (!window.blueAPI?.reinitializeJythonRuntime) {
      setRuntimeError('Jython runtime controls are unavailable in this build.');
      return;
    }

    setReinitializing(true);
    setRuntimeError(null);
    try {
      const result = await window.blueAPI.reinitializeJythonRuntime();
      if (!result.ok) {
        setRuntimeError(result.error ?? 'Failed to reinitialize Jython runtime.');
      }
    } catch (err) {
      setRuntimeError(err instanceof Error ? err.message : String(err));
    } finally {
      setReinitializing(false);
    }
  }, []);

  return (
    <>
      <button
        type="button"
        className="rounded border border-blue-border px-2 py-0.5 text-role-body text-gray-300 hover:border-blue-accent"
        disabled={reinitializing}
        onClick={() => { void handleReinitialize(); }}
        title="Reinitialize the project Jython runtime"
      >
        {reinitializing ? 'Reinitializing...' : 'Reinitialize Jython'}
      </button>
      {runtimeError && (
        <div className="px-3 py-1.5 text-role-body border-b shrink-0 bg-red-900/20 text-red-300 flex items-center gap-2 basis-full">
          <span>Error: {runtimeError}</span>
          <button
            className="underline text-blue-muted hover:text-gray-200"
            onClick={() => {
              setRuntimeError(null);
            }}
          >
            dismiss
          </button>
        </div>
      )}
    </>
  );
}