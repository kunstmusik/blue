import React, { useCallback } from 'react';

import type {
  BlueSynthBuilderInstrumentSnapshot,
  InstrumentPatch,
  UdoDefinitionSnapshot,
} from '../../../../../../shared/project-editor';
import { useUdoCallbacks } from '../../../../../hooks/use-udo-callbacks';
import { getProjectDocumentRevision, useProjectStore } from '../../../../../stores/project-store';
import UdoWorkspacePanel from '../../udo/UdoWorkspacePanel';

interface BSBUDOPanelProps {
  instrument: BlueSynthBuilderInstrumentSnapshot;
  onInstrumentPatch: (patch: InstrumentPatch) => void | Promise<void>;
  libraryInstrumentAssignmentId?: string;
  /** Project-global UDOs available to the embedded BSB UDO body editor. */
  projectUdos?: readonly UdoDefinitionSnapshot[];
}

export default function BSBUDOPanel({
  instrument,
  onInstrumentPatch,
  libraryInstrumentAssignmentId,
  projectUdos,
}: BSBUDOPanelProps): React.ReactElement {
  const udolist = instrument.udolist ?? [];
  const projectSessionId = useProjectStore((state) => state.sessionId);
  const projectRevision = getProjectDocumentRevision();

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
        libraryDropTarget={libraryInstrumentAssignmentId
          ? {
              projectSessionId,
              projectRevision,
              instrumentAssignmentId: libraryInstrumentAssignmentId,
            }
          : undefined}
      />
    </div>
  );
}
