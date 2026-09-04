import React, { Suspense, useCallback, useEffect, useState } from 'react';
import type {
  InstrumentSnapshot,
  UdoDefinitionSnapshot,
} from '../../../../../shared/project-editor';
import type { InstrumentPatch } from '../../../../../shared/project-editor';
import type { BlueX7RuntimeTarget } from '../../../../../shared/project-editor/contract';
import InstrumentCommentsPanel from './InstrumentCommentsPanel';
import type { OrchestraMutationProps } from './types';
import type { UdoLibraryDropTarget } from '../udo/UdoTable';
import { cn } from '../../../../lib/cn';

const BlueSynthBuilderEditor = React.lazy(() => import('./BlueSynthBuilderEditor'));
const BlueX7Editor = React.lazy(() => import('../../../instruments/blue-x7-editor'));
const GenericInstrumentEditor = React.lazy(() => import('./GenericInstrumentEditor'));
const JavaScriptInstrumentEditor = React.lazy(() => import('./JavaScriptInstrumentEditor'));
const PythonInstrumentEditor = React.lazy(() => import('./PythonInstrumentEditor'));

interface InstrumentEditorPanelProps extends OrchestraMutationProps {
  instrument: InstrumentSnapshot | undefined;
  /** Explicit host-owned project scope; library hosts pass an empty list. */
  projectUdos: readonly UdoDefinitionSnapshot[];
  embeddedUdoTarget?: UdoLibraryDropTarget;
  blueX7Runtime?: {
    target: BlueX7RuntimeTarget;
    projectSessionId: number;
    enabled: boolean;
    onObservationStart?: () => void;
    onObservationResult?: () => void;
  };
  onEditorUsable?: () => void;
}

const EditorSurface = React.memo(function EditorSurface({
  instrument,
  projectUdos,
  onOrchestraPatch,
  embeddedUdoTarget,
  blueX7Runtime,
  onEditorUsable,
}: {
  instrument: InstrumentSnapshot;
  projectUdos: readonly UdoDefinitionSnapshot[];
  embeddedUdoTarget?: UdoLibraryDropTarget;
  blueX7Runtime?: InstrumentEditorPanelProps['blueX7Runtime'];
  onEditorUsable?: () => void;
} & OrchestraMutationProps): React.ReactElement {
  useEffect(() => {
    onEditorUsable?.();
  }, [instrument.assignmentId, instrument.type, onEditorUsable]);

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
          projectUdos={projectUdos}
          onInstrumentPatch={dispatchInstrumentPatch}
          onOrchestraPatch={onOrchestraPatch}
          embeddedUdoTarget={embeddedUdoTarget}
        />
      );
    case 'javascript':
      return (
        <JavaScriptInstrumentEditor
          instrument={instrument}
          projectUdos={projectUdos}
          onInstrumentPatch={dispatchInstrumentPatch}
          onOrchestraPatch={onOrchestraPatch}
          embeddedUdoTarget={embeddedUdoTarget}
        />
      );
    case 'python':
      return (
        <PythonInstrumentEditor
          instrument={instrument}
          projectUdos={projectUdos}
          onInstrumentPatch={dispatchInstrumentPatch}
          onOrchestraPatch={onOrchestraPatch}
          embeddedUdoTarget={embeddedUdoTarget}
        />
      );
    case 'blueX7':
      return (
        <BlueX7Editor
          instrument={instrument}
          onInstrumentPatch={dispatchInstrumentPatch}
          onOrchestraPatch={onOrchestraPatch}
          effectiveValues={blueX7Runtime}
        />
      );
    case 'blueSynthBuilder':
      return (
        <BlueSynthBuilderEditor
          instrument={instrument}
          projectUdos={projectUdos}
          onInstrumentPatch={dispatchInstrumentPatch}
          onOrchestraPatch={onOrchestraPatch}
          embeddedUdoTarget={embeddedUdoTarget}
        />
      );
    case 'unknown':
      return (
        <div className="flex h-full items-center justify-center p-6 text-center text-role-body text-blue-muted">
          Unsupported instrument type: {instrument.instrumentType}
        </div>
      );
  }

  return (
    <div className="flex h-full items-center justify-center p-6 text-role-body text-blue-muted">
      Unsupported instrument.
    </div>
  );
});

function InstrumentEditorPanel({
  instrument,
  onOrchestraPatch,
  projectUdos,
  embeddedUdoTarget,
  blueX7Runtime,
  onEditorUsable,
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
        <div className="border-b border-blue-border bg-app-surface-strong px-3 py-2 text-role-callout font-semibold uppercase tracking-[0.18em] text-blue-muted">
          Instrument Editor
        </div>
        <div className="flex flex-1 items-center justify-center p-6 text-role-body text-blue-muted">
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
          className={cn(
            'border-b-2 px-3 py-2 text-role-body',
            activeTab === 'editor'
              ? 'border-blue-accent text-app-text-strong'
              : 'border-transparent text-blue-muted hover:text-app-text-strong',
          )}
          onClick={() => setActiveTab('editor')}
        >
          Instrument Editor
        </button>
        <button
          type="button"
          className={cn(
            'border-b-2 px-3 py-2 text-role-body',
            activeTab === 'comments'
              ? 'border-blue-accent text-app-text-strong'
              : 'border-transparent text-blue-muted hover:text-app-text-strong',
          )}
          onClick={() => setActiveTab('comments')}
        >
          Comments
        </button>
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          className={
            activeTab === 'editor' ? 'relative h-full' : 'pointer-events-none absolute inset-0'
          }
          aria-hidden={activeTab !== 'editor'}
          style={{ visibility: activeTab === 'editor' ? 'visible' : 'hidden' }}
        >
          <Suspense
            fallback={
              <div
                aria-hidden="true"
                className="h-full bg-blue-bg"
                data-instrument-editor-loading
              />
            }
          >
            <EditorSurface
              instrument={instrument}
              projectUdos={projectUdos}
              onOrchestraPatch={onOrchestraPatch}
              embeddedUdoTarget={embeddedUdoTarget}
              blueX7Runtime={blueX7Runtime}
              onEditorUsable={onEditorUsable}
            />
          </Suspense>
        </div>
        <div
          className={
            activeTab === 'comments' ? 'relative h-full' : 'pointer-events-none absolute inset-0'
          }
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
