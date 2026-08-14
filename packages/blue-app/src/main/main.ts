/**
 * Electron main process — manages app window, file dialogs, and engine lifecycle.
 */
import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  Menu,
  nativeImage,
  shell,
} from 'electron';
import * as path from 'path';
import * as fs from 'fs';

import {
  BlueData,
  Effect,
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
import { buildRealtimeEngineOptions as buildRealtimeEngineOptionsFromSettings, buildUsageMatrix } from './program-settings-usage';
import type { ProgramSettingsSnapshot } from '../shared/program-settings';
import { normalizeDefaultLayerGroupType } from '../shared/program-settings';
import {
  isTrackInstrumentEditorPatchRequest,
  isTrackInstrumentEditorRequest,
} from '../shared/track-instrument-editor-contract';
import type { EngineProbeRequest, EngineProbeResult } from '../shared/engine-runtime';
import type { CsoundIoQueryRequest, CsoundIoQueryResult } from '../shared/csound-runtime';
import { initializeJavaScriptRuntime, JavaScriptSession } from '@blue/data';
import type { TempoMap } from '@blue/data';
import { EngineBridge } from './engine-bridge';
import { BlueLiveEngineSession } from './blue-live-engine';
import {
  BlueLiveTriggerController,
  stopBlueLiveForProjectReplacement,
  type BlueLiveTriggerControllerAccessors,
} from './blue-live-trigger-controller';
import { EngineRuntimeService } from './engine-runtime';
import { buildApplicationMenuTemplate } from './application-menu';
import { resolveExampleProjectPath } from './example-project-path';
import { createAppZoomController } from './app-zoom-controller';
import { sweepStaleBlueEngineProcesses } from './engine-process-registry';
import {
  closeEffectEditorWindow,
  closeEffectEditorWindowsForOwner,
  broadcastProjectDocumentUpdateToEffectWindows,
  focusEffectEditorWindow,
  openEffectEditorWindow,
  openEffectInterfaceWindow,
} from './effect-editor-window-manager';
import {
  broadcastProjectDocumentUpdateToTrackInstrumentWindows,
  closeTrackInstrumentEditorWindows,
  closeTrackInstrumentEditorWindowsForGroup,
  closeTrackInstrumentEditorWindowsForTrack,
  focusTrackInstrumentEditorWindow,
  openTrackInstrumentEditorWindow,
} from './track-instrument-editor-window-manager';
import { cleanupTempCsdSnapshots } from './render-command';
import { saveGeneratedCsdToDisk } from './csd-export';
import {
  normalizeWorkDirectory,
  resolveWorkDirectoryDefaultPath,
} from './work-directory';
import {
  authorizeAudioFilePath,
  readAuthorizedAudioFileBytes,
  registerBlueAudioScheme,
  registerBlueAudioProtocolHandler,
  resolveAuthorizedAudioFilePath,
} from './audio-stream-protocol';
import { executeExternalTest } from './external-executor';
import { createMainExternalExecutor } from './external-command-executor';
import {
  inspectSoundFont,
  type SoundFontExecutionSeam,
} from './soundfont-viewer';
import {
  buildAutomationRuntimeTimingContext,
  collectAffectedProjectScoreAutomationParameterIds,
  syncScoreAutomationParametersToEngine,
} from './score-automation-runtime-sync';
import type { JavaRuntimeClient } from './java-runtime/java-runtime-client';
import { JavaRuntimeSessionManager } from './java-runtime/java-runtime-session';
import { evaluateJavaScriptConsole } from './repl-console-runtime';
import { testScoreObject } from './score-object-test';
import { testPythonInstrument, type PythonInstrumentTestRequest, type PythonInstrumentTestResult } from './python-instrument-test';
import { auditionSelectedScoreObjects } from './audition-score-objects';
import { syncCompiledRuntimeParameterNames } from './runtime-parameter-sync';
import { syncRuntimeChannel } from './runtime-channel-sync';
import {
  syncBsbInstrumentRuntimeChannels,
  syncBsbRealtimeControlUpdate,
} from './bsb-instrument-runtime-sync';
import {
  broadcastToWorkbenchWindows,
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
import {
  ABOUT_WINDOW_CLOSE_CHANNEL,
  APP_METADATA_GET_CHANNEL,
} from '../shared/app-metadata';
import { MidiInputCoordinator } from './midi-input-coordinator';
import { parseMidiImportBytes } from './midi-import-parser';
import { MidiImportService } from './midi-import-service';
import type {
  MidiImportCommitResult,
  MidiImportStartResult,
} from '../shared/midi-import';
import {
  decideMidiPermission,
  isSameApplicationLocation,
} from './midi-permission';
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
} from '../shared/project-editor';
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
  DiskRenderAction,
} from '../shared/render-freeze-contract';
import {
  RENDER_OPERATION_STATUS_CHANNEL,
  isCancelRenderOperationRequest,
  isFreezeScoreObjectsRequest,
  isRenderToDiskRequest,
} from '../shared/render-freeze-contract';
import { executeRenderToDisk, parseCsoundProgressLine, resolveOutputFilePath, resolveRenderWorkingDirectory, type RenderExecutionSeam } from './render-to-disk';
import { generateDiskCsdForScreen, generateRealtimeCsdForScreen } from './csd-generation';
import { tokenizeCommand } from './disk-render-command';
import {
  executeFreezeUnfreeze,
  type FreezeExecutionSeam,
} from './freeze-score-objects';
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
import {
  runPackagedMetadataVerificationAndExit,
  runPackagedRuntimeVerificationAndExit,
  verifyPackagedProject,
} from './packaged-runtime-verification';

let mainWindow: BrowserWindow | null = null;
let currentData: BlueData | null = null;
let currentFilePath: string | null = null;
let currentProjectRevision = 0;
let canAuditionScoreObjects = false;
let unifiedLibraryService: UnifiedLibraryService | null = null;
let unregisterUnifiedLibraryIpc: (() => void) | null = null;
let codeRepositoryService: CodeRepositoryService | null = null;
let unregisterCodeRepositoryIpc: (() => void) | null = null;

// ─── Render/Freeze operation lifecycle ───
let activeRenderOperationId: string | null = null;
let activeRenderAbortController: AbortController | null = null;
let activeRenderOperationKind: RenderOperationStatus['kind'] | null = null;
let activeRenderAction: DiskRenderAction | null = null;
let activeRenderCancellationSignal: { cancelled: boolean } | null = null;
let engineBridge: EngineBridge | null = null;
let blueLiveSession: BlueLiveEngineSession | null = null;
let blueLiveTriggerController: BlueLiveTriggerController | null = null;

/**
 * Lazily build (or return the cached) Blue Live trigger controller wired to
 * the current canonical-state accessors. The controller reads module-level
 * state through callbacks so main retains ownership.
 */
function getBlueLiveTriggerController(): BlueLiveTriggerController {
  if (blueLiveTriggerController) return blueLiveTriggerController;
  const accessors: BlueLiveTriggerControllerAccessors = {
    getCanonicalProject: () => currentData,
    getProjectSessionId: () => currentProjectSessionId,
    getDocumentRevision: () => currentProjectRevision,
    getBlueLiveSession: () => blueLiveSession,
    getJavaScriptSession: () => javaScriptSession,
    getJavaRuntimeSessionManager: () => javaRuntimeSessionManager,
    getCurrentFilePath: () => currentFilePath,
  };
  blueLiveTriggerController = new BlueLiveTriggerController(accessors);
  return blueLiveTriggerController;
}
let engineRuntimeService: EngineRuntimeService | null = null;
let isQuitting = false;
let pendingQuit = false;
let shutdownPromise: Promise<void> | null = null;
let playbackStartPromise: Promise<boolean> | null = null;
let activeAuditionPlayback = false;
let javaScriptRuntimeReady: Promise<void> | null = null;
let javaScriptSession: JavaScriptSession | null = null;
let javaRuntimeSessionManager: JavaRuntimeSessionManager | null = null;
let replRuntimeQueue: Promise<unknown> = Promise.resolve();
let midiInputCoordinator: MidiInputCoordinator | null = null;
let oscControlService: OscControlService | null = null;
let recentProjectFiles: string[] = [];
let currentProjectSessionId = 0;
let currentFollowPlaybackEnabled = true;
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

  const result = await dialog.showMessageBox(mainWindow, {
    type: 'error',
    title: 'Csound Error',
    message: 'There was an error in running Csound.',
    detail: `Please view the Csound Output panel for more information.\n\n${message}`,
    checkboxLabel: 'Disable Error Message Dialog',
    buttons: ['OK'],
    defaultId: 0,
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
  getProjectSessionId: () => currentProjectSessionId,
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
  if (!currentData) {
    return null;
  }

  return createProjectEditorSnapshot(currentData, currentFilePath, currentProjectSessionId);
}

function broadcastOscSnapshot(snapshot: OscServerRuntimeSnapshot): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed() && !window.webContents.isDestroyed()) {
      window.webContents.send(OSC_CONTROL_SNAPSHOT_CHANGED_CHANNEL, snapshot);
    }
  }
}

function dispatchOscCommand(event: OscCommandEvent): void {
  if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed() || isQuitting) {
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
 * {@link currentProjectRevision} before invoking this so the broadcast carries
 * a fresh revision. Requires a non-null `currentData`.
 */
function broadcastProjectDocumentUpdate(sourceWindowId?: string): void {
  const snapshot = getCurrentProjectDocument();
  if (!snapshot) return;
  const event: ProjectDocumentUpdatedEvent = {
    sessionId: currentProjectSessionId,
    revision: currentProjectRevision,
    snapshot,
    ...(sourceWindowId ? { sourceWindowId } : {}),
  };
  broadcastToWorkbenchWindows(PROJECT_DOCUMENT_UPDATED_CHANNEL, event);
  broadcastProjectDocumentUpdateToEffectWindows(event);
  broadcastProjectDocumentUpdateToTrackInstrumentWindows(event);
}

function getProjectMixerChannelBySnapshotId(channelId: string) {
  if (!currentData) {
    return null;
  }

  return findMixerChannelById(currentData.getMixer(), channelId);
}

function getProjectEffectEntryByRequest(request: EffectEditorRequest) {
  if (!currentData || request.ownerType !== 'project' || !request.projectRef) {
    return null;
  }

  const channel = getProjectMixerChannelBySnapshotId(request.projectRef.channelId);
  if (!channel) {
    return null;
  }

  const chain = request.projectRef.chain === 'pre' ? channel.getPreEffects() : channel.getPostEffects();
  const index = chain.findIndex((entry) => getMixerEntrySnapshotId(entry) === request.projectRef?.entryId);
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
    projectUdos: currentData ? createProjectUdoListSnapshot(currentData) : [],
  });
}

function trackInstrumentRequestIsCurrent(request: TrackInstrumentEditorRequest): boolean {
  const { projectSessionId, projectRevision } = request.track;
  return projectSessionId === currentProjectSessionId
    && projectRevision === currentProjectRevision;
}

function getTrackInstrumentEditorSnapshot(request: TrackInstrumentEditorRequest) {
  if (!currentData || !trackInstrumentRequestIsCurrent(request)) return null;

  return getCurrentTrackInstrumentEditorSnapshot(request);
}

function getCurrentTrackInstrumentEditorSnapshot(request: TrackInstrumentEditorRequest) {
  if (!currentData || request.track.projectSessionId !== currentProjectSessionId) return null;

  return createTrackInstrumentEditorSnapshot(currentData, {
    track: {
      ...request.track,
      projectSessionId: currentProjectSessionId,
      projectRevision: currentProjectRevision,
    },
  });
}

