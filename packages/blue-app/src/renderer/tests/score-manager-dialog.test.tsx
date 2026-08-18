// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ScoreManagerDialog from '../components/workbench/panels/score/ScoreManagerDialog';
import {
  createEmptyScoreDocumentSnapshot,
  type ScoreDocumentSnapshot,
} from '../../shared/project-editor';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { mockProjectState } = vi.hoisted(() => ({
  mockProjectState: {
    applyProjectDocumentPatch: vi.fn(),
    addLayer: vi.fn(),
  },
}));

vi.mock('../stores/project-store', () => ({
  useProjectStore: (selector: (state: typeof mockProjectState) => unknown) =>
    selector(mockProjectState),
}));

function createScoreSnapshot(): ScoreDocumentSnapshot {
  return {
    ...createEmptyScoreDocumentSnapshot(),
    layerGroups: [
      {
        groupId: 'lg-1',
        groupType: 'polyObject',
        name: 'Existing Group',
        layerCount: 1,
        isOpenableContainer: true,
        layers: [
          {
            layerId: 'lg-1-layer-0',
            name: '',
            height: 44,
            muted: false,
            solo: false,
            items: [],
          },
        ],
      },
    ],
  };
}

function renderDialog(score: ScoreDocumentSnapshot = createScoreSnapshot()): {
  container: HTMLDivElement;
  root: Root;
  onClose: ReturnType<typeof vi.fn<() => void>>;
} {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const onClose = vi.fn<() => void>();

  act(() => {
    root.render(<ScoreManagerDialog score={score} onClose={onClose} />);
  });

  return { container, root, onClose };
}

function openAddLayerGroupMenu(trigger: HTMLButtonElement): void {
  const PointerEventCtor = window.PointerEvent ?? MouseEvent;
  trigger.dispatchEvent(new PointerEventCtor('pointerdown', { bubbles: true, button: 0 }));
  trigger.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
}

function clickMenuItem(item: HTMLElement): void {
  const PointerEventCtor = window.PointerEvent ?? MouseEvent;
  item.dispatchEvent(new PointerEventCtor('pointermove', { bubbles: true }));
  item.dispatchEvent(new PointerEventCtor('pointerdown', { bubbles: true, button: 0 }));
  item.dispatchEvent(new PointerEventCtor('pointerup', { bubbles: true, button: 0 }));
  item.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
}

function setTextInputValue(input: HTMLInputElement, value: string): void {
  const valueSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set;
  valueSetter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

beforeEach(() => {
  mockProjectState.applyProjectDocumentPatch.mockReset();
  mockProjectState.addLayer.mockReset();
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('ScoreManagerDialog', () => {
  it('shows built-in layer-group options and dispatches the selected type', () => {
    const { container, root } = renderDialog();
    const trigger = container.querySelector('button[aria-label="Add Layer Group"]') as HTMLButtonElement;

    act(() => {
      openAddLayerGroupMenu(trigger);
    });

    const menuItems = Array.from(document.body.querySelectorAll('[role="menuitem"]')) as HTMLElement[];
    expect(menuItems.map((item) => item.textContent?.trim())).toEqual([
      'Add SoundObject Layer Group',
      'Add Track Layer Group',
      'Add Patterns Layer Group',
    ]);

    const trackItem = menuItems.find((item) => item.textContent?.includes('Track'));
    expect(trackItem).toBeTruthy();

    act(() => {
      clickMenuItem(trackItem!);
    });

    expect(mockProjectState.applyProjectDocumentPatch).toHaveBeenCalledWith({
      score: {
        type: 'addLayerGroup',
        groupType: 'track',
        insertAtIndex: 1,
      },
    });

    act(() => {
      root.unmount();
    });
  });

  it('commits layer-group rename on Enter', () => {
    const { container, root } = renderDialog();

    const firstGroupRow = Array.from(container.querySelectorAll('.cursor-pointer')).find((node) =>
      node.textContent?.trim() === 'Existing Group',
    ) as HTMLDivElement;
    expect(firstGroupRow.textContent).toContain('Existing Group');

    act(() => {
      firstGroupRow.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      firstGroupRow.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });

    const input = container.querySelector('input:not([type])') as HTMLInputElement;
    expect(input).toBeTruthy();

    act(() => {
      setTextInputValue(input, 'Renamed Group');
    });

    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(mockProjectState.applyProjectDocumentPatch).toHaveBeenCalledWith({
      score: {
        type: 'renameLayerGroup',
        groupId: 'lg-1',
        name: 'Renamed Group',
      },
    });

    act(() => {
      root.unmount();
    });
  });

  it('confirms removal of the last layer and exposes empty-group cleanup', () => {
    const { container, root } = renderDialog();
    const layerRow = container.querySelector('tbody tr') as HTMLTableRowElement;
    expect(layerRow).toBeTruthy();

    act(() => {
      layerRow.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const removeButton = container.querySelector<HTMLButtonElement>('button[title="Remove Layer"]')!;
    expect(removeButton.disabled).toBe(false);
    act(() => {
      removeButton.click();
    });

    const dialog = container.querySelector('[data-layer-removal-dialog]');
    expect(dialog).toBeTruthy();
    const cleanupCheckbox = container.querySelector<HTMLInputElement>('[data-delete-empty-layer-groups]');
    expect(cleanupCheckbox?.checked).toBe(true);

    act(() => {
      dialog?.querySelector<HTMLButtonElement>('[data-layer-removal-confirm]')?.click();
    });

    expect(mockProjectState.applyProjectDocumentPatch).toHaveBeenCalledWith({
      score: {
        type: 'removeLayerRanges',
        ranges: [{ groupId: 'lg-1', startIndex: 0, endIndex: 0 }],
        deleteEmptyLayerGroups: true,
      },
    });

    act(() => {
      root.unmount();
    });
  });
});
