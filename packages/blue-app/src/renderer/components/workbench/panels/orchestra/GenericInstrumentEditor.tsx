import React, { useState } from 'react';
import type { GenericInstrumentSnapshot } from '../../../../../shared/project-editor';
import SelectedCodeEditor from '../editors/SelectedCodeEditor';
import EmbeddedUdoPanel from './EmbeddedUdoPanel';
import type { SelectedInstrumentEditorProps } from './types';

type GenericTab = 'instrument' | 'udo' | 'globalOrc' | 'globalSco';

const GENERIC_TABS: Array<{ key: GenericTab; label: string }> = [
  { key: 'instrument', label: 'Instrument' },
  { key: 'udo', label: 'UDO' },
  { key: 'globalOrc', label: 'Global Orc' },
  { key: 'globalSco', label: 'Global Sco' },
];

function getTabValue(instrument: GenericInstrumentSnapshot, tab: GenericTab): string {
  switch (tab) {
    case 'instrument':
      return instrument.text;
    case 'udo':
      return '';
    case 'globalOrc':
      return instrument.globalOrc;
    case 'globalSco':
      return instrument.globalSco;
  }
}

export default function GenericInstrumentEditor({
  instrument,
  onInstrumentPatch,
}: SelectedInstrumentEditorProps & {
  instrument: GenericInstrumentSnapshot;
}): React.ReactElement {
  const [activeTab, setActiveTab] = useState<GenericTab>('instrument');

  return (
    <div className="flex h-full min-h-0 flex-col bg-blue-bg">
      <div className="flex items-center gap-1 border-b border-blue-border bg-app-surface-strong px-2">
        {GENERIC_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={[
              'border-b-2 px-3 py-2 text-body',
              activeTab === tab.key
                ? 'border-blue-accent text-gray-100'
                : 'border-transparent text-blue-muted hover:text-gray-100',
            ].join(' ')}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="relative min-h-0 flex-1">
        {GENERIC_TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <div
              key={tab.key}
              className={isActive ? 'relative h-full p-3' : 'pointer-events-none absolute inset-0 p-3'}
              aria-hidden={!isActive}
              style={{ visibility: isActive ? 'visible' : 'hidden' }}
            >
              {tab.key === 'udo' ? (
                <EmbeddedUdoPanel
                  assignmentId={instrument.assignmentId}
                  udolist={instrument.udolist ?? []}
                  resetKey={instrument.assignmentId}
                  onInstrumentPatch={onInstrumentPatch}
                />
              ) : (
                <SelectedCodeEditor
                  active={isActive}
                  value={getTabValue(instrument, tab.key)}
                  placeholder="Enter instrument Csound code"
                  ariaLabel={`${instrument.name || 'Generic Instrument'} ${tab.label} code editor`}
                  onChange={(nextValue) => {
                    if (tab.key === 'instrument') {
                      void onInstrumentPatch({ text: nextValue });
                    } else if (tab.key === 'globalOrc') {
                      void onInstrumentPatch({ globalOrc: nextValue });
                    } else {
                      void onInstrumentPatch({ globalSco: nextValue });
                    }
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
