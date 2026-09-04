/**
 * Electron main process — manages app window, file dialogs, and engine lifecycle.
 */
import {
  app,
  BrowserWindow,
  ipcMain as electronIpcMain,
  dialog,
  Menu,
  nativeImage,
  shell,
} from 'electron';
import * as path from 'path';
import * as fs from 'fs';

import {
  BlueData,
  BlueX7,
  Effect,
  PolyObject,
  Send,
  BSBGroup,
  BSBWidget,
  TrackLayerGroup,
  setExternalCommandExecutor,
  convertCSDtoBlue,
  convertOrcScoToBlue,
  CSDImportMode,
  buildMidiImportProject,
} from '@blue/data';
import { openSettingsWindow, resolveSettingsWindowClose } from './settings-window';
import { closeAboutWindow, openAboutWindow, syncAboutWindowZoom } from './about-window';
import { resolveAppMetadata } from './app-metadata';
import {
  loadProgramSettings,
  saveProgramSettings,
  resetPanel,
  syncLegacyRendererSettings,
  updatePlaybackPreferences,
  clearSettingsCache,
} from './program-settings-store';
import {
  loadWindowLayoutSettings,
  resetWindowLayout,
  setCurrentSessionWindowResetHandler,
  updateWindowLayout,
  WINDOW_LAYOUT_RESET_CHANNEL,
} from './window-layout-store';
import {
  attachWindowStateHandlers,
  getAvailableDisplayWorkAreas,
  resetTrackedWindowsToDefaultBounds,
  restoreWindowState,
} from './window-state-manager';
import { applyProgramSettingsToNewProject } from './program-settings-application';
import {
  buildRealtimeEngineOptions as buildRealtimeEngineOptionsFromSettings,
  buildUsageMatrix,
} from './program-settings-usage';
import {
  commitAudioFileDrop,
  getFileManagerRoots,
  listFileManagerDirectory,
  validateFileManagerDirectory,
} from './file-manager-service';
import {
  NATIVE_CONFIRMATION_CHANNEL,
  type NativeConfirmationResult,
} from '../shared/confirmation-dialog';
import { showNativeConfirmation } from './native-confirmation';
import { BLUE_X7_IMPORT_SYSEX_CHANNEL, selectBlueX7SysexFile } from './blue-x7-sysex-import';
import {
  COMMIT_AUDIO_FILE_DROP_CHANNEL,
  FILE_MANAGER_GET_ROOTS_CHANNEL,
  FILE_MANAGER_LIST_DIRECTORY_CHANNEL,
  FILE_MANAGER_VALIDATE_DIRECTORY_CHANNEL,
  type CommitAudioFileDropRequest,
} from '../shared/file-manager';
import type { ProgramSettingsSnapshot } from '../shared/program-settings';
import { normalizeDefaultLayerGroupType } from '../shared/program-settings';
import {
  isEffectEditorRequest,
  isTrackInstrumentEditorPatchRequest,
  isTrackInstrumentEditorRequest,
  TRACK_INSTRUMENT_RUNTIME_STATUS_QUERY_CHANNEL,
  TRACK_INSTRUMENT_RUNTIME_STATUS_SUBSCRIBE_CHANNEL,
  TRACK_INSTRUMENT_RUNTIME_STATUS_UNSUBSCRIBE_CHANNEL,
} from '../shared/track-instrument-editor-contract';
import type { EngineProbeRequest, EngineProbeResult } from '../shared/engine-runtime';
import type { CsoundIoQueryRequest, CsoundIoQueryResult } from '../shared/csound-runtime';
import { initializeJavaScriptRuntime, JavaScriptSession } from '@blue/data';
import type { TempoMap } from '@blue/data';
import { EngineBridge } from './engine-bridge';
import {
  clearActiveBlueX7Bindings,
  createBlueX7RuntimeEnvironment,
  invalidateActiveBlueX7Binding,
  setActiveBlueX7Bindings,
  syncBlueX7InstrumentPatchToRuntime,
  type BlueX7EngineSyncDeps,
} from './blue-x7-engine-sync';
import { requestBlueX7EffectiveValues } from './blue-x7-runtime-sync';
import {
  isBlueX7EffectiveValuesRequest,
  type BlueX7EffectiveValuesRequest,
} from '../shared/project-editor/contract';
import { BlueLiveEngineSession, type BlueLiveStatusSnapshot } from './blue-live-engine';
import {
  BlueLiveTriggerController,
  stopBlueLiveForProjectReplacement,
  type BlueLiveTriggerControllerAccessors,
} from './blue-live-trigger-controller';
import { EngineRuntimeService } from './engine-runtime';
import { buildApplicationMenuTemplate } from './application-menu';
import {
  resolveExampleLibraryPickerSelection,
  resolveExampleProjectPath,
} from './example-project-path';
import { isSameProjectPathIdentity } from './project-path';
import {
  createExampleLibraryService,
  type ExampleLibraryInspection,
} from './example-library/service';
import { createFactoryManifestProvider } from './example-library/manifest';
import {
  formatExampleConflictDetail,
  runOpenExampleProjectFlow,
  type UpdateOfferChoice,
} from './open-example-project-flow';
import {
  resolveReplacementSaveDecision,
  runProjectFileReplacement,
  runTransactionalSaveAs,
} from './project-replacement-flow';
import {
  runCsdImportReplacement,
  runMidiImportReplacement,
  runNonInteractiveProjectLoad,
  runOrcScoImportReplacement,
} from './project-replacement-entry-points';
import { createAppZoomController } from './app-zoom-controller';
import { sweepStaleBlueEngineProcesses } from './engine-process-registry';
import {
  classifyEngineFailure,
  EngineRecoveryCoordinator,
  EngineRecoveryError,
} from './engine-recovery';
import { showEngineRecoveryFailureDialog } from './engine-recovery-dialog';
import type { EngineRecoverySessionKind } from '../shared/engine-recovery';
import {
  closeEffectEditorWindow,
  closeEffectEditorWindowsForOwner,
  broadcastProjectDocumentUpdateToEffectWindows,
  focusEffectEditorWindowMode,
  isEffectEditorWebContents,
  openEffectEditorWindow,
  openEffectInterfaceWindow,
} from './effect-editor-window-manager';
import {
  broadcastProjectDocumentUpdateToTrackInstrumentWindows,
  closeTrackInstrumentEditorWindows,
  closeTrackInstrumentEditorWindowsForGroup,
  closeTrackInstrumentEditorWindowsForTrack,
  focusTrackInstrumentEditorWindow,
  isTrackInstrumentEditorWebContents,
  openTrackInstrumentEditorWindow,
} from './track-instrument-editor-window-manager';
import {
  createTrackEditorRuntimeStatusCoordinator,
  type TrackEditorRuntimeStatusCoordinator,
} from './track-editor-runtime-status';
import { cleanupTempCsdSnapshots } from './render-command';
import { saveGeneratedCsdToDisk } from './csd-export';
import { normalizeWorkDirectory, resolveWorkDirectoryDefaultPath } from './work-directory';
import {
  authorizeAudioFilePath,
  readAuthorizedAudioFileBytes,
  registerBlueAudioScheme,
  registerBlueAudioProtocolHandler,
  resolveAuthorizedAudioFilePath,
} from './audio-stream-protocol';
import { createMainExternalExecutor, executeExternalTest } from './external-executor';
import { inspectSoundFont, type SoundFontExecutionSeam } from './soundfont-viewer';
import {
  buildAutomationRuntimeTimingContext,
  collectAffectedProjectScoreAutomationParameterIds,
  syncScoreAutomationParametersToEngine,
} from './score-automation-runtime-sync';
import type { JavaRuntimeClient } from './java-runtime/java-runtime-client';
import { JavaRuntimeSessionManager } from './java-runtime/java-runtime-session';
import { evaluateJavaScriptConsole } from './repl-console-runtime';
import { testScoreObject } from './score-object-test';
import {
  testPythonInstrument,
  type PythonInstrumentTestRequest,
  type PythonInstrumentTestResult,
} from './python-instrument-test';
import { auditionSelectedScoreObjects } from './audition-score-objects';
import { syncCompiledRuntimeParameterNames } from './runtime-parameter-sync';
import { syncRuntimeChannel } from './runtime-channel-sync';
import {
  syncBsbInstrumentRuntimeChannels,
  syncBsbRealtimeControlUpdate,
} from './bsb-instrument-runtime-sync';
import {
  broadcastToWorkbenchWindows,
  disposeWorkbenchWindowHost,
  getWorkbenchWindowManager,
  initWorkbenchWindowHost,
  registerFloatingWindow,
  registerMainWindow,
  routeFocusPanel,
} from './workbench-window-host';
import { getWindowTitle } from '../shared/window-title';
import {
  PROJECT_DOCUMENT_UPDATED_CHANNEL,
  type ProjectDocumentUpdatedEvent,
} from '../shared/workbench-window-contract';
import {
  REPL_CONSOLE_CLOSE_CHANNEL,
  REPL_CONSOLE_EVALUATE_CHANNEL,
  REPL_CONSOLE_OPEN_CHANNEL,
  REPL_CONSOLE_REINITIALIZE_CHANNEL,
  isReplConsoleLanguage,
  type ReplConsoleCloseRequest,
  type ReplConsoleCloseResult,
  type ReplConsoleEvaluateRequest,
  type ReplConsoleEvaluateResult,
  type ReplConsoleLanguage,
  type ReplConsoleOpenRequest,
  type ReplConsoleOpenResult,
  type ReplConsoleProjectContext,
  type ReplConsoleReinitializeRequest,
  type ReplConsoleReinitializeResult,
} from '../shared/repl-console';
import {
  SOUND_FONT_FILE_SELECT_CHANNEL,
  SOUND_FONT_INSPECT_CHANNEL,
} from '../shared/soundfont-viewer';
import { WINDOW_LAYOUT_DISPLAY_WORK_AREAS_CHANNEL } from '../shared/window-layout-settings';
import {
  JAVASCRIPT_RUNTIME_REINITIALIZE_CHANNEL,
  type ScriptRuntimeReinitializeResult,
} from '../shared/script-runtime';
import { ABOUT_WINDOW_CLOSE_CHANNEL, APP_METADATA_GET_CHANNEL } from '../shared/app-metadata';
import { MidiInputCoordinator } from './midi-input-coordinator';
import { parseMidiImportBytes } from './midi-import-parser';
import { MidiImportService } from './midi-import-service';
import type { MidiImportCommitResult, MidiImportStartResult } from '../shared/midi-import';
import { decideMidiPermission, isSameApplicationLocation } from './midi-permission';
import { OscControlService } from './osc-control-service';
import {
  SETTINGS_CLOSE_RESPONSE_CHANNEL,
  SETTINGS_CONFIRM_CLOSE_CHANNEL,
  type SettingsClosePromptResponse,
  type SettingsCloseResolution,
} from '../shared/settings-window';
import {
  OSC_CONTROL_COMMAND_CHANNEL,
  OSC_CONTROL_GET_SNAPSHOT_CHANNEL,
  OSC_CONTROL_SNAPSHOT_CHANGED_CHANNEL,
  createInitialOscServerRuntimeSnapshot,
  type OscCommandEvent,
  type OscServerRuntimeSnapshot,
} from '../shared/osc-control';
import {
  applyEffectEditablePatchToEffect,
  applyProjectDocumentPatch,
  createBsbRealtimeControlUpdate,
  createProjectEditorSnapshot,
  createEffectEditorSnapshot,
  createTrackInstrumentEditorSnapshot,
  createProjectUdoListSnapshot,
  createScoreObjectEditorDocument,
  createNestedPolyObjectSnapshot,
  resolveTimelineScoreObjects,
  createNoteProcessorChainSnapshot,
  findMixerChannelById,
  getMixerChannelSnapshotId,
  getMixerEntrySnapshotId,
  isEmptyProjectDocumentPatch,
  isScoreColorPatchAccepted,
  isBsbRealtimeControlUpdate,
  resolveTimelineTarget,
  type EffectEditorPatchRequest,
  type EffectEditorRequest,
  type EffectEditablePatch,
  type TrackInstrumentEditorPatchRequest,
  type TrackInstrumentEditorRequest,
  type TrackInstrumentEditorPatchResult,
  type BlueLiveNoteTriggerRequest,
  type BlueLiveNoteTriggerResult,
  type LegacyBlueLiveTriggerRequest,
  type LegacyBlueLiveTriggerResult,
  type BsbRealtimeControlUpdate,
  type ProjectDocumentCommitReceipt,
  type ProjectDocumentPatch,
  type ProjectLoadedPayload,
  type ClojureProjectSnapshot,
  type NoteProcessorChainSnapshot,
  type ScoreObjectEditorRequest,
  type ScoreObjectEditorDocumentSnapshot,
  type ScoreObjectTestResult,
  type ScoreObjectLocationRef,
  type ScoreObjectEditorTargetSnapshot,
  type PolyObjectLayerGroupSnapshot,
  type AudioFileSelectionResult,
  type FrozenSoundObjectSaveCopyResult,
} from '../shared/project-editor';
import {
  inspectAudioFileMetadata,
  inspectFrozenArtifact,
  selectScoreObjectAudioFile,
  saveFrozenSoundObjectCopy,
} from './score-object-file-operations';
import {
  prepareScoreObjectImport,
  validateScoreObjectExport,
  type ScoreObjectExportResult,
  type ScoreObjectImportResult,
} from '../shared/score-object-file';
import type {
  RenderToDiskRequest,
  FreezeScoreObjectsRequest,
  CancelRenderOperationRequest,
  RenderOperationResult,
  RenderOperationStatus,
  FreezeOperationResult,
  FreezeItemStatus,
  DiskRenderAction,
} from '../shared/render-freeze-contract';
import {
  RENDER_OPERATION_STATUS_CHANNEL,
  FREEZE_ITEM_STATUS_CHANNEL,
  isCancelRenderOperationRequest,
  isFreezeScoreObjectsRequest,
  isRenderToDiskRequest,
} from '../shared/render-freeze-contract';
import {
  executeRenderToDisk,
  parseCsoundProgressLine,
  resolveOutputFilePath,
  resolveRenderWorkingDirectory,
  type RenderExecutionSeam,
} from './render-to-disk';
import { generateDiskCsdForScreen, generateRealtimeCsdForScreen } from './csd-generation';
import { tokenizeCommand } from './disk-render-command';
import { executeFreezeUnfreeze, type FreezeExecutionSeam } from './freeze-score-objects';
import { spawn } from 'child_process';
import { BlueSynthBuilder } from '@blue/data';
import {
  collectMissingAudioFiles,
  buildReplacementMappings,
  applyReplacementMappings,
  getActiveMissingAudioSession,
  setActiveMissingAudioSession,
  clearMissingAudioSession,
  createMissingAudioSessionId,
} from './missing-audio-assets';
import type {
  MissingAudioAssetsChooseRequest,
  MissingAudioAssetsResolveRequest,
  MissingAudioAssetsResolveResult,
  MissingAudioAssetsSession,
} from '../shared/missing-audio-assets';
import { UnifiedLibraryService } from './unified-library/service';
import { registerUnifiedLibraryIpc } from './unified-library/ipc';
import { UnifiedLibraryProjectAdapter } from './unified-library/project-adapter';
import { CodeRepositoryService } from './code-repository/service';
import { registerCodeRepositoryIpc } from './code-repository/ipc';
import { registerMainProcessDomainIpc } from './ipc/main-process-domain-ipc';
import type {
  IpcMainEventListener,
  IpcMainInvokeHandler,
  IpcMainLike,
} from './ipc/ipc-registration';
import { createProjectLifecycle } from './project-lifecycle';
import { ProjectSession } from './project-session';
import { createStartupLifecycle } from './startup-lifecycle';
import {
  runPackagedMetadataVerificationAndExit,
  runPackagedRuntimeVerificationAndExit,
  verifyPackagedProject,
} from './packaged-runtime-verification';

let mainWindow: BrowserWindow | null = null;
const exampleFactoryManifestProvider = createFactoryManifestProvider();
const projectSession = new ProjectSession();

const collectedIpcHandlers = new Map<string, IpcMainInvokeHandler>();
const collectedIpcListeners = new Map<string, IpcMainEventListener>();

/**
 * Keeps the legacy handler bodies close to their existing owners while the
 * domain registrars own the real Electron registration and teardown. The
 * collector is only used during module evaluation; all side effects happen
 * when the five registrars are composed below.
 */
const ipcRegistration: IpcMainLike = {
  handle(channel, listener) {
    if (collectedIpcHandlers.has(channel) || collectedIpcListeners.has(channel)) {
      throw new Error(`Duplicate collected IPC registration: ${channel}`);
    }
    collectedIpcHandlers.set(channel, listener);
  },
  on(channel, listener) {
    if (collectedIpcHandlers.has(channel) || collectedIpcListeners.has(channel)) {
      throw new Error(`Duplicate collected IPC registration: ${channel}`);
    }
    collectedIpcListeners.set(channel, listener);
  },
  removeHandler() {},
  removeListener() {},
};

function getCurrentData(): BlueData {
  // The session intentionally returns null when no project is loaded. Keep
  // the legacy runtime guard behavior at call sites while giving the many
  // existing guarded paths a stable non-null type after their check.
  return projectSession.read().data as BlueData;
}

function getCurrentFilePath(): string {
  return projectSession.read().filePath as string;
}

function getCurrentProjectRevision(): number {
  return projectSession.read().revision;
}

function getCurrentProjectSessionId(): number {
  return projectSession.read().sessionId;
}
let canAuditionScoreObjects = false;
let unifiedLibraryService: UnifiedLibraryService | null = null;
let unregisterUnifiedLibraryIpc: (() => void) | null = null;
let codeRepositoryService: CodeRepositoryService | null = null;
let unregisterCodeRepositoryIpc: (() => void) | null = null;
let unregisterDomainIpc: (() => void) | null = null;

// ─── Render/Freeze operation lifecycle ───
let activeRenderOperationId: string | null = null;
let activeRenderAbortController: AbortController | null = null;
let activeRenderOperationKind: RenderOperationStatus['kind'] | null = null;
let activeRenderAction: DiskRenderAction | null = null;
let activeRenderCancellationSignal: { cancelled: boolean } | null = null;
let engineBridge: EngineBridge | null = null;
let blueLiveSession: BlueLiveEngineSession | null = null;
let blueLiveTriggerController: BlueLiveTriggerController | null = null;
let trackEditorRuntimeStatusCoordinator: TrackEditorRuntimeStatusCoordinator | null = null;

function publishTrackEditorRuntimeStatus(): void {
  trackEditorRuntimeStatusCoordinator?.publish({
    playbackRunning: engineBridge?.isCurrentlyPlaying() ?? false,
    blueLiveRunning: blueLiveSession?.isRunning() ?? false,
  });
}

/**
 * Lazily build (or return the cached) Blue Live trigger controller wired to
 * the current canonical-state accessors. The controller reads module-level
 * state through callbacks so main retains ownership.
 */
function getBlueLiveTriggerController(): BlueLiveTriggerController {
  if (blueLiveTriggerController) return blueLiveTriggerController;
  const accessors: BlueLiveTriggerControllerAccessors = {
    getCanonicalProject: () => getCurrentData(),
    getProjectSessionId: () => getCurrentProjectSessionId(),
    getDocumentRevision: () => getCurrentProjectRevision(),
    getBlueLiveSession: () => blueLiveSession,
    getJavaScriptSession: () => javaScriptSession,
    getJavaRuntimeSessionManager: () => javaRuntimeSessionManager,
    getCurrentFilePath: () => getCurrentFilePath(),
  };
  blueLiveTriggerController = new BlueLiveTriggerController(accessors);
  return blueLiveTriggerController;
}
let engineRuntimeService: EngineRuntimeService | null = null;
let isQuitting = false;
let pendingQuit = false;
let shutdownPromise: Promise<void> | null = null;
let playbackStartPromise: Promise<boolean> | null = null;
const engineRecoveryCoordinator = new EngineRecoveryCoordinator();
let activeAuditionPlayback = false;
let javaScriptRuntimeReady: Promise<void> | null = null;
let javaScriptSession: JavaScriptSession | null = null;
let javaRuntimeSessionManager: JavaRuntimeSessionManager | null = null;
let replRuntimeQueue: Promise<unknown> = Promise.resolve();
let midiInputCoordinator: MidiInputCoordinator | null = null;
let oscControlService: OscControlService | null = null;
let recentProjectFiles: string[] = [];
let currentFollowPlaybackEnabled = true;
let currentSavedFollowPlayback = true;
let currentFollowPlaybackOnStartEnabled = true;
let lastProjectOnLoadState: ProjectOnLoadState | null = null;

function getConfiguredWorkDirectory(): string | undefined {
  return normalizeWorkDirectory(loadProgramSettings().general.workDirectory);
}

async function showCsoundErrorWarning(message: string): Promise<void> {
  const settings = loadProgramSettings();
  if (!settings.general.csoundErrorWarningEnabled || !mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  const result = await showNativeConfirmation(mainWindow, {
    id: 'csound-error-warning',
    type: 'error',
    title: 'Csound Error',
    message: 'There was an error in running Csound.',
    detail: `Please view the Csound Output panel for more information.\n\n${message}`,
    actions: [{ id: 'ok', label: 'OK', role: 'accept' }],
    defaultActionId: 'ok',
    cancelActionId: 'ok',
    checkbox: {
      label: 'Disable Error Message Dialog',
      checked: false,
    },
  });

  if (result.checkboxChecked) {
    const current = loadProgramSettings();
    saveProgramSettings({
      ...current,
      general: {
        ...current.general,
        csoundErrorWarningEnabled: false,
      },
    });
  }
}

function getConfiguredWorkDirectoryDefaultPath(fileName?: string): string | undefined {
  return resolveWorkDirectoryDefaultPath(getConfiguredWorkDirectory(), fileName);
}

const appZoomController = createAppZoomController({
  loadSnapshot: () => loadProgramSettings(),
  saveSnapshot: (snapshot) => saveProgramSettings(snapshot),
  getAllWindows: () => BrowserWindow.getAllWindows(),
});

const midiImportService = new MidiImportService({
  chooseFile: async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select MIDI File',
      defaultPath: getConfiguredWorkDirectory(),
      filters: [{ name: 'MIDI File (*.mid, *.midi)', extensions: ['mid', 'midi'] }],
      properties: ['openFile'],
    });
    return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
  },
  readFile: (filePath) => fs.readFileSync(filePath),
  parseFile: parseMidiImportBytes,
  getProjectSessionId: () => getCurrentProjectSessionId(),
});

interface ProjectOnLoadState {
  projectSessionId: number;
  javaScriptSession: JavaScriptSession | null;
  jythonStateRevision: number | null;
}

// Set application name early (before ready) so macOS menu bar shows "Blue".
// NOTE: In dev mode (running `electron` CLI directly), macOS may still show
// "Electron" in some system UI until the app is packaged. A full dev server
// restart (Ctrl+C then `pnpm run dev` again) is required for this to take
// effect because it is read once at process startup.
app.setName('Blue');

if (process.env.BLUE_VERIFY_USER_DATA_PATH) {
  app.setPath('userData', path.resolve(process.env.BLUE_VERIFY_USER_DATA_PATH));
}

// Deterministic packaged metadata smoke mode. It verifies the release
// metadata consumed by the About dialog before creating windows or starting
// runtime services. The smoke driver and CI matrix rely on this exit-code
// contract.
if (process.env.BLUE_VERIFY_MODE === 'packaged-metadata') {
  runPackagedMetadataVerificationAndExit({
    isPackaged: app.isPackaged,
    appVersion: app.getVersion(),
    appPath: app.getAppPath(),
    resourcesPath: process.resourcesPath,
    releaseChannel: process.env.BLUE_RELEASE_CHANNEL,
    processVersions: {
      electron: process.versions.electron,
      chromium: process.versions.chrome,
      node: process.versions.node,
    },
  });
}

// Deterministic no-audio packaged-resource smoke mode.
// When BLUE_VERIFY_MODE=packaged-resources the main process verifies
// that every runtime dependency (Java helper, Python library, zeromq,
// node:sqlite, externalized workspace packages) is resolvable from the
// installed application and exits without creating windows or starting
// audio/engine subsystems. The smoke driver (verify-packaged-app.mjs) and
// CI matrix rely on this exit-code-based contract.
//
// Run synchronously before any other top-level side effect so window/engine
// setup never races the verifier. Subsequent IPC registrations and the
// app.whenReady() callback below never execute in this mode.
if (process.env.BLUE_VERIFY_MODE === 'packaged-resources') {
  runPackagedRuntimeVerificationAndExit({
    isPackaged: app.isPackaged,
    mainModuleDir: __dirname,
    resourcesPath: process.resourcesPath,
    userDataPath: app.getPath('userData'),
  });
}

setCurrentSessionWindowResetHandler(() => {
  resetTrackedWindowsToDefaultBounds(BrowserWindow.getAllWindows());
});

function getCurrentProjectDocument() {
  if (!getCurrentData()) {
    return null;
  }

  return createProjectEditorSnapshot(
    getCurrentData(),
    getCurrentFilePath(),
    getCurrentProjectSessionId(),
  );
}

function broadcastOscSnapshot(snapshot: OscServerRuntimeSnapshot): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed() && !window.webContents.isDestroyed()) {
      window.webContents.send(OSC_CONTROL_SNAPSHOT_CHANGED_CHANNEL, snapshot);
    }
  }
}

function dispatchOscCommand(event: OscCommandEvent): void {
  if (
    !mainWindow ||
    mainWindow.isDestroyed() ||
    mainWindow.webContents.isDestroyed() ||
    isQuitting
  ) {
    return;
  }
  mainWindow.webContents.send(OSC_CONTROL_COMMAND_CHANNEL, event);
}

