import React, { useCallback } from 'react';

import type {
  InstrumentPatch,
  UdoDefinitionSnapshot,
} from '../../../../../shared/project-editor';
import { useUdoCallbacks } from '../../../../hooks/use-udo-callbacks';
import UdoWorkspacePanel from '../udo/UdoWorkspacePanel';
import type { UdoLibraryDropTarget } from '../udo/UdoTable';

interface EmbeddedUdoPanelProps {
  udolist: UdoDefinitionSnapshot[];
  resetKey?: string | number | null;
  onInstrumentPatch: (patch: InstrumentPatch) => void | Promise<void>;
  /** Project-global UDOs available to the embedded UDO body editor. */
  projectUdos?: readonly UdoDefinitionSnapshot[];
  libraryDropTarget?: UdoLibraryDropTarget;
}

export default function EmbeddedUdoPanel({
  udolist,
  resetKey,
  onInstrumentPatch,
  projectUdos,
  libraryDropTarget,
}: EmbeddedUdoPanelProps): React.ReactElement {
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
        projectUdos={projectUdos}
        resetKey={resetKey}
        {...callbacks}
        libraryDropTarget={libraryDropTarget}
      />
    </div>
  );
}