async function applyTrackInstrumentEditorPatch(
  request: TrackInstrumentEditorPatchRequest,
): Promise<TrackInstrumentEditorPatchResult> {
  const data = currentData;
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
    projectSessionId: currentProjectSessionId,
    projectRevision: currentProjectRevision,
    defaultLayerGroupType: loadProgramSettings().projectDefaults.defaultLayerGroupType,
  });
  if (!changed) {
    return { status: 'unchanged', snapshot: currentSnapshot };
  }

  currentProjectRevision += 1;
  broadcastProjectDocumentUpdate();
  const directRealtimeUpdate = request.patch.bsbInterface
    ? createBsbRealtimeControlUpdate(
        {
          track: {
            projectSessionId: currentProjectSessionId,
            rootGroupId: request.track.rootGroupId,
            trackId: request.track.trackId,
          },
        },
        request.patch.bsbInterface,
      )
    : undefined;
  if (!directRealtimeUpdate
    && (engineBridge?.isCurrentlyPlaying() || blueLiveSession?.isRunning())) {
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
        projectSessionId: currentProjectSessionId,
        projectRevision: currentProjectRevision,
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
  if (!currentData) {
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
    projectUdos: currentData ? createProjectUdoListSnapshot(currentData) : [],
  });
}

function maybeCloseRemovedProjectEffectEditors(patch: ProjectDocumentPatch): void {
  if (!patch.mixer || !currentData) {
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
  if (!scorePatch || !currentData) return;

  if (scorePatch.type === 'removeLayerGroup') {
    closeTrackInstrumentEditorWindowsForGroup(scorePatch.groupId);
    return;
  }

  if (scorePatch.type === 'clearTrackInstrument'
    || scorePatch.type === 'replaceTrackInstrument') {
    closeTrackInstrumentEditorWindowsForTrack(
      scorePatch.track.rootGroupId,
      scorePatch.track.trackId,
    );
    return;
  }

  if (scorePatch.type !== 'removeLayer') return;
  const group = currentData.getScore().find(
    (candidate): candidate is TrackLayerGroup => (
      candidate instanceof TrackLayerGroup && candidate.getUniqueId() === scorePatch.groupId
    ),
  );
  const track = group?.[scorePatch.layerIndex];
  if (track) {
    closeTrackInstrumentEditorWindowsForTrack(group.getUniqueId(), track.getUniqueId());
  }
}

function updateWindowTitle(): void {
  if (mainWindow) {
    mainWindow.setTitle(getWindowTitle(currentFilePath));
  }
}

// ─── Render/Freeze subprocess seam ───

/** Output tab name used to stream disk-render Csound subprocess output. */
const DISK_RENDER_OUTPUT_TAB = 'Csound (Disk)';

function createCsoundExecutionSeam(
  cancellationSignal?: { cancelled: boolean },
  onOutput?: (text: string, type: 'stdout' | 'stderr') => void,
  options: { trackRenderProcess?: boolean } = {},
): RenderExecutionSeam & FreezeExecutionSeam & SoundFontExecutionSeam {
  const trackRenderProcess = options.trackRenderProcess ?? true;

  return {
    async runCsound(args: string[], cwd: string, onProgress?: (progress: number) => void, totalDuration?: number): Promise<{ exitCode: number; stderr: string; stdout: string; cancelled?: boolean }> {
      const controller = trackRenderProcess && activeRenderAbortController
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
        return { exitCode: -1, stderr: 'Blue Engine runtime service is unavailable.', stdout: '' };
      }
      return {
        exitCode: result.exitCode ?? -1,
        stderr: result.stderr || (result.state === 'failed' ? result.message : ''),
        stdout: result.stdout,
        cancelled: result.state === 'cancelled',
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
  const command = tokenizeCommand(template).map((token) => token.replaceAll('$outfile', outputPath));
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
  const withAction: RenderOperationStatus = activeRenderAction !== null
    && (status.action === undefined || status.action === null)
    ? { ...status, action: activeRenderAction }
    : status;

  if (
    withAction.kind === 'diskRender'
    && withAction.phase === 'completed'
    && withAction.action === 'play'
    && withAction.outputPath
    && !authorizeAudioFilePath(withAction.outputPath)
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

async function handleRenderToDisk(action: DiskRenderAction, requestedOperationId?: string): Promise<RenderOperationResult> {
  if (!currentData) {
    return { ok: false, operationId: '', cancelled: false, outputPath: null, error: 'No project loaded.' };
  }

  if (activeRenderOperationId) {
    return { ok: false, operationId: '', cancelled: false, outputPath: null, error: 'Another render/freeze operation is already running.' };
  }

  // One-shot Blue Engine children are isolated from the realtime ZMQ session;
  // leave active playback/Blue Live untouched while an offline operation runs.

  const projectDirectory = resolveRenderWorkingDirectory(currentFilePath, app.getPath('temp'));

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
    const props = currentData.getProjectProperties();
    const javaRuntimeClient = await runProjectOnLoad(currentData);

    // Resolve output file
    let outputFile = props.diskCompleteOverride
      ? null
      : resolveOutputFilePath(currentData, projectDirectory);

    if (!props.diskCompleteOverride && !outputFile) {
      const defaultName = props.fileName?.trim() || `${currentFilePath ? path.basename(currentFilePath, '.blue') : 'untitled'}.wav`;
      const dialogDirectory = currentFilePath
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

    const seam = createCsoundExecutionSeam(
      cancellationSignal,
      (text, type) => broadcastToWorkbenchWindows('engine-output', {
        tabName: DISK_RENDER_OUTPUT_TAB,
        text,
        type,
      }),
    );

    const renderResult = await executeRenderToDisk(
      {
        data: currentData,
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

async function handleFreezeScoreObjects(request: FreezeScoreObjectsRequest): Promise<FreezeOperationResult> {
  if (!currentData) {
    return { ok: false, operationId: '', cancelled: false, frozenCount: 0, unfrozenCount: 0, deletedFiles: [], rejectedTargets: [], error: 'No project loaded.', project: null };
  }

  if (activeRenderOperationId) {
    return { ok: false, operationId: '', cancelled: false, frozenCount: 0, unfrozenCount: 0, deletedFiles: [], rejectedTargets: [], error: 'Another render/freeze operation is already running.', project: null };
  }

  const projectDirectory = currentFilePath ? path.dirname(currentFilePath) : null;
  if (!projectDirectory) {
    return { ok: false, operationId: '', cancelled: false, frozenCount: 0, unfrozenCount: 0, deletedFiles: [], rejectedTargets: [{ selectionId: '*', reason: 'Project must be saved before freezing.' }], error: 'Project must be saved before freezing.', project: null };
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
    const javaRuntimeClient = await runProjectOnLoad(currentData);

    const result = await executeFreezeUnfreeze(
      {
        data: currentData,
        projectDirectory,
        utility: settings.utility,
        platform: process.platform,
        isCancelled: () => cancellationSignal.cancelled,
        javaScriptSession: javaScriptSession ?? undefined,
        javaRuntimeClient,
      },
      request.targets,
      operationId,
      broadcastRenderStatus,
      seam,
    );

    // Broadcast updated project if any mutations occurred
    if (result.frozenCount > 0 || result.unfrozenCount > 0) {
      currentProjectRevision++;
      broadcastProjectDocumentUpdate();
    }

    return result;
  } finally {
    finishRenderOperation(operationId);
  }
}

// ─── Cancel render operation ───

async function handleCancelRenderOperation(request: CancelRenderOperationRequest): Promise<boolean> {
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
  return currentFilePath ? path.dirname(currentFilePath) : null;
}

function getRealtimeSfDirOption(data: BlueData, projectDirectory: string | null): string | null {
  if (!projectDirectory) {
    return null;
  }

  const mediaFolder = data.getProjectProperties().mediaFolder?.trim() ?? '';
  const sfDir = path.isAbsolute(mediaFolder)
    ? mediaFolder
    : path.resolve(projectDirectory, mediaFolder.length > 0 ? mediaFolder : 'media');

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
  return Boolean(currentData);
}

function setAuditionScoreObjectAvailability(enabled: boolean): void {
  const next = Boolean(enabled && currentData);
  if (canAuditionScoreObjects === next) return;
  canAuditionScoreObjects = next;
  rebuildApplicationMenu();
}

async function canReplaceProjectWhileRenderActive(): Promise<boolean> {
  if (!activeRenderOperationId) return true;
  await dialog.showMessageBox(mainWindow!, {
    type: 'info',
    title: 'Render in Progress',
    message: 'Wait for the active render/freeze operation to finish or cancel it before changing projects.',
  });
  return false;
}

async function confirmSaveBeforeReplace(options: { quitAfterSave?: boolean } = {}): Promise<boolean> {
  if (!(await canReplaceProjectWhileRenderActive())) return false;
  if (!currentData) return true;

  const result = await dialog.showMessageBox(mainWindow!, {
    type: 'question',
    title: 'Save Changes?',
    message: 'Save changes before proceeding?',
    detail: currentFilePath
      ? `File: ${path.basename(currentFilePath)}`
      : 'This project has not been saved yet.',
    buttons: ['Save', "Don't Save", 'Cancel'],
    defaultId: 0,
    cancelId: 2,
  });

  if (result.response === 0) {
    if (options.quitAfterSave) {
      pendingQuit = true;
    }

    if (currentFilePath) {
      doSave(currentFilePath);
    } else {
      await saveFileAs();
      if (!currentFilePath) {
        if (options.quitAfterSave) {
          pendingQuit = false;
        }
        return false;
      }
    }
    return true;
  }

  if (result.response === 1) {
    if (options.quitAfterSave) {
      doQuit();
    }
    return true;
  }

  return false;
}

function rebuildApplicationMenu(): void {
  const menu = Menu.buildFromTemplate(buildApplicationMenuTemplate({
    hasLoadedProject: hasLoadedProject(),
    isRenderOperationActive: activeRenderOperationId !== null,
    canAuditionScoreObjects,
    isDarwin: process.platform === 'darwin',
    recentProjects: getRecentProjectFilesSnapshot(),
    canRevertProject: Boolean(currentFilePath),
    followPlaybackEnabled: currentFollowPlaybackEnabled,
    followPlaybackOnStartEnabled: currentFollowPlaybackOnStartEnabled,
    onNewFile: () => { void handleNewFile(); },
    onOpenFile: () => { void handleOpenFile(); },
    onOpenExampleProject: () => { void openExampleProject(); },
    onImportCsdFile: () => { void importCsdFile(); },
    onImportOrcSco: () => { void importOrcSco(); },
    onImportMidiFile: () => {
      mainWindow?.webContents.send('native-menu-command', { type: 'open-midi-import' });
    },
    onOpenRecentProject: (filePath) => { void openRecentProject(filePath); },
    onCloseProject: () => { void closeProject(); },
    onRevertProject: () => { void revertProject(); },
    onSaveFile: () => { void saveFile(); },
    onSaveFileAs: () => { void saveFileAs(); },
    onGenerateCsdToScreen: () => { void generateCsdToScreen(); },
    onGenerateRealtimeCsdToScreen: () => { void generateRealtimeCsdToScreen(); },
    onGenerateCsdToDisk: () => { void generateCsdToDisk(); },
    onRequestQuit: () => { void requestQuit(); },
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
    onReinitializeJavaScriptRuntime: () => { void reinitializeJavaScriptRuntime(); },
    onReinitializeJythonRuntime: () => { void reinitializeJythonRuntime(); },
    onFocusPanel: (panelId) => {
      // Route through the workbench window registry so an already-floating panel
      // is focused in its own OS window instead of opening a duplicate (SPEC 055 US6).
      routeFocusPanel(panelId);
    },
    onToggleDevTools: () => { mainWindow?.webContents.toggleDevTools(); },
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
    onToggleFollowPlayback: () => { currentFollowPlaybackEnabled = !currentFollowPlaybackEnabled; mainWindow?.webContents.send('native-menu-command', { type: 'toggle-follow-playback' }); rebuildApplicationMenu(); },
    onToggleFollowPlaybackOnStart: () => { currentFollowPlaybackOnStartEnabled = !currentFollowPlaybackOnStartEnabled; mainWindow?.webContents.send('native-menu-command', { type: 'toggle-follow-playback-on-render-start' }); rebuildApplicationMenu(); },
    onToggleLoopRendering: () => { mainWindow?.webContents.send('native-menu-command', { type: 'toggle-loop-rendering' }); },
    onAddMarker: () => { mainWindow?.webContents.send('native-menu-command', { type: 'add-marker' }); },
    onNavigateNextMarker: () => { mainWindow?.webContents.send('native-menu-command', { type: 'navigate-next-marker' }); },
    onNavigatePreviousMarker: () => { mainWindow?.webContents.send('native-menu-command', { type: 'navigate-previous-marker' }); },
    onRewindToStart: () => { mainWindow?.webContents.send('native-menu-command', { type: 'rewind-to-start' }); },
    onRenderStopProject: () => { mainWindow?.webContents.send('native-menu-command', { type: 'render-stop-project' }); },
    onAuditionScoreObjects: () => { mainWindow?.webContents.send('native-menu-command', { type: 'audition-score-objects' }); },
    onToggleBlueLive: () => { void blueLiveToggle(); },
    onRecompileBlueLive: () => { void blueLiveRecompile(); },
    onBlueLiveAllNotesOff: () => { void blueLiveAllNotesOff(); },
    onEditTempoMap: () => { mainWindow?.webContents.send('native-menu-command', { type: 'edit-tempo-map' }); },
    onEditMeterMap: () => { mainWindow?.webContents.send('native-menu-command', { type: 'edit-meter-map' }); },
    onRenderToDisk: () => { void handleRenderToDisk('render'); },
    onRenderToDiskAndPlay: () => { void handleRenderToDisk('play'); },
    onRenderToDiskAndOpen: () => { void handleRenderToDisk('open'); },
    onZoomIn: () => { appZoomController.execute('zoom-in'); syncAboutWindowZoom(); },
    onZoomOut: () => { appZoomController.execute('zoom-out'); syncAboutWindowZoom(); },
    onActualSize: () => { appZoomController.execute('actual-size'); syncAboutWindowZoom(); },
    onNotYetImplemented: () => { mainWindow?.webContents.send('native-menu-command', { type: 'show-not-yet-implemented' }); },
  }));

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

  console.warn(`[main] App icon not found. Tried:\n${candidates.map((c) => '  - ' + c).join('\n')}`);
  return undefined;
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: getWindowTitle(currentFilePath),
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
      const isPrimary = !!webContents
        && webContents.id === mainWindow?.webContents.id;
      const applicationUrl = webContents?.getURL() ?? '';
      const requestingUrl = details.requestingUrl ?? applicationUrl;
      return decideMidiPermission({
        permission,
        isPrimary,
        isTrustedLocation: details.isMainFrame
          && isSameApplicationLocation(requestingUrl, applicationUrl),
      });
    },
  );
  mainWindow.webContents.session.setPermissionRequestHandler(
    (webContents, permission, callback, details) => {
      const isPrimary = webContents.id === mainWindow?.webContents.id;
      callback(decideMidiPermission({
        permission,
        isPrimary,
        isTrustedLocation: details.isMainFrame
          && isSameApplicationLocation(details.requestingUrl, webContents.getURL()),
      }));
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
  engineBridge.setPlaybackErrorWarningCallback((message) => {
    void showCsoundErrorWarning(message);
  });

  engineBridge.setPlaybackCompleteCallback((stopReason) => {
    if (activeAuditionPlayback) {
      activeAuditionPlayback = false;
      return;
    }
    if (stopReason !== 'completed') return;
    if (!currentData || !currentData.isLoopRendering()) return;
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
  if (!mainWindow) return false;
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    title: 'Unsaved Library Editors',
    message: `${preview.dirtySessionIds.length} Library editor${preview.dirtySessionIds.length === 1 ? ' has' : 's have'} unsaved changes.`,
    detail: 'Save all drafts, discard them, or cancel this operation.',
    buttons: ['Save All', 'Discard', 'Cancel'],
    defaultId: 0,
    cancelId: 2,
    noLink: true,
  });
  const decision = result.response === 0 ? 'save' : result.response === 1 ? 'discard' : 'cancel';
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

  if (!currentData) {
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

    unregisterUnifiedLibraryIpc?.();
    unregisterUnifiedLibraryIpc = null;
    await unifiedLibraryService?.stop();
    unifiedLibraryService = null;

    unregisterCodeRepositoryIpc?.();
    unregisterCodeRepositoryIpc = null;
    await codeRepositoryService?.stop();
    codeRepositoryService = null;

    await midiInputCoordinator?.requestShutdown();

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

    blueLiveSession = null;
  await javaRuntimeSessionManager?.dispose();
  javaRuntimeSessionManager = null;
  disposeJavaScriptSession();

    closeEffectEditorWindowsForOwner('project');
    closeEffectEditorWindowsForOwner('library');
    closeTrackInstrumentEditorWindows();
    currentData = null;
    canAuditionScoreObjects = false;
    currentFilePath = null;
    currentProjectRevision = 0;
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
  if (!(await confirmSaveBeforeReplace())) return;
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
    ...createProjectEditorSnapshot(data, filePath, currentProjectSessionId),
    title: filePath
      ? projectProperties.title || path.basename(filePath)
      : 'Untitled',
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
  const sfDir = process.env.SFDIR && process.env.SFDIR.length > 0
    ? process.env.SFDIR
    : null;
  const rows = collectMissingAudioFiles(data, { projectDirectory, sfDir });

  if (rows.length === 0) {
    return undefined;
  }

  const session: MissingAudioAssetsSession = {
    sessionId: createMissingAudioSessionId(),
    projectSessionId: currentProjectSessionId,
    projectFilePath: filePath,
    missingFiles: rows,
  };
  setActiveMissingAudioSession(session);
  return session;
}

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

  const filePath = result.filePaths[0];

  // FR-018 parity: selecting the already-current project is a no-op (Java Blue
  // just switches to it without rerunning the dependency check). Revert uses
  // loadProjectFromDisk directly to bypass this guard.
  if (filePath === currentFilePath && currentData) {
    return false;
  }

  return loadProjectFromDisk(filePath);
}

async function openFilePath(filePath: string): Promise<boolean> {
  if (!mainWindow) return false;
  if (!(await canReplaceProjectWhileRenderActive())) return false;

  // FR-018 parity: reopening the current project is a no-op. See openFile.
  if (filePath === currentFilePath && currentData) {
    return false;
  }

  return loadProjectFromDisk(filePath);
}

/**
 * Opens the bundled examples directory in a file picker (Java Blue's "Open
 * Example Project"). The resolved examples directory seeds the dialog; the
 * selected `.blue` file is handed to the normal {@link openFilePath} load
 * path, so it participates in the same render-active guard, recent-projects
 * tracking, and project-loaded lifecycle as a regular open.
 */
async function openExampleProject(): Promise<boolean> {
  if (!mainWindow) return false;
  if (!(await confirmSaveBeforeReplace())) return false;

  const resolution = resolveExampleProjectPath({
    isPackaged: app.isPackaged,
    mainModuleDir: __dirname,
    resourcesPath: process.resourcesPath,
  });

  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Example Project',
    defaultPath: resolution.exists ? resolution.examplesPath : getConfiguredWorkDirectory(),
    filters: [{ name: 'Blue Project', extensions: ['blue'] }],
    properties: ['openFile'],
  });

  if (result.canceled || result.filePaths.length === 0) return false;

  return openFilePath(result.filePaths[0]);
}

async function importCsdFile(): Promise<boolean> {
  if (!mainWindow) return false;
  if (!hasLoadedProject()) return false;
  if (!(await canReplaceProjectWhileRenderActive())) return false;
  if (!(await confirmSaveBeforeReplace())) return false;
  if (!(await confirmLibraryDraftTransition('switchProject'))) return false;

  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select CSD File',
    defaultPath: getConfiguredWorkDirectory(),
    filters: [{ name: 'CSD File (*.csd)', extensions: ['csd', 'CSD'] }],
    properties: ['openFile'],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return false;
  }

  const filePath = result.filePaths[0];

  const modeResult = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    title: 'CSD Import Method',
    message: 'How would you like to import the score?',
    buttons: [
      'Global Score',
      'Single Sound Object',
      'Sound Object per Instrument',
      'Cancel',
    ],
    defaultId: 0,
    cancelId: 3,
  });

  if (modeResult.response === 3) {
    return false;
  }

  const modeType: CSDImportMode = modeResult.response as CSDImportMode;

  try {
    const csdText = fs.readFileSync(filePath, 'utf-8');
    const data = convertCSDtoBlue(csdText, modeType);

    await stopActiveBlueLiveBeforeProjectReplacement();
    await disposeJavaRuntimeSession();
    closeEffectEditorWindowsForOwner('project');
    closeTrackInstrumentEditorWindows();

    currentData = data;
    canAuditionScoreObjects = false;
    currentFilePath = null;
    currentProjectRevision = 0;
    currentProjectSessionId += 1;
    midiImportService.clearAll();
    getBlueLiveTriggerController().openGate();
    unifiedLibraryService?.publishProjectChanged();
    setActiveMissingAudioSession(null);
    rebuildApplicationMenu();
    updateWindowTitle();

    disposeJavaScriptSession();
    try {
      javaScriptSession = await createJavaScriptSession();
    } catch (sessionErr: unknown) {
      console.warn('[App] Failed to create JavaScript session for imported CSD:', sessionErr);
    }

    try {
      await runProjectOnLoad(data);
    } catch (sessionErr: unknown) {
      console.warn('[App] Failed to run processOnLoad for imported CSD:', sessionErr);
    }

    buildAndSendProjectLoaded(data, null);
    return true;
  } catch (err: unknown) {
    const message = `Failed to import ${path.basename(filePath)}:\n${err instanceof Error ? err.message : String(err)}`;
    await dialog.showErrorBox('Error Importing File', message);
    return false;
  }
}

async function importOrcSco(): Promise<boolean> {
  if (!mainWindow) return false;
  if (!hasLoadedProject()) return false;
  if (!(await canReplaceProjectWhileRenderActive())) return false;
  if (!(await confirmSaveBeforeReplace())) return false;
  if (!(await confirmLibraryDraftTransition('switchProject'))) return false;

  const orcResult = await dialog.showOpenDialog(mainWindow, {
    title: 'Select ORC File',
    defaultPath: getConfiguredWorkDirectory(),
    filters: [{ name: 'Csound ORC File (*.orc)', extensions: ['orc', 'ORC'] }],
    properties: ['openFile'],
  });

  if (orcResult.canceled || orcResult.filePaths.length === 0) {
    return false;
  }

  const scoResult = await dialog.showOpenDialog(mainWindow, {
    title: 'Select SCO File',
    defaultPath: getConfiguredWorkDirectory(),
    filters: [{ name: 'Csound SCO File (*.sco)', extensions: ['sco', 'SCO'] }],
    properties: ['openFile'],
  });

  if (scoResult.canceled || scoResult.filePaths.length === 0) {
    return false;
  }

  const modeResult = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    title: 'CSD Import Method',
    message: 'How would you like to import the score?',
    buttons: [
      'Global Score',
      'Single Sound Object',
      'Sound Object per Instrument',
      'Cancel',
    ],
    defaultId: 0,
    cancelId: 3,
  });

  if (modeResult.response === 3) {
    return false;
  }

  const modeType: CSDImportMode = modeResult.response as CSDImportMode;

  try {
    const orcText = fs.readFileSync(orcResult.filePaths[0], 'utf-8');
    const scoText = fs.readFileSync(scoResult.filePaths[0], 'utf-8');
    const data = convertOrcScoToBlue(orcText, scoText, modeType);

    await stopActiveBlueLiveBeforeProjectReplacement();
    await disposeJavaRuntimeSession();
    closeEffectEditorWindowsForOwner('project');
    closeTrackInstrumentEditorWindows();

    currentData = data;
    canAuditionScoreObjects = false;
    currentFilePath = null;
    currentProjectRevision = 0;
    currentProjectSessionId += 1;
    midiImportService.clearAll();
    getBlueLiveTriggerController().openGate();
    unifiedLibraryService?.publishProjectChanged();
    setActiveMissingAudioSession(null);
    rebuildApplicationMenu();
    updateWindowTitle();

    disposeJavaScriptSession();
    try {
      javaScriptSession = await createJavaScriptSession();
    } catch (sessionErr: unknown) {
      console.warn('[App] Failed to create JavaScript session for imported ORC/SCO:', sessionErr);
    }

    try {
      await runProjectOnLoad(data);
    } catch (sessionErr: unknown) {
      console.warn('[App] Failed to run processOnLoad for imported ORC/SCO:', sessionErr);
    }

    buildAndSendProjectLoaded(data, null);
    return true;
  } catch (err: unknown) {
    const message = `Failed to import ORC/SCO:\n${err instanceof Error ? err.message : String(err)}`;
    await dialog.showErrorBox('Error Importing File', message);
    return false;
  }
}

/**
 * Reads, parses, and installs a project from disk, then emits project-loaded.
 * Shared by openFile/openFilePath (which apply the same-file no-op guard) and
 * revertProject (which intentionally reloads the current path). Returns true on
 * a successful load, false otherwise.
 */
async function loadProjectFromDisk(filePath: string): Promise<boolean> {
  if (!(await canReplaceProjectWhileRenderActive())) return false;
  if (!(await confirmLibraryDraftTransition('switchProject'))) return false;
  try {
    const xml = fs.readFileSync(filePath, 'utf-8');
    const data = await BlueData.loadFromString(xml);

    await stopActiveBlueLiveBeforeProjectReplacement();
    await disposeJavaRuntimeSession();
    closeEffectEditorWindowsForOwner('project');
    closeTrackInstrumentEditorWindows();

    currentData = data;
    canAuditionScoreObjects = false;
    currentFilePath = filePath;
    currentProjectRevision = 0;
    currentProjectSessionId += 1;
    midiImportService.clearAll();
    getBlueLiveTriggerController().openGate();
    unifiedLibraryService?.publishProjectChanged();
    setActiveMissingAudioSession(null);
    rebuildApplicationMenu();
    updateWindowTitle();

    disposeJavaScriptSession();
    try {
      javaScriptSession = await createJavaScriptSession();
    } catch (sessionErr: unknown) {
      console.warn('[App] Failed to create JavaScript session:', sessionErr);
    }

    try {
      await runProjectOnLoad(data);
    } catch (sessionErr: unknown) {
      console.warn('[App] Failed to run processOnLoad:', sessionErr);
    }

    buildAndSendProjectLoaded(data, filePath);
    return true;
  } catch (err: unknown) {
    const message = `Failed to load ${path.basename(filePath)}:\n${err instanceof Error ? err.message : String(err)}`;
    if (process.env.BLUE_VERIFY_MODE === 'packaged-project') {
      process.stderr.write(`[FAIL] ${message}\n`);
    } else {
      await dialog.showErrorBox('Error Loading File', message);
    }
    return false;
  }
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
    getLoadedProject: () => currentData
      ? {
          filePath: currentFilePath,
          title: currentData.getProjectProperties().title,
        }
      : null,
    saveProjectCopy: async (savePath) => {
      if (!currentData) return false;
      try {
        fs.writeFileSync(savePath, currentData.saveToString(), 'utf8');
        await BlueData.loadFromString(fs.readFileSync(savePath, 'utf8'));
        return true;
      } catch {
        return false;
      }
    },
  });

  process.stderr.write(`${result.ok ? '[ok]' : '[FAIL]'} ${result.message}\n`);
  process.stderr.write(
    `\nPackaged project verification ${result.ok ? 'passed' : 'failed'}.\n`,
  );
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
    process.stderr.write('[FAIL] Packaged mismatch verification could not open its project or fixture.\n');
    process.exit(1);
  }
  const executableName = process.platform === 'win32' ? 'blue-engine.exe' : 'blue-engine';
  const bundledEnginePath = path.join(
    process.resourcesPath,
    'assets',
    'engine',
    executableName,
  );
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
  const result = await runtime.probe(
    { enginePathOverride: bundledEnginePath },
    { retry: true },
  );
  const passed = result.errorCode === 'ENGINE_PROTOCOL_MISMATCH' &&
    result.selection?.source === 'settings-override' &&
    currentData !== null &&
    currentFilePath === projectPath;
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

  await stopActiveBlueLiveBeforeProjectReplacement();
  await disposeJavaRuntimeSession();
  closeEffectEditorWindowsForOwner('project');
  closeTrackInstrumentEditorWindows();

  const data = new BlueData();
  const settings = loadProgramSettings();
  applyProgramSettingsToNewProject(data, settings);
  currentData = data;
  canAuditionScoreObjects = false;
  currentFilePath = null;
  currentProjectRevision = 0;
  currentProjectSessionId += 1;
  midiImportService.clearAll();
  getBlueLiveTriggerController().openGate();
  unifiedLibraryService?.publishProjectChanged();
  setActiveMissingAudioSession(null);
  rebuildApplicationMenu();
  updateWindowTitle();

  disposeJavaScriptSession();
  try {
    javaScriptSession = await createJavaScriptSession();
  } catch (sessionErr: unknown) {
    console.warn('[App] Failed to create JavaScript session for new project:', sessionErr);
  }

  try {
    await runProjectOnLoad(data);
  } catch (sessionErr: unknown) {
    console.warn('[App] Failed to run processOnLoad for new project:', sessionErr);
  }

  buildAndSendProjectLoaded(data, null);
}

