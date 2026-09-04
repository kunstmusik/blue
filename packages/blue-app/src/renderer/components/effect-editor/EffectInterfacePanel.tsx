import React, { useCallback, useEffect, useMemo } from 'react';

import type {
  BlueSynthBuilderInstrumentSnapshot,
  EffectEditorSnapshot,
  EffectEditablePatch,
  InstrumentPatch,
} from '../../../shared/project-editor';
import BSBInterfaceEditor from '../workbench/panels/orchestra/bsb/BSBInterfaceEditor';
import {
  cloneUdoSnapshot,
  formatUdoListAsOpcodeText,
} from '../workbench/panels/udo/udo-snapshot-utils';

export interface EffectInterfacePanelProps {
  snapshot: EffectEditorSnapshot;
  onPatch: (patch: EffectEditablePatch) => void;
  onEditorUsable?: () => void;
}

function buildInterfaceInstrument(
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
    editEnabled: false,
    gridSettings: { ...snapshot.gridSettings },
    widgetTree: structuredClone(snapshot.widgetTree),
    presetGroup: undefined,
    opcodeListText: formatUdoListAsOpcodeText(snapshot.udos),
    udolist: snapshot.udos.map((udo) => cloneUdoSnapshot(udo)),
  };
}

/**
 * Runtime-only effect interface surface. Keeping this in its own dynamic chunk
 * prevents Monaco, the code editor, and the UDO workspace from entering the
 * interface window's cold-open dependency path.
 */
export default function EffectInterfacePanel({
  snapshot,
  onPatch,
  onEditorUsable,
}: EffectInterfacePanelProps): React.ReactElement {
  const instrument = useMemo(() => buildInterfaceInstrument(snapshot), [snapshot]);
  const handleInstrumentPatch = useCallback(
    (patch: InstrumentPatch) => {
      if (patch.bsbInterface) onPatch({ bsbInterface: patch.bsbInterface });
    },
    [onPatch],
  );

  useEffect(() => {
    onEditorUsable?.();
  }, [onEditorUsable]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-hidden">
        <BSBInterfaceEditor
          instrument={instrument}
          onInstrumentPatch={handleInstrumentPatch}
          showEditModeToggle={false}
        />
      </div>
    </div>
  );
}
