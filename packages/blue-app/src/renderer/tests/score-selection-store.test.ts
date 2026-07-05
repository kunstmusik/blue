// @vitest-environment jsdom

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { useScoreSelectionStore } from '../stores/score-selection-store';
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

describe('useScoreSelectionStore.addToSelection (shift-marquee parity)', () => {
  beforeEach(() => {
    useScoreSelectionStore.getState().clearSelection();
  });

  afterEach(() => {
    useScoreSelectionStore.getState().clearSelection();
  });

  it('unions new entries with the existing selection instead of replacing it', () => {
    useScoreSelectionStore.getState().setSelection([
      { objectId: 'A', editorTarget: target('A') },
    ]);
    expect([...useScoreSelectionStore.getState().selectedObjectIds]).toEqual(['A']);

    // Simulates a shift-marquee that hits B and C in a region that does NOT
    // overlap the already-selected A.
    useScoreSelectionStore.getState().addToSelection([
      { objectId: 'B', editorTarget: target('B') },
      { objectId: 'C', editorTarget: target('C') },
    ]);

    expect([...useScoreSelectionStore.getState().selectedObjectIds].sort()).toEqual([
      'A',
      'B',
      'C',
    ]);
  });

  it('is a no-op for empty input (preserves the current selection untouched)', () => {
    useScoreSelectionStore.getState().setSelection([
      { objectId: 'A', editorTarget: target('A') },
    ]);
    useScoreSelectionStore.getState().addToSelection([]);
    expect([...useScoreSelectionStore.getState().selectedObjectIds]).toEqual(['A']);
  });

  it('keeps targets for both the previous and added entries', () => {
    useScoreSelectionStore.getState().setSelection([
      { objectId: 'A', editorTarget: target('A') },
    ]);
    useScoreSelectionStore.getState().addToSelection([
      { objectId: 'B', editorTarget: target('B') },
    ]);
    const targets = useScoreSelectionStore.getState().selectedObjectTargets;
    expect(targets.A).toBeDefined();
    expect(targets.B).toBeDefined();
  });

  it('does not duplicate an object already in the selection', () => {
    useScoreSelectionStore.getState().setSelection([
      { objectId: 'A', editorTarget: target('A') },
    ]);
    useScoreSelectionStore.getState().addToSelection([
      { objectId: 'A', editorTarget: target('A') },
    ]);
    expect([...useScoreSelectionStore.getState().selectedObjectIds]).toEqual(['A']);
  });
});
