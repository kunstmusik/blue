import React from 'react';
import SelectedCodeEditor from '../editors/SelectedCodeEditor';

interface CodeRepositorySnippetEditorProps {
  /** Snippet name (read-only display; renaming happens in the tree). */
  readonly name: string;
  readonly code: string;
  readonly onChange: (code: string) => void;
}

/**
 * Edits the selected snippet's code text using the shared CodeMirror surface.
 * Preserves exact code text including whitespace, tabs, and unicode.
 */
export default function CodeRepositorySnippetEditor({
  name,
  code,
  onChange,
}: CodeRepositorySnippetEditorProps): React.ReactElement {
  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 truncate text-role-callout text-app-text-muted" title={name}>
        {name}
      </div>
      <div className="min-h-0 flex-1">
        <SelectedCodeEditor
          value={code}
          ariaLabel={`Code Repository snippet: ${name}`}
          mode="orc"
          onChange={onChange}
        />
      </div>
    </div>
  );
}
