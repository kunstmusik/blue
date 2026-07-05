import { describe, expect, it } from 'vitest';
import { BlueData, PolyObject, SoundLayer, AudioFile } from '@blue/data';
import {
  applyProjectDocumentPatch,
  createProjectEditorSnapshot,
} from '../shared/project-editor';

function makeDataWithThreeScoreObjects(): BlueData {
  const data = new BlueData();
  data.getScore().length = 0;
  const poly = new PolyObject(true);
  const layer = new SoundLayer();

  const a = new AudioFile();
  a.setSoundFileName('a.wav');
  const b = new AudioFile();
  b.setSoundFileName('b.wav');
  const c = new AudioFile();
  c.setSoundFileName('c.wav');
  layer.push(a);
  layer.push(b);
  layer.push(c);

  poly.push(layer);
  data.getScore().push(poly);
  return data;
}

function locationOf(groupIndex: number, layerIndex: number, objectIndex: number) {
  return {
    rootGroupIndex: groupIndex,
    containerPath: [],
    layerIndex,
    objectIndex,
  };
}

describe('applyProjectDocumentPatch moveScoreObjects — deletion guard', () => {
  it('does not splice the wrong object when two moves resolve to the same source location', () => {
    const data = makeDataWithThreeScoreObjects();
    const rootPoly = data.getScore()[0] as PolyObject;
    const layer = rootPoly[0]!;
    const groupId = 'test-group';
    // Force a stable groupId by patching via the snapshot path is unnecessary;
    // moveScoreObjects resolves the target group by groupId from the score.
    // We reuse the root PolyObject's assigned groupId by reading the snapshot.
    // Instead, target the same layer the objects live in (rootPoly is the only group).

    // Read the root group's layer group id via the snapshot helper.
    // Build the patch with two moves that both reference object at index 0 (a.wav).
    const targetA = {
      selectionId: 'sobj-a',
      selectedObjectType: 'AudioFile',
      editorObjectType: 'AudioFile',
      ownerKind: 'timeline' as const,
      displayContext: 'timeline' as const,
      location: locationOf(0, 0, 0),
      supportsTimeBehavior: false,
      supportsRepeatPoint: false,
      supportsNoteProcessorChain: false,
    };

    // Find the real groupId assigned to the root PolyObject by inspecting the
    // produced snapshot (assignLayerGroupId is internal). We move within the
    // same single group, so resolve it from the live score snapshot.

    const snap = createProjectEditorSnapshot(data, null, 1);
    const realGroupId = snap.score!.layerGroups[0].groupId;

    const patch = {
      score: {
        type: 'moveScoreObjects' as const,
        moves: [
          {
            target: targetA,
            targetStartBeats: 10,
            targetLayerIndex: 0,
            targetGroupId: realGroupId,
          },
          {
            // Duplicate source location: also points at index 0 (a.wav).
            target: targetA,
            targetStartBeats: 20,
            targetLayerIndex: 0,
            targetGroupId: realGroupId,
          },
        ],
      },
    };

    applyProjectDocumentPatch(data, patch);

    const names = Array.from(layer).map((o) => (o as AudioFile).getSoundFileName());
    // b.wav and c.wav must remain in the source layer; a.wav was moved (re-added
    // to the same layer at the end). No object should be lost.
    expect(names.sort()).toEqual(['a.wav', 'b.wav', 'c.wav']);
    expect(layer.length).toBe(3);
  });

  it('moves each distinct selected object once (normal multi-move within a layer)', () => {
    const data = makeDataWithThreeScoreObjects();
    const rootPoly = data.getScore()[0] as PolyObject;
    const layer = rootPoly[0]!;


    const snap = createProjectEditorSnapshot(data, null, 1);
    const realGroupId = snap.score!.layerGroups[0].groupId;

    const target = (objectIndex: number) => ({
      selectionId: `sobj-${objectIndex}`,
      selectedObjectType: 'AudioFile',
      editorObjectType: 'AudioFile',
      ownerKind: 'timeline' as const,
      displayContext: 'timeline' as const,
      location: locationOf(0, 0, objectIndex),
      supportsTimeBehavior: false,
      supportsRepeatPoint: false,
      supportsNoteProcessorChain: false,
    });

    applyProjectDocumentPatch(data, {
      score: {
        type: 'moveScoreObjects',
        moves: [
          { target: target(0), targetStartBeats: 5, targetLayerIndex: 0, targetGroupId: realGroupId },
          { target: target(1), targetStartBeats: 6, targetLayerIndex: 0, targetGroupId: realGroupId },
        ],
      },
    });

    // Both a.wav and b.wav moved (start times updated); c.wav untouched; none deleted.
    expect(layer.length).toBe(3);
    const byName = new Map(
      Array.from(layer).map((o) => [(o as AudioFile).getSoundFileName(), o as AudioFile]),
    );
    expect(byName.get('a.wav')!.getStartTime().toBeats(data.getScore().getTimeContext())).toBe(5);
    expect(byName.get('b.wav')!.getStartTime().toBeats(data.getScore().getTimeContext())).toBe(6);
  });
});
