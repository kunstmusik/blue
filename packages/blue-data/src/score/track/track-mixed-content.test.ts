import { describe, expect, it } from 'vitest';
import { BlueData } from '../../blue-data';
import { CompileData } from '../../compile-data';
import { AudioFile } from '../../sound-objects/audio-file';
import { GenericScore } from '../../sound-objects/generic-score';
import { AudioClip } from '../audio/audio-clip';
import { TimeDuration } from '../../time/time-duration';
import { TimePosition } from '../../time/time-position';
import { Track } from './track';
import { TrackLayerGroup } from './track-layer-group';
import '../../sound-objects/register-sound-object-types';

function scoreAt(start: number): GenericScore {
  const score = new GenericScore();
  score.setName(`Score ${start}`);
  score.setScoreText('i1 0 1 60');
  score.setStartTime(TimePosition.beats(start));
  score.setSubjectiveDuration(TimeDuration.beats(1));
  return score;
}

function clipAt(start: number): AudioClip {
  const clip = new AudioClip();
  clip.setName(`Clip ${start}`);
  clip.setAudioFile('/fixtures/clip.wav');
  clip.setStartTime(TimePosition.beats(start));
  clip.setSubjectiveDuration(TimeDuration.beats(1));
  return clip;
}

describe('mixed Track content', () => {
  it('accepts ordered AudioClip and compatible SoundObject items and round-trips them', () => {
    const data = new BlueData();
    data.getScore().length = 0;
    const group = new TrackLayerGroup();
    group.setUniqueId('mixed-group');
    const track = group.newLayerAt(0);
    track.setUniqueId('mixed-track');
    track.push(clipAt(0), scoreAt(1));
    data.getScore().push(group);

    expect(track.map((item) => item.constructor.name)).toEqual(['AudioClip', 'GenericScore']);
    expect(track.accepts(new AudioFile())).toBe(false);
    expect(data.toCSD()).toContain('diskin2');

    const reopened = BlueData.loadFromString(data.saveToString());
    const reopenedTrack = (reopened.getScore()[0] as TrackLayerGroup)[0]!;
    expect(reopenedTrack.getUniqueId()).toBe('mixed-track');
    expect(reopenedTrack.map((item) => item.constructor.name)).toEqual([
      'AudioClip',
      'GenericScore',
    ]);
    expect(reopenedTrack[0]!.getStartTime().toBeats(reopened.getScore().getTimeContext())).toBe(0);
    expect(reopenedTrack[1]!.getStartTime().toBeats(reopened.getScore().getTimeContext())).toBe(1);
  });

  it('honors Track mute and solo state during render-window generation', () => {
    const data = new BlueData();
    data.getScore().length = 0;
    const group = new TrackLayerGroup();
    const first = group.newLayerAt(0);
    first.push(scoreAt(0));
    const second = group.newLayerAt(1);
    second.push(scoreAt(4));
    data.getScore().push(group);

    const context = data.getScore().getTimeContext();
    const baseline = group.generateForCSD(context, new CompileData(), 0, 2);
    expect(baseline.length).toBeGreaterThan(0);

    first.setMuted(true);
    expect(group.generateForCSD(context, new CompileData(), 0, 2).length).toBe(0);

    first.setMuted(false);
    first.setSolo(true);
    const soloNotes = group.generateForCSD(context, new CompileData(), 0, 6, {
      processWithSolo: true,
    });
    expect(soloNotes.length).toBeGreaterThan(0);
    expect(soloNotes.map((note) => note.getStartTime()).every((start) => start < 2)).toBe(true);
  });
});
