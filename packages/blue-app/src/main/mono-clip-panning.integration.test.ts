import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  AudioClip,
  BlueData,
  Channel,
  EQUAL_POWER_CENTER_GAIN,
  ScoreTrack,
  TimeDuration,
  TimePosition,
  TrackLayerGroup,
  getMonoPanGains,
  getStereoBalanceGains,
  parseAudioFileMetadata,
} from '@blue/data';
import { preflightAudioLayout } from './audio-layout-preflight';

const hasCsound = (() => {
  try {
    execFileSync('csound', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

function writeWavFile(
  filePath: string,
  channels: number,
  sampleRate: number,
  frameCount: number,
  channelValues: number[],
): void {
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = channels * bytesPerSample;
  const dataByteLength = frameCount * blockAlign;
  const fmtChunkSize = 16;
  const fileSize = 4 + (8 + fmtChunkSize) + (8 + dataByteLength);

  const buffer = new ArrayBuffer(44 + dataByteLength);
  const view = new DataView(buffer);

  view.setUint8(0, 'R'.charCodeAt(0));
  view.setUint8(1, 'I'.charCodeAt(0));
  view.setUint8(2, 'F'.charCodeAt(0));
  view.setUint8(3, 'F'.charCodeAt(0));
  view.setUint32(4, fileSize, true);
  view.setUint8(8, 'W'.charCodeAt(0));
  view.setUint8(9, 'A'.charCodeAt(0));
  view.setUint8(10, 'V'.charCodeAt(0));
  view.setUint8(11, 'E'.charCodeAt(0));

  view.setUint8(12, 'f'.charCodeAt(0));
  view.setUint8(13, 'm'.charCodeAt(0));
  view.setUint8(14, 't'.charCodeAt(0));
  view.setUint8(15, ' '.charCodeAt(0));
  view.setUint32(16, fmtChunkSize, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  view.setUint8(36, 'd'.charCodeAt(0));
  view.setUint8(37, 'a'.charCodeAt(0));
  view.setUint8(38, 't'.charCodeAt(0));
  view.setUint8(39, 'a'.charCodeAt(0));
  view.setUint32(40, dataByteLength, true);

  let offset = 44;
  for (let f = 0; f < frameCount; f++) {
    for (let c = 0; c < channels; c++) {
      const val = channelValues[c] ?? 0;
      const clamped = Math.max(-1, Math.min(1, val));
      const intVal = clamped < 0 ? clamped * 32768 : clamped * 32767;
      view.setInt16(offset, Math.round(intVal), true);
      offset += 2;
    }
  }

  fs.writeFileSync(filePath, Buffer.from(buffer));
}

describe('mono-clip-panning integration fixtures (T002)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'blue-panning-test-'));
  });

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('creates deterministic mono, stereo, and 3-channel files on disk and parses metadata', () => {
    const monoPath = path.join(tmpDir, 'mono.wav');
    const stereoPath = path.join(tmpDir, 'stereo.wav');
    const multiPath = path.join(tmpDir, 'multi.wav');

    writeWavFile(monoPath, 1, 44100, 100, [1.0]);
    writeWavFile(stereoPath, 2, 44100, 100, [0.8, -0.4]);
    writeWavFile(multiPath, 3, 44100, 100, [0.5, 0.5, 0.5]);

    const monoMeta = parseAudioFileMetadata(fs.readFileSync(monoPath));
    expect(monoMeta.channels).toBe(1);

    const stereoMeta = parseAudioFileMetadata(fs.readFileSync(stereoPath));
    expect(stereoMeta.channels).toBe(2);

    const multiMeta = parseAudioFileMetadata(fs.readFileSync(multiPath));
    expect(multiMeta.channels).toBe(3);
  });

  it('verifies center attenuation and endpoint gain constants', () => {
    expect(EQUAL_POWER_CENTER_GAIN).toBeCloseTo(1 / Math.SQRT2, 6);

    const [monoCenterL, monoCenterR] = getMonoPanGains(0.5);
    expect(monoCenterL).toBeCloseTo(1.0, 6);
    expect(monoCenterR).toBeCloseTo(1.0, 6);

    const [balanceCenterL, balanceCenterR] = getStereoBalanceGains(0.5);
    expect(balanceCenterL).toBe(1.0);
    expect(balanceCenterR).toBe(1.0);
  });
});

/**
 * Numerical engine integration coverage (T071, T016, T025): renders
 * panning-enabled CSD through Csound and asserts the audio-routing contract
 * values — center 1/sqrt(2) per side, unity endpoints, stereo channel
 * independence, overlapping mixed clips, and a single valid mono output.
 */
describe.skipIf(!hasCsound)('mono-clip-panning numerical renders (T071)', () => {
  const temporaryDirectories: string[] = [];

  afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  function scratchDirectory(): string {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'blue-panning-render-'));
    temporaryDirectories.push(directory);
    return directory;
  }

  interface ClipSpec {
    readonly file: string;
    readonly startBeat?: number;
    readonly durationBeats?: number;
  }

  /**
   * Builds a panning-enabled (new-score default) project whose single track is
   * associated with a mixer channel at the requested position. Default tempo is
   * 60 BPM, so one beat equals one second of render time.
   */
  function createPanningProject(
    scratchDir: string,
    options: {
      clips: readonly ClipSpec[];
      pan?: number;
      channels?: string;
      channelName?: string;
    },
  ): { data: BlueData; preflight: ReturnType<typeof preflightAudioLayout> } {
    const data = new BlueData();
    expect(data.getScore().panningEnabled).toBe(true);

    if (options.channels !== undefined) {
      data.getProjectProperties().channels = options.channels;
      data.getProjectProperties().diskChannels = options.channels;
    }
    data.setRenderStartTime(0);
    data.setRenderEndTime(2);

    const group = new TrackLayerGroup();
    const track = group.newLayerAt(0);
    track.setUniqueId('pan-integration-track');
    track.setName('Panning Integration Track');
    for (const clipSpec of options.clips) {
      const clip = new AudioClip();
      clip.setAudioFile(clipSpec.file);
      clip.setStartTime(TimePosition.beats(clipSpec.startBeat ?? 0));
      clip.setSubjectiveDuration(TimeDuration.beats(clipSpec.durationBeats ?? 4));
      track.push(clip);
    }
    data.getScore().push(group);

    const channel = new Channel();
    channel.setName(options.channelName ?? 'Panning Integration');
    channel.setAssociation(track.getUniqueId());
    if (options.pan !== undefined) {
      channel.setPan(options.pan);
    }
    data.getMixer().getChannels().push(channel);

    // Native paths stay untouched; preflight resolves them with host fs/path.
    const preflight = preflightAudioLayout(data, { projectDirectory: scratchDir });
    expect(preflight.success).toBe(true);
    expect(preflight.manifest).not.toBeNull();
    return { data, preflight };
  }

  function renderProjectToWav(
    project: { data: BlueData; preflight: ReturnType<typeof preflightAudioLayout> },
    scratchDir: string,
    name: string,
  ): { csdText: string; wav: Buffer } {
    const csdText = project.data.toDiskCSD(undefined, project.preflight.manifest);
    const csdPath = path.join(scratchDir, `${name}.csd`);
    const wavPath = path.join(scratchDir, `${name}.wav`);
    fs.writeFileSync(csdPath, csdText, 'utf8');
    execFileSync('csound', ['-nd', '-W', '--0dbfs=1', '--format=double', '-o', wavPath, csdPath], {
      cwd: scratchDir,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { csdText, wav: fs.readFileSync(wavPath) };
  }

  function wavDataOffset(buffer: Buffer): number {
    let position = 12;
    while (position + 8 <= buffer.length) {
      const id = buffer.toString('ascii', position, position + 4);
      const size = buffer.readUInt32LE(position + 4);
      if (id === 'data') return position + 8;
      position += 8 + size + (size % 2);
    }
    throw new Error('Rendered WAV has no data chunk');
  }

  function wavChannels(buffer: Buffer): number {
    return buffer.readUInt16LE(22);
  }

  /** Max absolute sample per channel across the plateau window of the render. */
  function plateauLevels(buffer: Buffer, startSeconds: number, endSeconds: number): number[] {
    const channels = wavChannels(buffer);
    const sampleRate = buffer.readUInt32LE(24);
    const dataOffset = wavDataOffset(buffer);
    const bytesPerFrame = channels * 8;
    const frameCount = Math.floor((buffer.length - dataOffset) / bytesPerFrame);
    const startFrame = Math.floor(startSeconds * sampleRate);
    const endFrame = Math.min(Math.floor(endSeconds * sampleRate), frameCount);
    expect(endFrame).toBeGreaterThan(startFrame);

    const peaks = new Array<number>(channels).fill(0);
    for (let frame = startFrame; frame < endFrame; frame += 1) {
      for (let channel = 0; channel < channels; channel += 1) {
        const sample = buffer.readDoubleLE(dataOffset + frame * bytesPerFrame + channel * 8);
        expect(Number.isFinite(sample)).toBe(true);
        peaks[channel] = Math.max(peaks[channel]!, Math.abs(sample));
      }
    }
    return peaks;
  }

  it('renders a mono clip at center with 1/sqrt(2) per side and equal channels', () => {
    const scratchDir = scratchDirectory();
    const monoPath = path.join(scratchDir, 'mono.wav');
    writeWavFile(monoPath, 1, 44100, 44100, [1.0]);

    const project = createPanningProject(scratchDir, { clips: [{ file: monoPath }], pan: 0.5 });
    const { wav } = renderProjectToWav(project, scratchDir, 'mono-center');

    const [left, right] = plateauLevels(wav, 0.9, 1.1);
    const expected = 1 / Math.SQRT2;
    expect(left).toBeCloseTo(expected, 2);
    expect(right).toBeCloseTo(expected, 2);
    expect(Math.abs(left - right)).toBeLessThan(1e-3);
  }, 120_000);

  it('renders unity gains at the hard-left and hard-right endpoints', () => {
    const scratchLeft = scratchDirectory();
    const monoLeftPath = path.join(scratchLeft, 'mono.wav');
    writeWavFile(monoLeftPath, 1, 44100, 44100, [1.0]);
    const leftProject = createPanningProject(scratchLeft, {
      clips: [{ file: monoLeftPath }],
      pan: 0,
    });
    const leftWav = renderProjectToWav(leftProject, scratchLeft, 'mono-left').wav;

    const scratchRight = scratchDirectory();
    const monoRightPath = path.join(scratchRight, 'mono.wav');
    writeWavFile(monoRightPath, 1, 44100, 44100, [1.0]);
    const rightProject = createPanningProject(scratchRight, {
      clips: [{ file: monoRightPath }],
      pan: 1,
    });
    const rightWav = renderProjectToWav(rightProject, scratchRight, 'mono-right').wav;

    const [leftAtLeft, rightAtLeft] = plateauLevels(leftWav, 0.9, 1.1);
    expect(leftAtLeft).toBeCloseTo(1.0, 2);
    expect(rightAtLeft).toBeLessThan(1e-4);

    const [leftAtRight, rightAtRight] = plateauLevels(rightWav, 0.9, 1.1);
    expect(leftAtRight).toBeLessThan(1e-4);
    expect(rightAtRight).toBeCloseTo(1.0, 2);
  }, 180_000);

  it('preserves stereo channel independence through a centered balance stage', () => {
    const scratchDir = scratchDirectory();
    const stereoPath = path.join(scratchDir, 'stereo.wav');
    writeWavFile(stereoPath, 2, 44100, 44100, [0.8, -0.4]);

    const project = createPanningProject(scratchDir, { clips: [{ file: stereoPath }], pan: 0.5 });
    const { wav } = renderProjectToWav(project, scratchDir, 'stereo-center');

    const [left, right] = plateauLevels(wav, 0.9, 1.1);
    expect(left).toBeCloseTo(0.8, 2);
    expect(right).toBeCloseTo(0.4, 2);
    expect(Math.abs(left - right)).toBeGreaterThan(0.1);
  }, 120_000);

  it('mixes overlapping mono and stereo clips without collapsing the stereo pair', () => {
    const scratchDir = scratchDirectory();
    const monoPath = path.join(scratchDir, 'mono.wav');
    const stereoPath = path.join(scratchDir, 'stereo.wav');
    writeWavFile(monoPath, 1, 44100, 44100, [1.0]);
    writeWavFile(stereoPath, 2, 44100, 44100, [0.8, -0.4]);

    const project = createPanningProject(scratchDir, {
      clips: [{ file: monoPath }, { file: stereoPath }],
      pan: 0.5,
    });
    const { wav } = renderProjectToWav(project, scratchDir, 'mixed-overlap');

    const [left, right] = plateauLevels(wav, 0.9, 1.1);
    expect(left).toBeCloseTo(1 / Math.SQRT2 + 0.8, 2);
    expect(right).toBeCloseTo(1 / Math.SQRT2 - 0.4, 2);
  }, 120_000);

  it('produces a single valid mono output for nchnls=1 without a second channel', () => {
    const scratchDir = scratchDirectory();
    const monoPath = path.join(scratchDir, 'mono.wav');
    writeWavFile(monoPath, 1, 44100, 44100, [1.0]);

    const project = createPanningProject(scratchDir, {
      clips: [{ file: monoPath }],
      pan: 0.5,
      channels: '1',
    });
    const { csdText, wav } = renderProjectToWav(project, scratchDir, 'mono-output');

    expect(csdText).toContain('nchnls=1');
    expect(wavChannels(wav)).toBe(1);

    const [mono] = plateauLevels(wav, 0.9, 1.1);
    expect(mono).toBeCloseTo(1.0, 2);
  }, 120_000);
});