function initializeOscControlService(): void {
  if (oscControlService) return;
  const preferences = loadProgramSettings().osc;
  oscControlService = new OscControlService(preferences, {
    onSnapshot: broadcastOscSnapshot,
    onCommand: dispatchOscCommand,
  });
  void oscControlService.start(preferences);
}

/**
 * Broadcasts the current project document snapshot to every registered
 * workbench renderer so floating windows see the same mutations as the main
 * workbench (SPEC 055 FR-010). Callers are responsible for incrementing
 * {@link getCurrentProjectRevision()} before invoking this so the broadcast carries
 * a fresh revision. Requires a non-null `getCurrentData()`.
 */
function broadcastProjectDocumentUpdate(sourceWindowId?: string): void {
  const snapshot = getCurrentProjectDocument();
  if (!snapshot) return;
  const event: ProjectDocumentUpdatedEvent = {
    sessionId: getCurrentProjectSessionId(),
    revision: getCurrentProjectRevision(),
    snapshot,
    ...(sourceWindowId ? { sourceWindowId } : {}),
  };
  broadcastToWorkbenchWindows(PROJECT_DOCUMENT_UPDATED_CHANNEL, event);
  broadcastProjectDocumentUpdateToEffectWindows(event);
  broadcastProjectDocumentUpdateToTrackInstrumentWindows(event);
}

function getProjectMixerChannelBySnapshotId(channelId: string) {
  if (!getCurrentData()) {
    return null;
  }

  return findMixerChannelById(getCurrentData().getMixer(), channelId);
}

function getProjectEffectEntryByRequest(request: EffectEditorRequest) {
  if (!getCurrentData() || request.ownerType !== 'project' || !request.projectRef) {
    return null;
  }

  const channel = getProjectMixerChannelBySnapshotId(request.projectRef.channelId);
  if (!channel) {
    return null;
  }

  const chain =
    request.projectRef.chain === 'pre' ? channel.getPreEffects() : channel.getPostEffects();
  const index = chain.findIndex(
    (entry) => getMixerEntrySnapshotId(entry) === request.projectRef?.entryId,
  );
  if (index < 0) {
    return null;
  }

  const entry = chain[index];
  if (!(entry instanceof Effect)) {
    return null;
  }

  return {
    channel,
    chain,
    entry,
    effectId: request.projectRef.entryId,
  };
}

function getProjectEffectEditorSnapshot(request: EffectEditorRequest) {
  const result = getProjectEffectEntryByRequest(request);
  if (!result) {
    return null;
  }

  return createEffectEditorSnapshot(result.entry, result.effectId, 'project', {
    projectRef: request.projectRef,
    projectUdos: getCurrentData() ? createProjectUdoListSnapshot(getCurrentData()) : [],
  });
}

function trackInstrumentRequestIsCurrent(request: TrackInstrumentEditorRequest): boolean {
  const { projectSessionId, projectRevision } = request.track;
  return (
    projectSessionId === getCurrentProjectSessionId() &&
    projectRevision === getCurrentProjectRevision()
  );
}

function getTrackInstrumentEditorSnapshot(request: TrackInstrumentEditorRequest) {
  if (!getCurrentData() || !trackInstrumentRequestIsCurrent(request)) return null;

  return getCurrentTrackInstrumentEditorSnapshot(request);
}

function getCurrentTrackInstrumentEditorSnapshot(request: TrackInstrumentEditorRequest) {
  if (!getCurrentData() || request.track.projectSessionId !== getCurrentProjectSessionId())
    return null;

  return createTrackInstrumentEditorSnapshot(getCurrentData(), {
    track: {
      ...request.track,
      projectSessionId: getCurrentProjectSessionId(),
      projectRevision: getCurrentProjectRevision(),
    },
  });
}

async function applyTrackInstrumentEditorPatch(
  request: TrackInstrumentEditorPatchRequest,
): Promise<TrackInstrumentEditorPatchResult> {
  const data = getCurrentData();
  if (!data) {
    return { status: 'unavailable', snapshot: null };
  }
  const currentSnapshot = getCurrentTrackInstrumentEditorSnapshot(request);
  if (!currentSnapshot) {
    return { status: 'unavailable', snapshot: null };
  }
  if (!trackInstrumentRequestIsCurrent(request)) {
    return { status: 'stale', snapshot: currentSnapshot };
  }

  const patch: ProjectDocumentPatch = {
    score: {
      type: 'updateTrackInstrument',
      track: currentSnapshot.track,
      patch: request.patch,
    },
  };
  const changed = applyProjectDocumentPatch(data, patch, {
    projectSessionId: getCurrentProjectSessionId(),
    projectRevision: getCurrentProjectRevision(),
    defaultLayerGroupType: loadProgramSettings().projectDefaults.defaultLayerGroupType,
  });
  if (!changed) {
    return { status: 'unchanged', snapshot: currentSnapshot };
  }

  projectSession.recordMutation({ changed: true });
  broadcastProjectDocumentUpdate();
  const directRealtimeUpdate = request.patch.bsbInterface
    ? createBsbRealtimeControlUpdate(
        {
          track: {
            projectSessionId: getCurrentProjectSessionId(),
            rootGroupId: request.track.rootGroupId,
            trackId: request.track.trackId,
          },
        },
        request.patch.bsbInterface,
      )
    : undefined;
  if (
    !directRealtimeUpdate &&
    (engineBridge?.isCurrentlyPlaying() || blueLiveSession?.isRunning())
  ) {
    try {
      await syncEngineWithProjectPatch(data, patch);
    } catch (error) {
      console.error('[main] Failed to sync Track instrument editor patch:', error);
    }
  }
  return {
    status: 'applied',
    snapshot: getTrackInstrumentEditorSnapshot({
      track: {
        ...request.track,
        projectSessionId: getCurrentProjectSessionId(),
        projectRevision: getCurrentProjectRevision(),
      },
    }),
  };
}

function computeInterfaceBounds(effect: Effect): { maxW: number; maxH: number } {
  let maxW = 1;
  let maxH = 1;
  const gi = effect.getGraphicInterface();
  const rootGroup = gi.getRootGroup();

  const visit = (widgets: BSBWidget[]) => {
    for (const widget of widgets) {
      if (widget instanceof BSBGroup) {
        visit(widget.getChildren());
        continue;
      }
      const ctor = widget.constructor.name;
      const size = getWidgetSize(widget, ctor);
      maxW = Math.max(maxW, widget.x + size.width);
      maxH = Math.max(maxH, widget.y + size.height);
    }
  };

  visit(rootGroup.getChildren());
  return { maxW, maxH };
}

function getWidgetSize(widget: BSBWidget, ctor: string): { width: number; height: number } {
  const w = widget as any;
  const vde = w.valueDisplayEnabled === true;

  switch (ctor) {
    case 'BSBKnob': {
      const kw = typeof w.knobWidth === 'number' ? w.knobWidth : 60;
      const le = w.labelEnabled === true;
      return { width: kw, height: kw + (le ? 16 : 0) + (vde ? 14 : 0) };
    }
    case 'BSBVSlider': {
      const sh = typeof w.sliderHeight === 'number' ? w.sliderHeight : 150;
      return { width: 50, height: sh + (vde ? 30 : 0) };
    }
    case 'BSBHSlider': {
      const sw = typeof w.sliderWidth === 'number' ? w.sliderWidth : 150;
      return { width: sw + (vde ? 50 : 0), height: 30 };
    }
    case 'BSBXYController': {
      const cw = typeof w.width === 'number' ? w.width : 100;
      const ch = typeof w.height === 'number' ? w.height : 100;
      return { width: cw + (vde ? 50 : 0), height: ch + (vde ? 30 : 0) };
    }
    default:
      return {
        width: typeof w.width === 'number' ? w.width : 50,
        height: typeof w.height === 'number' ? w.height : 24,
      };
  }
}

function applyProjectEffectEditorPatch(request: EffectEditorPatchRequest) {
  if (!getCurrentData()) {
    return null;
  }

  if (request.ownerType === 'library') {
    return null;
  }

  const effectEntry = getProjectEffectEntryByRequest(request);
  if (!effectEntry) {
    return null;
  }

  applyEffectEditablePatchToEffect(effectEntry.entry, request.patch);

  if (engineBridge?.isCurrentlyPlaying() && request.patch.bsbInterface) {
    const params = effectEntry.entry.getParameters();
    for (const param of params) {
      const varName = param.getCompilationVarName();
      if (varName) {
        void engineBridge.setChannel(varName, param.getValue(0)).catch(() => {});
      }
    }
  }

  return createEffectEditorSnapshot(effectEntry.entry, effectEntry.effectId, 'project', {
    projectRef: request.projectRef,
    projectUdos: getCurrentData() ? createProjectUdoListSnapshot(getCurrentData()) : [],
  });
}

function maybeCloseRemovedProjectEffectEditors(patch: ProjectDocumentPatch): void {
  if (!patch.mixer || !getCurrentData()) {
    return;
  }

  if (patch.mixer.type !== 'removeChainEntry') {
    return;
  }

  const channel = getProjectMixerChannelBySnapshotId(patch.mixer.channelId);
  if (!channel) {
    return;
  }

  const chain = patch.mixer.chain === 'pre' ? channel.getPreEffects() : channel.getPostEffects();
  const { entryId } = patch.mixer;
  const removed = chain.find((entry) => getMixerEntrySnapshotId(entry) === entryId);
  if (!removed || !(removed instanceof Effect)) {
    return;
  }

  closeEffectEditorWindow({
    ownerType: 'project',
    effectId: entryId,
    projectRef: {
      channelId: patch.mixer.channelId,
      chain: patch.mixer.chain,
      entryId,
    },
  });
}

function maybeCloseRemovedTrackInstrumentEditors(patch: ProjectDocumentPatch): void {
  const scorePatch = patch.score;
  if (!scorePatch || !getCurrentData()) return;

  if (scorePatch.type === 'removeLayerGroup') {
    closeTrackInstrumentEditorWindowsForGroup(scorePatch.groupId);
    return;
  }

  if (scorePatch.type === 'clearTrackInstrument' || scorePatch.type === 'replaceTrackInstrument') {
    closeTrackInstrumentEditorWindowsForTrack(
      scorePatch.track.rootGroupId,
      scorePatch.track.trackId,
    );
    return;
  }

  if (scorePatch.type === 'removeLayerRanges') {
    const removedCountByGroup = new Map<string, number>();
    for (const r of scorePatch.ranges) {
      const group = findTrackLayerGroupById(getCurrentData().getScore(), r.groupId);
      if (group) {
        const startIndex = Math.max(0, r.startIndex);
        const endIndex = Math.min(group.length - 1, r.endIndex);
        for (let i = startIndex; i <= endIndex; i++) {
          const track = group[i];
          if (track) {
            closeTrackInstrumentEditorWindowsForTrack(group.getUniqueId(), track.getUniqueId());
          }
        }
        if (endIndex >= startIndex) {
          removedCountByGroup.set(
            r.groupId,
            (removedCountByGroup.get(r.groupId) ?? 0) + endIndex - startIndex + 1,
          );
        }
      }
    }
    if (scorePatch.deleteEmptyLayerGroups) {
      for (const [groupId, removedCount] of removedCountByGroup) {
        const group = findTrackLayerGroupById(getCurrentData().getScore(), groupId);
        if (group && group.length > 0 && removedCount >= group.length) {
          closeTrackInstrumentEditorWindowsForGroup(groupId);
        }
      }
    }
    return;
  }

  if (scorePatch.type !== 'removeLayer') return;
  const group = findTrackLayerGroupById(getCurrentData().getScore(), scorePatch.groupId);
  const track = group?.[scorePatch.layerIndex];
  if (track) {
    closeTrackInstrumentEditorWindowsForTrack(group.getUniqueId(), track.getUniqueId());
  }
}

function findTrackLayerGroupById(
  groups: readonly unknown[],
  groupId: string,
): TrackLayerGroup | null {
  for (const candidate of groups) {
    if (candidate instanceof TrackLayerGroup) {
      const trackGroup = candidate as TrackLayerGroup;
      if (trackGroup.getUniqueId() === groupId) return trackGroup;
    }
    if (candidate instanceof PolyObject) {
      const nested = findTrackLayerGroupById(candidate as readonly unknown[], groupId);
      if (nested) return nested;
    }
  }
  return null;
}

function updateWindowTitle(): void {
  if (mainWindow) {
    mainWindow.setTitle(getWindowTitle(getCurrentFilePath()));
  }
}

// ─── Render/Freeze subprocess seam ───

/** Output tab name used to stream disk-render Csound subprocess output. */
const DISK_RENDER_OUTPUT_TAB = 'Csound (Disk)';

function createCsoundExecutionSeam(
  cancellationSignal?: { cancelled: boolean },
  streamOutput?: (text: string, type: 'stdout' | 'stderr') => void,
  options: { trackRenderProcess?: boolean } = {},
): RenderExecutionSeam & FreezeExecutionSeam & SoundFontExecutionSeam {
  const trackRenderProcess = options.trackRenderProcess ?? true;

  return {
    async runCsound(
      args: string[],
      cwd: string,
      onProgress?: (progress: number) => void,
      totalDuration?: number,
      onOutput?: (text: string, type: 'stdout' | 'stderr') => void,
    ): Promise<{
      exitCode: number;
      stderr: string;
      stdout: string;
      cancelled?: boolean;
      errorCode?: string | null;
    }> {
      const controller =
        trackRenderProcess && activeRenderAbortController
          ? activeRenderAbortController
          : new AbortController();
      if (cancellationSignal?.cancelled) controller.abort();
      let stderrLineBuffer = '';
      const result = await engineRuntimeService?.executeCsound(
        {
          kind: 'performance',
          operationId: activeRenderOperationId ?? `csound-${Date.now()}`,
          args,
          cwd,
        },
        {
          signal: controller.signal,
          onOutput: (text, source) => {
            streamOutput?.(text, source);
            onOutput?.(text, source);
            if (source !== 'stderr' || !onProgress) return;
            stderrLineBuffer += text;
            const lines = stderrLineBuffer.split('\n');
            stderrLineBuffer = lines.pop() ?? '';
            for (const line of lines) {
              const progress = parseCsoundProgressLine(line, totalDuration ?? 0);
              if (progress !== null) onProgress(progress);
            }
          },
        },
      );
      if (!result) {
        return {
          exitCode: -1,
          stderr: 'Blue Engine runtime service is unavailable.',
          stdout: '',
          errorCode: 'CSOUND_UNAVAILABLE',
        };
      }
      return {
        exitCode: result.exitCode ?? -1,
        stderr: result.stderr || (result.state === 'failed' ? result.message : ''),
        stdout: result.stdout,
        cancelled: result.state === 'cancelled',
        errorCode: result.errorCode,
      };
    },
  };
}

function finishRenderOperation(operationId: string): void {
  if (activeRenderOperationId !== operationId) return;
  activeRenderOperationId = null;
  activeRenderOperationKind = null;
  activeRenderAction = null;
  activeRenderCancellationSignal = null;
  activeRenderAbortController = null;
  rebuildApplicationMenu();
}

function launchExternalOutputCommand(
  template: string,
  outputPath: string,
  operationId: string,
  label: 'Open',
): void {
  const command = tokenizeCommand(template).map((token) =>
    token.replaceAll('$outfile', outputPath),
  );
  const executable = command.shift();
  if (!executable) {
    broadcastRenderStatus({
      operationId,
      kind: 'diskRender',
      phase: 'failed',
      message: `${label} command is empty.`,
      progress: null,
      outputPath,
      error: `${label} command is empty.`,
    });
    return;
  }

  const child = spawn(executable, command, { stdio: 'ignore' });
  let failedToStart = false;
  child.once('error', (error) => {
    failedToStart = true;
    broadcastRenderStatus({
      operationId,
      kind: 'diskRender',
      phase: 'failed',
      message: `${label} command failed: ${error.message}`,
      progress: null,
      outputPath,
      error: error.message,
    });
  });
  child.once('close', (code) => {
    if (failedToStart || code === 0) return;
    const message = `${label} command exited with code ${code ?? -1}.`;
    broadcastRenderStatus({
      operationId,
      kind: 'diskRender',
      phase: 'failed',
      message,
      progress: null,
      outputPath,
      error: message,
    });
  });
}

function broadcastRenderStatus(status: RenderOperationStatus): void {
  const withAction: RenderOperationStatus =
    activeRenderAction !== null && (status.action === undefined || status.action === null)
      ? { ...status, action: activeRenderAction }
      : status;

  if (
    withAction.kind === 'diskRender' &&
    withAction.phase === 'completed' &&
    withAction.action === 'play' &&
    withAction.outputPath &&
    !authorizeAudioFilePath(withAction.outputPath)
  ) {
    broadcastToWorkbenchWindows(RENDER_OPERATION_STATUS_CHANNEL, {
      ...withAction,
      phase: 'failed',
      message: 'Could not authorize rendered file for in-app playback.',
      error: 'Could not authorize rendered file for in-app playback.',
    });
    return;
  }

  broadcastToWorkbenchWindows(RENDER_OPERATION_STATUS_CHANNEL, withAction);
}

// ─── Render to Disk handler ───

