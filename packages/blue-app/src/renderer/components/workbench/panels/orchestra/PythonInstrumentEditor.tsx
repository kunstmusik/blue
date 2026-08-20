import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PythonInstrumentSnapshot } from '../../../../../shared/project-editor';
import SelectedCodeEditor from '../editors/SelectedCodeEditor';
import { toUdoCompletionDefinitions } from '../editors/udo-completion-scope';
import EmbeddedUdoPanel from './EmbeddedUdoPanel';
import GeneratedInstrumentModal from './GeneratedInstrumentModal';
import JythonRuntimeStatusIndicator from '../score-object/editors/JythonRuntimeStatusIndicator';
import type { SelectedInstrumentEditorProps } from './types';

type PythonTab = 'instrument' | 'udo' | 'globalOrc' | 'globalSco';

const PYTHON_TABS: Array<{ key: PythonTab; label: string }> = [
  { key: 'instrument', label: 'Instrument' },
  { key: 'udo', label: 'UDO' },
  { key: 'globalOrc', label: 'Global Orc' },
  { key: 'globalSco', label: 'Global Sco' },
];

export default function PythonInstrumentEditor({
  instrument,
  onInstrumentPatch,
  projectUdos,
  embeddedUdoTarget,
}: SelectedInstrumentEditorProps & {
  instrument: PythonInstrumentSnapshot;
}): React.ReactElement {
  const [activeTab, setActiveTab] = useState<PythonTab>('instrument');
  const [testing, setTesting] = useState(false);
  const [testOutput, setTestOutput] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const orchestraCompletionOptions = useMemo(
    () => ({
      contextUdos: toUdoCompletionDefinitions(instrument.udolist ?? []),
      projectUdos: toUdoCompletionDefinitions(projectUdos ?? []),
    }),
    [instrument.udolist, projectUdos],
  );

  const handleTest = useCallback(async () => {
    if (!window.blueAPI?.testPythonInstrument) {
      setTestError('Python instrument testing is unavailable in this environment.');
      return;
    }

    setTesting(true);
    setTestError(null);

    try {
      const result = await window.blueAPI.testPythonInstrument({
        code: instrument.text,
        assignmentId: instrument.assignmentId,
      });

      if (result.ok) {
        setTestOutput(result.output);
      } else {
        setTestError(result.error ?? 'Failed to evaluate Python instrument.');
      }
    } catch (err) {
      setTestError(err instanceof Error ? err.message : String(err));
    } finally {
      setTesting(false);
    }
  }, [instrument.assignmentId, instrument.text]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 't') {
        e.preventDefault();
        void handleTest();
      }
    };
    const el = containerRef.current;
    el?.addEventListener('keydown', handler);
    return () => {
      el?.removeEventListener('keydown', handler);
    };
  }, [handleTest]);

  return (
    <div ref={containerRef} className="flex h-full min-h-0 flex-col bg-blue-bg" tabIndex={-1}>
      {/* Header toolbar */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-blue-border bg-app-surface-strong px-3 py-1.5">
        <div className="text-role-headline text-app-text-strong">
          {instrument.name || 'Python Instrument'}
        </div>
        <div className="flex items-center gap-2">
          <JythonRuntimeStatusIndicator />
          <button
            type="button"
            className="rounded border border-blue-border px-2.5 py-1 text-role-body text-gray-300 transition-colors hover:border-blue-accent hover:text-gray-100 disabled:opacity-50"
            onClick={() => { void handleTest(); }}
            disabled={testing}
            title="Test (Cmd/Ctrl+T)"
          >
            {testing ? 'Testing...' : 'Test'}
          </button>
        </div>
      </div>

      {/* Error alert */}
      {testError && (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-red-800 bg-red-900/30 px-3 py-1.5 text-role-body text-red-200">
          <span>Error: {testError}</span>
          <button
            type="button"
            className="text-role-callout text-blue-muted underline hover:text-gray-200"
            onClick={() => setTestError(null)}
          >
            dismiss
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-blue-border bg-app-surface-strong px-2">
        {PYTHON_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={[
              'border-b-2 px-3 py-2 text-role-body',
              activeTab === tab.key
                ? 'border-blue-accent text-app-text-strong'
                : 'border-transparent text-blue-muted hover:text-app-text-strong',
            ].join(' ')}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content surfaces */}
      <div className="relative min-h-0 flex-1">
        {PYTHON_TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <div
              key={tab.key}
              className={isActive ? 'relative h-full p-3' : 'pointer-events-none absolute inset-0 p-3'}
              aria-hidden={!isActive}
              style={{ visibility: isActive ? 'visible' : 'hidden' }}
            >
              {tab.key === 'instrument' ? (
                <SelectedCodeEditor
                  active={isActive}
                  value={instrument.text}
                  mode="python"
                  placeholder="Enter Python instrument code"
                  ariaLabel={`${instrument.name || 'Python Instrument'} Python code editor`}
                  onChange={(nextValue) => void onInstrumentPatch({ text: nextValue })}
                />
              ) : tab.key === 'udo' ? (
                <EmbeddedUdoPanel
                  udolist={instrument.udolist ?? []}
                  projectUdos={projectUdos}
                  resetKey={instrument.assignmentId}
                  onInstrumentPatch={onInstrumentPatch}
                  libraryDropTarget={embeddedUdoTarget}
                />
              ) : (
                <SelectedCodeEditor
                  active={isActive}
                  value={tab.key === 'globalOrc' ? instrument.globalOrc : instrument.globalSco}
                  mode={tab.key === 'globalOrc' ? 'orc' : 'sco'}
                  placeholder={`Enter ${tab.label} code`}
                  ariaLabel={`${instrument.name || 'Python Instrument'} ${tab.label} code editor`}
                  javaBlueCompletionOptions={
                    tab.key === 'globalOrc' ? orchestraCompletionOptions : undefined
                  }
                  onChange={(nextValue) =>
                    void onInstrumentPatch(
                      tab.key === 'globalOrc'
                        ? { globalOrc: nextValue }
                        : { globalSco: nextValue },
                    )
                  }
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Test output modal */}
      {testOutput !== null && (
        <GeneratedInstrumentModal
          text={testOutput}
          onClose={() => setTestOutput(null)}
        />
      )}
    </div>
  );
}
