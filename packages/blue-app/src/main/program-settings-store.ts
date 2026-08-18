import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import {
  type ProgramSettingsSnapshot,
  type ProgramSettingsPanelId,
  type ProgramSettingsSaveResult,
  type PlaybackPreferencePatch,
  isValidPlaybackPreferencePatch,
  createDefaultProgramSettings,
  validateProgramSettings,
  resetProgramSettingsPanel,
  mergeWithDefaults,
  PROGRAM_SETTINGS_VERSION,
} from '../shared/program-settings';

let cachedSettings: ProgramSettingsSnapshot | null = null;
let settingsFilePath: string | null = null;

export function getSettingsFilePath(): string {
  if (!settingsFilePath) {
    settingsFilePath = path.join(app.getPath('userData'), 'program-settings.json');
  }
  return settingsFilePath;
}

export function setSettingsFilePathForTesting(filePath: string): void {
  settingsFilePath = filePath;
}

export function clearSettingsCache(): void {
  cachedSettings = null;
}

function readFromFile(filePath: string): Partial<ProgramSettingsSnapshot> | null {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as Partial<ProgramSettingsSnapshot>;
  } catch {
    return null;
  }
}

function writeToFile(filePath: string, snapshot: ProgramSettingsSnapshot): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tmpPath = filePath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(snapshot, null, 2), 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

export function loadProgramSettings(platform: string = process.platform): ProgramSettingsSnapshot {
  if (cachedSettings) {
    return cachedSettings;
  }

  const filePath = getSettingsFilePath();
  const saved = readFromFile(filePath);
  const merged = mergeWithDefaults(saved ?? {}, platform);
  const containsRemovedAlphaMarqueeSetting = Boolean(
    saved?.general
    && Object.prototype.hasOwnProperty.call(saved.general, 'drawAlphaBackgroundOnMarquee'),
  );

  if (saved && (saved.version !== PROGRAM_SETTINGS_VERSION || containsRemovedAlphaMarqueeSetting)) {
    merged.version = PROGRAM_SETTINGS_VERSION;
    writeToFile(filePath, merged);
  }

  cachedSettings = merged;
  return cachedSettings;
}

export function saveProgramSettings(
  snapshot: ProgramSettingsSnapshot,
  platform: string = process.platform,
): ProgramSettingsSaveResult {
  const issues = validateProgramSettings(snapshot);
  const errors = issues.filter((i) => i.severity === 'error');
  if (errors.length > 0) {
    return { ok: false, validationIssues: issues };
  }

  const toSave: ProgramSettingsSnapshot = {
    ...snapshot,
    version: PROGRAM_SETTINGS_VERSION,
    lastSavedAt: new Date().toISOString(),
  };

  const filePath = getSettingsFilePath();
  writeToFile(filePath, toSave);
  cachedSettings = toSave;

  return { ok: true, snapshot: toSave, validationIssues: issues.length > 0 ? issues : undefined };
}

export function resetPanel(
  panel: ProgramSettingsPanelId,
  platform: string = process.platform,
): ProgramSettingsSnapshot {
  const current = loadProgramSettings(platform);
  const reset = resetProgramSettingsPanel(current, panel, platform);
  const result = saveProgramSettings(reset, platform);
  if (!result.ok || !result.snapshot) {
    throw new Error('Failed to save reset settings');
  }
  return result.snapshot;
}

export function syncLegacyRendererSettings(
  legacy: {
    enginePath?: string;
    recentFiles?: string[];
    windowBounds?: { x: number; y: number; width: number; height: number } | null;
    midiInputDevice?: string;
    midiOutputDevice?: string;
    oscInputPort?: number;
    oscOutputHost?: string;
    oscOutputPort?: number;
  },
  platform: string = process.platform,
): ProgramSettingsSnapshot {
  const current = loadProgramSettings(platform);

  current.appSpecific = {
    ...current.appSpecific,
    ...legacy,
  };

  const result = saveProgramSettings(current, platform);
  if (!result.ok || !result.snapshot) {
    throw new Error('Failed to sync legacy settings');
  }
  return result.snapshot;
}

/**
 * Atomically merge a narrow playback-preference patch into the current
 * settings. Only `followPlayback` and `followPlaybackOnStart` are accepted.
 * Invalid payloads are rejected without changing the settings file.
 */
export function updatePlaybackPreferences(
  patch: PlaybackPreferencePatch,
  platform: string = process.platform,
): ProgramSettingsSaveResult {
  if (!isValidPlaybackPreferencePatch(patch)) {
    return {
      ok: false,
      validationIssues: [{
        path: 'playback',
        message: 'Playback preference patch must contain at least one boolean field (followPlayback, followPlaybackOnStart)',
        severity: 'error',
      }],
    };
  }

  const current = loadProgramSettings(platform);
  const merged: ProgramSettingsSnapshot = {
    ...current,
    playback: {
      ...current.playback,
      ...(patch.followPlayback !== undefined ? { followPlayback: patch.followPlayback } : {}),
      ...(patch.followPlaybackOnStart !== undefined ? { followPlaybackOnStart: patch.followPlaybackOnStart } : {}),
    },
  };

  return saveProgramSettings(merged, platform);
}