async function handleRenderToDisk(
  action: DiskRenderAction,
  requestedOperationId?: string,
): Promise<RenderOperationResult> {
  if (!getCurrentData()) {
    return {
      ok: false,
      operationId: '',
      cancelled: false,
      outputPath: null,
      error: 'No project loaded.',
    };
  }

  if (activeRenderOperationId) {
    return {
      ok: false,
      operationId: '',
      cancelled: false,
      outputPath: null,
      error: 'Another render/freeze operation is already running.',
    };
  }

  // One-shot Blue Engine children are isolated from the realtime ZMQ session;
  // leave active playback/Blue Live untouched while an offline operation runs.

  const projectDirectory = resolveRenderWorkingDirectory(getCurrentFilePath(), app.getPath('temp'));

  const operationId = requestedOperationId ?? `disk-${Date.now()}`;
  activeRenderOperationId = operationId;
  activeRenderOperationKind = 'diskRender';
  activeRenderAction = action;
  const cancellationSignal = { cancelled: false };
  activeRenderCancellationSignal = cancellationSignal;
  activeRenderAbortController = new AbortController();
  rebuildApplicationMenu();

  try {
    const settings = loadProgramSettings();
    const props = getCurrentData().getProjectProperties();
    const javaRuntimeClient = await runProjectOnLoad(getCurrentData());

    // Resolve output file
    let outputFile = props.diskCompleteOverride
      ? null
      : resolveOutputFilePath(getCurrentData(), projectDirectory);

    if (!props.diskCompleteOverride && !outputFile) {
      const defaultName =
        props.fileName?.trim() ||
        `${getCurrentFilePath() ? path.basename(getCurrentFilePath(), '.blue') : 'untitled'}.wav`;
      const dialogDirectory = getCurrentFilePath()
        ? projectDirectory
        : (getConfiguredWorkDirectory() ?? projectDirectory);
      const result = await dialog.showSaveDialog(mainWindow!, {
        title: 'Render to Disk',
        defaultPath: path.join(dialogDirectory, defaultName),
        filters: [
          { name: 'WAV', extensions: ['wav'] },
          { name: 'AIFF', extensions: ['aif', 'aiff'] },
          { name: 'AU', extensions: ['au'] },
          { name: 'RAW', extensions: ['raw'] },
          { name: 'IRCAM', extensions: ['ircam'] },
          { name: 'W64', extensions: ['w64'] },
          { name: 'WAVEX', extensions: ['wavex'] },
          { name: 'SD2', extensions: ['sd2'] },
          { name: 'FLAC', extensions: ['flac'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (result.canceled || !result.filePath) {
        return { ok: false, operationId, cancelled: true, outputPath: null, error: null };
      }

      outputFile = result.filePath;
    }

    // Reset and focus the Csound (Disk) output tab before rendering so the
    // user sees streamed subprocess output and a fresh buffer each run.
    broadcastToWorkbenchWindows('engine-output-reset', { tabName: DISK_RENDER_OUTPUT_TAB });
    broadcastToWorkbenchWindows('engine-output-select', { tabName: DISK_RENDER_OUTPUT_TAB });

    const seam = createCsoundExecutionSeam(cancellationSignal, (text, type) =>
      broadcastToWorkbenchWindows('engine-output', {
        tabName: DISK_RENDER_OUTPUT_TAB,
        text,
        type,
      }),
    );

    const renderResult = await executeRenderToDisk(
      {
        data: getCurrentData(),
        projectDirectory,
        diskRender: settings.diskRender,
        general: settings.general,
        outputFile,
        isCancelled: () => cancellationSignal.cancelled,
        javaScriptSession: javaScriptSession ?? undefined,
        javaRuntimeClient,
      },
      action,
      operationId,
      broadcastRenderStatus,
      seam,
    );

    if (renderResult.ok && renderResult.outputPath) {
      if (action === 'play') {
        // The renderer Audio File Player handles in-app playback after the
        // completed status carries this action and output path.
      } else if (action === 'open') {
        const openCmd = settings.diskRender.externalOpenCommand.trim();
        if (openCmd && openCmd !== 'command $outfile') {
          launchExternalOutputCommand(openCmd, renderResult.outputPath, operationId, 'Open');
        } else {
          shell.showItemInFolder(renderResult.outputPath);
        }
      }
    }

    return renderResult;
  } finally {
    finishRenderOperation(operationId);
  }
}

// ─── Freeze handler ───

async function handleFreezeScoreObjects(
  request: FreezeScoreObjectsRequest,
): Promise<FreezeOperationResult> {
  if (!getCurrentData()) {
    return {
      ok: false,
      operationId: '',
      cancelled: false,
      frozenCount: 0,
      unfrozenCount: 0,
      deletedFiles: [],
      rejectedTargets: [],
      error: 'No project loaded.',
      project: null,
    };
  }

  if (activeRenderOperationId) {
    return {
      ok: false,
      operationId: '',
      cancelled: false,
      frozenCount: 0,
      unfrozenCount: 0,
      deletedFiles: [],
      rejectedTargets: [],
      error: 'Another render/freeze operation is already running.',
      project: null,
    };
  }

  const projectDirectory = getCurrentFilePath() ? path.dirname(getCurrentFilePath()) : null;
  if (!projectDirectory) {
    return {
      ok: false,
      operationId: '',
      cancelled: false,
      frozenCount: 0,
      unfrozenCount: 0,
      deletedFiles: [],
      rejectedTargets: [{ selectionId: '*', reason: 'Project must be saved before freezing.' }],
      error: 'Project must be saved before freezing.',
      project: null,
    };
  }

  const operationId = request.operationId ?? `freeze-${Date.now()}`;
  activeRenderOperationId = operationId;
  activeRenderOperationKind = 'freeze';
  activeRenderAction = null;
  const cancellationSignal = { cancelled: false };
  activeRenderCancellationSignal = cancellationSignal;
  activeRenderAbortController = new AbortController();
  rebuildApplicationMenu();

  try {
    const settings = loadProgramSettings();
    const seam = createCsoundExecutionSeam(cancellationSignal);
    const javaRuntimeClient = await runProjectOnLoad(getCurrentData());

    const result = await executeFreezeUnfreeze(
      {
        data: getCurrentData(),
        projectDirectory,
        utility: settings.utility,
        platform: process.platform,
        isCancelled: () => cancellationSignal.cancelled,
        // SPEC 085: a systemic freeze failure aborts every in-flight render
        // through the shared operation controller. The user-cancellation
        // signal stays untouched so the outcome is reported as a failure,
        // not as a cancel.
        abortInFlight: () => {
          activeRenderAbortController?.abort();
        },
        javaScriptSession: javaScriptSession ?? undefined,
        javaRuntimeClient,
      },
      request.targets,
      operationId,
      broadcastRenderStatus,
      seam,
      (itemEvent: FreezeItemStatus) => {
        broadcastToWorkbenchWindows(FREEZE_ITEM_STATUS_CHANNEL, itemEvent);
      },
    );

    // Broadcast updated project if any mutations occurred
    if (result.frozenCount > 0 || result.unfrozenCount > 0) {
      projectSession.recordMutation({ changed: true });
      broadcastProjectDocumentUpdate();
    }

    return result;
  } finally {
    finishRenderOperation(operationId);
  }
}

// ─── Cancel render operation ───

async function handleCancelRenderOperation(
  request: CancelRenderOperationRequest,
): Promise<boolean> {
  if (activeRenderOperationId !== request.operationId) {
    return false;
  }

  activeRenderCancellationSignal!.cancelled = true;

  activeRenderAbortController?.abort();

  return true;
}

function syncRecentProjectFiles(files: string[]): void {
  recentProjectFiles = [...files];
  rebuildApplicationMenu();
}

function getRecentProjectFilesSnapshot(): string[] {
  return [...recentProjectFiles];
}

function getCurrentProjectDirectory(): string | null {
  return getCurrentFilePath() ? path.dirname(getCurrentFilePath()) : null;
}

function getProjectMediaDirectory(data: BlueData, projectDirectory: string | null): string | null {
  if (!projectDirectory) return null;

  const mediaFolder = data.getProjectProperties().mediaFolder?.trim() ?? '';
  return path.isAbsolute(mediaFolder)
    ? mediaFolder
    : path.resolve(projectDirectory, mediaFolder.length > 0 ? mediaFolder : 'media');
}

function getScoreObjectFileResolutionContext(data: BlueData): {
  projectDirectory: string | null;
  sfDir: string | null;
} {
  const projectDirectory = getCurrentProjectDirectory();
  const sfDir =
    getProjectMediaDirectory(data, projectDirectory) ??
    (process.env.SFDIR && process.env.SFDIR.length > 0 ? process.env.SFDIR : null);
  return { projectDirectory, sfDir };
}

function getRealtimeSfDirOption(data: BlueData, projectDirectory: string | null): string | null {
  const sfDir = getProjectMediaDirectory(data, projectDirectory);
  if (!sfDir) return null;

  fs.mkdirSync(sfDir, { recursive: true });
  return `--env:SFDIR=${sfDir}`;
}

function buildRealtimeEngineOptions(data: BlueData, projectDirectory: string | null): string[] {
  const settings = loadProgramSettings();
  const options = buildRealtimeEngineOptionsFromSettings(data, projectDirectory, settings);

  const sfDirOption = getRealtimeSfDirOption(data, projectDirectory);
  if (sfDirOption) {
    options.push(sfDirOption);
  }

  return options;
}

function hasLoadedProject(): boolean {
  return Boolean(getCurrentData());
}

function setAuditionScoreObjectAvailability(enabled: boolean): void {
  const next = Boolean(enabled && getCurrentData());
  if (canAuditionScoreObjects === next) return;
  canAuditionScoreObjects = next;
  rebuildApplicationMenu();
}

async function canReplaceProjectWhileRenderActive(): Promise<boolean> {
  if (!activeRenderOperationId) return true;
  if (mainWindow && !mainWindow.isDestroyed()) {
    await showNativeConfirmation(mainWindow, {
      id: 'render-in-progress-notice',
      type: 'info',
      title: 'Render in Progress',
      message:
        'Wait for the active render/freeze operation to finish or cancel it before changing projects.',
      actions: [{ id: 'ok', label: 'OK', role: 'accept' }],
      defaultActionId: 'ok',
      cancelActionId: 'ok',
    });
  }
  return false;
}

async function confirmSaveBeforeReplace(
  options: { quitAfterSave?: boolean } = {},
): Promise<boolean> {
  if (!(await canReplaceProjectWhileRenderActive())) return false;
  if (!getCurrentData()) return true;
  if (!mainWindow || mainWindow.isDestroyed()) return false;

  const result = await showNativeConfirmation(mainWindow, {
    id: 'confirm-save-before-replace',
    type: 'question',
    title: 'Save Changes?',
    message: 'Save changes before proceeding?',
    detail: getCurrentFilePath()
      ? `File: ${path.basename(getCurrentFilePath())}`
      : 'This project has not been saved yet.',
    actions: [
      { id: 'save', label: 'Save', role: 'accept' },
      { id: 'discard', label: "Don't Save", role: 'destructive' },
      { id: 'cancel', label: 'Cancel', role: 'cancel' },
    ],
    defaultActionId: 'save',
    cancelActionId: 'cancel',
  });

  if (options.quitAfterSave) {
    // Quit keeps its immediate policy: Save writes then quits, Don't Save
    // quits without writing, and a cancelled or failed save aborts the quit.
    if (result.actionId === 'save' && result.outcome === 'selected') {
      pendingQuit = true;
      if (getCurrentFilePath()) {
        doSave(getCurrentFilePath());
      } else {
        const saved = await saveFileAs();
        if (!saved) {
          pendingQuit = false;
          return false;
        }
      }
      return true;
    }

    if (result.actionId === 'discard' && result.outcome === 'selected') {
      doQuit();
      return true;
    }

    return false;
  }

  // Replacement consent requires a durable save: a cancelled Save As,
  // declined overwrite, or failed write blocks the replacement (FR-011).
  const outcome = await resolveReplacementSaveDecision({
    choose: () =>
      result.actionId === 'save' && result.outcome === 'selected'
        ? 'save'
        : result.actionId === 'discard' && result.outcome === 'selected'
          ? 'discard'
          : 'cancel',
    hasCurrentProject: () => getCurrentData() !== null,
    hasCurrentPath: () => getCurrentFilePath() !== null,
    saveCurrent: () => getCurrentFilePath() !== null && doSave(getCurrentFilePath()),
    saveAs: () => saveFileAs(),
  });
  return outcome === 'saved' || outcome === 'discarded';
}

function rebuildApplicationMenu(): void {
  const menu = Menu.buildFromTemplate(
    buildApplicationMenuTemplate({
      hasLoadedProject: hasLoadedProject(),
      isRenderOperationActive: activeRenderOperationId !== null,
      canAuditionScoreObjects,
      isDarwin: process.platform === 'darwin',
      recentProjects: getRecentProjectFilesSnapshot(),
      canRevertProject: Boolean(getCurrentFilePath()),
      followPlaybackEnabled: currentFollowPlaybackEnabled,
      followPlaybackOnStartEnabled: currentFollowPlaybackOnStartEnabled,
      onNewFile: () => {
        void handleNewFile();
      },
      onOpenFile: () => {
        void handleOpenFile();
      },
      onOpenExampleProject: () => {
        void openExampleProject();
      },
      onImportCsdFile: () => {
        void importCsdFile();
      },
      onImportOrcSco: () => {
        void importOrcSco();
      },
      onImportMidiFile: () => {
        mainWindow?.webContents.send('native-menu-command', { type: 'open-midi-import' });
      },
      onOpenRecentProject: (filePath) => {
        void openRecentProject(filePath);
      },
      onCloseProject: () => {
        void closeProject();
      },
      onRevertProject: () => {
        void revertProject();
      },
      onSaveFile: () => {
        void saveFile();
      },
      onSaveFileAs: () => {
        void saveFileAs();
      },
      onGenerateCsdToScreen: () => {
        void generateCsdToScreen();
      },
      onGenerateRealtimeCsdToScreen: () => {
        void generateRealtimeCsdToScreen();
      },
      onGenerateCsdToDisk: () => {
        void generateCsdToDisk();
      },
      onRequestQuit: () => {
        void requestQuit();
      },
      onOpenSettings: () => {
        if (mainWindow) {
          openSettingsWindow(mainWindow, {
            initialZoomFactor: appZoomController.getCurrentFactor(),
          });
        }
      },
      onOpenAbout: () => {
        openAboutWindow(mainWindow, {
          icon: getAppIcon(),
          initialZoomFactor: appZoomController.getCurrentFactor(),
        });
      },
      onOpenEffectsLibrary: () => {
        if (mainWindow) {
          routeFocusPanel('LibrariesTopComponent');
          mainWindow.webContents.send('native-menu-command', { type: 'open-effects-library' });
        }
      },
      onOpenFTableConverter: () => {
        if (mainWindow) {
          mainWindow.webContents.send('native-menu-command', { type: 'open-ftable-converter' });
        }
      },
      onOpenCsoundRCEditor: () => {
        if (mainWindow) {
          mainWindow.webContents.send('native-menu-command', { type: 'open-csoundrc-editor' });
        }
      },
      onOpenCodeRepositoryEditor: () => {
        mainWindow?.webContents.send('native-menu-command', {
          type: 'open-code-repository-editor',
        });
      },
      onReinitializeJavaScriptRuntime: () => {
        void reinitializeJavaScriptRuntime();
      },
      onReinitializeJythonRuntime: () => {
        void reinitializeJythonRuntime();
      },
      onFocusPanel: (panelId) => {
        // Route through the workbench window registry so an already-floating panel
        // is focused in its own OS window instead of opening a duplicate (SPEC 055 US6).
        routeFocusPanel(panelId);
      },
      onToggleDevTools: () => {
        mainWindow?.webContents.toggleDevTools();
      },
      onResetLayout: () => {
        try {
          // Reset Windows: clear app-wide layout state, persist defaults, and
          // broadcast the reset to every active renderer window so the
          // workbench store immediately returns to defaults.
          resetWindowLayout();
        } catch {
          // Persistence failure must not strand the user; still notify the
          // workbench so the in-memory layout returns to defaults.
        }
        if (mainWindow) {
          mainWindow.webContents.send('native-menu-command', { type: 'reset-windows' });
        }
      },
      onToggleFollowPlayback: () => {
        const next = !currentFollowPlaybackEnabled;
        const result = updatePlaybackPreferences({ followPlayback: next });
        if (result.ok) {
          currentFollowPlaybackEnabled = next;
          currentSavedFollowPlayback = next;
          mainWindow?.webContents.send('native-menu-command', {
            type: 'set-follow-playback',
            enabled: next,
          });
          rebuildApplicationMenu();
        }
      },
      onToggleFollowPlaybackOnStart: () => {
        const next = !currentFollowPlaybackOnStartEnabled;
        const result = updatePlaybackPreferences({ followPlaybackOnStart: next });
        if (result.ok) {
          currentFollowPlaybackOnStartEnabled = next;
          mainWindow?.webContents.send('native-menu-command', {
            type: 'set-follow-playback-on-render-start',
            enabled: next,
          });
          rebuildApplicationMenu();
        }
      },
      onToggleLoopRendering: () => {
        mainWindow?.webContents.send('native-menu-command', { type: 'toggle-loop-rendering' });
      },
      onAddMarker: () => {
        mainWindow?.webContents.send('native-menu-command', { type: 'add-marker' });
      },
      onNavigateNextMarker: () => {
        mainWindow?.webContents.send('native-menu-command', { type: 'navigate-next-marker' });
      },
      onNavigatePreviousMarker: () => {
        mainWindow?.webContents.send('native-menu-command', { type: 'navigate-previous-marker' });
      },
      onRewindToStart: () => {
        mainWindow?.webContents.send('native-menu-command', { type: 'rewind-to-start' });
      },
      onRenderStopProject: () => {
        mainWindow?.webContents.send('native-menu-command', { type: 'render-stop-project' });
      },
      onAuditionScoreObjects: () => {
        mainWindow?.webContents.send('native-menu-command', { type: 'audition-score-objects' });
      },
      onToggleBlueLive: () => {
        void blueLiveToggle();
      },
      onRecompileBlueLive: () => {
        void blueLiveRecompile();
      },
      onBlueLiveAllNotesOff: () => {
        void blueLiveAllNotesOff();
      },
      onEditTempoMap: () => {
        mainWindow?.webContents.send('native-menu-command', { type: 'edit-tempo-map' });
      },
      onEditMeterMap: () => {
        mainWindow?.webContents.send('native-menu-command', { type: 'edit-meter-map' });
      },
      onRenderToDisk: () => {
        void handleRenderToDisk('render');
      },
      onRenderToDiskAndPlay: () => {
        void handleRenderToDisk('play');
      },
      onRenderToDiskAndOpen: () => {
        void handleRenderToDisk('open');
      },
      onZoomIn: () => {
        appZoomController.execute('zoom-in');
        syncAboutWindowZoom();
      },
      onZoomOut: () => {
        appZoomController.execute('zoom-out');
        syncAboutWindowZoom();
      },
      onActualSize: () => {
        appZoomController.execute('actual-size');
        syncAboutWindowZoom();
      },
    }),
  );

  Menu.setApplicationMenu(menu);
}

function getAppIcon(): Electron.NativeImage | undefined {
  const iconFile = (() => {
    if (process.platform === 'darwin') return 'blue.icns';
    if (process.platform === 'win32') return 'blue.ico';
    return 'blueIcon.png';
  })();

  // In dev mode vite-plugin-electron may place __dirname in a temp folder,
  // so we try several candidate roots.
  const candidates = [
    path.join(__dirname, '..', '..', 'assets', iconFile),
    path.join(__dirname, '..', 'assets', iconFile),
    path.join(__dirname, 'assets', iconFile),
    path.join(app.getAppPath(), 'assets', iconFile),
    path.join(process.cwd(), 'assets', iconFile),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return nativeImage.createFromPath(p);
    }
  }

  console.warn(
    `[main] App icon not found. Tried:\n${candidates.map((c) => '  - ' + c).join('\n')}`,
  );
  return undefined;
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#1a1a2e',
    title: getWindowTitle(getCurrentFilePath()),
    icon: getAppIcon(),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: true,
      zoomFactor: appZoomController.getCurrentFactor(),
    },
  });

  // Restore persisted bounds/display state before the window is shown so the
  // user sees their saved workspace immediately on launch.
  restoreWindowState(mainWindow, 'main');
  attachWindowStateHandlers(mainWindow, 'main');
  registerMainWindow(mainWindow);
  trackEditorRuntimeStatusCoordinator = createTrackEditorRuntimeStatusCoordinator({
    isAuthorized: (subscriber, request) => isTrackInstrumentEditorWebContents(subscriber, request),
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });
  mainWindow.webContents.on('did-start-loading', () => {
    midiImportService.clearAll();
  });

  // MIDI Input coordinator (SPEC 058). Main owns permission policy, cached
  // snapshots, and command/status relay; raw Web MIDI stays in the primary
  // renderer. Initialized here so the coordinator's IPC handlers exist before
  // the primary renderer becomes ready.
  midiInputCoordinator = new MidiInputCoordinator({
    getProgramSettings: () => loadProgramSettings(),
    isPrimaryWebContents: (contents) =>
      !!mainWindow && !mainWindow.isDestroyed() && contents.id === mainWindow.webContents.id,
    isApplicationWebContents: (contents) => {
      // Every BrowserWindow in this app loads our preload and serves
      // application content (main workbench, Settings, effect editors,
      // floating popouts). Treat any non-destroyed application window as a
      // legitimate observer so the Settings child renderer can pull cached
      // snapshots and request rescans. Raw `midi` access (the actual Web MIDI
      // transport) stays restricted to the primary webContents above.
      return BrowserWindow.getAllWindows().some(
        (window) =>
          !window.isDestroyed() &&
          !window.webContents.isDestroyed() &&
          window.webContents.id === contents.id,
      );
    },
  });
  midiInputCoordinator.registerIpcHandlers();

  mainWindow.webContents.session.setPermissionCheckHandler(
    (webContents, permission, _requestingOrigin, details) => {
      const isPrimary = !!webContents && webContents.id === mainWindow?.webContents.id;
      const applicationUrl = webContents?.getURL() ?? '';
      const requestingUrl = details.requestingUrl ?? applicationUrl;
      return decideMidiPermission({
        permission,
        isPrimary,
        isTrustedLocation:
          details.isMainFrame && isSameApplicationLocation(requestingUrl, applicationUrl),
      });
    },
  );
  mainWindow.webContents.session.setPermissionRequestHandler(
    (webContents, permission, callback, details) => {
      const isPrimary = webContents.id === mainWindow?.webContents.id;
      callback(
        decideMidiPermission({
          permission,
          isPrimary,
          isTrustedLocation:
            details.isMainFrame &&
            isSameApplicationLocation(details.requestingUrl, webContents.getURL()),
        }),
      );
    },
  );

  // Allow Dockview popout groups (SPEC 055 US1 Float) to open as real,
  // separately focusable OS windows. Dockview calls window.open('popout.html',
  // features) and appends its group DOM on `load`; we let Electron attach a
  // native BrowserWindow (with the app preload) to that call so the popout is a
  // first-class application window sharing the same project session.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const isPopout = /popout\.html([?#]|$)/.test(url);
    if (!isPopout) {
      return { action: 'deny' };
    }
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        backgroundColor: '#1a1a2e',
        preload: path.join(__dirname, '..', 'preload', 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        zoomFactor: appZoomController.getCurrentFactor(),
        show: true,
        title: 'Blue',
      },
    };
  });

  // During development, load from Vite dev server for HMR
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  }

  // Resolve the workspace artifact in development and the installed resource
  // in packaged builds. Neither path consults the system executable search path.
  engineRuntimeService = new EngineRuntimeService({
    isPackaged: app.isPackaged,
    resourcesPath: process.resourcesPath,
    repoRoot: path.resolve(app.getAppPath(), '..', '..'),
    getSettingsEnginePath: () => loadProgramSettings().appSpecific.enginePath,
    getCsoundLibraryPath: () => loadProgramSettings().appSpecific.csoundLibraryPath,
  });

  // Initialize engine bridge
  engineBridge = new EngineBridge(
    mainWindow,
    undefined,
    undefined,
    undefined,
    'realtime',
    engineRuntimeService,
  );
  engineBridge.setPlaybackStateChangeCallback(() => publishTrackEditorRuntimeStatus());
  engineBridge.setPlaybackErrorWarningCallback((message) => {
    void showCsoundErrorWarning(message);
  });

  engineBridge.setPlaybackCompleteCallback((stopReason) => {
    clearActiveBlueX7Bindings();
    if (activeAuditionPlayback) {
      activeAuditionPlayback = false;
      return;
    }
    if (stopReason !== 'completed') return;
    if (!getCurrentData() || !getCurrentData().isLoopRendering()) return;
    void startPlayback();
  });

  let outputBatch: { text: string; type: 'stdout' | 'stderr' }[] = [];
  let outputBatchTimer: ReturnType<typeof setTimeout> | null = null;

  function flushOutputBatch() {
    if (outputBatch.length === 0) return;
    const batch = outputBatch;
    outputBatch = [];
    for (const item of batch) {
      mainWindow?.webContents.send('engine-output', {
        tabName: 'Csound',
        text: item.text,
        type: item.type,
      });
    }
    outputBatchTimer = null;
  }

  engineBridge.setOutputCallback((text, type) => {
    outputBatch.push({ text, type });
    if (!outputBatchTimer) {
      outputBatchTimer = setTimeout(flushOutputBatch, 50);
    }
  });

  // Initialize Blue Live engine session on separate port
  blueLiveSession = new BlueLiveEngineSession(
    mainWindow,
    undefined,
    5560,
    5561,
    engineRuntimeService,
  );
  blueLiveSession.setRuntimeStateChangeCallback(() => publishTrackEditorRuntimeStatus());
  javaRuntimeSessionManager = new JavaRuntimeSessionManager({
    isPackaged: app.isPackaged,
    mainModuleDir: __dirname,
    resourcesPath: process.resourcesPath,
    userDataPath: app.getPath('userData'),
  });
  let blueLiveOutputBatch: { text: string; type: 'stdout' | 'stderr' }[] = [];
  let blueLiveOutputTimer: ReturnType<typeof setTimeout> | null = null;

  function flushBlueLiveOutputBatch() {
    if (blueLiveOutputBatch.length === 0) return;
    const batch = blueLiveOutputBatch;
    blueLiveOutputBatch = [];
    for (const item of batch) {
      mainWindow?.webContents.send('engine-output', {
        tabName: 'Csound (Blue Live)',
        text: item.text,
        type: item.type,
      });
    }
    blueLiveOutputTimer = null;
  }

  blueLiveSession.setOutputCallback((text, type) => {
    blueLiveOutputBatch.push({ text, type });
    if (!blueLiveOutputTimer) {
      blueLiveOutputTimer = setTimeout(flushBlueLiveOutputBatch, 50);
    }
  });

  rebuildApplicationMenu();
  updateWindowTitle();
}

async function confirmLibraryDraftTransition(
  reason: 'quit' | 'closeProject' | 'switchProject',
): Promise<boolean> {
  const preview = unifiedLibraryService?.prepareLibraryDraftShutdown(reason);
  if (!preview || preview.mayContinue) return true;
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  const result = await showNativeConfirmation(mainWindow, {
    id: 'unsaved-library-editors',
    type: 'warning',
    title: 'Unsaved Library Editors',
    message: `${preview.dirtySessionIds.length} Library editor${preview.dirtySessionIds.length === 1 ? ' has' : 's have'} unsaved changes.`,
    detail: 'Save all drafts, discard them, or cancel this operation.',
    actions: [
      { id: 'save', label: 'Save All', role: 'accept' },
      { id: 'discard', label: 'Discard', role: 'destructive' },
      { id: 'cancel', label: 'Cancel', role: 'cancel' },
    ],
    defaultActionId: 'save',
    cancelActionId: 'cancel',
    noLink: true,
  });
  const decision =
    result.actionId === 'save' && result.outcome === 'selected'
      ? 'save'
      : result.actionId === 'discard' && result.outcome === 'selected'
        ? 'discard'
        : 'cancel';
  const resolved = await unifiedLibraryService?.resolveLibraryDraftShutdown(decision);
  return resolved?.mayContinue ?? false;
}

/**
 * Request app exit — shows save prompt if project is dirty.
 */
async function requestQuit(): Promise<void> {
  isQuitting = true;

  if (!(await confirmLibraryDraftTransition('quit'))) {
    isQuitting = false;
    return;
  }

  // Stop engine first
  if (engineBridge && engineBridge.isCurrentlyPlaying()) {
    await engineBridge.stopPlayback();
  }

  if (!getCurrentData()) {
    doQuit();
    return;
  }

  if (!(await confirmSaveBeforeReplace({ quitAfterSave: true }))) {
    isQuitting = false;
    return;
  }
}

/**
 * Actually quit the app — clean up engine and exit.
 */
async function doQuit(): Promise<void> {
  if (shutdownPromise) {
    return shutdownPromise;
  }

  const shutdown = (async () => {
    isQuitting = true;

    await oscControlService?.shutdown();
    oscControlService = null;

    unregisterDomainIpc?.();
    unregisterDomainIpc = null;

    // Settings persistence must survive domain teardown while renderer
    // windows are still alive. Window beforeunload handlers persist the FINAL
    // workbench layout, and a late React effect can still synchronize the
    // recent-files list before final application shutdown closes the renderer.
    // These handlers only touch program settings, so they are safe to keep
    // alive after the engine/service-backed handlers have stopped.
    //
    // Late updates are DROPPED once quitting has begun: closing the popout
    // windows makes dockview redock their groups into the main grid, which
    // fires one last "everything docked" layout — persisting that would
    // clobber the floated state the user quit with and un-restore it on the
    // next launch. The in-session saves already captured the floated layout.
    const layoutUpdateHandler = collectedIpcHandlers.get('window-layout:update');
    const layoutGetHandler = collectedIpcHandlers.get('window-layout:get');
    if (layoutUpdateHandler) {
      electronIpcMain.handle('window-layout:update', (event, request) =>
        isQuitting ? loadWindowLayoutSettings() : layoutUpdateHandler(event, request),
      );
    }
    if (layoutGetHandler) {
      electronIpcMain.handle('window-layout:get', layoutGetHandler);
    }
    for (const channel of ['set-recent-files', 'get-recent-files'] as const) {
      const handler = collectedIpcHandlers.get(channel);
      if (handler) electronIpcMain.handle(channel, handler);
    }

    unregisterUnifiedLibraryIpc?.();
    unregisterUnifiedLibraryIpc = null;
    await unifiedLibraryService?.stop();
    unifiedLibraryService = null;

    unregisterCodeRepositoryIpc?.();
    unregisterCodeRepositoryIpc = null;
    await codeRepositoryService?.stop();
    codeRepositoryService = null;

    await midiInputCoordinator?.requestShutdown();
    midiInputCoordinator?.disposeIpcHandlers();
    midiInputCoordinator = null;

    if (blueLiveSession) {
      try {
        await blueLiveSession.stop();
      } catch {
        // Ignore cleanup errors
      }
    }

    // Gracefully stop engine
    if (engineBridge) {
      try {
        await engineBridge.dispose();
      } catch {
        // Ignore cleanup errors
      }
      engineBridge = null;
    }

    trackEditorRuntimeStatusCoordinator?.dispose();
    trackEditorRuntimeStatusCoordinator = null;

    blueLiveSession = null;
    await javaRuntimeSessionManager?.dispose();
    javaRuntimeSessionManager = null;
    disposeJavaScriptSession();

    closeEffectEditorWindowsForOwner('project');
    closeEffectEditorWindowsForOwner('library');
    closeTrackInstrumentEditorWindows();
    disposeWorkbenchWindowHost();
    projectSession.resetForShutdown();
    canAuditionScoreObjects = false;
    setActiveMissingAudioSession(null);
    rebuildApplicationMenu();
    await cleanupTempCsdSnapshots();

    app.quit();
  })().finally(() => {
    shutdownPromise = null;
  });

  shutdownPromise = shutdown;
  return shutdown;
}

// ─── File Operations ───

async function handleOpenFile(): Promise<void> {
  await openFile();
}

async function handleNewFile(): Promise<void> {
  if (!(await confirmSaveBeforeReplace())) return;
  await newFile();
}

/**
 * Build the project-loaded payload and run the Java-parity missing-audio scan.
 * New projects (no filePath) skip the scan, mirroring Java Blue which only
 * runs checkDependencies for OpenProject/OpenExampleProject actions.
 */
function buildAndSendProjectLoaded(data: BlueData, filePath: string | null): void {
  if (!mainWindow) return;

  const projectProperties = data.getProjectProperties();
  const payload: ProjectLoadedPayload = {
    ...createProjectEditorSnapshot(data, filePath, getCurrentProjectSessionId()),
    title: filePath ? projectProperties.title || path.basename(filePath) : 'Untitled',
    author: projectProperties.author,
    sampleRate: projectProperties.sampleRate,
  };

  const missingSession = scanMissingAudioAssets(data, filePath);
  if (missingSession) {
    payload.missingAudioAssets = missingSession;
  }

  broadcastToWorkbenchWindows('project-loaded', payload);
}

function scanMissingAudioAssets(
  data: BlueData,
  filePath: string | null,
): MissingAudioAssetsSession | undefined {
  if (!filePath) {
    return undefined;
  }

  const projectDirectory = path.dirname(filePath);
  const sfDir = process.env.SFDIR && process.env.SFDIR.length > 0 ? process.env.SFDIR : null;
  const rows = collectMissingAudioFiles(data, { projectDirectory, sfDir });

  if (rows.length === 0) {
    return undefined;
  }

  const session: MissingAudioAssetsSession = {
    sessionId: createMissingAudioSessionId(),
    projectSessionId: getCurrentProjectSessionId(),
    projectFilePath: filePath,
    missingFiles: rows,
  };
  setActiveMissingAudioSession(session);
  return session;
}

