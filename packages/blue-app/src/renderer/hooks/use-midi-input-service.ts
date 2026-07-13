/**
 * Primary-window lifetime host for the MIDI input service (SPEC 058).
 *
 * Mounts the renderer-side `MidiInputService` for the lifetime of the primary
 * application renderer (not for the Settings child window). Wires the
 * coordinator command channel, snapshot reporting, and the shared note router
 * so both hardware and Virtual Keyboard input feed the same Blue Live IPC.
 */

import { useEffect } from 'react';
import { useBlueLiveStore } from '../stores/blue-live-store';
import { useProjectStore } from '../stores/project-store';
import { useMidiInputStore } from '../stores/midi-input-store';
import { MidiInputService } from '../services/midi-input-service';
import {
  MidiNoteRouter,
  type BlueLiveAllNotesOffFn,
  type BlueLiveTriggerFn,
} from '../services/midi-note-router';
import {
  getHardwareMidiSourceId,
  type MidiInputServiceCommand,
  type MidiInputServiceInitialization,
  type MidiInputServiceSnapshot,
  type MidiNoteEvent,
  type MidiNoteRouteResult,
} from '../../shared/midi-input';

const PRIMARY_VIRTUAL_SOURCE = 'virtual-keyboard:mouse';

export function useMidiInputService(): void {
  const setSnapshot = useMidiInputStore((s) => s.setSnapshot);
  const setSavedPreferences = useMidiInputStore((s) => s.setSavedPreferences);

  useEffect(() => {
    if (!window.blueAPI?.initializeMidiInputService) return;

    const blueAPI = window.blueAPI;
    let disposed = false;
    let unsubscribeCommand: (() => void) | null = null;

    const isLiveActive = (): boolean => {
      return useProjectStore.getState().loaded && useBlueLiveStore.getState().running;
    };

    const trigger: BlueLiveTriggerFn = (request) =>
      blueAPI.triggerBlueLiveNote(request) as Promise<{ ok: boolean; message?: string }>;
    const allNotesOff: BlueLiveAllNotesOffFn = () =>
      blueAPI.sendBlueLiveAllNotesOff() as Promise<{ ok: boolean; message?: string }>;

    const router = new MidiNoteRouter({ trigger, allNotesOff, isLiveActive });
    _installVirtualKeyboardRouter(router);

    const routeNote = (event: MidiNoteEvent): Promise<MidiNoteRouteResult> =>
      router.routeNote(event);
    const releaseSource = async (sourceId: string): Promise<void> => {
      await router.releaseSource(sourceId);
    };

    const publishSnapshot = (snapshot: MidiInputServiceSnapshot): void => {
      if (disposed) return;
      setSnapshot(snapshot);
      try {
        blueAPI.reportMidiInputServiceSnapshot?.(snapshot);
      } catch {
        // ignore — best-effort report to main
      }
    };

    const productionRequestAccess = async (): Promise<unknown> => {
      const navigatorWithMidi = navigator as Navigator & {
        requestMIDIAccess?: (opts?: { sysex?: boolean }) => Promise<unknown>;
      };
      if (typeof navigatorWithMidi.requestMIDIAccess !== 'function') {
        throw new Error('Web MIDI is not supported by this browser runtime');
      }
      const access = await navigatorWithMidi.requestMIDIAccess({ sysex: false });
      if (
        access
        && typeof access === 'object'
        && (access as { sysexEnabled?: unknown }).sysexEnabled === true
      ) {
        throw new Error('Web MIDI unexpectedly enabled SysEx access');
      }
      return access;
    };

    const service = new MidiInputService({
      requestAccess: productionRequestAccess,
      now: () => performance.now(),
      routeNote,
      releaseSource,
      publishSnapshot,
    });

    const releaseAtSessionBoundary = (): void => {
      void router.releaseAll();
    };
    const unsubscribeBlueLive = useBlueLiveStore.subscribe((state, previous) => {
      if (
        (previous.running && !state.running)
        || (previous.initialized && state.sessionId !== previous.sessionId)
      ) {
        releaseAtSessionBoundary();
      }
    });
    const unsubscribeProject = useProjectStore.subscribe((state, previous) => {
      if (
        state.sessionId !== previous.sessionId
        || (previous.loaded && !state.loaded)
      ) {
        releaseAtSessionBoundary();
      }
    });

    const acknowledge = (
      commandId: string,
      accepted: boolean,
      message?: string,
    ): void => {
      if (disposed) return;
      try {
        blueAPI.acknowledgeMidiInputCommand?.({ commandId, accepted, message });
      } catch { /* ignore */ }
    };

    const handleCommand = (command: MidiInputServiceCommand): void => {
      if (disposed) return;
      if (command.type === 'reconcile') {
        void service.reconcile(command.preferences).then(() => {
          acknowledge(command.commandId, true);
          if (!disposed) setSavedPreferences(command.preferences);
        }).catch(() => {
          acknowledge(command.commandId, false, 'reconcile failed');
        });
      } else if (command.type === 'rescan') {
        void service.rescan().then(() => {
          acknowledge(command.commandId, true);
        }).catch(() => {
          acknowledge(command.commandId, false, 'rescan failed');
        });
      } else if (command.type === 'shutdown') {
        void (async () => {
          try {
            await router.releaseAll();
            await service.stop();
            acknowledge(command.commandId, true);
          } catch {
            acknowledge(command.commandId, false, 'shutdown failed');
          }
        })();
      }
    };

    void (async () => {
      let init: MidiInputServiceInitialization | null = null;
      try {
        init = await blueAPI.initializeMidiInputService();
      } catch {
        init = null;
      }
      if (disposed || !init) return;
      if (init.cachedSnapshot) setSnapshot(init.cachedSnapshot);
      setSavedPreferences(init.preferences);
      unsubscribeCommand = blueAPI.onMidiInputServiceCommand(handleCommand);
      if (disposed) {
        unsubscribeCommand();
        unsubscribeCommand = null;
        return;
      }
      await service.reconcile(init.preferences);
      await service.start();
    })();

    return () => {
      disposed = true;
      unsubscribeBlueLive();
      unsubscribeProject();
      if (globalVirtualKeyboardRouter === router) {
        _installVirtualKeyboardRouter(null);
      }
      try { unsubscribeCommand?.(); } catch { /* ignore */ }
      unsubscribeCommand = null;
      void (async () => {
        try { await router.releaseAll(); } catch { /* ignore */ }
        try { await service.stop(); } catch { /* ignore */ }
      })();
    };
  }, [setSnapshot, setSavedPreferences]);
}

