import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createContext, runInContext } from 'node:vm';
import { createSourceFile, isFunctionDeclaration, ScriptTarget, transpileModule } from 'typescript';
import { describe, expect, it } from 'vitest';
import { buildApplicationMenuTemplate } from './application-menu';

// Exercise the actual menu installation without starting Electron's other services.
const source = createSourceFile(
  'main.ts',
  readFileSync(join(__dirname, 'main.ts'), 'utf8'),
  ScriptTarget.Latest,
);
const functionNames = new Set([
  'rebuildApplicationMenu',
  'applyWindowMenuBarVisibility',
  'handleBrowserWindowCreated',
]);
const functions = source.statements
  .filter((node) => isFunctionDeclaration(node) && functionNames.has(node.name?.text ?? ''))
  .map((node) => node.getText(source));
const executable = transpileModule(functions.join('\n'), {
  compilerOptions: { target: ScriptTarget.ES2022 },
}).outputText;

function setup(platform: NodeJS.Platform) {
  let applicationMenu: unknown = null;
  const windows: Array<{
    menu: unknown;
    menuBarVisible: boolean;
    autoHideMenuBar: boolean;
    setMenu(menu: unknown): void;
  }> = [];
  function createWindow() {
    const window = {
      menu: applicationMenu,
      menuBarVisible: true,
      autoHideMenuBar: true,
      setMenu(menu: unknown) {
        this.menu = menu;
        this.menuBarVisible = true;
      },
      setMenuBarVisibility(visible: boolean) {
        this.menuBarVisible = visible;
      },
      setAutoHideMenuBar(hide: boolean) {
        this.autoHideMenuBar = hide;
      },
      webContents: { on() {} },
    };
    windows.push(window);
    context.createdWindow = window;
    runInContext('handleBrowserWindowCreated({}, createdWindow);', context);
    return window;
  }
  const context = createContext({
    process: { platform },
    mainWindow: null,
    BrowserWindow: { getFocusedWindow: () => null, getAllWindows: () => windows },
    appZoomController: { applyToWindow() {} },
    Menu: {
      buildFromTemplate: (items: unknown[]) => ({ items }),
      setApplicationMenu(menu: unknown) {
        applicationMenu = menu;
        // Electron applies application menus to every existing window on Linux/Windows.
        if (platform !== 'darwin') windows.forEach((window) => window.setMenu(menu));
      },
    },
    buildApplicationMenuTemplate,
    projectHistory: { read: () => ({ canUndo: false, canRedo: false }) },
    hasLoadedProject: () => false,
    getCurrentFilePath: () => null,
    getRecentProjectFilesSnapshot: () => [],
    activeRenderOperationId: null,
    canAuditionScoreObjects: false,
    currentFollowPlaybackEnabled: false,
    currentFollowPlaybackOnStartEnabled: false,
  });
  runInContext(executable, context);
  const mainWindow = createWindow();
  context.mainWindow = mainWindow;
  return {
    mainWindow,
    createWindow,
    rebuild: () => runInContext('rebuildApplicationMenu();', context),
    getApplicationMenu: () => applicationMenu,
  };
}

describe('application menu bar visibility', () => {
  it.each(['linux', 'win32'] as const)(
    'shows only the main menu bar while preserving secondary shortcuts across rebuilds on %s',
    (platform) => {
      const app = setup(platform);
      const existingPopup = app.createWindow();
      expect(existingPopup.menuBarVisible).toBe(false);
      app.rebuild();
      const initialMenu = app.mainWindow.menu;
      expect(initialMenu).not.toBeNull();
      expect(app.mainWindow.menuBarVisible).toBe(true);
      expect(existingPopup.menuBarVisible).toBe(false);
      const newPopup = app.createWindow();
      expect(newPopup.menuBarVisible).toBe(false);

      app.rebuild();
      expect(app.mainWindow.menu).not.toBe(initialMenu);
      expect(app.mainWindow.menu).not.toBeNull();
      expect(app.mainWindow.menuBarVisible).toBe(true);
      for (const popup of [existingPopup, newPopup]) {
        expect(popup.menuBarVisible).toBe(false);
        expect(popup.autoHideMenuBar).toBe(false);
        expect(popup.menu).toBe(app.getApplicationMenu());
      }
    },
  );

  it('retains the shared application menu on macOS', () => {
    const app = setup('darwin');
    const popup = app.createWindow();
    app.rebuild();
    expect(app.getApplicationMenu()).not.toBeNull();
    expect(app.mainWindow.menu).toBeNull();
    expect(popup.menuBarVisible).toBe(true);
    expect(popup.autoHideMenuBar).toBe(true);
  });
});
