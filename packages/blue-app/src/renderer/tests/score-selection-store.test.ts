// @vitest-environment jsdom

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  hasAuditionEligibleSelection,
  useScoreSelectionStore,
} from '../stores/score-selection-store';
import type { ScoreObjectEditorTargetSnapshot } from '../../shared/project-editor';

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
});
