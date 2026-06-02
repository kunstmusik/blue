import React from 'react';

interface ProjectTextEditorPanelProps {
  value: string;
  placeholder: string;
  emptyTitle: string;
  emptyDescription: string;
  disabled: boolean;
  onChange: (value: string) => void | Promise<void>;
}

export default function ProjectTextEditorPanel({
  value,
  placeholder,
  emptyTitle,
  emptyDescription,
  disabled,
  onChange,
}: ProjectTextEditorPanelProps): React.ReactElement {
  if (disabled) {
    return (
      <div className="flex h-full flex-col bg-blue-bg text-gray-100">
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="max-w-lg rounded-lg border border-blue-border bg-blue-surface/70 px-6 py-5 text-center">
            <div className="text-sm font-medium text-gray-100">{emptyTitle}</div>
            <div className="mt-2 text-sm text-blue-muted">{emptyDescription}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-blue-bg text-app-text">
      <div className="flex-1 min-h-0 p-4">
        <textarea
          className="h-full w-full resize-none rounded-lg border border-blue-border bg-app-input px-4 py-3 font-mono text-sm text-app-text outline-none transition-colors placeholder:text-blue-muted focus:border-blue-accent"
          spellCheck={false}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </div>
  );
}
