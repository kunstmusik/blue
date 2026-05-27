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
} from 'electron';
import * as path from 'path';
import * as fs from 'fs';

import { BlueData, Effect, Send, BSBGroup, BSBWidget, setExternalCommandExecutor } from '@blue/data';
import { openSettingsWindow } from './settings-window';
import {
  loadProgramSettings,
  saveProgramSettings,
  resetPanel,
  syncLegacyRendererSettings,
  clearSettingsCache,
} from './program-settings-store';
import { applyProgramSettingsToNewProject } from './program-settings-application';
import { buildRealtimeEngineOptions as buildRealtimeEngineOptionsFromSettings, buildUsageMatrix } from './program-settings-usage';
import type { ProgramSettingsSnapshot } from '../shared/program-settings';
import { initializeJavaScriptRuntime, JavaScriptSession } from '@blue/data';
import type { TempoMap } from '@blue/data';
import { EngineBridge } from './engine-bridge';
import { BlueLiveEngineSession } from './blue-live-engine';
import { buildApplicationMenuTemplate } from './application-menu';
import { sweepStaleBlueEngineProcesses } from './engine-process-registry';
import {
  closeEffectEditorWindow,
  closeEffectEditorWindowsForOwner,
  focusEffectEditorWindow,
  openEffectEditorWindow,
  openEffectInterfaceWindow,
} from './effect-editor-window-manager';
import {
  getMixerEffectsLibrarySession,
} from './mixer-effects-library';
import { cleanupTempCsdSnapshots } from './render-command';
import { saveGeneratedCsdToDisk } from './csd-export';
import { executeExternalTest } from './external-executor';
import { createMainExternalExecutor } from './external-command-executor';
import type { JavaRuntimeClient } from './java-runtime/java-runtime-client';
import { JavaRuntimeSessionManager } from './java-runtime/java-runtime-session';
import { testScoreObject } from './score-object-test';
import { syncCompiledRuntimeParameterNames } from './runtime-parameter-sync';
import { getWindowTitle } from '../shared/window-title';
import {
  applyEffectEditablePatchToEffect,
  applyProjectDocumentPatch,
  createProjectEditorSnapshot,
  createEffectEditorSnapshot,
  createScoreObjectEditorDocument,
  createNestedPolyObjectSnapshot,
  createNoteProcessorChainSnapshot,
  getMixerChannelSnapshotId,
  getMixerEntrySnapshotId,
  isEmptyProjectDocumentPatch,
  type EffectEditorPatchRequest,
  type EffectEditorRequest,
  type EffectEditablePatch,
  type EffectsLibraryPatch,
  type BlueLiveNoteTriggerRequest,
  type BlueLiveNoteTriggerResult,
  type BsbRealtimeControlUpdate,
  type ProjectDocumentCommitReceipt,
  type ProjectDocumentPatch,
  type NoteProcessorChainSnapshot,
  type ScoreObjectEditorRequest,
  type ScoreObjectEditorDocumentSnapshot,
  type ScoreObjectTestResult,
  type ScoreObjectLocationRef,
  type PolyObjectLayerGroupSnapshot,
} from '../shared/project-editor';
import { BlueSynthBuilder } from '@blue/data';

let mainWindow: BrowserWindow | null = null;
let currentData: BlueData | null = null;
let currentFilePath: string | null = null;
let currentProjectRevision = 0;
let engineBridge: EngineBridge | null = null;
let blueLiveSession: BlueLiveEngineSession | null = null;
let isQuitting = false;
let pendingQuit = false;
let shutdownPromise: Promise<void> | null = null;
let playbackStartPromise: Promise<boolean> | null = null;
let javaScriptRuntimeReady: Promise<void> | null = null;
let javaScriptSession: JavaScriptSession | null = null;
let javaRuntimeSessionManager: JavaRuntimeSessionManager | null = null;
let recentProjectFiles: string[] = [];
let currentProjectSessionId = 0;
let currentFollowPlaybackEnabled = true;
let currentFollowPlaybackOnStartEnabled = true;

// Set application name early (before ready) so macOS menu bar shows "Blue".
// NOTE: In dev mode (running `electron` CLI directly), macOS may still show
// "Electron" in some system UI until the app is packaged. A full dev server
// restart (Ctrl+C then `pnpm run dev` again) is required for this to take
// effect because it is read once at process startup.
app.setName('Blue');
console.log('[main] App name set to:', app.getName());

