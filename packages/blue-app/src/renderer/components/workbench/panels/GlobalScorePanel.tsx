import React, { useCallback } from 'react';
import { useProjectStore } from '../../../stores/project-store';
import { useBlueLiveStore } from '../../../stores/blue-live-store';
import { usePlaybackStore } from '../../../stores/playback-store';
import SelectedCodeEditor from './editors/SelectedCodeEditor';

export default function GlobalScorePanel(): React.ReactElement {
  const loaded = useProjectStore((state) => state.loaded);
  const globalSco = useProjectStore((state) => state.globalSco);
  const updateGlobalSco = useProjectStore((state) => state.updateGlobalSco);
  const blueLiveRunning = useBlueLiveStore((s) => s.running);
  const playbackStatus = usePlaybackStore((s) => s.status);

  const evaluateEnabled = blueLiveRunning || playbackStatus === 'playing';

  const handleEvaluateCode = useCallback((text: string) => {
    window.blueAPI?.evaluateCode({
      editorKind: 'sco',
      text,
      sourcePanelId: 'GlobalScoreTopComponent',
    });
  }, []);

  if (!loaded) {
    return (
      <div className="flex h-full items-center justify-center text-gray-500 text-role-body">
        No project loaded
      </div>
    );
  }

  return (
    <div className="h-full">
      <SelectedCodeEditor
        value={globalSco}
        placeholder="Enter global score code"
        ariaLabel="Global Score Csound editor"
        mode="sco"
        onChange={updateGlobalSco}
        evaluateCodeEnabled={evaluateEnabled}
        onEvaluateCode={handleEvaluateCode}
      />
    </div>
  );
}
