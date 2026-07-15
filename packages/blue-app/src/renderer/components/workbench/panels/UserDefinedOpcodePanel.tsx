import React from 'react';

import type { ProjectUdoPatch } from '../../../../shared/project-editor';
import { useUdoCallbacks } from '../../../hooks/use-udo-callbacks';
import { useProjectStore } from '../../../stores/project-store';
import UdoWorkspacePanel from './udo/UdoWorkspacePanel';
import { openUnifiedLibraries } from '../../../stores/library-routing';

export default function UserDefinedOpcodePanel(): React.ReactElement {
  const projectUdos = useProjectStore((state) => state.projectUdos);
  const loaded = useProjectStore((state) => state.loaded);
  const filePath = useProjectStore((state) => state.filePath);
  const projectSessionId = useProjectStore((state) => state.sessionId);
  const applyProjectUdoPatch = useProjectStore((state) => state.applyProjectUdoPatch);

  const dispatch = (patch: Record<string, unknown>) => {
    void applyProjectUdoPatch(patch as ProjectUdoPatch);
  };

  const callbacks = useUdoCallbacks('project', dispatch);

  if (!loaded) {
    return (
      <div className="workbench-panel-shell">
        <div className="workbench-panel-shell__content">
          <div className="flex h-full items-center justify-center text-sm text-gray-500">
            No project loaded
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="workbench-panel-shell">
      <div className="workbench-panel-shell__content flex h-full min-h-0 flex-col">
        <div className="flex justify-end border-b border-app-border p-1">
          <button
            type="button"
            className="rounded border border-app-border px-2 py-1 text-xs"
            onClick={() => { void openUnifiedLibraries({ type: 'udoTarget', projectSessionId }); }}
          >
            Browse UDO Library
          </button>
        </div>
        <UdoWorkspacePanel
          udos={projectUdos}
          resetKey={filePath ?? 'project-udo'}
          {...callbacks}
        />
      </div>
    </div>
  );
}
