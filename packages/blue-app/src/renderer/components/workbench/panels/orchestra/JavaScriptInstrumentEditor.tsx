import React, { useMemo, useState } from 'react';
import type { JavaScriptInstrumentSnapshot } from '../../../../../shared/project-editor';
import SelectedCodeEditor from '../editors/SelectedCodeEditor';
import { toUdoCompletionDefinitions } from '../editors/udo-completion-scope';
import EmbeddedUdoPanel from './EmbeddedUdoPanel';
import type { SelectedInstrumentEditorProps } from './types';
import type { ProjectDocumentCommitMetadata } from '../../../../../shared/project-history';
import { cn } from '../../../../lib/cn';

type JavaScriptTab = 'instrument' | 'udo' | 'globalOrc' | 'globalSco';

const JAVASCRIPT_TABS: Array<{ key: JavaScriptTab; label: string }> = [
  { key: 'instrument', label: 'Instrument' },
  { key: 'udo', label: 'UDO' },
  { key: 'globalOrc', label: 'Global Orc' },
  { key: 'globalSco', label: 'Global Sco' },
];

export default function JavaScriptInstrumentEditor({
  instrument,
  onInstrumentPatch,
  projectUdos,
  embeddedUdoTarget,
}: SelectedInstrumentEditorProps & {
  instrument: JavaScriptInstrumentSnapshot;
}): React.ReactElement {
  const [activeTab, setActiveTab] = useState<JavaScriptTab>('instrument');

  const orchestraCompletionOptions = useMemo(
    () => ({
      contextUdos: toUdoCompletionDefinitions(instrument.udolist ?? []),
      projectUdos: toUdoCompletionDefinitions(projectUdos ?? []),
    }),
    [instrument.udolist, projectUdos],
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-blue-bg">
      <div className="flex items-center gap-1 border-b border-blue-border bg-app-surface-strong px-2">
        {JAVASCRIPT_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={cn(
              'border-b-2 px-3 py-2 text-role-body',
              activeTab === tab.key
                ? 'border-blue-accent text-app-text-strong'
                : 'border-transparent text-blue-muted hover:text-app-text-strong',
            )}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="relative min-h-0 flex-1">
        {JAVASCRIPT_TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <div
              key={tab.key}
              className={
                isActive ? 'relative h-full p-3' : 'pointer-events-none absolute inset-0 p-3'
              }
              aria-hidden={!isActive}
              style={{ visibility: isActive ? 'visible' : 'hidden' }}
            >
              {tab.key === 'instrument' ? (
                <textarea
                  className="h-full w-full resize-none rounded-lg border border-blue-border bg-app-input px-4 py-3 font-mono text-role-body text-app-text outline-none transition-colors placeholder:text-blue-muted focus:border-blue-accent"
                  spellCheck={false}
                  data-history-scope="project"
                  aria-label={`${instrument.name || 'JavaScript Instrument'} source editor`}
                  value={instrument.text}
                  onChange={(event) =>
                    void onInstrumentPatch(
                      { text: event.target.value },
                      {
                        fieldId: `instrument:${instrument.assignmentId}:text`,
                        gestureId: `project-text:instrument:${instrument.assignmentId}:text`,
                        label: 'Edit Instrument',
                        phase: 'update',
                      },
                    )
                  }
                />
              ) : tab.key === 'udo' ? (
                <EmbeddedUdoPanel
                  udolist={instrument.udolist ?? []}
                  projectUdos={projectUdos}
                  resetKey={instrument.assignmentId}
                  onInstrumentPatch={onInstrumentPatch}
                  libraryDropTarget={embeddedUdoTarget}
                />
              ) : (
                <SelectedCodeEditor
                  active={isActive}
                  value={tab.key === 'globalOrc' ? instrument.globalOrc : instrument.globalSco}
                  placeholder={`Enter ${tab.label} code`}
                  ariaLabel={`${instrument.name || 'JavaScript Instrument'} ${tab.label} code editor`}
                  typingGroupingMs={500}
                  historyMetadata={{
                    fieldId: `instrument:${instrument.assignmentId}:${tab.key}`,
                    gestureId: `project-text:instrument:${instrument.assignmentId}:${tab.key}`,
                    label: `Edit ${tab.label}`,
                    phase: 'update',
                  }}
                  javaBlueCompletionOptions={
                    tab.key === 'globalOrc' ? orchestraCompletionOptions : undefined
                  }
                  onChange={(nextValue, metadata?: ProjectDocumentCommitMetadata) =>
                    void onInstrumentPatch(
                      tab.key === 'globalOrc' ? { globalOrc: nextValue } : { globalSco: nextValue },
                      metadata,
                    )
                  }
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
