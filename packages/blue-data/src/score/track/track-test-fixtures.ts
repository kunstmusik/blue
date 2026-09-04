import { BlueData } from '../../blue-data';
import { GenericInstrument } from '../../instruments/generic-instrument';
import { GenericScore } from '../../sound-objects/generic-score';
import { AudioClip } from '../audio/audio-clip';
import { Track } from './track';
import { TrackLayerGroup } from './track-layer-group';
import { TimeDuration } from '../../time/time-duration';
import { TimePosition } from '../../time/time-position';

export function createTrackFixture(
  options: {
    groupId?: string;
    trackId?: string;
    includeClip?: boolean;
    includeSoundObject?: boolean;
  } = {},
): { data: BlueData; group: TrackLayerGroup; track: Track } {
  const data = new BlueData();
  const group = new TrackLayerGroup();
  group.setUniqueId(options.groupId ?? 'fixture-track-group');
  const track = group.newLayerAt(0);
  track.setUniqueId(options.trackId ?? 'fixture-track');
  track.setName('Fixture Track');

  if (options.includeSoundObject !== false) {
    const score = new GenericScore();
    score.setName('Fixture Notes');
    score.setScoreText('i1 0 1 60');
    score.setStartTime(TimePosition.beats(0));
    score.setSubjectiveDuration(TimeDuration.beats(1));
    track.push(score);
  }

  if (options.includeClip !== false) {
    const clip = new AudioClip();
    clip.setName('Fixture Audio');
    clip.setAudioFile('/fixtures/audio.wav');
    clip.setStartTime(TimePosition.beats(0));
    clip.setSubjectiveDuration(TimeDuration.beats(1));
    track.push(clip);
  }

  data.getScore().length = 0;
  data.getScore().push(group);
  return { data, group, track };
}

export function createTrackInstrumentFixture(name = 'Fixture Instrument'): GenericInstrument {
  const instrument = new GenericInstrument();
  instrument.setName(name);
  instrument.setText('aout oscili 0.1, 440\nouts aout, aout');
  return instrument;
}

export function createTrackWithInstrumentFixture(): ReturnType<typeof createTrackFixture> {
  const fixture = createTrackFixture();
  fixture.track.setInstrument(createTrackInstrumentFixture());
  return fixture;
}

export function createGeneratedCsdFixture(): string {
  return createTrackWithInstrumentFixture().data.toCSD();
}