/**
 * Submit a Virtual Keyboard note through the shared router so hardware and
 * virtual inputs produce identical Blue Live behavior.
 *
 * Returns the trigger result. The caller is responsible for any UI state.
 */
export async function routeVirtualKeyboardNote(
  event: Omit<MidiNoteEvent, 'sourceKind' | 'sourceId' | 'deviceId'> & {
    source: 'mouse' | 'computer';
  },
): Promise<MidiNoteRouteResult> {
  const router = globalVirtualKeyboardRouter;
  if (!router) {
    // Fallback: direct Blue Live trigger when the router is not yet mounted.
    if (window.blueAPI?.triggerBlueLiveNote) {
      const result = await window.blueAPI.triggerBlueLiveNote({
        type: event.type,
        midiNote: event.midiNote,
        velocity: event.velocity,
        channel: event.channel,
        source: event.source,
        sourceId: `${PRIMARY_VIRTUAL_SOURCE}:${event.source}`,
        timestamp: event.timestamp,
      });
      return { accepted: result.ok, message: result.message };
    }
    return { accepted: false, message: 'No router available' };
  }
  return router.routeNote({
    type: event.type,
    sourceKind: event.source,
    sourceId: `${PRIMARY_VIRTUAL_SOURCE}:${event.source}`,
    deviceId: null,
    channel: event.channel,
    midiNote: event.midiNote,
    velocity: event.velocity,
    timestamp: event.timestamp,
  });
}

export async function releaseVirtualKeyboardSource(
  source: 'mouse' | 'computer',
): Promise<void> {
  const router = globalVirtualKeyboardRouter;
  if (!router) return;
  await router.releaseSource(`${PRIMARY_VIRTUAL_SOURCE}:${source}`);
}

export async function releaseAllVirtualKeyboardSources(): Promise<boolean> {
  const router = globalVirtualKeyboardRouter;
  if (!router) return false;
  return router.releaseAll();
}

// Internal: the host hook installs the active router here so Virtual Keyboard
// code can route without prop-drilling.
let globalVirtualKeyboardRouter: MidiNoteRouter | null = null;

export function _installVirtualKeyboardRouter(router: MidiNoteRouter | null): void {
  globalVirtualKeyboardRouter = router;
}

export { PRIMARY_VIRTUAL_SOURCE };
export const HARDWARE_SOURCE_PREFIX = 'midi:';
export { getHardwareMidiSourceId };
