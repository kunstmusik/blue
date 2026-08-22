import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { BlueData, PolyObject, TrackLayerGroup } from '@blue/data';
import { applyProgramSettingsToNewProject } from './program-settings-application';
import {
  loadProgramSettings,
  saveProgramSettings,
  resetPanel,
  clearSettingsCache,
  setSettingsFilePathForTesting,
} from './program-settings-store';
import { createDefaultProgramSettings, type ProgramSettingsSnapshot } from '../shared/program-settings';

describe('program-settings-application', () => {
  function makeSettings(overrides?: Partial<ProgramSettingsSnapshot>): ProgramSettingsSnapshot {
    const base = createDefaultProgramSettings('darwin');
    return { ...base, ...overrides } as ProgramSettingsSnapshot;
  }

  it('sets project author from program defaults', () => {
    const data = new BlueData();
    const settings = makeSettings();
    settings.projectDefaults.defaultAuthor = 'Test Author';
    applyProgramSettingsToNewProject(data, settings);
    expect(data.getProjectProperties().author).toBe('Test Author');
  });

  it('sets mixer enabled state', () => {
    const data = new BlueData();
    const settings = makeSettings();
    settings.projectDefaults.mixerEnabled = false;
    applyProgramSettingsToNewProject(data, settings);
    expect(data.getMixer().isEnabled()).toBe(false);
  });

  it('sets realtime sample rate', () => {
    const data = new BlueData();
    const settings = makeSettings();
    settings.realtimeRender.defaultSr = '48000';
    applyProgramSettingsToNewProject(data, settings);
    expect(data.getProjectProperties().sampleRate).toBe('48000');
  });

  it('sets realtime ksmps', () => {
    const data = new BlueData();
    const settings = makeSettings();
    settings.realtimeRender.defaultKsmps = '32';
    applyProgramSettingsToNewProject(data, settings);
    expect(data.getProjectProperties().ksmps).toBe('32');
  });

  it('sets realtime 0dbfs', () => {
    const data = new BlueData();
    const settings = makeSettings();
    settings.realtimeRender.useZeroDbfs = true;
    settings.realtimeRender.zeroDbfs = '1';
    applyProgramSettingsToNewProject(data, settings);
    expect(data.getProjectProperties().useZeroDbFS).toBe(true);
    expect(data.getProjectProperties().zeroDbFS).toBe('1');
  });

  it('sets disk render defaults', () => {
    const data = new BlueData();
    const settings = makeSettings();
    settings.diskRender.defaultSr = '96000';
    settings.diskRender.defaultKsmps = '64';
    settings.diskRender.defaultNchnls = '6';
    settings.diskRender.useZeroDbfs = false;
    settings.diskRender.zeroDbfs = '2';
    applyProgramSettingsToNewProject(data, settings);
    expect(data.getProjectProperties().diskSampleRate).toBe('96000');
    expect(data.getProjectProperties().diskKsmps).toBe('64');
    expect(data.getProjectProperties().diskChannels).toBe('6');
    expect(data.getProjectProperties().diskUseZeroDbFS).toBe(false);
    expect(data.getProjectProperties().diskZeroDbFS).toBe('2');
  });

  it('sets score time state snap', () => {
    const data = new BlueData();
    const settings = makeSettings();
    settings.projectDefaults.defaultSnapEnabled = true;
    settings.projectDefaults.defaultSnapValue = 'EIGHTH';
    applyProgramSettingsToNewProject(data, settings);
    const ts = data.getScore().getTimeState();
    expect(ts.isSnapEnabled()).toBe(true);
    expect(ts.getSnapValue()).toBe('EIGHTH');
  });

  it('sets SMPTE frame rate', () => {
    const data = new BlueData();
    const settings = makeSettings();
    settings.projectDefaults.defaultSmpteFrameRate = 29.97;
    applyProgramSettingsToNewProject(data, settings);
    expect(data.getScore().getTimeState().getSmpteFrameRate()).toBe(29.97);
  });

  it('does not persist app settings into project XML', () => {
    const data = new BlueData();
    const settings = makeSettings();
    applyProgramSettingsToNewProject(data, settings);
    const xml = data.saveToString();
    expect(xml).not.toContain('program-settings');
    expect(xml).not.toContain('appSpecific');
  });

  it('sets disk message level flags', () => {
    const data = new BlueData();
    const settings = makeSettings();
    settings.diskRender.noteAmpsEnabled = false;
    settings.diskRender.benchmarkEnabled = false;
    applyProgramSettingsToNewProject(data, settings);
    expect(data.getProjectProperties().diskNoteAmpsEnabled).toBe(false);
    expect(data.getProjectProperties().diskBenchmarkEnabled).toBe(false);
  });

  it('seeds project useAudioOut from program audioOutEnabled', () => {
    const data = new BlueData();
    const settings = makeSettings();
    settings.realtimeRender.audioOutEnabled = false;
    applyProgramSettingsToNewProject(data, settings);
    expect(data.getProjectProperties().useAudioOut).toBe(false);
  });

  it('seeds project useAudioIn from program audioInEnabled', () => {
    const data = new BlueData();
    const settings = makeSettings();
    settings.realtimeRender.audioInEnabled = true;
    applyProgramSettingsToNewProject(data, settings);
    expect(data.getProjectProperties().useAudioIn).toBe(true);
  });

  it('seeds project useMidiIn from program midiInEnabled', () => {
    const data = new BlueData();
    const settings = makeSettings();
    settings.realtimeRender.midiInEnabled = true;
    applyProgramSettingsToNewProject(data, settings);
    expect(data.getProjectProperties().useMidiIn).toBe(true);
  });

  it('seeds project useMidiOut from program midiOutEnabled', () => {
    const data = new BlueData();
    const settings = makeSettings();
    settings.realtimeRender.midiOutEnabled = true;
    applyProgramSettingsToNewProject(data, settings);
    expect(data.getProjectProperties().useMidiOut).toBe(true);
  });

  it('seeds root PolyObject defaultHeightIndex from layerHeightDefault', () => {
    const data = new BlueData();
    const settings = makeSettings();
    settings.projectDefaults.defaultLayerGroupType = 'SOUND_OBJECT';
    settings.projectDefaults.layerHeightDefault = 3;
    applyProgramSettingsToNewProject(data, settings);
    const rootPoly = data.getScore()[0];
    expect(rootPoly).toBeInstanceOf(PolyObject);

    const polyObject = rootPoly as PolyObject;
    expect(polyObject.getDefaultHeightIndex()).toBe(3);

    const newLayer = polyObject.newLayerAt(polyObject.length);
    expect(newLayer.getHeightIndex()).toBe(3);
  });

  it('creates a Track Layer Group with one Track by default', () => {
    const data = new BlueData();
    applyProgramSettingsToNewProject(data, makeSettings());
    expect(data.getScore()[0]).toBeInstanceOf(TrackLayerGroup);
    expect((data.getScore()[0] as TrackLayerGroup).length).toBe(1);
  });

  it('creates a SoundObject Layer Group when explicitly configured', () => {
    const data = new BlueData();
    const settings = makeSettings();
    settings.projectDefaults.defaultLayerGroupType = 'SOUND_OBJECT';
    applyProgramSettingsToNewProject(data, settings);
    expect(data.getScore()[0]).toBeInstanceOf(PolyObject);
    expect((data.getScore()[0] as PolyObject).length).toBe(1);
  });
});

