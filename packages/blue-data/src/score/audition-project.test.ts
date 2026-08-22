import { describe, expect, it } from 'vitest';
import { BlueData } from '../blue-data';
import { AudioClip } from './audio/audio-clip';
import { PolyObject } from '../sound-objects/poly-object';
import { GenericScore } from '../sound-objects/generic-score';
import { TimeDuration } from '../time/time-duration';
import { TimePosition } from '../time/time-position';
import { TrackLayerGroup } from './track/track-layer-group';
import { GenericInstrument } from '../instruments/generic-instrument';
import { createAuditionProjectCopy } from './audition-project';

function scoreAt(name: string, start: number, duration: number): GenericScore {
  const score = new GenericScore();
  score.setName(name);
  score.setScoreText(`i1 0 ${duration} 60`);
  score.setStartTime(TimePosition.beats(start));
  score.setSubjectiveDuration(TimeDuration.beats(duration));
  return score;
}

function clipAt(name: string, start: number, duration: number): AudioClip {
  const clip = new AudioClip();
  clip.setName(name);
  clip.setAudioFile('/fixtures/audition.wav');
  clip.setStartTime(TimePosition.beats(start));
  clip.setSubjectiveDuration(TimeDuration.beats(duration));
  return clip;
}

function createConventionalFixture(): {
  data: BlueData;
  selected: GenericScore;
  unselected: GenericScore;
} {
  const data = new BlueData();
  data.getScore().length = 0;
  const group = new PolyObject(true);
  const selectedLayer = group.newLayerAt(0);
  selectedLayer.setName('Selected Layer');
  selectedLayer.setMuted(true);
  selectedLayer.setSolo(true);
  const selected = scoreAt('Selected', 2, 3);
  const unselected = scoreAt('Unselected', 0, 1);
  selectedLayer.push(selected, unselected);
  const emptyLayer = group.newLayerAt(1);
  emptyLayer.push(scoreAt('Other Layer', 12, 1));
  data.getScore().push(group);
  data.getMixer().setEnabled(true);
  data.getMixer().setExtraRenderTime(0.5);
  return { data, selected, unselected };
}

function createTrackFixture(): {
  data: BlueData;
  group: TrackLayerGroup;
  selectedScore: GenericScore;
  selectedClip: AudioClip;
} {
  const data = new BlueData();
  data.getScore().length = 0;
  const group = new TrackLayerGroup();
  const selectedTrack = group.newLayerAt(0);
  selectedTrack.setName('Selected Track');
  selectedTrack.setMuted(true);
  selectedTrack.setSolo(true);
  const instrument = new GenericInstrument();
  instrument.setName('Track-owned audition instrument');
  selectedTrack.setInstrument(instrument);
  const selectedScore = scoreAt('Selected Track Score', 1, 1);
  selectedScore.setScoreText('i7 0 1 61');
  const selectedClip = clipAt('Selected Track Clip', 4, 2);
  const unselectedSibling = scoreAt('Unselected Sibling', 7, 1);
  unselectedSibling.setScoreText('i8 0 1 62');
  selectedTrack.push(selectedScore, selectedClip, unselectedSibling);
  const unselectedTrack = group.newLayerAt(1);
  unselectedTrack.push(scoreAt('Unselected Track Score', 0, 1));
  data.getScore().push(group);
  return { data, group, selectedScore, selectedClip };
}

