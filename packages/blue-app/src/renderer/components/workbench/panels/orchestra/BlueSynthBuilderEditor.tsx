import React, { useState } from 'react';
import type { BlueSynthBuilderInstrumentSnapshot } from '../../../../../shared/project-editor';
import BSBCodeEditor from './bsb/BSBCodeEditor';
import BSBInterfaceEditor from './bsb/BSBInterfaceEditor';
import BSBUDOPanel from './bsb/BSBUDOPanel';
import type { SelectedInstrumentEditorProps } from './types';

type BsbEditorTab = 'interface' | 'code' | 'udo';

function BlueSynthBuilderEditor({
  instrument,
  onInstrumentPatch,
  onOrchestraPatch,
}: SelectedInstrumentEditorProps & {
  instrument: BlueSynthBuilderInstrumentSnapshot;
}): React.ReactElement {
  const [activeTab, setActiveTab] = useState<BsbEditorTab>('interface');

  return (
    <div className="flex h-full min-h-0 flex-col bg-blue-bg">
      <div className="border-b border-blue-border bg-app-surface-strong px-2">
        <div className="flex items-end gap-1">
          <button
            type="button"
            data-bsb-editor-tab="interface"
            className={[
              'border-b-2 px-3 py-2 text-xs',
              activeTab === 'interface'
                ? 'border-blue-accent text-app-text-strong'
                : 'border-transparent text-blue-muted hover:text-app-text-strong',
            ].join(' ')}
            onClick={() => setActiveTab('interface')}
          >
            Interface
          </button>
          <button
            type="button"
            data-bsb-editor-tab="code"
            className={[
              'border-b-2 px-3 py-2 text-xs',
              activeTab === 'code'
                ? 'border-blue-accent text-gray-100'
                : 'border-transparent text-blue-muted hover:text-gray-100',
            ].join(' ')}
            onClick={() => setActiveTab('code')}
          >
            Code
          </button>
          <button
            type="button"
            data-bsb-editor-tab="udo"
            className={[
              'border-b-2 px-3 py-2 text-xs',
              activeTab === 'udo'
                ? 'border-blue-accent text-gray-100'
                : 'border-transparent text-blue-muted hover:text-gray-100',
            ].join(' ')}
            onClick={() => setActiveTab('udo')}
          >
            UDO
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <div className={activeTab === 'interface' ? 'h-full' : 'hidden'} aria-hidden={activeTab !== 'interface'}>
          <BSBInterfaceEditor instrument={instrument} onInstrumentPatch={onInstrumentPatch} />
        </div>
        <div className={activeTab === 'code' ? 'h-full' : 'hidden'} aria-hidden={activeTab !== 'code'}>
          <BSBCodeEditor
            instrument={instrument}
            onInstrumentPatch={onInstrumentPatch}
            onOrchestraPatch={onOrchestraPatch}
          />
        </div>
        <div className={activeTab === 'udo' ? 'h-full' : 'hidden'} aria-hidden={activeTab !== 'udo'}>
          <BSBUDOPanel instrument={instrument} onInstrumentPatch={onInstrumentPatch} />
        </div>
      </div>
    </div>
  );
}

export default React.memo(BlueSynthBuilderEditor);
