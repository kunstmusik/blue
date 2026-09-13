#!/usr/bin/env node
/**
 * Native Electron acceptance driver for global project Undo/Redo.
 *
 * This opens a disposable project in the packaged application, changes the
 * title through the real preload bridge, then invokes the native application
 * menu. Each reversal is checked in the production Project Properties panel
 * after two painted frames. The separate manual checklist covers OS-level
 * physical accelerator delivery; Playwright page key events do not enter
 * Electron's native menu accelerator path.
 *
 * Usage:
 *   node packages/blue-app/scripts/verify-global-project-history.mjs \
 *     [--binary <path>] [--blue-file <path>] [--profile <path>]
 */

import { existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright';
import { parseFlags } from '../../../scripts/parse-cli-flags.mjs';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '..', '..', '..');
const appRoot = join(repositoryRoot, 'packages', 'blue-app');
const releaseRoot = join(appRoot, 'release');
const defaultProject = join(repositoryRoot, 'fixtures', 'smoke-test.blue');
const timeoutMs = 60_000;

function isExecutableFile(filePath) {
  try {
    return statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function defaultPackageDirectories() {
  if (process.platform === 'darwin') {
    return [join(releaseRoot, 'mac-arm64'), join(releaseRoot, 'mac')];
  }
  if (process.platform === 'win32') return [join(releaseRoot, 'win-unpacked')];
  return [join(releaseRoot, 'linux-unpacked')];
}

function binaryInside(packageDirectory) {
  if (process.platform === 'darwin') {
    return join(packageDirectory, 'Blue.app', 'Contents', 'MacOS', 'Blue');
  }
  return join(packageDirectory, process.platform === 'win32' ? 'Blue.exe' : 'Blue');
}

function resolveBinary(flagValue) {
  if (flagValue) {
    const binary = resolve(flagValue);
    if (!isExecutableFile(binary)) throw new Error(`--binary is not executable: ${binary}`);
    return binary;
  }
  const environmentBinary = process.env.BLUE_ELECTRON_BINARY?.trim();
  if (environmentBinary) return resolveBinary(environmentBinary);
  for (const packageDirectory of defaultPackageDirectories()) {
    if (!existsSync(packageDirectory)) continue;
    const binary = binaryInside(packageDirectory);
    if (isExecutableFile(binary)) return binary;
  }
  throw new Error(
    'No packaged Blue binary found. Run `pnpm --filter @blue/app package:dir` or pass --binary.',
  );
}

function minimalEnvironment(profilePath) {
  const environment = {
    HOME: process.env.HOME ?? '',
    PATH: process.env.PATH ?? '',
    TMPDIR: process.env.TMPDIR ?? '',
    LANG: process.env.LANG ?? '',
    BLUE_VERIFY_USER_DATA_PATH: profilePath,
    ELECTRON_DISABLE_SECURITY_WARNINGS: '1',
  };
  if (process.platform === 'win32') {
    environment.APPDATA = process.env.APPDATA ?? '';
    environment.USERPROFILE = process.env.USERPROFILE ?? '';
    environment.TEMP = process.env.TEMP ?? '';
    environment.TMP = process.env.TMP ?? '';
    environment.LOCALAPPDATA = process.env.LOCALAPPDATA ?? '';
  }
  if (process.env.DISPLAY) environment.DISPLAY = process.env.DISPLAY;
  if (process.env.XAUTHORITY) environment.XAUTHORITY = process.env.XAUTHORITY;
  return environment;
}

function sleep(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

async function waitForTitle(input, expected) {
  const deadline = Date.now() + timeoutMs;
  let actual = '';
  while (Date.now() <= deadline) {
    actual = await input.inputValue();
    if (actual === expected) return;
    await sleep(10);
  }
  throw new Error(
    `Timed out waiting for title ${JSON.stringify(expected)}; got ${JSON.stringify(actual)}`,
  );
}

async function waitForPaint(page) {
  await page.evaluate(
    () =>
      new Promise((resolvePromise) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolvePromise()));
      }),
  );
}

async function revealProjectProperties(electronApp) {
  await electronApp.evaluate(({ BrowserWindow }) => {
    const target = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
    target?.webContents.send('native-menu-command', {
      type: 'focus-panel',
      panelId: 'ProjectPropertiesTopComponent',
    });
  });
}

async function waitForProjectTitleInput(page, electronApp) {
  const titleInput = page.locator('label').filter({ hasText: 'Title' }).locator('input').first();
  try {
    await titleInput.waitFor({ state: 'visible', timeout: 5_000 });
  } catch {
    await revealProjectProperties(electronApp);
    await titleInput.waitFor({ state: 'visible', timeout: timeoutMs });
  }
  return titleInput;
}

async function waitForCanonicalTitle(page, expected) {
  const deadline = Date.now() + timeoutMs;
  let actual = null;
  while (Date.now() <= deadline) {
    const state = await page.evaluate(async () => {
      const snapshot = await window.blueAPI.getProjectDocument();
      const history = await window.blueAPI.readProjectHistory();
      return {
        title: snapshot?.projectProperties.title ?? null,
        historySettled: !('status' in history) && history.canUndo,
      };
    });
    actual = state.title;
    if (state.title === expected && state.historySettled) return;
    await sleep(10);
  }
  throw new Error(
    `Timed out waiting for canonical title ${JSON.stringify(expected)}; got ${JSON.stringify(actual)}`,
  );
}

async function commitTitle(page, input, title) {
  await input.fill(title);
  await input.blur();
  await waitForTitle(input, title);
  await waitForCanonicalTitle(page, title);
}

