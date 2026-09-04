import React, { useCallback } from 'react';
import type { ScoreObjectEditorComponentProps } from '../editor-registry';
import SelectedCodeEditor from '../../editors/SelectedCodeEditor';
import GeneratedScoreModal from './GeneratedScoreModal';
import { useScoreObjectTest } from './useScoreObjectTest';
import { BLUE_INSPECTOR_LABEL_TEXT_CLASS } from '../../shared/compactFieldStyles';
import { cn } from '../../../../../lib/cn';

export default function ExternalScoreObjectEditor({
  document,
  onPatch,
}: ScoreObjectEditorComponentProps): React.ReactElement {
  const editor = document.editor;
  if (editor.kind !== 'external') return <></>;

  const { testing, testOutput, testError, runTest, clearTestOutput, clearTestError } =
    useScoreObjectTest(document.target);

  const modeMap: Record<string, 'orc' | 'sco' | 'text' | 'javascript' | 'python'> = {
    Python: 'python',
    JavaScript: 'javascript',
    Csound: 'sco',
    text: 'text',
  };

  const patch = useCallback(
    (p: Record<string, unknown>) => {
      onPatch({
        type: 'updateTypeSpecificEditor',
        target: document.target,
        patch: p,
      });
    },
    [document.target, onPatch],
  );

  const handleCodeChange = useCallback(
    (text: string) => {
      patch({ scoreText: text });
    },
    [patch],
  );

  const handleCommandLineChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      patch({ commandLine: e.target.value });
    },
    [patch],
  );

  const canTest =
    !testing && (editor.commandLine.trim().length > 0 || editor.scoreText.trim().length > 0);

  const handleTest = useCallback(async () => {
    await runTest();
  }, [runTest]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-blue-border shrink-0">
        <label className={cn('shrink-0', BLUE_INSPECTOR_LABEL_TEXT_CLASS)}>Command Line:</label>
        <input
          type="text"
          className="flex-1 min-w-0 rounded border border-blue-border bg-blue-bg px-2 py-1 text-role-body text-gray-100 font-mono focus:border-blue-accent focus:outline-none"
          value={editor.commandLine}
          onChange={handleCommandLineChange}
        />
        <button
          className="shrink-0 px-3 py-1 text-role-body rounded border border-blue-border text-blue-muted hover:bg-blue-border/30 disabled:opacity-50"
          disabled={!canTest}
          onClick={handleTest}
          title="Generate score from external command and show results"
        >
          {testing ? 'Running...' : 'Test'}
        </button>
      </div>
      {testError && (
        <div className="px-3 py-1.5 text-role-body border-b shrink-0 bg-red-900/20 text-red-300 flex items-center gap-2">
          <span>Error: {testError}</span>
          <button
            className="underline text-blue-muted hover:text-gray-200"
            onClick={clearTestError}
          >
            dismiss
          </button>
        </div>
      )}
      <div className="flex-1 overflow-hidden">
        <SelectedCodeEditor
          value={editor.scoreText}
          mode={modeMap[editor.syntaxType] ?? 'text'}
          active={true}
          readOnly={false}
          ariaLabel="External code editor"
          onChange={handleCodeChange}
        />
      </div>
      {testOutput !== null && <GeneratedScoreModal text={testOutput} onClose={clearTestOutput} />}
    </div>
  );
}
