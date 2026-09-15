import { describe, expect, it } from 'vitest';
import {
  BlueData,
  PolyObject,
  TrackLayerGroup,
  PatternsLayerGroup,
  SoundLayer,
  TrackLayer,
} from '@blue/data';
import { applyProjectDocumentPatch } from './index';
import { assignLayerGroupId, assignLayerSelectionId } from './identity';

function setupScoreWithGroups(): {
  data: BlueData;
  trackGroup: TrackLayerGroup;
  polyGroup: PolyObject;
  patternsGroup: PatternsLayerGroup;
  nestedPoly: PolyObject;
} {
  const data = new BlueData();
  const score = data.getScore();
  score.length = 0;

  const trackGroup = new TrackLayerGroup();
  trackGroup.newLayerAt(0);
  trackGroup.newLayerAt(1);
  score.push(trackGroup);

  const polyGroup = new PolyObject(true);
  polyGroup.newLayerAt(0);
  polyGroup.newLayerAt(1);
  score.push(polyGroup);

  const patternsGroup = new PatternsLayerGroup();
  patternsGroup.newLayerAt(0);
  score.push(patternsGroup);

  // Add a nested PolyObject inside polyGroup layer 0
  const nestedPoly = new PolyObject();
  nestedPoly.newLayerAt(0);
  nestedPoly.newLayerAt(1);
  polyGroup[0]!.push(nestedPoly);

  return { data, trackGroup, polyGroup, patternsGroup, nestedPoly };
}

