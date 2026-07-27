import React, { useMemo, useState } from 'react';
import type {
  BlueSynthBuilderInstrumentSnapshot,
  InstrumentPatch,
} from '../../../../../../shared/project-editor';
import SelectedCodeEditor from '../../editors/SelectedCodeEditor';
import { toUdoCompletionDefinitions } from '../../editors/udo-completion-scope';
import { createBsbReplacementKeys } from './bsb-completions';
import type { SelectedInstrumentEditorProps } from '../types';

type BsbCodeTab = 'instrumentText' | 'alwaysOnInstrumentText' | 'globalOrc' | 'globalSco';

const BSB_CODE_TABS: Array<{ key: BsbCodeTab; label: string }> = [
  { key: 'instrumentText', label: 'Instrument' },
  { key: 'alwaysOnInstrumentText', label: 'Always On' },
  { key: 'globalOrc', label: 'Global Orc' },
  { key: 'globalSco', label: 'Global Sco' },
];

export default function BSBCodeEditor({
  instrument,
  onInstrumentPatch,
  projectUdos,
}: SelectedInstrumentEditorProps & {
  instrument: BlueSynthBuilderInstrumentSnapshot;
}): React.ReactElement {
  const [activeTab, setActiveTab] = useState<BsbCodeTab>('instrumentText');
  const objectNamesSignature = instrument.objectNames.join('\u0000');
  const bsbReplacementKeys = useMemo(
    () => createBsbReplacementKeys(instrument.objectNames),
    [objectNamesSignature],
  );
  const orchestraCompletionOptions = useMemo(
    () => ({
      bsbReplacementKeys,
      contextUdos: toUdoCompletionDefinitions(instrument.udolist ?? []),
      projectUdos: toUdoCompletionDefinitions(projectUdos ?? []),
    }),
    [bsbReplacementKeys, instrument.udolist, projectUdos],
  );
  const scoreCompletionOptions = useMemo(
    () => ({ bsbReplacementKeys }),
    [bsbReplacementKeys],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative min-h-0 flex-1">
        {BSB_CODE_TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <div
              key={tab.key}
              className={isActive ? 'relative h-full p-3' : 'pointer-events-none absolute inset-0 p-3'}
              aria-hidden={!isActive}
              style={{ visibility: isActive ? 'visible' : 'hidden' }}
            >
              <SelectedCodeEditor
                active={isActive}
                value={instrument[tab.key]}
                placeholder="Enter BlueSynthBuilder Csound code"
                ariaLabel={`${instrument.name || 'BlueSynthBuilder'} ${tab.label} code editor`}
                javaBlueCompletionOptions={
                  tab.key === 'globalSco' ? scoreCompletionOptions : orchestraCompletionOptions
                }
                onChange={(nextValue) =>
                  void onInstrumentPatch({ [tab.key]: nextValue } as InstrumentPatch)
                }
              />
            </div>
          );
        })}
      </div>
      <div className="border-t border-blue-border bg-app-surface-strong px-2">
        <div className="flex items-end gap-1">
          {BSB_CODE_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              data-bsb-code-tab={tab.key}
              className={[
                'border-t-2 px-3 py-2 text-body',
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
      </div>
    </div>
  );
}
