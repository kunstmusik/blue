// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import ScoreOverlayLines from '../components/workbench/panels/score/ScoreOverlayLines';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function renderOverlay(overrides?: Partial<Parameters<typeof ScoreOverlayLines>[0]>) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <ScoreOverlayLines
        renderStartTime={12}
        renderEndTime={16}
        timePointerBeats={14}
        pixelsPerBeat={100}
        totalBeats={80}
        scrollLeft={800}
        {...overrides}
      />,
    );
  });

  return { container, root };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('ScoreOverlayLines', () => {
  it('keeps render and pointer lines inside a full timeline-width layer when scrolled', () => {
    const { container, root } = renderOverlay();

    const viewport = container.querySelector('[data-score-overlay-viewport]');
    const content = container.querySelector('[data-score-overlay-content]') as HTMLDivElement | null;

    expect(viewport).not.toBeNull();
    expect(content).not.toBeNull();
    expect(content?.style.width).toBe('8000px');
    expect(content?.style.transform).toBe('translateX(-800px)');

    const overlayElements = Array.from(content?.children ?? []) as HTMLDivElement[];
    expect(overlayElements.some((element) => element.style.left === '1200px')).toBe(true);
    expect(overlayElements.some((element) => element.style.left === '1400px')).toBe(true);
    expect(overlayElements.some((element) => element.style.left === '1600px')).toBe(true);

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('hides the shared playhead when playback is idle or unavailable', () => {
    const { container, root } = renderOverlay({ timePointerBeats: null });

    const content = container.querySelector('[data-score-overlay-content]') as HTMLDivElement | null;
    expect(content).not.toBeNull();
    const lefts = (Array.from(content!.children) as HTMLDivElement[]).map((el) => el.style.left);
    expect(lefts).not.toContain('1400px');

    act(() => root.unmount());
    container.remove();
  });

  it('passes pointer events through so pattern canvas gestures keep working beneath it', () => {
    const { container, root } = renderOverlay();

    const viewport = container.querySelector('[data-score-overlay-viewport]') as HTMLDivElement | null;
    expect(viewport).not.toBeNull();
    expect(viewport!.className).toContain('pointer-events-none');

    act(() => root.unmount());
    container.remove();
  });

  it('keeps the single tempo-aware playhead aligned after scroll and zoom changes', () => {
    // totalBeats is derived from all groups (including pattern extent), so the
    // shared overlay covers pattern rows at every zoom and scroll position.
    const { container, root } = renderOverlay({ scrollLeft: 2400, pixelsPerBeat: 50 });

    const content = container.querySelector('[data-score-overlay-content]') as HTMLDivElement | null;
    expect(content!.style.transform).toBe('translateX(-2400px)');
    const pointerLines = (Array.from(content!.children) as HTMLDivElement[])
      .filter((el) => el.style.left === '700px');
    expect(pointerLines).toHaveLength(1);

    act(() => root.unmount());
    container.remove();
  });
});
