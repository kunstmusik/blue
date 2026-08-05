import { describe, expect, it } from 'vitest';
import { BlueData, PolyObject, TrackLayerGroup } from '@blue/data';
import { applyProjectDocumentPatch } from './project-editor';

describe('generic layer-group creation', () => {
  it('uses Track Layer as the safe default when no type is supplied', () => {
    const data = new BlueData();
    const changed = applyProjectDocumentPatch(data, {
      score: { type: 'addLayerGroup' },
    });

    expect(changed).toBe(true);
    const added = data.getScore()[data.getScore().length - 1];
    expect(added).toBeInstanceOf(TrackLayerGroup);
    expect((added as TrackLayerGroup).length).toBe(1);
    const track = (added as TrackLayerGroup)[0]!;
    const mixerGroup = data.getMixer().getChannelListGroups().find(
      (candidate) => candidate.getAssociation() === (added as TrackLayerGroup).getUniqueId(),
    );
    expect(mixerGroup).toBeDefined();
    expect(Array.from(mixerGroup ?? [], (channel) => channel.getAssociation())).toEqual([
      track.getUniqueId(),
    ]);
  });

  it('honors the configured SoundObject default only for omitted generic intents', () => {
    const data = new BlueData();
    applyProjectDocumentPatch(
      data,
      { score: { type: 'addLayerGroup' } },
      { projectSessionId: 0, projectRevision: 0, defaultLayerGroupType: 'SOUND_OBJECT' },
    );

    const added = data.getScore()[data.getScore().length - 1];
    expect(added).toBeInstanceOf(PolyObject);
    expect((added as PolyObject).length).toBe(1);
  });

  it('preserves an explicit Track choice under the SoundObject default', () => {
    const data = new BlueData();
    applyProjectDocumentPatch(
      data,
      { score: { type: 'addLayerGroup', groupType: 'track' } },
      { projectSessionId: 0, projectRevision: 0, defaultLayerGroupType: 'SOUND_OBJECT' },
    );

    expect(data.getScore()[data.getScore().length - 1]).toBeInstanceOf(TrackLayerGroup);
  });
});