const projectLifecycle = createProjectLifecycle({
  session: projectSession,
  stopProjectRuntimes: async () => {
    await stopActiveBlueLiveBeforeProjectReplacement();
    await disposeJavaRuntimeSession();
  },
  closeProjectEditors: async () => {
    closeEffectEditorWindowsForOwner('project');
    closeTrackInstrumentEditorWindows();
    trackEditorRuntimeStatusCoordinator?.resetSubscriptions();
  },
  clearProjectServices: () => {
    midiImportService.clearAll();
    setActiveMissingAudioSession(null);
  },
  publishProjectChanged: () => {
    unifiedLibraryService?.publishProjectChanged();
  },
  publishProjectLoaded: () => {
    rebuildApplicationMenu();
    updateWindowTitle();
  },
  publishProjectClosed: () => {
    rebuildApplicationMenu();
    updateWindowTitle();
    broadcastToWorkbenchWindows('project-closed', null);
  },
});

async function openFile(): Promise<boolean> {
  if (!mainWindow) return false;
  if (!(await canReplaceProjectWhileRenderActive())) return false;

  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Blue Project',
    defaultPath: getConfiguredWorkDirectory(),
    filters: [{ name: 'Blue Project', extensions: ['blue'] }],
    properties: ['openFile'],
  });

  if (result.canceled || result.filePaths.length === 0) return false;

  return openProjectFile(result.filePaths[0]);
}

async function openFilePath(filePath: string): Promise<boolean> {
  if (!mainWindow) return false;
  return openProjectFile(filePath);
}

/**
 * Opens an example through the user-owned example library (spec
 * 091-factory-examples). Packaged examples are immutable factory input: this
 * action lazily creates/updates the per-user copy when needed, shows the
 * picker from Blue-owned content, and routes the selected `.blue` file
 * through the accepted-target replacement flow. Created only on invocation —
 * never at startup (FR-002).
 */
async function openExampleProject(): Promise<boolean> {
  if (!mainWindow) return false;
  const win = mainWindow;

  const factoryResolution = resolveExampleProjectPath({
    isPackaged: app.isPackaged,
    mainModuleDir: __dirname,
    resourcesPath: process.resourcesPath,
  });
  const libraryRoot = path.join(app.getPath('userData'), 'examples');
  const currentContentRoot = path.join(libraryRoot, 'current', 'content');

  const libraryService = createExampleLibraryService({
    libraryRoot,
    manifestProvider: exampleFactoryManifestProvider,
    getFactoryRoot: async () => (factoryResolution.exists ? factoryResolution.examplesPath : null),
  });

  let lastInspection: ExampleLibraryInspection | null = null;

  async function askNativeDecision(
    request: Parameters<typeof showNativeConfirmation>[1],
  ): Promise<string> {
    const result = await showNativeConfirmation(win, request);
    return result.outcome === 'selected' ? result.actionId : 'cancel';
  }

  function showLibraryError(message: string): void {
    dialog.showErrorBox('Examples', message);
  }

  const prepared = await runOpenExampleProjectFlow<BlueData>({
    preflight: () => canReplaceProjectWhileRenderActive(),
    runRecoveryAndInspect: async () => {
      const outcome = await libraryService.inspect();
      if (!outcome.ok) {
        return {
          ok: false as const,
          kind: 'inspection-blocked' as const,
          diagnostic: outcome.message,
        };
      }
      if (
        outcome.value.status === 'invalid-user-library' ||
        outcome.value.status === 'unavailable'
      ) {
        return {
          ok: false as const,
          kind: 'inspection-blocked' as const,
          diagnostic:
            outcome.value.status === 'unavailable'
              ? outcome.value.diagnostic
              : `${outcome.value.diagnostic} Nothing was modified.`,
        };
      }
      lastInspection = outcome.value;
      return { ok: true as const, inspection: outcome.value };
    },
    prepareFirstUseCopy: async () => {
      const inspection = lastInspection;
      if (inspection === null || inspection.status !== 'needs-initialization') {
        return {
          ok: false,
          code: 'conflict',
          message: 'The example library changed while preparing the copy.',
          retryable: true,
        };
      }
      const copy = await libraryService.prepareInitialCopy(inspection.factory);
      if (!copy.ok) {
        return {
          ok: false,
          code: copy.code,
          message: copy.message,
          retryable: copy.retryable,
        };
      }
      return { ok: true, candidate: copy.value };
    },
    prepareUpdateCandidate: async () => {
      const outcome = await libraryService.prepareUpdate();
      if (!outcome.ok) {
        return {
          ok: false,
          code: outcome.code,
          message: outcome.message,
          retryable: outcome.retryable,
        };
      }
      return { ok: true, candidate: outcome.value };
    },
    recordKeepCurrentDecline: async () => {
      const inspection = lastInspection;
      if (inspection === null || inspection.status !== 'update-available') {
        return {
          ok: false,
          message: 'No example update is currently available.',
          retryable: false,
        };
      }
      const outcome = await libraryService.recordDeclinedRevision(
        inspection.current.state,
        inspection.factory.revision,
      );
      return outcome.ok
        ? { ok: true }
        : { ok: false, message: outcome.message, retryable: outcome.retryable };
    },
    commitCandidateOrNull: async (candidate) => {
      if (candidate === null) return { ok: true };
      const committed = await libraryService.commit(candidate);
      return committed.ok
        ? { ok: true }
        : { ok: false, message: committed.message, retryable: committed.retryable };
    },
    discardCandidate: async (candidate) => {
      if (candidate !== null) await libraryService.abort(candidate);
    },

    chooseFirstUseCopy: async () => {
      const decision = await askNativeDecision({
        id: 'open-example-first-use',
        type: 'question',
        title: 'Open Example Project',
        message:
          'Blue examples ship with the application and stay untouched. Create your own writable copy so you can edit and render them?',
        detail: 'Your copy lives in your Blue user data. The packaged examples are never modified.',
        actions: [
          { id: 'copy-and-open', label: 'Copy and Open' },
          { id: 'cancel', label: 'Cancel', role: 'cancel' },
        ],
        defaultActionId: 'copy-and-open',
        cancelActionId: 'cancel',
      });
      return decision === 'copy-and-open';
    },

    chooseForUpdateOffer: async (): Promise<UpdateOfferChoice> => {
      const raw = await askNativeDecision({
        id: 'open-example-update-offer',
        type: 'question',
        title: 'Example Updates Available',
        message: 'The examples bundled with this version of Blue differ from your example library.',
        detail:
          'Update refreshes examples you have not modified. Your edited files, new files, and deletions are always kept.',
        actions: [
          { id: 'update-and-open', label: 'Update and Open' },
          { id: 'keep-current-and-open', label: 'Keep Current and Open', role: 'secondary' },
          { id: 'cancel', label: 'Cancel', role: 'cancel' },
        ],
        defaultActionId: 'update-and-open',
        cancelActionId: 'cancel',
      });
      if (raw === 'update-and-open' || raw === 'keep-current-and-open') {
        return raw;
      }
      return 'cancel';
    },

    chooseContinueDespiteUpdateConflicts: async (report) => {
      const decision = await askNativeDecision({
        id: 'open-example-update-conflicts',
        type: 'warning',
        title: 'Examples Kept As-Is',
        message: 'Some updated examples conflict with your own changes. Your versions are kept.',
        detail: formatExampleConflictDetail(report),
        actions: [
          { id: 'continue', label: 'Continue' },
          { id: 'cancel', label: 'Cancel', role: 'cancel' },
        ],
        defaultActionId: 'continue',
        cancelActionId: 'cancel',
      });
      return decision === 'continue';
    },

    chooseOpenCurrentExamplesWithoutUpdateCheck: async () => {
      const decision = await askNativeDecision({
        id: 'open-example-factory-unavailable',
        type: 'question',
        title: 'Open Example Project',
        message: 'Opening your existing example library without checking for updates.',
        detail: 'The packaged examples on this installation could not be read.',
        actions: [
          { id: 'open-current', label: 'Open Current Examples' },
          { id: 'cancel', label: 'Cancel', role: 'cancel' },
        ],
        defaultActionId: 'open-current',
        cancelActionId: 'cancel',
      });
      return decision === 'open-current';
    },

    // Spec edge case: never modify an open example's file underneath the
    // user. When the active project lives inside the current library, run
    // its existing save/discard/cancel protection before the library swap.
    ensureActiveProjectSafeBeforeLibrarySwap: () => {
      if (!hasLoadedProject()) return true;
      const activeFilePath = getCurrentFilePath();
      if (!activeFilePath) return true;
      const relative = path.relative(currentContentRoot, activeFilePath);
      const activeProjectIsLibraryExample =
        relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
      if (!activeProjectIsLibraryExample) return true;
      return confirmSaveBeforeReplace();
    },

    showProjectPicker: (defaultRoot) =>
      dialog
        .showOpenDialog(win, {
          title: 'Open Example Project',
          defaultPath: defaultRoot,
          filters: [{ name: 'Blue Project', extensions: ['blue'] }],
          properties: ['openFile'],
        })
        .then((result) => (result.canceled ? null : (result.filePaths[0] ?? null))),

    resolvePickerSelection: (selectedPath, offeredRoot) =>
      resolveExampleLibraryPickerSelection(selectedPath, offeredRoot, currentContentRoot),

    loadProjectFromFile: async (filePath) => {
      try {
        const xml = fs.readFileSync(filePath, 'utf8');
        const project = await BlueData.loadFromString(xml);
        return { ok: true, project };
      } catch (err) {
        return {
          ok: false,
          message: err instanceof Error ? err.message : String(err),
        };
      }
    },

    isSameFileAsCurrent: (finalContentPath) =>
      hasLoadedProject() && isCurrentProjectFilePath(finalContentPath),
    confirmLibraryDraftTransition: () => confirmLibraryDraftTransition('switchProject'),
    confirmSaveBeforeReplace: () => confirmSaveBeforeReplace(),
    getCurrentContentRoot: () => currentContentRoot,

    installParsedProject: (project, finalContentPath) =>
      installProjectData(project as BlueData, finalContentPath),

    reportBlockedLibrary: (diagnostic) => {
      showLibraryError(diagnostic);
    },
    reportRejectedSelection: () => {
      showLibraryError(
        'Examples open from your Blue example library. Pick a .blue project from the offered folder. To open a project elsewhere, use Open Project.',
      );
    },
    reportPreparationFailure: async (message, retryable) => {
      if (!retryable) {
        showLibraryError(message);
        return false;
      }
      const decision = await askNativeDecision({
        id: 'open-example-library-failure',
        type: 'error',
        title: 'Example Library Problem',
        message,
        detail: 'You can try again; nothing in your projects or bundled examples was changed.',
        actions: [
          { id: 'retry', label: 'Try Again' },
          { id: 'cancel', label: 'Cancel', role: 'cancel' },
        ],
        defaultActionId: 'retry',
        cancelActionId: 'cancel',
      });
      return decision === 'retry';
    },
    reportProjectLoadFailure: (message) => {
      showLibraryError(`Could not open the selected example:\n${message}`);
    },
    reportPostCommitInstallFailure: (message) => {
      showLibraryError(
        `The example library was updated, but opening the example failed:\n${message}`,
      );
    },
  });

  return prepared.status === 'committed';
}

async function importCsdFile(): Promise<boolean> {
  if (!mainWindow) return false;
  if (!hasLoadedProject()) return false;
  const win = mainWindow;

  let selectedPath: string | null = null;
  try {
    const outcome = await runCsdImportReplacement<BlueData, CSDImportMode>({
      preflight: () => canReplaceProjectWhileRenderActive(),
      showSourceDialog: async () => {
        const result = await dialog.showOpenDialog(win, {
          title: 'Select CSD File',
          defaultPath: getConfiguredWorkDirectory(),
          filters: [{ name: 'CSD File (*.csd)', extensions: ['csd', 'CSD'] }],
          properties: ['openFile'],
        });
        if (!result.canceled && result.filePaths.length > 0) {
          selectedPath = result.filePaths[0];
        }
        return result;
      },
      showModeDialog: async () => {
        const res = await showNativeConfirmation(win, {
          id: 'csd-import-method',
          type: 'question',
          title: 'CSD Import Method',
          message: 'How would you like to import the score?',
          actions: [
            { id: 'global-score', label: 'Global Score' },
            { id: 'single-sound-object', label: 'Single Sound Object' },
            { id: 'sound-object-per-instrument', label: 'Sound Object per Instrument' },
            { id: 'cancel', label: 'Cancel', role: 'cancel' },
          ],
          defaultActionId: 'global-score',
          cancelActionId: 'cancel',
        });
        const actionToIndex: Record<string, number> = {
          'global-score': 0,
          'single-sound-object': 1,
          'sound-object-per-instrument': 2,
          cancel: 3,
        };
        const responseIndex =
          res.outcome === 'selected' && res.actionId in actionToIndex
            ? actionToIndex[res.actionId]
            : 3;
        return { response: responseIndex, checkboxChecked: false };
      },
      cancelModeResponse: 3,
      readSource: (filePath) => fs.readFileSync(filePath, 'utf-8'),
      convert: (csdText, modeType) => convertCSDtoBlue(csdText, modeType),
      confirmLibraryDraft: () => confirmLibraryDraftTransition('switchProject'),
      confirmSave: () => confirmSaveBeforeReplace(),
      commit: (data) => installProjectData(data, null),
    });

    return outcome.status === 'committed';
  } catch (err: unknown) {
    const target = selectedPath ? path.basename(selectedPath) : 'CSD file';
    const message = `Failed to import ${target}:\n${err instanceof Error ? err.message : String(err)}`;
    await dialog.showErrorBox('Error Importing File', message);
    return false;
  }
}

async function importOrcSco(): Promise<boolean> {
  if (!mainWindow) return false;
  if (!hasLoadedProject()) return false;
  const win = mainWindow;

  try {
    const outcome = await runOrcScoImportReplacement<BlueData, CSDImportMode>({
      preflight: () => canReplaceProjectWhileRenderActive(),
      showOrcDialog: () =>
        dialog.showOpenDialog(win, {
          title: 'Select ORC File',
          defaultPath: getConfiguredWorkDirectory(),
          filters: [{ name: 'Csound ORC File (*.orc)', extensions: ['orc', 'ORC'] }],
          properties: ['openFile'],
        }),
      showScoDialog: () =>
        dialog.showOpenDialog(win, {
          title: 'Select SCO File',
          defaultPath: getConfiguredWorkDirectory(),
          filters: [{ name: 'Csound SCO File (*.sco)', extensions: ['sco', 'SCO'] }],
          properties: ['openFile'],
        }),
      showModeDialog: async () => {
        const res = await showNativeConfirmation(win, {
          id: 'csd-import-method',
          type: 'question',
          title: 'CSD Import Method',
          message: 'How would you like to import the score?',
          actions: [
            { id: 'global-score', label: 'Global Score' },
            { id: 'single-sound-object', label: 'Single Sound Object' },
            { id: 'sound-object-per-instrument', label: 'Sound Object per Instrument' },
            { id: 'cancel', label: 'Cancel', role: 'cancel' },
          ],
          defaultActionId: 'global-score',
          cancelActionId: 'cancel',
        });
        const actionToIndex: Record<string, number> = {
          'global-score': 0,
          'single-sound-object': 1,
          'sound-object-per-instrument': 2,
          cancel: 3,
        };
        const responseIndex =
          res.outcome === 'selected' && res.actionId in actionToIndex
            ? actionToIndex[res.actionId]
            : 3;
        return { response: responseIndex, checkboxChecked: false };
      },
      cancelModeResponse: 3,
      readSource: (filePath) => fs.readFileSync(filePath, 'utf-8'),
      convert: (orcText, scoText, modeType) => convertOrcScoToBlue(orcText, scoText, modeType),
      confirmLibraryDraft: () => confirmLibraryDraftTransition('switchProject'),
      confirmSave: () => confirmSaveBeforeReplace(),
      commit: (data) => installProjectData(data, null),
    });

    return outcome.status === 'committed';
  } catch (err: unknown) {
    const message = `Failed to import ORC/SCO:\n${err instanceof Error ? err.message : String(err)}`;
    await dialog.showErrorBox('Error Importing File', message);
    return false;
  }
}

/**
 * Canonical same-file detection for project-file targets: the selected path
 * identifies the current project when it matches canonically (resolve,
 * normalize, platform case rules), not by raw string comparison.
 */
function isCurrentProjectFilePath(filePath: string): boolean {
  return (
    getCurrentData() !== null &&
    getCurrentFilePath() !== null &&
    isSameProjectPathIdentity(filePath, getCurrentFilePath())
  );
}

/**
 * Read and parse a `.blue` file without installing it. Used to prepare a
 * replacement candidate so invalid files fail before any replacement prompt.
 */
async function readProjectFromDisk(filePath: string): Promise<BlueData> {
  const xml = fs.readFileSync(filePath, 'utf-8');
  return BlueData.loadFromString(xml);
}

/**
 * Install a prepared project as the canonical current project: stop runtimes,
 * close project-owned editors, roll the project session, and emit
 * project-loaded. Callers own every decision that leads here.
 */
async function installProjectData(data: BlueData, filePath: string | null): Promise<void> {
  await projectLifecycle.replace({ data, filePath });
  canAuditionScoreObjects = false;
  getBlueLiveTriggerController().openGate();

  disposeJavaScriptSession();
  try {
    javaScriptSession = await createJavaScriptSession();
  } catch (sessionErr: unknown) {
    console.warn('[App] Failed to create JavaScript session for installed project:', sessionErr);
  }

  try {
    await runProjectOnLoad(data);
  } catch (sessionErr: unknown) {
    console.warn('[App] Failed to run processOnLoad for installed project:', sessionErr);
  }

  buildAndSendProjectLoaded(data, filePath);
}

async function reportProjectLoadError(filePath: string, err: unknown): Promise<void> {
  const message = `Failed to load ${path.basename(filePath)}:\n${err instanceof Error ? err.message : String(err)}`;
  if (process.env.BLUE_VERIFY_MODE === 'packaged-project') {
    process.stderr.write(`[FAIL] ${message}\n`);
  } else {
    await dialog.showErrorBox('Error Loading File', message);
  }
}

/**
 * Accepted-target replacement for a project file: read and parse the source
 * before any replacement decision, treat the current project canonically as
 * a no-op, re-check render safety, resolve save and library decisions, then
 * install through the shared lifecycle. Errors use the existing load error
 * dialog and leave the current project unchanged.
 */
async function openProjectFile(filePath: string): Promise<boolean> {
  try {
    const outcome = await runProjectFileReplacement<BlueData>({
      selectFile: () => filePath,
      readFile: (sourcePath) => fs.readFileSync(sourcePath, 'utf-8'),
      parseProject: (xml) => BlueData.loadFromString(xml),
      isSameFile: isCurrentProjectFilePath,
      preflight: () => canReplaceProjectWhileRenderActive(),
      confirmLibraryDraft: () => confirmLibraryDraftTransition('switchProject'),
      confirmSave: () => confirmSaveBeforeReplace(),
      commit: (data, sourcePath) => installProjectData(data, sourcePath),
    });
    return outcome.status === 'committed';
  } catch (err: unknown) {
    await reportProjectLoadError(filePath, err);
    return false;
  }
}

/**
 * Reads, parses, and installs a project from disk without replacement
 * decisions. Revert and packaged verification intentionally use this
 * non-interactive path; user-driven opens go through {@link openProjectFile}.
 */
async function loadProjectFromDisk(filePath: string): Promise<boolean> {
  return runNonInteractiveProjectLoad<BlueData>({
    filePath,
    preflight: () => canReplaceProjectWhileRenderActive(),
    readProject: readProjectFromDisk,
    installProject: installProjectData,
    reportError: reportProjectLoadError,
  });
}

async function runPackagedProjectVerificationAndExit(): Promise<never> {
  const projectPath = process.env.BLUE_VERIFY_PROJECT_PATH
    ? path.resolve(process.env.BLUE_VERIFY_PROJECT_PATH)
    : null;
  const projectSavePath = process.env.BLUE_VERIFY_SAVE_PATH
    ? path.resolve(process.env.BLUE_VERIFY_SAVE_PATH)
    : null;
  const result = await verifyPackagedProject({
    isPackaged: app.isPackaged,
    projectPath,
    projectSavePath,
    loadProject: loadProjectFromDisk,
    getLoadedProject: () =>
      getCurrentData()
        ? {
            filePath: getCurrentFilePath(),
            title: getCurrentData().getProjectProperties().title,
          }
        : null,
    saveProjectCopy: async (savePath) => {
      if (!getCurrentData()) return false;
      try {
        fs.writeFileSync(savePath, getCurrentData().saveToString(), 'utf8');
        await BlueData.loadFromString(fs.readFileSync(savePath, 'utf8'));
        return true;
      } catch {
        return false;
      }
    },
  });

  process.stderr.write(`${result.ok ? '[ok]' : '[FAIL]'} ${result.message}\n`);
  process.stderr.write(`\nPackaged project verification ${result.ok ? 'passed' : 'failed'}.\n`);
  process.exit(result.ok ? 0 : 1);
}

async function runPackagedEngineMismatchVerificationAndExit(): Promise<never> {
  const projectPath = process.env.BLUE_VERIFY_PROJECT_PATH
    ? path.resolve(process.env.BLUE_VERIFY_PROJECT_PATH)
    : null;
  const fixturePath = process.env.BLUE_VERIFY_ENGINE_REPORT_FIXTURE
    ? path.resolve(process.env.BLUE_VERIFY_ENGINE_REPORT_FIXTURE)
    : null;
  if (!projectPath || !fixturePath || !(await loadProjectFromDisk(projectPath))) {
    process.stderr.write(
      '[FAIL] Packaged mismatch verification could not open its project or fixture.\n',
    );
    process.exit(1);
  }
  const executableName = process.platform === 'win32' ? 'blue-engine.exe' : 'blue-engine';
  const bundledEnginePath = path.join(process.resourcesPath, 'assets', 'engine', executableName);
  const fixtureReport = fs.readFileSync(fixturePath, 'utf8');
  const runtime = new EngineRuntimeService({
    isPackaged: true,
    resourcesPath: process.resourcesPath,
    repoRoot: '',
    getSettingsEnginePath: () => 'blue-engine',
    runProbeProcess: async () => ({
      exitCode: 0,
      stdout: fixtureReport,
      stderr: '',
      timedOut: false,
    }),
  });
  const result = await runtime.probe({ enginePathOverride: bundledEnginePath }, { retry: true });
  const passed =
    result.errorCode === 'ENGINE_PROTOCOL_MISMATCH' &&
    result.selection?.source === 'settings-override' &&
    getCurrentData() !== null &&
    getCurrentFilePath() === projectPath;
  process.stderr.write(
    `${passed ? '[ok]' : '[FAIL]'} Incompatible engine was ` +
      `${passed ? 'rejected before playback while the project remained open' : 'not rejected safely'}.\n`,
  );
  if (passed) {
    process.stderr.write('Packaged engine mismatch verification passed.\n');
  }
  process.exit(passed ? 0 : 1);
}

async function newFile(): Promise<void> {
  if (!mainWindow) return;
  if (!(await canReplaceProjectWhileRenderActive())) return;
  if (!(await confirmLibraryDraftTransition('switchProject'))) return;

  const data = new BlueData();
  const settings = loadProgramSettings();
  applyProgramSettingsToNewProject(data, settings);
  await installProjectData(data, null);
}

async function closeProject(): Promise<void> {
  if (!mainWindow) return;

  if (!(await confirmSaveBeforeReplace())) return;
  if (!(await confirmLibraryDraftTransition('closeProject'))) return;

  // Stop any non-idle Blue Live session before clearing the canonical project.
  disposeJavaScriptSession();
  await projectLifecycle.close();
  canAuditionScoreObjects = false;
}

async function revertProject(): Promise<void> {
  if (!getCurrentFilePath()) return;
  const filePath = getCurrentFilePath();
  if (!(await confirmSaveBeforeReplace())) return;
  if (!(await confirmLibraryDraftTransition('switchProject'))) return;
  await loadProjectFromDisk(filePath);
}

async function openRecentProject(filePath: string): Promise<void> {
  if (!mainWindow) return;
  await openFilePath(filePath);
}

async function saveFile(): Promise<void> {
  if (!getCurrentData() || !getCurrentFilePath()) {
    await saveFileAs();
    return;
  }
  doSave(getCurrentFilePath());
}

async function saveFileAs(): Promise<boolean> {
  if (!mainWindow || !getCurrentData()) return false;

  const previousProjectDir = getCurrentFilePath() ? path.dirname(getCurrentFilePath()) : null;

  const saved = await runTransactionalSaveAs({
    chooseDestination: async () => {
      const result = await dialog.showSaveDialog(mainWindow!, {
        title: 'Save Blue Project',
        defaultPath: getCurrentFilePath() ?? getConfiguredWorkDirectoryDefaultPath('project.blue'),
        filters: [{ name: 'Blue Project', extensions: ['blue'] }],
      });
      if (result.canceled || !result.filePath) return null;
      return result.filePath;
    },
    writeProject: (filePath) => writeProjectToDisk(filePath),
    publishPath: (filePath) => {
      projectSession.publishPath(filePath);
    },
  });

  if (!saved) return false;

  updateWindowTitle();
  rebuildApplicationMenu();
  mainWindow?.webContents.send('save-complete', { filePath: getCurrentFilePath() });

  const nextProjectDir = getCurrentFilePath() ? path.dirname(getCurrentFilePath()) : null;
  if (previousProjectDir !== nextProjectDir) {
    await disposeJavaRuntimeSession();
  }

  if (pendingQuit) {
    pendingQuit = false;
    doQuit();
  }

  return true;
}

