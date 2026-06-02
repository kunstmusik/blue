import React, { useCallback, useEffect, useRef } from 'react';
import type { ScoreObjectEditorComponentProps } from '../editor-registry';
import SelectedCodeEditor from '../../editors/SelectedCodeEditor';
import GeneratedScoreModal from './GeneratedScoreModal';
import JythonRuntimeStatusIndicator from './JythonRuntimeStatusIndicator';
import { useScoreObjectTest } from './useScoreObjectTest';

export default function CodeBackedScoreObjectEditor({ document, onPatch }: ScoreObjectEditorComponentProps): React.ReactElement {
  const editor = document.editor;
  if (editor.kind !== 'code') return <></>;

  const modeMap: Record<string, 'orc' | 'sco' | 'text' | 'javascript' | 'python'> = {
    'csound-score': 'sco',
    'python': 'python',
    'javascript': 'javascript',
    'text': 'text',
  };

  const isCsoundScore = editor.syntax === 'csound-score';
  const isJythonBacked = editor.syntax === 'python';
  const supportsOnLoadProcessable = document.target.editorObjectType === 'PythonObject';
  const onLoadProcessable = editor.auxiliaryFlags?.onLoadProcessable === true;
  const {
    testing,
    testOutput,
    testError,
    runTest,
    clearTestOutput,
    clearTestError,
  } = useScoreObjectTest(document.target);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleChange = useCallback((text: string) => {
    onPatch({
      type: 'updateTypeSpecificEditor',
      target: document.target,
      patch: { text },
    });
  }, [document.target, onPatch]);

  const handleProcessOnLoadChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    onPatch({
      type: 'updateTypeSpecificEditor',
      target: document.target,
      patch: { onLoadProcessable: event.target.checked },
    });
  }, [document.target, onPatch]);

  const handleTest = useCallback(() => {
    void runTest();
  }, [runTest]);

  useEffect(() => {
    if (!isCsoundScore) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 't') {
        e.preventDefault();
        handleTest();
      }
    };
    const el = containerRef.current;
    el?.addEventListener('keydown', handler);
    return () => { el?.removeEventListener('keydown', handler); };
  }, [handleTest, isCsoundScore]);

  return (
    <div ref={containerRef} className="h-full flex flex-col" tabIndex={-1}>
      {(isCsoundScore || isJythonBacked) && (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-b border-blue-border/30 bg-app-surface-strong px-2 py-1">
          {supportsOnLoadProcessable && (
            <label className="mr-auto flex items-center gap-1 text-ui text-gray-300">
              <input
                type="checkbox"
                checked={onLoadProcessable}
                onChange={handleProcessOnLoadChange}
                className="rounded border border-blue-border"
              />
              Process on Load
            </label>
          )}
          {isJythonBacked && <JythonRuntimeStatusIndicator />}
          <button
            type="button"
            className="rounded border border-blue-border px-2 py-0.5 text-ui text-gray-300 hover:border-blue-accent"
            onClick={handleTest}
            disabled={testing}
            title="Test (Cmd/Ctrl+T)"
          >
            {testing ? 'Testing...' : 'Test'}
          </button>
        </div>
      )}
      {testError && (
        <div className="px-3 py-1.5 text-body border-b shrink-0 bg-red-900/20 text-red-300 flex items-center gap-2">
          <span>Error: {testError}</span>
          <button className="underline text-blue-muted hover:text-gray-200" onClick={clearTestError}>dismiss</button>
        </div>
      )}
      <SelectedCodeEditor
        value={editor.text}
        mode={modeMap[editor.syntax] ?? 'text'}
        active={true}
        readOnly={false}
        ariaLabel={`Score object code editor (${editor.syntax})`}
        onChange={handleChange}
      />
      {testOutput !== null && (
        <GeneratedScoreModal text={testOutput} onClose={clearTestOutput} />
      )}
    </div>
  );
}