describe('program settings follow synchronization inputs (SPEC 079)', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'blue-settings-follow-sync-'));
    setSettingsFilePathForTesting(path.join(tempDir, 'program-settings.json'));
    clearSettingsCache();
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    clearSettingsCache();
  });

  it('persists follow preference changes made through the full Settings save', () => {
    const snapshot = loadProgramSettings();
    expect(snapshot.playback.followPlayback).toBe(true);

    const saved = saveProgramSettings({
      ...snapshot,
      playback: { ...snapshot.playback, followPlayback: false },
    });
    expect(saved.ok).toBe(true);

    expect(loadProgramSettings().playback.followPlayback).toBe(false);
  });

  it('restores default follow preferences when the playback panel is reset', () => {
    const snapshot = loadProgramSettings();
    saveProgramSettings({
      ...snapshot,
      playback: {
        ...snapshot.playback,
        followPlayback: false,
        followPlaybackOnStart: false,
      },
    });
    expect(loadProgramSettings().playback.followPlayback).toBe(false);

    const reset = resetPanel('playback');

    const defaults = createDefaultProgramSettings('darwin');
    expect(reset.playback.followPlayback).toBe(defaults.playback.followPlayback);
    expect(reset.playback.followPlaybackOnStart).toBe(defaults.playback.followPlaybackOnStart);
    expect(loadProgramSettings().playback.followPlayback).toBe(defaults.playback.followPlayback);
  });

  it('leaves follow preferences untouched when another panel is reset', () => {
    const snapshot = loadProgramSettings();
    saveProgramSettings({
      ...snapshot,
      playback: { ...snapshot.playback, followPlayback: false },
    });

    resetPanel('osc');

    expect(loadProgramSettings().playback.followPlayback).toBe(false);
  });
});
