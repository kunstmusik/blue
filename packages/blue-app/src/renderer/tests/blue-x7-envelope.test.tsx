// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BlueX7EnvelopePoint } from '@blue/data';
import { EnvelopeEditor } from '../components/instruments/blue-x7/envelope-editor';
import { PitchEnvelopePanel } from '../components/instruments/blue-x7/pitch-envelope-panel';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('BlueX7 EnvelopeEditor Component', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    container = null;
    root = null;
  });

  const defaultEnvelope: [
    BlueX7EnvelopePoint,
    BlueX7EnvelopePoint,
    BlueX7EnvelopePoint,
    BlueX7EnvelopePoint,
  ] = [
    { rate: 50, level: 90 },
    { rate: 60, level: 75 },
    { rate: 40, level: 50 },
    { rate: 30, level: 0 },
  ];

  it('renders SVG paths and 4 interactive stage handles', () => {
    const onChangeStage = vi.fn();

    act(() => {
      root?.render(
        <EnvelopeEditor
          envelope={defaultEnvelope}
          title="Op 1 Envelope"
          onChangeStage={onChangeStage}
        />,
      );
    });

    expect(container?.querySelector('[data-testid="bluex7-envelope-editor"]')).not.toBeNull();
    const handles = container?.querySelectorAll('circle[role="slider"]');
    expect(handles?.length).toBe(4);

    expect(container?.querySelector('[data-testid="envelope-handle-0"]')?.getAttribute('aria-valuenow')).toBe('90');
    expect(container?.querySelector('[data-testid="envelope-handle-1"]')?.getAttribute('aria-valuenow')).toBe('75');
    expect(container?.querySelector('[data-testid="envelope-handle-2"]')?.getAttribute('aria-valuenow')).toBe('50');
    expect(container?.querySelector('[data-testid="envelope-handle-3"]')?.getAttribute('aria-valuenow')).toBe('0');
  });

  it('supports keyboard navigation (Arrow keys) to adjust rate and level with clamping', () => {
    const onChangeStage = vi.fn();
    const onGestureStart = vi.fn();
    const onGestureCommit = vi.fn();

    act(() => {
      root?.render(
        <EnvelopeEditor
          envelope={defaultEnvelope}
          title="Op 1 Envelope"
          onChangeStage={onChangeStage}
          onGestureStart={onGestureStart}
          onGestureCommit={onGestureCommit}
        />,
      );
    });

    const handle0 = container?.querySelector('[data-testid="envelope-handle-0"]') as SVGCircleElement;
    expect(handle0).not.toBeNull();

    // ArrowUp on Handle 0 (Level 90 -> 91)
    act(() => {
      handle0.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
    });
    expect(onChangeStage).toHaveBeenCalledWith(0, { rate: 50, level: 91 });
    expect(onGestureStart).toHaveBeenCalled();
    expect(onGestureCommit).toHaveBeenCalled();

    // Shift + ArrowDown on Handle 0 (Level 90 -> 80)
    act(() => {
      handle0.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', shiftKey: true, bubbles: true, cancelable: true }));
    });
    expect(onChangeStage).toHaveBeenCalledWith(0, { rate: 50, level: 80 });

    // ArrowRight on Handle 0 (Rate 50 -> 51)
    act(() => {
      handle0.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    });
    expect(onChangeStage).toHaveBeenCalledWith(0, { rate: 51, level: 90 });
  });

  it('clamps level and rate between 0 and 99', () => {
    const boundaryEnvelope: [
      BlueX7EnvelopePoint,
      BlueX7EnvelopePoint,
      BlueX7EnvelopePoint,
      BlueX7EnvelopePoint,
    ] = [
      { rate: 99, level: 99 },
      { rate: 0, level: 0 },
      { rate: 50, level: 50 },
      { rate: 50, level: 50 },
    ];
    const onChangeStage = vi.fn();

    act(() => {
      root?.render(
        <EnvelopeEditor
          envelope={boundaryEnvelope}
          title="Boundary Envelope"
          onChangeStage={onChangeStage}
        />,
      );
    });

    const handle0 = container?.querySelector('[data-testid="envelope-handle-0"]') as SVGCircleElement;
    // ArrowUp at 99 stays 99
    act(() => {
      handle0.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
    });
    expect(onChangeStage).toHaveBeenCalledWith(0, { rate: 99, level: 99 });

    const handle1 = container?.querySelector('[data-testid="envelope-handle-1"]') as SVGCircleElement;
    // ArrowDown at 0 stays 0
    act(() => {
      handle1.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    });
    expect(onChangeStage).toHaveBeenCalledWith(1, { rate: 0, level: 0 });
  });
});

