import React from 'react';
import type { ScoreObjectEditorComponentProps } from '../editor-registry';
import GeneratedScoreModal from './GeneratedScoreModal';
import { useScoreObjectTest } from './useScoreObjectTest';

export default function PolyObjectScoreObjectEditor({ document }: ScoreObjectEditorComponentProps): React.ReactElement {
  const editor = document.editor;
  if (editor.kind !== 'polyObject') return <></>;

  const {
    testing,
    testOutput,
    testError,
    runTest,
    clearTestOutput,
    clearTestError,
  } = useScoreObjectTest(document.target);

  if (editor.children.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-end px-3 py-2 border-b border-blue-border shrink-0">
          <button
            type="button"
            className="rounded border border-blue-border px-2 py-0.5 text-ui text-gray-300 hover:border-blue-accent disabled:opacity-50"
            disabled={!editor.canTest || testing}
            onClick={() => { void runTest(); }}
            title="Test generated score"
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
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-blue-muted">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18" />
            <path d="M9 21V9" />
          </svg>
          <span className="text-body">PolyObject is empty</span>
        </div>
        {testOutput !== null && (
          <GeneratedScoreModal text={testOutput} onClose={clearTestOutput} />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-3 py-2 border-b border-blue-border shrink-0">
        <span className="text-body text-blue-muted">
          {editor.children.length} object{editor.children.length !== 1 ? 's' : ''} across layers
        </span>
        <button
          type="button"
          className="ml-auto rounded border border-blue-border px-2 py-0.5 text-ui text-gray-300 hover:border-blue-accent disabled:opacity-50"
          disabled={!editor.canTest || testing}
          onClick={() => { void runTest(); }}
          title="Test generated score"
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
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-body">
          <thead>
            <tr className="border-b border-blue-border">
              <th className="px-2 py-1 text-left text-blue-muted font-normal">Name</th>
              <th className="px-2 py-1 text-left text-blue-muted font-normal">Type</th>
              <th className="px-2 py-1 text-right text-blue-muted font-normal">Start</th>
              <th className="px-2 py-1 text-right text-blue-muted font-normal">Duration</th>
              <th className="px-2 py-1 text-left text-blue-muted font-normal">Layer</th>
            </tr>
          </thead>
          <tbody>
            {editor.children.map((child) => (
              <tr key={child.objectId} className="border-b border-blue-border/50 hover:bg-blue-border/10">
                <td className="px-2 py-1 text-gray-200">{child.name}</td>
                <td className="px-2 py-1 text-gray-400">{child.objectType}</td>
                <td className="px-2 py-1 text-right text-gray-400 font-mono">{child.startBeats.toFixed(2)}</td>
                <td className="px-2 py-1 text-right text-gray-400 font-mono">{child.durationBeats.toFixed(2)}</td>
                <td className="px-2 py-1 text-gray-500">{child.layerLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editor.generatedScoreText && (
        <div className="border-t border-blue-border shrink-0">
          <div className="px-3 py-1 text-body text-blue-muted">Generated Score Preview</div>
          <pre className="px-3 py-1 text-body text-gray-400 font-mono max-h-32 overflow-auto whitespace-pre-wrap">
            {editor.generatedScoreText}
          </pre>
        </div>
      )}
      {testOutput !== null && (
        <GeneratedScoreModal text={testOutput} onClose={clearTestOutput} />
      )}
    </div>
  );
}
