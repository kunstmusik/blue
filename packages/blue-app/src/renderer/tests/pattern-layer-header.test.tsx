// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PatternLayerHeader from '../components/workbench/panels/score/PatternLayerHeader';
import type { PatternLayerSnapshot } from '../components/workbench/panels/score/types';
import { useScoreSelectionStore } from '../stores/score-selection-store';
import { useWorkbenchStore } from '../stores/workbench-store';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function makeLayer(): PatternLayerSnapshot {
  return {
    layerId: 'pl-1',
    name: 'Pattern Row',
    height: 44,
    muted: false,
    solo: false,
    items: [],
    sourceObject: {
      objectId: 'source-1',
      objectType: 'NoteObject',
      name: 'Lead Source',
      backgroundColor: 0xff204020,
      editorTarget: {
        selectionId: 'source-1',
        selectedObjectType: 'NoteObject',
        editorObjectType: 'NoteObject',
        ownerKind: 'timeline',
        displayContext: 'timeline',
        patternSource: { groupId: 'grp', layerId: 'pl-1', sourceObjectId: 'source-1' },
        supportsTimeBehavior: true,
        supportsRepeatPoint: true,
        supportsNoteProcessorChain: true,
      },
      barRenderer: {
        kind: 'generic',
        labelLines: ['Lead Source'],
        timeBehavior: 'NONE',
        repeatPointBeats: null,
      },
    },
    activeCellIndices: [0],
  };
}

describe('PatternLayerHeader', () => {
  let container: HTMLDivElement;
  let root: Root;
  let openPanel: ReturnType<typeof vi.fn>;
  let originalOpenPanel: typeof useWorkbenchStore.getState extends () => infer State ? State['openPanel'] : never;

  beforeEach(() => {
    useScoreSelectionStore.getState().clearSelection();
    originalOpenPanel = useWorkbenchStore.getState().openPanel;
    openPanel = vi.fn();
    useWorkbenchStore.setState({ openPanel });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    useScoreSelectionStore.getState().clearSelection();
    useWorkbenchStore.setState({ openPanel: originalOpenPanel });
  });

  it('selects the embedded source object and focuses its editor on a row click', () => {
    act(() => {
      root.render(
        <PatternLayerHeader
          layer={makeLayer()}
          groupId="grp"
          layerIndex={0}
          layerCount={1}
        />,
      );
    });

    const header = container.querySelector<HTMLElement>('[data-pattern-layer-header]')!;
    act(() => {
      header.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    });

    expect([...useScoreSelectionStore.getState().selectedObjectIds]).toEqual(['source-1']);
    expect(useScoreSelectionStore.getState().selectedObjectTarget?.patternSource).toEqual({
      groupId: 'grp',
      layerId: 'pl-1',
      sourceObjectId: 'source-1',
    });
    expect(openPanel).toHaveBeenCalledWith('ScoreObjectEditorTopComponent');
    expect(header.dataset.patternSourceSelected).toBe('true');
  });

  it('shows both the pattern row name and embedded source-object name', () => {
    act(() => {
      root.render(
        <PatternLayerHeader
          layer={makeLayer()}
          groupId="grp"
          layerIndex={0}
          layerCount={1}
        />,
      );
    });

    const header = container.querySelector<HTMLElement>('[data-pattern-layer-header]')!;
    expect(header.textContent).toContain('Pattern Row');
    expect(header.textContent).toContain('Lead Source');
  });

  it('clears the single editor target for a shift-click layer-range gesture', () => {
    useScoreSelectionStore.getState().select('source-1', false, makeLayer().sourceObject.editorTarget);
    act(() => {
      root.render(
        <PatternLayerHeader
          layer={makeLayer()}
          groupId="grp"
          layerIndex={0}
          layerCount={1}
        />,
      );
    });
    const header = container.querySelector<HTMLElement>('[data-pattern-layer-header]')!;
    act(() => {
      header.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, shiftKey: true }));
    });
    expect(useScoreSelectionStore.getState().selectedObjectIds.size).toBe(0);
    expect(openPanel).not.toHaveBeenCalled();
  });
});