function normalizeBsbSelectedPath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  if (!getCurrentFilePath()) {
    return normalized;
  }

  const projectDir = path.dirname(getCurrentFilePath());
  const relativePath = path.relative(projectDir, filePath);
  if (!relativePath || path.isAbsolute(relativePath) || relativePath.startsWith('..')) {
    return normalized;
  }

  return relativePath.replace(/\\/g, '/');
}

function resolveBsbDefaultPath(currentValue?: string): string | undefined {
  if (!currentValue || currentValue.trim().length === 0) {
    return getCurrentFilePath()
      ? path.dirname(getCurrentFilePath())
      : getConfiguredWorkDirectoryDefaultPath();
  }

  if (path.isAbsolute(currentValue)) {
    return currentValue;
  }

  if (!getCurrentFilePath()) {
    return getConfiguredWorkDirectoryDefaultPath(currentValue);
  }

  return path.resolve(path.dirname(getCurrentFilePath()), currentValue);
}

function resolveAudioFilePathForRead(filePath: string): string | null {
  const trimmed = filePath.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('file://')) {
    try {
      return decodeURIComponent(new URL(trimmed).pathname);
    } catch {
      return decodeURIComponent(trimmed.slice('file://'.length));
    }
  }

  if (path.isAbsolute(trimmed) || !getCurrentFilePath()) {
    return trimmed;
  }

  return path.resolve(path.dirname(getCurrentFilePath()), trimmed);
}

async function openBsbFileSelector(currentValue?: string): Promise<string | null> {
  if (!mainWindow) return null;

  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select File',
    properties: ['openFile'],
    defaultPath: resolveBsbDefaultPath(currentValue),
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return normalizeBsbSelectedPath(result.filePaths[0]);
}

async function normalizeBsbFileSelectorPath(filePath: string): Promise<string | null> {
  if (!filePath || filePath.trim().length === 0) {
    return null;
  }

  return normalizeBsbSelectedPath(filePath);
}

async function copyBsbFileSelectorToMediaFolder(currentValue?: string): Promise<string | null> {
  if (
    !getCurrentData() ||
    !getCurrentFilePath() ||
    !currentValue ||
    currentValue.trim().length === 0
  ) {
    return null;
  }

  const projectDir = path.dirname(getCurrentFilePath());
  const sourceFile = path.isAbsolute(currentValue)
    ? currentValue
    : path.resolve(projectDir, currentValue);

  if (!fs.existsSync(sourceFile) || !fs.statSync(sourceFile).isFile()) {
    return null;
  }

  const mediaFolder = getCurrentData().getProjectProperties().mediaFolder?.trim() ?? '';
  const targetDir = path.isAbsolute(mediaFolder)
    ? mediaFolder
    : path.resolve(projectDir, mediaFolder.length > 0 ? mediaFolder : 'media');
  fs.mkdirSync(targetDir, { recursive: true });

  const targetFile = path.join(targetDir, path.basename(sourceFile));
  if (path.resolve(targetFile) !== path.resolve(sourceFile)) {
    fs.copyFileSync(sourceFile, targetFile);
  }

  return normalizeBsbSelectedPath(targetFile);
}

/**
 * Durable write of the current project. Returns false (and reports the
 * save error) when the write fails; callers must treat false as a blocked
 * replacement rather than discard consent.
 */
function writeProjectToDisk(filePath: string): boolean {
  if (!getCurrentData()) return false;
  try {
    const xml = getCurrentData().saveToString();
    fs.writeFileSync(filePath, xml, 'utf-8');
    return true;
  } catch (err: unknown) {
    if (mainWindow) {
      mainWindow.webContents.send('save-error', err instanceof Error ? err.message : String(err));
    }
    // If save failed during quit, still quit
    if (pendingQuit) {
      pendingQuit = false;
      doQuit();
    }
    return false;
  }
}

function doSave(filePath: string): boolean {
  if (!getCurrentData()) return false;
  if (!writeProjectToDisk(filePath)) return false;

  updateWindowTitle();
  rebuildApplicationMenu();
  if (mainWindow) {
    mainWindow.webContents.send('save-complete', { filePath });
  }
  // If we were waiting to quit after save, do it now
  if (pendingQuit) {
    pendingQuit = false;
    doQuit();
  }
  return true;
}

function notifyNoProjectLoaded(channel: 'playback-error' | 'generated-csd-error'): void {
  mainWindow?.webContents.send(channel, 'No project loaded');
}

async function ensureJavaScriptEngine(): Promise<void> {
  if (!javaScriptRuntimeReady) {
    javaScriptRuntimeReady = initializeJavaScriptRuntime().catch((err: unknown) => {
      javaScriptRuntimeReady = null;
      throw err;
    });
  }

  await javaScriptRuntimeReady;
}

async function createJavaScriptSession(): Promise<JavaScriptSession> {
  await ensureJavaScriptEngine();
  return new JavaScriptSession();
}

function disposeJavaScriptSession(): void {
  if (javaScriptSession) {
    javaScriptSession.dispose();
    javaScriptSession = null;
  }
  lastProjectOnLoadState = null;
}

const REPL_CONSOLE_PROMPTS: Record<ReplConsoleLanguage, string> = {
  javascript: 'js> ',
  python: '>>> ',
  clojure: 'user=> ',
};

// Interactive JVM evaluations can legitimately spend longer than the short
// transport deadline used by score-object/runtime requests, especially while
// a project dependency or a user expression is being compiled.
const REPL_CONSOLE_EVALUATION_TIMEOUT_MS = 30_000;

function getReplProjectLabel(data: BlueData | null, filePath: string | null): string {
  if (data) {
    const title = data.getProjectProperties().title?.trim();
    if (title) return title;
  }

  return filePath ? path.basename(filePath) : data ? 'Untitled' : 'No Project';
}

function createReplProjectContext(): ReplConsoleProjectContext {
  return {
    loaded: getCurrentData() !== null,
    sessionId: getCurrentProjectSessionId(),
    label: getReplProjectLabel(getCurrentData(), getCurrentFilePath()),
    filePath: getCurrentFilePath(),
    projectDir: getCurrentFilePath() ? path.dirname(getCurrentFilePath()) : null,
  };
}

function createReplProjectDataSnapshot(): Record<string, unknown> | null {
  if (!getCurrentData()) return null;

  const properties = getCurrentData().getProjectProperties();
  const globalOrcSco = getCurrentData().getGlobalOrcSco();
  return {
    sessionId: getCurrentProjectSessionId(),
    filePath: getCurrentFilePath(),
    projectDir: getCurrentFilePath() ? path.dirname(getCurrentFilePath()) : null,
    projectProperties: {
      title: properties.title,
      author: properties.author,
      notes: properties.notes,
      sampleRate: properties.sampleRate,
      ksmps: properties.ksmps,
      nchnls: properties.nchnls,
      useZeroDbFS: properties.useZeroDbFS,
      zeroDbFS: properties.zeroDbFS,
      diskSampleRate: properties.diskSampleRate,
      diskKsmps: properties.diskKsmps,
    },
    globalOrc: globalOrcSco.getGlobalOrc(),
    globalSco: globalOrcSco.getGlobalSco(),
    tablesText: getCurrentData().getTableSet().getTables(),
    scratchPad: {
      text: getCurrentData().getScratchPadData().getScratchText(),
      wordWrapEnabled: getCurrentData().getScratchPadData().isWordWrapEnabled(),
    },
  };
}

function createReplRuntimeContext(): {
  project: ReplConsoleProjectContext;
  projectDir: string;
  data: Record<string, unknown> | null;
} {
  const project = createReplProjectContext();
  return {
    project,
    projectDir: project.projectDir ? `${project.projectDir}${path.sep}` : '',
    data: createReplProjectDataSnapshot(),
  };
}