describe('createAuditionProjectCopy', () => {
  it('keeps selected conventional score objects and derives a one-shot render window', () => {
    const { data, selected, unselected } = createConventionalFixture();
    const sourceXml = data.saveToString();

    const audition = createAuditionProjectCopy(data, [selected]);
    const group = audition.getScore()[0] as PolyObject;

    expect(group).toHaveLength(1);
    expect(group[0]).toHaveLength(1);
    expect(group[0]![0]!.getName()).toBe('Selected');
    expect(group[0]!.isMuted()).toBe(false);
    expect(group[0]!.isSolo()).toBe(false);
    expect(audition.isLoopRendering()).toBe(false);
    expect(audition.getRenderStartTime()).toBe(2);
    expect(audition.getRenderEndTime()).toBe(5.5);
    const render = audition.toRealtimePlaybackCSD();
    expect(render.csdText).toMatch(/i1\s+0(?:\.0)?\s+3\s+60/);
    expect(render.csdText).not.toMatch(/i1\s+0(?:\.0)?\s+1\s+60/);
    expect(unselected.getName()).toBe('Unselected');
    expect(data.saveToString()).toBe(sourceXml);
  });

  it('keeps selected Track sound objects and audio clips while removing unrelated tracks/items', () => {
    const { data, group, selectedScore, selectedClip } = createTrackFixture();

    const audition = createAuditionProjectCopy(data, [selectedScore, selectedClip]);
    const auditionGroup = audition.getScore()[0] as TrackLayerGroup;

    expect(auditionGroup).toHaveLength(1);
    expect(auditionGroup[0]).toHaveLength(2);
    expect(auditionGroup[0]!.map((item) => item.getName())).toEqual([
      'Selected Track Score',
      'Selected Track Clip',
    ]);
    expect(auditionGroup[0]!.isMuted()).toBe(false);
    expect(auditionGroup[0]!.isSolo()).toBe(false);
    expect(auditionGroup[0]!.getInstrument()?.getName()).toBe('Track-owned audition instrument');
    const render = audition.toRealtimePlaybackCSD();
    expect(render.csdText).toMatch(/i\d+\s+0(?:\.0)?\s+1\s+61/);
    expect(render.csdText).not.toMatch(/i\d+\s+0(?:\.0)?\s+1\s+62/);
    expect(group[0]).toHaveLength(3);
  });

  it('creates independent disposable copies that remain serializable', () => {
    const { data, selected } = createConventionalFixture();
    const first = createAuditionProjectCopy(data, [selected]);
    const second = createAuditionProjectCopy(data, [selected]);
    const firstSelected = (first.getScore()[0] as PolyObject)[0]![0]!;

    firstSelected.setName('Changed only in first audition');
    expect((second.getScore()[0] as PolyObject)[0]![0]!.getName()).toBe('Selected');
    expect(selected.getName()).toBe('Selected');
    expect(first.saveToString()).toContain('Changed only in first audition');
    expect(data.saveToString()).not.toContain('Changed only in first audition');
  });

  it('keeps auditions of Track audio clips audible when the mixer is disabled', () => {
    const { data, selectedClip } = createTrackFixture();
    data.getMixer().setEnabled(false);

    const audition = createAuditionProjectCopy(data, [selectedClip]);
    const csd = audition.toRealtimePlaybackCSD().csdText;

    expect(csd).toMatch(/i\d+\s+0(?:\.0)?\s+2\s+"\/fixtures\/audition\.wav"/);
    expect(csd).toContain('outc a1, a2');
    expect(csd).not.toContain('ga_bluemix_');
    expect(csd).not.toContain('ga_bluesub_');
    expect(csd).not.toContain('BlueMixer');
  });

  it('routes auditioned Track audio clips to the Master sub-channel when the track has no mixer channel', () => {
    const { data, selectedClip } = createTrackFixture();
    data.getMixer().setEnabled(true);

    const audition = createAuditionProjectCopy(data, [selectedClip]);
    const csd = audition.toRealtimePlaybackCSD().csdText;

    expect(csd).toMatch(/i\d+\s+0(?:\.0)?\s+2\s+"\/fixtures\/audition\.wav"/);
    expect(csd).toContain('ga_bluesub_Master_0');
    expect(csd).toContain('ga_bluesub_Master_1');
    expect(csd).not.toMatch(/ga_bluemix_\d+_\d/);
    expect(csd).toContain('BlueMixer');
  });
});
