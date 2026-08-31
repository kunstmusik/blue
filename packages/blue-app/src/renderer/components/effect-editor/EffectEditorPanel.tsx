import React, { useCallback, useEffect, useMemo, useState } from 'react';

import type {
  BlueSynthBuilderInstrumentSnapshot,
  EffectEditorSnapshot,
  EffectEditablePatch,
  EmbeddedOpcodeListPatch,
  InstrumentPatch,
} from '../../../shared/project-editor';
import { createBsbReplacementKeys } from '../workbench/panels/orchestra/bsb/bsb-completions';
import BSBInterfaceEditor from '../workbench/panels/orchestra/bsb/BSBInterfaceEditor';
import SelectedCodeEditor from '../workbench/panels/editors/SelectedCodeEditor';
import { toUdoCompletionDefinitions } from '../workbench/panels/editors/udo-completion-scope';
import UdoWorkspacePanel from '../workbench/panels/udo/UdoWorkspacePanel';
import { useUdoCallbacks } from '../../hooks/use-udo-callbacks';
import { cloneUdoSnapshot, formatUdoListAsOpcodeText } from '../workbench/panels/udo/udo-snapshot-utils';
import { AppSelect } from '../AppSelect';

type EffectEditorTab = 'interface' | 'code' | 'udo' | 'comments';

export interface EffectEditorPanelProps {
  snapshot: EffectEditorSnapshot;
  onPatch: (patch: EffectEditablePatch) => void;
  className?: string;
  showNameField?: boolean;
  initialTab?: EffectEditorTab;
  interfaceOnly?: boolean;
  onEditorUsable?: () => void;
}

function buildFakeInstrumentSnapshot(
  snapshot: EffectEditorSnapshot,
): BlueSynthBuilderInstrumentSnapshot {
  return {
    assignmentId: snapshot.effectId,
    type: 'blueSynthBuilder',
    name: snapshot.name,
    enabled: snapshot.enabled,
    comment: snapshot.comments,
    instrumentText: snapshot.code,
    alwaysOnInstrumentText: '',
    globalOrc: '',
    globalSco: '',
    objectNames: [...snapshot.objectNames],
    widgets: snapshot.widgets.map((widget) => ({ ...widget })),
    editEnabled: snapshot.editEnabled,
    gridSettings: { ...snapshot.gridSettings },
    widgetTree: structuredClone(snapshot.widgetTree),
    presetGroup: undefined,
    opcodeListText: formatUdoListAsOpcodeText(snapshot.udos),
    udolist: snapshot.udos.map((udo) => cloneUdoSnapshot(udo)),
  };
}

