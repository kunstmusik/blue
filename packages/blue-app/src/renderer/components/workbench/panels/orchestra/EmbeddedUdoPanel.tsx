import React, { useCallback } from 'react';

import type { InstrumentPatch } from '../../../../../shared/project-editor';
import { useUdoCallbacks } from '../../../../hooks/use-udo-callbacks';
import { getProjectDocumentRevision, useProjectStore } from '../../../../stores/project-store';
import UdoWorkspacePanel from '../udo/UdoWorkspacePanel';

interface EmbeddedUdoPanelProps {
  assignmentId: string;
  udolist: Array<import('../../../../../shared/project-editor').UdoDefinitionSnapshot>;
  resetKey?: string | number | null;
  onInstrumentPatch: (patch: InstrumentPatch) => void | Promise<void>;
}

export default function EmbeddedUdoPanel({
  assignmentId,
  udolist,
  resetKey,
  onInstrumentPatch,
}: EmbeddedUdoPanelProps): React.ReactElement {
  const projectSessionId = useProjectStore((state) => state.sessionId);
  const projectRevision = getProjectDocumentRevision();
  const dispatch = useCallback(
    (patch: Record<string, unknown>) => {
      void onInstrumentPatch({ embeddedOpcodeList: patch as any });
    },
    [onInstrumentPatch],
  );

  const callbacks = useUdoCallbacks('embedded', dispatch);

  return (
    <div className="flex h-full flex-col bg-app-bg">
      <UdoWorkspacePanel
        udos={udolist}
        resetKey={resetKey}
        {...callbacks}
        libraryDropTarget={{
          projectSessionId,
          projectRevision,
          instrumentAssignmentId: assignmentId,
        }}
      />
    </div>
  );
}
