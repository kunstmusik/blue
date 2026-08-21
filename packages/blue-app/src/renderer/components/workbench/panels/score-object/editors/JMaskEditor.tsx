import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { JMaskEditorPayload } from '../../../../../../shared/project-editor';
import type { ScoreObjectEditorComponentProps } from '../editor-registry';
import type { FieldSnapshot, ParameterSnapshot } from './jmask/jmask-utils';
import { getParameters, cloneField } from './jmask/jmask-utils';
import ParameterRow from './jmask/ParameterRow';
import CommitNumberInput from './jmask/CommitNumberInput';
import GeneratedScoreModal from './GeneratedScoreModal';
import { useScoreObjectTest } from './useScoreObjectTest';

export default function JMaskEditor({ document, onPatch }: ScoreObjectEditorComponentProps): React.ReactElement {
  const editor = document.editor;
  if (editor.kind !== 'structured' || editor.editorFamily !== 'JMask') return <></>;

  const payload = editor.payload as JMaskEditorPayload;
  const field = payload.field as FieldSnapshot;
  const parameters = useMemo(() => getParameters(field), [field]);
  const duration = document.shared.subjectiveDuration.value;
  const [showVisibilityPopup, setShowVisibilityPopup] = useState(false);

  const {
    testing,
    testOutput,
    testError,
    runTest,
    clearTestOutput,
    clearTestError,
  } = useScoreObjectTest(document.target);

  const handleTest = useCallback(() => {
    void runTest();
  }, [runTest]);

  const testRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 't') {
        e.preventDefault();
        handleTest();
      }
    };
    const el = testRef.current;
    el?.addEventListener('keydown', handler);
    return () => { el?.removeEventListener('keydown', handler); };
  }, [handleTest]);

  const patch = useCallback(
    (nextPatch: Record<string, unknown>) => {
      onPatch({
        type: 'updateTypeSpecificEditor',
        target: document.target,
        patch: nextPatch,
      });
    },
    [document.target, onPatch],
  );

  const handleFieldChange = useCallback((nextField: FieldSnapshot) => {
    patch({ field: nextField });
  }, [patch]);

  const handleSeedUsedChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    patch({ seedUsed: e.target.checked });
  }, [patch]);

  const handleSeedCommit = useCallback((v: number) => {
    patch({ seed: v });
  }, [patch]);

  const handleVisibilityToggle = useCallback((index: number, visible: boolean) => {
    const next = cloneField(field);
    const params = getParameters(next);
    if (index >= 0 && index < params.length) {
      params[index] = { ...params[index]!, visible };
    }
    patch({ field: next });
  }, [field, patch]);

  const visibleRows = useMemo(() => {
    const rows: Array<{ parameter: ParameterSnapshot; fieldIndex: number; parameterNum: number }> = [];
    let num = 0;
    for (let i = 0; i < parameters.length; i++) {
      num += 1;
      rows.push({ parameter: parameters[i]!, fieldIndex: i, parameterNum: num });
    }
    return rows;
  }, [parameters]);

  return (
    <div ref={testRef} className="flex h-full flex-col bg-blue-bg" tabIndex={-1}>
      <div className="flex shrink-0 items-center gap-2 border-b border-app-border bg-app-surface-strong px-2 py-1">
        <span className="text-role-headline font-bold text-app-text">JMask</span>
        <div className="relative">
          <button
            type="button"
            className="flex h-4 w-4 items-center justify-center rounded text-role-callout text-app-text-muted hover:bg-blue-border"
            onClick={() => setShowVisibilityPopup(p => !p)}
            title="Parameter Visibility"
            aria-label="Parameter Visibility"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {showVisibilityPopup && (
            <div className="absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded border border-blue-border bg-app-menu py-1 shadow-xl">
              {parameters.map((p, i) => {
                const pName = typeof p.name === 'string' && p.name ? p.name : '';
                const itemLabel = pName ? `Parameter ${i + 1} - ${pName}` : `Parameter ${i + 1}`;
                const isVisible = p.visible !== false;
                return (
                  <label key={i} className="flex cursor-pointer items-center gap-2 px-3 py-0.5 text-role-body text-app-text hover:bg-blue-accent/20">
                    <input
                      type="checkbox"
                      checked={isVisible}
                      onChange={() => handleVisibilityToggle(i, !isVisible)}
                      className="rounded border border-blue-border"
                    />
                    {itemLabel}
                  </label>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex-1" />
        <label className="flex items-center gap-1 text-role-body text-gray-300">
          <input
            type="checkbox"
            checked={payload?.seedUsed}
            onChange={handleSeedUsedChange}
            className="rounded border border-blue-border"
          />
          Seed
        </label>
        {payload?.seedUsed && (
          <CommitNumberInput
            value={payload.seed ?? 0}
            step={1}
            className="w-24 rounded border border-blue-border bg-blue-bg px-1.5 py-0.5 text-role-body text-gray-100 focus:border-blue-accent focus:outline-none"
            onChange={handleSeedCommit}
          />
        )}
        <button
          type="button"
          className="rounded border border-blue-border px-2 py-0.5 text-role-body text-gray-300 hover:border-blue-accent"
          onClick={handleTest}
          disabled={testing}
          title="Test (Cmd/Ctrl+T)"
        >
          {testing ? 'Testing...' : 'Test'}
        </button>
      </div>
      {testError && (
        <div className="px-3 py-1.5 text-role-body border-b shrink-0 bg-red-900/20 text-red-300 flex items-center gap-2">
          <span>Error: {testError}</span>
          <button className="underline text-blue-muted hover:text-gray-200" onClick={clearTestError}>dismiss</button>
        </div>
      )}
      {testOutput !== null && (
        <GeneratedScoreModal text={testOutput} onClose={clearTestOutput} />
      )}
      <div className="flex-1 overflow-auto p-1 space-y-1">
        {visibleRows
          .filter(r => r.parameter.visible !== false)
          .map(row => (
            <ParameterRow
              key={row.fieldIndex}
              parameter={row.parameter}
              parameterNum={row.parameterNum}
              duration={duration}
              field={field}
              fieldIndex={row.fieldIndex}
              onFieldChange={handleFieldChange}
            />
          ))}
      </div>
    </div>
  );
}
