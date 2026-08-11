import { describe, expect, it, vi } from 'vitest';
import {
  AudioClip,
  BlueData,
  GenericScore,
  PolyObject,
  TimeDuration,
  TimePosition,
  TrackLayerGroup,
} from '@blue/data';
import { auditionSelectedScoreObjects } from './audition-score-objects';

function fixture(): { data: BlueData; selected: GenericScore } {
  const data = new BlueData();
  data.getScore().length = 0;
  const group = new PolyObject(true);
  const layer = group.newLayerAt(0);
  const selected = new GenericScore();
  selected.setStartTime(TimePosition.beats(1));
  selected.setSubjectiveDuration(TimeDuration.beats(1));
  layer.push(selected);
  data.getScore().push(group);
  return { data, selected };
}

describe('auditionSelectedScoreObjects', () => {
  it('stops existing realtime playback and starts an isolated copy', async () => {
    const { data, selected } = fixture();
    const stopRealtime = vi.fn().mockResolvedValue(undefined);
    const startRealtime = vi.fn().mockImplementation(async (auditionData: BlueData) => {
      expect(auditionData).not.toBe(data);
      expect(auditionData.getScore()[0]).not.toBe(data.getScore()[0]);
      return true;
    });

    await expect(auditionSelectedScoreObjects(data, [selected], {
      isRenderOperationActive: false,
      isRealtimePlaying: () => true,
      stopRealtime,
      startRealtime,
    })).resolves.toBe(true);

    expect(stopRealtime).toHaveBeenCalledOnce();
    expect(startRealtime).toHaveBeenCalledOnce();
  });

  it('returns the realtime startup result and does not start while disk render is active', async () => {
    const { data, selected } = fixture();
    const startRealtime = vi.fn().mockResolvedValue(false);
    const engine = {
      isRenderOperationActive: false,
      isRealtimePlaying: () => false,
      stopRealtime: vi.fn().mockResolvedValue(undefined),
      startRealtime,
    };

    await expect(auditionSelectedScoreObjects(data, [selected], engine)).resolves.toBe(false);
    expect(startRealtime).toHaveBeenCalledOnce();

    await expect(auditionSelectedScoreObjects(data, [selected], {
      ...engine,
      isRenderOperationActive: true,
    })).resolves.toBe(false);
    expect(startRealtime).toHaveBeenCalledOnce();
  });

  it('rejects empty, duplicate, and non-project selections before engine startup', async () => {
    const { data, selected } = fixture();
    const startRealtime = vi.fn().mockResolvedValue(true);
    const engine = {
      isRenderOperationActive: false,
      isRealtimePlaying: () => false,
      stopRealtime: vi.fn().mockResolvedValue(undefined),
      startRealtime,
    };

    await expect(auditionSelectedScoreObjects(data, [], engine)).resolves.toBe(false);
    await expect(auditionSelectedScoreObjects(data, [selected, selected], engine)).rejects.toThrow('duplicate');
    await expect(auditionSelectedScoreObjects(data, [new GenericScore()], engine)).rejects.toThrow('not part');
    expect(startRealtime).not.toHaveBeenCalled();
  });

  it('hands Track LayerGroup auditions to realtime without changing canonical XML', async () => {
    const data = new BlueData();
    data.getScore().length = 0;
    const group = new TrackLayerGroup();
    const track = group.newLayerAt(0);
    track.setMuted(true);
    track.setSolo(true);
    const selectedScore = new GenericScore();
    selectedScore.setStartTime(TimePosition.beats(1));
    selectedScore.setSubjectiveDuration(TimeDuration.beats(1));
    const selectedClip = new AudioClip();
    selectedClip.setAudioFile('/fixtures/audition.wav');
    selectedClip.setStartTime(TimePosition.beats(3));
    selectedClip.setSubjectiveDuration(TimeDuration.beats(1));
    const unselected = new GenericScore();
    track.push(selectedScore, selectedClip, unselected);
    group.newLayerAt(1);
    data.getScore().push(group);
    const sourceXml = data.saveToString();
    const startRealtime = vi.fn().mockImplementation(async (auditionData: BlueData) => {
      const auditionGroup = auditionData.getScore()[0] as TrackLayerGroup;
      expect(auditionGroup).toHaveLength(1);
      expect(auditionGroup[0]).toHaveLength(2);
      expect(auditionGroup[0]!.isMuted()).toBe(false);
      expect(auditionGroup[0]!.isSolo()).toBe(false);
      return true;
    });

    await expect(auditionSelectedScoreObjects(data, [selectedScore, selectedClip], {
      isRenderOperationActive: false,
      isRealtimePlaying: () => false,
      stopRealtime: vi.fn().mockResolvedValue(undefined),
      startRealtime,
    })).resolves.toBe(true);
    expect(data.saveToString()).toBe(sourceXml);
  });
});
