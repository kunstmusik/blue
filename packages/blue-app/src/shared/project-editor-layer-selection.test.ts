import { describe, expect, it } from 'vitest';
import {
  BlueData,
  PatternsLayerGroup,
  PatternLayer,
  PolyObject,
  SoundLayer,
  TrackLayer,
  TrackLayerGroup,
} from '@blue/data';
import {
  applyProjectDocumentPatch,
  createNestedPolyObjectSnapshot,
  createScoreDocumentSnapshot,
} from './project-editor';
import { getLayerSelectionId } from '../renderer/components/workbench/panels/score/layer-selection-utils';

describe('project-editor layerSelectionId identity and serialization invariants', () => {
  it('populates transient layerSelectionId for Pattern, Track, and PolyObject snapshots', () => {
    const data = new BlueData();
    const score = data.getScore();
    score.length = 0;

    const polyGroup = new PolyObject();
    polyGroup.setName('Sound Group');
    const polyLayer1 = new SoundLayer();
    polyLayer1.setName('Poly 1');
    const polyLayer2 = new SoundLayer();
    polyLayer2.setName('Poly 2');
    polyGroup.push(polyLayer1);
    polyGroup.push(polyLayer2);

    const trackGroup = new TrackLayerGroup();
    trackGroup.setName('Track Group');
    const track1 = new TrackLayer();
    track1.setName('Track 1');
    trackGroup.push(track1);

    const patternGroup = new PatternsLayerGroup();
    patternGroup.setName('Pattern Group');
    const pat1 = new PatternLayer();
    pat1.setName('Pattern 1');
    patternGroup.push(pat1);

    score.push(polyGroup);
    score.push(trackGroup);
    score.push(patternGroup);

    const snap = createScoreDocumentSnapshot(data);
    expect(snap.layerGroups).toHaveLength(3);

    const soundSnap = snap.layerGroups[0]!;
    expect(soundSnap.layers[0]?.layerSelectionId).toBeDefined();
    expect(soundSnap.layers[1]?.layerSelectionId).toBeDefined();
    expect(soundSnap.layers[0]?.layerSelectionId).not.toBe(soundSnap.layers[1]?.layerSelectionId);

    const trackSnap = snap.layerGroups[1]!;
    expect(trackSnap.layers[0]?.layerSelectionId).toBeDefined();

    const patSnap = snap.layerGroups[2]!;
    expect(patSnap.layers[0]?.layerSelectionId).toBeDefined();
  });

  it('preserves layerSelectionId when layers are reordered in memory', () => {
    const data = new BlueData();
    const score = data.getScore();
    score.length = 0;

    const polyGroup = new PolyObject();
    const layerA = new SoundLayer();
    layerA.setName('Layer A');
    const layerB = new SoundLayer();
    layerB.setName('Layer B');
    polyGroup.push(layerA);
    polyGroup.push(layerB);
    score.push(polyGroup);

    const snapBefore = createScoreDocumentSnapshot(data);
    const selIdA = snapBefore.layerGroups[0]!.layers[0]!.layerSelectionId;
    const selIdB = snapBefore.layerGroups[0]!.layers[1]!.layerSelectionId;

    // Swap layers in PolyObject
    polyGroup.splice(0, 1);
    polyGroup.push(layerA); // Now layerB is at 0, layerA is at 1

    const snapAfter = createScoreDocumentSnapshot(data);
    expect(snapAfter.layerGroups[0]!.layers[0]!.name).toBe('Layer B');
    expect(snapAfter.layerGroups[0]!.layers[0]!.layerSelectionId).toBe(selIdB);
    expect(snapAfter.layerGroups[0]!.layers[1]!.name).toBe('Layer A');
    expect(snapAfter.layerGroups[0]!.layers[1]!.layerSelectionId).toBe(selIdA);
  });

  it('does not serialize layerSelectionId to .blue XML', () => {
    const data = new BlueData();
    const xml = data.saveToString();
    expect(xml).not.toContain('layerSelectionId');
    expect(xml).not.toContain('lsel-');
  });

  it('falls back to layerId if layerSelectionId is undefined in older snapshots', () => {
    expect(getLayerSelectionId({ layerId: 'legacy-1', name: 'Legacy', height: 44, items: [] })).toBe('legacy-1');
    expect(
      getLayerSelectionId({
        layerId: 'poly-layer-0',
        layerSelectionId: 'lsel-99',
        name: 'Modern',
        height: 44,
        items: [],
      }),
    ).toBe('lsel-99');
  });
});