function createReplOpenResult(
  language: ReplConsoleLanguage,
  runtime: ReplConsoleOpenResult['runtime'],
  error?: string,
): ReplConsoleOpenResult {
  return {
    ok: runtime === 'ready',
    language,
    prompt: REPL_CONSOLE_PROMPTS[language],
    project: createReplProjectContext(),
    runtime,
    ...(error ? { error } : {}),
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function ensureJavaScriptConsoleSession(): Promise<JavaScriptSession> {
  if (!javaScriptSession) {
    javaScriptSession = await createJavaScriptSession();
  }
  return javaScriptSession;
}

async function reinitializeJavaScriptRuntimeNow(): Promise<void> {
  const session = await ensureJavaScriptConsoleSession();
  session.reinitialize();
}

async function reinitializeJavaScriptRuntime(): Promise<ScriptRuntimeReinitializeResult> {
  return enqueueReplRuntime(async () => {
    try {
      await reinitializeJavaScriptRuntimeNow();
      if (getCurrentData()) {
        lastProjectOnLoadState = null;
        await runProjectOnLoad(getCurrentData());
      }
      return { ok: true };
    } catch (error: unknown) {
      return { ok: false, error: getErrorMessage(error) };
    }
  });
}

async function reinitializeJythonRuntimeNow(): Promise<void> {
  if (!getCurrentData()) {
    throw new Error('No project loaded.');
  }
  if (!getCurrentData().usesJavaRuntime()) {
    throw new Error('Active project does not use the Java runtime.');
  }
  if (!javaRuntimeSessionManager) {
    throw new Error('Java runtime manager is unavailable.');
  }

  await javaRuntimeSessionManager.reinitializeJython(
    getCurrentData(),
    getCurrentProjectSessionId(),
    getCurrentFilePath(),
  );
}

async function reinitializeJythonRuntime(): Promise<ScriptRuntimeReinitializeResult> {
  return enqueueReplRuntime(async () => {
    try {
      await reinitializeJythonRuntimeNow();
      if (getCurrentData()) {
        lastProjectOnLoadState = null;
        await runProjectOnLoad(getCurrentData());
      }
      return { ok: true };
    } catch (error: unknown) {
      return { ok: false, error: getErrorMessage(error) };
    }
  });
}

async function ensureJavaRuntimeConsoleSession(): Promise<JavaRuntimeClient> {
  if (!getCurrentData()) {
    throw new Error('No project loaded.');
  }
  if (!javaRuntimeSessionManager) {
    throw new Error('Java runtime is unavailable.');
  }

  return javaRuntimeSessionManager.ensureReady(
    getCurrentData(),
    getCurrentProjectSessionId(),
    getCurrentFilePath(),
  );
}

async function openReplConsoleNow(language: ReplConsoleLanguage): Promise<ReplConsoleOpenResult> {
  try {
    if (language === 'javascript') {
      await ensureJavaScriptConsoleSession();
    } else {
      await ensureJavaRuntimeConsoleSession();
    }
    return createReplOpenResult(language, 'ready');
  } catch (error: unknown) {
    return createReplOpenResult(
      language,
      getCurrentData() ? 'error' : 'unavailable',
      getErrorMessage(error),
    );
  }
}

function enqueueReplRuntime<T>(operation: () => Promise<T>): Promise<T> {
  const next = replRuntimeQueue.then(operation, operation);
  replRuntimeQueue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

function openReplConsole(language: ReplConsoleLanguage): Promise<ReplConsoleOpenResult> {
  return enqueueReplRuntime(() => openReplConsoleNow(language));
}

function createReplEvaluationFailure(
  language: ReplConsoleLanguage,
  message: string,
  projectSessionId = getCurrentProjectSessionId(),
): ReplConsoleEvaluateResult {
  return {
    ok: false,
    language,
    projectSessionId,
    value: '',
    stdout: '',
    stderr: '',
    elapsedMs: 0,
    error: { message },
  };
}

async function evaluateReplConsoleNow(
  language: ReplConsoleLanguage,
  code: string,
): Promise<ReplConsoleEvaluateResult> {
  const runtimeContext = createReplRuntimeContext();
  if (language === 'javascript') {
    const session = await ensureJavaScriptConsoleSession();
    return evaluateJavaScriptConsole(
      session,
      { code, projectSessionId: runtimeContext.project.sessionId },
      {
        projectDir: runtimeContext.projectDir,
        data: runtimeContext.data,
        project: runtimeContext.project,
      },
    );
  }

  if (!runtimeContext.project.loaded) {
    return createReplEvaluationFailure(
      language,
      'No project loaded.',
      runtimeContext.project.sessionId,
    );
  }

  const startedAt = Date.now();
  const client = await ensureJavaRuntimeConsoleSession();
  const bindings = {
    blueData: runtimeContext.data,
    blueProjectDir: runtimeContext.projectDir,
    blueProject: runtimeContext.project,
  };
  const response =
    language === 'python'
      ? await client.evaluateJythonScript(
          { code, bindings },
          { timeout: REPL_CONSOLE_EVALUATION_TIMEOUT_MS },
        )
      : await client.evaluateClojure(
          { code, bindings, returnVariableName: null },
          { timeout: REPL_CONSOLE_EVALUATION_TIMEOUT_MS },
        );

  if (response.ok) {
    return {
      ok: true,
      language,
      projectSessionId: runtimeContext.project.sessionId,
      value: response.result.value,
      stdout: response.stdout,
      stderr: response.stderr,
      elapsedMs: response.elapsedMs ?? Date.now() - startedAt,
    };
  }

  return {
    ok: false,
    language,
    projectSessionId: runtimeContext.project.sessionId,
    value: '',
    stdout: response.stdout,
    stderr: response.stderr,
    elapsedMs: response.elapsedMs ?? Date.now() - startedAt,
    error: {
      code: response.error.code,
      message: response.error.message,
      ...(response.error.stack ? { stack: response.error.stack } : {}),
      ...(response.error.line !== undefined ? { line: response.error.line } : {}),
      ...(response.error.column !== undefined ? { column: response.error.column } : {}),
    },
  };
}

async function evaluateReplConsole(
  request: ReplConsoleEvaluateRequest,
): Promise<ReplConsoleEvaluateResult> {
  if (!isReplConsoleLanguage(request?.language)) {
    return createReplEvaluationFailure('javascript', 'Invalid console language.');
  }
  if (typeof request.code !== 'string' || request.code.trim().length === 0) {
    return createReplEvaluationFailure(request.language, 'Enter code before evaluating.');
  }

  try {
    return await enqueueReplRuntime(() => evaluateReplConsoleNow(request.language, request.code));
  } catch (error: unknown) {
    return createReplEvaluationFailure(request.language, getErrorMessage(error));
  }
}

async function reinitializeReplConsole(
  request: ReplConsoleReinitializeRequest,
): Promise<ReplConsoleReinitializeResult> {
  if (!isReplConsoleLanguage(request?.language)) {
    return {
      ...createReplOpenResult('javascript', 'error', 'Invalid console language.'),
      message: 'Invalid console language.',
    };
  }

  return enqueueReplRuntime(async () => {
    try {
      if (request.language === 'javascript') {
        await reinitializeJavaScriptRuntimeNow();
      } else if (request.language === 'python') {
        await reinitializeJythonRuntimeNow();
      } else {
        if (!javaRuntimeSessionManager || !getCurrentData())
          throw new Error('Java runtime is unavailable.');
        await javaRuntimeSessionManager.reinitializeClojure(
          getCurrentData(),
          getCurrentProjectSessionId(),
          getCurrentFilePath(),
        );
      }

      if (getCurrentData()) {
        lastProjectOnLoadState = null;
        await runProjectOnLoad(getCurrentData());
      }

      return {
        ...createReplOpenResult(request.language, 'ready'),
        message: `${request.language} interpreter reinitialized.`,
      };
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      return {
        ...createReplOpenResult(
          request.language,
          getCurrentData() ? 'error' : 'unavailable',
          message,
        ),
        message,
      };
    }
  });
}

async function disposeJavaRuntimeSession(): Promise<void> {
  lastProjectOnLoadState = null;
  if (javaRuntimeSessionManager) {
    await javaRuntimeSessionManager.dispose();
  }
}

function clojureProjectPatchChangesRuntimeDependencies(
  data: BlueData,
  patch: ClojureProjectSnapshot,
): boolean {
  const currentEntries = data.getClojureProjectData()?.getLibraryEntries() ?? [];
  if (currentEntries.length !== patch.libraryEntries.length) {
    return true;
  }

  return patch.libraryEntries.some((entry, index) => {
    const current = currentEntries[index];
    return (
      current?.getDependencyCoordinates() !== entry.dependencyCoordinates ||
      current?.getVersion() !== entry.version
    );
  });
}

async function ensureJavaRuntimeSession(data: BlueData | null): Promise<JavaRuntimeClient | null> {
  if (!data || !javaRuntimeSessionManager || !data.usesJavaRuntime()) {
    return null;
  }

  return javaRuntimeSessionManager.ensureReady(
    data,
    getCurrentProjectSessionId(),
    getCurrentFilePath(),
  );
}

function getProjectOnLoadState(
  data: BlueData,
  javaRuntimeClient: JavaRuntimeClient | null,
): ProjectOnLoadState {
  const jythonStateRevision =
    data.usesJavaRuntime() && javaRuntimeClient && javaRuntimeSessionManager
      ? javaRuntimeSessionManager.getJythonStateRevision()
      : null;

  return {
    projectSessionId: getCurrentProjectSessionId(),
    javaScriptSession,
    jythonStateRevision,
  };
}

function projectOnLoadStateMatches(
  current: ProjectOnLoadState | null,
  next: ProjectOnLoadState,
): boolean {
  return (
    current !== null &&
    current.projectSessionId === next.projectSessionId &&
    current.javaScriptSession === next.javaScriptSession &&
    current.jythonStateRevision === next.jythonStateRevision
  );
}

async function runProjectOnLoad(data: BlueData, force = false): Promise<JavaRuntimeClient | null> {
  const javaRuntimeClient = await ensureJavaRuntimeSession(data);
  const nextState = getProjectOnLoadState(data, javaRuntimeClient);

  if (force || !projectOnLoadStateMatches(lastProjectOnLoadState, nextState)) {
    await data.processOnLoadAsync(javaScriptSession ?? undefined, javaRuntimeClient ?? undefined);
    if (!force) lastProjectOnLoadState = nextState;
  }

  return javaRuntimeClient;
}

// ─── Playback ───

async function togglePlay(): Promise<boolean> {
  if (!engineBridge) return false;
  if (!getCurrentData()) {
    notifyNoProjectLoaded('playback-error');
    return false;
  }

  if (playbackStartPromise) {
    return playbackStartPromise;
  }

  if (engineBridge.isCurrentlyPlaying()) {
    await stopPlayback();
    return false;
  }

  playbackStartPromise = startPlayback().finally(() => {
    playbackStartPromise = null;
  });

  return playbackStartPromise;
}

/**
 * Starts a fresh regular render. Unlike the toolbar toggle, this is never a
 * request to leave playback stopped and therefore matches Java OSC
 * `/score/play` semantics.
 */
async function restartPlayback(): Promise<boolean> {
  if (!engineBridge) return false;
  if (!getCurrentData()) {
    notifyNoProjectLoaded('playback-error');
    return false;
  }

  if (playbackStartPromise) {
    await playbackStartPromise;
  }
  if (engineBridge.isCurrentlyPlaying()) {
    await stopPlayback();
  }

  playbackStartPromise = startPlayback().finally(() => {
    playbackStartPromise = null;
  });
  return playbackStartPromise;
}

async function startPlayback(
  data: BlueData | null = getCurrentData(),
  forceProcessOnLoad = false,
): Promise<boolean> {
  if (!engineBridge || !data || !mainWindow) return false;
  const canonicalDataAtStart = getCurrentData();
  const projectSessionAtStart = getCurrentProjectSessionId();
  activeAuditionPlayback = data !== getCurrentData();

  try {
    broadcastToWorkbenchWindows('playback-status', {
      status: 'starting',
      message: 'Preparing playback...',
      renderStartTime: data.getRenderStartTime(),
      auditioning: data !== getCurrentData(),
    });

    mainWindow.webContents.send('engine-output-reset', { tabName: 'Csound' });
    mainWindow.webContents.send('engine-output-select', { tabName: 'Csound' });

    await ensureJavaScriptEngine();

    const javaRuntimeClient = await runProjectOnLoad(data, forceProcessOnLoad);
    const render = javaRuntimeClient
      ? await data.toRealtimePlaybackCSDAsync(javaScriptSession ?? undefined, javaRuntimeClient)
      : data.toRealtimePlaybackCSD(javaScriptSession ?? undefined);
    const csd = render.csdText;
    const parameters = render.parameters;
    // Spec 092: keep this render's compiled BlueX7 bindings for live sync;
    // they are disposable and replaced at the next playback start.
    setActiveBlueX7Bindings(render.blueX7Bindings);
    const runtimeParameterSync = syncCompiledRuntimeParameterNames(
      data.getArrangement(),
      data.getMixer(),
      parameters,
      data.getScore(),
    );
    if (runtimeParameterSync.liveCount !== runtimeParameterSync.compiledCount) {
      console.warn(
        '[main] Runtime parameter sync count mismatch:',
        runtimeParameterSync.liveCount,
        runtimeParameterSync.compiledCount,
      );
    }

    const automationTiming = buildAutomationRuntimeTimingContext(data);

    const projectDirectory = getCurrentProjectDirectory();
    const extraRealtimeOptions = buildRealtimeEngineOptions(data, projectDirectory);

    // Project replacement/close may complete while CSD generation or runtime
    // setup is awaiting. Never submit an old canonical session or its audition
    // copy to the engine after that fence has advanced.
    if (
      getCurrentProjectSessionId() !== projectSessionAtStart ||
      getCurrentData() !== canonicalDataAtStart ||
      (data !== getCurrentData() && !activeAuditionPlayback)
    ) {
      activeAuditionPlayback = false;
      return false;
    }

    const playAttempt = async (): Promise<boolean> => {
      const result = await engineBridge!.playCSD(
        csd,
        parameters,
        automationTiming,
        projectDirectory,
        extraRealtimeOptions,
      );
      if (!result.ok) {
        // Invalid orchestra/score is a project-source error. The engine has
        // already reported it in the Csound output and cleaned up, so do not
        // present the engine recovery flow for an expected compile failure.
        if (result.failureKind === 'project') return false;
        throw new EngineRecoveryError(
          result.errorMessage || 'Engine playback initialization failed',
          result.failureCategory || 'unexpected',
        );
      }
      return true;
    };

    const recoveryResult = await engineRecoveryCoordinator.runWithRecovery(
      'realtime',
      playAttempt,
      async () => {
        await engineBridge?.killAndWait();
        // FR-017: recovery cleanup also removes obsolete records and
        // terminates only provably orphaned managed engines (dead owner plus
        // verified process identity); live-owner sessions are never touched.
        await sweepStaleBlueEngineProcesses();
      },
    );

    if (!recoveryResult.ok) {
      activeAuditionPlayback = false;
      broadcastToWorkbenchWindows('playback-status', {
        status: 'error',
        message: recoveryResult.errorMessage || 'Failed to start playback',
      });

      if (mainWindow && !mainWindow.isDestroyed()) {
        void presentEngineRecoveryFailure(
          'realtime',
          recoveryResult.errorMessage || 'Failed to start playback',
          recoveryResult.diagnostics,
        );
      }
      return false;
    }

    if (!recoveryResult.result) {
      activeAuditionPlayback = false;
      return false;
    }

    return true;
  } catch (err: unknown) {
    activeAuditionPlayback = false;
    broadcastToWorkbenchWindows('playback-error', err instanceof Error ? err.message : String(err));
    return false;
  }
}

/**
 * Builds the FR-018 diagnostic text: the failed operation, the sanitized
 * failure detail, and the structured lifecycle report (session kind, owner,
 * communication readiness, actions performed, outcome) recorded by the
 * engine bridge for the failed session.
 */
function collectEngineDiagnostics(
  kind: EngineRecoverySessionKind,
  base: string | undefined,
): string {
  const sections: string[] = [
    `Failed operation: start ${kind === 'blue-live' ? 'Blue Live' : 'realtime playback'}`,
  ];
  if (base && base.trim()) {
    sections.push(base.trim());
  }
  const lifecycleReport =
    kind === 'blue-live'
      ? blueLiveSession?.getLastDiagnosticReport()
      : engineBridge?.getLastDiagnosticReport();
  if (lifecycleReport) {
    sections.push(lifecycleReport);
  }
  return sections.join('\n\n');
}

/**
 * FR-017 restart: clean up current-owner sessions, remove obsolete records,
 * terminate only provably orphaned managed engines, then make one fresh
 * attempt at the requested engine activity.
 */
async function restartEngineActivityAfterRecovery(kind: EngineRecoverySessionKind): Promise<void> {
  try {
    if (kind === 'blue-live') {
      await blueLiveSession?.stop();
    } else {
      await engineBridge?.killAndWait();
    }
    await sweepStaleBlueEngineProcesses();
  } catch (error: unknown) {
    console.warn(
      `[EngineRecovery] pre-restart cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (kind === 'blue-live') {
    await blueLiveToggle();
  } else {
    await restartPlayback();
  }
}

async function presentEngineRecoveryFailure(
  kind: EngineRecoverySessionKind,
  errorMessage: string,
  baseDiagnostics: string | undefined,
): Promise<void> {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  await showEngineRecoveryFailureDialog(
    mainWindow,
    errorMessage,
    collectEngineDiagnostics(kind, baseDiagnostics),
    {
      onRestart: () => restartEngineActivityAfterRecovery(kind),
    },
  );
}

async function auditionScoreObjects(objectIds: unknown): Promise<boolean> {
  const data = getCurrentData();
  const projectSessionAtStart = getCurrentProjectSessionId();
  if (!data || !engineBridge || !mainWindow || activeRenderOperationId) return false;
  if (
    !Array.isArray(objectIds) ||
    objectIds.length === 0 ||
    objectIds.some((id) => typeof id !== 'string')
  ) {
    setAuditionScoreObjectAvailability(false);
    return false;
  }

  const selected = resolveTimelineScoreObjects(data, objectIds);
  if (!selected) {
    setAuditionScoreObjectAvailability(false);
    return false;
  }

  try {
    if (playbackStartPromise) await playbackStartPromise;
    if (getCurrentData() !== data || getCurrentProjectSessionId() !== projectSessionAtStart)
      return false;

    return await auditionSelectedScoreObjects(data, selected, {
      isRenderOperationActive: activeRenderOperationId !== null,
      isRealtimePlaying: () => engineBridge?.isCurrentlyPlaying() ?? false,
      stopRealtime: stopPlayback,
      startRealtime: async (auditionData) => {
        playbackStartPromise = startPlayback(auditionData, true).finally(() => {
          playbackStartPromise = null;
        });
        return playbackStartPromise;
      },
    });
  } catch (err: unknown) {
    activeAuditionPlayback = false;
    broadcastToWorkbenchWindows('playback-error', err instanceof Error ? err.message : String(err));
    return false;
  }
}

async function stopPlayback(): Promise<void> {
  activeAuditionPlayback = false;
  if (!engineBridge) return;
  await engineBridge.stopPlayback();
}

async function blueLiveToggle(): Promise<
  | ReturnType<BlueLiveEngineSession['start'] | BlueLiveEngineSession['stop']>
  | { status: string; running: boolean; sessionId: number; message?: string }
> {
  if (!blueLiveSession || !getCurrentData()) {
    return { status: 'idle', running: false, sessionId: 0, message: 'No project loaded' };
  }

  if (blueLiveSession.isRunning()) {
    const stopped = await blueLiveSession.stop();
    if (!engineBridge?.isCurrentlyPlaying()) clearActiveBlueX7Bindings();
    return stopped;
  }

  // Start/recompile is a runtime lifecycle change, not a project edit: do not
  // advance the document revision. The Blue Live engine session generation
  // (sessionId) is the independent runtime fence key.
  mainWindow?.webContents.send('engine-output-reset', { tabName: 'Csound (Blue Live)' });
  mainWindow?.webContents.send('engine-output-select', { tabName: 'Csound (Blue Live)' });

  const liveProjectData = getCurrentData();
  let startSnapshot: BlueLiveStatusSnapshot | null = null;
  const liveStart = async (): Promise<boolean> => {
    startSnapshot = await blueLiveSession!.start(
      liveProjectData,
      getCurrentProjectRevision(),
      getCurrentProjectDirectory(),
      javaScriptSession ?? undefined,
    );
    if (startSnapshot.status === 'error') {
      const message = startSnapshot.message || 'Blue Live engine start failed';
      throw new EngineRecoveryError(message, classifyEngineFailure(message));
    }
    return true;
  };

  const liveRecovery = await engineRecoveryCoordinator.runWithRecovery(
    'blue-live',
    liveStart,
    async () => {
      await blueLiveSession?.stop();
      await sweepStaleBlueEngineProcesses();
    },
  );

  if (!liveRecovery.ok) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      void presentEngineRecoveryFailure(
        'blue-live',
        liveRecovery.errorMessage || 'Failed to start Blue Live',
        liveRecovery.diagnostics,
      );
    }
    if (!startSnapshot) {
      return {
        status: 'error',
        running: false,
        sessionId: 0,
        message: liveRecovery.errorMessage || 'Failed to start Blue Live',
      };
    }
  }

  if (blueLiveSession.isRunning()) setActiveBlueX7Bindings(blueLiveSession.getBlueX7Bindings());
  return startSnapshot!;
}

async function blueLiveRecompile(): Promise<void> {
  if (!blueLiveSession || !getCurrentData()) return;
  // Start/recompile is a runtime lifecycle change, not a project edit: do not
  // advance the document revision.
  mainWindow?.webContents.send('engine-output-reset', { tabName: 'Csound (Blue Live)' });
  mainWindow?.webContents.send('engine-output-select', { tabName: 'Csound (Blue Live)' });
  await blueLiveSession.recompile(
    getCurrentData(),
    getCurrentProjectRevision(),
    getCurrentProjectDirectory(),
    javaScriptSession ?? undefined,
  );
  if (blueLiveSession.isRunning()) setActiveBlueX7Bindings(blueLiveSession.getBlueX7Bindings());
}

async function blueLiveAllNotesOff(): Promise<void> {
  if (!blueLiveSession) return;
  await blueLiveSession.sendAllNotesOff();
}

/**
 * Stop any non-idle Blue Live session (starting/running/stopping) before a
 * project replacement (close/new/open/revert). A session still starting can
 * retain the old BlueData reference and complete after replacement, so the
 * full active lifecycle must be awaited — not just `isRunning()`.
 */
async function stopActiveBlueLiveBeforeProjectReplacement(): Promise<void> {
  await stopBlueLiveForProjectReplacement(getBlueLiveTriggerController(), blueLiveSession);
}

async function generateCsdToScreen(): Promise<void> {
  if (!mainWindow) return;
  if (!getCurrentData()) {
    notifyNoProjectLoaded('generated-csd-error');
    return;
  }
  try {
    await ensureJavaScriptEngine();
    const javaRuntimeClient = await runProjectOnLoad(getCurrentData());
    // "Generate CSD to Screen" mirrors Java's GenerateCsdToScreenAction, which
    // generates a disk-profile CSD (isRealTime=false).
    const csdText = await generateDiskCsdForScreen(
      getCurrentData(),
      javaScriptSession ?? undefined,
      javaRuntimeClient,
    );
    mainWindow.webContents.send('generated-csd', csdText);
  } catch (err) {
    mainWindow?.webContents.send(
      'generated-csd-error',
      err instanceof Error ? err.message : String(err),
    );
  }
}

async function generateRealtimeCsdToScreen(): Promise<void> {
  if (!mainWindow) return;
  if (!getCurrentData()) {
    notifyNoProjectLoaded('generated-csd-error');
    return;
  }
  try {
    await ensureJavaScriptEngine();
    const javaRuntimeClient = await runProjectOnLoad(getCurrentData());
    // "Generate Realtime CSD to Screen" mirrors Java's
    // GenerateRealtimeCsdToScreenAction, which generates a realtime-profile
    // CSD (isRealTime=true).
    const csdText = await generateRealtimeCsdForScreen(
      getCurrentData(),
      javaScriptSession ?? undefined,
      javaRuntimeClient,
    );
    mainWindow.webContents.send('generated-csd', csdText);
  } catch (err) {
    mainWindow?.webContents.send(
      'generated-csd-error',
      err instanceof Error ? err.message : String(err),
    );
  }
}

async function generateCsdToDisk(): Promise<void> {
  if (!mainWindow) return;
  if (!getCurrentData()) {
    notifyNoProjectLoaded('generated-csd-error');
    return;
  }
  try {
    await ensureJavaScriptEngine();
    const javaRuntimeClient = await runProjectOnLoad(getCurrentData());
    await saveGeneratedCsdToDisk({
      currentData: getCurrentData(),
      currentFilePath: getCurrentFilePath(),
      workDirectory: getConfiguredWorkDirectory(),
      mainWindow,
      session: javaScriptSession ?? undefined,
      runtimeClient: javaRuntimeClient ?? undefined,
    });
  } catch (err) {
    mainWindow?.webContents.send(
      'generated-csd-error',
      err instanceof Error ? err.message : String(err),
    );
  }
}

// ─── IPC Handlers ───

async function chooseMissingAudioReplacement(
  request: MissingAudioAssetsChooseRequest,
): Promise<string | null> {
  if (!mainWindow) return null;
  const session = getActiveMissingAudioSession();
  if (!session || session.sessionId !== request.sessionId) {
    return null;
  }

  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose Replacement File',
    defaultPath: request.currentReplacementPath || getConfiguredWorkDirectoryDefaultPath(),
    properties: ['openFile'],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0]!;
}

async function resolveMissingAudioAssets(
  request: MissingAudioAssetsResolveRequest,
): Promise<MissingAudioAssetsResolveResult> {
  const session = getActiveMissingAudioSession();

  if (
    !session ||
    session.sessionId !== request.sessionId ||
    session.projectSessionId !== getCurrentProjectSessionId() ||
    !getCurrentData()
  ) {
    return { ok: false, changed: false, stale: true };
  }

  if (!request.replacements || request.replacements.length === 0) {
    clearMissingAudioSession(session.sessionId);
    return { ok: true, changed: false };
  }

  const projectDirectory = getCurrentFilePath() ? path.dirname(getCurrentFilePath()) : null;
  const allowedOriginalPaths = new Set(session.missingFiles.map((row) => row.originalPath));
  const mappings = buildReplacementMappings(
    request.replacements,
    projectDirectory,
    allowedOriginalPaths,
  );

  if (mappings.size === 0) {
    clearMissingAudioSession(session.sessionId);
    return { ok: true, changed: false };
  }

  const changed = applyReplacementMappings(getCurrentData(), mappings);
  clearMissingAudioSession(session.sessionId);

  if (!changed) {
    return { ok: true, changed: false };
  }

  projectSession.recordMutation({ changed: true });
  const project = createProjectEditorSnapshot(
    getCurrentData(),
    getCurrentFilePath(),
    getCurrentProjectSessionId(),
  );
  return { ok: true, changed: true, project };
}

ipcRegistration.handle('open-file', async () => {
  const loaded = await openFile();
  return loaded ? getCurrentFilePath() : null;
});

ipcRegistration.handle('start-midi-import', async (): Promise<MidiImportStartResult> => {
  if (!mainWindow || !hasLoadedProject()) {
    return { status: 'error', message: 'No project is loaded.' };
  }
  if (!(await canReplaceProjectWhileRenderActive())) {
    return { status: 'cancelled' };
  }
  return midiImportService.start();
});

ipcRegistration.handle('cancel-midi-import', (_event, token: string): void => {
  midiImportService.clear(token);
});

ipcRegistration.handle(
  'commit-midi-import',
  async (_event, token: string, settings: unknown): Promise<MidiImportCommitResult> => {
    const validation = midiImportService.validateCommit(token, settings);
    if (!validation.ok) {
      return { status: 'error', message: validation.message };
    }

    try {
      const outcome = await runMidiImportReplacement<BlueData>({
        preflight: () => canReplaceProjectWhileRenderActive(),
        prepare: async () => {
          const { data, warnings } = buildMidiImportProject(
            validation.pending.document,
            validation.settings,
            {
              layerGroupType: normalizeDefaultLayerGroupType(
                loadProgramSettings().projectDefaults.defaultLayerGroupType,
              ),
            },
          );
          if (warnings.length > 0) {
            console.warn(`[MIDI import] ${warnings.length} note-pairing warning(s)`);
          }
          return data;
        },
        confirmLibraryDraft: () => confirmLibraryDraftTransition('switchProject'),
        confirmSave: () => confirmSaveBeforeReplace(),
        revalidate: () => {
          const currentValidation = midiImportService.validateCommit(token, settings);
          if (!currentValidation.ok) {
            throw new Error(currentValidation.message);
          }
        },
        commit: async (data) => {
          await installProjectData(data, null);
        },
      });

      if (outcome.status !== 'committed') {
        return { status: 'cancelled' };
      }

      const project = getCurrentProjectDocument();
      if (!project) {
        return {
          status: 'error',
          message: 'MIDI project was installed but could not be read back.',
        };
      }
      return { status: 'installed', project };
    } catch (error) {
      return {
        status: 'error',
        message: `Failed to import MIDI file: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
);

ipcRegistration.handle('open-file-path', async (_event, filePath: string) => {
  const loaded = await openFilePath(filePath);
  return loaded ? getCurrentFilePath() : null;
});

ipcRegistration.handle('new-file', async () => {
  await handleNewFile();
  return getCurrentFilePath();
});

ipcRegistration.handle(
  'missing-audio-assets:choose-replacement',
  async (_event, request: MissingAudioAssetsChooseRequest) => {
    return chooseMissingAudioReplacement(request);
  },
);

ipcRegistration.handle(
  'missing-audio-assets:resolve',
  async (_event, request: MissingAudioAssetsResolveRequest) => {
    return resolveMissingAudioAssets(request);
  },
);

ipcRegistration.handle(
  'missing-audio-assets:dismiss',
  async (_event, request: { sessionId: string }) => {
    clearMissingAudioSession(request.sessionId);
    return { ok: true };
  },
);

ipcRegistration.handle('open-bsb-file-selector', async (_event, currentValue?: string) => {
  return openBsbFileSelector(currentValue);
});

ipcRegistration.handle('set-bsb-file-selector-path', async (_event, filePath: string) => {
  return normalizeBsbFileSelectorPath(filePath);
});

ipcRegistration.handle(
  'copy-bsb-file-selector-to-media-folder',
  async (_event, currentValue?: string) => {
    return copyBsbFileSelectorToMediaFolder(currentValue);
  },
);

ipcRegistration.handle('save-file', async () => {
  await saveFile();
  return getCurrentFilePath();
});

ipcRegistration.handle('save-file-as', async () => {
  await saveFileAs();
  return getCurrentFilePath();
});

ipcRegistration.handle('toggle-play', async () => {
  return togglePlay();
});

ipcRegistration.handle('restart-playback', async () => {
  return restartPlayback();
});

ipcRegistration.handle('stop-playback', async () => {
  await stopPlayback();
});

ipcRegistration.handle('audition-score-objects', async (_event, objectIds: unknown) => {
  return auditionScoreObjects(objectIds);
});

ipcRegistration.on('sync-audition-score-object-availability', (event, enabled: unknown) => {
  if (event.sender !== mainWindow?.webContents) return;
  setAuditionScoreObjectAvailability(enabled === true);
});

ipcRegistration.on('sync-follow-playback-state', (event, enabled: boolean) => {
  if (event.sender !== mainWindow?.webContents) return;
  if (currentFollowPlaybackEnabled !== enabled) {
    currentFollowPlaybackEnabled = enabled;
    rebuildApplicationMenu();
  }
});

ipcRegistration.handle('generate-csd-to-screen', async () => {
  await generateCsdToScreen();
});

ipcRegistration.handle('generate-realtime-csd-to-screen', async () => {
  await generateRealtimeCsdToScreen();
});

ipcRegistration.handle('generate-csd-to-disk', async () => {
  await generateCsdToDisk();
});

ipcRegistration.handle('get-project-info', () => {
  if (!getCurrentData()) return null;
  return {
    title: getCurrentData().getProjectProperties().title,
    author: getCurrentData().getProjectProperties().author,
    sampleRate: getCurrentData().getProjectProperties().sampleRate,
    ksmps: getCurrentData().getProjectProperties().ksmps,
    nchnls: getCurrentData().getProjectProperties().nchnls,
    version: getCurrentData().getVersion(),
  };
});

ipcRegistration.handle(SOUND_FONT_FILE_SELECT_CHANNEL, async (): Promise<string | null> => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose SoundFont File',
    defaultPath: getConfiguredWorkDirectory(),
    properties: ['openFile'],
    filters: [
      { name: 'SoundFont Files', extensions: ['sf2'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  return result.canceled || result.filePaths.length === 0 ? null : (result.filePaths[0] ?? null);
});

ipcRegistration.handle(SOUND_FONT_INSPECT_CHANNEL, async (_event, filePath: unknown) => {
  if (typeof filePath !== 'string' || filePath.trim().length === 0) {
    throw new Error('SoundFont file path is required.');
  }

  const seam = createCsoundExecutionSeam(undefined, undefined, {
    trackRenderProcess: false,
  });
  return inspectSoundFont(filePath, seam, app.getPath('temp'));
});

ipcRegistration.handle('set-recent-files', (_event, files: string[]) => {
  if (!Array.isArray(files)) {
    return getRecentProjectFilesSnapshot();
  }

  syncRecentProjectFiles(files.filter((filePath) => typeof filePath === 'string'));
  return getRecentProjectFilesSnapshot();
});

ipcRegistration.handle('get-recent-files', () => {
  return getRecentProjectFilesSnapshot();
});

ipcRegistration.handle('import-blue-udo', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    defaultPath: getConfiguredWorkDirectory(),
    filters: [{ name: 'Blue UDO File', extensions: ['blueUDO'] }],
    properties: ['openFile'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const xml = await fs.promises.readFile(result.filePaths[0], 'utf-8');
  return xml;
});

ipcRegistration.handle('import-arrangement-instrument', async (): Promise<string | null> => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Import Instrument',
    defaultPath: getConfiguredWorkDirectory(),
    filters: [{ name: 'blue Instrument File', extensions: ['binstr'] }],
    properties: ['openFile'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return fs.promises.readFile(result.filePaths[0]!, 'utf-8');
});

ipcRegistration.handle('import-csound-udo', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    defaultPath: getConfiguredWorkDirectory(),
    filters: [{ name: 'Csound File', extensions: ['udo', 'orc', 'csd'] }],
    properties: ['openFile'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const text = await fs.promises.readFile(result.filePaths[0], 'utf-8');
  return text;
});

ipcRegistration.handle('import-preset-file', async (): Promise<string | null> => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Import Presets',
    defaultPath: getConfiguredWorkDirectory(),
    filters: [{ name: 'Preset file', extensions: ['preset'] }],
    properties: ['openFile'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return fs.promises.readFile(result.filePaths[0], 'utf-8');
});

ipcRegistration.handle(BLUE_X7_IMPORT_SYSEX_CHANNEL, async (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  return selectBlueX7SysexFile(window, mainWindow);
});

ipcRegistration.handle('import-score-object', async (): Promise<ScoreObjectImportResult | null> => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    defaultPath: getConfiguredWorkDirectory(),
    filters: [{ name: 'Blue Sound Object File', extensions: ['blueObject', 'xml'] }],
    properties: ['openFile'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const xml = await fs.promises.readFile(result.filePaths[0], 'utf-8');
  const data = getCurrentData();
  if (!data) return { ok: false, error: 'No project is loaded.' };
  const score = data.getScore();
  return prepareScoreObjectImport(
    xml,
    score.getTimeContext(),
    String(score.getTimeState().getTimeDisplay()),
  );
});

ipcRegistration.handle('read-csoundrc', () => {
  const csoundRcEnv = process.env.CSOUNDRC;
  const filePath = csoundRcEnv || path.join(app.getPath('home'), '.csound7rc');
  let content = '';
  try {
    if (fs.existsSync(filePath)) {
      content = fs.readFileSync(filePath, 'utf-8');
    }
  } catch {
    // Ignore read failure
  }
  return { filePath, content };
});

ipcRegistration.handle('write-csoundrc', (_event, text: string) => {
  const csoundRcEnv = process.env.CSOUNDRC;
  const filePath = csoundRcEnv || path.join(app.getPath('home'), '.csound7rc');
  fs.writeFileSync(filePath, text ?? '', 'utf-8');
  return { success: true, filePath };
});

ipcRegistration.handle('export-blue-udo', async (_event, xmlText: string) => {
  if (!mainWindow) return;
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: getConfiguredWorkDirectory(),
    filters: [{ name: 'Blue UDO File', extensions: ['blueUDO'] }],
  });
  if (result.canceled || !result.filePath) return;
  let filePath = result.filePath;
  if (!filePath.endsWith('.blueUDO')) filePath += '.blueUDO';
  await fs.promises.writeFile(filePath, xmlText, 'utf-8');
});

ipcRegistration.handle(
  'export-arrangement-instrument',
  async (_event, assignmentId: unknown): Promise<void> => {
    if (!mainWindow || !getCurrentData() || typeof assignmentId !== 'string') return;
    const instrument = getCurrentData().getArrangement().getInstrumentById(assignmentId);
    if (!instrument) return;
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Instrument',
      defaultPath: getConfiguredWorkDirectoryDefaultPath('default.binstr'),
      filters: [{ name: 'blue Instrument File', extensions: ['binstr'] }],
      properties: ['showOverwriteConfirmation'],
    });
    if (result.canceled || !result.filePath) return;
    let filePath = result.filePath;
    if (!filePath.toLowerCase().endsWith('.binstr')) filePath += '.binstr';
    await fs.promises.writeFile(filePath, instrument.saveAsXML().toXml(), 'utf-8');
  },
);

ipcRegistration.handle('export-csound-udo', async (_event, codeText: string, udoName: string) => {
  if (!mainWindow) return;
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: getConfiguredWorkDirectoryDefaultPath(`${udoName}.udo`),
    filters: [{ name: 'Csound UDO File', extensions: ['udo', 'inc'] }],
  });
  if (result.canceled || !result.filePath) return;
  await fs.promises.writeFile(result.filePath, codeText, 'utf-8');
});

ipcRegistration.handle(
  'export-preset-file',
  async (_event, xmlText: string, presetName: string) => {
    if (!mainWindow || typeof xmlText !== 'string') return;
    const safeName =
      typeof presetName === 'string'
        ? presetName.trim().replace(/[\\/:*?"<>|]/g, '_') || 'presets'
        : 'presets';
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Presets',
      defaultPath: getConfiguredWorkDirectoryDefaultPath(`${safeName}.preset`),
      filters: [{ name: 'Preset file', extensions: ['preset'] }],
      properties: ['showOverwriteConfirmation'],
    });
    if (result.canceled || !result.filePath) return;
    let filePath = result.filePath;
    if (!filePath.toLowerCase().endsWith('.preset')) filePath += '.preset';
    await fs.promises.writeFile(filePath, xmlText, 'utf-8');
  },
);

ipcRegistration.handle(
  'export-score-object',
  async (_event, xmlText: string, objectName: string): Promise<ScoreObjectExportResult> => {
    if (!mainWindow) return { status: 'error', error: 'The main window is not available.' };
    if (typeof xmlText !== 'string' || xmlText.trim().length === 0) {
      return { status: 'error', error: 'The selected Sound Object has no XML to export.' };
    }
    const validation = validateScoreObjectExport(xmlText);
    if (!validation.ok) return { status: 'error', error: validation.error };

    const safeName =
      typeof objectName === 'string'
        ? objectName.trim().replace(/[\\/:*?"<>|]/g, '_') || 'SoundObject'
        : 'SoundObject';
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: getConfiguredWorkDirectoryDefaultPath(`${safeName}.xml`),
      filters: [{ name: 'Blue SoundObject XML', extensions: ['xml'] }],
    });
    if (result.canceled || !result.filePath) return { status: 'cancelled' };
    await fs.promises.writeFile(result.filePath, xmlText, 'utf-8');
    return { status: 'saved' };
  },
);

// ─── Blue Live IPC Handlers ───

ipcRegistration.handle('blue-live:toggle', async () => {
  return blueLiveToggle();
});

ipcRegistration.handle('blue-live:stop', async () => {
  if (!blueLiveSession) {
    return { status: 'idle', running: false, sessionId: 0 };
  }
  return blueLiveSession.stop();
});

ipcRegistration.handle('blue-live:recompile', async () => {
  if (!blueLiveSession || !getCurrentData()) {
    return { status: 'idle', running: false, sessionId: 0, message: 'No project loaded' };
  }
  // Recompile is a runtime lifecycle change, not a project edit.
  mainWindow?.webContents.send('engine-output-reset', { tabName: 'Csound (Blue Live)' });
  mainWindow?.webContents.send('engine-output-select', { tabName: 'Csound (Blue Live)' });
  return blueLiveSession.recompile(
    getCurrentData(),
    getCurrentProjectRevision(),
    getCurrentProjectDirectory(),
    javaScriptSession ?? undefined,
  );
});

ipcRegistration.handle('blue-live:all-notes-off', async () => {
  if (!blueLiveSession) {
    return { ok: false, message: 'Blue Live not initialized' };
  }
  return blueLiveSession.sendAllNotesOff();
});

ipcRegistration.handle(
  'blue-live:trigger-note',
  async (_event, request: BlueLiveNoteTriggerRequest): Promise<BlueLiveNoteTriggerResult> => {
    if (!blueLiveSession || !getCurrentData()) {
      return { ok: false, message: 'No project loaded' };
    }

    return blueLiveSession.triggerNote(request);
  },
);

ipcRegistration.handle(
  'blue-live:trigger-objects',
  async (_event, request: LegacyBlueLiveTriggerRequest): Promise<LegacyBlueLiveTriggerResult> => {
    const controller = getBlueLiveTriggerController();
    return controller.trigger(request);
  },
);

ipcRegistration.handle('blue-live:get-status', async () => {
  if (!blueLiveSession) {
    return { status: 'idle', running: false, sessionId: 0 };
  }
  return blueLiveSession.getStatus();
});

// ─── Confirmation and Settings IPC Handlers ───

ipcRegistration.handle(
  NATIVE_CONFIRMATION_CHANNEL,
  async (event, request: unknown): Promise<NativeConfirmationResult> => {
    const owner = BrowserWindow.fromWebContents(event.sender);
    return showNativeConfirmation(owner, request);
  },
);

ipcRegistration.handle(
  SETTINGS_CONFIRM_CLOSE_CHANNEL,
  async (event): Promise<SettingsClosePromptResponse> => {
    const owner = BrowserWindow.fromWebContents(event.sender);
    const result = await showNativeConfirmation(owner, {
      id: 'settings-confirm-close',
      type: 'question',
      title: 'Unsaved Settings',
      message: 'You have unsaved settings.',
      detail: 'Do you want to apply them before closing Settings?',
      actions: [
        { id: 'yes', label: 'Yes', role: 'accept' },
        { id: 'no', label: 'No', role: 'destructive' },
        { id: 'cancel', label: 'Cancel', role: 'cancel' },
      ],
      defaultActionId: 'yes',
      cancelActionId: 'cancel',
      noLink: true,
    });
    if (result.outcome !== 'selected') return 'cancel';
    return result.actionId === 'yes' ? 'yes' : result.actionId === 'no' ? 'no' : 'cancel';
  },
);

ipcRegistration.on(SETTINGS_CLOSE_RESPONSE_CHANNEL, (_event, resolution: unknown) => {
  if (resolution === 'allow' || resolution === 'cancel') {
    resolveSettingsWindowClose(resolution as SettingsCloseResolution);
  }
});

ipcRegistration.handle('settings:open', async () => {
  if (!mainWindow) return;
  openSettingsWindow(mainWindow, {
    initialZoomFactor: appZoomController.getCurrentFactor(),
  });
});

ipcRegistration.handle(APP_METADATA_GET_CHANNEL, () =>
  resolveAppMetadata({
    appVersion: app.getVersion(),
    appPath: app.getAppPath(),
    resourcesPath: process.resourcesPath,
    isPackaged: app.isPackaged,
    releaseChannel: process.env.BLUE_RELEASE_CHANNEL,
    processVersions: {
      electron: process.versions.electron,
      chromium: process.versions.chrome,
      node: process.versions.node,
    },
  }),
);

ipcRegistration.handle(ABOUT_WINDOW_CLOSE_CHANNEL, (event) => closeAboutWindow(event.sender));

// ─── Program Settings IPC Handlers ───

/**
 * Refresh the native follow menu cache from an authoritative settings
 * snapshot (Settings-window save or playback-panel reset) and broadcast
 * explicit resolved follow values to the workbench renderer when either
 * follow field changed.
 */
function syncFollowPreferencesFromSnapshot(snapshot: ProgramSettingsSnapshot): void {
  // The active menu mirror can be false during a session-only suspension, so
  // compare full-settings saves against the durable preference separately.
  const followChanged = snapshot.playback.followPlayback !== currentSavedFollowPlayback;
  const onStartChanged =
    snapshot.playback.followPlaybackOnStart !== currentFollowPlaybackOnStartEnabled;
  currentSavedFollowPlayback = snapshot.playback.followPlayback;
  currentFollowPlaybackOnStartEnabled = snapshot.playback.followPlaybackOnStart;
  if (followChanged) {
    currentFollowPlaybackEnabled = snapshot.playback.followPlayback;
    mainWindow?.webContents.send('native-menu-command', {
      type: 'set-follow-playback',
      enabled: currentFollowPlaybackEnabled,
    });
  }
  if (onStartChanged) {
    mainWindow?.webContents.send('native-menu-command', {
      type: 'set-follow-playback-on-render-start',
      enabled: currentFollowPlaybackOnStartEnabled,
    });
  }
  if (followChanged || onStartChanged) {
    rebuildApplicationMenu();
  }
}

ipcRegistration.handle('program-settings:get', () => {
  return loadProgramSettings();
});

ipcRegistration.handle('program-settings:save', (_event, snapshot: ProgramSettingsSnapshot) => {
  const previousOscPort = loadProgramSettings().osc.preferredPort;
  // SPEC 061: prevent a stale full-Settings renderer draft from reverting a
  // later main-owned View-menu zoom change. The Settings renderer does not
  // expose app zoom, so the controller's current value always wins.
  const preserved = appZoomController.preserveCurrentZoom(snapshot);
  const result = saveProgramSettings(preserved);
  if (result.ok) {
    engineRuntimeService?.invalidate();
  }
  if (result.ok && result.snapshot && midiInputCoordinator) {
    midiInputCoordinator.onProgramSettingsSaved(result.snapshot);
  }
  if (
    result.ok &&
    result.snapshot &&
    oscControlService &&
    previousOscPort !== result.snapshot.osc.preferredPort
  ) {
    void oscControlService.restart(result.snapshot.osc);
  }
  // Refresh follow menu cache and broadcast explicit state when follow
  // fields changed via the full Settings window save.
  if (result.ok && result.snapshot) {
    syncFollowPreferencesFromSnapshot(result.snapshot);
  }
  return result;
});

ipcRegistration.handle(
  'engine-runtime:probe',
  async (_event, request?: EngineProbeRequest): Promise<EngineProbeResult> => {
    if (!engineRuntimeService) {
      return {
        ok: false,
        selection: null,
        report: null,
        errorCode: 'ENGINE_NOT_FOUND',
        message: 'Blue Engine runtime service is not initialized',
        durationMs: 0,
      };
    }
    return engineRuntimeService.probe(request, { retry: true });
  },
);

ipcRegistration.handle(
  'engine-runtime:query-csound-io',
  async (_event, request?: CsoundIoQueryRequest): Promise<CsoundIoQueryResult> => {
    if (!engineRuntimeService) {
      return {
        ok: false,
        selection: null,
        report: null,
        errorCode: 'ENGINE_NOT_FOUND',
        message: 'Blue Engine runtime service is not initialized',
        durationMs: 0,
      };
    }
    return engineRuntimeService.queryCsoundIo(request, { retry: true });
  },
);

ipcRegistration.handle('program-settings:reset-panel', (_event, panel: string) => {
  const snapshot = resetPanel(panel as any);
  if (panel === 'midi' && midiInputCoordinator) {
    midiInputCoordinator.onProgramSettingsSaved(snapshot);
  }
  if (panel === 'osc' && oscControlService) {
    void oscControlService.restart(snapshot.osc);
  }
  if (panel === 'playback') {
    syncFollowPreferencesFromSnapshot(snapshot);
  }
  return snapshot;
});

ipcRegistration.handle(OSC_CONTROL_GET_SNAPSHOT_CHANNEL, () => {
  return (
    oscControlService?.getSnapshot() ??
    createInitialOscServerRuntimeSnapshot(loadProgramSettings().osc)
  );
});

ipcRegistration.handle('program-settings:usage-matrix', () => {
  return buildUsageMatrix();
});

ipcRegistration.handle('program-settings:sync-legacy-renderer-settings', (_event, legacy: any) => {
  return syncLegacyRendererSettings(legacy);
});

ipcRegistration.handle('program-settings:update-playback-preferences', (_event, patch: unknown) => {
  const result = updatePlaybackPreferences(patch as any);
  if (result.ok && result.snapshot) {
    // Refresh main menu cache from the updated settings
    currentFollowPlaybackEnabled = result.snapshot.playback.followPlayback;
    currentSavedFollowPlayback = result.snapshot.playback.followPlayback;
    currentFollowPlaybackOnStartEnabled = result.snapshot.playback.followPlaybackOnStart;
    rebuildApplicationMenu();
  }
  return result;
});

// ─── File Manager IPC Handlers (SPEC 076) ───

ipcRegistration.handle(FILE_MANAGER_GET_ROOTS_CHANNEL, () => {
  const settings = loadProgramSettings();
  return getFileManagerRoots({
    loadFavoritePaths: () => settings.appSpecific.fileManagerFavorites,
    loadRootLabels: () => settings.appSpecific.fileManagerRootLabels,
  });
});

ipcRegistration.handle(FILE_MANAGER_LIST_DIRECTORY_CHANNEL, (_event, request: { path: string }) => {
  return listFileManagerDirectory(request);
});

ipcRegistration.handle(
  FILE_MANAGER_VALIDATE_DIRECTORY_CHANNEL,
  (_event, request: { path: string }) => {
    return validateFileManagerDirectory(request);
  },
);

ipcRegistration.handle(
  COMMIT_AUDIO_FILE_DROP_CHANNEL,
  (_event, request: CommitAudioFileDropRequest) => {
    return commitAudioFileDrop(request, {
      getCurrentProject: () =>
        getCurrentData()
          ? {
              sessionId: getCurrentProjectSessionId(),
              revision: getCurrentProjectRevision(),
              projectDirectory: getCurrentProjectDirectory(),
              copyToMediaFileOnImport:
                getCurrentData().getProjectProperties().copyToMediaFileOnImport,
              mediaFolder: getCurrentData().getProjectProperties().mediaFolder,
            }
          : null,
      commitProjectDocumentPatch: (patch) => commitProjectDocumentPatchBatch([patch]),
    });
  },
);

// ─── Window Layout IPC Handlers ───

ipcRegistration.handle('window-layout:get', () => {
  return loadWindowLayoutSettings();
});

ipcRegistration.handle(WINDOW_LAYOUT_DISPLAY_WORK_AREAS_CHANNEL, () => {
  return getAvailableDisplayWorkAreas();
});

ipcRegistration.handle(
  'window-layout:update',
  (_event, request: import('../shared/window-layout-settings').WindowLayoutUpdateRequest) => {
    return updateWindowLayout(request);
  },
);

ipcRegistration.handle('window-layout:reset', () => {
  return resetWindowLayout();
});

ipcRegistration.handle('open-effect-editor', async (_event, request: EffectEditorRequest) => {
  openEffectEditorWindow(mainWindow, request, {
    initialZoomFactor: appZoomController.getCurrentFactor(),
  });
});

ipcRegistration.handle('open-effect-interface', async (_event, request: EffectEditorRequest) => {
  if (!isEffectEditorRequest(request)) {
    throw new Error('Effect interface request is invalid.');
  }
  let interfaceWidth: number | undefined;
  let interfaceHeight: number | undefined;

  if (request.ownerType === 'project' && request.projectRef) {
    const effectEntry = getProjectEffectEntryByRequest(request);
    if (effectEntry) {
      const bounds = computeInterfaceBounds(effectEntry.entry);
      if (bounds.maxW > 1 || bounds.maxH > 1) {
        interfaceWidth = bounds.maxW + 10;
        interfaceHeight = bounds.maxH + 10;
      }
    }
  }

  openEffectInterfaceWindow(mainWindow, request, interfaceWidth, interfaceHeight, {
    initialZoomFactor: appZoomController.getCurrentFactor(),
  });
});

ipcRegistration.handle('get-effect-editor-document', (_event, request: EffectEditorRequest) => {
  if (!isEffectEditorRequest(request)) return null;
  if (request.ownerType === 'library') {
    return null;
  }
  return getProjectEffectEditorSnapshot(request);
});

ipcRegistration.handle(
  'update-effect-editor-document',
  (_event, request: EffectEditorPatchRequest) => {
    return applyProjectEffectEditorPatch(request);
  },
);

ipcRegistration.handle('focus-effect-editor', (_event, request: EffectEditorRequest) => {
  if (!isEffectEditorRequest(request)) return false;
  return focusEffectEditorWindowMode(request) !== null;
});

ipcRegistration.handle(
  'open-track-instrument-editor',
  async (_event, request: TrackInstrumentEditorRequest) => {
    if (
      !isTrackInstrumentEditorRequest(request) ||
      request.track.projectSessionId !== getCurrentProjectSessionId()
    ) {
      throw new Error('Track instrument editor request is no longer valid.');
    }

    if (focusTrackInstrumentEditorWindow(request)) {
      return;
    }

    // Opening is a read/focus action. A pending renderer patch may have moved
    // the document revision since the tiny Track control rendered, so resolve
    // the stable Track identity against the current canonical snapshot and use
    // its current revision for the editor window fence.
    const snapshot = getCurrentTrackInstrumentEditorSnapshot(request);
    if (!snapshot) {
      throw new Error('Track instrument is not available. Assign it again and retry.');
    }
    openTrackInstrumentEditorWindow(
      mainWindow,
      { track: snapshot.track },
      {
        initialZoomFactor: appZoomController.getCurrentFactor(),
      },
    );
  },
);

ipcRegistration.handle(
  'focus-track-instrument-editor',
  (_event, request: TrackInstrumentEditorRequest) => {
    if (!isTrackInstrumentEditorRequest(request) || !trackInstrumentRequestIsCurrent(request))
      return false;
    return focusTrackInstrumentEditorWindow(request);
  },
);

ipcRegistration.handle(
  'get-track-instrument-editor-document',
  (_event, request: TrackInstrumentEditorRequest) => {
    if (!isTrackInstrumentEditorRequest(request)) return null;
    return getTrackInstrumentEditorSnapshot(request);
  },
);

ipcRegistration.handle(
  'update-track-instrument-editor-document',
  (_event, request: TrackInstrumentEditorPatchRequest) => {
    if (!isTrackInstrumentEditorPatchRequest(request)) {
      return { status: 'unavailable', snapshot: null } satisfies TrackInstrumentEditorPatchResult;
    }
    return applyTrackInstrumentEditorPatch(request);
  },
);

ipcRegistration.handle(TRACK_INSTRUMENT_RUNTIME_STATUS_QUERY_CHANNEL, (event, request: unknown) => {
  if (!trackEditorRuntimeStatusCoordinator || !isTrackInstrumentEditorRequest(request)) return null;
  return trackEditorRuntimeStatusCoordinator.getStatus(event.sender, request);
});

ipcRegistration.handle(
  TRACK_INSTRUMENT_RUNTIME_STATUS_SUBSCRIBE_CHANNEL,
  (event, request: unknown) => {
    if (!trackEditorRuntimeStatusCoordinator || !isTrackInstrumentEditorRequest(request))
      return null;
    return trackEditorRuntimeStatusCoordinator.subscribe(event.sender, request);
  },
);

ipcRegistration.handle(
  TRACK_INSTRUMENT_RUNTIME_STATUS_UNSUBSCRIBE_CHANNEL,
  (event, request: unknown) => {
    if (!trackEditorRuntimeStatusCoordinator || !isTrackInstrumentEditorRequest(request))
      return false;
    trackEditorRuntimeStatusCoordinator.unsubscribe(event.sender, request);
    return true;
  },
);

// ─── Evaluate Code IPC Handler ───

ipcRegistration.handle(
  'engine:evaluate-code',
  async (_event, request: { editorKind: string; text: string; sourcePanelId: string }) => {
    const trimmed = request.text?.trim();
    if (!trimmed) {
      return { routedTo: 'none', ok: false, message: 'No text selected' };
    }

    if (blueLiveSession?.isRunning()) {
      if (request.editorKind === 'orc') {
        return {
          ...(await blueLiveSession.evaluateOrchestra(trimmed)),
          routedTo: 'blueLive' as const,
        };
      } else {
        return { ...(await blueLiveSession.sendScore(trimmed)), routedTo: 'blueLive' as const };
      }
    }

    if (engineBridge?.isCurrentlyPlaying()) {
      const client = engineBridge.getClient();
      if (!client) {
        return { routedTo: 'none', ok: false, message: 'Realtime engine not connected' };
      }
      try {
        if (request.editorKind === 'orc') {
          const resp = await client.compileOrc(trimmed);
          return { routedTo: 'realtime', ok: resp.ok, message: resp.ok ? undefined : resp.message };
        } else {
          const resp = await client.readScore(trimmed);
          return { routedTo: 'realtime', ok: resp.ok, message: resp.ok ? undefined : resp.message };
        }
      } catch (err) {
        return {
          routedTo: 'realtime',
          ok: false,
          message: err instanceof Error ? err.message : String(err),
        };
      }
    }

    return { routedTo: 'none', ok: false, message: 'No engine running' };
  },
);

/**
 * Synchronize real-time parameter changes to active engine sessions.
 */
function syncActiveRuntimeChannel(name: string, value: number): Promise<void> {
  return syncRuntimeChannel(name, value, engineBridge, blueLiveSession);
}

function getBlueX7EngineSyncDeps(): BlueX7EngineSyncDeps {
  return {
    getData: getCurrentData,
    getSessionId: getCurrentProjectSessionId,
    getRevision: getCurrentProjectRevision,
    isPlaying: () => !!(engineBridge?.isCurrentlyPlaying() || blueLiveSession?.isRunning()),
    writeChannels: async (entries) => {
      const writes: Promise<{ ok: boolean; message: string }>[] = [];
      if (engineBridge?.isCurrentlyPlaying()) writes.push(engineBridge.setChannels(entries));
      if (blueLiveSession?.isRunning()) writes.push(blueLiveSession.setChannels(entries));
      if (writes.length === 0) return { ok: false, message: 'no-active-engine-session' };
      const results = await Promise.all(writes);
      const failure = results.find((result) => !result.ok);
      return failure ?? { ok: true, message: 'OK' };
    },
    readChannels: (names) => {
      if (engineBridge?.isCurrentlyPlaying()) return engineBridge.getChannels(names);
      if (blueLiveSession?.isRunning()) return blueLiveSession.getChannels(names);
      return Promise.resolve({ ok: false as const, message: 'no-active-engine-session' });
    },
  };
}

async function syncEngineWithProjectPatch(
  data: BlueData,
  patch: ProjectDocumentPatch,
  scoreAutomationParameterIds: Set<string> = new Set(),
) {
  if (scoreAutomationParameterIds.size > 0) {
    const timing = buildAutomationRuntimeTimingContext(data);
    if (engineBridge?.isCurrentlyPlaying()) {
      await syncScoreAutomationParametersToEngine(
        data,
        scoreAutomationParameterIds,
        engineBridge,
        timing,
      );
    }
    if (blueLiveSession?.isRunning()) {
      await syncScoreAutomationParametersToEngine(
        data,
        scoreAutomationParameterIds,
        blueLiveSession,
        timing,
      );
    }
  }

  if (engineBridge?.isCurrentlyPlaying() && patch.mixer) {
    const mixerPatch = patch.mixer;

    if (mixerPatch.type === 'updateChannel') {
      const channel = getProjectMixerChannelBySnapshotId(mixerPatch.channelId);
      if (channel) {
        const levelParam = channel.getLevelParameter();
        const varName = levelParam.getCompilationVarName();
        if (varName && mixerPatch.patch.level !== undefined) {
          await syncActiveRuntimeChannel(varName, mixerPatch.patch.level);
        }
      }
    }
  }

  if (patch.orchestra) {
    const arrangement = data.getArrangement();
    const orchestraPatch = patch.orchestra;

    if (orchestraPatch.type === 'updateInstrument') {
      const instrument = arrangement.getInstrumentById(orchestraPatch.assignmentId);
      if (instrument instanceof BlueSynthBuilder) {
        await syncBsbInstrumentRuntimeChannels(
          instrument,
          orchestraPatch.patch,
          syncActiveRuntimeChannel,
        );
      }
      if (instrument instanceof BlueX7) {
        await syncBlueX7InstrumentPatchToRuntime(
          getBlueX7EngineSyncDeps(),
          data,
          `arrangement:${orchestraPatch.assignmentId}`,
          orchestraPatch.patch,
        );
      }
    }
  }

  const scorePatch = patch.score;
  if (scorePatch?.type === 'updateTrackInstrument') {
    if (
      data
        .getScore()
        .some(
          (candidate): candidate is TrackLayerGroup =>
            candidate instanceof TrackLayerGroup &&
            candidate.getUniqueId() === scorePatch.track.rootGroupId,
        )
    ) {
      await syncBlueX7InstrumentPatchToRuntime(
        getBlueX7EngineSyncDeps(),
        data,
        `track:${scorePatch.track.rootGroupId}:${scorePatch.track.trackId}`,
        scorePatch.patch,
      ).catch((error) => {
        console.error('[main] BlueX7 Track instrument runtime sync failed:', error);
      });
    }
    const group = data
      .getScore()
      .find(
        (candidate): candidate is TrackLayerGroup =>
          candidate instanceof TrackLayerGroup &&
          candidate.getUniqueId() === scorePatch.track.rootGroupId,
      );
    const instrument = group
      ?.find((track) => track.getUniqueId() === scorePatch.track.trackId)
      ?.getInstrument();
    if (instrument instanceof BlueSynthBuilder) {
      await syncBsbInstrumentRuntimeChannels(
        instrument,
        scorePatch.patch,
        syncActiveRuntimeChannel,
      );
    }
  }
}

ipcRegistration.handle('get-project-document', () => {
  return getCurrentProjectDocument();
});

async function commitProjectDocumentPatchBatch(
  patches: ProjectDocumentPatch[],
): Promise<ProjectDocumentCommitReceipt> {
  if (!getCurrentData()) {
    throw new Error('No project loaded');
  }

  if (!Array.isArray(patches) || patches.length === 0) {
    throw new Error('Empty project document patch batch');
  }

  let javaRuntimeDependenciesChanged = false;
  let anyCanonicalMutation = false;
  const patchChanged: boolean[] = [];
  const patchAccepted: boolean[] = [];

  for (const patch of patches) {
    const blueX7BindingsToInvalidate = collectBlueX7BindingsToInvalidate(getCurrentData(), patch);
    const clojureDependenciesChanged = patch.clojureProject
      ? clojureProjectPatchChangesRuntimeDependencies(getCurrentData(), patch.clojureProject)
      : false;
    const scoreAutomationParameterIds = collectAffectedProjectScoreAutomationParameterIds(
      getCurrentData(),
      patch,
    );
    maybeCloseRemovedProjectEffectEditors(patch);
    maybeCloseRemovedTrackInstrumentEditors(patch);
    const colorPatchAccepted = patch.score
      ? isScoreColorPatchAccepted(getCurrentData(), patch.score)
      : false;
    const changed = applyProjectDocumentPatch(getCurrentData(), patch, {
      projectSessionId: getCurrentProjectSessionId(),
      projectRevision: getCurrentProjectRevision(),
      defaultLayerGroupType: loadProgramSettings().projectDefaults.defaultLayerGroupType,
    });
    patchChanged.push(changed);
    patchAccepted.push(colorPatchAccepted || changed);
    if (changed) {
      anyCanonicalMutation = true;
      for (const ownerIdentity of blueX7BindingsToInvalidate) {
        invalidateActiveBlueX7Binding(ownerIdentity);
      }
      for (const id of collectAffectedProjectScoreAutomationParameterIds(getCurrentData(), patch)) {
        scoreAutomationParameterIds.add(id);
      }
    } else {
      scoreAutomationParameterIds.clear();
    }
    javaRuntimeDependenciesChanged =
      javaRuntimeDependenciesChanged || (changed && clojureDependenciesChanged);
    if (changed && (engineBridge?.isCurrentlyPlaying() || blueLiveSession?.isRunning())) {
      void syncEngineWithProjectPatch(getCurrentData(), patch, scoreAutomationParameterIds).catch(
        (error) => {
          console.error('[main] Failed to sync engine with project patch:', error);
        },
      );
    }
  }

  if (anyCanonicalMutation) {
    projectSession.recordMutation({
      changed: true,
      invalidateSession: javaRuntimeDependenciesChanged,
    });
  }
  if (javaRuntimeDependenciesChanged) {
    midiImportService.clearAll();
    await disposeJavaRuntimeSession();
  }
  if (anyCanonicalMutation) {
    broadcastProjectDocumentUpdate();
    unifiedLibraryService?.publishProjectChanged();
  }
  const receipt: ProjectDocumentCommitReceipt = {
    revision: getCurrentProjectRevision(),
    sessionId: getCurrentProjectSessionId(),
    changed: anyCanonicalMutation,
    patchChanged,
    patchAccepted,
  };
  return receipt;
}

function collectBlueX7BindingsToInvalidate(
  data: BlueData,
  patch: ProjectDocumentPatch,
): Set<string> {
  const owners = new Set<string>();
  const orchestraPatch = patch.orchestra;
  if (orchestraPatch) {
    if (
      orchestraPatch.type === 'removeAssignment' ||
      orchestraPatch.type === 'replaceInstrument' ||
      orchestraPatch.type === 'convertGenericToBsb' ||
      orchestraPatch.type === 'updateAssignment' ||
      (orchestraPatch.type === 'updateInstrument' && orchestraPatch.patch.enabled !== undefined)
    ) {
      owners.add(`arrangement:${orchestraPatch.assignmentId}`);
    }
  }

  const scorePatch = patch.score;
  if (!scorePatch) return owners;
  if (
    scorePatch.type === 'createTrackInstrument' ||
    scorePatch.type === 'replaceTrackInstrument' ||
    scorePatch.type === 'clearTrackInstrument' ||
    (scorePatch.type === 'updateTrackInstrument' && scorePatch.patch.enabled !== undefined)
  ) {
    owners.add(`track:${scorePatch.track.rootGroupId}:${scorePatch.track.trackId}`);
  }
  const addTrackGroup = (groupId: string, start = 0, end = Number.POSITIVE_INFINITY): void => {
    const group = data
      .getScore()
      .find(
        (candidate): candidate is TrackLayerGroup =>
          candidate instanceof TrackLayerGroup && candidate.getUniqueId() === groupId,
      );
    if (!group) return;
    for (let index = start; index <= Math.min(end, group.length - 1); index += 1) {
      const track = group[index];
      if (track) owners.add(`track:${groupId}:${track.getUniqueId()}`);
    }
  };
  if (scorePatch.type === 'removeLayerGroup') {
    addTrackGroup(scorePatch.groupId);
  } else if (scorePatch.type === 'removeLayer') {
    addTrackGroup(scorePatch.groupId, scorePatch.layerIndex, scorePatch.layerIndex);
  } else if (scorePatch.type === 'removeLayerRanges') {
    for (const range of scorePatch.ranges) {
      addTrackGroup(range.groupId, range.startIndex, range.endIndex);
    }
  }
  return owners;
}

ipcRegistration.handle(
  'commit-project-document-patches',
  async (_event, patches: ProjectDocumentPatch[]) => {
    return commitProjectDocumentPatchBatch(patches);
  },
);

// Spec 092: visible-only effective-value readback for open BlueX7 editors.
// Fails closed for stale sessions, stopped playback, and missing owners;
// never mutates canonical project state.
ipcRegistration.handle('blue-x7-effective-values', async (_event, request: unknown) => {
  if (!isBlueX7EffectiveValuesRequest(request)) {
    return { ok: false, reason: 'channel-unavailable' } as const;
  }
  return requestBlueX7EffectiveValues(
    createBlueX7RuntimeEnvironment(getBlueX7EngineSyncDeps()),
    request as BlueX7EffectiveValuesRequest,
  );
});

ipcRegistration.handle(
  'read-audio-file-bytes',
  async (_event, filePath: string): Promise<ArrayBuffer | null> => {
    try {
      const resolvedFilePath = resolveAudioFilePathForRead(filePath);
      if (!resolvedFilePath) {
        return null;
      }

      const buffer = await fs.promises.readFile(resolvedFilePath);
      return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    } catch {
      return null;
    }
  },
);

ipcRegistration.handle(
  'read-authorized-audio-file-bytes',
  async (_event, filePath: string): Promise<ArrayBuffer | null> => {
    const resolvedFilePath = resolveAudioFilePathForRead(filePath);
    return resolvedFilePath ? readAuthorizedAudioFileBytes(resolvedFilePath) : null;
  },
);

ipcRegistration.handle('open-audio-file', async (): Promise<string | null> => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Audio File',
    defaultPath: getConfiguredWorkDirectory(),
    properties: ['openFile'],
    filters: [
      {
        name: 'Audio Files',
        extensions: [
          'wav',
          'wave',
          'aif',
          'aiff',
          'mp3',
          'ogg',
          'oga',
          'flac',
          'au',
          'm4a',
          'w64',
          'opus',
          'weba',
        ],
      },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const filePath = result.filePaths[0];
  return filePath && authorizeAudioFilePath(filePath) ? filePath : null;
});

// SPEC 076: authorize a File Manager double-clicked file for the audio
// stream protocol (same policy as dialog-selected and play-render outputs).
ipcRegistration.handle('authorize-audio-file', (_event, filePath: string): boolean => {
  return typeof filePath === 'string' && filePath.length > 0
    ? authorizeAudioFilePath(filePath)
    : false;
});

ipcRegistration.handle(
  'get-audio-file-stat',
  async (_event, filePath: string): Promise<{ size: number; mtime: number } | null> => {
    try {
      const resolvedFilePath = resolveAudioFilePathForRead(filePath);
      if (!resolvedFilePath) return null;
      const authorizedFilePath = await resolveAuthorizedAudioFilePath(resolvedFilePath);
      if (!authorizedFilePath) return null;
      const stat = await fs.promises.stat(authorizedFilePath);
      if (!stat.isFile()) return null;
      return { size: stat.size, mtime: stat.mtimeMs };
    } catch {
      return null;
    }
  },
);

ipcRegistration.handle(
  'get-score-object-editor-document',
  (_event, request: ScoreObjectEditorRequest): ScoreObjectEditorDocumentSnapshot | null => {
    if (!getCurrentData()) return null;
    const doc = createScoreObjectEditorDocument(getCurrentData(), request);
    if (!doc) return null;

    const context = getScoreObjectFileResolutionContext(getCurrentData());

    if (doc.editor.kind === 'audioFile') {
      doc.editor.metadata = inspectAudioFileMetadata(doc.editor.filePath, context);
    } else if (doc.editor.kind === 'frozenSoundObject') {
      const inspection = inspectFrozenArtifact(doc.editor.frozenWaveFileName, context);
      doc.editor.artifactStatus = inspection.artifactStatus;
      doc.editor.canSaveCopy = inspection.canSaveCopy;
      if (inspection.message) {
        doc.editor.message = inspection.message;
      }
    }

    return doc;
  },
);

ipcRegistration.handle(
  'select-score-object-audio-file',
  async (event, request?: { currentPath?: string }): Promise<AudioFileSelectionResult> => {
    const owner = BrowserWindow.fromWebContents(event.sender);
    if (!owner || owner.isDestroyed()) {
      return {
        status: 'error',
        code: 'no-project',
        message: 'No active owner window.',
      };
    }

    if (!getCurrentData()) {
      return {
        status: 'error',
        code: 'no-project',
        message: 'No project open.',
      };
    }

    const projectProps = getCurrentData().getProjectProperties();
    const context = getScoreObjectFileResolutionContext(getCurrentData());

    return selectScoreObjectAudioFile(
      {
        currentPath: request?.currentPath,
        context,
        projectProps: {
          copyToMediaFileOnImport: projectProps.copyToMediaFileOnImport,
          mediaFolder: projectProps.mediaFolder,
        },
      },
      {
        showOpenDialog: async (defaultPath) => {
          const result = await dialog.showOpenDialog(owner, {
            title: 'Select Audio File',
            defaultPath,
            properties: ['openFile'],
            filters: [
              {
                name: 'Audio Files (*.wav, *.aif, *.aiff, *.aifc)',
                extensions: ['wav', 'aif', 'aiff', 'aifc', 'WAV', 'AIF', 'AIFF', 'AIFC'],
              },
              { name: 'All Files (*.*)', extensions: ['*'] },
            ],
          });
          return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0]!;
        },
      },
    );
  },
);

