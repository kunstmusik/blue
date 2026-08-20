import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { InstrumentPatch } from '../../../../../../shared/project-editor';
import type { ScoreObjectEditorComponentProps } from '../editor-registry';
import SelectedCodeEditor from '../../editors/SelectedCodeEditor';
import BSBInterfaceEditor from '../../orchestra/bsb/BSBInterfaceEditor';
import { createBsbReplacementKeys } from '../../orchestra/bsb/bsb-completions';
import GeneratedScoreModal from './GeneratedScoreModal';
import JavaScriptRuntimeStatusIndicator from './JavaScriptRuntimeStatusIndicator';
import JythonRuntimeStatusIndicator from './JythonRuntimeStatusIndicator';
import { useScoreObjectTest } from './useScoreObjectTest';

type ObjectBuilderLanguage = 'PYTHON' | 'JAVASCRIPT' | 'CLOJURE' | 'EXTERNAL';
type ObjectBuilderTab = 'interface' | 'code' | 'comments';

const EDITOR_MODES = {
  PYTHON: 'python',
  JAVASCRIPT: 'javascript',
  CLOJURE: 'clojure',
  EXTERNAL: 'text',
} as const;

export default function ObjectBuilderScoreObjectEditor({
  document,
  onPatch,
}: ScoreObjectEditorComponentProps): React.ReactElement {
  const editor = document.editor;
  if (editor.kind !== 'code') return <></>;

  const languageType = String(editor.auxiliaryFlags?.languageType ?? 'PYTHON') as ObjectBuilderLanguage;
  const commandLine = String(editor.auxiliaryFlags?.commandLine ?? '');
  const comment = String(editor.auxiliaryFlags?.comment ?? '');
  const editEnabled = editor.auxiliaryFlags?.editEnabled !== false;
  const [activeTab, setActiveTab] = useState<ObjectBuilderTab>('interface');
  const objectNamesSignature = (editor.bsbInstrument?.objectNames ?? []).join('\u0000');
  const bsbReplacementKeys = useMemo(
    () => createBsbReplacementKeys(editor.bsbInstrument?.objectNames ?? []),
    [objectNamesSignature],
  );
  const completionOptions = useMemo(
    () => ({ bsbReplacementKeys }),
    [bsbReplacementKeys],
  );
  const {
    testing,
    testOutput,
    testError,
    runTest,
    clearTestOutput,
    clearTestError,
  } = useScoreObjectTest(document.target);

  const patch = useCallback((value: Record<string, unknown>) => {
    onPatch({
      type: 'updateTypeSpecificEditor',
      target: document.target,
      patch: value,
    });
  }, [document.target, onPatch]);

  const handleTest = useCallback(() => {
    void runTest();
  }, [runTest]);

  const handleInstrumentPatch = useCallback((instrumentPatch: InstrumentPatch) => {
    if (instrumentPatch.bsbInterface) {
      patch({ bsbInterfacePatch: instrumentPatch.bsbInterface });
    }
  }, [patch]);

  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 't') {
        event.preventDefault();
        handleTest();
      }
    };
    const element = containerRef.current;
    element?.addEventListener('keydown', handler);
    return () => { element?.removeEventListener('keydown', handler); };
  }, [handleTest]);

  return (
    <div ref={containerRef} className="flex h-full flex-col" tabIndex={-1}>
      <div className="flex shrink-0 items-end justify-between border-b border-blue-border px-2">
        <div className="flex items-end gap-1">
          {(['interface', 'code', 'comments'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              data-object-builder-tab={tab}
              className={[
                'border-b-2 px-3 py-2 text-role-body capitalize',
                activeTab === tab
                  ? 'border-app-accent text-app-text-strong'
                  : 'border-transparent text-app-text-muted hover:text-app-text-strong',
              ].join(' ')}
              onClick={() => { setActiveTab(tab); }}
            >
              {tab}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="mb-1 rounded border border-blue-border px-2 py-0.5 text-role-body text-gray-300 hover:border-blue-accent"
          disabled={testing}
          onClick={handleTest}
          title="Test (Cmd/Ctrl+T)"
        >
          {testing ? 'Testing...' : 'Test'}
        </button>
      </div>
      {testError && (
        <div className="flex shrink-0 items-center gap-2 border-b bg-red-900/20 px-3 py-1.5 text-role-body text-red-300">
          <span>Error: {testError}</span>
          <button className="underline text-blue-muted hover:text-gray-200" onClick={clearTestError}>dismiss</button>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-hidden">
        {activeTab === 'interface' && editor.bsbInstrument && (
          <div className="h-full">
            <BSBInterfaceEditor
              instrument={editor.bsbInstrument}
              onInstrumentPatch={handleInstrumentPatch}
            />
          </div>
        )}
        {activeTab === 'code' && (
          <div className="flex h-full flex-col">
            <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-blue-border px-3 py-1">
              <label className="flex items-center gap-1 text-role-body text-gray-300">
                Language
                <select
                  aria-label="ObjectBuilder language"
                  className="rounded border border-blue-border bg-app-surface px-1 py-0.5"
                  value={languageType}
                  onChange={(event) => { patch({ languageType: event.target.value }); }}
                >
                  <option value="PYTHON">Python</option>
                  <option value="JAVASCRIPT">JavaScript</option>
                  <option value="CLOJURE">Clojure</option>
                  <option value="EXTERNAL">External</option>
                </select>
              </label>
              <label className="flex min-w-48 flex-1 items-center gap-1 text-role-body text-gray-300">
                Command Line
                <input
                  aria-label="ObjectBuilder command line"
                  className="min-w-0 flex-1 rounded border border-blue-border bg-app-surface px-1 py-0.5 disabled:opacity-50"
                  value={commandLine}
                  disabled={languageType !== 'EXTERNAL'}
                  onChange={(event) => { patch({ commandLine: event.target.value }); }}
                />
              </label>
              <label className="flex items-center gap-1 text-role-body text-gray-300">
                <input
                  type="checkbox"
                  checked={editEnabled}
                  onChange={(event) => { patch({ editEnabled: event.target.checked }); }}
                />
                Edit Code
              </label>
              {languageType === 'PYTHON' && <JythonRuntimeStatusIndicator />}
              {languageType === 'JAVASCRIPT' && <JavaScriptRuntimeStatusIndicator />}
            </div>
            <div className="min-h-0 flex-1">
              <SelectedCodeEditor
                value={editor.text}
                mode={EDITOR_MODES[languageType]}
                active={true}
                readOnly={!editEnabled}
                ariaLabel={`ObjectBuilder ${languageType} code editor`}
                javaBlueCompletionOptions={completionOptions}
                onChange={(text) => { patch({ text }); }}
              />
            </div>
          </div>
        )}
        {activeTab === 'comments' && (
          <label className="flex h-full flex-col gap-1 px-3 py-2 text-role-body text-gray-300">
            Comment
            <textarea
              aria-label="ObjectBuilder comment"
              className="min-h-0 flex-1 resize-none rounded border border-blue-border bg-app-surface px-2 py-1"
              value={comment}
              onChange={(event) => { patch({ comment: event.target.value }); }}
            />
          </label>
        )}
      </div>
      {testOutput !== null && (
        <GeneratedScoreModal text={testOutput} onClose={clearTestOutput} />
      )}
    </div>
  );
}
