import { describe, expect, it, vi } from 'vitest';
import { BlueData } from '../../blue-data';
import { GenericScore } from '../../sound-objects/generic-score';
import { AudioClip } from '../audio/audio-clip';
import { TimeDuration } from '../../time/time-duration';
import { TimePosition } from '../../time/time-position';
import { TrackLayerGroup } from './track-layer-group';

describe('Track performance envelope', () => {
  it('compiles a 1,000-item mixed Track with one generation visit per note object', () => {
    const data = new BlueData();
    data.getScore().length = 0;
    const group = new TrackLayerGroup();
    group.setUniqueId('performance-group');
    const track = group.newLayerAt(0);
    track.setUniqueId('performance-track');

    for (let index = 0; index < 1000; index += 1) {
      const start = index / 4;
      if (index % 2 === 0) {
        const score = new GenericScore();
        score.setScoreText('i1 0 0.25 60');
        score.setStartTime(TimePosition.beats(start));
        score.setSubjectiveDuration(TimeDuration.beats(0.25));
        track.push(score);
      } else {
        const clip = new AudioClip();
        clip.setAudioFile('/fixtures/performance.wav');
        clip.setStartTime(TimePosition.beats(start));
        clip.setSubjectiveDuration(TimeDuration.beats(0.25));
        track.push(clip);
      }
    }
    data.getScore().push(group);

    const generateScore = vi.spyOn(GenericScore.prototype, 'generateForCSD');
    const csd = data.toCSD();
    expect(track).toHaveLength(1000);
    expect(csd).toContain('diskin2');
    expect(csd).toContain('i1');
    expect(generateScore).toHaveBeenCalledTimes(500);
    generateScore.mockRestore();
  });
});