ipcRegistration.handle(
  'save-frozen-sound-object-copy',
  async (
    event,
    request: { frozenWaveFileName: string },
  ): Promise<FrozenSoundObjectSaveCopyResult> => {
    const owner = BrowserWindow.fromWebContents(event.sender);
    if (!owner || owner.isDestroyed()) {
      return {
        status: 'error',
        code: 'no-project',
        message: 'No active owner window.',
      };
    }

    if (!getCurrentData() || !getCurrentFilePath()) {
      return {
        status: 'error',
        code: 'no-project',
        message: 'No saved project open.',
      };
    }

    const context = getScoreObjectFileResolutionContext(getCurrentData());

    return saveFrozenSoundObjectCopy(
      {
        frozenWaveFileName: request.frozenWaveFileName,
        context,
      },
      {
        showSaveDialog: async (defaultPath, defaultFileName) => {
          const result = await dialog.showSaveDialog(owner, {
            title: 'Save Copy of Frozen Audio',
            defaultPath:
              defaultPath && defaultFileName
                ? path.join(defaultPath, defaultFileName)
                : defaultPath,
            filters: [
              { name: 'Audio Files (*.wav, *.aif, *.aiff)', extensions: ['wav', 'aif', 'aiff'] },
              { name: 'All Files (*.*)', extensions: ['*'] },
            ],
          });
          return result.canceled || !result.filePath ? null : result.filePath;
        },
        confirmOverwrite: async (fileName) => {
          const res = await showNativeConfirmation(owner, {
            id: 'overwrite-frozen-audio',
            type: 'question',
            title: 'Overwrite File?',
            message: `File already exists: ${fileName}\n\nDo you want to overwrite it?`,
            actions: [
              { id: 'overwrite', label: 'Overwrite', role: 'destructive' },
              { id: 'cancel', label: 'Cancel', role: 'cancel' },
            ],
            defaultActionId: 'cancel',
            cancelActionId: 'cancel',
          });
          return res.actionId === 'overwrite' && res.outcome === 'selected';
        },
      },
    );
  },
);

