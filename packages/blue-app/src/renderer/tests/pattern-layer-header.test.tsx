// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PatternLayerHeader from '../components/workbench/panels/score/PatternLayerHeader';
import type { PatternLayerSnapshot } from '../components/workbench/panels/score/types';
import { useProjectStore } from '../stores/project-store';
import { useScoreSelectionStore } from '../stores/score-selection-store';
import { useLayerSelectionStore } from '../stores/layer-selection-store';
import { useWorkbenchStore } from '../stores/workbench-store';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const originalProjectState = useProjectStore.getState();

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
  let applyProjectDocumentPatch: ReturnType<typeof vi.fn>;
  let originalOpenPanel: typeof useWorkbenchStore.getState extends () => infer State
    ? State['openPanel']
    : never;

  beforeEach(() => {
    useScoreSelectionStore.getState().clearSelection();
    useLayerSelectionStore.getState().clear();
    originalOpenPanel = useWorkbenchStore.getState().openPanel;
    openPanel = vi.fn();
    applyProjectDocumentPatch = vi.fn().mockResolvedValue(undefined);
    useProjectStore.setState({ applyProjectDocumentPatch } as Partial<
      ReturnType<typeof useProjectStore.getState>
    >);
    useWorkbenchStore.setState({ openPanel });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    useScoreSelectionStore.getState().clearSelection();
    useLayerSelectionStore.getState().clear();
    useProjectStore.setState(originalProjectState, true);
    useWorkbenchStore.setState({ openPanel: originalOpenPanel });
  });

  it('selects the embedded source object and focuses its editor on a row click', () => {
    act(() => {
      root.render(
        <PatternLayerHeader layer={makeLayer()} groupId="grp" layerIndex={0} layerCount={1} />,
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

  it('shows only the pattern layer name', () => {
    act(() => {
      root.render(
        <PatternLayerHeader layer={makeLayer()} groupId="grp" layerIndex={0} layerCount={1} />,
      );
    });

    const header = container.querySelector<HTMLElement>('[data-pattern-layer-header]')!;
    expect(header.textContent).toContain('Pattern Row');
    expect(header.textContent).not.toContain('Lead Source');
    expect(header.querySelector('span')?.getAttribute('title')).toBe('Pattern Row');
  });

  it('does not invent a fallback label for an unnamed pattern layer', () => {
    const layer = makeLayer();
    layer.name = '';

    act(() => {
      root.render(<PatternLayerHeader layer={layer} groupId="grp" layerIndex={0} layerCount={1} />);
    });

    const header = container.querySelector<HTMLElement>('[data-pattern-layer-header]')!;
    const label = header.querySelector('span');
    expect(label?.textContent).toBe('');
    expect(label?.getAttribute('title')).toBeNull();
    expect(header.textContent).not.toContain('Pattern Layer');
  });

  it('renames the pattern layer through the canonical group-index patch', () => {
    act(() => {
      root.render(
        <PatternLayerHeader layer={makeLayer()} groupId="grp" layerIndex={0} layerCount={1} />,
      );
    });

    const header = container.querySelector<HTMLElement>('[data-pattern-layer-header]')!;
    act(() => {
      header.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });

    const input = container.querySelector<HTMLInputElement>('[data-pattern-layer-name-input]')!;
    act(() => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setValue?.call(input, 'Renamed Pattern');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(applyProjectDocumentPatch).toHaveBeenCalledWith({
      score: {
        type: 'renameLayer',
        groupId: 'grp',
        layerIndex: 0,
        name: 'Renamed Pattern',
      },
    });
  });

  it('clears the single editor target for a shift-click layer-range gesture', () => {
    useScoreSelectionStore
      .getState()
      .select('source-1', false, makeLayer().sourceObject.editorTarget);
    act(() => {
      root.render(
        <PatternLayerHeader layer={makeLayer()} groupId="grp" layerIndex={0} layerCount={1} />,
      );
    });
    const header = container.querySelector<HTMLElement>('[data-pattern-layer-header]')!;
    act(() => {
      header.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, button: 0, shiftKey: true }),
      );
    });
    expect(useScoreSelectionStore.getState().selectedObjectIds.size).toBe(0);
    expect(openPanel).not.toHaveBeenCalled();
    expect(header.getAttribute('aria-selected')).toBe('true');
    expect(header.className).toContain('bg-app-selection');
  });

  it('applies layer selection styling and aria-selected on single selection', () => {
    act(() => {
      root.render(
        <PatternLayerHeader layer={makeLayer()} groupId="grp" layerIndex={0} layerCount={1} />,
      );
    });

    const header = container.querySelector<HTMLElement>('[data-pattern-layer-header]')!;
    expect(header.getAttribute('aria-selected')).toBe('false');

    act(() => {
      header.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    });

    expect(header.getAttribute('aria-selected')).toBe('true');
    expect(header.className).toContain('border-l-app-accent');
    expect(header.className).toContain('bg-app-selection');
    expect(header.querySelector('span')?.className).not.toContain('font-semibold');
  });
});
