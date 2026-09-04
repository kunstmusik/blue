import React, { useState } from 'react';
import type { BlueSynthBuilderInstrumentSnapshot } from '../../../../../shared/project-editor';
import BSBCodeEditor from './bsb/BSBCodeEditor';
import BSBInterfaceEditor from './bsb/BSBInterfaceEditor';
import BSBUDOPanel from './bsb/BSBUDOPanel';
import type { SelectedInstrumentEditorProps } from './types';
import { cn } from '../../../../lib/cn';

type BsbEditorTab = 'interface' | 'code' | 'udo';

function BlueSynthBuilderEditor({
  instrument,
  onInstrumentPatch,
  onOrchestraPatch,
  projectUdos,
  embeddedUdoTarget,
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
            className={cn(
              'border-b-2 px-3 py-2 text-role-body',
              activeTab === 'interface'
                ? 'border-blue-accent text-app-text-strong'
                : 'border-transparent text-blue-muted hover:text-app-text-strong'
            )}
            onClick={() => setActiveTab('interface')}
          >
            Interface
          </button>
          <button
            type="button"
            data-bsb-editor-tab="code"
            className={cn(
              'border-b-2 px-3 py-2 text-role-body',
              activeTab === 'code'
                ? 'border-blue-accent text-gray-100'
                : 'border-transparent text-blue-muted hover:text-gray-100'
            )}
            onClick={() => setActiveTab('code')}
          >
            Code
          </button>
          <button
            type="button"
            data-bsb-editor-tab="udo"
            className={cn(
              'border-b-2 px-3 py-2 text-role-body',
              activeTab === 'udo'
                ? 'border-blue-accent text-gray-100'
                : 'border-transparent text-blue-muted hover:text-gray-100'
            )}
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
            projectUdos={projectUdos}
            onInstrumentPatch={onInstrumentPatch}
            onOrchestraPatch={onOrchestraPatch}
          />
        </div>
        <div className={activeTab === 'udo' ? 'h-full' : 'hidden'} aria-hidden={activeTab !== 'udo'}>
          <BSBUDOPanel
            instrument={instrument}
            projectUdos={projectUdos}
            onInstrumentPatch={onInstrumentPatch}
            libraryDropTarget={embeddedUdoTarget}
          />
        </div>
      </div>
    </div>
  );
}

export default React.memo(BlueSynthBuilderEditor);