describe('Layer height document patches (T002, T014, T022, T030)', () => {
  describe('Single-target patches (T014)', () => {
    it('applies absolute custom height to a Track layer at root scope', () => {
      const { data, trackGroup } = setupScoreWithGroups();
      const track = trackGroup[0]!;
      const selId = assignLayerSelectionId(track);
      const groupId = trackGroup.getUniqueId();

      const changed = applyProjectDocumentPatch(data, {
        score: {
          type: 'setLayerHeights',
          scopeGroupId: null,
          updates: [{ groupId, layerIndex: 0, layerSelectionId: selId, height: 57 }],
        },
      });

      expect(changed).toBe(true);
      expect(track.getLayerHeight()).toBe(57);
      expect(track.getHeightIndex()).toBe(2); // nearest preset 66 -> index 2
      expect(track.getCustomHeight()).toBe(57);
    });

    it('applies absolute preset height to a SoundLayer in root PolyObject', () => {
      const { data, polyGroup } = setupScoreWithGroups();
      const layer = polyGroup[0]!;
      const selId = assignLayerSelectionId(layer);
      const groupId = assignLayerGroupId(polyGroup);

      const changed = applyProjectDocumentPatch(data, {
        score: {
          type: 'setLayerHeights',
          scopeGroupId: null,
          updates: [{ groupId, layerIndex: 0, layerSelectionId: selId, height: 66 }],
        },
      });

      expect(changed).toBe(true);
      expect(layer.getLayerHeight()).toBe(66);
      expect(layer.getHeightIndex()).toBe(2);
      expect(layer.getCustomHeight()).toBeUndefined();
    });

    it('applies height to a layer inside an opened nested PolyObject scope', () => {
      const { data, nestedPoly } = setupScoreWithGroups();
      const layer = nestedPoly[0]!;
      const selId = assignLayerSelectionId(layer);
      const nestedGroupId = assignLayerGroupId(nestedPoly);

      const changed = applyProjectDocumentPatch(data, {
        score: {
          type: 'setLayerHeights',
          scopeGroupId: nestedGroupId,
          updates: [{ groupId: nestedGroupId, layerIndex: 0, layerSelectionId: selId, height: 88 }],
        },
      });

      expect(changed).toBe(true);
      expect(layer.getLayerHeight()).toBe(88);
      expect(layer.getHeightIndex()).toBe(3);
    });

    it('resets a layer to main-owned group default height', () => {
      const { data, polyGroup } = setupScoreWithGroups();
      const layer = polyGroup[0]!;
      const selId = assignLayerSelectionId(layer);
      const groupId = assignLayerGroupId(polyGroup);

      // Set group default to index 2 (66px)
      polyGroup.setDefaultHeightIndex(2);
      // Give layer custom height 57
      layer.setExplicitHeight(57);
      expect(layer.getLayerHeight()).toBe(57);

      const changed = applyProjectDocumentPatch(data, {
        score: {
          type: 'setLayerHeights',
          scopeGroupId: null,
          updates: [{ groupId, layerIndex: 0, layerSelectionId: selId, height: 'default' }],
        },
      });

      expect(changed).toBe(true);
      expect(layer.getLayerHeight()).toBe(66);
      expect(layer.getHeightIndex()).toBe(2);
      expect(layer.getCustomHeight()).toBeUndefined();
    });

    it('treats identical effective height as an accepted no-op', () => {
      const { data, trackGroup } = setupScoreWithGroups();
      const track = trackGroup[0]!;
      const selId = assignLayerSelectionId(track);
      const groupId = trackGroup.getUniqueId();
      track.setExplicitHeight(44);

      const changed = applyProjectDocumentPatch(data, {
        score: {
          type: 'setLayerHeights',
          scopeGroupId: null,
          updates: [{ groupId, layerIndex: 0, layerSelectionId: selId, height: 44 }],
        },
      });

      expect(changed).toBe(false);
      expect(track.getLayerHeight()).toBe(44);
    });

    it('accepts an empty updates array as a valid no-op', () => {
      const { data } = setupScoreWithGroups();
      const changed = applyProjectDocumentPatch(data, {
        score: {
          type: 'setLayerHeights',
          scopeGroupId: null,
          updates: [],
        },
      });
      expect(changed).toBe(false);
    });
  });

  describe('Validation and atomic rejection (T002, T014, T022)', () => {
    it('rejects targets on Pattern groups', () => {
      const { data, patternsGroup } = setupScoreWithGroups();
      const patLayer = patternsGroup[0]!;
      const selId = assignLayerSelectionId(patLayer);
      const groupId = assignLayerGroupId(patternsGroup);

      expect(() => {
        applyProjectDocumentPatch(data, {
          score: {
            type: 'setLayerHeights',
            scopeGroupId: null,
            updates: [{ groupId, layerIndex: 0, layerSelectionId: selId, height: 44 }],
          },
        });
      }).toThrow(/not supported for Pattern groups/);
    });

    it('rejects out-of-bounds or negative layerIndex', () => {
      const { data, trackGroup } = setupScoreWithGroups();
      const track = trackGroup[0]!;
      const selId = assignLayerSelectionId(track);
      const groupId = trackGroup.getUniqueId();

      expect(() => {
        applyProjectDocumentPatch(data, {
          score: {
            type: 'setLayerHeights',
            scopeGroupId: null,
            updates: [{ groupId, layerIndex: -1, layerSelectionId: selId, height: 44 }],
          },
        });
      }).toThrow(/out of bounds/);

      expect(() => {
        applyProjectDocumentPatch(data, {
          score: {
            type: 'setLayerHeights',
            scopeGroupId: null,
            updates: [{ groupId, layerIndex: 99, layerSelectionId: selId, height: 44 }],
          },
        });
      }).toThrow(/out of bounds/);
    });

    it('rejects stale or mismatched layerSelectionId', () => {
      const { data, trackGroup } = setupScoreWithGroups();
      const groupId = trackGroup.getUniqueId();

      expect(() => {
        applyProjectDocumentPatch(data, {
          score: {
            type: 'setLayerHeights',
            scopeGroupId: null,
            updates: [{ groupId, layerIndex: 0, layerSelectionId: 'wrong-sel-id', height: 44 }],
          },
        });
      }).toThrow(/selection ID mismatch/);
    });

    it('rejects duplicate targets in a batch', () => {
      const { data, trackGroup } = setupScoreWithGroups();
      const track = trackGroup[0]!;
      const selId = assignLayerSelectionId(track);
      const groupId = trackGroup.getUniqueId();

      expect(() => {
        applyProjectDocumentPatch(data, {
          score: {
            type: 'setLayerHeights',
            scopeGroupId: null,
            updates: [
              { groupId, layerIndex: 0, layerSelectionId: selId, height: 44 },
              { groupId, layerIndex: 0, layerSelectionId: selId, height: 66 },
            ],
          },
        });
      }).toThrow(/Duplicate layer height target/);
    });

    it('rejects non-integer, negative, or out-of-range heights', () => {
      const { data, trackGroup } = setupScoreWithGroups();
      const track = trackGroup[0]!;
      const selId = assignLayerSelectionId(track);
      const groupId = trackGroup.getUniqueId();

      for (const badHeight of [21, 661, 57.5, NaN, Infinity, -22, '57' as any, null as any]) {
        expect(() => {
          applyProjectDocumentPatch(data, {
            score: {
              type: 'setLayerHeights',
              scopeGroupId: null,
              updates: [{ groupId, layerIndex: 0, layerSelectionId: selId, height: badHeight }],
            },
          });
        }).toThrow(/Invalid layer height/);
      }
    });

    it('rejects cross-scope targets when scopeGroupId is non-null', () => {
      const { data, trackGroup, nestedPoly } = setupScoreWithGroups();
      const track = trackGroup[0]!;
      const selId = assignLayerSelectionId(track);
      const nestedGroupId = assignLayerGroupId(nestedPoly);

      expect(() => {
        applyProjectDocumentPatch(data, {
          score: {
            type: 'setLayerHeights',
            scopeGroupId: nestedGroupId,
            updates: [
              {
                groupId: trackGroup.getUniqueId(),
                layerIndex: 0,
                layerSelectionId: selId,
                height: 44,
              },
            ],
          },
        });
      }).toThrow(/does not match scope group/);
    });

    it('atomically rolls back: if any target in a batch fails, no target is mutated', () => {
      const { data, trackGroup } = setupScoreWithGroups();
      const t0 = trackGroup[0]!;
      const t1 = trackGroup[1]!;
      const sel0 = assignLayerSelectionId(t0);
      const groupId = trackGroup.getUniqueId();
      t0.setExplicitHeight(44);
      t1.setExplicitHeight(44);

      expect(() => {
        applyProjectDocumentPatch(data, {
          score: {
            type: 'setLayerHeights',
            scopeGroupId: null,
            updates: [
              { groupId, layerIndex: 0, layerSelectionId: sel0, height: 66 }, // valid
              { groupId, layerIndex: 1, layerSelectionId: 'invalid-id', height: 88 }, // invalid
            ],
          },
        });
      }).toThrow();

      // First target must not have been mutated
      expect(t0.getLayerHeight()).toBe(44);
      expect(t1.getLayerHeight()).toBe(44);
    });
  });

  describe('Aggregate multi-target patches (T022)', () => {
    it('applies relative delta to multiple selected layers across different root groups', () => {
      const { data, trackGroup, polyGroup } = setupScoreWithGroups();
      const track = trackGroup[0]!;
      const soundLayer = polyGroup[0]!;
      const trackSelId = assignLayerSelectionId(track);
      const soundSelId = assignLayerSelectionId(soundLayer);
      const trackGroupId = trackGroup.getUniqueId();
      const polyGroupId = assignLayerGroupId(polyGroup);

      track.setExplicitHeight(44);
      soundLayer.setExplicitHeight(88);

      // +13 drag delta -> 57 and 101
      const changed = applyProjectDocumentPatch(data, {
        score: {
          type: 'setLayerHeights',
          scopeGroupId: null,
          updates: [
            { groupId: trackGroupId, layerIndex: 0, layerSelectionId: trackSelId, height: 57 },
            { groupId: polyGroupId, layerIndex: 0, layerSelectionId: soundSelId, height: 101 },
          ],
        },
      });

      expect(changed).toBe(true);
      expect(track.getLayerHeight()).toBe(57);
      expect(soundLayer.getLayerHeight()).toBe(101);

      // Unselected rows remain unchanged
      expect(trackGroup[1]!.getLayerHeight()).toBe(22);
      expect(polyGroup[1]!.getLayerHeight()).toBe(22);
    });

    it('resets multiple layers across groups to their respective defaults', () => {
      const { data, trackGroup, polyGroup } = setupScoreWithGroups();
      trackGroup.setDefaultHeightIndex(1); // 44
      polyGroup.setDefaultHeightIndex(2); // 66

      const t0 = trackGroup[0]!;
      const s0 = polyGroup[0]!;
      t0.setExplicitHeight(110);
      s0.setExplicitHeight(110);

      const changed = applyProjectDocumentPatch(data, {
        score: {
          type: 'setLayerHeights',
          scopeGroupId: null,
          updates: [
            {
              groupId: trackGroup.getUniqueId(),
              layerIndex: 0,
              layerSelectionId: assignLayerSelectionId(t0),
              height: 'default',
            },
            {
              groupId: assignLayerGroupId(polyGroup),
              layerIndex: 0,
              layerSelectionId: assignLayerSelectionId(s0),
              height: 'default',
            },
          ],
        },
      });

      expect(changed).toBe(true);
      expect(t0.getLayerHeight()).toBe(44);
      expect(s0.getLayerHeight()).toBe(66);
    });
  });

  describe('Group default height patches (T030)', () => {
    it('updates defaultHeightIndex on a root PolyObject (0..8)', () => {
      const { data, polyGroup } = setupScoreWithGroups();
      const groupId = assignLayerGroupId(polyGroup);

      const changed = applyProjectDocumentPatch(data, {
        score: {
          type: 'setLayerGroupDefaultHeight',
          scopeGroupId: null,
          groupId,
          defaultHeightIndex: 4,
        },
      });

      expect(changed).toBe(true);
      expect(polyGroup.getDefaultHeightIndex()).toBe(4);
    });

    it('updates defaultHeightIndex on a TrackLayerGroup (0..9)', () => {
      const { data, trackGroup } = setupScoreWithGroups();
      const groupId = trackGroup.getUniqueId();

      const changed = applyProjectDocumentPatch(data, {
        score: {
          type: 'setLayerGroupDefaultHeight',
          scopeGroupId: null,
          groupId,
          defaultHeightIndex: 9,
        },
      });

      expect(changed).toBe(true);
      expect(trackGroup.getDefaultHeightIndex()).toBe(9);
    });

    it('rejects out-of-range defaultHeightIndex for PolyObject (> 8)', () => {
      const { data, polyGroup } = setupScoreWithGroups();
      const groupId = assignLayerGroupId(polyGroup);

      expect(() => {
        applyProjectDocumentPatch(data, {
          score: {
            type: 'setLayerGroupDefaultHeight',
            scopeGroupId: null,
            groupId,
            defaultHeightIndex: 9,
          },
        });
      }).toThrow(/Invalid defaultHeightIndex for PolyObject/);
    });

    it('rejects out-of-range defaultHeightIndex for TrackLayerGroup (> 9)', () => {
      const { data, trackGroup } = setupScoreWithGroups();
      const groupId = trackGroup.getUniqueId();

      expect(() => {
        applyProjectDocumentPatch(data, {
          score: {
            type: 'setLayerGroupDefaultHeight',
            scopeGroupId: null,
            groupId,
            defaultHeightIndex: 10,
          },
        });
      }).toThrow(/Invalid defaultHeightIndex for TrackLayerGroup/);
    });

    it('rejects default height on Pattern groups', () => {
      const { data, patternsGroup } = setupScoreWithGroups();
      const groupId = assignLayerGroupId(patternsGroup);

      expect(() => {
        applyProjectDocumentPatch(data, {
          score: {
            type: 'setLayerGroupDefaultHeight',
            scopeGroupId: null,
            groupId,
            defaultHeightIndex: 1,
          },
        });
      }).toThrow(/not supported for Pattern groups/);
    });

    it('returns false when setting to identical defaultHeightIndex', () => {
      const { data, trackGroup } = setupScoreWithGroups();
      const groupId = trackGroup.getUniqueId();
      trackGroup.setDefaultHeightIndex(2);

      const changed = applyProjectDocumentPatch(data, {
        score: {
          type: 'setLayerGroupDefaultHeight',
          scopeGroupId: null,
          groupId,
          defaultHeightIndex: 2,
        },
      });

      expect(changed).toBe(false);
      expect(trackGroup.getDefaultHeightIndex()).toBe(2);
    });

    it('defensively treats undefined scopeGroupId as null (root scope)', () => {
      const { data, trackGroup } = setupScoreWithGroups();
      const track = trackGroup[0]!;
      const selId = assignLayerSelectionId(track);
      const groupId = trackGroup.getUniqueId();

      const changed = applyProjectDocumentPatch(data, {
        score: {
          type: 'setLayerHeights',
          updates: [{ groupId, layerIndex: 0, layerSelectionId: selId, height: 57 }],
        } as any,
      });

      expect(changed).toBe(true);
      expect(track.getCustomHeight()).toBe(57);
    });

    it('defensively treats undefined scopeGroupId as null for setLayerGroupDefaultHeight', () => {
      const { data, trackGroup } = setupScoreWithGroups();
      const groupId = trackGroup.getUniqueId();
      trackGroup.setDefaultHeightIndex(2);

      const changed = applyProjectDocumentPatch(data, {
        score: {
          type: 'setLayerGroupDefaultHeight',
          groupId,
          defaultHeightIndex: 3,
        } as any,
      });

      expect(changed).toBe(true);
      expect(trackGroup.getDefaultHeightIndex()).toBe(3);
    });
  });
});
