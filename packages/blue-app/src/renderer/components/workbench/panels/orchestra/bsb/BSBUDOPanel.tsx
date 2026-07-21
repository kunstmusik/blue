import React, { useCallback } from 'react';

import type {
  BlueSynthBuilderInstrumentSnapshot,
  InstrumentPatch,
} from '../../../../../../shared/project-editor';
import { useUdoCallbacks } from '../../../../../hooks/use-udo-callbacks';
import { getProjectDocumentRevision, useProjectStore } from '../../../../../stores/project-store';
import UdoWorkspacePanel from '../../udo/UdoWorkspacePanel';

interface BSBUDOPanelProps {
  instrument: BlueSynthBuilderInstrumentSnapshot;
  onInstrumentPatch: (patch: InstrumentPatch) => void | Promise<void>;
  libraryInstrumentAssignmentId?: string;
}

export default function BSBUDOPanel({
  instrument,
  onInstrumentPatch,
  libraryInstrumentAssignmentId,
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