ipcRegistration.handle('get-named-chain-names', (): string[] => {
  if (!getCurrentData()) return [];
  return getCurrentData().getNoteProcessorChainMap().getChainNames();
});

ipcRegistration.handle(
  'get-named-chain',
  (_event, name: string): NoteProcessorChainSnapshot | null => {
    if (!getCurrentData()) return null;
    const chain = getCurrentData().getNoteProcessorChainMap().getNoteProcessorChain(name);
    if (!chain) return null;
    return createNoteProcessorChainSnapshot(chain);
  },
);

ipcRegistration.handle(
  'get-nested-poly-object-snapshot',
  (_event, location: ScoreObjectLocationRef): PolyObjectLayerGroupSnapshot | null => {
    if (!getCurrentData()) return null;
    return createNestedPolyObjectSnapshot(getCurrentData(), location);
  },
);

async function runScoreObjectTestRequest(
  request: ScoreObjectEditorRequest,
): Promise<ScoreObjectTestResult> {
  let javaRuntimeClient: JavaRuntimeClient | null = null;

  try {
    if (getCurrentData()) {
      javaRuntimeClient = await runProjectOnLoad(getCurrentData());
    }
  } catch (error) {
    return {
      ok: false,
      output: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }

  return testScoreObject(getCurrentData(), request, {
    ensureJavaScriptEngine,
    javaScriptSession,
    javaRuntimeClient,
  });
}

for (const channel of [
  'test-score-object',
  'test-external-sound-object',
  'test-javascript-sound-object',
] as const) {
  ipcRegistration.handle(channel, (_event, request: ScoreObjectEditorRequest) =>
    runScoreObjectTestRequest(request),
  );
}

async function runPythonInstrumentTestRequest(
  request: PythonInstrumentTestRequest,
): Promise<PythonInstrumentTestResult> {
  let javaRuntimeClient: JavaRuntimeClient | null = null;

  try {
    if (getCurrentData()) {
      javaRuntimeClient = await runProjectOnLoad(getCurrentData());
    }
  } catch (error) {
    return {
      ok: false,
      output: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }

  return testPythonInstrument(request, {
    javaRuntimeClient,
  });
}

ipcRegistration.handle('test-python-instrument', (_event, request: PythonInstrumentTestRequest) =>
  runPythonInstrumentTestRequest(request),
);

ipcRegistration.handle(
  REPL_CONSOLE_OPEN_CHANNEL,
  async (_event, request: ReplConsoleOpenRequest): Promise<ReplConsoleOpenResult> => {
    if (!isReplConsoleLanguage(request?.language)) {
      return createReplOpenResult('javascript', 'error', 'Invalid console language.');
    }
    return openReplConsole(request.language);
  },
);

ipcRegistration.handle(
  REPL_CONSOLE_EVALUATE_CHANNEL,
  async (_event, request: ReplConsoleEvaluateRequest): Promise<ReplConsoleEvaluateResult> =>
    evaluateReplConsole(request),
);

ipcRegistration.handle(
  REPL_CONSOLE_REINITIALIZE_CHANNEL,
  async (_event, request: ReplConsoleReinitializeRequest): Promise<ReplConsoleReinitializeResult> =>
    reinitializeReplConsole(request),
);

ipcRegistration.handle(
  REPL_CONSOLE_CLOSE_CHANNEL,
  (_event, _request: ReplConsoleCloseRequest): ReplConsoleCloseResult => ({ ok: true }),
);

ipcRegistration.handle(
  JAVASCRIPT_RUNTIME_REINITIALIZE_CHANNEL,
  async (): Promise<ScriptRuntimeReinitializeResult> => reinitializeJavaScriptRuntime(),
);

ipcRegistration.handle('java-runtime:reinitialize', async () => {
  if (!getCurrentData()) {
    return { ok: false, error: 'No project loaded.' };
  }

  if (!getCurrentData().usesJavaRuntime()) {
    return { ok: false, error: 'Active project does not use the Java runtime.' };
  }

  if (!javaRuntimeSessionManager) {
    return { ok: false, error: 'Java runtime manager is unavailable.' };
  }

  try {
    const javaRuntimeClient = await javaRuntimeSessionManager.reinitializeClojure(
      getCurrentData(),
      getCurrentProjectSessionId(),
      getCurrentFilePath(),
    );
    await getCurrentData().processOnLoadAsync(javaScriptSession ?? undefined, javaRuntimeClient);
    lastProjectOnLoadState = getProjectOnLoadState(getCurrentData(), javaRuntimeClient);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcRegistration.handle('java-runtime:reinitialize-jython', async () => reinitializeJythonRuntime());

ipcRegistration.handle(
  'send-bsb-realtime-control-update',
  (_event, update: BsbRealtimeControlUpdate) => {
    if (!getCurrentData() || !isBsbRealtimeControlUpdate(update)) {
      return;
    }

    void syncBsbRealtimeControlUpdate(
      getCurrentData(),
      update,
      getCurrentProjectSessionId(),
      syncActiveRuntimeChannel,
    ).catch((error) => {
      console.error('[main] Failed to sync realtime BSB control update:', error);
    });
  },
);

ipcRegistration.handle(
  'send-mixer-realtime-level-update',
  (_event, update: import('../shared/project-editor').MixerRealtimeLevelUpdate) => {
    if (!getCurrentData() || !engineBridge || !engineBridge.isCurrentlyPlaying()) {
      return;
    }

    const channel = getProjectMixerChannelBySnapshotId(update.channelId);
    if (!channel) return;

    const varName = channel.getLevelParameter().getCompilationVarName();
    if (varName) {
      void engineBridge.setChannel(varName, update.level).catch(() => {});
    }
  },
);

ipcRegistration.handle(
  'send-effect-realtime-update',
  (_event, update: import('../shared/project-editor').EffectRealtimeUpdate) => {
    if (
      !getCurrentData() ||
      !engineBridge ||
      !engineBridge.isCurrentlyPlaying() ||
      !update.bsbWidgetValues
    ) {
      return;
    }

    const effectEntry = getProjectEffectEntryByRequest({
      ownerType: 'project',
      effectId: update.entryId,
      projectRef: { channelId: update.channelId, chain: update.chain, entryId: update.entryId },
    });
    if (!effectEntry) return;

    const params = effectEntry.entry.getParameters();
    for (const [objectName, value] of Object.entries(update.bsbWidgetValues)) {
      const param = params.find((p) => p.getName() === objectName);
      if (param?.getCompilationVarName()) {
        void engineBridge.setChannel(param.getCompilationVarName()!, value).catch(() => {});
      }
    }
  },
);

ipcRegistration.handle('update-project-document', (_event, patch) => {
  if (!getCurrentData()) {
    throw new Error('No project loaded');
  }

  if (!patch || isEmptyProjectDocumentPatch(patch)) {
    throw new Error('Empty project document patch');
  }

  maybeCloseRemovedProjectEffectEditors(patch);
  maybeCloseRemovedTrackInstrumentEditors(patch);
  const scoreAutomationParameterIds = collectAffectedProjectScoreAutomationParameterIds(
    getCurrentData(),
    patch,
  );
  const changed = applyProjectDocumentPatch(getCurrentData(), patch, {
    projectSessionId: getCurrentProjectSessionId(),
    projectRevision: getCurrentProjectRevision(),
    defaultLayerGroupType: loadProgramSettings().projectDefaults.defaultLayerGroupType,
  });
  if (changed) {
    for (const id of collectAffectedProjectScoreAutomationParameterIds(getCurrentData(), patch)) {
      scoreAutomationParameterIds.add(id);
    }
    // Sync with each active real-time engine.
    if (engineBridge?.isCurrentlyPlaying() || blueLiveSession?.isRunning()) {
      void syncEngineWithProjectPatch(getCurrentData(), patch, scoreAutomationParameterIds);
    }
    projectSession.recordMutation({ changed: true });
    broadcastProjectDocumentUpdate();
  } else {
    scoreAutomationParameterIds.clear();
  }

  return getCurrentProjectDocument();
});

// ─── App Lifecycle ───

// ─── Render/Freeze IPC Handlers ───

ipcRegistration.handle('render-to-disk', (_event, request: unknown) => {
  if (!isRenderToDiskRequest(request)) {
    return {
      ok: false,
      operationId: '',
      cancelled: false,
      outputPath: null,
      error: 'Invalid render-to-disk request.',
    } satisfies RenderOperationResult;
  }
  return handleRenderToDisk(request.action, request.operationId);
});

ipcRegistration.handle('freeze-score-objects', (_event, request: unknown) => {
  if (!isFreezeScoreObjectsRequest(request)) {
    return {
      ok: false,
      operationId: '',
      cancelled: false,
      frozenCount: 0,
      unfrozenCount: 0,
      deletedFiles: [],
      rejectedTargets: [],
      error: 'Invalid freeze request.',
      project: null,
    } satisfies FreezeOperationResult;
  }
  return handleFreezeScoreObjects(request);
});

ipcRegistration.handle('cancel-render-operation', (_event, request: unknown) => {
  if (!isCancelRenderOperationRequest(request)) return false;
  return handleCancelRenderOperation(request);
});

function registerDomainIpc(): void {
  unregisterDomainIpc = registerMainProcessDomainIpc({
    ipcMain: electronIpcMain,
    handlers: collectedIpcHandlers,
    listeners: collectedIpcListeners,
  });
}

function unregisterDomainIpcStage(): void {
  unregisterDomainIpc?.();
  unregisterDomainIpc = null;
}

function handleZoomBrowserWindowCreated(_event: Electron.Event, window: BrowserWindow): void {
  const applyCurrentZoom = (): void => {
    appZoomController.applyToWindow(window);
  };
  applyCurrentZoom();
  window.webContents.on('did-start-navigation', applyCurrentZoom);
  window.webContents.on('did-navigate', applyCurrentZoom);
}

async function rollbackApplicationShellStage(): Promise<void> {
  app.removeListener('browser-window-created', handleZoomBrowserWindowCreated);

  await midiInputCoordinator?.requestShutdown();
  midiInputCoordinator?.disposeIpcHandlers();
  midiInputCoordinator = null;

  if (blueLiveSession) {
    await blueLiveSession.stop();
  }
  blueLiveSession = null;
  blueLiveTriggerController = null;

  await engineBridge?.dispose();
  engineBridge = null;
  engineRuntimeService = null;

  trackEditorRuntimeStatusCoordinator?.dispose();
  trackEditorRuntimeStatusCoordinator = null;

  await javaRuntimeSessionManager?.dispose();
  javaRuntimeSessionManager = null;
  disposeJavaScriptSession();

  for (const window of BrowserWindow.getAllWindows().slice().reverse()) {
    if (!window.isDestroyed()) window.destroy();
  }
  mainWindow = null;
}

async function startApplicationShellStage(): Promise<void> {
  try {
    if (process.platform === 'darwin' && app.dock) {
      const dockIcon = getAppIcon();
      if (dockIcon) {
        app.dock.setIcon(dockIcon);
      }
    }

    // SPEC 061: install the zoom listener before the first BrowserWindow.
    appZoomController.initialize();
    app.on('browser-window-created', handleZoomBrowserWindowCreated);

    const initialSettings = loadProgramSettings();
    currentFollowPlaybackEnabled = initialSettings.playback.followPlayback;
    currentSavedFollowPlayback = initialSettings.playback.followPlayback;
    currentFollowPlaybackOnStartEnabled = initialSettings.playback.followPlaybackOnStart;

    createWindow();
  } catch (error) {
    try {
      await rollbackApplicationShellStage();
    } catch (cleanupError) {
      console.error('[startup] Failed to clean up the partial application shell:', cleanupError);
    }
    throw error;
  }
}

async function rollbackUnifiedLibraryStage(): Promise<void> {
  unregisterUnifiedLibraryIpc?.();
  unregisterUnifiedLibraryIpc = null;
  const service = unifiedLibraryService;
  unifiedLibraryService = null;
  await service?.stop();
}

async function startUnifiedLibraryStage(): Promise<void> {
  try {
    unifiedLibraryService = new UnifiedLibraryService(
      path.join(app.getPath('userData'), 'blue_libraries.sqlite'),
      undefined,
      new UnifiedLibraryProjectAdapter(() =>
        getCurrentData()
          ? {
              data: getCurrentData(),
              sessionId: getCurrentProjectSessionId(),
              revision: getCurrentProjectRevision(),
              commit: () => {
                const receipt = projectSession.recordMutation({ changed: true });
                broadcastProjectDocumentUpdate();
                return receipt.revision;
              },
            }
          : null,
      ),
      {
        legacyConfigurationDirectory: path.join(app.getPath('home'), '.blue'),
        migrationStatePath: path.join(app.getPath('userData'), 'blue-libraries-state.json'),
      },
    );
    unregisterUnifiedLibraryIpc = registerUnifiedLibraryIpc({
      ipcMain: electronIpcMain,
      service: unifiedLibraryService,
      getWindows: () => BrowserWindow.getAllWindows(),
      getWorkDirectory: getConfiguredWorkDirectory,
    });
    await unifiedLibraryService.start();
  } catch (error) {
    try {
      await rollbackUnifiedLibraryStage();
    } catch (cleanupError) {
      console.error('[startup] Failed to clean up the partial unified library:', cleanupError);
    }
    throw error;
  }
}

async function rollbackCodeRepositoryStage(): Promise<void> {
  unregisterCodeRepositoryIpc?.();
  unregisterCodeRepositoryIpc = null;
  const service = codeRepositoryService;
  codeRepositoryService = null;
  await service?.stop();
}

async function startCodeRepositoryStage(): Promise<void> {
  try {
    codeRepositoryService = new CodeRepositoryService(
      path.join(app.getPath('userData'), 'blue_code_repository.sqlite'),
      {
        legacyConfigurationDirectory: path.join(app.getPath('home'), '.blue'),
        migrationStatePath: path.join(app.getPath('userData'), 'blue-code-repository-state.json'),
      },
    );
    unregisterCodeRepositoryIpc = registerCodeRepositoryIpc({
      ipcMain: electronIpcMain,
      service: codeRepositoryService,
      getWindows: () => BrowserWindow.getAllWindows(),
      getWorkDirectory: getConfiguredWorkDirectory,
    });
    await codeRepositoryService.start();
  } catch (error) {
    try {
      await rollbackCodeRepositoryStage();
    } catch (cleanupError) {
      console.error('[startup] Failed to clean up the partial code repository:', cleanupError);
    }
    throw error;
  }
}

async function rollbackOscStage(): Promise<void> {
  const service = oscControlService;
  oscControlService = null;
  await service?.shutdown();
}

function handleFloatingWindowCreated(_event: Electron.Event, window: BrowserWindow): void {
  window.webContents.once('did-finish-load', () => {
    const url = window.webContents.getURL();
    const popoutMatch = /popout\.html\?id=([^&#]+)/.exec(url);
    if (popoutMatch) {
      registerFloatingWindow(window, { popoutGroupId: decodeURIComponent(popoutMatch[1]) });
    } else if (/popout\.html([?#]|$)/.test(url)) {
      registerFloatingWindow(window);
    }
  });
}

function handleAppActivate(): void {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
}

function registerWindowHooksStage(): void {
  app.on('browser-window-created', handleFloatingWindowCreated);
  app.on('activate', handleAppActivate);
}

function rollbackWindowHooksStage(): void {
  app.removeListener('activate', handleAppActivate);
  app.removeListener('browser-window-created', handleFloatingWindowCreated);
}

const preReadyStartupLifecycle = createStartupLifecycle([
  {
    name: 'domain IPC registrars',
    start: registerDomainIpc,
    rollback: unregisterDomainIpcStage,
  },
  {
    name: 'blue audio scheme',
    start: registerBlueAudioScheme,
    irreversible: true,
  },
]);
const preReadyStartupPromise = preReadyStartupLifecycle.start();
const applicationReadyPromise = Promise.all([app.whenReady(), preReadyStartupPromise]);

applicationReadyPromise.then(async () => {
  const readyStartupLifecycle = createStartupLifecycle([
    {
      name: 'protocol and verification',
      irreversible: true,
      start: async () => {
        registerBlueAudioProtocolHandler();
        setExternalCommandExecutor(
          createMainExternalExecutor(() =>
            getCurrentFilePath() ? path.dirname(getCurrentFilePath()) : null,
          ),
        );

        if (process.env.BLUE_VERIFY_MODE === 'packaged-project') {
          await runPackagedProjectVerificationAndExit();
        }
        if (process.env.BLUE_VERIFY_MODE === 'packaged-engine-mismatch') {
          await runPackagedEngineMismatchVerificationAndExit();
        }
      },
    },
    {
      name: 'workbench IPC',
      start: initWorkbenchWindowHost,
      rollback: disposeWorkbenchWindowHost,
    },
    {
      name: 'stale engine sweep',
      irreversible: true,
      start: async () => {
        try {
          const report = await sweepStaleBlueEngineProcesses();
          if (
            report.inspected > 0 ||
            report.removed > 0 ||
            report.terminated > 0 ||
            report.retained > 0
          ) {
            console.log(
              `[main] Blue engine startup sweep: inspected=${report.inspected}, removed=${report.removed}, terminated=${report.terminated}, kept=${report.kept}, retained=${report.retained}`,
            );
          }
        } catch (error: unknown) {
          console.warn(
            `[main] Blue engine startup sweep failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      },
    },
    {
      name: 'application shell',
      start: startApplicationShellStage,
      rollback: rollbackApplicationShellStage,
    },
    {
      name: 'unified library',
      start: startUnifiedLibraryStage,
      rollback: rollbackUnifiedLibraryStage,
    },
    {
      name: 'code repository',
      start: startCodeRepositoryStage,
      rollback: rollbackCodeRepositoryStage,
    },
    {
      name: 'OSC control',
      start: initializeOscControlService,
      rollback: rollbackOscStage,
    },
    {
      name: 'window hooks',
      start: registerWindowHooksStage,
      rollback: rollbackWindowHooksStage,
    },
  ]);

  try {
    await readyStartupLifecycle.start();
  } catch (error) {
    await preReadyStartupLifecycle.rollbackFailedStartup();
    throw error;
  }
});

// Intercept Cmd+Q and window close buttons
app.on('before-quit', (event: Electron.Event) => {
  if (!isQuitting) {
    event.preventDefault();
    requestQuit();
  }
});

app.on('window-all-closed', () => {
  if (!isQuitting) {
    requestQuit();
  } else {
    void doQuit();
  }
});

process.once('SIGINT', () => {
  void doQuit();
});

process.once('SIGTERM', () => {
  void doQuit();
});
