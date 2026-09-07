#!/usr/bin/env node

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { _electron as electron } from 'playwright';

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const appRoot = path.resolve(argument('--app-root', path.resolve(import.meta.dirname, '..')));
const outputRoot = path.resolve(argument('--out', path.join(appRoot, 'review-images')));
const projectPath = path.resolve(
  argument('--project', path.join(appRoot, '..', '..', 'examples', 'features', 'mixer.blue')),
);
const bsbProjectPath = path.resolve(
  argument('--bsb-project', path.join(appRoot, '..', '..', 'fixtures', 'smoke-test.blue')),
);
const capture = argument('--capture', 'standard');
const profilePath = fs.mkdtempSync(path.join(os.tmpdir(), 'blue-accessibility-review-'));

fs.mkdirSync(outputRoot, { recursive: true });

const electronApp = await electron.launch({
  args: [appRoot, `--user-data-dir=${profilePath}`],
  cwd: appRoot,
  env: {
    ...process.env,
    BLUE_VERIFY_MODE: 'accessibility-review',
    BLUE_VERIFY_USER_DATA_PATH: profilePath,
  },
});

try {
  const mainPage = await electronApp.firstWindow();
  await mainPage.waitForLoadState('domcontentloaded');
  await electronApp.evaluate(({ BrowserWindow }) => {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    mainWindow.setContentSize(1440, 900);
    mainWindow.center();
  });
  await mainPage.waitForTimeout(500);
  await mainPage.screenshot({ path: path.join(outputRoot, 'workbench.png') });

  if (capture === 'status-repl') {
    await electronApp.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.webContents.send('native-menu-command', {
        type: 'focus-panel',
        panelId: 'JavaScriptConsoleTopComponent',
      });
    });
    await mainPage.waitForTimeout(500);
    await mainPage.screenshot({ path: path.join(outputRoot, 'status-repl.png') });
  } else if (capture === 'status-midi') {
    const settingsWindow = electronApp.waitForEvent('window');
    await mainPage.evaluate(() => window.blueAPI.openSettingsWindow());
    const settingsPage = await settingsWindow;
    await settingsPage.waitForLoadState('domcontentloaded');
    await settingsPage.getByRole('button', { name: 'MIDI' }).click();
    await settingsPage.waitForTimeout(300);
    await settingsPage.screenshot({ path: path.join(outputRoot, 'status-midi.png') });
    await settingsPage.close();
  } else if (capture === 'status-muted') {
    await mainPage.evaluate((filePath) => window.blueAPI.openFilePath(filePath), projectPath);
    await mainPage.waitForTimeout(750);
    await electronApp.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.webContents.send('native-menu-command', {
        type: 'focus-panel',
        panelId: 'ScoreTopComponent',
      });
    });
    await mainPage.waitForTimeout(300);
    await mainPage.getByTitle('Mute').first().click();
    await mainPage.waitForTimeout(300);
    await mainPage.screenshot({ path: path.join(outputRoot, 'status-muted-layer.png') });
  } else if (capture === 'focus') {
    await mainPage.keyboard.press('Tab');
    await mainPage.getByRole('button', { name: 'New Project' }).focus();
    await mainPage.waitForTimeout(150);
    await mainPage.screenshot({ path: path.join(outputRoot, 'focus-toolbar.png') });
  } else if (capture === 'bsb') {
    await mainPage.evaluate((filePath) => window.blueAPI.openFilePath(filePath), bsbProjectPath);
    await mainPage.waitForTimeout(750);
    await electronApp.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.webContents.send('native-menu-command', {
        type: 'focus-panel',
        panelId: 'OrchestraTopComponent',
      });
    });
    await mainPage.waitForTimeout(500);
    const missingAudioDialog = mainPage.getByRole('dialog', {
      name: 'Locate Missing Audio Files',
    });
    if (await missingAudioDialog.isVisible()) {
      await missingAudioDialog.getByRole('button', { name: 'Cancel' }).click();
    }
    const firstAssignment = mainPage.locator('[data-assignment-id]').first();
    if (await firstAssignment.isVisible()) {
      await firstAssignment.click();
      await mainPage.waitForTimeout(500);
    }
    await mainPage.screenshot({ path: path.join(outputRoot, 'bsb.png') });
  } else {
    await mainPage.evaluate((filePath) => window.blueAPI.openFilePath(filePath), projectPath);
    await mainPage.waitForTimeout(500);
    await mainPage.screenshot({ path: path.join(outputRoot, 'status-toast.png') });
    await mainPage.waitForTimeout(500);
    await mainPage.screenshot({ path: path.join(outputRoot, 'score-mixer-project.png') });

    await electronApp.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.webContents.send('native-menu-command', {
        type: 'focus-panel',
        panelId: 'ScoreTopComponent',
      });
    });
    await mainPage.waitForTimeout(500);
    await mainPage.screenshot({ path: path.join(outputRoot, 'score.png') });

    await mainPage.getByRole('button', { name: 'Manage' }).click();
    await mainPage.waitForTimeout(250);
    await mainPage.screenshot({ path: path.join(outputRoot, 'modal.png') });
    await mainPage.getByRole('button', { name: 'Close' }).click();

    await electronApp.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.webContents.send('native-menu-command', {
        type: 'focus-panel',
        panelId: 'MixerTopComponent',
      });
    });
    await mainPage.waitForTimeout(500);
    await mainPage.screenshot({ path: path.join(outputRoot, 'mixer.png') });

    const settingsWindow = electronApp.waitForEvent('window');
    await mainPage.evaluate(() => window.blueAPI.openSettingsWindow());
    const settingsPage = await settingsWindow;
    await settingsPage.waitForLoadState('domcontentloaded');
    await settingsPage.waitForTimeout(500);
    await settingsPage.screenshot({ path: path.join(outputRoot, 'settings.png') });
    await settingsPage.close();
  }
} finally {
  electronApp.process().kill();
  fs.rmSync(profilePath, { recursive: true, force: true });
}

process.exit(0);
