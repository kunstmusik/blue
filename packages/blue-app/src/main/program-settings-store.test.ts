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
    expect(settings.version).toBe(3);
    expect(settings.general.messageColorsEnabled).toBe(false);
    expect(settings.realtimeRender.audioDriver).toBe('auhal');
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
    expect(settings.realtimeRender.audioDriver).toBe('auhal');
  });

  it('removes the legacy alpha marquee setting from persisted snapshots', () => {
    const filePath = path.join(tempDir, 'program-settings.json');
    fs.writeFileSync(filePath, JSON.stringify({
      version: 2,
      general: {
        drawAlphaBackgroundOnMarquee: true,
        messageColorsEnabled: true,
      },
    }));
    clearSettingsCache();

    const settings = loadProgramSettings('darwin');
    expect(Object.hasOwn(settings.general, 'drawAlphaBackgroundOnMarquee')).toBe(false);
    expect(JSON.parse(fs.readFileSync(filePath, 'utf8')).general.drawAlphaBackgroundOnMarquee).toBeUndefined();
  });

  it('migrates a valid legacy OSC input port without treating output placeholders as live settings', () => {
    const filePath = path.join(tempDir, 'program-settings.json');
    fs.writeFileSync(filePath, JSON.stringify({
      version: 1,
      appSpecific: {
        oscInputPort: 9010,
        oscOutputHost: 'controller.local',
        oscOutputPort: 9020,
      },
    }));
    clearSettingsCache();

    const settings = loadProgramSettings('darwin');
    expect(settings.osc.preferredPort).toBe(9010);
    expect(settings.appSpecific.oscOutputHost).toBe('controller.local');
    expect(settings.appSpecific.oscOutputPort).toBe(9020);
    expect(settings.version).toBe(3);
  });

  it('falls back to defaults when the settings file contains corrupted JSON', () => {
    const filePath = path.join(tempDir, 'program-settings.json');
    fs.writeFileSync(filePath, '{ this is not valid JSON !!!');
    clearSettingsCache();

    const settings = loadProgramSettings('darwin');
    expect(settings.version).toBe(3);
    expect(settings.general.workDirectory).toBe('');
  });

  it('falls back to defaults when the settings file is empty', () => {
    const filePath = path.join(tempDir, 'program-settings.json');
    fs.writeFileSync(filePath, '');
    clearSettingsCache();

    const settings = loadProgramSettings('darwin');
    expect(settings.version).toBe(3);
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

describe('program-settings-store appZoomPercent (SPEC 061)', () => {
  it('round-trips a valid appZoomPercent through save/load', () => {
    const settings = loadProgramSettings('darwin');
    settings.appSpecific.appZoomPercent = 170;
    const result = saveProgramSettings(settings, 'darwin');
    expect(result.ok).toBe(true);

    clearSettingsCache();
    const reloaded = loadProgramSettings('darwin');
    expect(reloaded.appSpecific.appZoomPercent).toBe(170);
  });

  it('defaults to 100 when appZoomPercent is missing from the saved file', () => {
    const filePath = path.join(tempDir, 'program-settings.json');
    const base = loadProgramSettings('darwin');
    delete (base.appSpecific as any).appZoomPercent;
    fs.writeFileSync(filePath, JSON.stringify(base));
    clearSettingsCache();

    const reloaded = loadProgramSettings('darwin');
    expect(reloaded.appSpecific.appZoomPercent).toBe(100);
  });

  it('normalizes malformed saved appZoomPercent to 100', () => {
    const filePath = path.join(tempDir, 'program-settings.json');
    const base = loadProgramSettings('darwin');
    const cases: Array<{ value: unknown; label: string }> = [
      { value: '120', label: 'string' },
      { value: null, label: 'null' },
      { value: 49, label: 'below-range' },
      { value: 301, label: 'above-range' },
      { value: 105, label: 'off-step' },
      { value: 100.5, label: 'fractional' },
    ];

    for (const { value, label } of cases) {
      fs.writeFileSync(
        filePath,
        JSON.stringify({
          ...base,
          appSpecific: { ...base.appSpecific, appZoomPercent: value },
        }),
      );
      clearSettingsCache();
      const reloaded = loadProgramSettings('darwin');
      expect(reloaded.appSpecific.appZoomPercent, label).toBe(100);
    }
  });

  it('preserves unrelated app-specific siblings when normalizing appZoomPercent', () => {
    const filePath = path.join(tempDir, 'program-settings.json');
    const base = loadProgramSettings('darwin');
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        ...base,
        appSpecific: {
          ...base.appSpecific,
          enginePath: '/my-engine',
          recentFiles: ['/keep.blue'],
          appZoomPercent: 999,
        },
      }),
    );
    clearSettingsCache();

    const reloaded = loadProgramSettings('darwin');
    expect(reloaded.appSpecific.appZoomPercent).toBe(100);
    expect(reloaded.appSpecific.enginePath).toBe('/my-engine');
    expect(reloaded.appSpecific.recentFiles).toEqual(['/keep.blue']);
  });

  it('does not bump the settings version when seeding appZoomPercent', () => {
    const filePath = path.join(tempDir, 'program-settings.json');
    const base = loadProgramSettings('darwin');
    fs.writeFileSync(filePath, JSON.stringify({ ...base, version: 2 }));
    clearSettingsCache();

    const reloaded = loadProgramSettings('darwin');
    expect(reloaded.version).toBe(3);
  });

  it('rejects a save with an unsupported appZoomPercent via validation', () => {
    const settings = loadProgramSettings('darwin');
    settings.appSpecific.appZoomPercent = 105;
    const result = saveProgramSettings(settings, 'darwin');
    expect(result.ok).toBe(false);
    expect(result.validationIssues?.some((i) => i.path === 'appSpecific.appZoomPercent')).toBe(true);
  });
});
