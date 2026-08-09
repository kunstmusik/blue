export {};

import type {
  EffectEditorPatchRequest,
  EffectEditorRequest,
  EffectEditorSnapshot,
  TrackInstrumentEditorPatchRequest,
  TrackInstrumentEditorPatchResult,
  TrackInstrumentEditorRequest,
  TrackInstrumentEditorSnapshot,
  BsbRealtimeControlUpdate,
  MixerRealtimeLevelUpdate,
  EffectRealtimeUpdate,
  BlueLiveNoteTriggerRequest,
  BlueLiveNoteTriggerResult,
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
  ScoreObjectExportResult,
  ScoreObjectImportResult,
} from '../../shared/score-object-file';
import type { ProjectDocumentUpdatedEvent } from '../../shared/workbench-window-contract';
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
import type {
  MidiImportCommitResult,
  MidiImportSettings,
  MidiImportStartResult,
} from '../../shared/midi-import';
import type { AppMetadata } from '../../shared/app-metadata';
import type { EngineOutputPayload } from '../../shared/io-provider';
import type {
  EngineProbeRequest,
  EngineProbeResult,
} from '../../shared/engine-runtime';
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
import type {
  OscCommandEvent,
  OscServerRuntimeSnapshot,
} from '../../shared/osc-control';
import type {
  BrowseLibraryRequest,
  BeginLibraryDragRequest,
  BrowseLibraryResult,
  LibraryContextRequest,
  LibraryDragDescriptor,
  LibraryTransferPreview,
  LibraryTransferPreviewRequest,
  LibraryTransferSourceReference,
  LibraryContextSnapshot,
  LibraryChangedEvent,
  LibraryItemKey,
  LibraryItemPreview,
  LibraryInsertionPreview,
  LibraryInsertionRequest,
  LibraryResult,
  LibraryServiceSnapshot,
  SearchLibrariesRequest,
  SearchLibrariesResult,
  ProjectMutationReceipt,
  LibraryMutationReceipt,
  LibraryMutationPreview,
  PrepareLibraryMutationRequest,
  UserLibraryMutation,
  CutLibraryToClipboardRequest,
  CutLibraryToClipboardResult,
  LibraryInteractionClipboard,
  BsbCanvasClipboard,
  ScoreTimelineSoundObjectRequest,
  TrackInstrumentClipboardRequest,
  BlueLiveSoundObjectClipboardRequest,
  OpenLibraryEditorRequest,
  LibraryEditorPatchRequest,
  LibraryEditorConflictDecision,
  LibraryEditorSessionSnapshot,
  LibraryEditorSaveResult,
  LibraryDraftShutdownPreview,
  ProjectLibraryUsage,
  ProjectLibraryDeletePreview,
  ManualLibraryImportPreview,
  ManualLibraryImportExecutionRequest,
  ManualLibraryImportResult,
} from '../../shared/unified-library';

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
      // Unified Libraries
      getLibraryServiceSnapshot: () => Promise<LibraryServiceSnapshot>;
      browseLibraries: (
        request: BrowseLibraryRequest,
      ) => Promise<LibraryResult<BrowseLibraryResult>>;
      searchLibraries: (
        request: SearchLibrariesRequest,
      ) => Promise<LibraryResult<SearchLibrariesResult>>;
      getLibraryItemPreview: (
        key: LibraryItemKey,
      ) => Promise<LibraryResult<LibraryItemPreview>>;
      beginLibraryDrag: (
        request: BeginLibraryDragRequest,
      ) => Promise<LibraryResult<LibraryDragDescriptor>>;
      cancelLibraryDrag: (dragSessionId: string) => Promise<void>;
      previewLibraryTransfer: (
        request: LibraryTransferPreviewRequest,
      ) => Promise<LibraryResult<LibraryTransferPreview>>;
      applyLibraryTransfer: (
        previewToken: string,
      ) => Promise<LibraryResult<ProjectMutationReceipt>>;
      setLibraryContext: (
        request: LibraryContextRequest,
      ) => Promise<LibraryResult<LibraryContextSnapshot>>;
      clearLibraryInsertionTarget: () => Promise<LibraryContextSnapshot>;
      previewLibraryInsertion: (
        request: LibraryInsertionRequest,
      ) => Promise<LibraryResult<LibraryInsertionPreview>>;
      applyLibraryInsertion: (
        previewToken: string,
      ) => Promise<LibraryResult<ProjectMutationReceipt>>;
      applyLibraryMutation: (
        request: UserLibraryMutation,
      ) => Promise<LibraryResult<LibraryMutationReceipt>>;
      prepareLibraryMutation: (
        request: PrepareLibraryMutationRequest,
      ) => Promise<LibraryResult<LibraryMutationPreview>>;
      cutLibraryToClipboard: (
        request: CutLibraryToClipboardRequest,
      ) => Promise<LibraryResult<CutLibraryToClipboardResult>>;
      setLibraryClipboard: (clipboard: LibraryInteractionClipboard | null) => Promise<boolean>;
      setBsbClipboard: (clipboard: BsbCanvasClipboard | null) => Promise<boolean>;
      captureScoreSoundObjectClipboard: (
        request: ScoreTimelineSoundObjectRequest,
      ) => Promise<LibraryResult<LibraryInteractionClipboard>>;
      captureTrackInstrumentClipboard: (
        request: TrackInstrumentClipboardRequest,
      ) => Promise<LibraryResult<LibraryInteractionClipboard>>;
      captureBlueLiveSoundObjectClipboard: (
        request: BlueLiveSoundObjectClipboardRequest,
      ) => Promise<LibraryResult<LibraryInteractionClipboard>>;
      addScoreSoundObjectToProjectLibrary: (
        request: ScoreTimelineSoundObjectRequest,
      ) => Promise<LibraryResult<ProjectMutationReceipt>>;
      openLibraryItemEditor: (
        request: OpenLibraryEditorRequest,
      ) => Promise<LibraryResult<LibraryEditorSessionSnapshot>>;
      getLibraryEditorSession: (
        sessionId: string,
      ) => Promise<LibraryResult<LibraryEditorSessionSnapshot>>;
      patchLibraryEditorSession: (
        request: LibraryEditorPatchRequest,
      ) => Promise<LibraryResult<LibraryEditorSessionSnapshot>>;
      saveLibraryEditorSession: (
        sessionId: string,
      ) => Promise<LibraryResult<LibraryEditorSaveResult>>;
      revertLibraryEditorSession: (
        sessionId: string,
      ) => Promise<LibraryResult<LibraryEditorSessionSnapshot>>;
      resolveLibraryEditorConflict: (
        sessionId: string,
        decision: LibraryEditorConflictDecision,
      ) => Promise<LibraryResult<LibraryEditorSessionSnapshot>>;
      closeLibraryEditorSession: (
        sessionId: string,
        decision?: 'discard' | 'cancel',
      ) => Promise<LibraryResult<boolean>>;
      prepareLibraryDraftShutdown: (
        reason: LibraryDraftShutdownPreview['reason'],
      ) => Promise<LibraryDraftShutdownPreview>;
      resolveLibraryDraftShutdown: (
        decision: 'save' | 'discard' | 'cancel',
      ) => Promise<{ mayContinue: boolean }>;
      getProjectLibraryUsage: (
        key: LibraryItemKey,
      ) => Promise<LibraryResult<ProjectLibraryUsage>>;
      previewProjectLibraryDelete: (
        key: LibraryItemKey,
      ) => Promise<LibraryResult<ProjectLibraryDeletePreview>>;
      deleteProjectLibraryItem: (
        key: LibraryItemKey,
        confirmationToken: string,
      ) => Promise<LibraryResult<ProjectMutationReceipt>>;
      copyLibraryTransferToUser: (
        source: LibraryTransferSourceReference,
        parentId: string,
      ) => Promise<LibraryResult<LibraryMutationReceipt>>;
      selectLibraryImportFiles: () => Promise<LibraryResult<ManualLibraryImportPreview> | null>;
      selectLibraryImportDirectory: () => Promise<LibraryResult<ManualLibraryImportPreview> | null>;
      executeLibraryImport: (
        request: ManualLibraryImportExecutionRequest,
      ) => Promise<LibraryResult<ManualLibraryImportResult>>;
      exportCurrentLibrary: (
        libraryType: LibraryType,
      ) => Promise<LibraryResult<true> | null>;
      exportAllLibraries: () => Promise<LibraryResult<true> | null>;
      retryLibraryRecovery: () => Promise<LibraryResult<LibraryServiceSnapshot>>;
      restoreLibraryBackup: () => Promise<LibraryResult<LibraryServiceSnapshot> | null>;
      createFreshLibraryDatabase: () => Promise<LibraryResult<LibraryServiceSnapshot>>;
      onLibraryEditorSessionChanged: (
        callback: (session: LibraryEditorSessionSnapshot) => void,
      ) => () => void;
      onLibraryContextChanged: (
        callback: (context: LibraryContextSnapshot) => void,
      ) => () => void;
      onLibraryServiceSnapshot: (
        callback: (snapshot: LibraryServiceSnapshot) => void,
      ) => () => void;
      onLibraryChanged: (
        callback: (event: LibraryChangedEvent) => void,
      ) => () => void;

      openFile: () => Promise<string | null>;
      openFilePath: (filePath: string) => Promise<string | null>;
      newFile: () => Promise<string | null>;
      openBsbFileSelector: (currentValue?: string) => Promise<string | null>;
      setBsbFileSelectorPath: (filePath: string) => Promise<string | null>;
      copyBsbFileSelectorToMediaFolder: (currentValue?: string) => Promise<string | null>;
      setRecentFiles: (files: string[]) => Promise<string[]>;
      saveFile: () => Promise<string | null>;
      saveFileAs: () => Promise<string | null>;
      startMidiImport: () => Promise<MidiImportStartResult>;
      commitMidiImport: (
        token: string,
        settings: MidiImportSettings[],
      ) => Promise<MidiImportCommitResult>;
      cancelMidiImport: (token: string) => Promise<void>;
      getProjectDocument: () => Promise<ProjectEditorSnapshot | null>;
      updateProjectDocument: (
        patch: ProjectDocumentPatch,
      ) => Promise<ProjectEditorSnapshot | null>;
      focusEffectEditor: (request: EffectEditorRequest) => Promise<boolean>;
      openEffectEditor: (
        request: EffectEditorRequest,
      ) => Promise<void>;
      openEffectInterface: (
        request: EffectEditorRequest,
      ) => Promise<void>;
      openTrackInstrumentEditor: (
        request: TrackInstrumentEditorRequest,
      ) => Promise<void>;
      focusTrackInstrumentEditor: (
        request: TrackInstrumentEditorRequest,
      ) => Promise<boolean>;
      getTrackInstrumentEditorDocument: (
        request: TrackInstrumentEditorRequest,
      ) => Promise<TrackInstrumentEditorSnapshot | null>;
      updateTrackInstrumentEditorDocument: (
        request: TrackInstrumentEditorPatchRequest,
      ) => Promise<TrackInstrumentEditorPatchResult>;
      getEffectEditorDocument: (
        request: EffectEditorRequest,
      ) => Promise<EffectEditorSnapshot | null>;
      updateEffectEditorDocument: (
        request: EffectEditorPatchRequest,
      ) => Promise<EffectEditorSnapshot | null>;
      onProjectDocumentUpdated: (
        callback: (event: ProjectDocumentUpdatedEvent) => void,
      ) => () => void;
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
      restartPlayback: () => Promise<boolean>;
      stopPlayback: () => Promise<void>;
      syncFollowPlaybackState: (enabled: boolean) => void;
      getProjectInfo: () => Promise<Record<string, string> | null>;
      getAppMetadata: () => Promise<AppMetadata>;
      closeAboutWindow: () => Promise<boolean>;
      generateCsdToScreen: () => Promise<void>;
      generateRealtimeCsdToScreen: () => Promise<void>;
      generateCsdToDisk: () => Promise<void>;
      importBlueUdo: () => Promise<string | null>;
      importCsoundUdo: () => Promise<string | null>;
      exportBlueUdo: (xmlText: string) => Promise<void>;
      exportCsoundUdo: (codeText: string, udoName: string) => Promise<void>;
      exportScoreObject: (xmlText: string, objectName: string) => Promise<ScoreObjectExportResult>;
      importScoreObject: () => Promise<ScoreObjectImportResult | null>;
      readCsoundRC: () => Promise<{ filePath: string; content: string }>;
      writeCsoundRC: (text: string) => Promise<{ success: boolean; filePath: string }>;
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
      triggerBlueLiveObjects: (
        request: import('../../shared/project-editor').LegacyBlueLiveTriggerRequest,
      ) => Promise<import('../../shared/project-editor').LegacyBlueLiveTriggerResult>;
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
      probeEngineRuntime: (request?: EngineProbeRequest) => Promise<EngineProbeResult>;

      // OSC Control
      getOscServerSnapshot: () => Promise<OscServerRuntimeSnapshot>;
      onOscServerSnapshot: (
        callback: (snapshot: OscServerRuntimeSnapshot) => void,
      ) => () => void;
      onOscCommand: (callback: (event: OscCommandEvent) => void) => () => void;

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