async function closeProject(): Promise<void> {
  if (!mainWindow) return;

  if (!(await confirmSaveBeforeReplace())) return;
  if (!(await confirmLibraryDraftTransition('closeProject'))) return;

  // Stop any non-idle Blue Live session before clearing the canonical project.
  await stopActiveBlueLiveBeforeProjectReplacement();
  disposeJavaScriptSession();
  await disposeJavaRuntimeSession();
  currentData = null;
  canAuditionScoreObjects = false;
  currentFilePath = null;
  currentProjectRevision = 0;
  currentProjectSessionId += 1;
  midiImportService.clearAll();
  unifiedLibraryService?.publishProjectChanged();
  setActiveMissingAudioSession(null);
  rebuildApplicationMenu();
  updateWindowTitle();
  broadcastToWorkbenchWindows('project-closed', null);
}

async function revertProject(): Promise<void> {
  if (!currentFilePath) return;
  if (!(await confirmSaveBeforeReplace())) return;
  await loadProjectFromDisk(currentFilePath);
}

async function openRecentProject(filePath: string): Promise<void> {
  if (!mainWindow) return;
  if (!(await confirmSaveBeforeReplace())) return;
  await openFilePath(filePath);
}

async function saveFile(): Promise<void> {
  if (!currentData || !currentFilePath) {
    return saveFileAs();
  }
  doSave(currentFilePath);
}

