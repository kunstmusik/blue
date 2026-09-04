import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { OscCommandRouter } from '../services/osc-command-router';
import { useBlueLiveStore } from '../stores/blue-live-store';
import { usePlaybackStore } from '../stores/playback-store';
import { useProjectStore } from '../stores/project-store';

/** Installs the sole OSC command consumer in the primary workbench renderer. */
export function useOscControlCommands(): void {
  const routerRef = useRef<OscCommandRouter | null>(null);
  if (!routerRef.current) {
    routerRef.current = new OscCommandRouter({
      getProject: () => useProjectStore.getState(),
      getPlayback: () => usePlaybackStore.getState(),
      getBlueLive: () => useBlueLiveStore.getState(),
      blueLiveApi: {
        toggleBlueLive: () => window.blueAPI.toggleBlueLive(),
        recompileBlueLive: () => window.blueAPI.recompileBlueLive(),
        sendBlueLiveAllNotesOff: () => window.blueAPI.sendBlueLiveAllNotesOff(),
      },
      onError: (error) => {
        toast.error(
          `OSC command failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      },
    });
  }

  useEffect(() => {
    if (!window.blueAPI?.onOscCommand) return;
    const router = routerRef.current!;
    return window.blueAPI.onOscCommand((event) => {
      void router.dispatch(event);
    });
  }, []);
}
