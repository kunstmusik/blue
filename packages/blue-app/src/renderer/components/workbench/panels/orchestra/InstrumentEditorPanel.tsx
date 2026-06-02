import React, { useCallback, useState } from 'react';
import type { InstrumentSnapshot } from '../../../../../shared/project-editor';
import type { InstrumentPatch } from '../../../../../shared/project-editor';
import BlueSynthBuilderEditor from './BlueSynthBuilderEditor';
import BlueX7Editor from './BlueX7Editor';
import GenericInstrumentEditor from './GenericInstrumentEditor';
import InstrumentCommentsPanel from './InstrumentCommentsPanel';
import JavaScriptInstrumentEditor from './JavaScriptInstrumentEditor';
import PythonInstrumentDummyPanel from './PythonInstrumentDummyPanel';
import type { OrchestraMutationProps } from './types';

interface InstrumentEditorPanelProps extends OrchestraMutationProps {
  instrument: InstrumentSnapshot | undefined;
}

const EditorSurface = React.memo(function EditorSurface({
  instrument,
  onOrchestraPatch,
}: {
  instrument: InstrumentSnapshot;
} & OrchestraMutationProps): React.ReactElement {
  const dispatchInstrumentPatch = useCallback(
    (patch: InstrumentPatch) =>
      onOrchestraPatch({
        type: 'updateInstrument',
        assignmentId: instrument.assignmentId,
        patch,
      }),
    [instrument.assignmentId, onOrchestraPatch],
  );

  switch (instrument.type) {
    case 'generic':
      return (
        <GenericInstrumentEditor
          instrument={instrument}
          onInstrumentPatch={dispatchInstrumentPatch}
          onOrchestraPatch={onOrchestraPatch}
        />
      );
    case 'javascript':
      return (
        <JavaScriptInstrumentEditor
          instrument={instrument}
          onInstrumentPatch={dispatchInstrumentPatch}
          onOrchestraPatch={onOrchestraPatch}
        />
      );
    case 'python':
      return (
        <PythonInstrumentDummyPanel
          instrument={instrument}
          onInstrumentPatch={dispatchInstrumentPatch}
          onOrchestraPatch={onOrchestraPatch}
        />
      );
    case 'blueX7':
      return (
        <BlueX7Editor
          instrument={instrument}
          onInstrumentPatch={dispatchInstrumentPatch}
          onOrchestraPatch={onOrchestraPatch}
        />
      );
    case 'blueSynthBuilder':
      return (
        <BlueSynthBuilderEditor
          instrument={instrument}
          onInstrumentPatch={dispatchInstrumentPatch}
          onOrchestraPatch={onOrchestraPatch}
        />
      );
    case 'unknown':
      return (
        <div className="flex h-full items-center justify-center p-6 text-center text-sm text-blue-muted">
          Unsupported instrument type: {instrument.instrumentType}
        </div>
      );
  }

  return (
    <div className="flex h-full items-center justify-center p-6 text-sm text-blue-muted">
      Unsupported instrument.
    </div>
  );
});

function InstrumentEditorPanel({
  instrument,
  onOrchestraPatch,
}: InstrumentEditorPanelProps): React.ReactElement {
  const [activeTab, setActiveTab] = useState<'editor' | 'comments'>('editor');
  const assignmentId = instrument?.assignmentId;
  const handleCommentChange = useCallback(
    (comment: string) => {
      if (!assignmentId) {
        return;
      }

      onOrchestraPatch({
        type: 'updateInstrumentComment',
        assignmentId,
        comment,
      });
    },
    [assignmentId, onOrchestraPatch],
  );

  if (!instrument) {
    return (
      <section className="flex h-full flex-col bg-blue-bg" aria-label="Instrument editor">
        <div className="border-b border-blue-border bg-app-surface-strong px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-muted">
          Instrument Editor
        </div>
        <div className="flex flex-1 items-center justify-center p-6 text-sm text-blue-muted">
          Select an arrangement instrument to edit.
        </div>
      </section>
    );
  }

  return (
    <section className="flex h-full min-h-0 flex-col bg-blue-bg" aria-label="Instrument editor">
      <div className="flex items-center gap-1 border-b border-blue-border bg-app-surface-strong px-2">
        <button
          type="button"
          className={[
            'border-b-2 px-3 py-2 text-xs',
            activeTab === 'editor'
              ? 'border-blue-accent text-app-text-strong'
              : 'border-transparent text-blue-muted hover:text-app-text-strong',
          ].join(' ')}
          onClick={() => setActiveTab('editor')}
        >
          Instrument Editor
        </button>
        <button
          type="button"
          className={[
            'border-b-2 px-3 py-2 text-xs',
            activeTab === 'comments'
              ? 'border-blue-accent text-app-text-strong'
              : 'border-transparent text-blue-muted hover:text-app-text-strong',
          ].join(' ')}
          onClick={() => setActiveTab('comments')}
        >
          Comments
        </button>
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          className={activeTab === 'editor' ? 'relative h-full' : 'pointer-events-none absolute inset-0'}
          aria-hidden={activeTab !== 'editor'}
          style={{ visibility: activeTab === 'editor' ? 'visible' : 'hidden' }}
        >
          <EditorSurface instrument={instrument} onOrchestraPatch={onOrchestraPatch} />
        </div>
        <div
          className={activeTab === 'comments' ? 'relative h-full' : 'pointer-events-none absolute inset-0'}
          aria-hidden={activeTab !== 'comments'}
          style={{ visibility: activeTab === 'comments' ? 'visible' : 'hidden' }}
        >
          <InstrumentCommentsPanel
            comment={instrument.comment}
            onCommentChange={handleCommentChange}
          />
        </div>
      </div>
    </section>
  );
}

export default React.memo(InstrumentEditorPanel);
