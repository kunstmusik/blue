import React from 'react';
import { useProjectStore } from '../../../stores/project-store';

export default function ScratchPadPanel(): React.ReactElement {
  const loaded = useProjectStore((state) => state.loaded);
  const scratchPad = useProjectStore((state) => state.scratchPad);
  const updateScratchPad = useProjectStore((state) => state.updateScratchPad);

  if (!loaded) {
    return (
      <div className="flex h-full items-center justify-center bg-blue-bg p-4 text-center text-sm text-blue-muted">
        No project loaded
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-blue-bg text-app-text">
      <div className="min-h-0 flex-1 p-3">
        <textarea
          aria-label="Scratch Pad"
          className={`h-full w-full resize-none overflow-auto rounded-lg border border-blue-border bg-app-input px-3 py-2.5 font-mono text-sm leading-6 text-app-text outline-none transition-colors placeholder:text-blue-muted focus:border-blue-accent ${scratchPad.wordWrapEnabled ? 'whitespace-pre-wrap' : 'whitespace-pre'}`}
          disabled={!loaded}
          placeholder="Write project notes…"
          spellCheck={false}
          value={scratchPad.text}
          wrap={scratchPad.wordWrapEnabled ? 'soft' : 'off'}
          onChange={(event) => {
            void updateScratchPad({ text: event.target.value });
          }}
        />
      </div>

      <div className="flex shrink-0 items-center border-t border-blue-border/60 bg-blue-surface/60 px-3 py-2">
        <label className="flex cursor-pointer items-center gap-2 text-ui text-app-text-muted">
          <input
            checked={scratchPad.wordWrapEnabled}
            className="accent-app-accent"
            type="checkbox"
            onChange={(event) => {
              void updateScratchPad({ wordWrapEnabled: event.target.checked });
            }}
          />
          Word Wrap
        </label>
      </div>
    </div>
  );
}