export default function EffectEditorPanel({
  snapshot,
  onPatch,
  className,
  showNameField = true,
  initialTab = 'interface',
  interfaceOnly = false,
  onEditorUsable,
}: EffectEditorPanelProps): React.ReactElement {
  const [activeTab, setActiveTab] = useState<EffectEditorTab>(initialTab);

  useEffect(() => {
    onEditorUsable?.();
  }, [onEditorUsable]);

  const handleInstrumentPatch = useCallback(
    (patch: InstrumentPatch) => {
      if (!patch.bsbInterface) return;
      onPatch({ bsbInterface: patch.bsbInterface });
    },
    [onPatch],
  );

  const handleCodeChange = useCallback(
    (code: string) => onPatch({ code }),
    [onPatch],
  );

  const handleCommentsChange = useCallback(
    (comments: string) => onPatch({ comments }),
    [onPatch],
  );

  const handleNameChange = useCallback(
    (name: string) => onPatch({ name }),
    [onPatch],
  );

  const handleNumInsChange = useCallback(
    (numIns: number) => onPatch({ numIns }),
    [onPatch],
  );

  const handleNumOutsChange = useCallback(
    (numOuts: number) => onPatch({ numOuts }),
    [onPatch],
  );

  const handleStyleChange = useCallback(
    (style: 'CLASSIC' | 'MODERN') => onPatch({ style }),
    [onPatch],
  );

  const udoDispatch = useCallback(
    (patch: Record<string, unknown>) => {
      onPatch({ opcodeList: patch as EmbeddedOpcodeListPatch });
    },
    [onPatch],
  );

  const udoCallbacks = useUdoCallbacks('embedded', udoDispatch);

  const fakeInstrument = useMemo(
    () => buildFakeInstrumentSnapshot(snapshot),
    [snapshot],
  );

  const replacementKeys = useMemo(
    () => createBsbReplacementKeys(snapshot.objectNames),
    [snapshot.objectNames],
  );

  const javaBlueCompletionOptions = useMemo(
    () => ({
      bsbReplacementKeys: replacementKeys,
      // Effect-owned UDOs are the context scope; project effects also receive
      // the projected project-global UDOs. Library effects carry an empty array.
      contextUdos: toUdoCompletionDefinitions(snapshot.udos),
      projectUdos: toUdoCompletionDefinitions(snapshot.projectUdos),
    }),
    [replacementKeys, snapshot.udos, snapshot.projectUdos],
  );

  const xinLabel = useMemo(() => {
    const { numIns, style } = snapshot;
    const names: string[] = [];
    for (let i = 0; i < numIns; i++) names.push(`ain${i + 1}`);
    if (style === 'MODERN') {
      return `; inputs passed by reference: ${names.join(', ')}`;
    }
    return `${names.join(', ')} xin`;
  }, [snapshot.numIns, snapshot.style]);

  const xoutLabel = useMemo(() => {
    const { numOuts } = snapshot;
    const names: string[] = [];
    for (let i = 0; i < numOuts; i++) names.push(`aout${i + 1}`);
    return `xout ${names.join(', ')}`;
  }, [snapshot.numOuts]);

  if (interfaceOnly) {
    return (
      <div className={['flex h-full min-h-0 flex-col overflow-hidden', className].filter(Boolean).join(' ')}>
        <div className="min-h-0 flex-1 overflow-hidden">
          <BSBInterfaceEditor
            instrument={{ ...fakeInstrument, editEnabled: false }}
            onInstrumentPatch={handleInstrumentPatch}
            showEditModeToggle={false}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={['flex h-full min-h-0 flex-col overflow-hidden', className].filter(Boolean).join(' ')}>
      <div className="flex flex-none flex-wrap items-center gap-3 border-b border-app-border bg-app-surface-strong px-3 py-2">
        {showNameField && (
          <input
            type="text"
            value={snapshot.name}
            onChange={(event) => handleNameChange(event.target.value)}
            className="min-w-0 flex-1 rounded border border-app-border bg-app-input px-2 py-1 text-role-body text-app-text-strong outline-none focus:border-app-accent"
            aria-label="Effect name"
          />
        )}
        <label className="flex items-center gap-1 text-role-body text-app-text-muted">
          In
          <input
            type="number"
            min={0}
            value={snapshot.numIns}
            onChange={(event) => handleNumInsChange(Number.parseInt(event.target.value, 10) || 0)}
            className="w-14 rounded border border-app-border bg-app-input px-1.5 py-1 text-role-body text-app-text-strong outline-none focus:border-app-accent"
          />
        </label>
        <label className="flex items-center gap-1 text-role-body text-app-text-muted">
          Out
          <input
            type="number"
            min={0}
            value={snapshot.numOuts}
            onChange={(event) => handleNumOutsChange(Number.parseInt(event.target.value, 10) || 0)}
            className="w-14 rounded border border-app-border bg-app-input px-1.5 py-1 text-role-body text-app-text-strong outline-none focus:border-app-accent"
          />
        </label>
        <label className="flex items-center gap-1 text-role-body text-app-text-muted">
          Style
          <AppSelect
            value={snapshot.style}
            onValueChange={(value) => handleStyleChange(value as 'CLASSIC' | 'MODERN')}
            options={[
              { value: 'CLASSIC', label: 'Classic' },
              { value: 'MODERN', label: 'Modern' },
            ]}
            className="rounded border border-app-border bg-app-input px-1.5 py-1 text-role-body text-app-text-strong outline-none focus:border-app-accent"
          />
        </label>
      </div>

      <div className="flex-none border-b border-app-border bg-app-surface-strong px-2">
        <div className="flex items-end gap-1">
          {([
            ['interface', 'Interface'],
            ['code', 'Code'],
            ['udo', 'UDO'],
            ['comments', 'Comments'],
          ] as const).map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              className={[
                'border-b-2 px-3 py-2 text-role-body',
                activeTab === tab
                  ? 'border-app-accent text-app-text-strong'
                  : 'border-transparent text-app-text-muted hover:text-app-text-strong',
              ].join(' ')}
              onClick={() => setActiveTab(tab)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {activeTab === 'code' && (
          <div className="flex h-full flex-col">
            <div className="flex-none border-b border-app-border/40 bg-app-input px-3 py-1 font-mono text-role-callout italic text-app-text-muted">
              {xinLabel}
            </div>
            <div className="min-h-0 flex-1">
              <SelectedCodeEditor
                value={snapshot.code}
                onChange={handleCodeChange}
                ariaLabel="Effect code editor"
                mode="orc"
                javaBlueCompletionOptions={javaBlueCompletionOptions}
              />
            </div>
            <div className="flex-none border-t border-app-border/40 bg-app-input px-3 py-1 font-mono text-role-callout font-bold text-app-text-muted">
              {xoutLabel}
            </div>
          </div>
        )}
        {activeTab === 'interface' && (
          <BSBInterfaceEditor
            instrument={fakeInstrument}
            onInstrumentPatch={handleInstrumentPatch}
          />
        )}
        {activeTab === 'udo' && (
          <UdoWorkspacePanel
            udos={snapshot.udos}
            projectUdos={snapshot.projectUdos}
            resetKey={snapshot.effectId}
            {...udoCallbacks}
          />
        )}
        {activeTab === 'comments' && (
          <SelectedCodeEditor
            value={snapshot.comments}
            onChange={handleCommentsChange}
            ariaLabel="Effect comments editor"
            mode="text"
            placeholder="Add notes for this effect..."
          />
        )}
      </div>
    </div>
  );
}
