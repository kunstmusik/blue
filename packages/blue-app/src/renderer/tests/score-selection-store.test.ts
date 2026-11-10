// @vitest-environment jsdom

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  hasAuditionEligibleSelection,
  projectScoreLayerGroupsWithGesture,
  reconcileSelectionWithCanonicalScore,
  useScoreSelectionStore,
  type ScoreGestureProjection,
} from '../stores/score-selection-store';
import { useProjectStore } from '../stores/project-store';
import type {
  ScoreDocumentSnapshot,
  ScoreLayerGroupSnapshot,
  ScoreObjectEditorTargetSnapshot,
  ScoreRowObjectSnapshot,
} from '../../shared/project-editor';

function target(objectId: string): ScoreObjectEditorTargetSnapshot {
  return {
    selectionId: objectId,
    selectedObjectType: 'AudioFile',
    editorObjectType: 'AudioFile',
    ownerKind: 'timeline',
    displayContext: 'timeline',
    location: { rootGroupIndex: 0, containerPath: [], layerIndex: 0, objectIndex: 0 },
    supportsTimeBehavior: false,
    supportsRepeatPoint: false,
    supportsNoteProcessorChain: false,
  };
}

describe('useScoreSelectionStore', () => {
  beforeEach(() => {
    useScoreSelectionStore.getState().clearSelection();
    useScoreSelectionStore.getState().clearPatternClipboard();
  });

  afterEach(() => {
    useScoreSelectionStore.getState().clearSelection();
    useScoreSelectionStore.getState().clearPatternClipboard();
  });

  it('unions additive selections and preserves each target', () => {
    useScoreSelectionStore.getState().setSelection([{ objectId: 'A', editorTarget: target('A') }]);
    useScoreSelectionStore.getState().addToSelection([
      { objectId: 'B', editorTarget: target('B') },
      { objectId: 'C', editorTarget: target('C') },
    ]);

    expect([...useScoreSelectionStore.getState().selectedObjectIds].sort()).toEqual([
      'A',
      'B',
      'C',
    ]);
    expect(useScoreSelectionStore.getState().selectedObjectTargets.A).toBeDefined();
    expect(useScoreSelectionStore.getState().selectedObjectTargets.B).toBeDefined();
  });

  it('stores a pattern clipboard shape independently of the score-object clipboard', () => {
    const shape = {
      cells: [{ rowOffset: 0, cellOffset: 0 }],
      width: 1,
      height: 1,
    };
    useScoreSelectionStore.getState().copyPatternShape(shape);
    expect(useScoreSelectionStore.getState().patternClipboard).toEqual(shape);
    expect(useScoreSelectionStore.getState().clipboard).toEqual([]);
    useScoreSelectionStore.getState().clearPatternClipboard();
    expect(useScoreSelectionStore.getState().patternClipboard).toBeNull();
  });

  it('marks pattern-source selections ineligible for audition while ordinary timeline targets remain eligible', () => {
    const patternTarget: ScoreObjectEditorTargetSnapshot = {
      ...target('source-1'),
      patternSource: { groupId: 'grp', layerId: 'pl-1', sourceObjectId: 'source-1' },
    };
    useScoreSelectionStore
      .getState()
      .setSelection([{ objectId: 'source-1', editorTarget: patternTarget }]);
    expect(hasAuditionEligibleSelection(useScoreSelectionStore.getState())).toBe(false);

    useScoreSelectionStore
      .getState()
      .setSelection([{ objectId: 'sobj-1', editorTarget: target('sobj-1') }]);
    expect(hasAuditionEligibleSelection(useScoreSelectionStore.getState())).toBe(true);
  });

  describe('identity-fenced transient gesture projection', () => {
    it('sets gesture projection and synchronizes liveSharedProperties', () => {
      const projection: ScoreGestureProjection = {
        gestureId: 'drag-1',
        objects: {
          A: { objectId: 'A', startBeats: 10, durationBeats: 4 },
          B: {
            objectId: 'B',
            startBeats: 15,
            durationBeats: 6,
            targetGroupId: 'grp-2',
            targetLayerIndex: 1,
          },
        },
      };

      useScoreSelectionStore.getState().setGestureProjection(projection);
      const state = useScoreSelectionStore.getState();
      expect(state.gestureProjection).toEqual(projection);
      expect(state.liveSharedProperties).toEqual({
        A: { startBeats: 10, durationBeats: 4 },
        B: { startBeats: 15, durationBeats: 6 },
      });
    });

    it('clears projection when matching gestureId is supplied', () => {
      const projection: ScoreGestureProjection = {
        gestureId: 'drag-1',
        objects: { A: { objectId: 'A', startBeats: 10, durationBeats: 4 } },
      };
      useScoreSelectionStore.getState().setGestureProjection(projection);

      // Mismatched gestureId must NOT clear (identity fencing)
      useScoreSelectionStore.getState().clearGestureProjection('older-drag');
      expect(useScoreSelectionStore.getState().gestureProjection).not.toBeNull();

      // Matching gestureId clears
      useScoreSelectionStore.getState().clearGestureProjection('drag-1');
      expect(useScoreSelectionStore.getState().gestureProjection).toBeNull();
      expect(useScoreSelectionStore.getState().liveSharedProperties).toEqual({});
    });

    it('prunes or clears stale projections when canonical score reconciles target replacement', () => {
      const projection: ScoreGestureProjection = {
        gestureId: 'drag-1',
        objects: {
          A: { objectId: 'A', startBeats: 10, durationBeats: 4 },
          B: { objectId: 'B', startBeats: 20, durationBeats: 2 },
        },
      };
      useScoreSelectionStore.getState().setSelection(['A', 'B']);
      useScoreSelectionStore.getState().setGestureProjection(projection);

      // Canonical score that only contains A (B was replaced/deleted)
      const scoreWithOnlyA: ScoreDocumentSnapshot = {
        timeState: {} as any,
        layerGroups: [
          {
            groupId: 'g1',
            groupType: 'polyObject',
            name: 'G1',
            layerCount: 1,
            isOpenableContainer: false,
            layers: [
              {
                layerId: 'l1',
                name: 'L1',
                height: 44,
                muted: false,
                solo: false,
                items: [{ objectId: 'A', startBeats: 5, durationBeats: 4 } as any],
              },
            ],
          },
        ],
      };

      reconcileSelectionWithCanonicalScore(scoreWithOnlyA);
      const state = useScoreSelectionStore.getState();
      expect(state.gestureProjection?.objects).toEqual({
        A: { objectId: 'A', startBeats: 10, durationBeats: 4 },
      });

      // Score with neither A nor B clears gesture projection completely
      const emptyScore: ScoreDocumentSnapshot = {
        timeState: {} as any,
        layerGroups: [],
      };
      reconcileSelectionWithCanonicalScore(emptyScore);
      expect(useScoreSelectionStore.getState().gestureProjection).toBeNull();
    });

    it('fences projection by documentId and sessionId (T035)', () => {
      useProjectStore.setState({ documentId: 'doc-current', sessionId: 42 });

      // Projection from an older session / document is rejected
      const staleProjection: ScoreGestureProjection = {
        gestureId: 'drag-stale',
        documentId: 'doc-older',
        sessionId: 41,
        objects: { A: { objectId: 'A', startBeats: 10, durationBeats: 4 } },
      };
      useScoreSelectionStore.getState().setGestureProjection(staleProjection);
      expect(useScoreSelectionStore.getState().gestureProjection).toBeNull();

      // Projection matching document and session is accepted
      const validProjection: ScoreGestureProjection = {
        gestureId: 'drag-valid',
        documentId: 'doc-current',
        sessionId: 42,
        objects: { A: { objectId: 'A', startBeats: 10, durationBeats: 4 } },
      };
      useScoreSelectionStore.getState().setGestureProjection(validProjection);
      expect(useScoreSelectionStore.getState().gestureProjection).toEqual(validProjection);

      // When sessionId changes (project replacement), projection is ignored during projection mapping
      useProjectStore.setState({ sessionId: 43 });
      const groups = [
        {
          groupId: 'g1',
          groupType: 'polyObject' as const,
          name: 'G1',
          layerCount: 1,
          isOpenableContainer: false,
          layers: [
            {
              layerId: 'l1',
              name: 'L1',
              height: 44,
              muted: false,
              solo: false,
              items: [{ objectId: 'A', startBeats: 5, durationBeats: 4 } as any],
            },
          ],
        },
      ];
      const projected = projectScoreLayerGroupsWithGesture(groups);
      // Because sessionId is now 43, the obsolete projection from session 42 is fenced and does not mutate groups
      expect(projected[0]?.layers[0]?.items[0]?.startBeats).toBe(5);
    });
  });

  describe('projectScoreLayerGroupsWithGesture', () => {
    function makeItem(
      objectId: string,
      startBeats: number,
      durationBeats: number,
      rootGroupIndex = 0,
      layerIndex = 0,
      objectIndex = 0,
    ): ScoreRowObjectSnapshot {
      return {
        objectId,
        objectType: 'GenericScore',
        name: objectId,
        startBeats,
        durationBeats,
        startTimeBase: 'BEATS',
        durationTimeBase: 'BEATS',
        backgroundColor: 0,
        isContainer: false,
        editorTarget: {
          selectionId: objectId,
          selectedObjectType: 'GenericScore',
          editorObjectType: 'GenericScore',
          ownerKind: 'timeline',
          displayContext: 'timeline',
          location: { rootGroupIndex, containerPath: [], layerIndex, objectIndex },
          supportsTimeBehavior: false,
          supportsRepeatPoint: false,
          supportsNoteProcessorChain: false,
        },
      };
    }

    const initialGroups: ScoreLayerGroupSnapshot[] = [
      {
        groupId: 'g-poly',
        groupType: 'polyObject',
        name: 'Poly Group',
        layerCount: 2,
        isOpenableContainer: false,
        layers: [
          {
            layerId: 'l-0',
            name: 'Layer 0',
            height: 44,
            muted: false,
            solo: false,
            items: [makeItem('item-1', 0, 4, 0, 0, 0), makeItem('item-2', 8, 4, 0, 0, 1)],
          },
          {
            layerId: 'l-1',
            name: 'Layer 1',
            height: 44,
            muted: false,
            solo: false,
            items: [makeItem('item-3', 4, 2, 0, 1, 0)],
          },
        ],
      },
      {
        groupId: 'g-track',
        groupType: 'track',
        name: 'Track Group',
        layerCount: 1,
        isOpenableContainer: false,
        layers: [
          {
            layerId: 'l-track-0',
            name: 'Track Layer 0',
            height: 44,
            muted: false,
            solo: false,
            items: [makeItem('track-item-1', 10, 4, 1, 0, 0)],
          },
        ],
      },
    ];

    it('leaves groups unchanged when projection is null or empty', () => {
      expect(projectScoreLayerGroupsWithGesture(initialGroups, null)).toBe(initialGroups);
      expect(
        projectScoreLayerGroupsWithGesture(initialGroups, { gestureId: 'none', objects: {} }),
      ).toBe(initialGroups);
    });

    it('projects same-layer move and resize in place without mutating input groups', () => {
      const projection: ScoreGestureProjection = {
        gestureId: 'gesture-resize',
        objects: {
          'item-1': { objectId: 'item-1', startBeats: 2, durationBeats: 6 },
        },
      };

      const projected = projectScoreLayerGroupsWithGesture(initialGroups, projection);

      // Input was not mutated
      expect(initialGroups[0].layers[0].items[0].startBeats).toBe(0);
      expect(initialGroups[0].layers[0].items[0].durationBeats).toBe(4);

      // Projected has updated timings
      const projItem = projected[0].layers[0].items[0];
      expect(projItem.startBeats).toBe(2);
      expect(projItem.durationBeats).toBe(6);
      expect(projItem.objectId).toBe('item-1');

      // Other items unchanged
      expect(projected[0].layers[0].items[1].startBeats).toBe(8);
    });

    it('preserves cross-group and cross-layer projection', () => {
      // Move item-1 from g-poly/l-0 to g-track/l-track-0 (layer index 0 of group 1)
      const projection: ScoreGestureProjection = {
        gestureId: 'gesture-move-cross-group',
        objects: {
          'item-1': {
            objectId: 'item-1',
            startBeats: 16,
            durationBeats: 4,
            targetGroupId: 'g-track',
            targetLayerIndex: 0,
          },
        },
      };

      const projected = projectScoreLayerGroupsWithGesture(initialGroups, projection);

      // Origin group layer 0 no longer contains item-1
      const originItems = projected[0].layers[0].items;
      expect(originItems.map((i) => i.objectId)).toEqual(['item-2']);

      // Destination group layer 0 now contains item-1 at beat 16
      const destItems = projected[1].layers[0].items;
      expect(destItems.map((i) => i.objectId)).toEqual(['track-item-1', 'item-1']);
      const movedItem = destItems.find((i) => i.objectId === 'item-1')!;
      expect(movedItem.startBeats).toBe(16);
      expect(movedItem.durationBeats).toBe(4);
      expect(movedItem.editorTarget?.location?.rootGroupIndex).toBe(1);
      expect(movedItem.editorTarget?.location?.layerIndex).toBe(0);
    });
  });
});
