import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  loadProgramSettings,
  saveProgramSettings,
  resetPanel,
  syncLegacyRendererSettings,
  clearSettingsCache,
  setSettingsFilePathForTesting,
} from './program-settings-store';

let tempDir: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'blue-settings-test-'));
  setSettingsFilePathForTesting(path.join(tempDir, 'program-settings.json'));
  clearSettingsCache();
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
  clearSettingsCache();
});

describe('program-settings-store', () => {
  it('creates defaults when no file exists', () => {
    const settings = loadProgramSettings('darwin');
    expect(settings.version).toBe(1);
    expect(settings.general.messageColorsEnabled).toBe(false);
    expect(settings.realtimeRender.audioDriver).toBe('pa_bl');
  });

  it('persists and reloads settings', () => {
    const settings = loadProgramSettings('darwin');
    settings.general.workDirectory = '/test-dir';
    const result = saveProgramSettings(settings, 'darwin');
    expect(result.ok).toBe(true);

    clearSettingsCache();
    const reloaded = loadProgramSettings('darwin');
    expect(reloaded.general.workDirectory).toBe('/test-dir');
  });

  it('rejects invalid settings', () => {
    const settings = loadProgramSettings('darwin');
    settings.general.directoryTempFileLimit = -1;
    const result = saveProgramSettings(settings, 'darwin');
    expect(result.ok).toBe(false);
    expect(result.validationIssues?.length).toBeGreaterThan(0);
  });

  it('resets a panel to defaults', () => {
    let settings = loadProgramSettings('darwin');
    settings.general.workDirectory = '/changed';
    saveProgramSettings(settings, 'darwin');

    const reset = resetPanel('general', 'darwin');
    expect(reset.general.workDirectory).toBe('');
  });

  it('syncs legacy renderer settings', () => {
    const reset = syncLegacyRendererSettings({
      enginePath: '/my-engine',
      recentFiles: ['/a.blue'],
    }, 'darwin');
    expect(reset.appSpecific.enginePath).toBe('/my-engine');
    expect(reset.appSpecific.recentFiles).toEqual(['/a.blue']);
  });

  it('merges partial saved data with defaults', () => {
    const filePath = path.join(tempDir, 'program-settings.json');
    fs.writeFileSync(filePath, JSON.stringify({ general: { workDirectory: '/partial' } }));
    clearSettingsCache();

    const settings = loadProgramSettings('darwin');
    expect(settings.general.workDirectory).toBe('/partial');
    expect(settings.general.messageColorsEnabled).toBe(false);
    expect(settings.realtimeRender.audioDriver).toBe('pa_bl');
  });

  it('falls back to defaults when the settings file contains corrupted JSON', () => {
    const filePath = path.join(tempDir, 'program-settings.json');
    fs.writeFileSync(filePath, '{ this is not valid JSON !!!');
    clearSettingsCache();

    const settings = loadProgramSettings('darwin');
    expect(settings.version).toBe(1);
    expect(settings.general.workDirectory).toBe('');
  });

  it('falls back to defaults when the settings file is empty', () => {
    const filePath = path.join(tempDir, 'program-settings.json');
    fs.writeFileSync(filePath, '');
    clearSettingsCache();

    const settings = loadProgramSettings('darwin');
    expect(settings.version).toBe(1);
  });
});
