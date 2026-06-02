import React from 'react';

interface InstrumentCommentsPanelProps {
  comment: string;
  onCommentChange: (comment: string) => void | Promise<void>;
}

export default function InstrumentCommentsPanel({
  comment,
  onCommentChange,
}: InstrumentCommentsPanelProps): React.ReactElement {
  return (
    <div className="flex h-full flex-col bg-blue-bg p-4">
      <textarea
        className="h-full w-full resize-none rounded-lg border border-blue-border bg-app-input px-4 py-3 text-sm text-app-text outline-none transition-colors placeholder:text-blue-muted focus:border-blue-accent"
        spellCheck={false}
        value={comment}
        placeholder="Instrument comments"
        onChange={(event) => void onCommentChange(event.target.value)}
      />
    </div>
  );
}

