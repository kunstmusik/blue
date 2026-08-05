import { describe, expect, it } from 'vitest';
import { BlueData } from './blue-data';
import { Arrangement } from './arrangement';
import { BlueSynthBuilder } from './instruments/blue-synth-builder';
import { Track } from './score/track/track';
import { TrackLayerGroup } from './score/track/track-layer-group';
import { AudioClip } from './score/audio/audio-clip';
import { TimeDuration } from './time/time-duration';
import { TimePosition } from './time/time-position';
import { Channel } from './mixer/channel';

function extractScoreEvents(csd: string): string[] {
  const match = csd.match(/<CsScore>([\s\S]*?)<\/CsScore>/);
  if (!match) {
    return [];
  }

  return match[1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('i'));
}

describe('BlueData scheduling parity', () => {
  it('schedules always-on instruments using source arrangement ids', () => {
    const data = new BlueData();

    const arrangement = new Arrangement();

    const numericAlwaysOn = new BlueSynthBuilder();
    numericAlwaysOn.setName('Numeric');
    numericAlwaysOn.setInstrumentText('aout oscili 0.1, 440\nblueMixerOut aout, aout');
    numericAlwaysOn.setAlwaysOnInstrumentText('aout oscili 0.05, 220\nblueMixerOut aout, aout');

    const namedAlwaysOn = new BlueSynthBuilder();
    namedAlwaysOn.setName('Named');
    namedAlwaysOn.setInstrumentText('aout oscili 0.1, 660\nblueMixerOut aout, aout');
    namedAlwaysOn.setAlwaysOnInstrumentText('aout oscili 0.05, 330\nblueMixerOut aout, aout');

    arrangement.addInstrument(numericAlwaysOn, '10');
    arrangement.addInstrument(namedAlwaysOn, 'PadBus');
    data.setArrangement(arrangement);

    const csd = data.toCSD();
    const scoreEvents = extractScoreEvents(csd);

    expect(scoreEvents.some((line) => line.startsWith('i11\t0'))).toBe(true);
    expect(scoreEvents.some((line) => line.startsWith('i"PadBus_alwaysOn"\t0'))).toBe(true);
  });

  it('replaces audio-layer placeholder ids with compile-time instrument ids', () => {
    const data = new BlueData();

    const layer = new Track();
    const clip = new AudioClip();
    clip.setAudioFile('/tmp/kick.wav');
    clip.setStartTime(TimePosition.beats(0));
    clip.setSubjectiveDuration(TimeDuration.beats(2));
    clip.setLooping(null, false);
    layer.push(clip);

    const layerGroup = new TrackLayerGroup();
    layerGroup.push(layer);
    data.getScore().push(layerGroup);

    const channel = new Channel();
    channel.setName('Audio Layer');
    channel.setAssociation(layer.getUniqueId());
    data.getMixer().getChannels().push(channel);

    const csd = data.toCSD();
    const scoreEvents = extractScoreEvents(csd);

    expect(csd).toContain('blue_fade');
    expect(csd).not.toContain('INSTR_ID');
    expect(scoreEvents.some((line) => /^i\d+/.test(line))).toBe(true);
  });
});
