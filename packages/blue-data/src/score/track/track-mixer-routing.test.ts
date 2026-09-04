import { describe, expect, it } from 'vitest';
import { Channel } from '../../mixer/channel';
import { CompileData } from '../../compile-data';
import { Mixer } from '../../mixer/mixer';
import { AudioClip } from '../audio/audio-clip';
import { TimeDuration } from '../../time/time-duration';
import { TimePosition } from '../../time/time-position';
import { TimeContext } from '../../time/time-context';
import { FrozenSoundObject } from '../../sound-objects/frozen-sound-object';
import { Sound } from '../../sound-objects/sound';
import { Track } from './track';
import {
  generateTrackAudioPlaybackNotes,
  ensureTrackAudioPlaybackInstrument,
} from './track-audio-playback';

function makeClip(): AudioClip {
  const clip = new AudioClip();
  clip.setAudioFile('/fixtures/routed.wav');
  clip.setStartTime(TimePosition.beats(0));
  clip.setSubjectiveDuration(TimeDuration.beats(1));
  return clip;
}

function instrumentText(compileData: CompileData, noteInstrumentId: string): string {
  const instrument = compileData.getArrangement().getInstrumentById(noteInstrumentId);
  expect(instrument).toBeDefined();
  return instrument!.generateInstrument();
}

describe('Track mixer routing', () => {
  it('resolves Track AudioClip playback by association before channel name', () => {
    const compileData = new CompileData();
    compileData.setMixerEnabled(true);
    const channel = new Channel();
    channel.setName('Old Track Name');
    channel.setAssociation('stable-track');
    compileData.getChannelIdAssignments().set(channel, 7);

    const notes = generateTrackAudioPlaybackNotes(
      'stable-track',
      [makeClip()],
      new TimeContext(),
      compileData,
      0,
      -1,
    );

    expect(notes).toHaveLength(1);
    expect(instrumentText(compileData, notes.getNote(0).getPField(1)!)).toContain(
      Mixer.getChannelVar(7, 0),
    );
  });

  it('falls back to the Master sub-channel when a Track association is missing, then falls back to direct output', () => {
    const withMaster = new CompileData();
    withMaster.setMixerEnabled(true);
    const master = new Channel();
    master.setName(Mixer.MASTER_CHANNEL);
    withMaster.getChannelIdAssignments().set(master, 3);
    const masterInstrument = ensureTrackAudioPlaybackInstrument(
      'missing-track',
      new TimeContext(),
      withMaster,
    );
    const masterText = instrumentText(withMaster, String(masterInstrument));
    expect(masterText).toContain(Mixer.getSubChannelVar(Mixer.MASTER_CHANNEL, 0));
    expect(masterText).not.toContain('ga_bluemix_');

    const withoutMixer = new CompileData();
    const directInstrument = ensureTrackAudioPlaybackInstrument(
      'no-mixer',
      new TimeContext(),
      withoutMixer,
    );
    const directText = instrumentText(withoutMixer, String(directInstrument));
    expect(directText).toContain('outc a1, a2');
    expect(directText).not.toContain('ga_bluemix_');
  });

  it('outputs directly when the mixer is disabled even if channel assignments exist', () => {
    const compileData = new CompileData();
    const channel = new Channel();
    channel.setName('Routed Track');
    channel.setAssociation('routed-track');
    compileData.getChannelIdAssignments().set(channel, 7);
    compileData.setMixerEnabled(false);

    const instrumentId = ensureTrackAudioPlaybackInstrument(
      'routed-track',
      new TimeContext(),
      compileData,
    );
    const text = instrumentText(compileData, String(instrumentId));
    expect(text).toContain('outc a1, a2');
    expect(text).not.toContain('ga_bluemix_');
    expect(text).not.toContain('ga_bluesub_');
  });

  it('associates self-instrumented Sound and FrozenSoundObject instruments with the Track without replacing p1', () => {
    const render = (item: Sound | FrozenSoundObject) => {
      const compileData = new CompileData();
      const track = new Track();
      track.setUniqueId('self-instrumented-track');
      item.setSubjectiveDuration(TimeDuration.beats(1));
      track.push(item);
      compileData.setTrackInstrumentId(track.getUniqueId(), 99);
      const note = track.generateForCSD(new TimeContext(), compileData, 0, -1).getNote(0);
      const instrument = compileData.getArrangement().getInstrumentById(note.getPField(1)!);
      expect(instrument).toBeDefined();
      expect(compileData.getInstrSourceId(instrument!)).toBe(track.getUniqueId());
      expect(note.getPField(1)).not.toBe('99');
      expect(note.getTrackInstrumentTarget()).toBe('preserve');
    };

    render(new Sound());
    const frozen = new FrozenSoundObject();
    frozen.setFrozenWaveFileName('/fixtures/frozen.wav');
    frozen.setNumChannels(2);
    render(frozen);
  });
});
