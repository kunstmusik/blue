import { describe, expect, it } from 'vitest';
import {
  BlueData,
  GenericScore,
  PolyObject,
  SoundLayer,
  Track,
  TrackLayerGroup,
  Pattern,
  PatternLayer,
  PatternsLayerGroup,
} from '@blue/data';
import {
  applyProjectDocumentPatch,
  createProjectEditorSnapshot,
  isScoreColorPatchAccepted,
  type ProjectDocumentPatch,
  type ScoreObjectEditorTargetSnapshot,
} from './project-editor';
import {
  createTestProjectWithLayers,
  createMockScoreObjectTarget,
  createMockTrackTarget,
  createMockPatternSourceTarget,
} from './project-editor-layer-color-test-utils';

describe('Project Editor Score Color Application (US3)', () => {
  it('accepts valid no-op layer and item colors but rejects invalid or stale targets', () => {
    const { data, soundLayer, polyGroupId } = createTestProjectWithLayers();
    soundLayer.setBackgroundColor(0x123456);
    soundLayer[0].setBackgroundColor(0xffff0000);
    const snapshot = createProjectEditorSnapshot(data, null);
    const itemTarget = snapshot.score.layerGroups
      .find((group) => group.groupId === polyGroupId)!
      .layers[0]!
      .items[0]!
      .editorTarget!;

    const repeatedPickerPreview: ProjectDocumentPatch = {
      score: {
        type: 'updateLayerState',
        groupId: polyGroupId,
        layerIndex: 0,
        patch: { backgroundColor: 0xff123456 },
      },
    };
    expect(isScoreColorPatchAccepted(data, repeatedPickerPreview.score!)).toBe(true);
    expect(applyProjectDocumentPatch(data, repeatedPickerPreview)).toBe(false);

    const sameColorDirectEdit: ProjectDocumentPatch = {
      score: {
        type: 'updateSharedProperties',
        target: itemTarget,
        patch: { backgroundColor: 0xff0000 },
      },
    };
    expect(isScoreColorPatchAccepted(data, sameColorDirectEdit.score!)).toBe(true);
    expect(applyProjectDocumentPatch(data, sameColorDirectEdit)).toBe(false);

    const staleTarget: ScoreObjectEditorTargetSnapshot = {
      ...itemTarget,
      selectionId: 'stale-item',
      location: { ...itemTarget.location!, objectIndex: 999 },
    };
    expect(isScoreColorPatchAccepted(data, {
      type: 'updateSharedProperties',
      target: staleTarget,
      patch: { backgroundColor: 0xff0000 },
    })).toBe(false);
    expect(isScoreColorPatchAccepted(data, {
      type: 'updateLayerState',
      groupId: polyGroupId,
      layerIndex: 0,
      patch: { backgroundColor: Number.NaN },
    })).toBe(false);
  });

  it('handles empty updates array as a successful no-op without mutation', () => {
    const { data } = createTestProjectWithLayers();
    const patch: ProjectDocumentPatch = {
      score: {
        type: 'setScoreObjectBackgroundColors',
        updates: [],
      },
    };

    const changed = applyProjectDocumentPatch(data, patch);
    expect(changed).toBe(false);
  });

  it('rejects duplicate targets without applying any mutation', () => {
    const { data, soundLayer } = createTestProjectWithLayers();
    const item = soundLayer[0];
    const originalColor = item.getBackgroundColor();

    const target: ScoreObjectEditorTargetSnapshot = {
      selectionId: 'sobj-0',
      selectedObjectType: 'GenericScore',
      editorObjectType: 'GenericScore',
      ownerKind: 'timeline',
      displayContext: 'timeline',
      location: {
        rootGroupIndex: 0,
        containerPath: [],
        layerIndex: 0,
        objectIndex: 0,
      },
    };

    const patch: ProjectDocumentPatch = {
      score: {
        type: 'setScoreObjectBackgroundColors',
        updates: [
          { target, backgroundColor: 0xff0000 },
          { target, backgroundColor: 0x00ff00 },
        ],
      },
    };

    const changed = applyProjectDocumentPatch(data, patch);
    expect(changed).toBe(false);
    expect(item.getBackgroundColor()).toBe(originalColor);
  });

  it('rejects invalid colors without mutating any target', () => {
    const { data, soundLayer, polyGroup } = createTestProjectWithLayers();
    const item1 = soundLayer[0];
    const item2 = new GenericScore();
    item2.setName('Item 2');
    item2.setBackgroundColor(0x222222);
    soundLayer.push(item2);

    const orig1 = item1.getBackgroundColor();
    const orig2 = item2.getBackgroundColor();

    const target1: ScoreObjectEditorTargetSnapshot = {
      selectionId: 'sobj-0',
      selectedObjectType: 'GenericScore',
      editorObjectType: 'GenericScore',
      ownerKind: 'timeline',
      displayContext: 'timeline',
      location: {
        rootGroupIndex: 0,
        containerPath: [],
        layerIndex: 0,
        objectIndex: 0,
      },
    };
    const target2: ScoreObjectEditorTargetSnapshot = {
      selectionId: 'sobj-1',
      selectedObjectType: 'GenericScore',
      editorObjectType: 'GenericScore',
      ownerKind: 'timeline',
      displayContext: 'timeline',
      location: {
        rootGroupIndex: 0,
        containerPath: [],
        layerIndex: 0,
        objectIndex: 1,
      },
    };

    const patch: ProjectDocumentPatch = {
      score: {
        type: 'setScoreObjectBackgroundColors',
        updates: [
          { target: target1, backgroundColor: 0xff0000 },
          { target: target2, backgroundColor: Number.NaN }, // Invalid!
        ],
      },
    };

    const changed = applyProjectDocumentPatch(data, patch);
    expect(changed).toBe(false);
    expect(item1.getBackgroundColor()).toBe(orig1);
    expect(item2.getBackgroundColor()).toBe(orig2);
  });

  it('rejects missing or out-of-range targets atomically without mutating valid targets', () => {
    const { data, soundLayer } = createTestProjectWithLayers();
    const item = soundLayer[0];
    const originalColor = item.getBackgroundColor();

    const validTarget: ScoreObjectEditorTargetSnapshot = {
      selectionId: 'sobj-0',
      selectedObjectType: 'GenericScore',
      editorObjectType: 'GenericScore',
      ownerKind: 'timeline',
      displayContext: 'timeline',
      location: {
        rootGroupIndex: 0,
        containerPath: [],
        layerIndex: 0,
        objectIndex: 0,
      },
    };
    const missingTarget: ScoreObjectEditorTargetSnapshot = {
      selectionId: 'sobj-missing',
      selectedObjectType: 'GenericScore',
      editorObjectType: 'GenericScore',
      ownerKind: 'timeline',
      displayContext: 'timeline',
      location: {
        rootGroupIndex: 0,
        containerPath: [],
        layerIndex: 0,
        objectIndex: 999, // Out of range!
      },
    };

    const patch: ProjectDocumentPatch = {
      score: {
        type: 'setScoreObjectBackgroundColors',
        updates: [
          { target: validTarget, backgroundColor: 0xff0000 },
          { target: missingTarget, backgroundColor: 0x00ff00 },
        ],
      },
    };

    const changed = applyProjectDocumentPatch(data, patch);
    expect(changed).toBe(false);
    expect(item.getBackgroundColor()).toBe(originalColor);
  });

  it('atomically updates mixed target kinds: sound layer, track, and pattern source', () => {
    const { data, soundLayer, track, patternLayer, patternGroupId, patternLayerId, patternSourceId } = createTestProjectWithLayers();
    const polyItem = soundLayer[0];
    const trackItem = track[0];
    const patternSrcItem = patternLayer.getSoundObject();

    const polyTarget: ScoreObjectEditorTargetSnapshot = {
      selectionId: 'sobj-0',
      selectedObjectType: 'GenericScore',
      editorObjectType: 'GenericScore',
      ownerKind: 'timeline',
      displayContext: 'timeline',
      location: {
        rootGroupIndex: 0,
        containerPath: [],
        layerIndex: 0,
        objectIndex: 0,
      },
    };

    const trackTarget: ScoreObjectEditorTargetSnapshot = {
      selectionId: 'track-item-0',
      selectedObjectType: 'GenericScore',
      editorObjectType: 'GenericScore',
      ownerKind: 'timeline',
      displayContext: 'timeline',
      location: {
        rootGroupIndex: 1,
        containerPath: [],
        layerIndex: 0,
        objectIndex: 0,
        trackId: track.getUniqueId(),
        layerKind: 'track',
      },
    };

    const patternTarget: ScoreObjectEditorTargetSnapshot = {
      selectionId: patternSourceId,
      selectedObjectType: 'GenericScore',
      editorObjectType: 'GenericScore',
      ownerKind: 'timeline',
      displayContext: 'timeline',
      patternSource: {
        groupId: patternGroupId,
        layerId: patternLayerId,
        sourceObjectId: patternSourceId,
      },
    };

    const patch: ProjectDocumentPatch = {
      score: {
        type: 'setScoreObjectBackgroundColors',
        updates: [
          { target: polyTarget, backgroundColor: 0x112233 },
          { target: trackTarget, backgroundColor: 0x445566 },
          { target: patternTarget, backgroundColor: 0x778899 },
        ],
      },
    };

    const changed = applyProjectDocumentPatch(data, patch);
    expect(changed).toBe(true);
    expect(polyItem.getBackgroundColor()).toBe(((0x112233 & 0x00ffffff) | 0xff000000) | 0);
    expect(trackItem.getBackgroundColor()).toBe(((0x445566 & 0x00ffffff) | 0xff000000) | 0);
    expect(patternSrcItem.getBackgroundColor()).toBe(((0x778899 & 0x00ffffff) | 0xff000000) | 0);
  });

  it('atomically updates 1,000 targets on a single layer in one operation', () => {
    const data = new BlueData();
    data.getScore().length = 0;
    const poly = new PolyObject();
    const layer = new SoundLayer();
    const updates: Array<{ target: ScoreObjectEditorTargetSnapshot; backgroundColor: number }> = [];

    for (let i = 0; i < 1000; i++) {
      const gs = new GenericScore();
      gs.setName(`Item ${i}`);
      gs.setBackgroundColor(0x111111);
      layer.push(gs);
      updates.push({
        target: {
          selectionId: `item-${i}`,
          selectedObjectType: 'GenericScore',
          editorObjectType: 'GenericScore',
          ownerKind: 'timeline',
          displayContext: 'timeline',
          location: {
            rootGroupIndex: 0,
            containerPath: [],
            layerIndex: 0,
            objectIndex: i,
          },
        },
        backgroundColor: 0x223344,
      });
    }
    poly.push(layer);
    data.getScore().push(poly);

    const patch: ProjectDocumentPatch = {
      score: {
        type: 'setScoreObjectBackgroundColors',
        updates,
      },
    };

    const startTime = performance.now();
    const changed = applyProjectDocumentPatch(data, patch);
    const duration = performance.now() - startTime;

    expect(changed).toBe(true);
    expect(duration).toBeLessThan(1000); // Fast execution
    expect(layer[0].getBackgroundColor()).toBe(((0x223344 & 0x00ffffff) | 0xff000000) | 0);
    expect(layer[999].getBackgroundColor()).toBe(((0x223344 & 0x00ffffff) | 0xff000000) | 0);
  });
});
