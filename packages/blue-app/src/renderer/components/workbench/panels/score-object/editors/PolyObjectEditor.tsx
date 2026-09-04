import React from 'react';
import type { ScoreObjectEditorComponentProps } from '../editor-registry';

export default function PolyObjectEditor({
  document,
}: ScoreObjectEditorComponentProps): React.ReactElement {
  const editor = document.editor;
  if (editor.kind !== 'structured' || editor.editorFamily !== 'PolyObject') return <></>;

  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-blue-muted">
      <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18" />
        <path d="M9 21V9" />
      </svg>
      <span className="text-role-body">
        PolyObject — double-click in the score to navigate into this group
      </span>
    </div>
  );
}
