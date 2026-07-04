import { useEffect } from 'react';
import { toast } from 'sonner';
import { useProjectStore } from '../stores/project-store';
import { usePlaybackStore } from '../stores/playback-store';
import { useUIStore } from '../stores/ui-store';
import { useSettingsStore } from '../stores/settings-store';
import { useWorkbenchStore } from '../stores/workbench-store';
import { useOutputStore } from '../stores/output-store';
import { useBlueLiveStore } from '../stores/blue-live-store';
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
    if (!window.blueAPI?.getProgramSettings) return;
    window.blueAPI.getProgramSettings().then((settings: ProgramSettingsSnapshot) => {
      hydrateFromProgramSettings(settings);
    }).catch(() => {});
  }, [hydrateFromProgramSettings]);

  useEffect(() => {
    if (!window.blueAPI?.syncLegacyRendererSettings) return;
    const state = useSettingsStore.getState();
    window.blueAPI.syncLegacyRendererSettings({
      enginePath: state.enginePath,
      recentFiles: state.recentFiles,
      windowBounds: state.windowBounds,
      midiInputDevice: state.midiInputDevice,
      midiOutputDevice: state.midiOutputDevice,
      oscInputPort: state.oscInputPort,
      oscOutputHost: state.oscOutputHost,
      oscOutputPort: state.oscOutputPort,
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!window.blueAPI) return;

    const unsubProjectLoaded = window.blueAPI.onProjectLoaded((info) => {
      resetPlayback();
      resetBlueLive();
      setProjectInfo(info);
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

    const unsubNativeMenuCommand = window.blueAPI.onNativeMenuCommand((command) => {
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

    const unsubCsd = window.blueAPI.onGeneratedCsd((csdText) => {
      useProjectStore.getState().setGeneratedCsd({ text: csdText, title: 'Generated CSD' });
    });

    const unsubCsdErr = window.blueAPI.onGeneratedCsdError((error) => {
      toast.error(`CSD generation failed: ${error}`);
    });

    const unsubBlueLiveStatus = window.blueAPI.onBlueLiveStatus((snapshot) => {
      setBlueLiveStatus(snapshot);
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
      unsubCsd();
      unsubCsdErr();
      unsubBlueLiveStatus();
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
