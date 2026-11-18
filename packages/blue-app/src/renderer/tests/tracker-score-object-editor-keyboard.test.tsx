// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { BlueData, PolyObject, SoundLayer, Track, TrackerObject } from '@blue/data';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createScoreObjectEditorDocument } from '../../shared/project-editor';
import TrackerScoreObjectEditor from '../components/workbench/panels/score-object/editors/TrackerScoreObjectEditor';


function makeTrackerDocument(steps = 4) {
  const data = new BlueData();
  data.getScore().length = 0;
  const poly = new PolyObject();
  const layer = new SoundLayer();
  const tracker = new TrackerObject();
  const track = new Track();
  tracker.getTracks().setSteps(steps);
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
    expect(onPatch).toHaveBeenLastCalledWith(
      expect.objectContaining({
        patch: { showNoteNames: true },
      }),
    );
  });

  it('moves row focus with Arrow keys and toggles ties with Space from the status cell', () => {
    const onPatch = vi.fn();
    act(() => {
      root.render(<TrackerScoreObjectEditor document={makeTrackerDocument()} onPatch={onPatch} />);
    });

    const firstStatus = container.querySelector<HTMLInputElement>(
      '[data-track="0"][data-col="-1"][data-step="0"]',
    )!;
    act(() => firstStatus.focus());

    const down = new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
    });
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
    expect(onPatch).toHaveBeenLastCalledWith(
      expect.objectContaining({
        patch: {
          trackerAction: {
            type: 'toggleTie',
            trackIndex: 0,
            stepIndex: 0,
            columnIndex: -1,
          },
        },
      }),
    );
  });

  it('prevents grid-background Arrow navigation from scrolling the page', () => {
    act(() => {
      root.render(<TrackerScoreObjectEditor document={makeTrackerDocument()} onPatch={vi.fn()} />);
    });

    const grid = container.querySelector<HTMLElement>('[aria-label="Tracker grid"]')!;
    act(() => grid.focus());
    const down = new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
    });
    act(() => grid.dispatchEvent(down));

    expect(down.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(
      container.querySelector('[data-track="0"][data-col="-1"][data-step="1"]'),
    );
  });

  it('cancels a cell draft with Escape without committing it on blur', () => {
    const onPatch = vi.fn();
    act(() => {
      root.render(<TrackerScoreObjectEditor document={makeTrackerDocument()} onPatch={onPatch} />);
    });
    const cell = container.querySelector<HTMLInputElement>(
      '[data-track="0"][data-col="0"][data-step="0"]',
    )!;
    act(() => cell.focus());
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(cell, '9.00');
      cell.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(cell.value).toBe('9.00');
    expect(onPatch).not.toHaveBeenCalled();

    act(() => cell.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));

    expect(onPatch).not.toHaveBeenCalled();
    expect(cell.value).toBe('8.00');
    expect(document.activeElement).not.toBe(cell);
  });

  it('virtualizes step rows above 64 steps and renders scrolled rows', () => {
    act(() => {
      root.render(
        <TrackerScoreObjectEditor document={makeTrackerDocument(128)} onPatch={vi.fn()} />,
      );
    });

    const initialRows = container.querySelectorAll('tr[data-tracker-step]');
    expect(initialRows.length).toBeGreaterThan(0);
    expect(initialRows.length).toBeLessThan(128);
    expect(container.querySelector('[data-tracker-step="0"]')).not.toBeNull();
    expect(container.querySelector('[data-tracker-step="120"]')).toBeNull();

    const gridScroll = container.querySelector<HTMLElement>('[aria-label="Tracker grid"]')!;
    act(() => {
      gridScroll.scrollTop = 2400;
      gridScroll.dispatchEvent(new Event('scroll'));
    });

    expect(container.querySelector('[data-tracker-step="120"]')).not.toBeNull();
  });

  it('commits an active uncommitted draft cell when scrolling unmounts it without blur', () => {
    const onPatch = vi.fn();
    act(() => {
      root.render(
        <TrackerScoreObjectEditor document={makeTrackerDocument(128)} onPatch={onPatch} />,
      );
    });

    const cell = container.querySelector<HTMLInputElement>(
      '[data-track="0"][data-col="0"][data-step="0"]',
    )!;
    act(() => {
      cell.focus();
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(cell, '8.04');
      cell.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(onPatch).not.toHaveBeenCalled();

    const gridScroll = container.querySelector<HTMLElement>('[aria-label="Tracker grid"]')!;
    act(() => {
      gridScroll.scrollTop = 2400;
      gridScroll.dispatchEvent(new Event('scroll'));
    });

    expect(container.querySelector('[data-tracker-step="0"]')).toBeNull();
    expect(onPatch).toHaveBeenCalledWith(
      expect.objectContaining({
        patch: {
          updateTrackCell: {
            trackIndex: 0,
            columnIndex: 0,
            stepIndex: 0,
            value: '8.04',
          },
        },
      }),
    );
  });

  it('routes Tab and Shift+Tab across virtualized row boundaries while exiting at grid edges', () => {
    const trackerDoc = makeTrackerDocument(128);
    const lastColIndex = (trackerDoc.editor.tracks[0].columns?.length ?? 1) - 1;
    const onPatch = vi.fn();
    act(() => {
      root.render(<TrackerScoreObjectEditor document={trackerDoc} onPatch={onPatch} />);
    });

    const gridScroll = container.querySelector<HTMLElement>('[aria-label="Tracker grid"]')!;

    // Boundary exit at very first cell on Shift+Tab
    const firstCell = container.querySelector<HTMLInputElement>(
      '[data-track="0"][data-col="-1"][data-step="0"]',
    )!;
    let firstShiftTab!: KeyboardEvent;
    act(() => {
      firstCell.focus();
      firstShiftTab = new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });
      firstCell.dispatchEvent(firstShiftTab);
    });
    expect(firstShiftTab.defaultPrevented).toBe(false);

    // Tab from the last column of the last currently mounted row must cross into the next unmounted step.
    const initialRows = container.querySelectorAll('tr[data-tracker-step]');
    const lastMountedStep = Number(
      initialRows[initialRows.length - 1].getAttribute('data-tracker-step'),
    );
    expect(lastMountedStep).toBeLessThan(127);
    expect(container.querySelector(`[data-tracker-step="${lastMountedStep + 1}"]`)).toBeNull();

    const lastMountedCell = container.querySelector<HTMLInputElement>(
      `[data-track="0"][data-col="${lastColIndex}"][data-step="${lastMountedStep}"]`,
    )!;
    let forwardTab!: KeyboardEvent;
    act(() => {
      lastMountedCell.focus();
      forwardTab = new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true,
        cancelable: true,
      });
      lastMountedCell.dispatchEvent(forwardTab);
    });
    expect(forwardTab.defaultPrevented).toBe(true);
    const expectedNextCell = container.querySelector<HTMLInputElement>(
      `[data-track="0"][data-col="-1"][data-step="${lastMountedStep + 1}"]`,
    );
    expect(expectedNextCell).not.toBeNull();
    expect(document.activeElement).toBe(expectedNextCell);

    // Scroll to the middle/bottom and Shift+Tab from first mounted row across the top virtual boundary.
    act(() => {
      gridScroll.scrollTop = 2400;
      gridScroll.dispatchEvent(new Event('scroll'));
    });
    const scrolledRows = container.querySelectorAll('tr[data-tracker-step]');
    const firstMountedStep = Number(scrolledRows[0].getAttribute('data-tracker-step'));
    expect(firstMountedStep).toBeGreaterThan(0);
    expect(container.querySelector(`[data-tracker-step="${firstMountedStep - 1}"]`)).toBeNull();

    const firstMountedCell = container.querySelector<HTMLInputElement>(
      `[data-track="0"][data-col="-1"][data-step="${firstMountedStep}"]`,
    )!;
    let backwardTab!: KeyboardEvent;
    act(() => {
      firstMountedCell.focus();
      backwardTab = new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });
      firstMountedCell.dispatchEvent(backwardTab);
    });
    expect(backwardTab.defaultPrevented).toBe(true);
    const expectedPrevCell = container.querySelector<HTMLInputElement>(
      `[data-track="0"][data-col="${lastColIndex}"][data-step="${firstMountedStep - 1}"]`,
    );
    expect(expectedPrevCell).not.toBeNull();
    expect(document.activeElement).toBe(expectedPrevCell);

    // Boundary exit at the very last row/column on Tab
    act(() => {
      gridScroll.scrollTop = 5000;
      gridScroll.dispatchEvent(new Event('scroll'));
    });
    const finalCell = container.querySelector<HTMLInputElement>(
      `[data-track="0"][data-col="${lastColIndex}"][data-step="127"]`,
    )!;
    let finalTab!: KeyboardEvent;
    act(() => {
      finalCell.focus();
      finalTab = new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true,
        cancelable: true,
      });
      finalCell.dispatchEvent(finalTab);
    });
    expect(finalTab.defaultPrevented).toBe(false);
  });
});
