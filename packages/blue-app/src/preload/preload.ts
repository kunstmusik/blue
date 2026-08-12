/**
 * Preload script — exposes safe IPC bridges to the renderer process.
 */
import { clipboard, contextBridge, ipcRenderer, webUtils } from 'electron';
import type {
  EffectEditorPatchRequest,
  EffectEditorRequest,
  EffectEditorSnapshot,
  TrackInstrumentEditorPatchRequest,
  TrackInstrumentEditorPatchResult,
  TrackInstrumentEditorRequest,
  TrackInstrumentEditorSnapshot,
  BsbRealtimeControlUpdate,
  BlueLiveNoteTriggerRequest,
  BlueLiveNoteTriggerResult,
  LegacyBlueLiveTriggerRequest,
  LegacyBlueLiveTriggerResult,
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
} from '../shared/project-editor';
import type {
  ScoreObjectExportResult,
  ScoreObjectImportResult,
} from '../shared/score-object-file';
import type { NativeMenuCommand } from '../shared/workbench-menu';
import {
  SOUND_FONT_FILE_SELECT_CHANNEL,
  SOUND_FONT_INSPECT_CHANNEL,
  type SoundFontInfo,
} from '../shared/soundfont-viewer';
import type {
  MidiImportCommitResult,
  MidiImportSettings,
  MidiImportStartResult,
} from '../shared/midi-import';
import {
  ABOUT_WINDOW_CLOSE_CHANNEL,
  APP_METADATA_GET_CHANNEL,
  type AppMetadata,
} from '../shared/app-metadata';
import type { EngineOutputPayload } from '../shared/io-provider';
import {
  REPL_CONSOLE_CLOSE_CHANNEL,
  REPL_CONSOLE_EVALUATE_CHANNEL,
  REPL_CONSOLE_OPEN_CHANNEL,
  REPL_CONSOLE_REINITIALIZE_CHANNEL,
  type ReplConsoleCloseRequest,
  type ReplConsoleCloseResult,
  type ReplConsoleEvaluateRequest,
  type ReplConsoleEvaluateResult,
  type ReplConsoleOpenRequest,
  type ReplConsoleOpenResult,
  type ReplConsoleReinitializeRequest,
  type ReplConsoleReinitializeResult,
} from '../shared/repl-console';
import type {
  MissingAudioAssetsChooseRequest,
  MissingAudioAssetsDismissRequest,
  MissingAudioAssetsResolveRequest,
  MissingAudioAssetsResolveResult,
} from '../shared/missing-audio-assets';
import type {
  RenderToDiskRequest,
  FreezeScoreObjectsRequest,
  CancelRenderOperationRequest,
  RenderOperationResult,
  RenderOperationStatus,
  FreezeOperationResult,
} from '../shared/render-freeze-contract';
import { RENDER_OPERATION_STATUS_CHANNEL, isRenderOperationStatus } from '../shared/render-freeze-contract';
import type {
  ProgramSettingsSnapshot,
  ProgramSettingsSaveResult,
  ProgramSettingsPanelId,
  CurrentAppSettingsSnapshot,
  UsageParityMatrixEntry,
} from '../shared/program-settings';
import type {
  EngineProbeRequest,
  EngineProbeResult,
} from '../shared/engine-runtime';
import type {
  DisplayWorkArea,
  WindowLayoutSettingsSnapshot,
  WindowLayoutUpdateRequest,
} from '../shared/window-layout-settings';
import {
  WINDOW_LAYOUT_DISPLAY_WORK_AREAS_CHANNEL,
  WINDOW_LAYOUT_RESET_CHANNEL,
} from '../shared/window-layout-settings';
import {
  PROJECT_DOCUMENT_UPDATED_CHANNEL,
  WORKBENCH_WINDOW_DOCK_GROUP_CHANNEL,
  WORKBENCH_WINDOW_REGISTER_CHANNEL,
  WORKBENCH_WINDOW_REQUEST_CLOSE_CHANNEL,
  WORKBENCH_WINDOW_REVEAL_PANEL_CHANNEL,
  WORKBENCH_WINDOW_UPDATE_OWNERSHIP_CHANNEL,
  type DockFloatingGroupRequest,
  type DockFloatingGroupResult,
  type ProjectDocumentUpdatedEvent,
  type WorkbenchRevealPanelRequest,
  type WorkbenchRevealPanelResult,
  type WorkbenchWindowCloseRequest,
  type WorkbenchWindowCloseResult,
  type WorkbenchWindowOwnershipUpdate,
  type WorkbenchWindowRegisterRequest,
  type WorkbenchWindowRegisterResponse,
} from '../shared/workbench-window-contract';
import {
  MIDI_INPUT_COMMAND_ACK_CHANNEL,
  MIDI_INPUT_GET_SNAPSHOT_CHANNEL,
  MIDI_INPUT_INITIALIZE_CHANNEL,
  MIDI_INPUT_REPORT_SNAPSHOT_CHANNEL,
  MIDI_INPUT_REQUEST_RESCAN_CHANNEL,
  MIDI_INPUT_SERVICE_COMMAND_CHANNEL,
  MIDI_INPUT_SNAPSHOT_CHANGED_CHANNEL,
  type MidiInputCommandAck,
  type MidiInputServiceCommand,
  type MidiInputServiceInitialization,
  type MidiInputServiceSnapshot,
} from '../shared/midi-input';
import {
  OSC_CONTROL_COMMAND_CHANNEL,
  OSC_CONTROL_GET_SNAPSHOT_CHANNEL,
  OSC_CONTROL_SNAPSHOT_CHANGED_CHANNEL,
  isOscCommandEvent,
  isOscServerRuntimeSnapshot,
  type OscCommandEvent,
  type OscServerRuntimeSnapshot,
} from '../shared/osc-control';
import {
  UNIFIED_LIBRARY_BROWSE_CHANNEL,
  UNIFIED_LIBRARY_APPLY_INSERTION_CHANNEL,
  UNIFIED_LIBRARY_DRAFT_RESOLVE_CHANNEL,
  UNIFIED_LIBRARY_DRAFT_SHUTDOWN_CHANNEL,
  UNIFIED_LIBRARY_EDITOR_CHANGED_CHANNEL,
  UNIFIED_LIBRARY_EDITOR_CLOSE_CHANNEL,
  UNIFIED_LIBRARY_EDITOR_GET_CHANNEL,
  UNIFIED_LIBRARY_EDITOR_OPEN_CHANNEL,
  UNIFIED_LIBRARY_EDITOR_PATCH_CHANNEL,
  UNIFIED_LIBRARY_EDITOR_REVERT_CHANNEL,
  UNIFIED_LIBRARY_EDITOR_RESOLVE_CONFLICT_CHANNEL,
  UNIFIED_LIBRARY_EDITOR_SAVE_CHANNEL,
  UNIFIED_LIBRARY_MUTATE_CHANNEL,
  UNIFIED_LIBRARY_PREPARE_MUTATION_CHANNEL,
  UNIFIED_LIBRARY_CUT_TO_CLIPBOARD_CHANNEL,
  UNIFIED_LIBRARY_SET_CLIPBOARD_CHANNEL,
  UNIFIED_LIBRARY_SET_BSB_CLIPBOARD_CHANNEL,
  UNIFIED_LIBRARY_CAPTURE_SCORE_SOUND_OBJECT_CHANNEL,
  UNIFIED_LIBRARY_CAPTURE_TRACK_INSTRUMENT_CHANNEL,
  UNIFIED_LIBRARY_CAPTURE_BLUE_LIVE_SOUND_OBJECT_CHANNEL,
  UNIFIED_LIBRARY_ADD_SCORE_SOUND_OBJECT_CHANNEL,
  UNIFIED_LIBRARY_BEGIN_DRAG_CHANNEL,
  UNIFIED_LIBRARY_CANCEL_DRAG_CHANNEL,
  UNIFIED_LIBRARY_PREVIEW_TRANSFER_CHANNEL,
  UNIFIED_LIBRARY_APPLY_TRANSFER_CHANNEL,
  UNIFIED_LIBRARY_TRANSFER_TO_USER_CHANNEL,
  UNIFIED_LIBRARY_PROJECT_DELETE_CHANNEL,
  UNIFIED_LIBRARY_PROJECT_DELETE_PREVIEW_CHANNEL,
  UNIFIED_LIBRARY_PROJECT_USAGE_CHANNEL,
  UNIFIED_LIBRARY_IMPORT_SELECT_CHANNEL,
  UNIFIED_LIBRARY_IMPORT_DIRECTORY_CHANNEL,
  UNIFIED_LIBRARY_IMPORT_EXECUTE_CHANNEL,
  UNIFIED_LIBRARY_EXPORT_CURRENT_CHANNEL,
  UNIFIED_LIBRARY_EXPORT_ALL_CHANNEL,
  UNIFIED_LIBRARY_RECOVERY_RETRY_CHANNEL,
  UNIFIED_LIBRARY_RECOVERY_RESTORE_CHANNEL,
  UNIFIED_LIBRARY_RECOVERY_FRESH_CHANNEL,
  UNIFIED_LIBRARY_CLEAR_TARGET_CHANNEL,
  UNIFIED_LIBRARY_CHANGED_CHANNEL,
  UNIFIED_LIBRARY_CONTEXT_CHANGED_CHANNEL,
  UNIFIED_LIBRARY_GET_SNAPSHOT_CHANNEL,
  UNIFIED_LIBRARY_PREVIEW_CHANNEL,
  UNIFIED_LIBRARY_PREVIEW_INSERTION_CHANNEL,
  UNIFIED_LIBRARY_SEARCH_CHANNEL,
  UNIFIED_LIBRARY_SET_CONTEXT_CHANNEL,
  UNIFIED_LIBRARY_SNAPSHOT_CHANGED_CHANNEL,
  isLibraryChangedEvent,
  isLibraryServiceSnapshot,
  isLibraryEditorSessionSnapshot,
  type LibraryChangedEvent,
  type BeginLibraryDragRequest,
  type LibraryDragDescriptor,
  type LibraryTransferPreview,
  type LibraryTransferPreviewRequest,
  type LibraryTransferSourceReference,
  type BrowseLibraryRequest,
  type BrowseLibraryResult,
  type LibraryItemKey,
  type LibraryType,
  type LibraryItemPreview,
  type LibraryContextRequest,
  type LibraryContextSnapshot,
  type LibraryInsertionPreview,
  type LibraryInsertionRequest,
  type LibraryMutationReceipt,
  type LibraryMutationPreview,
  type PrepareLibraryMutationRequest,
  type CutLibraryToClipboardRequest,
  type CutLibraryToClipboardResult,
  type LibraryInteractionClipboard,
  type BsbCanvasClipboard,
  type ScoreTimelineSoundObjectRequest,
  type TrackInstrumentClipboardRequest,
  type BlueLiveSoundObjectClipboardRequest,
  type UserLibraryMutation,
  type OpenLibraryEditorRequest,
  type LibraryEditorPatchRequest,
  type LibraryEditorConflictDecision,
  type LibraryEditorSessionSnapshot,
  type LibraryEditorSaveResult,
  type LibraryDraftShutdownPreview,
  type ProjectLibraryUsage,
  type ProjectLibraryDeletePreview,
  type ManualLibraryImportPreview,
  type ManualLibraryImportExecutionRequest,
  type ManualLibraryImportResult,
  type ProjectMutationReceipt,
  type LibraryResult,
  type LibraryServiceSnapshot,
  type SearchLibrariesRequest,
  type SearchLibrariesResult,
} from '../shared/unified-library';
import {
  CODE_REPOSITORY_CHANGED_CHANNEL,
  CODE_REPOSITORY_COMMIT_DRAFT_CHANNEL,
  CODE_REPOSITORY_CREATE_GROUP_CHANNEL,
  CODE_REPOSITORY_CREATE_SNIPPET_CHANNEL,
  CODE_REPOSITORY_DELETE_NODE_CHANNEL,
  CODE_REPOSITORY_EXPORT_XML_CHANNEL,
  CODE_REPOSITORY_GET_SNAPSHOT_CHANNEL,
  CODE_REPOSITORY_GET_STATUS_CHANNEL,
  CODE_REPOSITORY_IMPORT_FILE_CHANNEL,
  CODE_REPOSITORY_MOVE_NODE_CHANNEL,
  CODE_REPOSITORY_RETRY_CHANNEL,
  CODE_REPOSITORY_UPDATE_NODE_CHANNEL,
  createCodeRepositoryError,
  isCodeRepositoryChangedEvent,
  isCodeRepositoryExportFileResult,
  isCodeRepositoryImportResult,
  isCodeRepositoryResult,
  isCodeRepositorySnapshot,
  isCodeRepositoryStatus,
  type CodeRepositoryChangedEvent,
  type CodeRepositoryCommitDraftRequest,
  type CodeRepositoryCreateGroupRequest,
  type CodeRepositoryCreateSnippetRequest,
  type CodeRepositoryDeleteNodeRequest,
  type CodeRepositoryExportFileResult,
  type CodeRepositoryImportFileRequest,
  type CodeRepositoryImportResult,
  type CodeRepositoryMoveNodeRequest,
  type CodeRepositoryResult,
  type CodeRepositoryStatus,
  type CodeRepositoryUpdateNodeRequest,
} from '../shared/code-repository';

