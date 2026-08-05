import React, { useCallback } from 'react';

import type {
  BlueSynthBuilderInstrumentSnapshot,
  InstrumentPatch,
  UdoDefinitionSnapshot,
} from '../../../../../../shared/project-editor';
import { useUdoCallbacks } from '../../../../../hooks/use-udo-callbacks';
import UdoWorkspacePanel from '../../udo/UdoWorkspacePanel';
import type { UdoLibraryDropTarget } from '../../udo/UdoTable';

interface BSBUDOPanelProps {
  instrument: BlueSynthBuilderInstrumentSnapshot;
  onInstrumentPatch: (patch: InstrumentPatch) => void | Promise<void>;
  libraryDropTarget?: UdoLibraryDropTarget;
  /** Project-global UDOs available to the embedded BSB UDO body editor. */
  projectUdos?: readonly UdoDefinitionSnapshot[];
}

export default function BSBUDOPanel({
  instrument,
  onInstrumentPatch,
  libraryDropTarget,
  projectUdos,
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
        projectUdos={projectUdos}
        resetKey={instrument.assignmentId}
        {...callbacks}
        libraryDropTarget={libraryDropTarget}
      />
    </div>
  );
}