async function saveFileAs(): Promise<void> {
  if (!mainWindow || !currentData) return;

  const previousProjectDir = currentFilePath ? path.dirname(currentFilePath) : null;

  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Blue Project',
    defaultPath: currentFilePath ?? getConfiguredWorkDirectoryDefaultPath('project.blue'),
    filters: [{ name: 'Blue Project', extensions: ['blue'] }],
  });

  if (result.canceled || !result.filePath) return;

  currentFilePath = result.filePath;
  doSave(currentFilePath);

  const nextProjectDir = path.dirname(currentFilePath);
  if (previousProjectDir !== nextProjectDir) {
    await disposeJavaRuntimeSession();
  }
}

function normalizeBsbSelectedPath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  if (!currentFilePath) {
    return normalized;
  }

  const projectDir = path.dirname(currentFilePath);
  const relativePath = path.relative(projectDir, filePath);
  if (!relativePath || path.isAbsolute(relativePath) || relativePath.startsWith('..')) {
    return normalized;
  }

  return relativePath.replace(/\\/g, '/');
}

function resolveBsbDefaultPath(currentValue?: string): string | undefined {
  if (!currentValue || currentValue.trim().length === 0) {
    return currentFilePath ? path.dirname(currentFilePath) : getConfiguredWorkDirectoryDefaultPath();
  }

  if (path.isAbsolute(currentValue)) {
    return currentValue;
  }

  if (!currentFilePath) {
    return getConfiguredWorkDirectoryDefaultPath(currentValue);
  }

  return path.resolve(path.dirname(currentFilePath), currentValue);
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

  if (path.isAbsolute(trimmed) || !currentFilePath) {
    return trimmed;
  }

  return path.resolve(path.dirname(currentFilePath), trimmed);
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
  if (!currentData || !currentFilePath || !currentValue || currentValue.trim().length === 0) {
    return null;
  }

  const projectDir = path.dirname(currentFilePath);
  const sourceFile = path.isAbsolute(currentValue)
    ? currentValue
    : path.resolve(projectDir, currentValue);

  if (!fs.existsSync(sourceFile) || !fs.statSync(sourceFile).isFile()) {
    return null;
  }

  const mediaFolder = currentData.getProjectProperties().mediaFolder?.trim() ?? '';
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

function doSave(filePath: string): void {
  if (!currentData) return;
  try {
    const xml = currentData.saveToString();
    fs.writeFileSync(filePath, xml, 'utf-8');
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
  } catch (err: unknown) {
    if (mainWindow) {
      mainWindow.webContents.send('save-error', err instanceof Error ? err.message : String(err));
    }
    // If save failed during quit, still quit
    if (pendingQuit) {
      pendingQuit = false;
      doQuit();
    }
  }
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
    loaded: currentData !== null,
    sessionId: currentProjectSessionId,
    label: getReplProjectLabel(currentData, currentFilePath),
    filePath: currentFilePath,
    projectDir: currentFilePath ? path.dirname(currentFilePath) : null,
  };
}

function createReplProjectDataSnapshot(): Record<string, unknown> | null {
  if (!currentData) return null;

  const properties = currentData.getProjectProperties();
  const globalOrcSco = currentData.getGlobalOrcSco();
  return {
    sessionId: currentProjectSessionId,
    filePath: currentFilePath,
    projectDir: currentFilePath ? path.dirname(currentFilePath) : null,
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
    tablesText: currentData.getTableSet().getTables(),
    scratchPad: {
      text: currentData.getScratchPadData().getScratchText(),
      wordWrapEnabled: currentData.getScratchPadData().isWordWrapEnabled(),
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
      if (currentData) {
        lastProjectOnLoadState = null;
        await runProjectOnLoad(currentData);
      }
      return { ok: true };
    } catch (error: unknown) {
      return { ok: false, error: getErrorMessage(error) };
    }
  });
}

