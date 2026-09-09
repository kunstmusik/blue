import { useEffect } from 'react';
import { toast } from 'sonner';
import { reconcileExternalSelectionHints } from '../stores/score-selection-store';
import { setProjectHistoryProjection } from './use-project-history';
import {
  acceptProjectDocumentRevision,
  getProjectDocumentId,
  getProjectDocumentRevision,
  getProjectHistoryParticipantContextId,
  handleProjectHistoryBoundary,
  handleProjectHistoryRelease,
  ownsProjectDocumentOperationIds,
  useProjectStore,
} from '../stores/project-store';
import { usePlaybackStore } from '../stores/playback-store';
import { useUIStore } from '../stores/ui-store';
import { useSettingsStore } from '../stores/settings-store';
import { useWorkbenchStore } from '../stores/workbench-store';
import { useOutputStore } from '../stores/output-store';
import { useBlueLiveStore } from '../stores/blue-live-store';
import { useRenderToDiskStore } from '../stores/render-to-disk-store';
import { useLayoutSettingsStore } from '../stores/layout-settings-store';
import {
  hasAuditionEligibleSelection,
  useScoreSelectionStore,
} from '../stores/score-selection-store';
import {
  applyLegacyLayoutMigration,
  createDefaultWindowLayoutSettings,
  type LegacyLayoutMigrationPayload,
  type WindowLayoutSettingsSnapshot,
} from '../../shared/window-layout-settings';
import type { EngineOutputPayload } from '../../shared/io-provider';
import type { ProgramSettingsSnapshot } from '../../shared/program-settings';

