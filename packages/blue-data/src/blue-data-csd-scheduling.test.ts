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
  it.each(['blueMixerOut limit(aL, -1, 1), aR, aC', 'blueMixerOut(limit(aL, -1, 1), aR, aC)'])(
    'routes multichannel always-on expressions: %s',
    (output) => {
      const data = new BlueData();
      data.getProjectProperties().channels = '3';
      data.getMixer().setPanningEnabled(false);
      const instrument = new BlueSynthBuilder();
      instrument.setInstrumentText('aout init 0\nblueMixerOut aout, aout, aout');
      instrument.setAlwaysOnInstrumentText(output);
      data.getArrangement().addInstrument(instrument, '1');
      const channel = new Channel();
      channel.setName('1');
      data.getMixer().getChannels().push(channel);

      const alwaysOn = data.toCSD().match(/\tinstr 2\s*;[^\n]*\n([\s\S]*?)\tendin/)?.[1];
      expect(alwaysOn).toMatch(/ga_bluemix_0_0\s*=\s*limit\(aL, -1, 1\)/);
      expect(alwaysOn).toMatch(/ga_bluemix_0_1\s*=\s*aR\s*\n/);
      expect(alwaysOn).toMatch(/ga_bluemix_0_2\s*=\s*aC\s*\n/);
    },
  );

  it.each([
    ['blueMixerOut aL, aR', true],
    ['blueMixerOut(aL, aR)', true],
    ['blueMixerOut aL, aR', false],
    ['blueMixerOut(aL, aR)', false],
  ])('routes always-on output to its source channel: %s (input: %s)', (output, hasInput) => {
    const data = new BlueData();
    const instrument = new BlueSynthBuilder();
    instrument.setInstrumentText('aout oscili 0.1, 440\nblueMixerOut aout, aout');
    instrument.setAlwaysOnInstrumentText(
      `${hasInput ? 'aL, aR blueMixerIn' : 'aL init 0\naR init 0'}\n${output}`,
    );
    data.getArrangement().addInstrument(instrument, '1');
    const channel = new Channel();
    channel.setName('1');
    data.getMixer().getChannels().push(channel);

    const csd = data.toCSD();
    const alwaysOn = csd.match(/\tinstr 2\s*;[^\n]*\n([\s\S]*?)\tendin/)?.[1];
    expect(alwaysOn).toBeDefined();
    if (hasInput) {
      expect(alwaysOn).toMatch(/aL\s*=\s*ga_bluemix_0_0/);
      expect(alwaysOn).toMatch(/aR\s*=\s*ga_bluemix_0_1/);
    }
    expect(alwaysOn).toMatch(/ga_bluemix_0_0\s*=\s*aL/);
    expect(alwaysOn).toMatch(/ga_bluemix_0_1\s*=\s*aR/);
  });

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
    data.getMixer().setPanningEnabled(false);

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
