#!/usr/bin/env node
/**
 * SPEC 061 App Zooming acceptance driver.
 *
 * Run after a fresh build:
 *
 *   pnpm --filter @blue/app build
 *   pnpm --filter @blue/app verify:app-zoom
 *
 * The default restart count is the specification's full 100-cycle gate.
 * Set BLUE_APP_ZOOM_RESTART_CYCLES to a smaller positive integer only for
 * local iteration; completion evidence must use the default.
 */

import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAIN_ENTRY = path.join(PACKAGE_ROOT, 'dist', 'main', 'main.js');
const MIN_PERCENT = 50;
const MAX_PERCENT = 300;
const STEP_PERCENT = 10;
const ACCEPTANCE_BROADCAST_MS = 250;
const FACTOR_TOLERANCE = 1e-6;
const RESTART_VALUES = [90, 130, 250];
const RESTART_CYCLES = parseRestartCycles();

const LEGAL_PERCENTS = Array.from(
  { length: ((MAX_PERCENT - MIN_PERCENT) / STEP_PERCENT) + 1 },
  (_, index) => MIN_PERCENT + (index * STEP_PERCENT),
);

function parseRestartCycles() {
  const raw = process.env.BLUE_APP_ZOOM_RESTART_CYCLES ?? '100';
  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`BLUE_APP_ZOOM_RESTART_CYCLES must be a positive integer, got ${raw}`);
  }
  return value;
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isTransientExecutionContextError(error) {
  return String(error?.message ?? error).includes('Execution context was destroyed');
}

function makeTempProfile() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'blue-app-zoom-'));
}

function removeTempProfile(profileDir) {
  fs.rmSync(profileDir, { recursive: true, force: true });
}

function settingsFilePath(profileDir) {
  return path.join(profileDir, 'program-settings.json');
}

function seedAppZoomPercent(profileDir, percent) {
  const filePath = settingsFilePath(profileDir);
  const existing = fs.existsSync(filePath)
    ? JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    : {};
  existing.appSpecific = {
    ...(existing.appSpecific ?? {}),
    appZoomPercent: percent,
  };
  fs.writeFileSync(filePath, JSON.stringify(existing, null, 2));
}

function readAppZoomPercent(profileDir) {
  const filePath = settingsFilePath(profileDir);
  if (!fs.existsSync(filePath)) return null;
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  return parsed?.appSpecific?.appZoomPercent ?? null;
}

async function launchApp(electron, profileDir) {
  return electron.launch({
    args: [PACKAGE_ROOT, `--user-data-dir=${profileDir}`],
    cwd: PACKAGE_ROOT,
    env: {
      ...process.env,
      BLUE_VERIFY_MODE: 'app-zoom',
    },
  });
}

async function waitForMainPage(electronApp) {
  const page = await electronApp.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  return page;
}

async function readWindowStates(electronApp) {
  return electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()
    .filter((window) => !window.isDestroyed() && !window.webContents.isDestroyed())
    .map((window) => ({
      title: window.getTitle(),
      url: window.webContents.getURL(),
      zoomFactor: window.webContents.getZoomFactor(),
      visible: window.isVisible(),
    })));
}

function factorsMatch(states, expectedFactor) {
  return states.length > 0 && states.every(
    ({ zoomFactor }) => Math.abs(zoomFactor - expectedFactor) <= FACTOR_TOLERANCE,
  );
}

async function waitForWindowStates(electronApp, predicate, description, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  let states = [];
  while (Date.now() <= deadline) {
    try {
      states = await readWindowStates(electronApp);
    } catch (error) {
      if (!isTransientExecutionContextError(error)) throw error;
      await sleep(10);
      continue;
    }
    if (predicate(states)) return states;
    await sleep(10);
  }
  throw new Error(`${description}; last states=${JSON.stringify(states)}`);
}

