import { type MenuItemConstructorOptions } from 'electron';
import * as path from 'path';
import { getPanelsByMode, type PanelMode } from '../shared/workbench-menu';

export interface ApplicationMenuTemplateOptions {
  hasLoadedProject: boolean;
  /** Render/freeze is exclusive, so native render commands must not overlap it. */
  isRenderOperationActive?: boolean;
  /** Renderer selection is non-empty and can be resolved by the main process. */
  canAuditionScoreObjects?: boolean;
  isDarwin: boolean;
  recentProjects: string[];
  canRevertProject: boolean;
  followPlaybackEnabled: boolean;
  followPlaybackOnStartEnabled: boolean;
  onNewFile: () => void;
  onOpenFile: () => void;
  onOpenExampleProject: () => void;
  onImportCsdFile: () => void;
  onImportOrcSco: () => void;
  onImportMidiFile: () => void;
  onOpenRecentProject: (filePath: string) => void;
  onCloseProject: () => void;
  onRevertProject: () => void;
  onSaveFile: () => void;
  onSaveFileAs: () => void;
  onGenerateCsdToScreen: () => void;
  onGenerateRealtimeCsdToScreen: () => void;
  onGenerateCsdToDisk: () => void;
  onRequestQuit: () => void;
  onOpenSettings: () => void;
  onOpenAbout: () => void;
  onOpenEffectsLibrary: () => void;
  onOpenFTableConverter: () => void;
  onOpenCsoundRCEditor: () => void;
  onOpenCodeRepositoryEditor: () => void;
  onReinitializeJavaScriptRuntime: () => void;
  onReinitializeJythonRuntime: () => void;
  onFocusPanel: (panelId: string) => void;
  onToggleDevTools: () => void;
  onResetLayout: () => void;
  onToggleFollowPlayback: () => void;
  onToggleFollowPlaybackOnStart: () => void;
  onToggleLoopRendering: () => void;
  onAddMarker: () => void;
  onNavigateNextMarker: () => void;
  onNavigatePreviousMarker: () => void;
  onRewindToStart: () => void;
  onRenderStopProject: () => void;
  onAuditionScoreObjects: () => void;
  onToggleBlueLive: () => void;
  onRecompileBlueLive: () => void;
  onBlueLiveAllNotesOff: () => void;
  onEditTempoMap: () => void;
  onEditMeterMap: () => void;
  onRenderToDisk: () => void;
  onRenderToDiskAndPlay: () => void;
  onRenderToDiskAndOpen: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onActualSize: () => void;
}

function buildWorkbenchMenuItems(
  mode: PanelMode,
  onFocusPanel: (panelId: string) => void,
): MenuItemConstructorOptions[] {
  return getPanelsByMode(mode).map((panel) => ({
    label: panel.title,
    click: () => onFocusPanel(panel.id),
  }));
}

function buildRecentProjectsMenuTemplate(
  options: ApplicationMenuTemplateOptions,
): MenuItemConstructorOptions[] {
  const recentProjects = options.recentProjects.filter((filePath) => filePath.trim().length > 0);

  if (recentProjects.length === 0) {
    return [{ label: 'No Recent Projects', enabled: false }];
  }

  return recentProjects.map((filePath) => ({
    label: path.basename(filePath),
    sublabel: filePath,
    click: () => options.onOpenRecentProject(filePath),
  }));
}