async function reinitializeJythonRuntimeNow(): Promise<void> {
  if (!currentData) {
    throw new Error('No project loaded.');
  }
  if (!currentData.usesJavaRuntime()) {
    throw new Error('Active project does not use the Java runtime.');
  }
  if (!javaRuntimeSessionManager) {
    throw new Error('Java runtime manager is unavailable.');
  }

  await javaRuntimeSessionManager.reinitializeJython(
    currentData,
    currentProjectSessionId,
    currentFilePath,
  );
}

async function reinitializeJythonRuntime(): Promise<ScriptRuntimeReinitializeResult> {
  return enqueueReplRuntime(async () => {
    try {
      await reinitializeJythonRuntimeNow();
      if (currentData) {
        lastProjectOnLoadState = null;
        await runProjectOnLoad(currentData);
      }
      return { ok: true };
    } catch (error: unknown) {
      return { ok: false, error: getErrorMessage(error) };
    }
  });
}

async function ensureJavaRuntimeConsoleSession(): Promise<JavaRuntimeClient> {
  if (!currentData) {
    throw new Error('No project loaded.');
  }
  if (!javaRuntimeSessionManager) {
    throw new Error('Java runtime is unavailable.');
  }

  return javaRuntimeSessionManager.ensureReady(
    currentData,
    currentProjectSessionId,
    currentFilePath,
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
    return createReplOpenResult(language, currentData ? 'error' : 'unavailable', getErrorMessage(error));
  }
}

function enqueueReplRuntime<T>(operation: () => Promise<T>): Promise<T> {
  const next = replRuntimeQueue.then(operation, operation);
  replRuntimeQueue = next.then(() => undefined, () => undefined);
  return next;
}

function openReplConsole(language: ReplConsoleLanguage): Promise<ReplConsoleOpenResult> {
  return enqueueReplRuntime(() => openReplConsoleNow(language));
}

function createReplEvaluationFailure(
  language: ReplConsoleLanguage,
  message: string,
  projectSessionId = currentProjectSessionId,
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
    return createReplEvaluationFailure(language, 'No project loaded.', runtimeContext.project.sessionId);
  }

  const startedAt = Date.now();
  const client = await ensureJavaRuntimeConsoleSession();
  const bindings = {
    blueData: runtimeContext.data,
    blueProjectDir: runtimeContext.projectDir,
    blueProject: runtimeContext.project,
  };
  const response = language === 'python'
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

async function evaluateReplConsole(request: ReplConsoleEvaluateRequest): Promise<ReplConsoleEvaluateResult> {
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
        if (!javaRuntimeSessionManager || !currentData) throw new Error('Java runtime is unavailable.');
        await javaRuntimeSessionManager.reinitializeClojure(
          currentData,
          currentProjectSessionId,
          currentFilePath,
        );
      }

      if (currentData) {
        lastProjectOnLoadState = null;
        await runProjectOnLoad(currentData);
      }

      return {
        ...createReplOpenResult(request.language, 'ready'),
        message: `${request.language} interpreter reinitialized.`,
      };
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      return {
        ...createReplOpenResult(request.language, currentData ? 'error' : 'unavailable', message),
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

  return javaRuntimeSessionManager.ensureReady(data, currentProjectSessionId, currentFilePath);
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
    projectSessionId: currentProjectSessionId,
    javaScriptSession,
    jythonStateRevision,
  };
}

