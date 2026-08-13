import React, { useCallback, useEffect, useRef } from 'react';
import type { ScoreObjectEditorComponentProps } from '../editor-registry';
import SelectedCodeEditor from '../../editors/SelectedCodeEditor';
import GeneratedScoreModal from './GeneratedScoreModal';
import JavaScriptRuntimeStatusIndicator from './JavaScriptRuntimeStatusIndicator';
import { useScoreObjectTest } from './useScoreObjectTest';

export default function JavaScriptObjectEditor({ document, onPatch }: ScoreObjectEditorComponentProps): React.ReactElement {
  const editor = document.editor;
  if (editor.kind !== 'code') return <></>;

  const onLoadProcessable = editor.auxiliaryFlags?.onLoadProcessable === true;

  const {
    testing,
    testOutput,
    testError,
    runTest,
    clearTestOutput,
    clearTestError,
  } = useScoreObjectTest(document.target);

  const patch = useCallback((p: Record<string, unknown>) => {
    onPatch({
      type: 'updateTypeSpecificEditor',
      target: document.target,
      patch: p,
    });
  }, [document.target, onPatch]);

  const handleChange = useCallback((text: string) => {
    patch({ text });
  }, [patch]);

  const handleProcessOnLoadChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    patch({ onLoadProcessable: e.target.checked });
  }, [patch]);

  const handleTest = useCallback(async () => {
    await runTest();
  }, [runTest]);

  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 't') {
        e.preventDefault();
        handleTest();
      }
    };
    const el = containerRef.current;
    el?.addEventListener('keydown', handler);
    return () => { el?.removeEventListener('keydown', handler); };
  }, [handleTest]);

  return (
    <div ref={containerRef} className="flex h-full flex-col" tabIndex={-1}>
      <div className="flex items-center gap-2 border-b border-blue-border px-3 py-1 shrink-0">
        <div className="flex-1" />
        <JavaScriptRuntimeStatusIndicator />
        <label className="flex items-center gap-1 text-ui text-gray-300">
          <input
            type="checkbox"
            checked={onLoadProcessable}
            onChange={handleProcessOnLoadChange}
            className="rounded border border-blue-border"
          />
          Process on Load
        </label>
        <button
          type="button"
          className="rounded border border-blue-border px-2 py-0.5 text-ui text-gray-300 hover:border-blue-accent"
          disabled={testing}
          onClick={handleTest}
          title="Test (Cmd/Ctrl+T)"
        >
          {testing ? 'Testing...' : 'Test'}
        </button>
      </div>
      {testError && (
        <div className="px-3 py-1.5 text-body border-b shrink-0 bg-red-900/20 text-red-300 flex items-center gap-2">
          <span>Error: {testError}</span>
          <button className="underline text-blue-muted hover:text-gray-200" onClick={clearTestError}>dismiss</button>
        </div>
      )}
      <div className="flex-1 overflow-hidden">
        <SelectedCodeEditor
          value={editor.text}
          mode="javascript"
          active={true}
          readOnly={false}
          ariaLabel="JavaScript code editor"
          onChange={handleChange}
        />
      </div>
      {testOutput !== null && (
        <GeneratedScoreModal text={testOutput} onClose={clearTestOutput} />
      )}
    </div>
  );
}
