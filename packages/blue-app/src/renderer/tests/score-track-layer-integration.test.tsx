import { describe, expect, it } from 'vitest';
import {
  AudioClip,
  BlueData,
  GenericScore,
  TimeDuration,
  TimePosition,
  TrackLayerGroup,
} from '@blue/data';
import {
  applyProjectDocumentPatch,
  createProjectEditorSnapshot,
} from '../../shared/project-editor';

describe('Track layer renderer integration contract', () => {
  it('projects mixed selection/editor targets, acknowledges removal, and reopens canonically', () => {
    const data = new BlueData();
    data.getScore().length = 0;
    const group = new TrackLayerGroup();
    group.setUniqueId('integration-group');
    const track = group.newLayerAt(0);
    track.setUniqueId('integration-track');

    const soundObject = new GenericScore();
    soundObject.setName('Editor Score');
    soundObject.setStartTime(TimePosition.beats(0));
    soundObject.setSubjectiveDuration(TimeDuration.beats(1));
    track.push(soundObject);

    const clip = new AudioClip();
    clip.setName('Editor Clip');
    clip.setAudioFile('/fixtures/editor.wav');
    clip.setStartTime(TimePosition.beats(1));
    clip.setSubjectiveDuration(TimeDuration.beats(2));
    track.push(clip);
    data.getScore().push(group);

    const snapshot = createProjectEditorSnapshot(data, '/tmp/track-integration.blue', 11, 4);
    const layerGroup = snapshot.score?.layerGroups[0];
    expect(layerGroup?.groupType).toBe('track');
    if (!layerGroup || layerGroup.groupType !== 'track') throw new Error('missing Track group');
    const layer = layerGroup.layers[0]!;
    expect(layer.items.map((item) => item.objectType)).toEqual(['GenericScore', 'AudioClip']);
    expect(layer.items[0]?.editorTarget.location).toMatchObject({
      rootGroupId: 'integration-group',
      trackId: 'integration-track',
      layerKind: 'track',
    });
    expect(layer.items[1]?.barRenderer.kind).toBe('audioClip');

    expect(applyProjectDocumentPatch(data, {
      score: {
        type: 'removeScoreObjects',
        targets: [layer.items[0]!.editorTarget],
      },
    }, { projectSessionId: 11, projectRevision: 4 })).toBe(true);
    expect(track).toHaveLength(1);

    const reopened = BlueData.loadFromString(data.saveToString());
    const reopenedSnapshot = createProjectEditorSnapshot(reopened, '/tmp/track-integration.blue');
    const reopenedGroup = reopenedSnapshot.score?.layerGroups[0];
    expect(reopenedGroup?.groupType).toBe('track');
    const reopenedItems = reopenedGroup?.groupType === 'track' ? reopenedGroup.layers[0]?.items : undefined;
    expect(reopenedItems).toHaveLength(1);
    expect(reopenedItems?.[0]?.objectType).toBe('AudioClip');
  });
});
