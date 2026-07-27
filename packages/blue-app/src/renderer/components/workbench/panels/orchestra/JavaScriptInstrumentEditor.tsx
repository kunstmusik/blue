import React, { useMemo, useState } from 'react';
import type { JavaScriptInstrumentSnapshot } from '../../../../../shared/project-editor';
import SelectedCodeEditor from '../editors/SelectedCodeEditor';
import { toUdoCompletionDefinitions } from '../editors/udo-completion-scope';
import EmbeddedUdoPanel from './EmbeddedUdoPanel';
import type { SelectedInstrumentEditorProps } from './types';

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
            className={[
              'border-b-2 px-3 py-2 text-body',
              activeTab === tab.key
                ? 'border-blue-accent text-app-text-strong'
                : 'border-transparent text-blue-muted hover:text-app-text-strong',
            ].join(' ')}
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
              className={isActive ? 'relative h-full p-3' : 'pointer-events-none absolute inset-0 p-3'}
              aria-hidden={!isActive}
              style={{ visibility: isActive ? 'visible' : 'hidden' }}
            >
              {tab.key === 'instrument' ? (
                <textarea
                  className="h-full w-full resize-none rounded-lg border border-blue-border bg-app-input px-4 py-3 font-mono text-sm text-app-text outline-none transition-colors placeholder:text-blue-muted focus:border-blue-accent"
                  spellCheck={false}
                  value={instrument.text}
                  onChange={(event) => void onInstrumentPatch({ text: event.target.value })}
                />
              ) : tab.key === 'udo' ? (
                <EmbeddedUdoPanel
                  assignmentId={instrument.assignmentId}
                  udolist={instrument.udolist ?? []}
                  projectUdos={projectUdos}
                  resetKey={instrument.assignmentId}
                  onInstrumentPatch={onInstrumentPatch}
                />
              ) : (
                <SelectedCodeEditor
                  active={isActive}
                  value={tab.key === 'globalOrc' ? instrument.globalOrc : instrument.globalSco}
                  placeholder={`Enter ${tab.label} code`}
                  ariaLabel={`${instrument.name || 'JavaScript Instrument'} ${tab.label} code editor`}
                  javaBlueCompletionOptions={
                    tab.key === 'globalOrc' ? orchestraCompletionOptions : undefined
                  }
                  onChange={(nextValue) =>
                    void onInstrumentPatch(
                      tab.key === 'globalOrc'
                        ? { globalOrc: nextValue }
                        : { globalSco: nextValue },
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
