/**
 * Subscribes to Render-to-Disk operation status. When a "play" disk render
 * completes, opens the Audio File Player panel and routes the rendered file
 * to it for in-app autoplay.
 *
 * Mount once at the WorkbenchShell level.
 */
import { useEffect } from 'react';
import { emitPendingAudioFile } from './audio-player-bus';
import { useWorkbenchStore } from '../../../../stores/workbench-store';

export function useRenderAndPlayInterceptor(): void {
  useEffect(() => {
    const unsubscribe = window.blueAPI.onRenderOperationStatus((status) => {
      if (status.kind !== 'diskRender') return;
      if (status.phase !== 'completed') return;
      if (status.action !== 'play') return;
      if (!status.outputPath) return;
      useWorkbenchStore.getState().openPanel('AudioFilePlayerTopComponent');
      emitPendingAudioFile(status.outputPath);
    });
    return unsubscribe;
  }, []);
}
