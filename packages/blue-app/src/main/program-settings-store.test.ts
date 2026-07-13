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

  it('creates default midiInput preferences when none are saved', () => {
    const settings = loadProgramSettings('darwin');
    expect(settings.midiInput).toEqual({ devices: [] });
  });

  it('normalizes and dedupes structured midiInput preferences on load', () => {
    const filePath = path.join(tempDir, 'program-settings.json');
    const base = loadProgramSettings('darwin');
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        ...base,
        midiInput: {
          devices: [
            { id: 'a', name: 'A', enabled: true },
            { id: 'a', name: 'A2', enabled: false },
            { id: 'b', name: 'B', enabled: true },
            { id: '', name: 'dropped', enabled: false },
          ],
        },
      }),
    );
    clearSettingsCache();

    const settings = loadProgramSettings('darwin');
    // last valid enabled wins (false for 'a'), dedupe, enabled-first order
    expect(settings.midiInput.devices.map((d) => d.id)).toEqual(['b', 'a']);
    expect(settings.midiInput.devices.find((d) => d.id === 'a')?.enabled).toBe(false);
  });

  it('preserves legacy appSpecific.midiInputDevice and midiOutputDevice values', () => {
    const filePath = path.join(tempDir, 'program-settings.json');
    const base = loadProgramSettings('darwin');
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        ...base,
        appSpecific: {
          ...base.appSpecific,
          midiInputDevice: 'Legacy Keyboard',
          midiOutputDevice: 'Legacy Out',
        },
      }),
    );
    clearSettingsCache();

    const settings = loadProgramSettings('darwin');
    expect(settings.appSpecific.midiInputDevice).toBe('Legacy Keyboard');
    expect(settings.appSpecific.midiOutputDevice).toBe('Legacy Out');
  });

  it('round-trips structured midiInput preferences through save/load', () => {
    const settings = loadProgramSettings('darwin');
    settings.midiInput = {
      devices: [
        { id: 'dev-1', name: 'Dev 1', manufacturer: 'M', version: '1', enabled: true },
      ],
    };
    const result = saveProgramSettings(settings, 'darwin');
    expect(result.ok).toBe(true);

    clearSettingsCache();
    const reloaded = loadProgramSettings('darwin');
    expect(reloaded.midiInput.devices).toHaveLength(1);
    expect(reloaded.midiInput.devices[0]).toMatchObject({ id: 'dev-1', enabled: true });
  });

  it('does not modify realtimeRender MIDI options when saving midiInput', () => {
    const settings = loadProgramSettings('darwin');
    const beforeDriver = settings.realtimeRender.midiDriver;
    const beforeInText = settings.realtimeRender.midiInText;
    settings.midiInput = {
      devices: [{ id: 'x', name: 'X', manufacturer: '', version: '', enabled: true }],
    };
    saveProgramSettings(settings, 'darwin');
    clearSettingsCache();

    const reloaded = loadProgramSettings('darwin');
    expect(reloaded.realtimeRender.midiDriver).toBe(beforeDriver);
    expect(reloaded.realtimeRender.midiInText).toBe(beforeInText);
    expect(reloaded.midiInput.devices[0]?.id).toBe('x');
  });
});