function buildFileMenuTemplate(
  options: ApplicationMenuTemplateOptions,
): MenuItemConstructorOptions[] {
  const hasProject = options.hasLoadedProject;
  const canRender = hasProject && !options.isRenderOperationActive;

  return [
    { label: 'New Project', accelerator: 'CmdOrCtrl+N', click: () => options.onNewFile() },
    { type: 'separator' },
    { label: 'Open Project', accelerator: 'CmdOrCtrl+O', click: () => options.onOpenFile() },
    { label: 'Open Example Project...', click: () => options.onOpenExampleProject() },
    { type: 'separator' },
    { label: 'Import CSD File', enabled: hasProject, click: () => options.onImportCsdFile() },
    { label: 'Import from ORC/SCO', enabled: hasProject, click: () => options.onImportOrcSco() },
    { label: 'Import MIDI File', enabled: hasProject, click: () => options.onImportMidiFile() },
    { type: 'separator' },
    {
      label: 'Close Project',
      accelerator: options.isDarwin ? 'Shift+Cmd+W' : 'Shift+Ctrl+W',
      enabled: hasProject,
      click: () => options.onCloseProject(),
    },
    { label: 'Revert', enabled: options.canRevertProject, click: () => options.onRevertProject() },
    { type: 'separator' },
    {
      label: 'Save',
      accelerator: 'CmdOrCtrl+S',
      enabled: hasProject,
      click: () => options.onSaveFile(),
    },
    { label: 'Save as...', enabled: hasProject, click: () => options.onSaveFileAs() },
    { type: 'separator' },
    {
      label: 'Render to Disk',
      accelerator: options.isDarwin ? 'Shift+Cmd+F9' : 'Shift+Ctrl+F9',
      enabled: canRender,
      click: () => options.onRenderToDisk(),
    },
    {
      label: 'Render to Disk and Play',
      accelerator: 'Shift+F9',
      enabled: canRender,
      click: () => options.onRenderToDiskAndPlay(),
    },
    {
      label: 'Render to Disk and Open',
      enabled: canRender,
      click: () => options.onRenderToDiskAndOpen(),
    },
    { type: 'separator' },
    { label: 'Recent Projects', submenu: buildRecentProjectsMenuTemplate(options) },
    ...(options.isDarwin
      ? []
      : [
          { type: 'separator' as const },
          {
            label: 'Settings...',
            accelerator: 'CmdOrCtrl+,',
            click: () => options.onOpenSettings(),
          },
          { type: 'separator' as const },
          { label: 'Quit', accelerator: 'CmdOrCtrl+Q', click: () => options.onRequestQuit() },
        ]),
  ];
}

function buildProjectMenuTemplate(
  options: ApplicationMenuTemplateOptions,
): MenuItemConstructorOptions[] {
  const hasProject = options.hasLoadedProject;
  // Realtime playback is exclusive with disk render/freeze so F9 (realtime) and
  // Shift+F9 (disk render) accelerators never collide on a busy engine.
  const canRealtimePlay = hasProject && !options.isRenderOperationActive;
  const canAudition =
    hasProject && Boolean(options.canAuditionScoreObjects) && !options.isRenderOperationActive;

  return [
    {
      label: 'Generate CSD to Screen',
      accelerator: 'CmdOrCtrl+Shift+G',
      enabled: hasProject,
      click: () => options.onGenerateCsdToScreen(),
    },
    {
      label: 'Generate Realtime CSD to Screen',
      enabled: hasProject,
      click: () => options.onGenerateRealtimeCsdToScreen(),
    },
    {
      label: 'Generate CSD to File',
      accelerator: 'CmdOrCtrl+G',
      enabled: hasProject,
      click: () => options.onGenerateCsdToDisk(),
    },
    {
      label: 'Render/Stop Project',
      accelerator: 'F9',
      enabled: canRealtimePlay,
      click: () => options.onRenderStopProject(),
    },
    {
      label: 'Audition ScoreObjects',
      accelerator: 'CmdOrCtrl+Shift+A',
      enabled: canAudition,
      click: () => options.onAuditionScoreObjects(),
    },
    { type: 'separator' },
    {
      label: 'Follow playback by scrolling score',
      type: 'checkbox',
      checked: options.followPlaybackEnabled,
      enabled: hasProject,
      click: () => options.onToggleFollowPlayback(),
    },
    {
      label: 'Enable follow playback on render start',
      type: 'checkbox',
      checked: options.followPlaybackOnStartEnabled,
      enabled: hasProject,
      click: () => options.onToggleFollowPlaybackOnStart(),
    },
    { type: 'separator' },
    {
      label: 'Navigate to Next Marker',
      accelerator: ']',
      enabled: hasProject,
      click: () => options.onNavigateNextMarker(),
    },
    {
      label: 'Navigate to Previous Marker',
      accelerator: '[',
      enabled: hasProject,
      click: () => options.onNavigatePreviousMarker(),
    },
    { label: 'Rewind to Start', enabled: hasProject, click: () => options.onRewindToStart() },
    { type: 'separator' },
    {
      label: 'Blue Live',
      enabled: hasProject,
      submenu: [
        { label: 'Start/Stop Blue Live', click: () => options.onToggleBlueLive() },
        { label: 'Recompile', click: () => options.onRecompileBlueLive() },
        { label: 'All Notes Off', click: () => options.onBlueLiveAllNotesOff() },
        { label: 'MIDI Input', click: () => options.onFocusPanel('MidiInputPanelTopComponent') },
      ],
    },
    { type: 'separator' },
    { label: 'Edit Tempo Map...', enabled: hasProject, click: () => options.onEditTempoMap() },
    {
      label: 'Edit Time Signature Map...',
      enabled: hasProject,
      click: () => options.onEditMeterMap(),
    },
    {
      label: 'Add Marker',
      accelerator: 'CmdOrCtrl+M',
      enabled: hasProject,
      click: () => options.onAddMarker(),
    },
    { type: 'separator' },
    {
      label: 'Toggle Loop Rendering',
      accelerator: 'CmdOrCtrl+L',
      enabled: hasProject,
      click: () => options.onToggleLoopRendering(),
    },
  ];
}

