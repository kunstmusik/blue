import { describe, expect, it, vi } from 'vitest';
import { buildApplicationMenuTemplate } from './application-menu';

function createHandlers() {
  return {
    onNewFile: vi.fn(),
    onOpenFile: vi.fn(),
    onOpenExampleProject: vi.fn(),
    onImportCsdFile: vi.fn(),
    onImportOrcSco: vi.fn(),
    onImportMidiFile: vi.fn(),
    onOpenRecentProject: vi.fn(),
    onCloseProject: vi.fn(),
    onRevertProject: vi.fn(),
    onSaveFile: vi.fn(),
    onSaveFileAs: vi.fn(),
    onGenerateCsdToScreen: vi.fn(),
    onGenerateRealtimeCsdToScreen: vi.fn(),
    onGenerateCsdToDisk: vi.fn(),
    onRequestQuit: vi.fn(),
    onOpenSettings: vi.fn(),
    onOpenAbout: vi.fn(),
    onOpenEffectsLibrary: vi.fn(),
    onOpenFTableConverter: vi.fn(),
    onOpenCsoundRCEditor: vi.fn(),
    onOpenCodeRepositoryEditor: vi.fn(),
    onReinitializeJavaScriptRuntime: vi.fn(),
    onReinitializeJythonRuntime: vi.fn(),
    onFocusPanel: vi.fn(),
    onToggleDevTools: vi.fn(),
    onResetLayout: vi.fn(),
    onToggleFollowPlayback: vi.fn(),
    onToggleFollowPlaybackOnStart: vi.fn(),
    onToggleLoopRendering: vi.fn(),
    onToggleBlueLive: vi.fn(),
    onRecompileBlueLive: vi.fn(),
    onBlueLiveAllNotesOff: vi.fn(),
    onEditTempoMap: vi.fn(),
    onEditMeterMap: vi.fn(),
    onRenderToDisk: vi.fn(),
    onRenderToDiskAndPlay: vi.fn(),
    onRenderToDiskAndOpen: vi.fn(),
    onAddMarker: vi.fn(),
    onNavigateNextMarker: vi.fn(),
    onNavigatePreviousMarker: vi.fn(),
    onRewindToStart: vi.fn(),
    onRenderStopProject: vi.fn(),
    onAuditionScoreObjects: vi.fn(),
    onZoomIn: vi.fn(),
    onZoomOut: vi.fn(),
    onActualSize: vi.fn(),
  };
}

function getSubmenu(item: any): any[] {
  return Array.isArray(item.submenu) ? item.submenu : [];
}

function getLabels(items: any[]): Array<string | undefined> {
  return items.map((item) => item.label).filter((label): label is string => Boolean(label));
}