export function useIPCListeners(): void {
  const setProjectInfo = useProjectStore((s) => s.setProjectInfo);
  const setActivePanel = useUIStore((s) => s.setActivePanel);
  const addRecentFile = useSettingsStore((s) => s.addRecentFile);
  const setStatus = usePlaybackStore((s) => s.setStatus);
  const setError = usePlaybackStore((s) => s.setError);
  const acceptPlaybackClock = usePlaybackStore((s) => s.acceptPlaybackClock);
  const resetPlayback = usePlaybackStore((s) => s.reset);
  const handleNativeMenuCommand = useWorkbenchStore((s) => s.handleNativeMenuCommand);
  const appendToTab = useOutputStore((s) => s.appendToTab);
  const selectTab = useOutputStore((s) => s.selectTab);
  const getOrCreateTab = useOutputStore((s) => s.getOrCreateTab);
  const resetTab = useOutputStore((s) => s.resetTab);
  const setBlueLiveStatus = useBlueLiveStore((s) => s.setStatusFromSnapshot);
  const resetBlueLive = useBlueLiveStore((s) => s.reset);
  const hydrateFromProgramSettings = usePlaybackStore((s) => s.hydrateFromProgramSettings);
  const recentFiles = useSettingsStore((s) => s.recentFiles);

  useEffect(() => {
    const syncAvailability = () => {
      window.blueAPI?.syncAuditionScoreObjectAvailability?.(
        hasAuditionEligibleSelection(useScoreSelectionStore.getState()),
      );
    };
    if (!window.blueAPI?.syncAuditionScoreObjectAvailability) return undefined;

    syncAvailability();
    return useScoreSelectionStore.subscribe((next, previous) => {
      if (next.selectedObjectIds !== previous.selectedObjectIds) syncAvailability();
    });
  }, []);

  useEffect(() => {
    if (!window.blueAPI?.getProgramSettings) return;
    window.blueAPI
      .getProgramSettings()
      .then((settings: ProgramSettingsSnapshot) => {
        hydrateFromProgramSettings(settings);
        useLayoutSettingsStore
          .getState()
          .setLayout(settings.appSpecific.windowLayout ?? createDefaultWindowLayoutSettings());

        // Drive one-time legacy renderer-only layout migration into the
        // canonical app-wide layout store. Skipped silently once both markers
        // are set or when the blueAPI does not expose the layout update method.
        const api = window.blueAPI as unknown as {
          updateWindowLayout?: (request: unknown) => Promise<WindowLayoutSettingsSnapshot>;
        };
        if (!api?.updateWindowLayout) return;

        const currentLayout =
          settings.appSpecific.windowLayout ?? createDefaultWindowLayoutSettings();
        if (
          currentLayout.legacyMigration.blueSettingsWindowBoundsMigrated &&
          currentLayout.legacyMigration.workbenchLocalStorageMigrated
        ) {
          return;
        }

        const payload: LegacyLayoutMigrationPayload = {};
        try {
          const blueSettingsRaw = localStorage.getItem('blue-settings');
          if (blueSettingsRaw) {
            const parsed = JSON.parse(blueSettingsRaw) as { windowBounds?: unknown };
            if (parsed && parsed.windowBounds) {
              payload.windowBounds =
                parsed.windowBounds as LegacyLayoutMigrationPayload['windowBounds'];
            }
          }
        } catch {
          // Ignore malformed localStorage; migration simply skips the field.
        }

        try {
          const workbenchLegacy = localStorage.getItem('blue-workbench-layout');
          if (typeof workbenchLegacy === 'string' && workbenchLegacy.length > 0) {
            payload.workbenchSerializedLayout = workbenchLegacy;
          }
        } catch {
          // Ignore unavailable localStorage; migration simply skips the field.
        }

        // Run the shared helper locally first so the renderer immediately
        // reflects the migrated state, then persist through the canonical IPC
        // so the marker is durable.
        const merged = applyLegacyLayoutMigration(currentLayout, payload);
        useLayoutSettingsStore.getState().setLayout(merged);

        // Persist the migration payload through main so copied values and markers
        // land in the app-wide settings file together.
        void api.updateWindowLayout!({
          type: 'legacy-migration',
          legacy: payload,
        })
          .then((next) => {
            useLayoutSettingsStore.getState().setLayout(next);
          })
          .catch(() => {
            // Migration is best-effort; the next launch retries automatically.
          });
      })
      .catch(() => {});
  }, [hydrateFromProgramSettings]);

  useEffect(() => {
    if (!window.blueAPI?.syncLegacyRendererSettings) return;
    const state = useSettingsStore.getState();
    window.blueAPI
      .syncLegacyRendererSettings({
        enginePath: state.enginePath,
        recentFiles: state.recentFiles,
        windowBounds: state.windowBounds,
        midiInputDevice: state.midiInputDevice,
        midiOutputDevice: state.midiOutputDevice,
        oscInputPort: state.oscInputPort,
        oscOutputHost: state.oscOutputHost,
        oscOutputPort: state.oscOutputPort,
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!window.blueAPI) return;

    const unsubProjectLoaded = window.blueAPI.onProjectLoaded((info) => {
      resetPlayback();
      resetBlueLive();
      useScoreSelectionStore.getState().clearSelection();
      setProjectInfo(info);
      // Re-register this context's history participant against the freshly
      // loaded document lifetime.
      void window.blueAPI
        .registerHistoryParticipant?.({
          contextId: getProjectHistoryParticipantContextId(),
          documentId: info.documentId ?? '',
          acceptedRevision: getProjectDocumentRevision(),
        })
        ?.catch(() => undefined);
      useProjectStore.getState().setMissingAudioSession(info.missingAudioAssets ?? null);
      setActivePanel('project');
      if (info.filePath) {
        addRecentFile(info.filePath);
      }
      toast.success(`Loaded: ${info.title || 'Project'}`);
    });

    const unsubProjectClosed = window.blueAPI.onProjectClosed(() => {
      resetPlayback();
      resetBlueLive();
      useScoreSelectionStore.getState().clearSelection();
      useProjectStore.getState().clearProject();
      setActivePanel('welcome');
    });

    const unsubPlaybackStatus = window.blueAPI.onPlaybackStatus((status) => {
      setStatus(status);
    });

    const unsubPlaybackClock = window.blueAPI.onPlaybackClock((clock) => {
      acceptPlaybackClock(clock);
    });

    const unsubPlaybackError = window.blueAPI.onPlaybackError((error) => {
      setError(error);
    });

    const unsubEngineRecoveryStatus = window.blueAPI.onEngineRecoveryStatus?.((status) => {
      if (status.phase === 'recovering') {
        toast.loading(status.message, { id: status.operationId });
      } else if (status.phase === 'recovered') {
        toast.success(status.message, { id: status.operationId });
      } else if (status.phase === 'failed') {
        toast.error(status.message, { id: status.operationId });
      }
    });

    const unsubNativeMenuCommand = window.blueAPI.onNativeMenuCommand((command) => {
      if (
        !useProjectStore.getState().loaded &&
        (command.type === 'focus-panel' || command.type === 'open-effects-library')
      ) {
        setActivePanel('workspace');
      }
      handleNativeMenuCommand(command);
    });

    const unsubSaveComplete = window.blueAPI.onSaveComplete((info) => {
      const store = useProjectStore.getState();
      if (info.filePath) {
        store.setProjectInfo({ filePath: info.filePath });
        addRecentFile(info.filePath);
      }
      store.markClean();
      toast.success('File saved successfully');
    });

    const unsubSaveError = window.blueAPI.onSaveError((error) => {
      toast.error(`Save error: ${error}`);
    });

    const unsubOutput = window.blueAPI.onEngineOutput((payload: EngineOutputPayload) => {
      getOrCreateTab(payload.tabName);
      appendToTab(payload.tabName, payload.text, payload.type);
    });

    const unsubSelect = window.blueAPI.onEngineOutputSelect((payload) => {
      getOrCreateTab(payload.tabName);
      selectTab(payload.tabName);
    });

    const unsubReset = window.blueAPI.onEngineOutputReset((payload) => {
      resetTab(payload.tabName);
    });

    const unsubRenderStatus = window.blueAPI.onRenderOperationStatus((status) => {
      if (status.kind !== 'diskRender' || status.phase !== 'failed') return;

      const dialogState = useRenderToDiskStore.getState();
      if (dialogState.open && dialogState.operationId === status.operationId) return;
      toast.error(status.error ?? status.message, { id: status.operationId });
    });

    // Disk-render progress reporting lives in RenderToDiskDialog (driven by
    // the render-operation-status broadcasts); main resets and selects the
    // Csound (Disk) output tab through the engine-output channels above.

    const unsubCsd = window.blueAPI.onGeneratedCsd((csdText) => {
      useProjectStore.getState().setGeneratedCsd({ text: csdText, title: 'Generated CSD' });
    });

    const unsubCsdErr = window.blueAPI.onGeneratedCsdError((error) => {
      toast.error(`CSD generation failed: ${error}`);
    });

    const unsubBlueLiveStatus = window.blueAPI.onBlueLiveStatus((snapshot) => {
      setBlueLiveStatus(snapshot);
    });

    // Acknowledge project-document-updated broadcasts from the main process.
    // Dockview popouts share the main renderer's JS context, so mutations are
    // already applied locally. This subscription handles the case where
    // floating windows are in a separate context (FR-010, T039).
    const unsubProjectDocumentUpdated = window.blueAPI.onProjectDocumentUpdated?.((event) => {
      // Ignore stale sessions and publications from a previous document
      // lifetime (project replacement must never touch the new document).
      const currentSession = useProjectStore.getState().sessionId;
      if (event.sessionId !== currentSession) return;
      const knownDocumentId = getProjectDocumentId();
      if (knownDocumentId && event.documentId !== knownDocumentId) return;
      // The projection is display state: every valid publication refreshes
      // undo/redo availability, including own-operation acknowledgements.
      setProjectHistoryProjection(event.history);

      // Acknowledgement of our own submission: the optimistic application in
      // this context is already current, so replaying the canonical snapshot
      // here would clobber fresher local state and never creates a second
      // history entry. Only the revision fence and dirty projection advance.
      if (ownsProjectDocumentOperationIds(event.acceptedOperationIds)) {
        acceptProjectDocumentRevision(event.sessionId, event.revision);
        return;
      }

      // Apply strictly newer revisions from other contexts idempotently — the
      // snapshot is authoritative state from the canonical main-process
      // document. Older or equal revisions carry nothing new, except the
      // initial registration snapshot which is accepted even at revision zero.
      const currentRevision = getProjectDocumentRevision();
      const isInitialRegistration = currentRevision === 0 && !useProjectStore.getState().loaded;
      if (event.revision <= currentRevision && !isInitialRegistration) return;
      if (event.snapshot) {
        acceptProjectDocumentRevision(event.sessionId, event.revision);
        // Canonical refresh keeps pending local overlays and takes the dirty
        // projection straight from the publication's saved checkpoint.
        useProjectStore.getState().refreshFromCanonical(event.snapshot as never, event.isDirty);
        // Restorations from other views reveal the origin selection here;
        // hints whose targets no longer exist reconcile to a clear state.
        // Own-context acknowledgements keep the local selection untouched.
        if (event.selectionHints && event.selectionHints.length > 0) {
          reconcileExternalSelectionHints(event.selectionHints, useProjectStore.getState().score);
        }
      }
      if (event.runtimeOutcomes && event.runtimeOutcomes.length > 0) {
        useProjectStore.getState().handleRuntimeOutcomes(event.runtimeOutcomes);
      }
    });

    const unsubRuntimeOutcome = window.blueAPI.onProjectRuntimeOutcome?.((event) => {
      if (event.outcomes && event.outcomes.length > 0) {
        useProjectStore.getState().handleRuntimeOutcomes(event.outcomes);
      }
    });

    // Settlement boundary participation: pause durable submissions, drain the
    // captured prefix, and acknowledge zero outstanding work so main-owned
    // undo/redo/save execute at a settled boundary.
    const unsubPrepareBoundary = window.blueAPI.onPrepareHistoryBoundary?.((event) => {
      void handleProjectHistoryBoundary(event);
    });
    const unsubReleaseBoundary = window.blueAPI.onReleaseHistoryBoundary?.((event) => {
      handleProjectHistoryRelease(event);
    });
    void window.blueAPI
      .registerHistoryParticipant?.({
        contextId: getProjectHistoryParticipantContextId(),
        documentId: getProjectDocumentId() ?? '',
        acceptedRevision: getProjectDocumentRevision(),
      })
      ?.catch((error: unknown) => {
        console.error('[use-ipc-listeners] Failed to register history participant:', error);
      });

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'blue-settings') {
        useSettingsStore.getState().rehydrate();
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      unsubProjectLoaded();
      unsubProjectClosed();
      unsubPlaybackStatus();
      unsubPlaybackClock();
      unsubPlaybackError();
      unsubNativeMenuCommand();
      unsubSaveComplete();
      unsubSaveError();
      unsubOutput();
      unsubSelect();
      unsubReset();
      unsubRenderStatus();
      unsubEngineRecoveryStatus?.();
      unsubCsd();
      unsubCsdErr();
      unsubBlueLiveStatus();
      unsubProjectDocumentUpdated?.();
      unsubRuntimeOutcome?.();
      unsubPrepareBoundary?.();
      unsubReleaseBoundary?.();
      void window.blueAPI
        .unregisterHistoryParticipant?.({ contextId: getProjectHistoryParticipantContextId() })
        ?.catch(() => undefined);
      window.removeEventListener('storage', handleStorage);
    };
  }, [
    addRecentFile,
    acceptPlaybackClock,
    appendToTab,
    getOrCreateTab,
    handleNativeMenuCommand,
    resetPlayback,
    resetTab,
    selectTab,
    setError,
    setProjectInfo,
    setActivePanel,
    setStatus,
    setBlueLiveStatus,
    resetBlueLive,
  ]);

  useEffect(() => {
    if (!window.blueAPI || typeof window.blueAPI.setRecentFiles !== 'function') {
      return;
    }

    void window.blueAPI.setRecentFiles(recentFiles.slice());
  }, [recentFiles]);
}