function buildViewMenuTemplate(
  options: ApplicationMenuTemplateOptions,
): MenuItemConstructorOptions[] {
  return [
    {
      label: 'Zoom In',
      accelerator: 'CommandOrControl+Plus',
      click: () => options.onZoomIn(),
    },
    {
      label: 'Zoom Out',
      accelerator: 'CommandOrControl+-',
      click: () => options.onZoomOut(),
    },
    {
      label: 'Actual Size',
      accelerator: 'CommandOrControl+0',
      click: () => options.onActualSize(),
    },
  ];
}

function buildToolsMenuTemplate(
  options: ApplicationMenuTemplateOptions,
): MenuItemConstructorOptions[] {
  return [
    { label: 'Code Repository Editor', click: () => options.onOpenCodeRepositoryEditor() },
    { label: 'Effects Library', click: () => options.onOpenEffectsLibrary() },
    { label: 'Blue Share', enabled: false },
    { label: 'FTable Converter', click: () => options.onOpenFTableConverter() },
    { label: '.csound7rc Editor', click: () => options.onOpenCsoundRCEditor() },
  ];
}

function buildScriptMenuTemplate(
  options: ApplicationMenuTemplateOptions,
): MenuItemConstructorOptions[] {
  return [
    {
      label: 'Reinitialize JavaScript Interpreter',
      click: () => options.onReinitializeJavaScriptRuntime(),
    },
    {
      label: 'Reinitialize Jython Interpreter',
      enabled: options.hasLoadedProject,
      click: () => options.onReinitializeJythonRuntime(),
    },
  ];
}

function buildWindowMenuTemplate(
  options: ApplicationMenuTemplateOptions,
): MenuItemConstructorOptions[] {
  return [
    { label: 'Editors', submenu: buildWorkbenchMenuItems('editor', options.onFocusPanel) },
    { label: 'Properties', submenu: buildWorkbenchMenuItems('properties', options.onFocusPanel) },
    { label: 'Output', submenu: buildWorkbenchMenuItems('output', options.onFocusPanel) },
    { label: 'REPL', submenu: buildWorkbenchMenuItems('repl', options.onFocusPanel) },
    {
      label: 'Toggle Dev Tools',
      accelerator: options.isDarwin ? 'Cmd+Alt+I' : 'Ctrl+Shift+I',
      click: () => options.onToggleDevTools(),
    },
    { type: 'separator' as const },
    {
      label: 'Reset Windows',
      click: () => options.onResetLayout(),
    },
  ];
}

export function buildApplicationMenuTemplate(
  options: ApplicationMenuTemplateOptions,
): MenuItemConstructorOptions[] {
  const template: MenuItemConstructorOptions[] = [];

  if (options.isDarwin) {
    template.push({
      label: 'Blue',
      submenu: [
        { label: 'About Blue', click: () => options.onOpenAbout() },
        { type: 'separator' },
        {
          label: 'Settings...',
          accelerator: 'Cmd+,',
          click: () => options.onOpenSettings(),
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        {
          label: 'Quit Blue',
          accelerator: 'Cmd+Q',
          click: () => options.onRequestQuit(),
        },
      ],
    });
  }

  template.push({
    label: 'File',
    submenu: buildFileMenuTemplate(options),
  });

  template.push({
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectAll' },
    ],
  });

  template.push({
    label: 'View',
    submenu: buildViewMenuTemplate(options),
  });

  template.push({
    label: 'Project',
    submenu: buildProjectMenuTemplate(options),
  });

  template.push({
    label: 'Script',
    submenu: buildScriptMenuTemplate(options),
  });

  template.push({
    label: 'Tools',
    submenu: buildToolsMenuTemplate(options),
  });

  if (!options.isDarwin) {
    template.push({
      label: 'Help',
      submenu: [{ label: 'About Blue', click: () => options.onOpenAbout() }],
    });
  }

  template.push({
    label: 'Window',
    submenu: buildWindowMenuTemplate(options),
  });

  return template;
}
