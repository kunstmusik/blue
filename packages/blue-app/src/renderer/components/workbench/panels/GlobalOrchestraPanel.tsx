import React, { useCallback, useMemo } from 'react';
import { useProjectStore } from '../../../stores/project-store';
import { useBlueLiveStore } from '../../../stores/blue-live-store';
import { usePlaybackStore } from '../../../stores/playback-store';
import SelectedCodeEditor from './editors/SelectedCodeEditor';
import { toUdoCompletionDefinitions } from './editors/udo-completion-scope';

export default function GlobalOrchestraPanel(): React.ReactElement {
  const loaded = useProjectStore((state) => state.loaded);
  const globalOrc = useProjectStore((state) => state.globalOrc);
  const updateGlobalOrc = useProjectStore((state) => state.updateGlobalOrc);
  const projectUdos = useProjectStore((state) => state.projectUdos);
  const blueLiveRunning = useBlueLiveStore((s) => s.running);
  const playbackStatus = usePlaybackStore((s) => s.status);

  const evaluateEnabled = blueLiveRunning || playbackStatus === 'playing';

  const javaBlueCompletionOptions = useMemo(
    () => ({ projectUdos: toUdoCompletionDefinitions(projectUdos) }),
    [projectUdos],
  );

  const handleEvaluateCode = useCallback(
    (text: string) => {
      window.blueAPI?.evaluateCode({
        editorKind: 'orc',
        text,
        sourcePanelId: 'GlobalOrchestraTopComponent',
      });
    },
    [],
  );

  if (!loaded) {
    return (
      <div className="flex h-full items-center justify-center text-gray-500 text-sm">
        No project loaded
      </div>
    );
  }

  return (
    <div className="h-full">
      <SelectedCodeEditor
        value={globalOrc}
        placeholder="Enter global orchestra code"
        ariaLabel="Global Orchestra Csound editor"
        javaBlueCompletionOptions={javaBlueCompletionOptions}
        onChange={updateGlobalOrc}
        evaluateCodeEnabled={evaluateEnabled}
        onEvaluateCode={handleEvaluateCode}
      />
    </div>
  );
}
