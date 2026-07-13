export {};

import type {
  EffectEditorPatchRequest,
  EffectEditorRequest,
  EffectEditorSnapshot,
  BsbRealtimeControlUpdate,
  MixerRealtimeLevelUpdate,
  EffectRealtimeUpdate,
  BlueLiveNoteTriggerRequest,
  BlueLiveNoteTriggerResult,
  EffectsLibraryPatch,
  EffectsLibrarySnapshot,
  PolyObjectLayerGroupSnapshot,
  ProjectDocumentCommitReceipt,
  ProjectDocumentPatch,
  ProjectEditorSnapshot,
  ProjectLoadedPayload,
  PlaybackClockSnapshot,
  NoteProcessorChainSnapshot,
  ScoreObjectEditorRequest,
  ScoreObjectEditorDocumentSnapshot,
  ScoreObjectTestResult,
  ScoreObjectLocationRef,
} from '../../shared/project-editor';
import type {
  MissingAudioAssetsChooseRequest,
  MissingAudioAssetsDismissRequest,
  MissingAudioAssetsResolveRequest,
  MissingAudioAssetsResolveResult,
} from '../../shared/missing-audio-assets';
import type {
  RenderToDiskRequest,
  FreezeScoreObjectsRequest,
  CancelRenderOperationRequest,
  RenderOperationResult,
  RenderOperationStatus,
  FreezeOperationResult,
} from '../../shared/render-freeze-contract';
import type { NativeMenuCommand } from '../../shared/workbench-menu';
import type { EngineOutputPayload } from '../../shared/io-provider';
import type {
  DisplayWorkArea,
  WindowLayoutSettingsSnapshot,
  WindowLayoutUpdateRequest,
} from '../../shared/window-layout-settings';
import type {
  MidiInputCommandAck,
  MidiInputServiceCommand,
  MidiInputServiceInitialization,
  MidiInputServiceSnapshot,
} from '../../shared/midi-input';

export type BlueLiveStatus = 'idle' | 'starting' | 'running' | 'stopping' | 'stopped' | 'error';

export interface BlueLiveStatusSnapshot {
  status: BlueLiveStatus;
  running: boolean;
  message?: string;
  sessionId: number;
  projectRevision?: number | null;
}

export interface EvaluateCodeRequest {
  editorKind: 'orc' | 'sco';
  text: string;
  sourcePanelId: string;
}

export interface EvaluateCodeResult {
  routedTo: 'blueLive' | 'realtime' | 'none';
  ok: boolean;
  message?: string;
}