function invalidCodeRepositoryResponse<T>(message: string): CodeRepositoryResult<T> {
  return {
    ok: false,
    error: createCodeRepositoryError('storage-unavailable', message, true),
  };
}

function invokeCodeRepository<T>(
  channel: string,
  isSuccessValue: (value: unknown) => value is T,
  ...args: readonly unknown[]
): Promise<CodeRepositoryResult<T>> {
  return ipcRenderer.invoke(channel, ...args).then(
    (value: unknown) =>
      isCodeRepositoryResult(value, isSuccessValue)
        ? value
        : invalidCodeRepositoryResponse<T>('Invalid response from the Code Repository service.'),
    () => invalidCodeRepositoryResponse<T>('Unable to reach the Code Repository service.'),
  );
}

function invokeCodeRepositoryStatus(): Promise<CodeRepositoryStatus> {
  return ipcRenderer.invoke(CODE_REPOSITORY_GET_STATUS_CHANNEL).then(
    (value: unknown) =>
      isCodeRepositoryStatus(value)
        ? value
        : {
            available: false,
            migrationStatus: 'failed',
            diagnostic: {
              code: 'storage-unavailable',
              message: 'Invalid response from the Code Repository service.',
            },
          },
    () => ({
      available: false,
      migrationStatus: 'failed',
      diagnostic: {
        code: 'storage-unavailable',
        message: 'Unable to reach the Code Repository service.',
      },
    }),
  );
}

