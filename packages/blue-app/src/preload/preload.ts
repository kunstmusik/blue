/**
 * Preload script — exposes safe IPC bridges to the renderer process.
 */
import { clipboard, contextBridge, ipcRenderer } from 'electron';
import type {
  EffectEditorPatchRequest,
  EffectEditorRequest,
  EffectEditorSnapshot,
  BsbRealtimeControlUpdate,
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
} from '../shared/project-editor';
import type { NativeMenuCommand } from '../shared/workbench-menu';
import type { EngineOutputPayload } from '../shared/io-provider';
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

contextBridge.exposeInMainWorld('blueAPI', {
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

  // Project document
  getProjectDocument: () =>
    ipcRenderer.invoke('get-project-document') as Promise<ProjectEditorSnapshot | null>,
  updateProjectDocument: (patch: ProjectDocumentPatch) =>
    ipcRenderer.invoke('update-project-document', patch) as Promise<ProjectEditorSnapshot | null>,
  getEffectsLibrary: () =>
    ipcRenderer.invoke('get-effects-library') as Promise<EffectsLibrarySnapshot>,
  reloadEffectsLibrary: () =>
    ipcRenderer.invoke('reload-effects-library') as Promise<EffectsLibrarySnapshot>,
  updateEffectsLibrary: (patch: EffectsLibraryPatch) =>
    ipcRenderer.invoke('update-effects-library', patch) as Promise<EffectsLibrarySnapshot>,
  importEffectFile: (parentCategoryId?: string) =>
    ipcRenderer.invoke('import-effect-file', parentCategoryId) as Promise<EffectsLibrarySnapshot | null>,
  exportEffectFile: (effectId: string) =>
    ipcRenderer.invoke('export-effect-file', effectId) as Promise<void>,
  focusEffectEditor: (request: EffectEditorRequest) =>
    ipcRenderer.invoke('focus-effect-editor', request) as Promise<boolean>,
  openEffectEditor: (request: EffectEditorRequest) =>
    ipcRenderer.invoke('open-effect-editor', request) as Promise<void>,
  openEffectInterface: (request: EffectEditorRequest) =>
    ipcRenderer.invoke('open-effect-interface', request) as Promise<void>,
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
  stopPlayback: () => ipcRenderer.invoke('stop-playback'),
  syncFollowPlaybackState: (enabled: boolean) => ipcRenderer.send('sync-follow-playback-state', enabled),

  // Project info
  getProjectInfo: () => ipcRenderer.invoke('get-project-info'),

  // CSD generation
  generateCsdToScreen: () => ipcRenderer.invoke('generate-csd-to-screen'),
  generateCsdToDisk: () => ipcRenderer.invoke('generate-csd-to-disk'),

  // UDO import/export
  importBlueUdo: () => ipcRenderer.invoke('import-blue-udo'),
  importCsoundUdo: () => ipcRenderer.invoke('import-csound-udo'),
  exportBlueUdo: (xmlText: string) => ipcRenderer.invoke('export-blue-udo', xmlText),
  exportCsoundUdo: (codeText: string, udoName: string) => ipcRenderer.invoke('export-csound-udo', codeText, udoName),

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