describe('project-editor moveLayerRange and removeLayerRanges patches', () => {
  it('moves a contiguous range of layers within a layer group and preserves selection identity', () => {
    const data = new BlueData();
    const score = data.getScore();
    score.length = 0;

    const polyGroup = new PolyObject();
    polyGroup.setName('Group 1');
    const layers = ['L0', 'L1', 'L2', 'L3'].map((name) => {
      const l = new SoundLayer();
      l.setName(name);
      return l;
    });
    layers.forEach((l) => polyGroup.push(l));
    score.push(polyGroup);

    const initialSnap = createScoreDocumentSnapshot(data);
    const selIds = initialSnap.layerGroups[0]!.layers.map((l) => l.layerSelectionId);

    // Move range [1, 2] (L1, L2) to targetIndex 0
    const applied = applyProjectDocumentPatch(data, {
      score: {
        type: 'moveLayerRange',
        groupId: initialSnap.layerGroups[0]!.groupId,
        startIndex: 1,
        endIndex: 2,
        targetIndex: 0,
      },
    });

    expect(applied).toBe(true);

    const afterSnap = createScoreDocumentSnapshot(data);
    expect(afterSnap.layerGroups[0]!.layers.map((l) => l.name)).toEqual(['L1', 'L2', 'L0', 'L3']);
    expect(afterSnap.layerGroups[0]!.layers.map((l) => l.layerSelectionId)).toEqual([selIds[1], selIds[2], selIds[0], selIds[3]]);
  });

  it('moves ranges through the shared LayerGroup operations for every managed group type', () => {
    const data = new BlueData();
    const score = data.getScore();
    score.length = 0;

    const polyGroup = new PolyObject();
    for (const name of ['P0', 'P1', 'P2', 'P3']) {
      const layer = new SoundLayer();
      layer.setName(name);
      polyGroup.push(layer);
    }

    const trackGroup = new TrackLayerGroup();
    for (const name of ['T0', 'T1', 'T2', 'T3']) {
      const layer = new TrackLayer();
      layer.setName(name);
      trackGroup.push(layer);
    }

    const patternGroup = new PatternsLayerGroup();
    for (const name of ['R0', 'R1', 'R2', 'R3']) {
      const layer = new PatternLayer();
      layer.setName(name);
      patternGroup.push(layer);
    }

    score.push(polyGroup, trackGroup, patternGroup);
    const groupIds = createScoreDocumentSnapshot(data).layerGroups.map((group) => group.groupId);

    for (const groupId of groupIds) {
      expect(applyProjectDocumentPatch(data, {
        score: { type: 'moveLayerRange', groupId, startIndex: 1, endIndex: 2, targetIndex: 0 },
      })).toBe(true);
    }

    expect(Array.from(polyGroup, (layer) => layer.getName())).toEqual(['P1', 'P2', 'P0', 'P3']);
    expect(Array.from(trackGroup, (layer) => layer.getName())).toEqual(['T1', 'T2', 'T0', 'T3']);
    expect(Array.from(patternGroup, (layer) => layer.getName())).toEqual(['R1', 'R2', 'R0', 'R3']);

    for (const groupId of groupIds) {
      expect(applyProjectDocumentPatch(data, {
        score: { type: 'moveLayerRange', groupId, startIndex: 0, endIndex: 1, targetIndex: 1 },
      })).toBe(true);
    }

    expect(Array.from(polyGroup, (layer) => layer.getName())).toEqual(['P0', 'P1', 'P2', 'P3']);
    expect(Array.from(trackGroup, (layer) => layer.getName())).toEqual(['T0', 'T1', 'T2', 'T3']);
    expect(Array.from(patternGroup, (layer) => layer.getName())).toEqual(['R0', 'R1', 'R2', 'R3']);
  });

  it('pushes up multiple selected layers 2, 3, 4 (indices 1..3) in a 4-layer group to index 0', () => {
    const data = new BlueData();
    const score = data.getScore();
    score.length = 0;

    const polyGroup = new PolyObject();
    polyGroup.setName('Group 1');
    const layers = ['Layer 1', 'Layer 2', 'Layer 3', 'Layer 4'].map((name) => {
      const l = new SoundLayer();
      l.setName(name);
      return l;
    });
    layers.forEach((l) => polyGroup.push(l));
    score.push(polyGroup);

    const initialSnap = createScoreDocumentSnapshot(data);
    const groupId = initialSnap.layerGroups[0]!.groupId;

    // Move range [1, 3] (Layer 2, Layer 3, Layer 4) to targetIndex 0
    const applied = applyProjectDocumentPatch(data, {
      score: {
        type: 'moveLayerRange',
        groupId,
        startIndex: 1,
        endIndex: 3,
        targetIndex: 0,
      },
    });

    expect(applied).toBe(true);

    const afterSnap = createScoreDocumentSnapshot(data);
    const names = afterSnap.layerGroups[0]!.layers.map((l) => l.name);
    // Layers 2, 3, 4 become top layers 0, 1, 2; Layer 1 moves to the bottom (index 3)
    expect(names).toEqual(['Layer 2', 'Layer 3', 'Layer 4', 'Layer 1']);
  });

  it('pushes down multiple selected layers 1, 2, 3 (indices 0..2) in a 4-layer group to index 1', () => {
    const data = new BlueData();
    const score = data.getScore();
    score.length = 0;

    const polyGroup = new PolyObject();
    polyGroup.setName('Group 1');
    const layers = ['Layer 1', 'Layer 2', 'Layer 3', 'Layer 4'].map((name) => {
      const l = new SoundLayer();
      l.setName(name);
      return l;
    });
    layers.forEach((l) => polyGroup.push(l));
    score.push(polyGroup);

    const initialSnap = createScoreDocumentSnapshot(data);
    const groupId = initialSnap.layerGroups[0]!.groupId;

    // Move range [0, 2] (Layer 1, Layer 2, Layer 3) down to targetIndex 1
    const applied = applyProjectDocumentPatch(data, {
      score: {
        type: 'moveLayerRange',
        groupId,
        startIndex: 0,
        endIndex: 2,
        targetIndex: 1,
      },
    });

    expect(applied).toBe(true);

    const afterSnap = createScoreDocumentSnapshot(data);
    const names = afterSnap.layerGroups[0]!.layers.map((l) => l.name);
    // Layer 4 moves to index 0; Layers 1, 2, 3 move to indices 1, 2, 3
    expect(names).toEqual(['Layer 4', 'Layer 1', 'Layer 2', 'Layer 3']);
  });

  it('rejects out of bounds moveLayerRange patches safely', () => {
    const data = new BlueData();
    const score = data.getScore();
    score.length = 0;

    const polyGroup = new PolyObject();
    const l0 = new SoundLayer();
    l0.setName('L0');
    polyGroup.push(l0);
    score.push(polyGroup);

    const initialSnap = createScoreDocumentSnapshot(data);
    const groupId = initialSnap.layerGroups[0]!.groupId;

    expect(applyProjectDocumentPatch(data, {
      score: { type: 'moveLayerRange', groupId, startIndex: -1, endIndex: 0, targetIndex: 0 },
    })).toBe(false);

    expect(applyProjectDocumentPatch(data, {
      score: { type: 'moveLayerRange', groupId, startIndex: 0, endIndex: 5, targetIndex: 0 },
    })).toBe(false);

    expect(applyProjectDocumentPatch(data, {
      score: { type: 'moveLayerRange', groupId, startIndex: 0, endIndex: 0, targetIndex: 2 },
    })).toBe(false);
  });

  it('removes ranges across multiple layer groups in descending order and removes empty groups when requested', () => {
    const data = new BlueData();
    const score = data.getScore();
    score.length = 0;

    const polyGroup = new PolyObject();
    polyGroup.setName('Poly');
    const p0 = new SoundLayer(); p0.setName('P0');
    const p1 = new SoundLayer(); p1.setName('P1');
    const p2 = new SoundLayer(); p2.setName('P2');
    polyGroup.push(p0, p1, p2);

    const trackGroup = new TrackLayerGroup();
    trackGroup.setName('Tracks');
    const t0 = new TrackLayer(); t0.setName('T0');
    const t1 = new TrackLayer(); t1.setName('T1');
    trackGroup.push(t0, t1);

    score.push(polyGroup, trackGroup);

    const snap = createScoreDocumentSnapshot(data);
    const polyGroupId = snap.layerGroups[0]!.groupId;
    const trackGroupId = snap.layerGroups[1]!.groupId;

    // Remove Poly [0, 1] and all of Track [0, 1] with deleteEmptyLayerGroups: true
    const applied = applyProjectDocumentPatch(data, {
      score: {
        type: 'removeLayerRanges',
        ranges: [
          { groupId: polyGroupId, startIndex: 0, endIndex: 1 },
          { groupId: trackGroupId, startIndex: 0, endIndex: 1 },
        ],
        deleteEmptyLayerGroups: true,
      },
    });

    expect(applied).toBe(true);

    const afterSnap = createScoreDocumentSnapshot(data);
    // Poly should have 1 layer remaining ('P2')
    expect(afterSnap.layerGroups).toHaveLength(1);
    expect(afterSnap.layerGroups[0]!.layers).toHaveLength(1);
    expect(afterSnap.layerGroups[0]!.layers[0]!.name).toBe('P2');
    // Track group was empty and deleted
  });

  it('atomically rejects removeLayerRanges if any range is invalid before mutating', () => {
    const data = new BlueData();
    const score = data.getScore();
    score.length = 0;

    const polyGroup = new PolyObject();
    const p0 = new SoundLayer(); p0.setName('P0');
    polyGroup.push(p0);
    score.push(polyGroup);

    const snap = createScoreDocumentSnapshot(data);
    const polyGroupId = snap.layerGroups[0]!.groupId;

    const applied = applyProjectDocumentPatch(data, {
      score: {
        type: 'removeLayerRanges',
        ranges: [
          { groupId: polyGroupId, startIndex: 0, endIndex: 0 },
          { groupId: 'non-existent-group', startIndex: 0, endIndex: 0 },
        ],
        deleteEmptyLayerGroups: false,
      },
    });

    expect(applied).toBe(false);
    expect(polyGroup.length).toBe(1);
    expect(polyGroup[0]!.getName()).toBe('P0');
  });

  it('rejects overlapping ranges within one group before mutating', () => {
    const data = new BlueData();
    const score = data.getScore();
    score.length = 0;

    const polyGroup = new PolyObject();
    polyGroup.push(new SoundLayer(), new SoundLayer(), new SoundLayer());
    score.push(polyGroup);

    const groupId = createScoreDocumentSnapshot(data).layerGroups[0]!.groupId;
    expect(applyProjectDocumentPatch(data, {
      score: {
        type: 'removeLayerRanges',
        ranges: [
          { groupId, startIndex: 0, endIndex: 1 },
          { groupId, startIndex: 1, endIndex: 2 },
        ],
        deleteEmptyLayerGroups: true,
      },
    })).toBe(false);
    expect(polyGroup).toHaveLength(3);
  });

  it('preserves unrelated empty groups when deleting selected empty groups', () => {
    const data = new BlueData();
    const score = data.getScore();
    score.length = 0;

    const selectedGroup = new PolyObject();
    const selectedLayer = new SoundLayer();
    selectedLayer.setName('Selected');
    selectedGroup.push(selectedLayer);
    const unrelatedEmptyGroup = new PolyObject();
    unrelatedEmptyGroup.setName('Keep Me');
    score.push(selectedGroup, unrelatedEmptyGroup);

    const snapshot = createScoreDocumentSnapshot(data);
    const selectedGroupId = snapshot.layerGroups[0]!.groupId;
    const unrelatedGroupId = snapshot.layerGroups[1]!.groupId;

    expect(applyProjectDocumentPatch(data, {
      score: {
        type: 'removeLayerRanges',
        ranges: [{ groupId: selectedGroupId, startIndex: 0, endIndex: 0 }],
        deleteEmptyLayerGroups: true,
      },
    })).toBe(true);

    expect(Array.from(score, (group) => group === unrelatedEmptyGroup)).toEqual([true]);
    expect(createScoreDocumentSnapshot(data).layerGroups[0]?.groupId).toBe(unrelatedGroupId);
  });

  it('removes an emptied nested PolyObject group from its containing layer', () => {
    const data = new BlueData();
    const score = data.getScore();
    score.length = 0;

    const rootGroup = new PolyObject();
    const rootLayer = new SoundLayer();
    const nestedGroup = new PolyObject();
    nestedGroup.setName('Nested');
    nestedGroup.push(new SoundLayer());
    rootLayer.push(nestedGroup);
    rootGroup.push(rootLayer);
    score.push(rootGroup);

    const nestedSnapshot = createNestedPolyObjectSnapshot(data, {
      rootGroupIndex: 0,
      containerPath: [],
      layerIndex: 0,
      objectIndex: 0,
    });
    expect(nestedSnapshot?.layers).toHaveLength(1);

    expect(applyProjectDocumentPatch(data, {
      score: {
        type: 'removeLayerRanges',
        ranges: [{ groupId: nestedSnapshot!.groupId, startIndex: 0, endIndex: 0 }],
        deleteEmptyLayerGroups: true,
      },
    })).toBe(true);

    expect(rootLayer).toHaveLength(0);
  });

  it('removes multiple emptied nested groups from the same containing layer', () => {
    const data = new BlueData();
    const score = data.getScore();
    score.length = 0;

    const rootGroup = new PolyObject();
    const rootLayer = new SoundLayer();
    const nestedGroupA = new PolyObject();
    nestedGroupA.push(new SoundLayer());
    const nestedGroupB = new PolyObject();
    nestedGroupB.push(new SoundLayer());
    rootLayer.push(nestedGroupA, nestedGroupB);
    rootGroup.push(rootLayer);
    score.push(rootGroup);

    const nestedSnapshotA = createNestedPolyObjectSnapshot(data, {
      rootGroupIndex: 0,
      containerPath: [],
      layerIndex: 0,
      objectIndex: 0,
    });
    const nestedSnapshotB = createNestedPolyObjectSnapshot(data, {
      rootGroupIndex: 0,
      containerPath: [],
      layerIndex: 0,
      objectIndex: 1,
    });
    expect(nestedSnapshotA?.groupId).toBeDefined();
    expect(nestedSnapshotB?.groupId).toBeDefined();

    expect(applyProjectDocumentPatch(data, {
      score: {
        type: 'removeLayerRanges',
        ranges: [
          { groupId: nestedSnapshotA!.groupId, startIndex: 0, endIndex: 0 },
          { groupId: nestedSnapshotB!.groupId, startIndex: 0, endIndex: 0 },
        ],
        deleteEmptyLayerGroups: true,
      },
    })).toBe(true);

    expect(rootLayer).toHaveLength(0);
  });
});