contextBridge.exposeInMainWorld('blueAPI', {
  // Unified Libraries
  getLibraryServiceSnapshot: () =>
    ipcRenderer.invoke(UNIFIED_LIBRARY_GET_SNAPSHOT_CHANNEL) as Promise<LibraryServiceSnapshot>,
  browseLibraries: (request: BrowseLibraryRequest) =>
    ipcRenderer.invoke(UNIFIED_LIBRARY_BROWSE_CHANNEL, request) as Promise<LibraryResult<BrowseLibraryResult>>,
  searchLibraries: (request: SearchLibrariesRequest) =>
    ipcRenderer.invoke(UNIFIED_LIBRARY_SEARCH_CHANNEL, request) as Promise<LibraryResult<SearchLibrariesResult>>,
  getLibraryItemPreview: (key: LibraryItemKey) =>
    ipcRenderer.invoke(UNIFIED_LIBRARY_PREVIEW_CHANNEL, key) as Promise<LibraryResult<LibraryItemPreview>>,
  beginLibraryDrag: (request: BeginLibraryDragRequest) =>
    ipcRenderer.invoke(UNIFIED_LIBRARY_BEGIN_DRAG_CHANNEL, request) as Promise<LibraryResult<LibraryDragDescriptor>>,
  cancelLibraryDrag: (dragSessionId: string) =>
    ipcRenderer.invoke(UNIFIED_LIBRARY_CANCEL_DRAG_CHANNEL, dragSessionId) as Promise<void>,
  previewLibraryTransfer: (request: LibraryTransferPreviewRequest) =>
    ipcRenderer.invoke(UNIFIED_LIBRARY_PREVIEW_TRANSFER_CHANNEL, request) as Promise<LibraryResult<LibraryTransferPreview>>,
  applyLibraryTransfer: (previewToken: string) =>
    ipcRenderer.invoke(UNIFIED_LIBRARY_APPLY_TRANSFER_CHANNEL, previewToken) as Promise<LibraryResult<ProjectMutationReceipt>>,
  setLibraryContext: (request: LibraryContextRequest) =>
    ipcRenderer.invoke(UNIFIED_LIBRARY_SET_CONTEXT_CHANNEL, request) as Promise<LibraryResult<LibraryContextSnapshot>>,
  clearLibraryInsertionTarget: () =>
    ipcRenderer.invoke(UNIFIED_LIBRARY_CLEAR_TARGET_CHANNEL) as Promise<LibraryContextSnapshot>,
  previewLibraryInsertion: (request: LibraryInsertionRequest) =>
    ipcRenderer.invoke(UNIFIED_LIBRARY_PREVIEW_INSERTION_CHANNEL, request) as Promise<LibraryResult<LibraryInsertionPreview>>,
  applyLibraryInsertion: (previewToken: string) =>
    ipcRenderer.invoke(UNIFIED_LIBRARY_APPLY_INSERTION_CHANNEL, { previewToken }) as Promise<LibraryResult<ProjectMutationReceipt>>,
  applyLibraryMutation: (request: UserLibraryMutation) =>
    ipcRenderer.invoke(UNIFIED_LIBRARY_MUTATE_CHANNEL, request) as Promise<LibraryResult<LibraryMutationReceipt>>,
  prepareLibraryMutation: (request: PrepareLibraryMutationRequest) =>
    ipcRenderer.invoke(UNIFIED_LIBRARY_PREPARE_MUTATION_CHANNEL, request) as Promise<LibraryResult<LibraryMutationPreview>>,
  cutLibraryToClipboard: (request: CutLibraryToClipboardRequest) =>
    ipcRenderer.invoke(UNIFIED_LIBRARY_CUT_TO_CLIPBOARD_CHANNEL, request) as Promise<LibraryResult<CutLibraryToClipboardResult>>,
  setLibraryClipboard: (clipboard: LibraryInteractionClipboard | null) =>
    ipcRenderer.invoke(UNIFIED_LIBRARY_SET_CLIPBOARD_CHANNEL, clipboard) as Promise<boolean>,
  setBsbClipboard: (clipboard: BsbCanvasClipboard | null) =>
    ipcRenderer.invoke(UNIFIED_LIBRARY_SET_BSB_CLIPBOARD_CHANNEL, clipboard) as Promise<boolean>,
  captureScoreSoundObjectClipboard: (request: ScoreTimelineSoundObjectRequest) =>
    ipcRenderer.invoke(UNIFIED_LIBRARY_CAPTURE_SCORE_SOUND_OBJECT_CHANNEL, request) as Promise<LibraryResult<LibraryInteractionClipboard>>,
  captureTrackInstrumentClipboard: (request: TrackInstrumentClipboardRequest) =>
    ipcRenderer.invoke(UNIFIED_LIBRARY_CAPTURE_TRACK_INSTRUMENT_CHANNEL, request) as Promise<LibraryResult<LibraryInteractionClipboard>>,
  captureBlueLiveSoundObjectClipboard: (request: BlueLiveSoundObjectClipboardRequest) =>
    ipcRenderer.invoke(UNIFIED_LIBRARY_CAPTURE_BLUE_LIVE_SOUND_OBJECT_CHANNEL, request) as Promise<LibraryResult<LibraryInteractionClipboard>>,
  addScoreSoundObjectToProjectLibrary: (request: ScoreTimelineSoundObjectRequest) =>
    ipcRenderer.invoke(UNIFIED_LIBRARY_ADD_SCORE_SOUND_OBJECT_CHANNEL, request) as Promise<LibraryResult<ProjectMutationReceipt>>,
  openLibraryItemEditor: (request: OpenLibraryEditorRequest) =>
    ipcRenderer.invoke(UNIFIED_LIBRARY_EDITOR_OPEN_CHANNEL, request) as Promise<LibraryResult<LibraryEditorSessionSnapshot>>,
  getLibraryEditorSession: (sessionId: string) =>
    ipcRenderer.invoke(UNIFIED_LIBRARY_EDITOR_GET_CHANNEL, sessionId) as Promise<LibraryResult<LibraryEditorSessionSnapshot>>,
  patchLibraryEditorSession: (request: LibraryEditorPatchRequest) =>
    ipcRenderer.invoke(UNIFIED_LIBRARY_EDITOR_PATCH_CHANNEL, request) as Promise<LibraryResult<LibraryEditorSessionSnapshot>>,
  saveLibraryEditorSession: (sessionId: string) =>
    ipcRenderer.invoke(UNIFIED_LIBRARY_EDITOR_SAVE_CHANNEL, sessionId) as Promise<LibraryResult<LibraryEditorSaveResult>>,
  revertLibraryEditorSession: (sessionId: string) =>
    ipcRenderer.invoke(UNIFIED_LIBRARY_EDITOR_REVERT_CHANNEL, sessionId) as Promise<LibraryResult<LibraryEditorSessionSnapshot>>,
  resolveLibraryEditorConflict: (sessionId: string, decision: LibraryEditorConflictDecision) =>
    ipcRenderer.invoke(UNIFIED_LIBRARY_EDITOR_RESOLVE_CONFLICT_CHANNEL, { sessionId, decision }) as Promise<LibraryResult<LibraryEditorSessionSnapshot>>,
  closeLibraryEditorSession: (sessionId: string, decision?: 'discard' | 'cancel') =>
    ipcRenderer.invoke(UNIFIED_LIBRARY_EDITOR_CLOSE_CHANNEL, { sessionId, decision }) as Promise<LibraryResult<boolean>>,
  prepareLibraryDraftShutdown: (reason: LibraryDraftShutdownPreview['reason']) =>
    ipcRenderer.invoke(UNIFIED_LIBRARY_DRAFT_SHUTDOWN_CHANNEL, reason) as Promise<LibraryDraftShutdownPreview>,
  resolveLibraryDraftShutdown: (decision: 'save' | 'discard' | 'cancel') =>
    ipcRenderer.invoke(UNIFIED_LIBRARY_DRAFT_RESOLVE_CHANNEL, decision) as Promise<{ mayContinue: boolean }>,
  getProjectLibraryUsage: (key: LibraryItemKey) =>
    ipcRenderer.invoke(UNIFIED_LIBRARY_PROJECT_USAGE_CHANNEL, key) as Promise<LibraryResult<ProjectLibraryUsage>>,
  previewProjectLibraryDelete: (key: LibraryItemKey) =>
    ipcRenderer.invoke(UNIFIED_LIBRARY_PROJECT_DELETE_PREVIEW_CHANNEL, key) as Promise<LibraryResult<ProjectLibraryDeletePreview>>,
  deleteProjectLibraryItem: (key: LibraryItemKey, confirmationToken: string) =>
    ipcRenderer.invoke(UNIFIED_LIBRARY_PROJECT_DELETE_CHANNEL, { key, confirmationToken }) as Promise<LibraryResult<ProjectMutationReceipt>>,
  copyLibraryTransferToUser: (source: LibraryTransferSourceReference, parentId: string) =>
    ipcRenderer.invoke(UNIFIED_LIBRARY_TRANSFER_TO_USER_CHANNEL, { source, parentId }) as Promise<LibraryResult<LibraryMutationReceipt>>,
  selectLibraryImportFiles: () =>
    ipcRenderer.invoke(UNIFIED_LIBRARY_IMPORT_SELECT_CHANNEL) as Promise<LibraryResult<ManualLibraryImportPreview> | null>,
  selectLibraryImportDirectory: () =>
    ipcRenderer.invoke(UNIFIED_LIBRARY_IMPORT_DIRECTORY_CHANNEL) as Promise<LibraryResult<ManualLibraryImportPreview> | null>,
  executeLibraryImport: (request: ManualLibraryImportExecutionRequest) =>
    ipcRenderer.invoke(UNIFIED_LIBRARY_IMPORT_EXECUTE_CHANNEL, request) as Promise<LibraryResult<ManualLibraryImportResult>>,
  exportCurrentLibrary: (libraryType: LibraryType) =>
    ipcRenderer.invoke(UNIFIED_LIBRARY_EXPORT_CURRENT_CHANNEL, libraryType) as Promise<LibraryResult<true> | null>,
  exportAllLibraries: () =>
    ipcRenderer.invoke(UNIFIED_LIBRARY_EXPORT_ALL_CHANNEL) as Promise<LibraryResult<true> | null>,
  retryLibraryRecovery: () =>
    ipcRenderer.invoke(UNIFIED_LIBRARY_RECOVERY_RETRY_CHANNEL) as Promise<LibraryResult<LibraryServiceSnapshot>>,
  restoreLibraryBackup: () =>
    ipcRenderer.invoke(UNIFIED_LIBRARY_RECOVERY_RESTORE_CHANNEL) as Promise<LibraryResult<LibraryServiceSnapshot> | null>,
  createFreshLibraryDatabase: () =>
    ipcRenderer.invoke(UNIFIED_LIBRARY_RECOVERY_FRESH_CHANNEL) as Promise<LibraryResult<LibraryServiceSnapshot>>,
  onLibraryEditorSessionChanged: (callback: (session: LibraryEditorSessionSnapshot) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: unknown) => {
      if (isLibraryEditorSessionSnapshot(payload)) callback(payload);
    };
    ipcRenderer.on(UNIFIED_LIBRARY_EDITOR_CHANGED_CHANNEL, handler);
    return () => { ipcRenderer.removeListener(UNIFIED_LIBRARY_EDITOR_CHANGED_CHANNEL, handler); };
  },
  onLibraryContextChanged: (callback: (context: LibraryContextSnapshot) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, context: LibraryContextSnapshot) => callback(context);
    ipcRenderer.on(UNIFIED_LIBRARY_CONTEXT_CHANGED_CHANNEL, handler);
    return () => { ipcRenderer.removeListener(UNIFIED_LIBRARY_CONTEXT_CHANGED_CHANNEL, handler); };
  },
  onLibraryServiceSnapshot: (callback: (snapshot: LibraryServiceSnapshot) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, snapshot: unknown) => {
      if (isLibraryServiceSnapshot(snapshot)) callback(snapshot);
    };
    ipcRenderer.on(UNIFIED_LIBRARY_SNAPSHOT_CHANGED_CHANNEL, handler);
    return () => { ipcRenderer.removeListener(UNIFIED_LIBRARY_SNAPSHOT_CHANGED_CHANNEL, handler); };
  },
  onLibraryChanged: (callback: (event: LibraryChangedEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: unknown) => {
      if (isLibraryChangedEvent(payload)) callback(payload);
    };
    ipcRenderer.on(UNIFIED_LIBRARY_CHANGED_CHANNEL, handler);
    return () => { ipcRenderer.removeListener(UNIFIED_LIBRARY_CHANGED_CHANNEL, handler); };
  },

  // Code Repository
  getCodeRepositorySnapshot: () =>
    invokeCodeRepository(CODE_REPOSITORY_GET_SNAPSHOT_CHANNEL, isCodeRepositorySnapshot),
  getCodeRepositoryStatus: () => invokeCodeRepositoryStatus(),
  commitCodeRepositoryDraft: (request: CodeRepositoryCommitDraftRequest) =>
    invokeCodeRepository(CODE_REPOSITORY_COMMIT_DRAFT_CHANNEL, isCodeRepositorySnapshot, request),
  createCodeRepositoryGroup: (request: CodeRepositoryCreateGroupRequest) =>
    invokeCodeRepository(CODE_REPOSITORY_CREATE_GROUP_CHANNEL, isCodeRepositorySnapshot, request),
  createCodeRepositorySnippet: (request: CodeRepositoryCreateSnippetRequest) =>
    invokeCodeRepository(CODE_REPOSITORY_CREATE_SNIPPET_CHANNEL, isCodeRepositorySnapshot, request),
  moveCodeRepositoryNode: (request: CodeRepositoryMoveNodeRequest) =>
    invokeCodeRepository(CODE_REPOSITORY_MOVE_NODE_CHANNEL, isCodeRepositorySnapshot, request),
  updateCodeRepositoryNode: (request: CodeRepositoryUpdateNodeRequest) =>
    invokeCodeRepository(CODE_REPOSITORY_UPDATE_NODE_CHANNEL, isCodeRepositorySnapshot, request),
  deleteCodeRepositoryNode: (request: CodeRepositoryDeleteNodeRequest) =>
    invokeCodeRepository(CODE_REPOSITORY_DELETE_NODE_CHANNEL, isCodeRepositorySnapshot, request),
  importCodeRepositoryFile: (request: CodeRepositoryImportFileRequest) =>
    ipcRenderer.invoke(CODE_REPOSITORY_IMPORT_FILE_CHANNEL, request).then(
      (value: unknown) => {
        if (value === null) return null;
        return isCodeRepositoryResult(value, isCodeRepositoryImportResult)
          ? value
          : invalidCodeRepositoryResponse<CodeRepositoryImportResult>(
              'Invalid response from the Code Repository service.',
            );
      },
      () => invalidCodeRepositoryResponse<CodeRepositoryImportResult>(
        'Unable to reach the Code Repository service.',
      ),
    ),
  exportCodeRepositoryXml: () =>
    ipcRenderer.invoke(CODE_REPOSITORY_EXPORT_XML_CHANNEL).then(
      (value: unknown) => {
        if (value === null) return null;
        return isCodeRepositoryResult(value, isCodeRepositoryExportFileResult)
          ? value
          : invalidCodeRepositoryResponse<CodeRepositoryExportFileResult>(
              'Invalid response from the Code Repository service.',
            );
      },
      () => invalidCodeRepositoryResponse<CodeRepositoryExportFileResult>(
        'Unable to reach the Code Repository service.',
      ),
    ),
  retryCodeRepository: () =>
    invokeCodeRepository(CODE_REPOSITORY_RETRY_CHANNEL, isCodeRepositoryStatus),
  onCodeRepositoryChanged: (callback: (event: CodeRepositoryChangedEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, value: unknown) => {
      if (isCodeRepositoryChangedEvent(value)) callback(value);
    };
    ipcRenderer.on(CODE_REPOSITORY_CHANGED_CHANNEL, handler);
    return () => {
      ipcRenderer.removeListener(CODE_REPOSITORY_CHANGED_CHANNEL, handler);
    };
  },

  // File operations
  openFile: () => ipcRenderer.invoke('open-file'),
  openFilePath: (filePath: string) => ipcRenderer.invoke('open-file-path', filePath),
  newFile: () => ipcRenderer.invoke('new-file'),
  openBsbFileSelector: (currentValue?: string) => ipcRenderer.invoke('open-bsb-file-selector', currentValue),
  setBsbFileSelectorPath: (filePath: string) => ipcRenderer.invoke('set-bsb-file-selector-path', filePath),
  copyBsbFileSelectorToMediaFolder: (currentValue?: string) => ipcRenderer.invoke('copy-bsb-file-selector-to-media-folder', currentValue),
  setRecentFiles: (files: string[]) => ipcRenderer.invoke('set-recent-files', files) as Promise<string[]>,
  saveFile: () => ipcRenderer.invoke('save-file'),
  saveFileAs: () => ipcRenderer.invoke('save-file-as'),
  startMidiImport: () => ipcRenderer.invoke('start-midi-import') as Promise<MidiImportStartResult>,
  commitMidiImport: (token: string, settings: MidiImportSettings[]) =>
    ipcRenderer.invoke('commit-midi-import', token, settings) as Promise<MidiImportCommitResult>,
  cancelMidiImport: (token: string) => ipcRenderer.invoke('cancel-midi-import', token) as Promise<void>,

  // Project document
  getProjectDocument: () =>
    ipcRenderer.invoke('get-project-document') as Promise<ProjectEditorSnapshot | null>,
  updateProjectDocument: (patch: ProjectDocumentPatch) =>
    ipcRenderer.invoke('update-project-document', patch) as Promise<ProjectEditorSnapshot | null>,
  focusEffectEditor: (request: EffectEditorRequest) =>
    ipcRenderer.invoke('focus-effect-editor', request) as Promise<boolean>,
  openEffectEditor: (request: EffectEditorRequest) =>
    ipcRenderer.invoke('open-effect-editor', request) as Promise<void>,
  openEffectInterface: (request: EffectEditorRequest) =>
    ipcRenderer.invoke('open-effect-interface', request) as Promise<void>,
  openTrackInstrumentEditor: (request: TrackInstrumentEditorRequest) =>
    ipcRenderer.invoke('open-track-instrument-editor', request) as Promise<void>,
  focusTrackInstrumentEditor: (request: TrackInstrumentEditorRequest) =>
    ipcRenderer.invoke('focus-track-instrument-editor', request) as Promise<boolean>,
  getTrackInstrumentEditorDocument: (request: TrackInstrumentEditorRequest) =>
    ipcRenderer.invoke('get-track-instrument-editor-document', request) as Promise<TrackInstrumentEditorSnapshot | null>,
  updateTrackInstrumentEditorDocument: (request: TrackInstrumentEditorPatchRequest) =>
    ipcRenderer.invoke('update-track-instrument-editor-document', request) as Promise<TrackInstrumentEditorPatchResult>,
  getEffectEditorDocument: (request: EffectEditorRequest) =>
    ipcRenderer.invoke('get-effect-editor-document', request) as Promise<EffectEditorSnapshot | null>,
  updateEffectEditorDocument: (request: EffectEditorPatchRequest) =>
    ipcRenderer.invoke('update-effect-editor-document', request) as Promise<EffectEditorSnapshot | null>,
  commitProjectDocumentPatches: (patches: ProjectDocumentPatch[]) =>
    ipcRenderer.invoke('commit-project-document-patches', patches) as Promise<ProjectDocumentCommitReceipt>,
  readAudioFileBytes: (filePath: string) =>
    ipcRenderer.invoke('read-audio-file-bytes', filePath) as Promise<ArrayBuffer | null>,
  readAuthorizedAudioFileBytes: (filePath: string) =>
    ipcRenderer.invoke('read-authorized-audio-file-bytes', filePath) as Promise<ArrayBuffer | null>,
  getScoreObjectEditorDocument: (request: ScoreObjectEditorRequest) =>
    ipcRenderer.invoke('get-score-object-editor-document', request) as Promise<ScoreObjectEditorDocumentSnapshot | null>,
  getNamedChainNames: () =>
    ipcRenderer.invoke('get-named-chain-names') as Promise<string[]>,
  getNamedChain: (name: string) =>
    ipcRenderer.invoke('get-named-chain', name) as Promise<NoteProcessorChainSnapshot | null>,
  testScoreObject: (request: ScoreObjectEditorRequest) =>
    ipcRenderer.invoke('test-score-object', request) as Promise<ScoreObjectTestResult>,
  testExternalSoundObject: (request: ScoreObjectEditorRequest) =>
    ipcRenderer.invoke('test-external-sound-object', request) as Promise<ScoreObjectTestResult>,
  testJavascriptSoundObject: (request: ScoreObjectEditorRequest) =>
    ipcRenderer.invoke('test-javascript-sound-object', request) as Promise<ScoreObjectTestResult>,
  openReplConsole: (request: ReplConsoleOpenRequest) =>
    ipcRenderer.invoke(REPL_CONSOLE_OPEN_CHANNEL, request) as Promise<ReplConsoleOpenResult>,
  evaluateReplConsole: (request: ReplConsoleEvaluateRequest) =>
    ipcRenderer.invoke(REPL_CONSOLE_EVALUATE_CHANNEL, request) as Promise<ReplConsoleEvaluateResult>,
  reinitializeReplConsole: (request: ReplConsoleReinitializeRequest) =>
    ipcRenderer.invoke(REPL_CONSOLE_REINITIALIZE_CHANNEL, request) as Promise<ReplConsoleReinitializeResult>,
  closeReplConsole: (request: ReplConsoleCloseRequest) =>
    ipcRenderer.invoke(REPL_CONSOLE_CLOSE_CHANNEL, request) as Promise<ReplConsoleCloseResult>,
  reinitializeClojureRuntime: () =>
    ipcRenderer.invoke('java-runtime:reinitialize') as Promise<{ ok: boolean; error?: string }>,
  reinitializeJythonRuntime: () =>
    ipcRenderer.invoke('java-runtime:reinitialize-jython') as Promise<{ ok: boolean; error?: string }>,
  getNestedPolyObjectSnapshot: (location: ScoreObjectLocationRef) =>
    ipcRenderer.invoke('get-nested-poly-object-snapshot', location) as Promise<PolyObjectLayerGroupSnapshot | null>,
  sendBsbRealtimeControlUpdate: (update: BsbRealtimeControlUpdate) =>
    ipcRenderer.invoke('send-bsb-realtime-control-update', update) as Promise<void>,
  sendMixerRealtimeLevelUpdate: (update: import('../shared/project-editor').MixerRealtimeLevelUpdate) =>
    ipcRenderer.invoke('send-mixer-realtime-level-update', update) as Promise<void>,
  sendEffectRealtimeUpdate: (update: import('../shared/project-editor').EffectRealtimeUpdate) =>
    ipcRenderer.invoke('send-effect-realtime-update', update) as Promise<void>,

  // Clipboard
  readClipboardText: () => Promise.resolve(clipboard.readText()),
  writeClipboardText: (text: string) => {
    return Promise.resolve().then(() => {
      clipboard.writeText(text);
    });
  },

  // Playback
  togglePlay: () => ipcRenderer.invoke('toggle-play'),
  restartPlayback: () => ipcRenderer.invoke('restart-playback') as Promise<boolean>,
  stopPlayback: () => ipcRenderer.invoke('stop-playback'),
  syncFollowPlaybackState: (enabled: boolean) => ipcRenderer.send('sync-follow-playback-state', enabled),
  syncAuditionScoreObjectAvailability: (canAudition: boolean) =>
    ipcRenderer.send('sync-audition-score-object-availability', canAudition),
  auditionScoreObjects: (objectIds: string[]) =>
    ipcRenderer.invoke('audition-score-objects', objectIds) as Promise<boolean>,

  // Project info
  getProjectInfo: () => ipcRenderer.invoke('get-project-info'),

  // SoundFont Viewer
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
  selectSoundFontFile: () =>
    ipcRenderer.invoke(SOUND_FONT_FILE_SELECT_CHANNEL) as Promise<string | null>,
  inspectSoundFont: (filePath: string) =>
    ipcRenderer.invoke(SOUND_FONT_INSPECT_CHANNEL, filePath) as Promise<SoundFontInfo>,

  // About
  getAppMetadata: () => ipcRenderer.invoke(APP_METADATA_GET_CHANNEL) as Promise<AppMetadata>,
  closeAboutWindow: () => ipcRenderer.invoke(ABOUT_WINDOW_CLOSE_CHANNEL) as Promise<boolean>,

  // CSD generation
  generateCsdToScreen: () => ipcRenderer.invoke('generate-csd-to-screen'),
  generateRealtimeCsdToScreen: () => ipcRenderer.invoke('generate-realtime-csd-to-screen'),
  generateCsdToDisk: () => ipcRenderer.invoke('generate-csd-to-disk'),

  // UDO import/export
  importBlueUdo: () => ipcRenderer.invoke('import-blue-udo'),
  importCsoundUdo: () => ipcRenderer.invoke('import-csound-udo'),
  exportBlueUdo: (xmlText: string) => ipcRenderer.invoke('export-blue-udo', xmlText),
  exportCsoundUdo: (codeText: string, udoName: string) => ipcRenderer.invoke('export-csound-udo', codeText, udoName),
  importPresetFile: () => ipcRenderer.invoke('import-preset-file') as Promise<string | null>,
  exportPresetFile: (xmlText: string, presetName: string) =>
    ipcRenderer.invoke('export-preset-file', xmlText, presetName) as Promise<void>,
  exportScoreObject: (xmlText: string, objectName: string) =>
    ipcRenderer.invoke('export-score-object', xmlText, objectName) as Promise<ScoreObjectExportResult>,
  importScoreObject: () =>
    ipcRenderer.invoke('import-score-object') as Promise<ScoreObjectImportResult | null>,

  // Csound RC
  readCsoundRC: () =>
    ipcRenderer.invoke('read-csoundrc') as Promise<{ filePath: string; content: string }>,
  writeCsoundRC: (text: string) =>
    ipcRenderer.invoke('write-csoundrc', text) as Promise<{ success: boolean; filePath: string }>,

  // Event listeners
  onProjectLoaded: (callback: (info: ProjectLoadedPayload) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, info: unknown) => callback(info as ProjectLoadedPayload);
    ipcRenderer.on('project-loaded', handler);
    return () => { ipcRenderer.removeListener('project-loaded', handler); };
  },
  onProjectClosed: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('project-closed', handler);
    return () => { ipcRenderer.removeListener('project-closed', handler); };
  },
  onPlaybackStatus: (callback: (status: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: unknown) => callback(status);
    ipcRenderer.on('playback-status', handler);
    return () => { ipcRenderer.removeListener('playback-status', handler); };
  },
  onPlaybackClock: (callback: (clock: PlaybackClockSnapshot) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, clock: unknown) => callback(clock as PlaybackClockSnapshot);
    ipcRenderer.on('playback-clock', handler);
    return () => { ipcRenderer.removeListener('playback-clock', handler); };
  },
  onPlaybackError: (callback: (error: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, error: unknown) => callback(error as string);
    ipcRenderer.on('playback-error', handler);
    return () => { ipcRenderer.removeListener('playback-error', handler); };
  },
  onNativeMenuCommand: (callback: (command: NativeMenuCommand) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, command: unknown) => callback(command as NativeMenuCommand);
    ipcRenderer.on('native-menu-command', handler);
    return () => { ipcRenderer.removeListener('native-menu-command', handler); };
  },
  onSaveComplete: (callback: (info: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, info: unknown) => callback(info);
    ipcRenderer.on('save-complete', handler);
    return () => { ipcRenderer.removeListener('save-complete', handler); };
  },
  onSaveError: (callback: (error: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, error: unknown) => callback(error as string);
    ipcRenderer.on('save-error', handler);
    return () => { ipcRenderer.removeListener('save-error', handler); };
  },

  onEngineOutput: (callback: (payload: EngineOutputPayload) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: unknown) => callback(payload as EngineOutputPayload);
    ipcRenderer.on('engine-output', handler);
    return () => { ipcRenderer.removeListener('engine-output', handler); };
  },
  onEngineOutputSelect: (callback: (payload: { tabName: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: unknown) => callback(payload as { tabName: string });
    ipcRenderer.on('engine-output-select', handler);
    return () => { ipcRenderer.removeListener('engine-output-select', handler); };
  },
  onEngineOutputReset: (callback: (payload: { tabName: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: unknown) => callback(payload as { tabName: string });
    ipcRenderer.on('engine-output-reset', handler);
    return () => { ipcRenderer.removeListener('engine-output-reset', handler); };
  },
  onGeneratedCsd: (callback: (csdText: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, csdText: unknown) => callback(csdText as string);
    ipcRenderer.on('generated-csd', handler);
    return () => { ipcRenderer.removeListener('generated-csd', handler); };
  },
  onGeneratedCsdError: (callback: (error: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, error: unknown) => callback(error as string);
    ipcRenderer.on('generated-csd-error', handler);
    return () => { ipcRenderer.removeListener('generated-csd-error', handler); };
  },

  // Blue Live
  toggleBlueLive: () => ipcRenderer.invoke('blue-live:toggle'),
  stopBlueLive: () => ipcRenderer.invoke('blue-live:stop'),
  recompileBlueLive: () => ipcRenderer.invoke('blue-live:recompile'),
  sendBlueLiveAllNotesOff: () => ipcRenderer.invoke('blue-live:all-notes-off'),
  triggerBlueLiveNote: (request: BlueLiveNoteTriggerRequest) =>
    ipcRenderer.invoke('blue-live:trigger-note', request) as Promise<BlueLiveNoteTriggerResult>,
  triggerBlueLiveObjects: (request: LegacyBlueLiveTriggerRequest) =>
    ipcRenderer.invoke('blue-live:trigger-objects', request) as Promise<LegacyBlueLiveTriggerResult>,
  getBlueLiveStatus: () => ipcRenderer.invoke('blue-live:get-status'),
  onBlueLiveStatus: (callback: (snapshot: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, snapshot: unknown) => callback(snapshot);
    ipcRenderer.on('blue-live-status', handler);
    return () => { ipcRenderer.removeListener('blue-live-status', handler); };
  },

  // Settings
  openSettingsWindow: () => ipcRenderer.invoke('settings:open'),
  getProgramSettings: () =>
    ipcRenderer.invoke('program-settings:get') as Promise<ProgramSettingsSnapshot>,
  saveProgramSettings: (snapshot: ProgramSettingsSnapshot) =>
    ipcRenderer.invoke('program-settings:save', snapshot) as Promise<ProgramSettingsSaveResult>,
  resetProgramSettingsPanel: (panel: ProgramSettingsPanelId) =>
    ipcRenderer.invoke('program-settings:reset-panel', panel) as Promise<ProgramSettingsSnapshot>,
  getProgramSettingsUsageMatrix: () =>
    ipcRenderer.invoke('program-settings:usage-matrix') as Promise<UsageParityMatrixEntry[]>,
  syncLegacyRendererSettings: (snapshot: CurrentAppSettingsSnapshot) =>
    ipcRenderer.invoke('program-settings:sync-legacy-renderer-settings', snapshot) as Promise<ProgramSettingsSnapshot>,
  probeEngineRuntime: (request?: EngineProbeRequest) =>
    ipcRenderer.invoke('engine-runtime:probe', request) as Promise<EngineProbeResult>,

  // OSC Control
  getOscServerSnapshot: () =>
    ipcRenderer.invoke(OSC_CONTROL_GET_SNAPSHOT_CHANNEL) as Promise<OscServerRuntimeSnapshot>,
  onOscServerSnapshot: (callback: (snapshot: OscServerRuntimeSnapshot) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, snapshot: unknown) => {
      if (isOscServerRuntimeSnapshot(snapshot)) callback(snapshot);
    };
    ipcRenderer.on(OSC_CONTROL_SNAPSHOT_CHANGED_CHANNEL, handler);
    return () => { ipcRenderer.removeListener(OSC_CONTROL_SNAPSHOT_CHANGED_CHANNEL, handler); };
  },
  onOscCommand: (callback: (event: OscCommandEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, event: unknown) => {
      if (isOscCommandEvent(event)) callback(event);
    };
    ipcRenderer.on(OSC_CONTROL_COMMAND_CHANNEL, handler);
    return () => { ipcRenderer.removeListener(OSC_CONTROL_COMMAND_CHANNEL, handler); };
  },

  // Window Layout
  getWindowLayout: () =>
    ipcRenderer.invoke('window-layout:get') as Promise<WindowLayoutSettingsSnapshot>,
  updateWindowLayout: (request: WindowLayoutUpdateRequest) =>
    ipcRenderer.invoke('window-layout:update', request) as Promise<WindowLayoutSettingsSnapshot>,
  resetWindows: () =>
    ipcRenderer.invoke('window-layout:reset') as Promise<WindowLayoutSettingsSnapshot>,
  getDisplayWorkAreas: () =>
    ipcRenderer.invoke(WINDOW_LAYOUT_DISPLAY_WORK_AREAS_CHANNEL) as Promise<DisplayWorkArea[]>,
  onWindowLayoutReset: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on(WINDOW_LAYOUT_RESET_CHANNEL, handler);
    return () => { ipcRenderer.removeListener(WINDOW_LAYOUT_RESET_CHANNEL, handler); };
  },

  // Workbench windows (Float/Dock parity, SPEC 055)
  registerWorkbenchWindow: (request: WorkbenchWindowRegisterRequest) =>
    ipcRenderer.invoke(WORKBENCH_WINDOW_REGISTER_CHANNEL, request) as Promise<WorkbenchWindowRegisterResponse>,
  updateWorkbenchOwnership: (update: WorkbenchWindowOwnershipUpdate) =>
    ipcRenderer.send(WORKBENCH_WINDOW_UPDATE_OWNERSHIP_CHANNEL, update),
  revealWorkbenchPanel: (request: WorkbenchRevealPanelRequest) =>
    ipcRenderer.invoke(WORKBENCH_WINDOW_REVEAL_PANEL_CHANNEL, request) as Promise<WorkbenchRevealPanelResult>,
  requestWorkbenchWindowClose: (request: WorkbenchWindowCloseRequest) =>
    ipcRenderer.invoke(WORKBENCH_WINDOW_REQUEST_CLOSE_CHANNEL, request) as Promise<WorkbenchWindowCloseResult>,
  dockFloatingGroup: (request: DockFloatingGroupRequest) =>
    ipcRenderer.invoke(WORKBENCH_WINDOW_DOCK_GROUP_CHANNEL, request) as Promise<DockFloatingGroupResult>,
  onProjectDocumentUpdated: (callback: (event: ProjectDocumentUpdatedEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: unknown) =>
      callback(payload as ProjectDocumentUpdatedEvent);
    ipcRenderer.on(PROJECT_DOCUMENT_UPDATED_CHANNEL, handler);
    return () => { ipcRenderer.removeListener(PROJECT_DOCUMENT_UPDATED_CHANNEL, handler); };
  },
  // Evaluate Code
  evaluateCode: (request: { editorKind: string; text: string; sourcePanelId: string }) =>
    ipcRenderer.invoke('engine:evaluate-code', request),

  // Missing Audio Assets
  chooseMissingAudioReplacement: (request: MissingAudioAssetsChooseRequest) =>
    ipcRenderer.invoke('missing-audio-assets:choose-replacement', request) as Promise<string | null>,
  resolveMissingAudioAssets: (request: MissingAudioAssetsResolveRequest) =>
    ipcRenderer.invoke('missing-audio-assets:resolve', request) as Promise<MissingAudioAssetsResolveResult>,
  dismissMissingAudioAssets: (request: MissingAudioAssetsDismissRequest) =>
    ipcRenderer.invoke('missing-audio-assets:dismiss', request) as Promise<{ ok: boolean }>,

  // Render / Freeze
  renderToDisk: (request: RenderToDiskRequest) =>
    ipcRenderer.invoke('render-to-disk', request) as Promise<RenderOperationResult>,
  freezeScoreObjects: (request: FreezeScoreObjectsRequest) =>
    ipcRenderer.invoke('freeze-score-objects', request) as Promise<FreezeOperationResult>,
  cancelRenderOperation: (request: CancelRenderOperationRequest) =>
    ipcRenderer.invoke('cancel-render-operation', request) as Promise<boolean>,
  onRenderOperationStatus: (callback: (status: RenderOperationStatus) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: unknown) => {
      if (isRenderOperationStatus(status)) callback(status);
    };
    ipcRenderer.on(RENDER_OPERATION_STATUS_CHANNEL, handler);
    return () => { ipcRenderer.removeListener(RENDER_OPERATION_STATUS_CHANNEL, handler); };
  },

  // Audio File Player
  openAudioFile: () =>
    ipcRenderer.invoke('open-audio-file') as Promise<string | null>,
  getAudioFileStat: (filePath: string) =>
    ipcRenderer.invoke('get-audio-file-stat', filePath) as Promise<{ size: number; mtime: number } | null>,

  // MIDI Input (SPEC 058)
  initializeMidiInputService: () =>
    ipcRenderer.invoke(MIDI_INPUT_INITIALIZE_CHANNEL) as Promise<MidiInputServiceInitialization | null>,
  reportMidiInputServiceSnapshot: (snapshot: MidiInputServiceSnapshot) =>
    ipcRenderer.send(MIDI_INPUT_REPORT_SNAPSHOT_CHANNEL, snapshot),
  acknowledgeMidiInputCommand: (ack: MidiInputCommandAck) =>
    ipcRenderer.send(MIDI_INPUT_COMMAND_ACK_CHANNEL, ack),
  onMidiInputServiceCommand: (callback: (command: MidiInputServiceCommand) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, command: unknown) =>
      callback(command as MidiInputServiceCommand);
    ipcRenderer.on(MIDI_INPUT_SERVICE_COMMAND_CHANNEL, handler);
    return () => { ipcRenderer.removeListener(MIDI_INPUT_SERVICE_COMMAND_CHANNEL, handler); };
  },
  getMidiInputServiceSnapshot: () =>
    ipcRenderer.invoke(MIDI_INPUT_GET_SNAPSHOT_CHANNEL) as Promise<MidiInputServiceSnapshot | null>,
  requestMidiInputRescan: () =>
    ipcRenderer.invoke(MIDI_INPUT_REQUEST_RESCAN_CHANNEL) as Promise<{ accepted: boolean; message?: string }>,
  onMidiInputServiceSnapshot: (callback: (snapshot: MidiInputServiceSnapshot) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, snapshot: unknown) =>
      callback(snapshot as MidiInputServiceSnapshot);
    ipcRenderer.on(MIDI_INPUT_SNAPSHOT_CHANGED_CHANNEL, handler);
    return () => { ipcRenderer.removeListener(MIDI_INPUT_SNAPSHOT_CHANGED_CHANNEL, handler); };
  },
});