function getCurrentProjectDocument() {
  if (!currentData) {
    return null;
  }

  return createProjectEditorSnapshot(currentData, currentFilePath, currentProjectSessionId);
}

function getProjectMixerChannelBySnapshotId(channelId: string) {
  if (!currentData) {
    return null;
  }

  const mixer = currentData.getMixer();

  if (channelId === 'master') {
    return mixer.getMaster();
  }

  const sourceChannel = mixer.getChannels().find(
    (ch) => ch.getAssociation() === channelId || getMixerChannelSnapshotId(ch) === channelId,
  );
  if (sourceChannel) {
    return sourceChannel;
  }

  const subChannel = mixer.getSubChannels().find(
    (ch) => getMixerChannelSnapshotId(ch) === channelId,
  );
  if (subChannel) {
    return subChannel;
  }

  return null;
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
  });
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
    return getMixerEffectsLibrarySession().updateEffect(request.effectId, request.patch);
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

function updateWindowTitle(): void {
  if (mainWindow) {
    mainWindow.setTitle(getWindowTitle(currentFilePath));
  }
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

function getRealtimeSfDirOption(projectDirectory: string | null): string | null {
  if (!currentData || !projectDirectory) {
    return null;
  }

  const mediaFolder = currentData.getProjectProperties().mediaFolder?.trim() ?? '';
  const sfDir = path.isAbsolute(mediaFolder)
    ? mediaFolder
    : path.resolve(projectDirectory, mediaFolder.length > 0 ? mediaFolder : 'media');

  fs.mkdirSync(sfDir, { recursive: true });
  return `--env:SFDIR=${sfDir}`;
}

function buildRealtimeEngineOptions(data: BlueData, projectDirectory: string | null): string[] {
  const settings = loadProgramSettings();
  const options = buildRealtimeEngineOptionsFromSettings(data, projectDirectory, settings);

  const sfDirOption = getRealtimeSfDirOption(projectDirectory);
  if (sfDirOption) {
    options.push(sfDirOption);
  }

  return options;
}

function hasLoadedProject(): boolean {
  return Boolean(currentData);
}

async function confirmSaveBeforeReplace(options: { quitAfterSave?: boolean } = {}): Promise<boolean> {
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
    isDarwin: process.platform === 'darwin',
    recentProjects: getRecentProjectFilesSnapshot(),
    canRevertProject: Boolean(currentFilePath),
    followPlaybackEnabled: currentFollowPlaybackEnabled,
    followPlaybackOnStartEnabled: currentFollowPlaybackOnStartEnabled,
    onNewFile: () => { void handleNewFile(); },
    onOpenFile: () => { void handleOpenFile(); },
    onOpenRecentProject: (filePath) => { void openRecentProject(filePath); },
    onCloseProject: () => { void closeProject(); },
    onRevertProject: () => { void revertProject(); },
    onSaveFile: () => { void saveFile(); },
    onSaveFileAs: () => { void saveFileAs(); },
    onGenerateCsdToScreen: () => { void generateCsdToScreen(); },
    onGenerateCsdToDisk: () => { void generateCsdToDisk(); },
    onRequestQuit: () => { void requestQuit(); },
    onOpenSettings: () => {
      if (mainWindow) {
        openSettingsWindow(mainWindow);
      }
    },
    onOpenEffectsLibrary: () => {
      if (mainWindow) {
        mainWindow.webContents.send('native-menu-command', { type: 'open-effects-library' });
      }
    },
    onFocusPanel: (panelId) => {
      if (mainWindow) {
        mainWindow.webContents.send('native-menu-command', { type: 'focus-panel', panelId });
      }
    },
    onToggleDevTools: () => { mainWindow?.webContents.toggleDevTools(); },
    onResetLayout: () => {
      if (mainWindow) {
        mainWindow.webContents.send('native-menu-command', { type: 'reset-layout' });
      }
    },
    onToggleFollowPlayback: () => { currentFollowPlaybackEnabled = !currentFollowPlaybackEnabled; mainWindow?.webContents.send('native-menu-command', { type: 'toggle-follow-playback' }); rebuildApplicationMenu(); },
    onToggleFollowPlaybackOnStart: () => { currentFollowPlaybackOnStartEnabled = !currentFollowPlaybackOnStartEnabled; mainWindow?.webContents.send('native-menu-command', { type: 'toggle-follow-playback-on-render-start' }); rebuildApplicationMenu(); },
    onToggleLoopRendering: () => { mainWindow?.webContents.send('native-menu-command', { type: 'toggle-loop-rendering' }); },
    onAddMarker: () => { mainWindow?.webContents.send('native-menu-command', { type: 'add-marker' }); },
    onNavigateNextMarker: () => { mainWindow?.webContents.send('native-menu-command', { type: 'navigate-next-marker' }); },
    onNavigatePreviousMarker: () => { mainWindow?.webContents.send('native-menu-command', { type: 'navigate-previous-marker' }); },
    onRewindToStart: () => { mainWindow?.webContents.send('native-menu-command', { type: 'rewind-to-start' }); },
    onToggleBlueLive: () => { void blueLiveToggle(); },
    onRecompileBlueLive: () => { void blueLiveRecompile(); },
    onBlueLiveAllNotesOff: () => { void blueLiveAllNotesOff(); },
    onEditTempoMap: () => { mainWindow?.webContents.send('native-menu-command', { type: 'edit-tempo-map' }); },
    onEditMeterMap: () => { mainWindow?.webContents.send('native-menu-command', { type: 'edit-meter-map' }); },
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
      console.log('[main] Using app icon:', p);
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
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: true,
    },
  });

  mainWindow.webContents.session.setPermissionCheckHandler(
    (_webContents, permission) => (permission as string) === 'local-fonts',
  );
  mainWindow.webContents.session.setPermissionRequestHandler(
    (_webContents, permission, callback) => callback((permission as string) === 'local-fonts'),
  );

  // During development, load from Vite dev server for HMR
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  }

  // Initialize engine bridge
  engineBridge = new EngineBridge(mainWindow);

  engineBridge.setPlaybackCompleteCallback((stopReason) => {
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
  blueLiveSession = new BlueLiveEngineSession(mainWindow, undefined, 5560, 5561);
  javaRuntimeSessionManager = new JavaRuntimeSessionManager({
    isPackaged: app.isPackaged,
    mainModuleDir: __dirname,
    resourcesPath: process.resourcesPath,
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

/**
 * Request app exit — shows save prompt if project is dirty.
 */
async function requestQuit(): Promise<void> {
  isQuitting = true;

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
    currentData = null;
    currentFilePath = null;
    currentProjectRevision = 0;
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

async function openFile(): Promise<void> {
  if (!mainWindow) return;

  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Blue Project',
    filters: [{ name: 'Blue Project', extensions: ['blue'] }],
    properties: ['openFile'],
  });

  if (result.canceled || result.filePaths.length === 0) return;

  const filePath = result.filePaths[0];
  try {
    const xml = fs.readFileSync(filePath, 'utf-8');
    const data = await BlueData.loadFromString(xml);

    // Stop Blue Live when switching projects
    if (blueLiveSession && blueLiveSession.isRunning()) {
      await blueLiveSession.stop();
    }
    await disposeJavaRuntimeSession();
    closeEffectEditorWindowsForOwner('project');

    currentData = data;
    currentFilePath = filePath;
    currentProjectRevision = 0;
    currentProjectSessionId += 1;
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

    // Debug: log arrangement IDs and UDOs
    const arr = data.getArrangement();
    console.log(`[App] Loaded project with ${arr.size()} instrument assignments:`);
    for (let i = 0; i < arr.size(); i++) {
      const ia = arr.getArrangement()[i];
      console.log(`[App]   Instrument ${ia.arrangementId}: enabled=${ia.enabled}, instr=${ia.instr?.constructor.name ?? 'null'}`);
      if (ia.instr && typeof (ia.instr as any).getOpcodeList === 'function') {
        const udoCount = (ia.instr as any).getOpcodeList().getOpcodes().length;
        console.log(`[App]     UDOs in instrument: ${udoCount}`);
        if (udoCount > 0) {
          const firstUdo = (ia.instr as any).getOpcodeList().getOpcodes()[0];
          console.log(`[App]     First UDO: ${firstUdo.getName()} (${firstUdo.getCode()?.length || 0} chars)`);
        }
      }
    }

    mainWindow.webContents.send('project-loaded', {
      ...createProjectEditorSnapshot(data, filePath, currentProjectSessionId),
      title: data.getProjectProperties().title || path.basename(filePath),
      author: data.getProjectProperties().author,
      sampleRate: data.getProjectProperties().sampleRate,
    });
  } catch (err: unknown) {
    await dialog.showErrorBox(
      'Error Loading File',
      `Failed to load ${path.basename(filePath)}:\n${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

async function openFilePath(filePath: string): Promise<void> {
  if (!mainWindow) return;

  try {
    const xml = fs.readFileSync(filePath, 'utf-8');
    const data = await BlueData.loadFromString(xml);

    if (blueLiveSession && blueLiveSession.isRunning()) {
      await blueLiveSession.stop();
    }
    await disposeJavaRuntimeSession();
    closeEffectEditorWindowsForOwner('project');

    currentData = data;
    currentFilePath = filePath;
    currentProjectRevision = 0;
    currentProjectSessionId += 1;
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

    mainWindow.webContents.send('project-loaded', {
      ...createProjectEditorSnapshot(data, filePath, currentProjectSessionId),
      title: data.getProjectProperties().title || path.basename(filePath),
      author: data.getProjectProperties().author,
      sampleRate: data.getProjectProperties().sampleRate,
    });
  } catch (err: unknown) {
    await dialog.showErrorBox(
      'Error Loading File',
      `Failed to load ${path.basename(filePath)}:\n${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

async function newFile(): Promise<void> {
  if (!mainWindow) return;

  if (blueLiveSession && blueLiveSession.isRunning()) {
    await blueLiveSession.stop();
  }
  await disposeJavaRuntimeSession();
  closeEffectEditorWindowsForOwner('project');

  const data = new BlueData();
  const settings = loadProgramSettings();
  applyProgramSettingsToNewProject(data, settings);
  currentData = data;
  currentFilePath = null;
  currentProjectRevision = 0;
  currentProjectSessionId += 1;
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

  mainWindow.webContents.send('project-loaded', {
    ...createProjectEditorSnapshot(data, null, currentProjectSessionId),
    title: 'Untitled',
    author: '',
    sampleRate: '44100',
  });
}

async function closeProject(): Promise<void> {
  if (!mainWindow) return;

  if (!(await confirmSaveBeforeReplace())) return;

  disposeJavaScriptSession();
  await disposeJavaRuntimeSession();
  currentData = null;
  currentFilePath = null;
  currentProjectRevision = 0;
  currentProjectSessionId += 1;
  rebuildApplicationMenu();
  updateWindowTitle();
  mainWindow.webContents.send('project-closed');
}

async function revertProject(): Promise<void> {
  if (!currentFilePath) return;
  if (!(await confirmSaveBeforeReplace())) return;
  await openFilePath(currentFilePath);
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
    defaultPath: currentFilePath ?? 'project.blue',
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
    return currentFilePath ? path.dirname(currentFilePath) : undefined;
  }

  if (path.isAbsolute(currentValue)) {
    return currentValue;
  }

  if (!currentFilePath) {
    return currentValue;
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
}

async function disposeJavaRuntimeSession(): Promise<void> {
  if (javaRuntimeSessionManager) {
    await javaRuntimeSessionManager.dispose();
  }
}

async function ensureJavaRuntimeSession(data: BlueData | null): Promise<JavaRuntimeClient | null> {
  if (!data || !javaRuntimeSessionManager || !data.usesJavaRuntime()) {
    return null;
  }

  return javaRuntimeSessionManager.ensureReady(data, currentProjectSessionId, currentFilePath);
}

async function runProjectOnLoad(data: BlueData): Promise<void> {
  const javaRuntimeClient = await ensureJavaRuntimeSession(data);
  await data.processOnLoadAsync(javaScriptSession ?? undefined, javaRuntimeClient ?? undefined);
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

async function startPlayback(): Promise<boolean> {
  if (!engineBridge || !currentData || !mainWindow) return false;

  try {
    mainWindow.webContents.send('playback-status', {
      status: 'starting',
      message: 'Preparing playback...',
    });

    mainWindow.webContents.send('engine-output-reset', { tabName: 'Csound' });
    mainWindow.webContents.send('engine-output-select', { tabName: 'Csound' });

    await ensureJavaScriptEngine();

    const javaRuntimeClient = await ensureJavaRuntimeSession(currentData);
    const render = javaRuntimeClient
      ? await currentData.toRealtimePlaybackCSDAsync(javaScriptSession ?? undefined, javaRuntimeClient)
      : currentData.toRealtimePlaybackCSD(javaScriptSession ?? undefined);
    const csd = render.csdText;
    const parameters = render.parameters;
    const runtimeParameterSync = syncCompiledRuntimeParameterNames(
      currentData.getArrangement(),
      currentData.getMixer(),
      parameters,
    );
    if (runtimeParameterSync.liveCount !== runtimeParameterSync.compiledCount) {
      console.warn(
        '[main] Runtime parameter sync count mismatch:',
        runtimeParameterSync.liveCount,
        runtimeParameterSync.compiledCount,
      );
    }

    const automationTiming = {
      renderStartTime: currentData.getRenderStartTime(),
      sampleRate: Number(currentData.getProjectProperties().sampleRate) || 44100,
      ksmps: Number(currentData.getProjectProperties().ksmps) || 64,
      tempoMap: currentData.getScore().getTimeContext().getTempoMap(),
    };

    const projectDirectory = getCurrentProjectDirectory();
    const extraRealtimeOptions = buildRealtimeEngineOptions(currentData, projectDirectory);

    const success = await engineBridge.playCSD(
      csd,
      parameters,
      automationTiming,
      projectDirectory,
      extraRealtimeOptions,
    );

    if (!success) {
      mainWindow.webContents.send('playback-status', {
        status: 'error',
        message: 'Failed to start playback',
      });
      return false;
    }

    return true;
  } catch (err: unknown) {
    mainWindow.webContents.send('playback-error', err instanceof Error ? err.message : String(err));
    return false;
  }
}

async function stopPlayback(): Promise<void> {
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

  currentProjectRevision++;
  mainWindow?.webContents.send('engine-output-reset', { tabName: 'Csound (Blue Live)' });
  mainWindow?.webContents.send('engine-output-select', { tabName: 'Csound (Blue Live)' });
  return blueLiveSession.start(currentData, currentProjectRevision, getCurrentProjectDirectory(), javaScriptSession ?? undefined);
}

async function blueLiveRecompile(): Promise<void> {
  if (!blueLiveSession || !currentData) return;
  currentProjectRevision++;
  mainWindow?.webContents.send('engine-output-reset', { tabName: 'Csound (Blue Live)' });
  mainWindow?.webContents.send('engine-output-select', { tabName: 'Csound (Blue Live)' });
  await blueLiveSession.recompile(currentData, currentProjectRevision, getCurrentProjectDirectory(), javaScriptSession ?? undefined);
}

async function blueLiveAllNotesOff(): Promise<void> {
  if (!blueLiveSession) return;
  await blueLiveSession.sendAllNotesOff();
}

async function generateCsdToScreen(): Promise<void> {
  if (!mainWindow) return;
  if (!currentData) {
    notifyNoProjectLoaded('generated-csd-error');
    return;
  }
  try {
    await ensureJavaScriptEngine();
    const javaRuntimeClient = await ensureJavaRuntimeSession(currentData);
    const csdText = javaRuntimeClient
      ? await currentData.toCSDAsync(javaScriptSession ?? undefined, javaRuntimeClient)
      : currentData.toCSD(javaScriptSession ?? undefined);
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
    const javaRuntimeClient = await ensureJavaRuntimeSession(currentData);
    await saveGeneratedCsdToDisk({
      currentData,
      currentFilePath,
      mainWindow,
      session: javaScriptSession ?? undefined,
      runtimeClient: javaRuntimeClient ?? undefined,
    });
  } catch (err) {
    mainWindow?.webContents.send('generated-csd-error', err instanceof Error ? err.message : String(err));
  }
}

// ─── IPC Handlers ───

ipcMain.handle('open-file', async () => {
  await openFile();
  return currentFilePath;
});

ipcMain.handle('open-file-path', async (_event, filePath: string) => {
  if (!(await confirmSaveBeforeReplace())) return currentFilePath;
  await openFilePath(filePath);
  return currentFilePath;
});

ipcMain.handle('new-file', async () => {
  await newFile();
  return currentFilePath;
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

ipcMain.handle('stop-playback', async () => {
  await stopPlayback();
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
    filters: [{ name: 'Blue UDO File', extensions: ['blueUDO'] }],
    properties: ['openFile'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const xml = await fs.promises.readFile(result.filePaths[0], 'utf-8');
  return xml;
});

ipcMain.handle('import-csound-udo', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    filters: [{ name: 'Csound File', extensions: ['udo', 'orc', 'csd'] }],
    properties: ['openFile'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const text = await fs.promises.readFile(result.filePaths[0], 'utf-8');
  return text;
});

ipcMain.handle('export-blue-udo', async (_event, xmlText: string) => {
  if (!mainWindow) return;
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [{ name: 'Blue UDO File', extensions: ['blueUDO'] }],
  });
  if (result.canceled || !result.filePath) return;
  let filePath = result.filePath;
  if (!filePath.endsWith('.blueUDO')) filePath += '.blueUDO';
  await fs.promises.writeFile(filePath, xmlText, 'utf-8');
});

ipcMain.handle('export-csound-udo', async (_event, codeText: string, udoName: string) => {
  if (!mainWindow) return;
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: `${udoName}.udo`,
    filters: [{ name: 'Csound UDO File', extensions: ['udo', 'inc'] }],
  });
  if (result.canceled || !result.filePath) return;
  await fs.promises.writeFile(result.filePath, codeText, 'utf-8');
});

// ─── Blue Live IPC Handlers ───

ipcMain.handle('blue-live:toggle', async () => {
  if (!blueLiveSession || !currentData) {
    return { status: 'idle', running: false, sessionId: 0, message: 'No project loaded' };
  }
  if (blueLiveSession.isRunning()) {
    return blueLiveSession.stop();
  }
  currentProjectRevision++;
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
  currentProjectRevision++;
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

ipcMain.handle('blue-live:get-status', async () => {
  if (!blueLiveSession) {
    return { status: 'idle', running: false, sessionId: 0 };
  }
  return blueLiveSession.getStatus();
});

// ─── Settings IPC Handler ───

ipcMain.handle('settings:open', async () => {
  if (!mainWindow) return;
  openSettingsWindow(mainWindow);
});

// ─── Program Settings IPC Handlers ───

ipcMain.handle('program-settings:get', () => {
  return loadProgramSettings();
});

ipcMain.handle('program-settings:save', (_event, snapshot: ProgramSettingsSnapshot) => {
  return saveProgramSettings(snapshot);
});

ipcMain.handle('program-settings:reset-panel', (_event, panel: string) => {
  return resetPanel(panel as any);
});

ipcMain.handle('program-settings:usage-matrix', () => {
  return buildUsageMatrix();
});

ipcMain.handle('program-settings:sync-legacy-renderer-settings', (_event, legacy: any) => {
  return syncLegacyRendererSettings(legacy);
});

ipcMain.handle('open-effect-editor', async (_event, request: EffectEditorRequest) => {
  openEffectEditorWindow(mainWindow, request);
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

  openEffectInterfaceWindow(mainWindow, request, interfaceWidth, interfaceHeight);
});

ipcMain.handle('get-effect-editor-document', (_event, request: EffectEditorRequest) => {
  if (request.ownerType === 'library') {
    return getMixerEffectsLibrarySession().getEffectEditorSnapshot(request);
  }

  return getProjectEffectEditorSnapshot(request);
});

ipcMain.handle('update-effect-editor-document', (_event, request: EffectEditorPatchRequest) => {
  return applyProjectEffectEditorPatch(request);
});

ipcMain.handle('focus-effect-editor', (_event, request: EffectEditorRequest) => {
  return focusEffectEditorWindow(request);
});

ipcMain.handle('get-effects-library', () => {
  return getMixerEffectsLibrarySession().getSnapshot();
});

ipcMain.handle('reload-effects-library', () => {
  return getMixerEffectsLibrarySession().reload();
});

ipcMain.handle('update-effects-library', (_event, patch: EffectsLibraryPatch) => {
  const session = getMixerEffectsLibrarySession();
  const snapshot = session.applyPatch(patch);

  if (patch.type === 'removeEffect') {
    closeEffectEditorWindow({
      ownerType: 'library',
      effectId: patch.effectId,
      libraryRef: { libraryEffectId: patch.effectId },
    });
  }

  return snapshot;
});

ipcMain.handle('import-effect-file', async (_event, parentCategoryId?: string) => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: 'Import Effect',
    filters: [{ name: 'Effect Files', extensions: ['effect', 'xml'] }],
    properties: ['openFile'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const effectXml = fs.readFileSync(result.filePaths[0], 'utf-8');
  const session = getMixerEffectsLibrarySession();
  return session.importEffectFromXml(effectXml, parentCategoryId);
});

ipcMain.handle('export-effect-file', async (_event, effectId: string) => {
  const session = getMixerEffectsLibrarySession();
  const effect = session.findEffectForExport(effectId);
  if (!effect) return;
  const effectXml = effect.saveAsXML().toXml();
  const defaultName = (effect.getName() || 'effect') + '.effect';
  const result = await dialog.showSaveDialog(mainWindow!, {
    title: 'Export Effect',
    defaultPath: defaultName,
    filters: [{ name: 'Effect Files', extensions: ['effect'] }],
  });
  if (result.canceled || !result.filePath) return;
  fs.writeFileSync(result.filePath, effectXml, 'utf-8');
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
 * Synchronize real-time parameter changes to the running engine.
 */
async function syncEngineWithProjectPatch(data: BlueData, patch: ProjectDocumentPatch) {
  if (!engineBridge || !engineBridge.isCurrentlyPlaying()) return;

  if (patch.mixer) {
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
        // 1. Individual widget updates
        if (orchestraPatch.patch.bsbWidgetValues) {
          const params = instrument.getParameters();
          for (const [objectName, value] of Object.entries(orchestraPatch.patch.bsbWidgetValues)) {
            const param = params.find((p) => p.getName() === objectName);
            if (param && param.getCompilationVarName()) {
              await engineBridge.setChannel(param.getCompilationVarName()!, value);
            }
          }
        }

        // 2. BSB Interface patches (like presets)
        if (orchestraPatch.patch.bsbInterface) {
          const bsbPatch = orchestraPatch.patch.bsbInterface;
          if (bsbPatch.type === 'applyPreset') {
            // Preset applied: sync ALL parameters for this instrument to the engine
            const params = instrument.getParameters();
            for (const param of params) {
              const varName = param.getCompilationVarName();
              if (varName) {
                await engineBridge.setChannel(varName, param.getFixedValue());
              }
            }
          } else if (bsbPatch.type === 'updateWidgetProperties') {
            const widget = instrument.getGraphicInterface().findWidgetById(bsbPatch.widgetId);
            if (widget && widget.objectName) {
              const props = bsbPatch.properties;
              if (typeof props.value === 'number') {
                const param = instrument.getParameters().find(p => p.getName() === widget.objectName);
                if (param && param.getCompilationVarName()) {
                  await engineBridge.setChannel(param.getCompilationVarName()!, props.value);
                }
              }
              if (typeof props.selected === 'boolean') {
                const param = instrument.getParameters().find(p => p.getName() === widget.objectName);
                if (param && param.getCompilationVarName()) {
                  await engineBridge.setChannel(param.getCompilationVarName()!, props.selected ? 1 : 0);
                }
              }
              if (typeof props.selectedIndex === 'number') {
                const param = instrument.getParameters().find(p => p.getName() === widget.objectName);
                if (param && param.getCompilationVarName()) {
                  await engineBridge.setChannel(param.getCompilationVarName()!, props.selectedIndex);
                }
              }
              if (typeof props.xValue === 'number') {
                const px = instrument.getParameters().find(p => p.getName() === widget.objectName + 'X');
                if (px && px.getCompilationVarName()) {
                  await engineBridge.setChannel(px.getCompilationVarName()!, props.xValue);
                }
              }
              if (typeof props.yValue === 'number') {
                const py = instrument.getParameters().find(p => p.getName() === widget.objectName + 'Y');
                if (py && py.getCompilationVarName()) {
                  await engineBridge.setChannel(py.getCompilationVarName()!, props.yValue);
                }
              }
            }
          } else if (bsbPatch.type === 'updateSliderBankValue') {
            const widget = instrument.getGraphicInterface().findWidgetById(bsbPatch.widgetId);
            if (widget?.objectName) {
              const param = instrument.getParameters().find(
                (candidate) => candidate.getName() === `${widget.objectName}_${bsbPatch.sliderIndex}`,
              );
              if (param?.getCompilationVarName()) {
                await engineBridge.setChannel(param.getCompilationVarName()!, bsbPatch.value);
              }
            }
          }
        }
      }
    }
  }
}

async function syncEngineWithRealtimeControlUpdate(
  data: BlueData,
  update: BsbRealtimeControlUpdate,
) {
  if (!engineBridge || !engineBridge.isCurrentlyPlaying()) return;

  const arrangement = data.getArrangement();
  const instrument = arrangement.getInstrumentById(update.assignmentId);
  if (!(instrument instanceof BlueSynthBuilder)) return;

  const widget = instrument.getGraphicInterface().findWidgetById(update.widgetId);
  if (!widget?.objectName) return;

  const findParameter = (name: string) => {
    return instrument.getParameters().find((candidate) => candidate.getName() === name);
  };

  switch (update.kind) {
    case 'value': {
      const value = typeof update.payload.value === 'number' ? update.payload.value : null;
      if (value === null) break;
      const param = findParameter(widget.objectName);
      if (param?.getCompilationVarName()) {
        await engineBridge.setChannel(param.getCompilationVarName()!, value);
      }
      break;
    }
    case 'selected': {
      const selected = typeof update.payload.selected === 'boolean' ? update.payload.selected : null;
      if (selected === null) break;
      const param = findParameter(widget.objectName);
      if (param?.getCompilationVarName()) {
        await engineBridge.setChannel(param.getCompilationVarName()!, selected ? 1 : 0);
      }
      break;
    }
    case 'selectedIndex': {
      const selectedIndex = typeof update.payload.selectedIndex === 'number' ? update.payload.selectedIndex : null;
      if (selectedIndex === null) break;
      const param = findParameter(widget.objectName);
      if (param?.getCompilationVarName()) {
        await engineBridge.setChannel(param.getCompilationVarName()!, selectedIndex);
      }
      break;
    }
    case 'xy': {
      const nextX = typeof update.payload.xValue === 'number' ? update.payload.xValue : null;
      const nextY = typeof update.payload.yValue === 'number' ? update.payload.yValue : null;
      if (nextX !== null) {
        const px = findParameter(`${widget.objectName}X`);
        if (px?.getCompilationVarName()) {
          await engineBridge.setChannel(px.getCompilationVarName()!, nextX);
        }
      }
      if (nextY !== null) {
        const py = findParameter(`${widget.objectName}Y`);
        if (py?.getCompilationVarName()) {
          await engineBridge.setChannel(py.getCompilationVarName()!, nextY);
        }
      }
      break;
    }
    case 'sliderBank': {
      const sliderIndex = typeof update.payload.sliderIndex === 'number' ? update.payload.sliderIndex : null;
      const value = typeof update.payload.value === 'number' ? update.payload.value : null;
      if (sliderIndex === null || value === null) break;
      const param = findParameter(`${widget.objectName}_${sliderIndex}`);
      if (param?.getCompilationVarName()) {
        await engineBridge.setChannel(param.getCompilationVarName()!, value);
      }
      break;
    }
  }
}

ipcMain.handle('get-project-document', () => {
  return getCurrentProjectDocument();
});

ipcMain.handle('commit-project-document-patches', (_event, patches: ProjectDocumentPatch[]) => {
  if (!currentData) {
    throw new Error('No project loaded');
  }

  if (!Array.isArray(patches) || patches.length === 0) {
    throw new Error('Empty project document patch batch');
  }

  for (const patch of patches) {
    maybeCloseRemovedProjectEffectEditors(patch);
    applyProjectDocumentPatch(currentData, patch);
    if (engineBridge && engineBridge.isCurrentlyPlaying()) {
      void syncEngineWithProjectPatch(currentData, patch).catch((error) => {
        console.error('[main] Failed to sync engine with project patch:', error);
      });
    }
  }

  currentProjectRevision += 1;
  const receipt: ProjectDocumentCommitReceipt = { revision: currentProjectRevision, sessionId: currentProjectSessionId };
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
    javaRuntimeClient = await ensureJavaRuntimeSession(currentData);
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
    const javaRuntimeClient = await javaRuntimeSessionManager.reinitialize(
      currentData,
      currentProjectSessionId,
      currentFilePath,
    );
    await currentData.processOnLoadAsync(javaScriptSession ?? undefined, javaRuntimeClient);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('send-bsb-realtime-control-update', (_event, update: BsbRealtimeControlUpdate) => {
  if (!currentData) {
    return;
  }

  void syncEngineWithRealtimeControlUpdate(currentData, update).catch((error) => {
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
  applyProjectDocumentPatch(currentData, patch);

  // Sync with engine in real-time if playing
  if (engineBridge && engineBridge.isCurrentlyPlaying()) {
    void syncEngineWithProjectPatch(currentData, patch);
  }

  return getCurrentProjectDocument();
});

// ─── App Lifecycle ───

app.whenReady().then(async () => {
  setExternalCommandExecutor(createMainExternalExecutor(() => currentFilePath ? path.dirname(currentFilePath) : null));
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

  createWindow();

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
