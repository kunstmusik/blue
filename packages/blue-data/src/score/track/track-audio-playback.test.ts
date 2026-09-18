import { describe, expect, it } from 'vitest';
import { Channel } from '../../mixer/channel';
import { CompileData } from '../../compile-data';
import { Mixer } from '../../mixer/mixer';
import { AudioClip } from '../audio/audio-clip';
import { TimeDuration } from '../../time/time-duration';
import { TimePosition } from '../../time/time-position';
import { TimeContext } from '../../time/time-context';
import {
  generateTrackAudioPlaybackNotes,
  ensureTrackAudioPlaybackInstrument,
} from './track-audio-playback';
import { createAudioLayoutManifest, AudioLayoutCompileError } from '../audio/audio-layout';

function makeClip(path = '/fixtures/test.wav'): AudioClip {
  const clip = new AudioClip();
  clip.setAudioFile(path);
  clip.setStartTime(TimePosition.beats(0));
  clip.setSubjectiveDuration(TimeDuration.beats(1));
  return clip;
}

function getInstrumentText(compileData: CompileData, noteInstrumentId: string): string {
  const instrument = compileData.getArrangement().getInstrumentById(noteInstrumentId);
  expect(instrument).toBeDefined();
  return instrument!.generateInstrument();
}

describe('track-audio-playback with panning context (T013, T017, T020)', () => {
  it('preserves legacy instrument generation when panningEnabled is false', () => {
    const compileData = new CompileData();
    compileData.setPanningEnabled(false);
    compileData.setMixerEnabled(true);
    const channel = new Channel();
    channel.setAssociation('track-1');
    compileData.getChannelIdAssignments().set(channel, 1);

    const notes = generateTrackAudioPlaybackNotes(
      'track-1',
      [makeClip()],
      new TimeContext(),
      compileData,
      0,
      -1,
    );

    expect(notes).toHaveLength(1);
    const text = getInstrumentText(compileData, notes.getNote(0).getPField(1)!);
    expect(text).not.toContain('a_upmix = a0 / sqrt(2)');
    expect(text).toContain(Mixer.getChannelVar(1, 0));
  });

  it('throws MISSING_AUDIO_LAYOUT when panningEnabled is true and manifest is missing observation', () => {
    const compileData = new CompileData();
    compileData.setPanningEnabled(true);

    expect(() =>
      generateTrackAudioPlaybackNotes(
        'track-1',
        [makeClip('/audio/unobserved.wav')],
        new TimeContext(),
        compileData,
        0,
        -1,
      ),
    ).toThrow(AudioLayoutCompileError);

    try {
      generateTrackAudioPlaybackNotes(
        'track-1',
        [makeClip('/audio/unobserved.wav')],
        new TimeContext(),
        compileData,
        0,
        -1,
      );
    } catch (e) {
      expect(e).toBeInstanceOf(AudioLayoutCompileError);
      expect((e as AudioLayoutCompileError).code).toBe('MISSING_AUDIO_LAYOUT');
      expect((e as AudioLayoutCompileError).filePath).toBe('/audio/unobserved.wav');
    }
  });

  it('throws UNREADABLE_AUDIO_FILE when panningEnabled is true and file observation is unreadable', () => {
    const compileData = new CompileData();
    compileData.setPanningEnabled(true);
    const manifest = createAudioLayoutManifest([
      [
        '/audio/corrupt.wav',
        { filePath: '/audio/corrupt.wav', channels: 'unsupported', status: 'unreadable' },
      ],
    ]);
    compileData.setAudioLayoutManifest(manifest);

    try {
      generateTrackAudioPlaybackNotes(
        'track-1',
        [makeClip('/audio/corrupt.wav')],
        new TimeContext(),
        compileData,
        0,
        -1,
      );
      expect.fail('Expected to throw');
    } catch (e) {
      expect(e).toBeInstanceOf(AudioLayoutCompileError);
      expect((e as AudioLayoutCompileError).code).toBe('UNREADABLE_AUDIO_FILE');
      expect((e as AudioLayoutCompileError).filePath).toBe('/audio/corrupt.wav');
    }
  });

  it('throws UNSUPPORTED_SOURCE_CHANNELS when source has more than 2 channels', () => {
    const compileData = new CompileData();
    compileData.setPanningEnabled(true);
    const manifest = createAudioLayoutManifest([
      [
        '/audio/surround.wav',
        { filePath: '/audio/surround.wav', channels: 'unsupported', status: 'unsupported' },
      ],
    ]);
    compileData.setAudioLayoutManifest(manifest);

    try {
      generateTrackAudioPlaybackNotes(
        'track-1',
        [makeClip('/audio/surround.wav')],
        new TimeContext(),
        compileData,
        0,
        -1,
      );
      expect.fail('Expected to throw');
    } catch (e) {
      expect(e).toBeInstanceOf(AudioLayoutCompileError);
      expect((e as AudioLayoutCompileError).code).toBe('UNSUPPORTED_SOURCE_CHANNELS');
    }
  });

  it('throws UNSUPPORTED_OUTPUT_CHANNELS when nchnls > 2 and panningEnabled is true', () => {
    const compileData = new CompileData();
    compileData.setPanningEnabled(true);
    compileData.setNchnls(4);
    const manifest = createAudioLayoutManifest([
      ['/audio/mono.wav', { filePath: '/audio/mono.wav', channels: 1, status: 'verified' }],
    ]);
    compileData.setAudioLayoutManifest(manifest);

    try {
      generateTrackAudioPlaybackNotes(
        'track-1',
        [makeClip('/audio/mono.wav')],
        new TimeContext(),
        compileData,
        0,
        -1,
      );
      expect.fail('Expected to throw');
    } catch (e) {
      expect(e).toBeInstanceOf(AudioLayoutCompileError);
      expect((e as AudioLayoutCompileError).code).toBe('UNSUPPORTED_OUTPUT_CHANNELS');
    }
  });

  it('generates panning-enabled playback instrument routing mono clips with sqrt(2) upmix for nchnls = 2', () => {
    const compileData = new CompileData();
    compileData.setPanningEnabled(true);
    compileData.setMixerEnabled(true);
    compileData.setNchnls(2);
    const manifest = createAudioLayoutManifest([
      ['/audio/mono.wav', { filePath: '/audio/mono.wav', channels: 1, status: 'verified' }],
    ]);
    compileData.setAudioLayoutManifest(manifest);

    const channel = new Channel();
    channel.setAssociation('track-stereo');
    compileData.getChannelIdAssignments().set(channel, 2);

    const notes = generateTrackAudioPlaybackNotes(
      'track-stereo',
      [makeClip('/audio/mono.wav')],
      new TimeContext(),
      compileData,
      0,
      -1,
    );

    expect(notes).toHaveLength(1);
    const text = getInstrumentText(compileData, notes.getNote(0).getPField(1)!);
    expect(text).toContain('a_upmix = a0 / sqrt(2)');
    expect(text).toContain(Mixer.getChannelVar(2, 0));
    expect(text).toContain(Mixer.getChannelVar(2, 1));
  });

  it('generates mono playback instrument for nchnls = 1', () => {
    const compileData = new CompileData();
    compileData.setPanningEnabled(true);
    compileData.setMixerEnabled(true);
    compileData.setNchnls(1);
    const manifest = createAudioLayoutManifest([
      ['/audio/stereo.wav', { filePath: '/audio/stereo.wav', channels: 2, status: 'verified' }],
    ]);
    compileData.setAudioLayoutManifest(manifest);

    const channel = new Channel();
    channel.setAssociation('track-mono');
    compileData.getChannelIdAssignments().set(channel, 3);

    const notes = generateTrackAudioPlaybackNotes(
      'track-mono',
      [makeClip('/audio/stereo.wav')],
      new TimeContext(),
      compileData,
      0,
      -1,
    );

    expect(notes).toHaveLength(1);
    const text = getInstrumentText(compileData, notes.getNote(0).getPField(1)!);
    expect(text).toContain('a_mono = (a0 + a1) * 0.5');
    expect(text).toContain(Mixer.getChannelVar(3, 0));
    expect(text).not.toContain(Mixer.getChannelVar(3, 1));
  });
});