function projectOnLoadStateMatches(
  current: ProjectOnLoadState | null,
  next: ProjectOnLoadState,
): boolean {
  return current !== null
    && current.projectSessionId === next.projectSessionId
    && current.javaScriptSession === next.javaScriptSession
    && current.jythonStateRevision === next.jythonStateRevision;
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
  if (!currentData) {
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
  if (!currentData) {
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
  data: BlueData | null = currentData,
  forceProcessOnLoad = false,
): Promise<boolean> {
  if (!engineBridge || !data || !mainWindow) return false;
  const canonicalDataAtStart = currentData;
  const projectSessionAtStart = currentProjectSessionId;
  activeAuditionPlayback = data !== currentData;

  try {
    broadcastToWorkbenchWindows('playback-status', {
      status: 'starting',
      message: 'Preparing playback...',
      renderStartTime: data.getRenderStartTime(),
      auditioning: data !== currentData,
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
      currentProjectSessionId !== projectSessionAtStart
      || currentData !== canonicalDataAtStart
      || (data !== currentData && !activeAuditionPlayback)
    ) {
      activeAuditionPlayback = false;
      return false;
    }

    const success = await engineBridge.playCSD(
      csd,
      parameters,
      automationTiming,
      projectDirectory,
      extraRealtimeOptions,
    );

    if (!success) {
      activeAuditionPlayback = false;
      broadcastToWorkbenchWindows('playback-status', {
        status: 'error',
        message: 'Failed to start playback',
      });
      return false;
    }

    return true;
  } catch (err: unknown) {
    activeAuditionPlayback = false;
    broadcastToWorkbenchWindows('playback-error', err instanceof Error ? err.message : String(err));
    return false;
  }
}

async function auditionScoreObjects(objectIds: unknown): Promise<boolean> {
  const data = currentData;
  const projectSessionAtStart = currentProjectSessionId;
  if (!data || !engineBridge || !mainWindow || activeRenderOperationId) return false;
  if (!Array.isArray(objectIds) || objectIds.length === 0 || objectIds.some((id) => typeof id !== 'string')) {
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
    if (currentData !== data || currentProjectSessionId !== projectSessionAtStart) return false;

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

async function blueLiveToggle(): Promise<ReturnType<BlueLiveEngineSession['start'] | BlueLiveEngineSession['stop']> | { status: string; running: boolean; sessionId: number; message?: string }> {
  if (!blueLiveSession || !currentData) {
    return { status: 'idle', running: false, sessionId: 0, message: 'No project loaded' };
  }

  if (blueLiveSession.isRunning()) {
    return blueLiveSession.stop();
  }

  // Start/recompile is a runtime lifecycle change, not a project edit: do not
  // advance the document revision. The Blue Live engine session generation
  // (sessionId) is the independent runtime fence key.
  mainWindow?.webContents.send('engine-output-reset', { tabName: 'Csound (Blue Live)' });
  mainWindow?.webContents.send('engine-output-select', { tabName: 'Csound (Blue Live)' });
  return blueLiveSession.start(currentData, currentProjectRevision, getCurrentProjectDirectory(), javaScriptSession ?? undefined);
}

async function blueLiveRecompile(): Promise<void> {
  if (!blueLiveSession || !currentData) return;
  // Start/recompile is a runtime lifecycle change, not a project edit: do not
  // advance the document revision.
  mainWindow?.webContents.send('engine-output-reset', { tabName: 'Csound (Blue Live)' });
  mainWindow?.webContents.send('engine-output-select', { tabName: 'Csound (Blue Live)' });
  await blueLiveSession.recompile(currentData, currentProjectRevision, getCurrentProjectDirectory(), javaScriptSession ?? undefined);
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
  await stopBlueLiveForProjectReplacement(
    getBlueLiveTriggerController(),
    blueLiveSession,
  );
}

async function generateCsdToScreen(): Promise<void> {
  if (!mainWindow) return;
  if (!currentData) {
    notifyNoProjectLoaded('generated-csd-error');
    return;
  }
  try {
    await ensureJavaScriptEngine();
    const javaRuntimeClient = await runProjectOnLoad(currentData);
    // "Generate CSD to Screen" mirrors Java's GenerateCsdToScreenAction, which
    // generates a disk-profile CSD (isRealTime=false).
    const csdText = await generateDiskCsdForScreen(
      currentData,
      javaScriptSession ?? undefined,
      javaRuntimeClient,
    );
    mainWindow.webContents.send('generated-csd', csdText);
  } catch (err) {
    mainWindow?.webContents.send('generated-csd-error', err instanceof Error ? err.message : String(err));
  }
}

async function generateRealtimeCsdToScreen(): Promise<void> {
  if (!mainWindow) return;
  if (!currentData) {
    notifyNoProjectLoaded('generated-csd-error');
    return;
  }
  try {
    await ensureJavaScriptEngine();
    const javaRuntimeClient = await runProjectOnLoad(currentData);
    // "Generate Realtime CSD to Screen" mirrors Java's
    // GenerateRealtimeCsdToScreenAction, which generates a realtime-profile
    // CSD (isRealTime=true).
    const csdText = await generateRealtimeCsdForScreen(
      currentData,
      javaScriptSession ?? undefined,
      javaRuntimeClient,
    );
    mainWindow.webContents.send('generated-csd', csdText);
  } catch (err) {
    mainWindow?.webContents.send('generated-csd-error', err instanceof Error ? err.message : String(err));
  }
}

async function generateCsdToDisk(): Promise<void> {
  if (!mainWindow) return;
  if (!currentData) {
    notifyNoProjectLoaded('generated-csd-error');
    return;
  }
  try {
    await ensureJavaScriptEngine();
    const javaRuntimeClient = await runProjectOnLoad(currentData);
    await saveGeneratedCsdToDisk({
      currentData,
      currentFilePath,
      workDirectory: getConfiguredWorkDirectory(),
      mainWindow,
      session: javaScriptSession ?? undefined,
      runtimeClient: javaRuntimeClient ?? undefined,
    });
  } catch (err) {
    mainWindow?.webContents.send('generated-csd-error', err instanceof Error ? err.message : String(err));
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
    !session
    || session.sessionId !== request.sessionId
    || session.projectSessionId !== currentProjectSessionId
    || !currentData
  ) {
    return { ok: false, changed: false, stale: true };
  }

  if (!request.replacements || request.replacements.length === 0) {
    clearMissingAudioSession(session.sessionId);
    return { ok: true, changed: false };
  }

  const projectDirectory = currentFilePath ? path.dirname(currentFilePath) : null;
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

  const changed = applyReplacementMappings(currentData, mappings);
  clearMissingAudioSession(session.sessionId);

  if (!changed) {
    return { ok: true, changed: false };
  }

  currentProjectRevision += 1;
  const project = createProjectEditorSnapshot(currentData, currentFilePath, currentProjectSessionId);
  return { ok: true, changed: true, project };
}

ipcMain.handle('open-file', async () => {
  const loaded = await openFile();
  return loaded ? currentFilePath : null;
});

ipcMain.handle('start-midi-import', async (): Promise<MidiImportStartResult> => {
  if (!mainWindow || !hasLoadedProject()) {
    return { status: 'error', message: 'No project is loaded.' };
  }
  if (!(await canReplaceProjectWhileRenderActive())) {
    return { status: 'cancelled' };
  }
  return midiImportService.start();
});

ipcMain.handle('cancel-midi-import', (_event, token: string): void => {
  midiImportService.clear(token);
});

ipcMain.handle(
  'commit-midi-import',
  async (_event, token: string, settings: unknown): Promise<MidiImportCommitResult> => {
    const validation = midiImportService.validateCommit(token, settings);
    if (!validation.ok) {
      return { status: 'error', message: validation.message };
    }

    try {
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

      if (!(await canReplaceProjectWhileRenderActive())) {
        return { status: 'cancelled' };
      }
      if (!(await confirmLibraryDraftTransition('switchProject'))) {
        return { status: 'cancelled' };
      }
      if (!(await confirmSaveBeforeReplace())) {
        return { status: 'cancelled' };
      }

      const currentValidation = midiImportService.validateCommit(token, settings);
      if (!currentValidation.ok) {
        return { status: 'error', message: currentValidation.message };
      }

      await stopActiveBlueLiveBeforeProjectReplacement();
      await disposeJavaRuntimeSession();
      closeEffectEditorWindowsForOwner('project');
      closeTrackInstrumentEditorWindows();

      currentData = data;
      canAuditionScoreObjects = false;
      currentFilePath = null;
      currentProjectRevision = 0;
      currentProjectSessionId += 1;
      midiImportService.clearAll();
      getBlueLiveTriggerController().openGate();
      unifiedLibraryService?.publishProjectChanged();
      setActiveMissingAudioSession(null);
      rebuildApplicationMenu();
      updateWindowTitle();

      disposeJavaScriptSession();
      try {
        javaScriptSession = await createJavaScriptSession();
      } catch (sessionErr: unknown) {
        console.warn('[App] Failed to create JavaScript session for imported MIDI:', sessionErr);
      }

      try {
        await runProjectOnLoad(data);
      } catch (sessionErr: unknown) {
        console.warn('[App] Failed to run processOnLoad for imported MIDI:', sessionErr);
      }

      buildAndSendProjectLoaded(data, null);
      const project = getCurrentProjectDocument();
      if (!project) {
        return { status: 'error', message: 'MIDI project was installed but could not be read back.' };
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

ipcMain.handle('open-file-path', async (_event, filePath: string) => {
  if (!(await confirmSaveBeforeReplace())) return null;
  const loaded = await openFilePath(filePath);
  return loaded ? currentFilePath : null;
});

ipcMain.handle('new-file', async () => {
  await newFile();
  return currentFilePath;
});

ipcMain.handle('missing-audio-assets:choose-replacement', async (_event, request: MissingAudioAssetsChooseRequest) => {
  return chooseMissingAudioReplacement(request);
});

ipcMain.handle('missing-audio-assets:resolve', async (_event, request: MissingAudioAssetsResolveRequest) => {
  return resolveMissingAudioAssets(request);
});

ipcMain.handle('missing-audio-assets:dismiss', async (_event, request: { sessionId: string }) => {
  clearMissingAudioSession(request.sessionId);
  return { ok: true };
});

ipcMain.handle('open-bsb-file-selector', async (_event, currentValue?: string) => {
  return openBsbFileSelector(currentValue);
});

ipcMain.handle('set-bsb-file-selector-path', async (_event, filePath: string) => {
  return normalizeBsbFileSelectorPath(filePath);
});

ipcMain.handle('copy-bsb-file-selector-to-media-folder', async (_event, currentValue?: string) => {
  return copyBsbFileSelectorToMediaFolder(currentValue);
});

ipcMain.handle('save-file', async () => {
  await saveFile();
  return currentFilePath;
});

ipcMain.handle('save-file-as', async () => {
  await saveFileAs();
  return currentFilePath;
});

ipcMain.handle('toggle-play', async () => {
  return togglePlay();
});

ipcMain.handle('restart-playback', async () => {
  return restartPlayback();
});

ipcMain.handle('stop-playback', async () => {
  await stopPlayback();
});

ipcMain.handle('audition-score-objects', async (_event, objectIds: unknown) => {
  return auditionScoreObjects(objectIds);
});

ipcMain.on('sync-audition-score-object-availability', (event, enabled: unknown) => {
  if (event.sender !== mainWindow?.webContents) return;
  setAuditionScoreObjectAvailability(enabled === true);
});

ipcMain.on('sync-follow-playback-state', (_event, enabled: boolean) => {
  if (currentFollowPlaybackEnabled !== enabled) {
    currentFollowPlaybackEnabled = enabled;
    rebuildApplicationMenu();
  }
});

ipcMain.handle('generate-csd-to-screen', async () => {
  await generateCsdToScreen();
});

ipcMain.handle('generate-realtime-csd-to-screen', async () => {
  await generateRealtimeCsdToScreen();
});

ipcMain.handle('generate-csd-to-disk', async () => {
  await generateCsdToDisk();
});

ipcMain.handle('get-project-info', () => {
  if (!currentData) return null;
  return {
    title: currentData.getProjectProperties().title,
    author: currentData.getProjectProperties().author,
    sampleRate: currentData.getProjectProperties().sampleRate,
    ksmps: currentData.getProjectProperties().ksmps,
    nchnls: currentData.getProjectProperties().nchnls,
    version: currentData.getVersion(),
  };
});

ipcMain.handle(SOUND_FONT_FILE_SELECT_CHANNEL, async (): Promise<string | null> => {
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
  return result.canceled || result.filePaths.length === 0
    ? null
    : result.filePaths[0] ?? null;
});

ipcMain.handle(SOUND_FONT_INSPECT_CHANNEL, async (_event, filePath: unknown) => {
  if (typeof filePath !== 'string' || filePath.trim().length === 0) {
    throw new Error('SoundFont file path is required.');
  }

  const seam = createCsoundExecutionSeam(undefined, undefined, {
    trackRenderProcess: false,
  });
  return inspectSoundFont(
    filePath,
    seam,
    app.getPath('temp'),
  );
});

ipcMain.handle('set-recent-files', (_event, files: string[]) => {
  if (!Array.isArray(files)) {
    return getRecentProjectFilesSnapshot();
  }

  syncRecentProjectFiles(files.filter((filePath) => typeof filePath === 'string'));
  return getRecentProjectFilesSnapshot();
});

ipcMain.handle('get-recent-files', () => {
  return getRecentProjectFilesSnapshot();
});

ipcMain.handle('import-blue-udo', async () => {
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

ipcMain.handle('import-arrangement-instrument', async (): Promise<string | null> => {
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

ipcMain.handle('import-csound-udo', async () => {
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

ipcMain.handle('import-preset-file', async (): Promise<string | null> => {
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

ipcMain.handle('import-score-object', async (): Promise<ScoreObjectImportResult | null> => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    defaultPath: getConfiguredWorkDirectory(),
    filters: [{ name: 'Blue Sound Object File', extensions: ['blueObject', 'xml'] }],
    properties: ['openFile'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const xml = await fs.promises.readFile(result.filePaths[0], 'utf-8');
  const data = currentData;
  if (!data) return { ok: false, error: 'No project is loaded.' };
  const score = data.getScore();
  return prepareScoreObjectImport(
    xml,
    score.getTimeContext(),
    String(score.getTimeState().getTimeDisplay()),
  );
});

ipcMain.handle('read-csoundrc', () => {
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

ipcMain.handle('write-csoundrc', (_event, text: string) => {
  const csoundRcEnv = process.env.CSOUNDRC;
  const filePath = csoundRcEnv || path.join(app.getPath('home'), '.csound7rc');
  fs.writeFileSync(filePath, text ?? '', 'utf-8');
  return { success: true, filePath };
});

ipcMain.handle('export-blue-udo', async (_event, xmlText: string) => {
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

ipcMain.handle('export-arrangement-instrument', async (_event, assignmentId: unknown): Promise<void> => {
  if (!mainWindow || !currentData || typeof assignmentId !== 'string') return;
  const instrument = currentData.getArrangement().getInstrumentById(assignmentId);
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
});

ipcMain.handle('export-csound-udo', async (_event, codeText: string, udoName: string) => {
  if (!mainWindow) return;
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: getConfiguredWorkDirectoryDefaultPath(`${udoName}.udo`),
    filters: [{ name: 'Csound UDO File', extensions: ['udo', 'inc'] }],
  });
  if (result.canceled || !result.filePath) return;
  await fs.promises.writeFile(result.filePath, codeText, 'utf-8');
});

ipcMain.handle('export-preset-file', async (_event, xmlText: string, presetName: string) => {
  if (!mainWindow || typeof xmlText !== 'string') return;
  const safeName = typeof presetName === 'string'
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
});

ipcMain.handle('export-score-object', async (_event, xmlText: string, objectName: string): Promise<ScoreObjectExportResult> => {
  if (!mainWindow) return { status: 'error', error: 'The main window is not available.' };
  if (typeof xmlText !== 'string' || xmlText.trim().length === 0) {
    return { status: 'error', error: 'The selected Sound Object has no XML to export.' };
  }
  const validation = validateScoreObjectExport(xmlText);
  if (!validation.ok) return { status: 'error', error: validation.error };

  const safeName = typeof objectName === 'string'
    ? objectName.trim().replace(/[\\/:*?"<>|]/g, '_') || 'SoundObject'
    : 'SoundObject';
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: getConfiguredWorkDirectoryDefaultPath(`${safeName}.xml`),
    filters: [{ name: 'Blue SoundObject XML', extensions: ['xml'] }],
  });
  if (result.canceled || !result.filePath) return { status: 'cancelled' };
  await fs.promises.writeFile(result.filePath, xmlText, 'utf-8');
  return { status: 'saved' };
});

// ─── Blue Live IPC Handlers ───

ipcMain.handle('blue-live:toggle', async () => {
  if (!blueLiveSession || !currentData) {
    return { status: 'idle', running: false, sessionId: 0, message: 'No project loaded' };
  }
  if (blueLiveSession.isRunning()) {
    return blueLiveSession.stop();
  }
  // Start is a runtime lifecycle change, not a project edit.
  mainWindow?.webContents.send('engine-output-reset', { tabName: 'Csound (Blue Live)' });
  mainWindow?.webContents.send('engine-output-select', { tabName: 'Csound (Blue Live)' });
  return blueLiveSession.start(currentData, currentProjectRevision, getCurrentProjectDirectory(), javaScriptSession ?? undefined);
});

ipcMain.handle('blue-live:stop', async () => {
  if (!blueLiveSession) {
    return { status: 'idle', running: false, sessionId: 0 };
  }
  return blueLiveSession.stop();
});

ipcMain.handle('blue-live:recompile', async () => {
  if (!blueLiveSession || !currentData) {
    return { status: 'idle', running: false, sessionId: 0, message: 'No project loaded' };
  }
  // Recompile is a runtime lifecycle change, not a project edit.
  mainWindow?.webContents.send('engine-output-reset', { tabName: 'Csound (Blue Live)' });
  mainWindow?.webContents.send('engine-output-select', { tabName: 'Csound (Blue Live)' });
  return blueLiveSession.recompile(currentData, currentProjectRevision, getCurrentProjectDirectory(), javaScriptSession ?? undefined);
});

ipcMain.handle('blue-live:all-notes-off', async () => {
  if (!blueLiveSession) {
    return { ok: false, message: 'Blue Live not initialized' };
  }
  return blueLiveSession.sendAllNotesOff();
});

ipcMain.handle('blue-live:trigger-note', async (_event, request: BlueLiveNoteTriggerRequest): Promise<BlueLiveNoteTriggerResult> => {
  if (!blueLiveSession || !currentData) {
    return { ok: false, message: 'No project loaded' };
  }

  return blueLiveSession.triggerNote(request);
});

ipcMain.handle('blue-live:trigger-objects', async (_event, request: LegacyBlueLiveTriggerRequest): Promise<LegacyBlueLiveTriggerResult> => {
  const controller = getBlueLiveTriggerController();
  return controller.trigger(request);
});

ipcMain.handle('blue-live:get-status', async () => {
  if (!blueLiveSession) {
    return { status: 'idle', running: false, sessionId: 0 };
  }
  return blueLiveSession.getStatus();
});

// ─── Settings IPC Handler ───

ipcMain.handle(SETTINGS_CONFIRM_CLOSE_CHANNEL, async (event): Promise<SettingsClosePromptResponse> => {
  const owner = BrowserWindow.fromWebContents(event.sender);
  const options = {
    type: 'question' as const,
    title: 'Unsaved Settings',
    message: 'You have unsaved settings.',
    detail: 'Do you want to apply them before closing Settings?',
    buttons: ['Yes', 'No', 'Cancel'],
    defaultId: 0,
    cancelId: 2,
    noLink: true,
  };
  const result = owner && !owner.isDestroyed()
    ? await dialog.showMessageBox(owner, options)
    : await dialog.showMessageBox(options);
  return result.response === 0 ? 'yes' : result.response === 1 ? 'no' : 'cancel';
});

ipcMain.on(SETTINGS_CLOSE_RESPONSE_CHANNEL, (_event, resolution: unknown) => {
  if (resolution === 'allow' || resolution === 'cancel') {
    resolveSettingsWindowClose(resolution as SettingsCloseResolution);
  }
});

ipcMain.handle('settings:open', async () => {
  if (!mainWindow) return;
  openSettingsWindow(mainWindow, {
    initialZoomFactor: appZoomController.getCurrentFactor(),
  });
});

ipcMain.handle(APP_METADATA_GET_CHANNEL, () => resolveAppMetadata({
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
}));

ipcMain.handle(ABOUT_WINDOW_CLOSE_CHANNEL, (event) => closeAboutWindow(event.sender));

// ─── Program Settings IPC Handlers ───

ipcMain.handle('program-settings:get', () => {
  return loadProgramSettings();
});

ipcMain.handle('program-settings:save', (_event, snapshot: ProgramSettingsSnapshot) => {
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
    result.ok
    && result.snapshot
    && oscControlService
    && previousOscPort !== result.snapshot.osc.preferredPort
  ) {
    void oscControlService.restart(result.snapshot.osc);
  }
  return result;
});

ipcMain.handle(
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

ipcMain.handle(
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

ipcMain.handle('program-settings:reset-panel', (_event, panel: string) => {
  const snapshot = resetPanel(panel as any);
  if (panel === 'midi' && midiInputCoordinator) {
    midiInputCoordinator.onProgramSettingsSaved(snapshot);
  }
  if (panel === 'osc' && oscControlService) {
    void oscControlService.restart(snapshot.osc);
  }
  return snapshot;
});

ipcMain.handle(OSC_CONTROL_GET_SNAPSHOT_CHANNEL, () => {
  return oscControlService?.getSnapshot()
    ?? createInitialOscServerRuntimeSnapshot(loadProgramSettings().osc);
});

ipcMain.handle('program-settings:usage-matrix', () => {
  return buildUsageMatrix();
});

ipcMain.handle('program-settings:sync-legacy-renderer-settings', (_event, legacy: any) => {
  return syncLegacyRendererSettings(legacy);
});

// ─── Window Layout IPC Handlers ───

ipcMain.handle('window-layout:get', () => {
  return loadWindowLayoutSettings();
});

ipcMain.handle(WINDOW_LAYOUT_DISPLAY_WORK_AREAS_CHANNEL, () => {
  return getAvailableDisplayWorkAreas();
});

ipcMain.handle('window-layout:update', (_event, request: import('../shared/window-layout-settings').WindowLayoutUpdateRequest) => {
  return updateWindowLayout(request);
});

ipcMain.handle('window-layout:reset', () => {
  return resetWindowLayout();
});

ipcMain.handle('open-effect-editor', async (_event, request: EffectEditorRequest) => {
  openEffectEditorWindow(mainWindow, request, {
    initialZoomFactor: appZoomController.getCurrentFactor(),
  });
});

ipcMain.handle('open-effect-interface', async (_event, request: EffectEditorRequest) => {
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

ipcMain.handle('get-effect-editor-document', (_event, request: EffectEditorRequest) => {
  if (request.ownerType === 'library') {
    return null;
  }

  return getProjectEffectEditorSnapshot(request);
});

ipcMain.handle('update-effect-editor-document', (_event, request: EffectEditorPatchRequest) => {
  return applyProjectEffectEditorPatch(request);
});

ipcMain.handle('focus-effect-editor', (_event, request: EffectEditorRequest) => {
  return focusEffectEditorWindow(request);
});

ipcMain.handle('open-track-instrument-editor', async (_event, request: TrackInstrumentEditorRequest) => {
  if (!isTrackInstrumentEditorRequest(request)
    || !trackInstrumentRequestIsCurrent(request)
    || !getTrackInstrumentEditorSnapshot(request)) return;
  openTrackInstrumentEditorWindow(mainWindow, request, {
    initialZoomFactor: appZoomController.getCurrentFactor(),
  });
});

ipcMain.handle('focus-track-instrument-editor', (_event, request: TrackInstrumentEditorRequest) => {
  if (!isTrackInstrumentEditorRequest(request)
    || !trackInstrumentRequestIsCurrent(request)) return false;
  return focusTrackInstrumentEditorWindow(request);
});

ipcMain.handle('get-track-instrument-editor-document', (_event, request: TrackInstrumentEditorRequest) => {
  if (!isTrackInstrumentEditorRequest(request)) return null;
  return getTrackInstrumentEditorSnapshot(request);
});

ipcMain.handle('update-track-instrument-editor-document', (_event, request: TrackInstrumentEditorPatchRequest) => {
  if (!isTrackInstrumentEditorPatchRequest(request)) {
    return { status: 'unavailable', snapshot: null } satisfies TrackInstrumentEditorPatchResult;
  }
  return applyTrackInstrumentEditorPatch(request);
});

// ─── Evaluate Code IPC Handler ───

ipcMain.handle('engine:evaluate-code', async (_event, request: { editorKind: string; text: string; sourcePanelId: string }) => {
  const trimmed = request.text?.trim();
  if (!trimmed) {
    return { routedTo: 'none', ok: false, message: 'No text selected' };
  }

  if (blueLiveSession?.isRunning()) {
    if (request.editorKind === 'orc') {
      return { ...await blueLiveSession.evaluateOrchestra(trimmed), routedTo: 'blueLive' as const };
    } else {
      return { ...await blueLiveSession.sendScore(trimmed), routedTo: 'blueLive' as const };
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
      return { routedTo: 'realtime', ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  }

  return { routedTo: 'none', ok: false, message: 'No engine running' };
});

/**
 * Synchronize real-time parameter changes to active engine sessions.
 */
function syncActiveRuntimeChannel(name: string, value: number): Promise<void> {
  return syncRuntimeChannel(name, value, engineBridge, blueLiveSession);
}

async function syncEngineWithProjectPatch(
  data: BlueData,
  patch: ProjectDocumentPatch,
  scoreAutomationParameterIds: Set<string> = new Set(),
) {
  if (engineBridge?.isCurrentlyPlaying() && scoreAutomationParameterIds.size > 0) {
    await syncScoreAutomationParametersToEngine(
      data,
      scoreAutomationParameterIds,
      engineBridge,
      buildAutomationRuntimeTimingContext(data),
    );
  }

  if (engineBridge?.isCurrentlyPlaying() && patch.mixer) {
    const mixerPatch = patch.mixer;

    if (mixerPatch.type === 'updateChannel') {
      const channel = getProjectMixerChannelBySnapshotId(mixerPatch.channelId);
      if (channel) {
        const levelParam = channel.getLevelParameter();
        const varName = levelParam.getCompilationVarName();
        if (varName && mixerPatch.patch.level !== undefined) {
          await engineBridge.setChannel(varName, mixerPatch.patch.level);
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
    }
  }

  const scorePatch = patch.score;
  if (scorePatch?.type === 'updateTrackInstrument') {
    const group = data.getScore().find(
      (candidate): candidate is TrackLayerGroup => (
        candidate instanceof TrackLayerGroup
        && candidate.getUniqueId() === scorePatch.track.rootGroupId
      ),
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

ipcMain.handle('get-project-document', () => {
  return getCurrentProjectDocument();
});

ipcMain.handle('commit-project-document-patches', async (_event, patches: ProjectDocumentPatch[]) => {
  if (!currentData) {
    throw new Error('No project loaded');
  }

  if (!Array.isArray(patches) || patches.length === 0) {
    throw new Error('Empty project document patch batch');
  }

  let javaRuntimeDependenciesChanged = false;
  let anyCanonicalMutation = false;

  for (const patch of patches) {
    const clojureDependenciesChanged = patch.clojureProject
      ? clojureProjectPatchChangesRuntimeDependencies(currentData, patch.clojureProject)
      : false;
    const scoreAutomationParameterIds = collectAffectedProjectScoreAutomationParameterIds(currentData, patch);
    maybeCloseRemovedProjectEffectEditors(patch);
    maybeCloseRemovedTrackInstrumentEditors(patch);
    const changed = applyProjectDocumentPatch(currentData, patch, {
      projectSessionId: currentProjectSessionId,
      projectRevision: currentProjectRevision,
      defaultLayerGroupType: loadProgramSettings().projectDefaults.defaultLayerGroupType,
    });
    if (changed) {
      anyCanonicalMutation = true;
      for (const id of collectAffectedProjectScoreAutomationParameterIds(currentData, patch)) {
        scoreAutomationParameterIds.add(id);
      }
    } else {
      scoreAutomationParameterIds.clear();
    }
    javaRuntimeDependenciesChanged = javaRuntimeDependenciesChanged || (changed && clojureDependenciesChanged);
    if (changed && (engineBridge?.isCurrentlyPlaying() || blueLiveSession?.isRunning())) {
      void syncEngineWithProjectPatch(currentData, patch, scoreAutomationParameterIds).catch((error) => {
        console.error('[main] Failed to sync engine with project patch:', error);
      });
    }
  }

  if (anyCanonicalMutation) {
    currentProjectRevision += 1;
  }
  if (javaRuntimeDependenciesChanged) {
    currentProjectSessionId += 1;
    midiImportService.clearAll();
    await disposeJavaRuntimeSession();
  }
  if (anyCanonicalMutation) {
    broadcastProjectDocumentUpdate();
    unifiedLibraryService?.publishProjectChanged();
  }
  const receipt: ProjectDocumentCommitReceipt = {
    revision: currentProjectRevision,
    sessionId: currentProjectSessionId,
    changed: anyCanonicalMutation,
  };
  return receipt;
});

ipcMain.handle('read-audio-file-bytes', async (_event, filePath: string): Promise<ArrayBuffer | null> => {
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
});

ipcMain.handle('read-authorized-audio-file-bytes', async (_event, filePath: string): Promise<ArrayBuffer | null> => {
  const resolvedFilePath = resolveAudioFilePathForRead(filePath);
  return resolvedFilePath ? readAuthorizedAudioFileBytes(resolvedFilePath) : null;
});

ipcMain.handle('open-audio-file', async (): Promise<string | null> => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Audio File',
    defaultPath: getConfiguredWorkDirectory(),
    properties: ['openFile'],
    filters: [
      {
        name: 'Audio Files',
        extensions: [
          'wav', 'wave', 'aif', 'aiff', 'mp3', 'ogg', 'oga', 'flac', 'au',
          'm4a', 'w64', 'opus', 'weba',
        ],
      },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const filePath = result.filePaths[0];
  return filePath && authorizeAudioFilePath(filePath) ? filePath : null;
});

ipcMain.handle('get-audio-file-stat', async (
  _event,
  filePath: string,
): Promise<{ size: number; mtime: number } | null> => {
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
});

ipcMain.handle('get-score-object-editor-document', (_event, request: ScoreObjectEditorRequest): ScoreObjectEditorDocumentSnapshot | null => {
  if (!currentData) return null;
  return createScoreObjectEditorDocument(currentData, request);
});

ipcMain.handle('get-named-chain-names', (): string[] => {
  if (!currentData) return [];
  return currentData.getNoteProcessorChainMap().getChainNames();
});

ipcMain.handle('get-named-chain', (_event, name: string): NoteProcessorChainSnapshot | null => {
  if (!currentData) return null;
  const chain = currentData.getNoteProcessorChainMap().getNoteProcessorChain(name);
  if (!chain) return null;
  return createNoteProcessorChainSnapshot(chain);
});

ipcMain.handle('get-nested-poly-object-snapshot', (_event, location: ScoreObjectLocationRef): PolyObjectLayerGroupSnapshot | null => {
  if (!currentData) return null;
  return createNestedPolyObjectSnapshot(currentData, location);
});

async function runScoreObjectTestRequest(
  request: ScoreObjectEditorRequest,
): Promise<ScoreObjectTestResult> {
  let javaRuntimeClient: JavaRuntimeClient | null = null;

  try {
    if (currentData) {
      javaRuntimeClient = await runProjectOnLoad(currentData);
    }
  } catch (error) {
    return {
      ok: false,
      output: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }

  return testScoreObject(currentData, request, {
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
  ipcMain.handle(channel, (_event, request: ScoreObjectEditorRequest) => (
    runScoreObjectTestRequest(request)
  ));
}

async function runPythonInstrumentTestRequest(
  request: PythonInstrumentTestRequest,
): Promise<PythonInstrumentTestResult> {
  let javaRuntimeClient: JavaRuntimeClient | null = null;

  try {
    if (currentData) {
      javaRuntimeClient = await runProjectOnLoad(currentData);
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

ipcMain.handle('test-python-instrument', (_event, request: PythonInstrumentTestRequest) => (
  runPythonInstrumentTestRequest(request)
));

ipcMain.handle(
  REPL_CONSOLE_OPEN_CHANNEL,
  async (_event, request: ReplConsoleOpenRequest): Promise<ReplConsoleOpenResult> => {
    if (!isReplConsoleLanguage(request?.language)) {
      return createReplOpenResult('javascript', 'error', 'Invalid console language.');
    }
    return openReplConsole(request.language);
  },
);

ipcMain.handle(
  REPL_CONSOLE_EVALUATE_CHANNEL,
  async (_event, request: ReplConsoleEvaluateRequest): Promise<ReplConsoleEvaluateResult> =>
    evaluateReplConsole(request),
);

ipcMain.handle(
  REPL_CONSOLE_REINITIALIZE_CHANNEL,
  async (_event, request: ReplConsoleReinitializeRequest): Promise<ReplConsoleReinitializeResult> =>
    reinitializeReplConsole(request),
);

ipcMain.handle(
  REPL_CONSOLE_CLOSE_CHANNEL,
  (_event, _request: ReplConsoleCloseRequest): ReplConsoleCloseResult => ({ ok: true }),
);

ipcMain.handle(
  JAVASCRIPT_RUNTIME_REINITIALIZE_CHANNEL,
  async (): Promise<ScriptRuntimeReinitializeResult> => reinitializeJavaScriptRuntime(),
);

ipcMain.handle('java-runtime:reinitialize', async () => {
  if (!currentData) {
    return { ok: false, error: 'No project loaded.' };
  }

  if (!currentData.usesJavaRuntime()) {
    return { ok: false, error: 'Active project does not use the Java runtime.' };
  }

  if (!javaRuntimeSessionManager) {
    return { ok: false, error: 'Java runtime manager is unavailable.' };
  }

  try {
    const javaRuntimeClient = await javaRuntimeSessionManager.reinitializeClojure(
      currentData,
      currentProjectSessionId,
      currentFilePath,
    );
    await currentData.processOnLoadAsync(javaScriptSession ?? undefined, javaRuntimeClient);
    lastProjectOnLoadState = getProjectOnLoadState(currentData, javaRuntimeClient);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('java-runtime:reinitialize-jython', async () => reinitializeJythonRuntime());

ipcMain.handle('send-bsb-realtime-control-update', (_event, update: BsbRealtimeControlUpdate) => {
  if (!currentData || !isBsbRealtimeControlUpdate(update)) {
    return;
  }

  void syncBsbRealtimeControlUpdate(
    currentData,
    update,
    currentProjectSessionId,
    syncActiveRuntimeChannel,
  ).catch((error) => {
    console.error('[main] Failed to sync realtime BSB control update:', error);
  });
});

ipcMain.handle('send-mixer-realtime-level-update', (_event, update: import('../shared/project-editor').MixerRealtimeLevelUpdate) => {
  if (!currentData || !engineBridge || !engineBridge.isCurrentlyPlaying()) {
    return;
  }

  const channel = getProjectMixerChannelBySnapshotId(update.channelId);
  if (!channel) return;

  const varName = channel.getLevelParameter().getCompilationVarName();
  if (varName) {
    void engineBridge.setChannel(varName, update.level).catch(() => {});
  }
});

ipcMain.handle('send-effect-realtime-update', (_event, update: import('../shared/project-editor').EffectRealtimeUpdate) => {
  if (!currentData || !engineBridge || !engineBridge.isCurrentlyPlaying() || !update.bsbWidgetValues) {
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
});

ipcMain.handle('update-project-document', (_event, patch) => {
  if (!currentData) {
    throw new Error('No project loaded');
  }

  if (!patch || isEmptyProjectDocumentPatch(patch)) {
    throw new Error('Empty project document patch');
  }

  maybeCloseRemovedProjectEffectEditors(patch);
  maybeCloseRemovedTrackInstrumentEditors(patch);
  const scoreAutomationParameterIds = collectAffectedProjectScoreAutomationParameterIds(currentData, patch);
  const changed = applyProjectDocumentPatch(currentData, patch, {
    projectSessionId: currentProjectSessionId,
    projectRevision: currentProjectRevision,
    defaultLayerGroupType: loadProgramSettings().projectDefaults.defaultLayerGroupType,
  });
  if (changed) {
    for (const id of collectAffectedProjectScoreAutomationParameterIds(currentData, patch)) {
      scoreAutomationParameterIds.add(id);
    }
    // Sync with each active real-time engine.
    if (engineBridge?.isCurrentlyPlaying() || blueLiveSession?.isRunning()) {
      void syncEngineWithProjectPatch(currentData, patch, scoreAutomationParameterIds);
    }
    currentProjectRevision += 1;
    broadcastProjectDocumentUpdate();
  } else {
    scoreAutomationParameterIds.clear();
  }

  return getCurrentProjectDocument();
});

// ─── App Lifecycle ───

// ─── Render/Freeze IPC Handlers ───

ipcMain.handle('render-to-disk', (_event, request: unknown) => {
  if (!isRenderToDiskRequest(request)) {
    return { ok: false, operationId: '', cancelled: false, outputPath: null, error: 'Invalid render-to-disk request.' } satisfies RenderOperationResult;
  }
  return handleRenderToDisk(request.action, request.operationId);
});

ipcMain.handle('freeze-score-objects', (_event, request: unknown) => {
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

ipcMain.handle('cancel-render-operation', (_event, request: unknown) => {
  if (!isCancelRenderOperationRequest(request)) return false;
  return handleCancelRenderOperation(request);
});

registerBlueAudioScheme();

app.whenReady().then(async () => {
  registerBlueAudioProtocolHandler();
  setExternalCommandExecutor(createMainExternalExecutor(() => currentFilePath ? path.dirname(currentFilePath) : null));

  if (process.env.BLUE_VERIFY_MODE === 'packaged-project') {
    await runPackagedProjectVerificationAndExit();
  }
  if (process.env.BLUE_VERIFY_MODE === 'packaged-engine-mismatch') {
    await runPackagedEngineMismatchVerificationAndExit();
  }

  initWorkbenchWindowHost();
  try {
    const report = await sweepStaleBlueEngineProcesses();
    if (report.inspected > 0 || report.removed > 0 || report.terminated > 0) {
      console.log(
        `[main] Blue engine startup sweep: inspected=${report.inspected}, removed=${report.removed}, terminated=${report.terminated}, kept=${report.kept}`,
      );
    }
  } catch (error: unknown) {
    console.warn(`[main] Blue engine startup sweep failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (process.platform === 'darwin' && app.dock) {
    const dockIcon = getAppIcon();
    if (dockIcon) {
      app.dock.setIcon(dockIcon);
    }
  }

  // SPEC 061: initialize the app zoom controller from program settings and
  // register a browser-window-created handler BEFORE the first BrowserWindow
  // is created. Apply immediately and across navigation so the restored
  // factor remains uniform for recreated/future app windows. Explicit main,
  // Settings, effect, and Dockview popout constructors also receive the
  // factor for a no-flash first paint.
  appZoomController.initialize();
  app.on('browser-window-created', (_event, window) => {
    const applyCurrentZoom = () => {
      appZoomController.applyToWindow(window);
    };
    applyCurrentZoom();
    window.webContents.on('did-start-navigation', applyCurrentZoom);
    window.webContents.on('did-navigate', applyCurrentZoom);
  });

  createWindow();
  unifiedLibraryService = new UnifiedLibraryService(
    path.join(app.getPath('userData'), 'blue_libraries.sqlite'),
    undefined,
    new UnifiedLibraryProjectAdapter(() => currentData
      ? {
          data: currentData,
          sessionId: currentProjectSessionId,
          revision: currentProjectRevision,
          commit: () => {
            currentProjectRevision += 1;
            broadcastProjectDocumentUpdate();
            return currentProjectRevision;
          },
        }
      : null),
    {
      legacyConfigurationDirectory: path.join(app.getPath('home'), '.blue'),
      migrationStatePath: path.join(app.getPath('userData'), 'blue-libraries-state.json'),
    },
  );
  unregisterUnifiedLibraryIpc = registerUnifiedLibraryIpc({
    ipcMain,
    service: unifiedLibraryService,
    getWindows: () => BrowserWindow.getAllWindows(),
    getWorkDirectory: getConfiguredWorkDirectory,
  });
  await unifiedLibraryService.start();
  codeRepositoryService = new CodeRepositoryService(
    path.join(app.getPath('userData'), 'blue_code_repository.sqlite'),
    {
      legacyConfigurationDirectory: path.join(app.getPath('home'), '.blue'),
      migrationStatePath: path.join(app.getPath('userData'), 'blue-code-repository-state.json'),
    },
  );
  unregisterCodeRepositoryIpc = registerCodeRepositoryIpc({
    ipcMain,
    service: codeRepositoryService,
    getWindows: () => BrowserWindow.getAllWindows(),
    getWorkDirectory: getConfiguredWorkDirectory,
  });
  await codeRepositoryService.start();
  initializeOscControlService();

  // Capture Dockview popout windows (SPEC 055 US1 Float) as floating workbench
  // windows so reveal/close/focus routing can target them. Dockview creates the
  // popout via window.open('popout.html'); Electron realizes it as a new
  // BrowserWindow which we register here by matching its loaded URL.
  app.on('browser-window-created', (_event, window) => {
    window.webContents.once('did-finish-load', () => {
      const url = window.webContents.getURL();
      const popoutMatch = /popout\.html\?id=([^&#]+)/.exec(url);
      if (popoutMatch) {
        registerFloatingWindow(window, { popoutGroupId: decodeURIComponent(popoutMatch[1]) });
      } else if (/popout\.html([?#]|$)/.test(url)) {
        registerFloatingWindow(window);
      }
    });
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
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