describe('application menu template', () => {
  it('080: keeps File-menu labels, accelerators, gating, and handler routing unchanged around the deferred replacement policy', () => {
    const handlers = createHandlers();
    const template = buildApplicationMenuTemplate({
      hasLoadedProject: true,
      isDarwin: true,
      recentProjects: [],
      canRevertProject: true,
      followPlaybackEnabled: true,
      followPlaybackOnStartEnabled: true,
      ...handlers,
    });

    const fileMenu = getSubmenu(template[1]);
    const byLabel = (label: string) => fileMenu.find((item) => item.label === label);

    expect(byLabel('New Project')?.accelerator).toBe('CmdOrCtrl+N');
    expect(byLabel('Open Project')?.accelerator).toBe('CmdOrCtrl+O');
    expect(byLabel('Save')?.accelerator).toBe('CmdOrCtrl+S');

    // The replacement-policy change lives behind these handlers; each menu
    // item still delegates to exactly one main-process callback.
    byLabel('New Project')?.click?.();
    byLabel('Open Project')?.click?.();
    byLabel('Open Example Project...')?.click?.();
    byLabel('Import CSD File')?.click?.();
    byLabel('Import from ORC/SCO')?.click?.();
    byLabel('Import MIDI File')?.click?.();

    expect(handlers.onNewFile).toHaveBeenCalledTimes(1);
    expect(handlers.onOpenFile).toHaveBeenCalledTimes(1);
    expect(handlers.onOpenExampleProject).toHaveBeenCalledTimes(1);
    expect(handlers.onImportCsdFile).toHaveBeenCalledTimes(1);
    expect(handlers.onImportOrcSco).toHaveBeenCalledTimes(1);
    expect(handlers.onImportMidiFile).toHaveBeenCalledTimes(1);

    // Import entry points stay gated on a loaded project; opens do not.
    const noProjectTemplate = buildApplicationMenuTemplate({
      hasLoadedProject: false,
      isDarwin: true,
      recentProjects: [],
      canRevertProject: false,
      followPlaybackEnabled: false,
      followPlaybackOnStartEnabled: false,
      ...handlers,
    });
    const noProjectFileMenu = getSubmenu(noProjectTemplate[1]);
    const gatedByLabel = (label: string) => noProjectFileMenu.find((item) => item.label === label);

    expect(gatedByLabel('Import CSD File')?.enabled).toBe(false);
    expect(gatedByLabel('Import from ORC/SCO')?.enabled).toBe(false);
    expect(gatedByLabel('Import MIDI File')?.enabled).toBe(false);
    expect(gatedByLabel('Open Project')?.enabled).not.toBe(false);
    expect(gatedByLabel('Open Example Project...')?.enabled).not.toBe(false);
  });

  it('disables all native disk-render actions while a render/freeze operation is active', () => {
    const template = buildApplicationMenuTemplate({
      hasLoadedProject: true,
      isRenderOperationActive: true,
      isDarwin: false,
      recentProjects: [],
      canRevertProject: false,
      followPlaybackEnabled: true,
      followPlaybackOnStartEnabled: true,
      ...createHandlers(),
    });
    const fileMenu = getSubmenu(template.find((item) => item.label === 'File'));

    for (const label of ['Render to Disk', 'Render to Disk and Play', 'Render to Disk and Open']) {
      expect(fileMenu.find((item) => item.label === label)?.enabled).toBe(false);
    }
  });

  it('routes each native disk-render action to its matching handler', () => {
    const handlers = createHandlers();
    const template = buildApplicationMenuTemplate({
      hasLoadedProject: true,
      isRenderOperationActive: false,
      isDarwin: false,
      recentProjects: [],
      canRevertProject: false,
      followPlaybackEnabled: true,
      followPlaybackOnStartEnabled: true,
      ...handlers,
    });
    const fileMenu = getSubmenu(template.find((item) => item.label === 'File'));

    fileMenu.find((item) => item.label === 'Render to Disk')?.click?.();
    fileMenu.find((item) => item.label === 'Render to Disk and Play')?.click?.();
    fileMenu.find((item) => item.label === 'Render to Disk and Open')?.click?.();

    expect(handlers.onRenderToDisk).toHaveBeenCalledOnce();
    expect(handlers.onRenderToDiskAndPlay).toHaveBeenCalledOnce();
    expect(handlers.onRenderToDiskAndOpen).toHaveBeenCalledOnce();
  });

  it('gates MIDI import on a loaded project', () => {
    const handlers = createHandlers();
    const template = buildApplicationMenuTemplate({
      hasLoadedProject: false,
      isRenderOperationActive: false,
      isDarwin: false,
      recentProjects: [],
      canRevertProject: false,
      followPlaybackEnabled: true,
      followPlaybackOnStartEnabled: true,
      ...handlers,
    });
    const fileMenu = getSubmenu(template.find((item) => item.label === 'File'));
    const importMidiItem = fileMenu.find((item) => item.label === 'Import MIDI File');

    expect(importMidiItem?.enabled).toBe(false);
  });

  it('routes the Render/Stop Project item to onRenderStopProject and gates it on project + render state', () => {
    const handlers = createHandlers();
    const template = buildApplicationMenuTemplate({
      hasLoadedProject: true,
      isRenderOperationActive: false,
      isDarwin: false,
      recentProjects: [],
      canRevertProject: false,
      followPlaybackEnabled: true,
      followPlaybackOnStartEnabled: true,
      ...handlers,
    });
    const projectMenu = getSubmenu(template.find((item) => item.label === 'Project'));

    const renderStopItem = projectMenu.find((item) => item.label === 'Render/Stop Project');
    expect(renderStopItem?.accelerator).toBe('F9');
    expect(renderStopItem?.enabled).toBe(true);
    renderStopItem?.click?.();
    expect(handlers.onRenderStopProject).toHaveBeenCalledOnce();
  });

  it('disables Render/Stop Project while a render/freeze operation is active', () => {
    const template = buildApplicationMenuTemplate({
      hasLoadedProject: true,
      isRenderOperationActive: true,
      isDarwin: false,
      recentProjects: [],
      canRevertProject: false,
      followPlaybackEnabled: true,
      followPlaybackOnStartEnabled: true,
      ...createHandlers(),
    });
    const projectMenu = getSubmenu(template.find((item) => item.label === 'Project'));

    expect(projectMenu.find((item) => item.label === 'Render/Stop Project')?.enabled).toBe(false);
  });

  it('disables Render/Stop Project when no project is loaded', () => {
    const template = buildApplicationMenuTemplate({
      hasLoadedProject: false,
      isRenderOperationActive: false,
      isDarwin: false,
      recentProjects: [],
      canRevertProject: false,
      followPlaybackEnabled: true,
      followPlaybackOnStartEnabled: true,
      ...createHandlers(),
    });
    const projectMenu = getSubmenu(template.find((item) => item.label === 'Project'));

    expect(projectMenu.find((item) => item.label === 'Render/Stop Project')?.enabled).toBe(false);
  });

  it('routes Audition ScoreObjects with the Java Blue DS-A accelerator and selection gating', () => {
    const handlers = createHandlers();
    const template = buildApplicationMenuTemplate({
      hasLoadedProject: true,
      canAuditionScoreObjects: true,
      isRenderOperationActive: false,
      isDarwin: false,
      recentProjects: [],
      canRevertProject: false,
      followPlaybackEnabled: true,
      followPlaybackOnStartEnabled: true,
      ...handlers,
    });
    const projectMenu = getSubmenu(template.find((item) => item.label === 'Project'));
    const auditionItem = projectMenu.find((item) => item.label === 'Audition ScoreObjects');

    expect(auditionItem?.accelerator).toBe('CmdOrCtrl+Shift+A');
    expect(auditionItem?.enabled).toBe(true);
    auditionItem?.click?.();
    expect(handlers.onAuditionScoreObjects).toHaveBeenCalledOnce();
  });

  it('disables Audition ScoreObjects for an empty selection or busy render', () => {
    const base = {
      hasLoadedProject: true,
      isDarwin: false,
      recentProjects: [],
      canRevertProject: false,
      followPlaybackEnabled: true,
      followPlaybackOnStartEnabled: true,
      ...createHandlers(),
    };
    const emptySelection = buildApplicationMenuTemplate({ ...base, canAuditionScoreObjects: false });
    const busy = buildApplicationMenuTemplate({ ...base, canAuditionScoreObjects: true, isRenderOperationActive: true });
    expect(getSubmenu(emptySelection.find((item) => item.label === 'Project')).find((item) => item.label === 'Audition ScoreObjects')?.enabled).toBe(false);
    expect(getSubmenu(busy.find((item) => item.label === 'Project')).find((item) => item.label === 'Audition ScoreObjects')?.enabled).toBe(false);
  });

  it('builds the macOS Blue menu with the expected order and actions', () => {
    const handlers = createHandlers();
    const template = buildApplicationMenuTemplate({
      hasLoadedProject: true,
      isDarwin: true,
      recentProjects: ['/one.blue', '/two.blue'],
      canRevertProject: true,
      followPlaybackEnabled: true,
      followPlaybackOnStartEnabled: true,
      ...handlers,
    });

    expect(template.map((item) => item.label)).toEqual(['Blue', 'File', 'Edit', 'View', 'Project', 'Script', 'Tools', 'Window']);

    const blueMenu = getSubmenu(template[0]);
    expect(blueMenu.map((item) => item.label)).toContain('About Blue');
    expect(blueMenu.map((item) => item.label)).toContain('Settings...');

    blueMenu.find((item) => item.label === 'About Blue')?.click?.();
    expect(handlers.onOpenAbout).toHaveBeenCalledTimes(1);

    const blueSettings = blueMenu.find((item) => item.label === 'Settings...');
    expect(blueSettings?.accelerator).toBe('Cmd+,');
    blueSettings?.click?.();
    expect(handlers.onOpenSettings).toHaveBeenCalledTimes(1);

    const fileMenu = getSubmenu(template[1]);
    expect(getLabels(fileMenu)).toEqual(['New Project', 'Open Project', 'Open Example Project...', 'Import CSD File', 'Import from ORC/SCO', 'Import MIDI File', 'Close Project', 'Revert', 'Save', 'Save as...', 'Render to Disk', 'Render to Disk and Play', 'Render to Disk and Open', 'Recent Projects']);

    const recentMenu = getSubmenu(fileMenu.find((item) => item.label === 'Recent Projects'));
    expect(getLabels(recentMenu)).toEqual(['one.blue', 'two.blue']);
    recentMenu[0]?.click?.();
    expect(handlers.onOpenRecentProject).toHaveBeenCalledWith('/one.blue');

    const exampleItem = fileMenu.find((item) => item.label === 'Open Example Project...');
    exampleItem?.click?.();
    expect(handlers.onOpenExampleProject).toHaveBeenCalledTimes(1);

    const importCsdItem = fileMenu.find((item) => item.label === 'Import CSD File');
    importCsdItem?.click?.();
    expect(handlers.onImportCsdFile).toHaveBeenCalledTimes(1);

    const importOrcScoItem = fileMenu.find((item) => item.label === 'Import from ORC/SCO');
    importOrcScoItem?.click?.();
    expect(handlers.onImportOrcSco).toHaveBeenCalledTimes(1);

    const importMidiItem = fileMenu.find((item) => item.label === 'Import MIDI File');
    importMidiItem?.click?.();
    expect(handlers.onImportMidiFile).toHaveBeenCalledTimes(1);

    const projectMenu = getSubmenu(template[4]);
    expect(projectMenu.find((item) => item.label === 'Generate CSD to Screen')).toBeTruthy();
    expect(projectMenu.find((item) => item.label === 'Generate Realtime CSD to Screen')).toBeTruthy();
    expect(projectMenu.find((item) => item.label === 'Blue Live')).toBeTruthy();
    projectMenu.find((item) => item.label === 'Generate CSD to Screen')?.click?.();
    expect(handlers.onGenerateCsdToScreen).toHaveBeenCalledTimes(1);
    // "Generate Realtime CSD to Screen" is wired to its own handler.
    projectMenu.find((item) => item.label === 'Generate Realtime CSD to Screen')?.click?.();
    expect(handlers.onGenerateRealtimeCsdToScreen).toHaveBeenCalledTimes(1);

    const scriptMenu = getSubmenu(template[5]);
    expect(getLabels(scriptMenu)).toEqual(['Reinitialize JavaScript Interpreter', 'Reinitialize Jython Interpreter']);
    scriptMenu.find((item) => item.label === 'Reinitialize JavaScript Interpreter')?.click?.();
    scriptMenu.find((item) => item.label === 'Reinitialize Jython Interpreter')?.click?.();
    expect(handlers.onReinitializeJavaScriptRuntime).toHaveBeenCalledOnce();
    expect(handlers.onReinitializeJythonRuntime).toHaveBeenCalledOnce();

    const toolsMenu = getSubmenu(template[6]);
    toolsMenu.find((item) => item.label === 'Code Repository Editor')?.click?.();
    expect(handlers.onOpenCodeRepositoryEditor).toHaveBeenCalledTimes(1);
    expect(toolsMenu.find((item) => item.label === 'Effects Library')).toBeTruthy();
    toolsMenu.find((item) => item.label === 'Effects Library')?.click?.();
    expect(handlers.onOpenEffectsLibrary).toHaveBeenCalledTimes(1);
    expect(toolsMenu.find((item) => item.label === 'SoundFont Viewer')).toBeFalsy();

    const windowMenu = getSubmenu(template[7]);
    expect(windowMenu.map((item) => item.label).slice(0, 5)).toEqual(['Editors', 'Properties', 'Output', 'REPL', 'Toggle Dev Tools']);
    expect(windowMenu.find((item) => item.label === 'Reset Default Layout')).toBeFalsy();
    expect(windowMenu.find((item) => item.label === 'Reset Windows')).toBeTruthy();

    const resetItem = windowMenu.find((item) => item.label === 'Reset Windows');
    resetItem?.click?.();
    expect(handlers.onResetLayout).toHaveBeenCalledTimes(1);

    const editorsMenu = getSubmenu(windowMenu.find((item) => item.label === 'Editors'));
    expect(editorsMenu.map((item) => item.label).slice(0, 3)).toEqual(['Score', 'Orchestra', 'Global Orchestra']);
    editorsMenu[0]?.click?.();
    expect(handlers.onFocusPanel).toHaveBeenCalledWith('ScoreTopComponent');
  });

  it('keeps Blue Share visible but disabled without a placeholder handler', () => {
    const template = buildApplicationMenuTemplate({
      hasLoadedProject: true,
      isDarwin: false,
      recentProjects: [],
      canRevertProject: false,
      followPlaybackEnabled: true,
      followPlaybackOnStartEnabled: true,
      ...createHandlers(),
    });
    const toolsMenu = getSubmenu(template.find((item) => item.label === 'Tools'));
    const blueShare = toolsMenu.find((item) => item.label === 'Blue Share');

    expect(blueShare).toMatchObject({ label: 'Blue Share', enabled: false });
    expect(blueShare?.click).toBeUndefined();
  });

  it('builds the non-Darwin File menu with Settings and Quit entries', () => {
    const handlers = createHandlers();
    const template = buildApplicationMenuTemplate({
      hasLoadedProject: false,
      isDarwin: false,
      recentProjects: [],
      canRevertProject: false,
      followPlaybackEnabled: true,
      followPlaybackOnStartEnabled: true,
      ...handlers,
    });

    expect(template.map((item) => item.label)).toEqual(['File', 'Edit', 'View', 'Project', 'Script', 'Tools', 'Help', 'Window']);

    const fileMenu = getSubmenu(template[0]);
    expect(getLabels(fileMenu)).toEqual(['New Project', 'Open Project', 'Open Example Project...', 'Import CSD File', 'Import from ORC/SCO', 'Import MIDI File', 'Close Project', 'Revert', 'Save', 'Save as...', 'Render to Disk', 'Render to Disk and Play', 'Render to Disk and Open', 'Recent Projects', 'Settings...', 'Quit']);

    const recentMenu = getSubmenu(fileMenu.find((item) => item.label === 'Recent Projects'));
    expect(getLabels(recentMenu)).toEqual(['No Recent Projects']);

    const settingsItem = fileMenu.find((item) => item.label === 'Settings...');
    expect(settingsItem?.accelerator).toBe('CmdOrCtrl+,');
    settingsItem?.click?.();
    expect(handlers.onOpenSettings).toHaveBeenCalledTimes(1);

    const quitItem = fileMenu.find((item) => item.label === 'Quit');
    expect(quitItem?.accelerator).toBe('CmdOrCtrl+Q');
    quitItem?.click?.();
    expect(handlers.onRequestQuit).toHaveBeenCalledTimes(1);

    const projectMenu = getSubmenu(template[3]);
    expect(projectMenu.find((item) => item.label === 'Generate CSD to Screen')?.enabled).toBe(false);
    expect(projectMenu.find((item) => item.label === 'Generate Realtime CSD to Screen')?.enabled).toBe(false);
    expect(projectMenu.find((item) => item.label === 'Blue Live')?.enabled).toBe(false);

    const scriptMenu = getSubmenu(template[4]);
    expect(scriptMenu.find((item) => item.label === 'Reinitialize JavaScript Interpreter')?.enabled).not.toBe(false);
    expect(scriptMenu.find((item) => item.label === 'Reinitialize Jython Interpreter')?.enabled).toBe(false);

    const toolsMenu = getSubmenu(template[5]);
    expect(toolsMenu.find((item) => item.label === 'Effects Library')).toBeTruthy();

    const helpMenu = getSubmenu(template[6]);
    helpMenu.find((item) => item.label === 'About Blue')?.click?.();
    expect(handlers.onOpenAbout).toHaveBeenCalledTimes(1);
  });

  it('places the View menu between Edit and Project with Zoom In, Zoom Out, and Actual Size in that order', () => {
    const handlers = createHandlers();
    for (const isDarwin of [true, false]) {
      const template = buildApplicationMenuTemplate({
        hasLoadedProject: false,
        isDarwin,
        recentProjects: [],
        canRevertProject: false,
        followPlaybackEnabled: true,
        followPlaybackOnStartEnabled: true,
        ...handlers,
      });

      const labels = template.map((item) => item.label);
      const editIdx = labels.indexOf('Edit');
      const viewIdx = labels.indexOf('View');
      const projectIdx = labels.indexOf('Project');

      expect(viewIdx).toBeGreaterThan(editIdx);
      expect(projectIdx).toBeGreaterThan(viewIdx);

      const viewMenu = getSubmenu(template.find((item) => item.label === 'View'));
      expect(getLabels(viewMenu)).toEqual(['Zoom In', 'Zoom Out', 'Actual Size']);
    }
  });

  it('uses CommandOrControl+Plus, CommandOrControl+-, and CommandOrControl+0 for the View zoom accelerators', () => {
    const template = buildApplicationMenuTemplate({
      hasLoadedProject: false,
      isDarwin: false,
      recentProjects: [],
      canRevertProject: false,
      followPlaybackEnabled: true,
      followPlaybackOnStartEnabled: true,
      ...createHandlers(),
    });
    const viewMenu = getSubmenu(template.find((item) => item.label === 'View'));

    expect(viewMenu.find((item) => item.label === 'Zoom In')?.accelerator).toBe('CommandOrControl+Plus');
    expect(viewMenu.find((item) => item.label === 'Zoom Out')?.accelerator).toBe('CommandOrControl+-');
    expect(viewMenu.find((item) => item.label === 'Actual Size')?.accelerator).toBe('CommandOrControl+0');
  });

  it('routes each View zoom item to its matching custom callback', () => {
    const handlers = createHandlers();
    const template = buildApplicationMenuTemplate({
      hasLoadedProject: false,
      isDarwin: false,
      recentProjects: [],
      canRevertProject: false,
      followPlaybackEnabled: true,
      followPlaybackOnStartEnabled: true,
      ...handlers,
    });
    const viewMenu = getSubmenu(template.find((item) => item.label === 'View'));

    viewMenu.find((item) => item.label === 'Zoom In')?.click?.();
    viewMenu.find((item) => item.label === 'Zoom Out')?.click?.();
    viewMenu.find((item) => item.label === 'Actual Size')?.click?.();

    expect(handlers.onZoomIn).toHaveBeenCalledOnce();
    expect(handlers.onZoomOut).toHaveBeenCalledOnce();
    expect(handlers.onActualSize).toHaveBeenCalledOnce();
  });

  it('does not attach Electron zoom roles to the View menu items', () => {
    const template = buildApplicationMenuTemplate({
      hasLoadedProject: false,
      isDarwin: false,
      recentProjects: [],
      canRevertProject: false,
      followPlaybackEnabled: true,
      followPlaybackOnStartEnabled: true,
      ...createHandlers(),
    });
    const viewMenu = getSubmenu(template.find((item) => item.label === 'View'));

    for (const item of viewMenu) {
      expect(item.role).toBeUndefined();
    }
    expect(viewMenu.find((item) => item.label === 'Zoom In')?.role).toBeUndefined();
    expect(viewMenu.find((item) => item.label === 'Zoom Out')?.role).toBeUndefined();
    expect(viewMenu.find((item) => item.label === 'Actual Size')?.role).toBeUndefined();
  });

  it('makes the View menu items available without a loaded project', () => {
    const template = buildApplicationMenuTemplate({
      hasLoadedProject: false,
      isDarwin: false,
      recentProjects: [],
      canRevertProject: false,
      followPlaybackEnabled: true,
      followPlaybackOnStartEnabled: true,
      ...createHandlers(),
    });
    const viewMenu = getSubmenu(template.find((item) => item.label === 'View'));

    expect(viewMenu.find((item) => item.label === 'Zoom In')?.enabled).not.toBe(false);
    expect(viewMenu.find((item) => item.label === 'Zoom Out')?.enabled).not.toBe(false);
    expect(viewMenu.find((item) => item.label === 'Actual Size')?.enabled).not.toBe(false);
  });

  it('enables Edit Tempo Map only when a project is loaded and wires the handler', () => {
    const handlers = createHandlers();

    const enabledTemplate = buildApplicationMenuTemplate({
      hasLoadedProject: true,
      isDarwin: false,
      recentProjects: [],
      canRevertProject: false,
      followPlaybackEnabled: true,
      followPlaybackOnStartEnabled: true,
      ...handlers,
    });
    const enabledProjectMenu = getSubmenu(enabledTemplate.find((item) => item.label === 'Project'));
    const enabledEditTempoMap = enabledProjectMenu.find((item) => item.label === 'Edit Tempo Map...');

    expect(enabledEditTempoMap?.enabled).toBe(true);
    enabledEditTempoMap?.click?.();
    expect(handlers.onEditTempoMap).toHaveBeenCalledTimes(1);

    const disabledTemplate = buildApplicationMenuTemplate({
      hasLoadedProject: false,
      isDarwin: false,
      recentProjects: [],
      canRevertProject: false,
      followPlaybackEnabled: true,
      followPlaybackOnStartEnabled: true,
      ...createHandlers(),
    });
    const disabledProjectMenu = getSubmenu(disabledTemplate.find((item) => item.label === 'Project'));
    const disabledEditTempoMap = disabledProjectMenu.find((item) => item.label === 'Edit Tempo Map...');

    expect(disabledEditTempoMap?.enabled).toBe(false);
  });

  it('enables Edit Time Signature Map only when a project is loaded and wires the handler', () => {
    const handlers = createHandlers();

    const enabledTemplate = buildApplicationMenuTemplate({
      hasLoadedProject: true,
      isDarwin: false,
      recentProjects: [],
      canRevertProject: false,
      followPlaybackEnabled: true,
      followPlaybackOnStartEnabled: true,
      ...handlers,
    });
    const enabledProjectMenu = getSubmenu(enabledTemplate.find((item) => item.label === 'Project'));
    const enabledEditMeterMap = enabledProjectMenu.find((item: any) => item.label === 'Edit Time Signature Map...');

    expect(enabledEditMeterMap?.enabled).toBe(true);
    enabledEditMeterMap?.click?.();
    expect(handlers.onEditMeterMap).toHaveBeenCalledTimes(1);

    const disabledTemplate = buildApplicationMenuTemplate({
      hasLoadedProject: false,
      isDarwin: false,
      recentProjects: [],
      canRevertProject: false,
      followPlaybackEnabled: true,
      followPlaybackOnStartEnabled: true,
      ...createHandlers(),
    });
    const disabledProjectMenu = getSubmenu(disabledTemplate.find((item) => item.label === 'Project'));
    const disabledEditMeterMap = disabledProjectMenu.find((item: any) => item.label === 'Edit Time Signature Map...');

    expect(disabledEditMeterMap?.enabled).toBe(false);
  });
});