async function clickHistoryMenuItem(electronApp, type) {
  await electronApp.evaluate(({ Menu }, menuType) => {
    const prefix = menuType === 'undo' ? 'Undo' : 'Redo';
    const findItem = (items) => {
      for (const item of items) {
        if (item.label?.startsWith(prefix)) return item;
        const nested = item.submenu ? findItem(item.submenu.items) : null;
        if (nested) return nested;
      }
      return null;
    };
    const item = findItem(Menu.getApplicationMenu()?.items ?? []);
    if (!item || typeof item.click !== 'function') {
      throw new Error(`Native ${menuType} menu item is unavailable`);
    }
    item.click();
  }, type);
}

async function sendMeasuredMenuCommand(electronApp, input, type, expectedTitle) {
  const startedAt = performance.now();
  await clickHistoryMenuItem(electronApp, type);
  await waitForTitle(input, expectedTitle);
  await waitForPaint(input.page());
  return performance.now() - startedAt;
}

function percentile(values, percent) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(Math.floor((percent / 100) * sorted.length), sorted.length - 1)] ?? 0;
}

async function run() {
  const flags = parseFlags(process.argv.slice(2), { acceptEmptyValues: false });
  const binary = resolveBinary(flags.binary);
  const projectPath = resolve(flags['blue-file'] ?? defaultProject);
  if (!existsSync(projectPath)) throw new Error(`Project file does not exist: ${projectPath}`);

  const profilePath = flags.profile
    ? resolve(flags.profile)
    : mkdtempSync(join(tmpdir(), 'blue-history-t116-'));
  let removeProfile = !flags.profile;
  let electronApp;
  try {
    electronApp = await electron.launch({
      executablePath: binary,
      // Blue opens files through its project lifecycle IPC path; a bare
      // packaged Electron launch does not treat arbitrary argv entries as
      // project files.
      args: [],
      env: minimalEnvironment(profilePath),
      timeout: timeoutMs,
    });
    electronApp.process().stderr?.on('data', (chunk) => {
      process.stderr.write(String(chunk));
    });

    const page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await page.evaluate(async (filePath) => {
      const openedPath = await window.blueAPI.openFilePath(filePath);
      if (!openedPath) throw new Error(`Could not open project: ${filePath}`);
    }, projectPath);
    const titleInput = await waitForProjectTitleInput(page, electronApp);
    await waitForTitle(titleInput, 'Smoke Test');

    let currentTitle = 'Smoke Test';
    for (let index = 0; index < 5; index += 1) {
      const nextTitle = `T116 warmup ${index}`;
      await commitTitle(page, titleInput, nextTitle);
      await waitForTitle(titleInput, nextTitle);
      await sendMeasuredMenuCommand(electronApp, titleInput, 'undo', currentTitle);
      await sendMeasuredMenuCommand(electronApp, titleInput, 'redo', nextTitle);
      currentTitle = nextTitle;
    }

    const undoLatencies = [];
    const redoLatencies = [];
    const heapBefore = await page.evaluate(() => {
      const memory = performance.memory;
      return typeof memory?.usedJSHeapSize === 'number' ? memory.usedJSHeapSize : null;
    });
    for (let index = 0; index < 100; index += 1) {
      const nextTitle = `T116 measured ${index}`;
      const previousTitle = currentTitle;
      await commitTitle(page, titleInput, nextTitle);
      await waitForTitle(titleInput, nextTitle);
      undoLatencies.push(
        await sendMeasuredMenuCommand(electronApp, titleInput, 'undo', previousTitle),
      );
      redoLatencies.push(await sendMeasuredMenuCommand(electronApp, titleInput, 'redo', nextTitle));
      currentTitle = nextTitle;
    }
    const heapAfter = await page.evaluate(() => {
      const memory = performance.memory;
      return typeof memory?.usedJSHeapSize === 'number' ? memory.usedJSHeapSize : null;
    });
    const documentId = await page.evaluate(async () => {
      const snapshot = await window.blueAPI.getProjectDocument();
      return snapshot?.documentId ?? null;
    });
    const history = documentId
      ? await page.evaluate(
          (id) => window.blueAPI.readProjectHistory({ documentId: id }),
          documentId,
        )
      : null;

    const metrics = {
      samplesPerDirection: 100,
      undoMs: {
        p50: percentile(undoLatencies, 50),
        p95: percentile(undoLatencies, 95),
        max: Math.max(...undoLatencies),
      },
      redoMs: {
        p50: percentile(redoLatencies, 50),
        p95: percentile(redoLatencies, 95),
        max: Math.max(...redoLatencies),
      },
      retainedBytes: 'status' in (history ?? {}) ? null : (history?.retainedBytes ?? null),
      heapDeltaBytes: heapBefore !== null && heapAfter !== null ? heapAfter - heapBefore : null,
    };
    process.stdout.write(`[T116 native Electron boundary metrics] ${JSON.stringify(metrics)}\n`);
    if (metrics.undoMs.p95 > 200 || metrics.redoMs.p95 > 200) {
      throw new Error(
        `Native command-to-painted-view p95 exceeded 200 ms: ${JSON.stringify(metrics)}`,
      );
    }
  } finally {
    if (electronApp) {
      try {
        await electronApp.evaluate(({ app }) => app.exit(0));
      } catch {
        // The verifier may already be tearing down after a renderer failure.
      }
      try {
        await electronApp.close();
      } catch {
        // Ignore a process that exited through app.exit.
      }
    }
    if (removeProfile) rmSync(profilePath, { recursive: true, force: true });
  }
}

run().catch((error) => {
  process.stderr.write(
    `[FAIL] T116 native Electron acceptance: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
