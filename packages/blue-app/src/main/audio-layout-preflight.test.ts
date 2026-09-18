import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AudioClip, BlueData, buildWavBytes, ScoreTrack, TrackLayerGroup } from '@blue/data';
import { preflightAudioLayout, type AudioLayoutPreflightDeps } from './audio-layout-preflight';

describe('audio-layout-preflight (T008, T054, T060, T064)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-test-'));
  });

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('skips preflight when score panning is disabled', () => {
    const data = new BlueData();
    data.getScore().panningEnabled = false;

    const group = new TrackLayerGroup();
    const track = new ScoreTrack();
    const clip = new AudioClip();
    clip.setAudioFile('/does/not/exist.wav');
    track.push(clip);
    group.push(track);
    data.getScore().push(group);

    const result = preflightAudioLayout(data);
    expect(result.success).toBe(true);
    expect(result.manifest).toBeNull();
    expect(result.diagnostics).toEqual([]);
  });

  it('makes actual file header authoritative over cached AudioClip.numChannels', () => {
    const monoPath = path.join(tmpDir, 'real-mono.wav');
    fs.writeFileSync(monoPath, buildWavBytes(1, 44100, 16, 100));

    const data = new BlueData();
    data.getScore().panningEnabled = true;

    const group = new TrackLayerGroup();
    const track = new ScoreTrack();
    const clip = new AudioClip();
    clip.setAudioFile(monoPath);
    // Cached as stereo (2), but actual header is mono (1)
    clip.setNumChannels(2);
    track.push(clip);
    group.push(track);
    data.getScore().push(group);

    const result = preflightAudioLayout(data);
    expect(result.success).toBe(true);
    expect(result.diagnostics).toHaveLength(0);

    const obs = result.manifest?.observations.get(monoPath);
    expect(obs).toBeDefined();
    expect(obs?.channels).toBe(1); // Authoritative real header wins!
    expect(obs?.status).toBe('verified');
  });

  it('deduplicates multiple clips referencing the same unique file', () => {
    const stereoPath = path.join(tmpDir, 'stereo.wav');
    fs.writeFileSync(stereoPath, buildWavBytes(2, 44100, 16, 100));

    const data = new BlueData();
    data.getScore().panningEnabled = true;

    const group = new TrackLayerGroup();
    const track = new ScoreTrack();
    const clip1 = new AudioClip();
    clip1.setAudioFile(stereoPath);
    const clip2 = new AudioClip();
    clip2.setAudioFile(stereoPath);
    track.push(clip1, clip2);
    group.push(track);
    data.getScore().push(group);

    let readCount = 0;
    const deps: AudioLayoutPreflightDeps = {
      readFileBytes: (filePath) => {
        readCount += 1;
        return fs.readFileSync(filePath);
      },
    };

    const result = preflightAudioLayout(data, undefined, deps);
    expect(result.success).toBe(true);
    expect(readCount).toBe(1); // Deduplicated: only read once!
  });

  it('deduplicates relative, absolute, and symlink aliases while preserving manifest keys', () => {
    const targetPath = path.join(tmpDir, 'target.wav');
    const relativePath = path.relative(process.cwd(), targetPath);
    const symlinkPath = path.join(tmpDir, 'alias.wav');
    fs.writeFileSync(targetPath, buildWavBytes(1, 44100, 16, 100));

    const data = new BlueData();
    data.getScore().panningEnabled = true;
    const group = new TrackLayerGroup();
    const track = new ScoreTrack();
    for (const filePath of [targetPath, relativePath, symlinkPath]) {
      const clip = new AudioClip();
      clip.setAudioFile(filePath);
      track.push(clip);
    }
    group.push(track);
    data.getScore().push(group);

    let readCount = 0;
    const readPaths: string[] = [];
    const deps: AudioLayoutPreflightDeps = {
      probe: { isFile: () => true },
      realpath: () => targetPath,
      readFileBytes: (filePath) => {
        readCount += 1;
        readPaths.push(filePath);
        return fs.readFileSync(targetPath);
      },
    };

    const result = preflightAudioLayout(data, undefined, deps);

    expect(result.success).toBe(true);
    expect(readCount).toBe(1);
    expect(readPaths).toEqual([targetPath]);
    for (const filePath of [targetPath, relativePath, symlinkPath]) {
      expect(result.manifest?.observations.get(filePath)).toMatchObject({
        filePath,
        channels: 1,
        status: 'verified',
      });
    }
  });

  it('reports MISSING_AUDIO_LAYOUT when audio file does not exist', () => {
    const data = new BlueData();
    data.getScore().panningEnabled = true;

    const group = new TrackLayerGroup();
    const track = new ScoreTrack();
    const clip = new AudioClip();
    clip.setAudioFile('/missing/path/audio.wav');
    track.push(clip);
    group.push(track);
    data.getScore().push(group);

    const result = preflightAudioLayout(data);
    expect(result.success).toBe(false);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].code).toBe('MISSING_AUDIO_LAYOUT');
    expect(result.diagnostics[0].filePath).toBe('/missing/path/audio.wav');
  });

  it('reports UNREADABLE_AUDIO_FILE when reading fails', () => {
    const dummyPath = path.join(tmpDir, 'unreadable.wav');
    fs.writeFileSync(dummyPath, Buffer.from('bad'));

    const data = new BlueData();
    data.getScore().panningEnabled = true;

    const group = new TrackLayerGroup();
    const track = new ScoreTrack();
    const clip = new AudioClip();
    clip.setAudioFile(dummyPath);
    track.push(clip);
    group.push(track);
    data.getScore().push(group);

    const deps: AudioLayoutPreflightDeps = {
      readFileBytes: () => {
        const err = new Error('EACCES: permission denied');
        (err as any).code = 'EACCES';
        throw err;
      },
    };

    const result = preflightAudioLayout(data, undefined, deps);
    expect(result.success).toBe(false);
    expect(result.diagnostics[0].code).toBe('UNREADABLE_AUDIO_FILE');
    expect(result.diagnostics[0].filePath).toBe(dummyPath);
  });

  it('reports UNSUPPORTED_SOURCE_CHANNELS when file has > 2 channels', () => {
    const multiPath = path.join(tmpDir, 'surround.wav');
    fs.writeFileSync(multiPath, buildWavBytes(4, 44100, 16, 100));

    const data = new BlueData();
    data.getScore().panningEnabled = true;

    const group = new TrackLayerGroup();
    const track = new ScoreTrack();
    const clip = new AudioClip();
    clip.setAudioFile(multiPath);
    track.push(clip);
    group.push(track);
    data.getScore().push(group);

    const result = preflightAudioLayout(data);
    expect(result.success).toBe(false);
    expect(result.diagnostics[0].code).toBe('UNSUPPORTED_SOURCE_CHANNELS');
    expect(result.diagnostics[0].observedChannels).toBe(4);
  });

  it('reports UNSUPPORTED_OUTPUT_CHANNELS when project nchnls > 2', () => {
    const data = new BlueData();
    data.getScore().panningEnabled = true;
    data.getProjectProperties().channels = '6';

    const result = preflightAudioLayout(data);
    expect(result.success).toBe(false);
    expect(result.diagnostics[0].code).toBe('UNSUPPORTED_OUTPUT_CHANNELS');
    expect(result.diagnostics[0].outputChannels).toBe(6);
  });

  it('supports synthetic Windows paths without crashing or mangling', () => {
    const winPath = 'C:\\Projects\\Audio\\clip.wav';
    const data = new BlueData();
    data.getScore().panningEnabled = true;

    const group = new TrackLayerGroup();
    const track = new ScoreTrack();
    const clip = new AudioClip();
    clip.setAudioFile(winPath);
    track.push(clip);
    group.push(track);
    data.getScore().push(group);

    const deps: AudioLayoutPreflightDeps = {
      probe: {
        isFile: (p) => p === winPath,
      },
      readFileBytes: (p) => {
        if (p === winPath) return buildWavBytes(1, 44100, 16, 100);
        throw new Error('File not found');
      },
    };

    const result = preflightAudioLayout(data, undefined, deps);
    expect(result.success).toBe(true);
    expect(result.manifest?.observations.get(winPath)?.channels).toBe(1);
  });
});
