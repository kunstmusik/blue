// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { BlueData, PolyObject, SoundLayer, Track, TrackerObject } from '@blue/data';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createScoreObjectEditorDocument } from '../../shared/project-editor';
import TrackerScoreObjectEditor from '../components/workbench/panels/score-object/editors/TrackerScoreObjectEditor';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function makeTrackerDocument() {
  const data = new BlueData();
  data.getScore().length = 0;
  const poly = new PolyObject();
  const layer = new SoundLayer();
  const tracker = new TrackerObject();
  const track = new Track();
  tracker.getTracks().setSteps(4);
  tracker.getTracks().addTrack(track);
  track.getTrackerNote(0).setValue(1, '8.00');
  layer.push(tracker);
  poly.push(layer);
  data.getScore().push(poly);

  const target = {
    selectionId: 'tracker-test',
    selectedObjectType: 'TrackerObject',
    editorObjectType: 'TrackerObject',
    ownerKind: 'timeline' as const,
    displayContext: 'timeline' as const,
    location: { rootGroupIndex: 0, containerPath: [], layerIndex: 0, objectIndex: 0 },
    supportsTimeBehavior: true,
    supportsRepeatPoint: true,
    supportsNoteProcessorChain: true,
  };
  const document = createScoreObjectEditorDocument(data, { target });
  if (!document || document.editor.kind !== 'tracker') {
    throw new Error('Expected tracker editor document');
  }
  return document;
}

describe('TrackerScoreObjectEditor keyboard interaction', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('dispatches the keyboard-notes toolbar toggle and keeps it checked optimistically', () => {
    const onPatch = vi.fn();
    act(() => {
      root.render(<TrackerScoreObjectEditor document={makeTrackerDocument()} onPatch={onPatch} />);
    });

    const checkbox = container.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    expect(checkbox.checked).toBe(false);
    act(() => checkbox.click());

    expect(checkbox.checked).toBe(true);
    expect(onPatch).toHaveBeenLastCalledWith(expect.objectContaining({
      patch: { showNoteNames: true },
    }));
  });

  it('moves row focus with Arrow keys and toggles ties with Space from the status cell', () => {
    const onPatch = vi.fn();
    act(() => {
      root.render(<TrackerScoreObjectEditor document={makeTrackerDocument()} onPatch={onPatch} />);
    });

    const firstStatus = container.querySelector<HTMLInputElement>('[data-track="0"][data-col="-1"][data-step="0"]')!;
    act(() => firstStatus.focus());

    const down = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
    act(() => firstStatus.dispatchEvent(down));
    expect(down.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(
      container.querySelector('[data-track="0"][data-col="-1"][data-step="1"]'),
    );

    act(() => firstStatus.focus());
    const space = new KeyboardEvent('keydown', {
      key: ' ',
      code: 'Space',
      bubbles: true,
      cancelable: true,
    });
    act(() => firstStatus.dispatchEvent(space));
    expect(space.defaultPrevented).toBe(true);
    expect(onPatch).toHaveBeenLastCalledWith(expect.objectContaining({
      patch: {
        trackerAction: {
          type: 'toggleTie',
          trackIndex: 0,
          stepIndex: 0,
          columnIndex: -1,
        },
      },
    }));
  });

  it('prevents grid-background Arrow navigation from scrolling the page', () => {
    act(() => {
      root.render(<TrackerScoreObjectEditor document={makeTrackerDocument()} onPatch={vi.fn()} />);
    });

    const grid = container.querySelector<HTMLElement>('[aria-label="Tracker grid"]')!;
    act(() => grid.focus());
    const down = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
    act(() => grid.dispatchEvent(down));

    expect(down.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(
      container.querySelector('[data-track="0"][data-col="-1"][data-step="1"]'),
    );
  });
});
