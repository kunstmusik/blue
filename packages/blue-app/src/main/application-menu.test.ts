import { describe, expect, it, vi } from 'vitest';
import { buildApplicationMenuTemplate } from './application-menu';

function createHandlers() {
  return {
    onNewFile: vi.fn(),
    onOpenFile: vi.fn(),
    onOpenRecentProject: vi.fn(),
    onCloseProject: vi.fn(),
    onRevertProject: vi.fn(),
    onSaveFile: vi.fn(),
    onSaveFileAs: vi.fn(),
    onGenerateCsdToScreen: vi.fn(),
    onGenerateCsdToDisk: vi.fn(),
    onRequestQuit: vi.fn(),
    onOpenSettings: vi.fn(),
    onOpenEffectsLibrary: vi.fn(),
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
    onNotYetImplemented: vi.fn(),
    onAddMarker: vi.fn(),
    onNavigateNextMarker: vi.fn(),
    onNavigatePreviousMarker: vi.fn(),
    onRewindToStart: vi.fn(),
  };
}

function getSubmenu(item: any): any[] {
  return Array.isArray(item.submenu) ? item.submenu : [];
}

function getLabels(items: any[]): Array<string | undefined> {
  return items.map((item) => item.label).filter((label): label is string => Boolean(label));
}

describe('application menu template', () => {
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

    expect(template.map((item) => item.label)).toEqual(['Blue', 'File', 'Edit', 'Project', 'Tools', 'Window']);

    const blueMenu = getSubmenu(template[0]);
    expect(blueMenu.map((item) => item.label)).toContain('About Blue');
    expect(blueMenu.map((item) => item.label)).toContain('Settings...');

    const blueSettings = blueMenu.find((item) => item.label === 'Settings...');
    expect(blueSettings?.accelerator).toBe('Cmd+,');
    blueSettings?.click?.();
    expect(handlers.onOpenSettings).toHaveBeenCalledTimes(1);

    const fileMenu = getSubmenu(template[1]);
    expect(getLabels(fileMenu)).toEqual(['New Project', 'Open Project', 'Open Example Project', 'Import CSD File', 'Import from ORC/SCO', 'Import MIDI File', 'Close Project', 'Revert', 'Save', 'Save as...', 'Render to Disk', 'Render to Disk and Play', 'Render to Disk and Open', 'Save Libraries', 'Recent Projects']);

    const recentMenu = getSubmenu(fileMenu.find((item) => item.label === 'Recent Projects'));
    expect(getLabels(recentMenu)).toEqual(['one.blue', 'two.blue']);
    recentMenu[0]?.click?.();
    expect(handlers.onOpenRecentProject).toHaveBeenCalledWith('/one.blue');

    const projectMenu = getSubmenu(template[3]);
    expect(projectMenu.find((item) => item.label === 'Generate CSD to Screen')).toBeTruthy();
    expect(projectMenu.find((item) => item.label === 'Blue Live')).toBeTruthy();
    projectMenu.find((item) => item.label === 'Generate CSD to Screen')?.click?.();
    expect(handlers.onGenerateCsdToScreen).toHaveBeenCalledTimes(1);

    const toolsMenu = getSubmenu(template[4]);
    expect(toolsMenu.find((item) => item.label === 'Effects Library')).toBeTruthy();
    toolsMenu.find((item) => item.label === 'Effects Library')?.click?.();
    expect(handlers.onOpenEffectsLibrary).toHaveBeenCalledTimes(1);

    const windowMenu = getSubmenu(template[5]);
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

    expect(template.map((item) => item.label)).toEqual(['File', 'Edit', 'Project', 'Tools', 'Window']);

    const fileMenu = getSubmenu(template[0]);
    expect(getLabels(fileMenu)).toEqual(['New Project', 'Open Project', 'Open Example Project', 'Import CSD File', 'Import from ORC/SCO', 'Import MIDI File', 'Close Project', 'Revert', 'Save', 'Save as...', 'Render to Disk', 'Render to Disk and Play', 'Render to Disk and Open', 'Save Libraries', 'Recent Projects', 'Settings...', 'Quit']);

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

    const projectMenu = getSubmenu(template[2]);
    expect(projectMenu.find((item) => item.label === 'Generate CSD to Screen')?.enabled).toBe(false);
    expect(projectMenu.find((item) => item.label === 'Blue Live')?.enabled).toBe(false);

    const toolsMenu = getSubmenu(template[3]);
    expect(toolsMenu.find((item) => item.label === 'Effects Library')).toBeTruthy();
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
    const enabledProjectMenu = getSubmenu(enabledTemplate[2]);
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
    const disabledProjectMenu = getSubmenu(disabledTemplate[2]);
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
    const enabledProjectMenu = getSubmenu(enabledTemplate[2]);
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
    const disabledProjectMenu = getSubmenu(disabledTemplate[2]);
    const disabledEditMeterMap = disabledProjectMenu.find((item: any) => item.label === 'Edit Time Signature Map...');

    expect(disabledEditMeterMap?.enabled).toBe(false);
  });
});
