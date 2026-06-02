import React from 'react';
import type { ScoreObjectEditorComponentProps } from '../editor-registry';

export default function UnsupportedScoreObjectEditor({ document }: ScoreObjectEditorComponentProps): React.ReactElement {
  const editor = document.editor;
  const message = editor.kind === 'fallback'
    ? editor.message
    : `Editor for ${document.target.editorObjectType} is not yet available.`;

  return (
    <div className="flex h-full items-center justify-center bg-blue-bg px-6 text-center">
      <div className="max-w-sm">
        <div className="text-sm text-blue-muted mb-1">{message}</div>
        {document.target.editorObjectType && (
          <div className="text-body text-blue-muted/60">{document.target.editorObjectType}</div>
        )}
      </div>
    </div>
  );
}