async function waitForAllFactors(electronApp, percent, minimumWindows = 1) {
  const expectedFactor = percent / 100;
  return waitForWindowStates(
    electronApp,
    (states) => states.length >= minimumWindows && factorsMatch(states, expectedFactor),
    `expected at least ${minimumWindows} window(s) at zoom factor ${expectedFactor}`,
  );
}

async function waitForPersistedPercent(profileDir, percent) {
  const deadline = Date.now() + 2_000;
  while (Date.now() <= deadline) {
    if (readAppZoomPercent(profileDir) === percent) return;
    await sleep(10);
  }
  throw new Error(`expected persisted app zoom ${percent}, got ${readAppZoomPercent(profileDir)}`);
}

async function invokeMenuItem(electronApp, label) {
  try {
    await electronApp.evaluate(({ Menu }, itemLabel) => {
      const menu = Menu.getApplicationMenu();
      const viewMenu = menu?.items.find((item) => item.label === 'View');
      const target = viewMenu?.submenu?.items.find((item) => item.label === itemLabel);
      if (!target) throw new Error(`View > ${itemLabel} is unavailable`);
      target.click();
    }, label);
  } catch (error) {
    // Chromium may replace a renderer execution context while page zoom is
    // being applied. The menu callback already ran synchronously; the caller
    // always verifies the resulting factor before proceeding.
    if (!isTransientExecutionContextError(error)) throw error;
  }
}

async function setZoomPercent(electronApp, profileDir, percent) {
  await invokeMenuItem(electronApp, 'Actual Size');
  await waitForAllFactors(electronApp, 100);
  let current = 100;
  while (current < percent) {
    await invokeMenuItem(electronApp, 'Zoom In');
    current += STEP_PERCENT;
    await waitForAllFactors(electronApp, current);
  }
  while (current > percent) {
    await invokeMenuItem(electronApp, 'Zoom Out');
    current -= STEP_PERCENT;
    await waitForAllFactors(electronApp, current);
  }
  await waitForPersistedPercent(profileDir, percent);
}

async function focusSentinelInput(page) {
  await page.evaluate(() => {
    let input = document.querySelector('#app-zoom-shortcut-sentinel');
    if (!(input instanceof HTMLInputElement)) {
      input = document.createElement('input');
      input.id = 'app-zoom-shortcut-sentinel';
      document.body.append(input);
    }
    input.value = 'shortcut-sentinel';
    input.focus();
  });
}

async function assertSentinelUnchanged(page) {
  const value = await page.locator('#app-zoom-shortcut-sentinel').inputValue();
  assert.equal(value, 'shortcut-sentinel');
}

async function verifyLegalFactorsAndBounds(electron) {
  const profileDir = makeTempProfile();
  seedAppZoomPercent(profileDir, 100);
  const app = await launchApp(electron, profileDir);
  try {
    await waitForMainPage(app);
    for (const percent of LEGAL_PERCENTS) {
      await setZoomPercent(app, profileDir, percent);
    }

    await invokeMenuItem(app, 'Zoom Out');
    await waitForAllFactors(app, 290);
    await setZoomPercent(app, profileDir, MIN_PERCENT);
    await invokeMenuItem(app, 'Zoom Out');
    await waitForAllFactors(app, MIN_PERCENT);
    assert.equal(readAppZoomPercent(profileDir), MIN_PERCENT);

    await setZoomPercent(app, profileDir, MAX_PERCENT);
    await invokeMenuItem(app, 'Zoom In');
    await waitForAllFactors(app, MAX_PERCENT);
    assert.equal(readAppZoomPercent(profileDir), MAX_PERCENT);

    await invokeMenuItem(app, 'Actual Size');
    await waitForAllFactors(app, 100);
    await waitForPersistedPercent(profileDir, 100);
  } finally {
    await app.close();
    removeTempProfile(profileDir);
  }
  console.log(`[verify:app-zoom] PASS: ${LEGAL_PERCENTS.length} factors, bounds, and Actual Size.`);
}

