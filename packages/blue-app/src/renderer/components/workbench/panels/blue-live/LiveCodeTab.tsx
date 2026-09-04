import React from 'react';
import { useProjectStore } from '../../../../stores/project-store';
import { useBlueLiveStore } from '../../../../stores/blue-live-store';
import { usePlaybackStore } from '../../../../stores/playback-store';
import SelectedCodeEditor from '../editors/SelectedCodeEditor';

export default function LiveCodeTab(): React.ReactElement {
  const loaded = useProjectStore((state) => state.loaded);
  const blueLive = useProjectStore((state) => state.blueLive);
  const applyBlueLivePatch = useProjectStore((state) => state.applyBlueLivePatch);
  const blueLiveRunning = useBlueLiveStore((state) => state.running);
  const playbackStatus = usePlaybackStore((state) => state.status);
  const evaluateEnabled = blueLiveRunning || playbackStatus === 'playing';

  if (!loaded || !blueLive) {
    return (
      <div style={{ color: 'var(--color-app-text-muted)', padding: '12px' }}>
        No project loaded.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '4px' }}>
      <div
        style={{
          fontSize: 'var(--text-role-callout)',
          lineHeight: 'var(--text-role-callout--line-height)',
          color: 'var(--color-app-text-muted)',
        }}
      >
        Live Code — Csound orchestra text evaluated into Blue Live first, then realtime playback
      </div>
      <div style={{ flex: 1, minHeight: '240px' }}>
        <SelectedCodeEditor
          value={blueLive.liveCodeText}
          placeholder="Enter Blue Live orchestra code"
          ariaLabel="Blue Live code editor"
          mode="orc"
          onChange={(text) => applyBlueLivePatch({ type: 'updateLiveCodeText', text })}
          evaluateCodeEnabled={evaluateEnabled}
          onEvaluateCode={(text) => {
            window.blueAPI?.evaluateCode({
              editorKind: 'orc',
              text,
              sourcePanelId: 'BlueLiveLiveCodeTab',
            });
          }}
        />
      </div>
      <div
        style={{
          fontSize: 'var(--text-role-callout)',
          lineHeight: 'var(--text-role-callout--line-height)',
          color: 'var(--color-app-text-subtle)',
        }}
      >
        Shortcut: Cmd/Ctrl-Enter evaluates the current line or enclosing block.
      </div>
    </div>
  );
}
