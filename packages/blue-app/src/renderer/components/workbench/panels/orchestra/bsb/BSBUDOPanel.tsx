import React, { useCallback } from 'react';

import type {
  BlueSynthBuilderInstrumentSnapshot,
  InstrumentPatch,
} from '../../../../../../shared/project-editor';
import { useUdoCallbacks } from '../../../../../hooks/use-udo-callbacks';
import UdoWorkspacePanel from '../../udo/UdoWorkspacePanel';

interface BSBUDOPanelProps {
  instrument: BlueSynthBuilderInstrumentSnapshot;
  onInstrumentPatch: (patch: InstrumentPatch) => void | Promise<void>;
}

export default function BSBUDOPanel({
  instrument,
  onInstrumentPatch,
}: BSBUDOPanelProps): React.ReactElement {
  const udolist = instrument.udolist ?? [];

  const dispatch = useCallback(
    (patch: Record<string, unknown>) => {
      void onInstrumentPatch({ bsbInterface: patch as any });
    },
    [onInstrumentPatch],
  );

  const callbacks = useUdoCallbacks('bsb', dispatch);

  return (
    <div className="flex h-full flex-col bg-app-bg">
      <UdoWorkspacePanel
        udos={udolist}
        resetKey={instrument.assignmentId}
        {...callbacks}
      />
    </div>
  );
}