async function verifyMenuContractWithFocusedControl(electron) {
  const profileDir = makeTempProfile();
  seedAppZoomPercent(profileDir, 100);
  const app = await launchApp(electron, profileDir);
  try {
    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await focusSentinelInput(page);

    const menuContract = await app.evaluate(({ Menu }) => {
      const viewMenu = Menu.getApplicationMenu()?.items.find((item) => item.label === 'View');
      return viewMenu?.submenu?.items.map(({ label, accelerator, role }) => ({
        label,
        accelerator: accelerator ?? null,
        role: role ?? null,
      })) ?? [];
    });
    assert.deepEqual(menuContract, [
      { label: 'Zoom In', accelerator: 'CommandOrControl+Plus', role: null },
      { label: 'Zoom Out', accelerator: 'CommandOrControl+-', role: null },
      { label: 'Actual Size', accelerator: 'CommandOrControl+0', role: null },
    ]);

    await invokeMenuItem(app, 'Zoom In');
    await waitForAllFactors(app, 110);
    await assertSentinelUnchanged(page);

    await invokeMenuItem(app, 'Zoom Out');
    await waitForAllFactors(app, 100);
    await assertSentinelUnchanged(page);

    await invokeMenuItem(app, 'Zoom In');
    await waitForAllFactors(app, 110);
    await invokeMenuItem(app, 'Actual Size');
    await waitForAllFactors(app, 100);
    await assertSentinelUnchanged(page);
  } finally {
    await app.close();
    removeTempProfile(profileDir);
  }
  console.log('[verify:app-zoom] PASS: menu contract and callbacks while an interactive control is focused.');
}

async function openRepresentativeWindows(mainPage) {
  return mainPage.evaluate(async () => {
    const staleDraft = await window.blueAPI.getProgramSettings();
    await window.blueAPI.openSettingsWindow();
    await window.blueAPI.openEffectInterface({
      ownerType: 'project',
      effectId: 'verify-app-zoom-effect',
      projectRef: {
        channelId: 'verify-channel',
        chain: 'pre',
        entryId: 'verify-app-zoom-effect',
      },
    });
    window.open('popout.html?verify-app-zoom=1', 'verify-app-zoom-popout');
    return staleDraft;
  });
}

function hasRepresentativeWindows(states) {
  return states.some(({ url }) => /index\.html/.test(url))
    && states.some(({ url }) => /settings\.html/.test(url))
    && states.some(({ url }) => /effect-editor\.html/.test(url))
    && states.some(({ url }) => /popout\.html/.test(url));
}

async function verifyMultiWindowAndStaleDraft(electron) {
  const profileDir = makeTempProfile();
  seedAppZoomPercent(profileDir, 100);
  const app = await launchApp(electron, profileDir);
  try {
    const mainPage = await app.firstWindow();
    await mainPage.waitForLoadState('domcontentloaded');
    await setZoomPercent(app, profileDir, 120);
    const staleDraft = await openRepresentativeWindows(mainPage);
    await waitForWindowStates(
      app,
      (states) => states.length >= 4 && hasRepresentativeWindows(states) && factorsMatch(states, 1.2),
      'representative main, Settings, effect, and popout windows were not created at factor 1.2',
    );

    const settingsPage = app.windows().find((page) => /settings\.html/.test(page.url()));
    assert.ok(settingsPage, 'Settings Playwright page was not found');
    await settingsPage.bringToFront();
    await focusSentinelInput(settingsPage);
    const startedAt = Date.now();
    await invokeMenuItem(app, 'Zoom In');
    await waitForAllFactors(app, 130, 4);
    const elapsed = Date.now() - startedAt;
    assert.ok(
      elapsed <= ACCEPTANCE_BROADCAST_MS,
      `representative-window broadcast took ${elapsed}ms, limit=${ACCEPTANCE_BROADCAST_MS}ms`,
    );
    await assertSentinelUnchanged(settingsPage);

    const saveResult = await mainPage.evaluate(
      (snapshot) => window.blueAPI.saveProgramSettings(snapshot),
      staleDraft,
    );
    assert.equal(saveResult.ok, true);
    assert.equal(saveResult.snapshot?.appSpecific.appZoomPercent, 130);
    await waitForPersistedPercent(profileDir, 130);
    await waitForAllFactors(app, 130, 4);
  } finally {
    await app.close();
    removeTempProfile(profileDir);
  }
  console.log(`[verify:app-zoom] PASS: representative multi-window broadcast in <= ${ACCEPTANCE_BROADCAST_MS}ms and stale-draft protection.`);
}