describe('application menu follow playback mirror (SPEC 079)', () => {
  function buildFollowMenu(followPlaybackEnabled: boolean, followPlaybackOnStartEnabled: boolean, hasLoadedProject: boolean) {
    const handlers = createHandlers();
    const template = buildApplicationMenuTemplate({
      hasLoadedProject,
      isRenderOperationActive: false,
      isDarwin: false,
      recentProjects: [],
      canRevertProject: false,
      followPlaybackEnabled,
      followPlaybackOnStartEnabled,
      ...handlers,
    });
    const projectMenu = getSubmenu(template.find((item: any) => item.label === 'Project'));
    return {
      handlers,
      follow: projectMenu.find((item: any) => item.label === 'Follow playback by scrolling score'),
      onStart: projectMenu.find((item: any) => item.label === 'Enable follow playback on render start'),
    };
  }

  it('mirrors the hydrated saved follow values in the checkbox state', () => {
    const { follow, onStart } = buildFollowMenu(false, false, true);

    expect(follow?.checked).toBe(false);
    expect(onStart?.checked).toBe(false);
  });

  it('reflects an active session suspension through the mirror cache', () => {
    const { follow } = buildFollowMenu(false, true, true);

    expect(follow?.checked).toBe(false);
  });

  it('restores the checkbox when the renderer mirrors the saved value again', () => {
    const { follow } = buildFollowMenu(true, true, true);

    expect(follow?.checked).toBe(true);
  });

  it('disables the follow controls without a loaded project', () => {
    const { follow, onStart } = buildFollowMenu(true, true, false);

    expect(follow?.enabled).toBe(false);
    expect(onStart?.enabled).toBe(false);
  });

  it('wires the follow items to their toggle handlers', () => {
    const { handlers, follow, onStart } = buildFollowMenu(true, true, true);

    follow?.click?.();
    onStart?.click?.();

    expect(handlers.onToggleFollowPlayback).toHaveBeenCalledOnce();
    expect(handlers.onToggleFollowPlaybackOnStart).toHaveBeenCalledOnce();
  });
});
