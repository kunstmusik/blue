import React from 'react';
import type { ProjectDocumentCommitMetadata } from '../../../../../shared/project-history';
import { useBatchedTextEditor } from '../../../../hooks/use-batched-text-editor';

interface InstrumentCommentsPanelProps {
  comment: string;
  onCommentChange: (
    comment: string,
    metadata?: ProjectDocumentCommitMetadata,
  ) => void | Promise<void>;
  fieldId?: string;
  label?: string;
  hostDocument?: Document | null;
}

export default function InstrumentCommentsPanel({
  comment,
  onCommentChange,
  fieldId = 'instrument-comments',
  label = 'Edit Instrument Comments',
  hostDocument,
}: InstrumentCommentsPanelProps): React.ReactElement {
  const {
    text,
    handleTextChange,
    handleSelectionChange,
    handleCompositionStart,
    handleCompositionEnd,
    flush,
  } = useBatchedTextEditor({
    value: comment,
    onChange: onCommentChange,
    fieldId,
    label,
    hostDocument,
  });

  return (
    <div className="flex h-full flex-col bg-blue-bg p-4">
      <textarea
        data-history-scope="project"
        className="h-full w-full resize-none rounded-lg border border-blue-border bg-app-input px-4 py-3 text-role-body text-app-text outline-none transition-colors placeholder:text-blue-muted focus:border-blue-accent"
        spellCheck={false}
        value={text}
        placeholder="Instrument comments"
        onChange={(event) => {
          const inputEvent = event.nativeEvent as InputEvent;
          handleTextChange(event.target.value, {
            inputType: inputEvent.inputType,
            insertedText: typeof inputEvent.data === 'string' ? inputEvent.data : undefined,
            isComposing: inputEvent.isComposing,
            selectionStart: event.target.selectionStart,
            selectionEnd: event.target.selectionEnd,
          });
        }}
        onSelect={(event) =>
          handleSelectionChange(
            event.currentTarget.selectionStart,
            event.currentTarget.selectionEnd,
          )
        }
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        onBlur={flush}
      />
    </div>
  );
}