declare global {
  interface Window {
    blueAPI: {
      openFile: () => Promise<string | null>;
      openFilePath: (filePath: string) => Promise<string | null>;
      newFile: () => Promise<string | null>;
      openBsbFileSelector: (currentValue?: string) => Promise<string | null>;
      setBsbFileSelectorPath: (filePath: string) => Promise<string | null>;
      copyBsbFileSelectorToMediaFolder: (currentValue?: string) => Promise<string | null>;
      setRecentFiles: (files: string[]) => Promise<string[]>;
      saveFile: () => Promise<string | null>;
      saveFileAs: () => Promise<string | null>;
      getProjectDocument: () => Promise<ProjectEditorSnapshot | null>;
      updateProjectDocument: (
        patch: ProjectDocumentPatch,
      ) => Promise<ProjectEditorSnapshot | null>;
      getEffectsLibrary: () => Promise<EffectsLibrarySnapshot>;
      reloadEffectsLibrary: () => Promise<EffectsLibrarySnapshot>;
      updateEffectsLibrary: (
        patch: EffectsLibraryPatch,
      ) => Promise<EffectsLibrarySnapshot>;
      importEffectFile: (parentCategoryId?: string) => Promise<EffectsLibrarySnapshot | null>;
      exportEffectFile: (effectId: string) => Promise<void>;
      focusEffectEditor: (request: EffectEditorRequest) => Promise<boolean>;
      openEffectEditor: (
        request: EffectEditorRequest,
      ) => Promise<void>;
      openEffectInterface: (
        request: EffectEditorRequest,
      ) => Promise<void>;
      getEffectEditorDocument: (
        request: EffectEditorRequest,
      ) => Promise<EffectEditorSnapshot | null>;
      updateEffectEditorDocument: (
        request: EffectEditorPatchRequest,
      ) => Promise<EffectEditorSnapshot | null>;
      commitProjectDocumentPatches: (
        patches: ProjectDocumentPatch[],
      ) => Promise<ProjectDocumentCommitReceipt>;
      readAudioFileBytes: (filePath: string) => Promise<ArrayBuffer | null>;
      readAuthorizedAudioFileBytes: (
        filePath: string,
      ) => Promise<ArrayBuffer | null>;
      getScoreObjectEditorDocument: (
        request: ScoreObjectEditorRequest,
      ) => Promise<ScoreObjectEditorDocumentSnapshot | null>;
      testScoreObject: (
        request: ScoreObjectEditorRequest,
      ) => Promise<ScoreObjectTestResult>;
      testExternalSoundObject: (
        request: ScoreObjectEditorRequest,
      ) => Promise<ScoreObjectTestResult>;
      testJavascriptSoundObject: (
        request: ScoreObjectEditorRequest,
      ) => Promise<ScoreObjectTestResult>;
      reinitializeClojureRuntime: () => Promise<{ ok: boolean; error?: string }>;
      reinitializeJythonRuntime: () => Promise<{ ok: boolean; error?: string }>;
      getNestedPolyObjectSnapshot: (
        location: ScoreObjectLocationRef,
      ) => Promise<PolyObjectLayerGroupSnapshot | null>;
      sendBsbRealtimeControlUpdate: (
        update: BsbRealtimeControlUpdate,
      ) => Promise<void>;
      sendMixerRealtimeLevelUpdate: (
        update: MixerRealtimeLevelUpdate,
      ) => Promise<void>;
      sendEffectRealtimeUpdate: (
        update: EffectRealtimeUpdate,
      ) => Promise<void>;
      readClipboardText: () => Promise<string>;
      writeClipboardText: (text: string) => Promise<void>;
      togglePlay: () => Promise<boolean>;
      stopPlayback: () => Promise<void>;
      syncFollowPlaybackState: (enabled: boolean) => void;
      getProjectInfo: () => Promise<Record<string, string> | null>;
      generateCsdToScreen: () => Promise<void>;
      generateCsdToDisk: () => Promise<void>;
      importBlueUdo: () => Promise<string | null>;
      importCsoundUdo: () => Promise<string | null>;
      exportBlueUdo: (xmlText: string) => Promise<void>;
      exportCsoundUdo: (codeText: string, udoName: string) => Promise<void>;
      onProjectLoaded: (cb: (info: ProjectLoadedPayload) => void) => () => void;
      onProjectClosed: (cb: () => void) => () => void;
      onPlaybackStatus: (cb: (status: { status: string; message?: string }) => void) => () => void;
      onPlaybackClock: (cb: (clock: PlaybackClockSnapshot) => void) => () => void;
      onPlaybackError: (cb: (error: string) => void) => () => void;
      onNativeMenuCommand: (cb: (command: NativeMenuCommand) => void) => () => void;
      onSaveComplete: (cb: (info: { filePath: string }) => void) => () => void;
      onSaveError: (cb: (error: string) => void) => () => void;
      onEngineOutput: (cb: (payload: EngineOutputPayload) => void) => () => void;
      onEngineOutputSelect: (cb: (payload: { tabName: string }) => void) => () => void;
      onEngineOutputReset: (cb: (payload: { tabName: string }) => void) => () => void;
      onGeneratedCsd: (cb: (csdText: string) => void) => () => void;
      onGeneratedCsdError: (cb: (error: string) => void) => () => void;

      // Blue Live
      toggleBlueLive: () => Promise<BlueLiveStatusSnapshot>;
      stopBlueLive: () => Promise<BlueLiveStatusSnapshot>;
      recompileBlueLive: () => Promise<BlueLiveStatusSnapshot>;
      sendBlueLiveAllNotesOff: () => Promise<{ ok: boolean; message?: string }>;
      triggerBlueLiveNote: (
        request: BlueLiveNoteTriggerRequest,
      ) => Promise<BlueLiveNoteTriggerResult>;
      getBlueLiveStatus: () => Promise<BlueLiveStatusSnapshot>;
      onBlueLiveStatus: (cb: (snapshot: BlueLiveStatusSnapshot) => void) => () => void;

      // Settings
      openSettingsWindow: () => Promise<void>;
      getProgramSettings: () => Promise<import('../../shared/program-settings').ProgramSettingsSnapshot>;
      saveProgramSettings: (
        snapshot: import('../../shared/program-settings').ProgramSettingsSnapshot,
      ) => Promise<import('../../shared/program-settings').ProgramSettingsSaveResult>;
      resetProgramSettingsPanel: (
        panel: import('../../shared/program-settings').ProgramSettingsPanelId,
      ) => Promise<import('../../shared/program-settings').ProgramSettingsSnapshot>;
      getProgramSettingsUsageMatrix: () => Promise<import('../../shared/program-settings').UsageParityMatrixEntry[]>;
      syncLegacyRendererSettings: (
        snapshot: import('../../shared/program-settings').CurrentAppSettingsSnapshot,
      ) => Promise<import('../../shared/program-settings').ProgramSettingsSnapshot>;

      // Window Layout
      getWindowLayout: () => Promise<WindowLayoutSettingsSnapshot>;
      getDisplayWorkAreas: () => Promise<DisplayWorkArea[]>;
      updateWindowLayout: (
        request: WindowLayoutUpdateRequest,
      ) => Promise<WindowLayoutSettingsSnapshot>;
      resetWindows: () => Promise<WindowLayoutSettingsSnapshot>;
      onWindowLayoutReset: (callback: () => void) => () => void;

      // Named Chains
      getNamedChainNames: () => Promise<string[]>;
      getNamedChain: (name: string) => Promise<NoteProcessorChainSnapshot | null>;

      // Evaluate Code
      evaluateCode: (request: EvaluateCodeRequest) => Promise<EvaluateCodeResult>;

      // Missing Audio Assets
      chooseMissingAudioReplacement: (
        request: MissingAudioAssetsChooseRequest,
      ) => Promise<string | null>;
      resolveMissingAudioAssets: (
        request: MissingAudioAssetsResolveRequest,
      ) => Promise<MissingAudioAssetsResolveResult>;
      dismissMissingAudioAssets: (
        request: MissingAudioAssetsDismissRequest,
      ) => Promise<{ ok: boolean }>;

      // Render / Freeze
      renderToDisk: (request: RenderToDiskRequest) => Promise<RenderOperationResult>;
      freezeScoreObjects: (request: FreezeScoreObjectsRequest) => Promise<FreezeOperationResult>;
      cancelRenderOperation: (request: CancelRenderOperationRequest) => Promise<boolean>;
      onRenderOperationStatus: (
        callback: (status: RenderOperationStatus) => void,
      ) => () => void;

      // Audio File Player
      openAudioFile: () => Promise<string | null>;
      getAudioFileStat: (
        filePath: string,
      ) => Promise<{ size: number; mtime: number } | null>;

      // MIDI Input (SPEC 058)
      initializeMidiInputService: () => Promise<MidiInputServiceInitialization | null>;
      reportMidiInputServiceSnapshot: (snapshot: MidiInputServiceSnapshot) => void;
      acknowledgeMidiInputCommand: (ack: MidiInputCommandAck) => void;
      onMidiInputServiceCommand: (
        callback: (command: MidiInputServiceCommand) => void,
      ) => () => void;
      getMidiInputServiceSnapshot: () => Promise<MidiInputServiceSnapshot | null>;
      requestMidiInputRescan: () => Promise<{ accepted: boolean; message?: string }>;
      onMidiInputServiceSnapshot: (
        callback: (snapshot: MidiInputServiceSnapshot) => void,
      ) => () => void;
    };
  }
}
