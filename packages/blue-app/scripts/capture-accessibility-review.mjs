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

  await mainPage.evaluate((filePath) => window.blueAPI.openFilePath(filePath), projectPath);
  await mainPage.waitForTimeout(1_000);
  await mainPage.screenshot({ path: path.join(outputRoot, 'score-mixer-project.png') });

  const settingsWindow = electronApp.waitForEvent('window');
  await mainPage.evaluate(() => window.blueAPI.openSettingsWindow());
  const settingsPage = await settingsWindow;
  await settingsPage.waitForLoadState('domcontentloaded');
  await settingsPage.waitForTimeout(500);
  await settingsPage.screenshot({ path: path.join(outputRoot, 'settings.png') });
} finally {
  electronApp.process().kill();
  fs.rmSync(profilePath, { recursive: true, force: true });
}
