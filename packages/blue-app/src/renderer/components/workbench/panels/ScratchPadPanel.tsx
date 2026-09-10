import React from 'react';
import type { ProjectDocumentCommitMetadata } from '../../../../shared/project-history';
import { useProjectStore } from '../../../stores/project-store';
import { cn } from '../../../lib/cn';
import { useBatchedTextEditor } from '../../../hooks/use-batched-text-editor';

export default function ScratchPadPanel(): React.ReactElement {
  const loaded = useProjectStore((state) => state.loaded);
  const scratchPad = useProjectStore((state) => state.scratchPad);
  const updateScratchPad = useProjectStore((state) => state.updateScratchPad);
  const editor = useBatchedTextEditor({
    value: scratchPad.text,
    onChange: (text, metadata?: ProjectDocumentCommitMetadata) =>
      updateScratchPad({ text }, metadata),
    fieldId: 'scratch-pad.text',
    label: 'Edit Scratch Pad',
  });

  if (!loaded) {
    return (
      <div className="flex h-full items-center justify-center bg-blue-bg p-4 text-center text-role-body text-blue-muted">
        No project loaded
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-blue-bg text-app-text">
      <div className="min-h-0 flex-1 p-3">
        <textarea
          aria-label="Scratch Pad"
          className={cn(
            'h-full w-full resize-none overflow-auto rounded-lg border border-blue-border bg-app-input px-3 py-2.5 font-mono text-role-body text-app-text outline-none transition-colors placeholder:text-blue-muted focus:border-blue-accent',
            scratchPad.wordWrapEnabled ? 'whitespace-pre-wrap' : 'whitespace-pre',
          )}
          disabled={!loaded}
          placeholder="Write project notes…"
          spellCheck={false}
          value={editor.text}
          wrap={scratchPad.wordWrapEnabled ? 'soft' : 'off'}
          data-history-scope="project"
          onChange={(event) => {
            const inputEvent = event.nativeEvent as InputEvent;
            editor.handleTextChange(event.target.value, {
              inputType: inputEvent.inputType,
              insertedText: typeof inputEvent.data === 'string' ? inputEvent.data : undefined,
              isComposing: inputEvent.isComposing,
              selectionStart: event.target.selectionStart,
              selectionEnd: event.target.selectionEnd,
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
      </div>

      <div className="flex shrink-0 items-center border-t border-blue-border/60 bg-blue-surface/60 px-3 py-2">
        <label className="flex cursor-pointer items-center gap-2 text-role-callout text-app-text-muted">
          <input
            checked={scratchPad.wordWrapEnabled}
            className="accent-app-accent"
            type="checkbox"
            onChange={(event) => {
              void updateScratchPad(
                { wordWrapEnabled: event.target.checked },
                {
                  label: event.target.checked
                    ? 'Enable Scratch Pad Word Wrap'
                    : 'Disable Scratch Pad Word Wrap',
                  phase: 'single',
                },
              );
            }}
          />
          Word Wrap
        </label>
      </div>
    </div>
  );
}
