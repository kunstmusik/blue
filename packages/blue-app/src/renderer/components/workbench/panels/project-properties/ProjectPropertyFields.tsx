import React from 'react';
import type { ReactNode } from 'react';
import {
  APP_INSPECTOR_LABEL_TEXT_CLASS,
  COMPACT_FIELD_VALUE_CLASS,
} from '../shared/compactFieldStyles';
import { cn } from '../../../../lib/cn';
import type { ProjectDocumentCommitMetadata } from '../../../../../shared/project-history';
import { useBatchedTextEditor } from '../../../../hooks/use-batched-text-editor';

function FieldRow({ label, children }: { label: string; children: ReactNode }): React.ReactElement {
  return (
    <label className="grid gap-2 md:grid-cols-[200px_minmax(0,1fr)] md:items-start md:gap-5">
      <span className={cn('pt-1', APP_INSPECTOR_LABEL_TEXT_CLASS)}>{label}</span>
      {children}
    </label>
  );
}

function InputBase({
  value,
  disabled,
  onChange,
  placeholder,
  type = 'text',
  className,
  fieldId,
  label,
  historyScope = 'project',
}: {
  value: string;
  disabled: boolean;
  onChange: (value: string, metadata?: ProjectDocumentCommitMetadata) => void | Promise<void>;
  placeholder?: string;
  type?: string;
  className?: string;
  fieldId?: string;
  label?: string;
  historyScope?: 'project' | 'none';
}): React.ReactElement {
  const editor = useBatchedTextEditor({
    value,
    onChange,
    fieldId: fieldId ?? `project-property:${label ?? 'input'}`,
    label: label ?? 'Edit Project Property',
    debounceMs: historyScope === 'project' ? 500 : 0,
    hostDocument: historyScope === 'project' ? undefined : null,
  });

  return (
    <input
      type={type}
      className={cn(
        'w-full rounded-lg border border-app-border bg-app-input',
        COMPACT_FIELD_VALUE_CLASS,
        'text-app-text shadow-inner outline-none transition-colors placeholder:text-app-text-muted focus:border-app-accent disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      data-history-scope={historyScope}
      value={editor.text}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(event) => {
        const inputEvent = event.nativeEvent as InputEvent;
        editor.handleTextChange(event.target.value, {
          inputType: inputEvent.inputType,
          insertedText: typeof inputEvent.data === 'string' ? inputEvent.data : undefined,
          isComposing: inputEvent.isComposing,
          selectionStart: event.currentTarget.selectionStart,
          selectionEnd: event.currentTarget.selectionEnd,
        });
      }}
      onSelect={(event) =>
        editor.handleSelectionChange(
          event.currentTarget.selectionStart,
          event.currentTarget.selectionEnd,
        )
      }
      onCompositionStart={editor.handleCompositionStart}
      onCompositionEnd={editor.handleCompositionEnd}
      onBlur={editor.flush}
    />
  );
}

function TextAreaBase({
  value,
  disabled,
  onChange,
  placeholder,
  className,
  fieldId,
  label,
  historyScope = 'project',
}: {
  value: string;
  disabled: boolean;
  onChange: (value: string, metadata?: ProjectDocumentCommitMetadata) => void | Promise<void>;
  placeholder?: string;
  className?: string;
  fieldId?: string;
  label?: string;
  historyScope?: 'project' | 'none';
}): React.ReactElement {
  const editor = useBatchedTextEditor({
    value,
    onChange,
    fieldId: fieldId ?? `project-property:${label ?? 'textarea'}`,
    label: label ?? 'Edit Project Property',
    debounceMs: historyScope === 'project' ? 500 : 0,
    hostDocument: historyScope === 'project' ? undefined : null,
  });

  return (
    <textarea
      className={cn(
        'min-h-28 w-full rounded-lg border border-app-border bg-app-input',
        COMPACT_FIELD_VALUE_CLASS,
        'text-app-text shadow-inner outline-none transition-colors placeholder:text-app-text-muted focus:border-app-accent disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      data-history-scope={historyScope}
      value={editor.text}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(event) => {
        const inputEvent = event.nativeEvent as InputEvent;
        editor.handleTextChange(event.target.value, {
          inputType: inputEvent.inputType,
          insertedText: typeof inputEvent.data === 'string' ? inputEvent.data : undefined,
          isComposing: inputEvent.isComposing,
          selectionStart: event.currentTarget.selectionStart,
          selectionEnd: event.currentTarget.selectionEnd,
        });
      }}
      onSelect={(event) =>
        editor.handleSelectionChange(
          event.currentTarget.selectionStart,
          event.currentTarget.selectionEnd,
        )
      }
      onCompositionStart={editor.handleCompositionStart}
      onCompositionEnd={editor.handleCompositionEnd}
      onBlur={editor.flush}
    />
  );
}

function CheckboxBase({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void | Promise<void>;
}): React.ReactElement {
  return (
    <input
      type="checkbox"
      className="mt-2 h-4 w-4 rounded border-app-border bg-app-input accent-app-accent focus:ring-app-accent disabled:cursor-not-allowed disabled:opacity-60"
      checked={checked}
      disabled={disabled}
      data-history-scope="project"
      onChange={(event) => onChange(event.target.checked)}
    />
  );
}

export { FieldRow, InputBase, TextAreaBase, CheckboxBase };