async function verifyRestarts(electron) {
  const profileDir = makeTempProfile();
  seedAppZoomPercent(profileDir, 100);
  let app = await launchApp(electron, profileDir);
  try {
    await waitForMainPage(app);
    for (let index = 0; index < RESTART_CYCLES; index += 1) {
      const percent = RESTART_VALUES[index % RESTART_VALUES.length];
      await setZoomPercent(app, profileDir, percent);
      await app.close();

      app = await launchApp(electron, profileDir);
      const page = await app.firstWindow();
      await waitForAllFactors(app, percent);
      assert.equal(readAppZoomPercent(profileDir), percent);
      await page.waitForLoadState('domcontentloaded');

      if ((index + 1) % 10 === 0 || index + 1 === RESTART_CYCLES) {
        console.log(`[verify:app-zoom] Restart progress: ${index + 1}/${RESTART_CYCLES}`);
      }
    }
  } finally {
    await app.close().catch(() => {});
    removeTempProfile(profileDir);
  }
  console.log(`[verify:app-zoom] PASS: ${RESTART_CYCLES} same-profile restarts across ${RESTART_VALUES.length} non-default values.`);
}

async function verifyMalformedSettings(electron) {
  const cases = [null, 'string', 49, 301, 105, 100.5];
  for (const value of cases) {
    const profileDir = makeTempProfile();
    seedAppZoomPercent(profileDir, value);
    const app = await launchApp(electron, profileDir);
    try {
      await app.firstWindow();
      await waitForAllFactors(app, 100);
    } finally {
      await app.close();
      removeTempProfile(profileDir);
    }
  }
  console.log('[verify:app-zoom] PASS: malformed persisted values fall back to 100%.');
}

async function verifyWriteFailureRecovery(electron) {
  const profileDir = makeTempProfile();
  seedAppZoomPercent(profileDir, 100);
  let app = await launchApp(electron, profileDir);
  try {
    await waitForMainPage(app);
    const blockedTempPath = `${settingsFilePath(profileDir)}.tmp`;
    fs.mkdirSync(blockedTempPath);

    await invokeMenuItem(app, 'Zoom In');
    await waitForAllFactors(app, 110);
    assert.equal(readAppZoomPercent(profileDir), 100);

    fs.rmdirSync(blockedTempPath);
    await invokeMenuItem(app, 'Zoom In');
    await waitForAllFactors(app, 120);
    await waitForPersistedPercent(profileDir, 120);

    await app.close();
    app = await launchApp(electron, profileDir);
    await app.firstWindow();
    await waitForAllFactors(app, 120);
  } finally {
    await app.close().catch(() => {});
    removeTempProfile(profileDir);
  }
  console.log('[verify:app-zoom] PASS: write failure keeps runtime zoom and a later save restores after restart.');
}

async function run() {
  if (!fs.existsSync(MAIN_ENTRY)) {
    throw new Error(`${MAIN_ENTRY} is missing; run pnpm --filter @blue/app build first`);
  }

  await verifyLegalFactorsAndBounds(electron);
  await verifyMenuContractWithFocusedControl(electron);
  await verifyMultiWindowAndStaleDraft(electron);
  await verifyRestarts(electron);
  await verifyMalformedSettings(electron);
  await verifyWriteFailureRecovery(electron);
  console.log('[verify:app-zoom] All acceptance checks passed.');
}

run().catch((error) => {
  console.error(`[verify:app-zoom] FAIL: ${error?.stack ?? error?.message ?? String(error)}`);
  process.exitCode = 1;
});