describe('BlueX7 envelope gesture coalescing (panel level)', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    container = null;
    root = null;
  });

  const defaultEnvelope: [
    BlueX7EnvelopePoint,
    BlueX7EnvelopePoint,
    BlueX7EnvelopePoint,
    BlueX7EnvelopePoint,
  ] = [
    { rate: 50, level: 50 },
    { rate: 60, level: 75 },
    { rate: 40, level: 50 },
    { rate: 30, level: 0 },
  ];

  it('dispatches exactly one patch per pointer drag, not one per pointer-move', () => {
    const onApplyPatch = vi.fn();

    act(() => {
      root?.render(
        <PitchEnvelopePanel
          pitchEnvelope={defaultEnvelope}
          onApplyPatch={onApplyPatch}
        />,
      );
    });

    const handle0 = container?.querySelector('[data-testid="envelope-handle-0"]') as SVGCircleElement;
    expect(handle0).not.toBeNull();
    // jsdom does not implement pointer capture
    (handle0 as unknown as Element & { setPointerCapture: () => void }).setPointerCapture = vi.fn();
    (handle0 as unknown as Element & { releasePointerCapture: () => void }).releasePointerCapture = vi.fn();

    // Begin drag on stage 0
    act(() => {
      handle0.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true }));
    });

    // Several pointer moves during the gesture must not dispatch any patch.
    // jsdom getBoundingClientRect() returns zeros, so coordinates map
    // relative to the origin: level 50 => clientY ~60, rate 70 => clientX ~67.
    for (const [clientX, clientY] of [[50, 60], [58, 62], [67, 60]] as Array<[number, number]>) {
      act(() => {
        handle0.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, cancelable: true, clientX, clientY }));
      });
    }
    expect(onApplyPatch).not.toHaveBeenCalled();

    // Releasing the pointer commits the whole drag as a single patch
    act(() => {
      handle0.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, cancelable: true }));
    });

    expect(onApplyPatch).toHaveBeenCalledTimes(1);
    expect(onApplyPatch).toHaveBeenCalledWith(
      'Change Pitch Env Stage 1',
      {
        type: 'setPitchEnvelopePoint',
        stageIndex: 0,
        point: { rate: 70, level: 50 },
      },
    );
  });

  it('still dispatches one patch per discrete keyboard edit', () => {
    const onApplyPatch = vi.fn();

    act(() => {
      root?.render(
        <PitchEnvelopePanel
          pitchEnvelope={defaultEnvelope}
          onApplyPatch={onApplyPatch}
        />,
      );
    });

    const handle0 = container?.querySelector('[data-testid="envelope-handle-0"]') as SVGCircleElement;
    act(() => {
      handle0.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
    });
    act(() => {
      handle0.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
    });

    expect(onApplyPatch).toHaveBeenCalledTimes(2);
    // The panel is controlled: with this test's spy parent never feeding the
    // dispatched value back in, each keydown computes from the same base
    // envelope (level 50 -> 51). One dispatch per discrete key edit is the
    // behavior under test.
    expect(onApplyPatch).toHaveBeenLastCalledWith(
      'Change Pitch Env Stage 1',
      {
        type: 'setPitchEnvelopePoint',
        stageIndex: 0,
        point: { rate: 50, level: 51 },
      },
    );
  });
});
