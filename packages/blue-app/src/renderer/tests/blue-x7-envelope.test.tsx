// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BlueX7EnvelopePoint } from '@blue/data';
import { createDefaultBlueX7Voice } from '@blue/data';
import { EnvelopeEditor } from '../components/instruments/blue-x7/envelope-editor';
import { PitchEnvelopePanel } from '../components/instruments/blue-x7/pitch-envelope-panel';
import { OperatorPanel } from '../components/instruments/blue-x7/operator-panel';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

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

    expect(
      container?.querySelector('[data-testid="envelope-handle-0"]')?.getAttribute('aria-valuenow'),
    ).toBe('90');
    expect(
      container?.querySelector('[data-testid="envelope-handle-1"]')?.getAttribute('aria-valuenow'),
    ).toBe('75');
    expect(
      container?.querySelector('[data-testid="envelope-handle-2"]')?.getAttribute('aria-valuenow'),
    ).toBe('50');
    expect(
      container?.querySelector('[data-testid="envelope-handle-3"]')?.getAttribute('aria-valuenow'),
    ).toBe('0');

    // By default, no overlapping text badges are displayed
    expect(container?.querySelectorAll('svg text')).toHaveLength(0);

    // Hovering or focusing a handle displays its tooltip
    const handle0 = container?.querySelector(
      '[data-testid="envelope-handle-0"]',
    ) as SVGCircleElement;
    act(() => {
      handle0.focus();
    });

    const tooltipText = container?.querySelector('svg text');
    expect(tooltipText).not.toBeNull();
    expect(tooltipText?.textContent).toBe('R1:50  L1:90');
    expect(tooltipText?.classList).toContain('text-role-subheadline');
    expect(tooltipText?.hasAttribute('fontSize')).toBe(false);
    expect(tooltipText?.hasAttribute('font-size')).toBe(false);

    act(() => {
      handle0.blur();
    });
    expect(container?.querySelectorAll('svg text')).toHaveLength(0);
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

    const handle0 = container?.querySelector(
      '[data-testid="envelope-handle-0"]',
    ) as SVGCircleElement;
    expect(handle0).not.toBeNull();

    // ArrowUp on Handle 0 (Level 90 -> 91)
    act(() => {
      handle0.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }),
      );
    });
    expect(onChangeStage).toHaveBeenCalledWith(0, { rate: 50, level: 91 });
    expect(onGestureStart).toHaveBeenCalled();
    expect(onGestureCommit).toHaveBeenCalled();

    // Shift + ArrowDown on Handle 0 (Level 90 -> 80)
    act(() => {
      handle0.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'ArrowDown',
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    expect(onChangeStage).toHaveBeenCalledWith(0, { rate: 50, level: 80 });

    // ArrowRight on Handle 0 (Rate 50 -> 51)
    act(() => {
      handle0.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }),
      );
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

    const handle0 = container?.querySelector(
      '[data-testid="envelope-handle-0"]',
    ) as SVGCircleElement;
    // ArrowUp at 99 stays 99
    act(() => {
      handle0.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }),
      );
    });
    expect(onChangeStage).toHaveBeenCalledWith(0, { rate: 99, level: 99 });

    const handle1 = container?.querySelector(
      '[data-testid="envelope-handle-1"]',
    ) as SVGCircleElement;
    // ArrowDown at 0 stays 0
    act(() => {
      handle1.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }),
      );
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
        <PitchEnvelopePanel pitchEnvelope={defaultEnvelope} onApplyPatch={onApplyPatch} />,
      );
    });

    const handle0 = container?.querySelector(
      '[data-testid="envelope-handle-0"]',
    ) as SVGCircleElement;
    expect(handle0).not.toBeNull();
    // jsdom does not implement pointer capture
    (handle0 as unknown as Element & { setPointerCapture: () => void }).setPointerCapture = vi.fn();
    (handle0 as unknown as Element & { releasePointerCapture: () => void }).releasePointerCapture =
      vi.fn();

    // Begin drag on stage 0
    act(() => {
      handle0.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true }));
    });

    // Several pointer moves during the gesture must not dispatch any patch.
    // jsdom getBoundingClientRect() returns zeros, so coordinates map
    // relative to the origin: level 50 => clientY ~80, rate 70 => clientX ~134.
    for (const [clientX, clientY] of [
      [100, 80],
      [118, 82],
      [134, 80],
    ] as Array<[number, number]>) {
      act(() => {
        handle0.dispatchEvent(
          new MouseEvent('pointermove', { bubbles: true, cancelable: true, clientX, clientY }),
        );
      });
    }
    expect(onApplyPatch).not.toHaveBeenCalled();

    // Releasing the pointer commits the whole drag as a single patch
    act(() => {
      handle0.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, cancelable: true }));
    });

    expect(onApplyPatch).toHaveBeenCalledTimes(1);
    expect(onApplyPatch).toHaveBeenCalledWith('Change Pitch Env Stage 1', {
      type: 'setPitchEnvelopePoint',
      stageIndex: 0,
      point: { rate: 70, level: 50 },
    });
  });

  it('still dispatches one patch per discrete keyboard edit', () => {
    const onApplyPatch = vi.fn();

    act(() => {
      root?.render(
        <PitchEnvelopePanel pitchEnvelope={defaultEnvelope} onApplyPatch={onApplyPatch} />,
      );
    });

    const handle0 = container?.querySelector(
      '[data-testid="envelope-handle-0"]',
    ) as SVGCircleElement;
    act(() => {
      handle0.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }),
      );
    });
    act(() => {
      handle0.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }),
      );
    });

    expect(onApplyPatch).toHaveBeenCalledTimes(2);
    // Discrete key edits update the active working point sequentially
    // (level 50 -> 51 -> 52), dispatching one patch per edit.
    expect(onApplyPatch).toHaveBeenLastCalledWith('Change Pitch Env Stage 1', {
      type: 'setPitchEnvelopePoint',
      stageIndex: 0,
      point: { rate: 50, level: 52 },
    });
  });

  it('live-updates numeric input fields during an in-flight drag gesture', () => {
    const onApplyPatch = vi.fn();

    act(() => {
      root?.render(
        <PitchEnvelopePanel pitchEnvelope={defaultEnvelope} onApplyPatch={onApplyPatch} />,
      );
    });

    const handle0 = container?.querySelector(
      '[data-testid="envelope-handle-0"]',
    ) as SVGCircleElement;
    const rateInput1 = container?.querySelector('#bluex7-peg-r1') as HTMLInputElement;
    const levelInput1 = container?.querySelector('#bluex7-peg-l1') as HTMLInputElement;

    expect(rateInput1.value).toBe('50');
    expect(levelInput1.value).toBe('50');

    // Start dragging handle 0
    act(() => {
      handle0.dispatchEvent(
        new MouseEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1 }),
      );
    });

    // Move pointer during drag
    act(() => {
      handle0.dispatchEvent(
        new MouseEvent('pointermove', {
          bubbles: true,
          cancelable: true,
          clientX: 134,
          clientY: 80,
        }),
      );
    });

    // Numeric inputs must immediately reflect in-flight drag values before commit
    expect(rateInput1.value).toBe('70');
    expect(levelInput1.value).toBe('50');
    expect(onApplyPatch).not.toHaveBeenCalled();

    // Release pointer to commit
    act(() => {
      handle0.dispatchEvent(
        new MouseEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 1 }),
      );
    });

    expect(onApplyPatch).toHaveBeenCalledTimes(1);
  });

  it('cancels staged gesture on pointercancel without dispatching a patch', () => {
    const onApplyPatch = vi.fn();

    act(() => {
      root?.render(
        <PitchEnvelopePanel pitchEnvelope={defaultEnvelope} onApplyPatch={onApplyPatch} />,
      );
    });

    const handle0 = container?.querySelector(
      '[data-testid="envelope-handle-0"]',
    ) as SVGCircleElement;
    (handle0 as unknown as Element & { setPointerCapture: () => void }).setPointerCapture = vi.fn();
    (handle0 as unknown as Element & { releasePointerCapture: () => void }).releasePointerCapture =
      vi.fn();

    // Begin drag on stage 0
    act(() => {
      handle0.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true }));
    });

    // Move pointer
    act(() => {
      handle0.dispatchEvent(
        new MouseEvent('pointermove', {
          bubbles: true,
          cancelable: true,
          clientX: 60,
          clientY: 40,
        }),
      );
    });
    expect(onApplyPatch).not.toHaveBeenCalled();

    // Cancel pointer
    act(() => {
      handle0.dispatchEvent(new MouseEvent('pointercancel', { bubbles: true, cancelable: true }));
    });
    expect(onApplyPatch).not.toHaveBeenCalled();

    // Subsequent pointerup must not dispatch
    act(() => {
      handle0.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, cancelable: true }));
    });
    expect(onApplyPatch).not.toHaveBeenCalled();
  });

  it('cancels staged gesture when panel becomes inactive without dispatching a patch', () => {
    const onApplyPatch = vi.fn();
    const releaseCapture = vi.fn();

    act(() => {
      root?.render(
        <PitchEnvelopePanel
          pitchEnvelope={defaultEnvelope}
          active={true}
          onApplyPatch={onApplyPatch}
        />,
      );
    });

    const handle0 = container?.querySelector(
      '[data-testid="envelope-handle-0"]',
    ) as SVGCircleElement;
    (handle0 as unknown as Element & { setPointerCapture: () => void }).setPointerCapture = vi.fn();
    (handle0 as unknown as Element & { releasePointerCapture: () => void }).releasePointerCapture =
      releaseCapture;

    // Begin drag on stage 0
    act(() => {
      handle0.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true }));
      handle0.dispatchEvent(
        new MouseEvent('pointermove', {
          bubbles: true,
          cancelable: true,
          clientX: 60,
          clientY: 40,
        }),
      );
    });
    expect(onApplyPatch).not.toHaveBeenCalled();

    // Deactivate panel (e.g. user switches top-level tab)
    act(() => {
      root?.render(
        <PitchEnvelopePanel
          pitchEnvelope={defaultEnvelope}
          active={false}
          onApplyPatch={onApplyPatch}
        />,
      );
    });

    // No patch dispatched
    expect(onApplyPatch).not.toHaveBeenCalled();
    expect(releaseCapture).toHaveBeenCalledTimes(1);

    // A late pointer-up after deactivation must remain inert.
    act(() => {
      handle0.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, cancelable: true }));
    });
    expect(onApplyPatch).not.toHaveBeenCalled();
  });

  it('releases operator gesture capture when switching operator tabs', () => {
    const onApplyPatch = vi.fn();
    const voice = createDefaultBlueX7Voice();

    act(() => {
      root?.render(
        <OperatorPanel
          operators={voice.operators}
          operatorEnabled={voice.common.operatorEnabled}
          active={true}
          onApplyPatch={onApplyPatch}
        />,
      );
    });

    const handle0 = container?.querySelector(
      '[data-testid="envelope-handle-0"]',
    ) as SVGCircleElement;
    const releaseCapture = vi.fn();
    (handle0 as unknown as Element & { setPointerCapture: () => void }).setPointerCapture = vi.fn();
    (handle0 as unknown as Element & { releasePointerCapture: () => void }).releasePointerCapture =
      releaseCapture;

    act(() => {
      handle0.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true }));
      handle0.dispatchEvent(
        new MouseEvent('pointermove', {
          bubbles: true,
          cancelable: true,
          clientX: 134,
          clientY: 80,
        }),
      );
    });

    const op2Tab = container?.querySelector('[data-testid="operator-tab-2"]') as HTMLButtonElement;
    act(() => {
      op2Tab.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    expect(releaseCapture).toHaveBeenCalledTimes(1);
    act(() => {
      handle0.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, cancelable: true }));
    });
    expect(onApplyPatch).not.toHaveBeenCalled();
  });

  it('safely releases pointer capture and clears drag on unmount', () => {
    const onApplyPatch = vi.fn();
    const releaseCapture = vi.fn();

    act(() => {
      root?.render(
        <PitchEnvelopePanel pitchEnvelope={defaultEnvelope} onApplyPatch={onApplyPatch} />,
      );
    });

    const handle0 = container?.querySelector(
      '[data-testid="envelope-handle-0"]',
    ) as SVGCircleElement;
    (handle0 as unknown as Element & { setPointerCapture: () => void }).setPointerCapture = vi.fn();
    (handle0 as unknown as Element & { releasePointerCapture: () => void }).releasePointerCapture =
      releaseCapture;

    // Begin drag
    act(() => {
      handle0.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true }));
    });

    // Unmount while drag is in flight
    act(() => {
      root?.unmount();
    });

    expect(onApplyPatch).not.toHaveBeenCalled();
  });

  it('calculates cumulative X coordinates across multiple stages accurately', () => {
    act(() => {
      root?.render(
        <EnvelopeEditor
          envelope={[
            { rate: 50, level: 50 },
            { rate: 50, level: 50 },
            { rate: 50, level: 50 },
            { rate: 50, level: 50 },
          ]}
          onChangeStage={vi.fn()}
        />,
      );
    });

    const handle0 = container?.querySelector(
      '[data-testid="envelope-handle-0"]',
    ) as SVGCircleElement;
    const handle1 = container?.querySelector(
      '[data-testid="envelope-handle-1"]',
    ) as SVGCircleElement;
    const handle2 = container?.querySelector(
      '[data-testid="envelope-handle-2"]',
    ) as SVGCircleElement;
    const handle3 = container?.querySelector(
      '[data-testid="envelope-handle-3"]',
    ) as SVGCircleElement;

    // stageMaxWidth = 144. Stage 0 targetX = 32 + (50/99)*144 = 104.7
    // Stage 1 targetX = 104.7 + (50/99)*144 = 177.4
    // Stage 2 targetX = 177.4 + (50/99)*144 = 250.2
    // Stage 3 targetX = 250.2 + (50/99)*144 = 322.9
    const cx0 = parseFloat(handle0.getAttribute('cx') ?? '0');
    const cx1 = handle1 ? parseFloat(handle1.getAttribute('cx') ?? '0') : 0;
    const cx2 = handle2 ? parseFloat(handle2.getAttribute('cx') ?? '0') : 0;
    const cx3 = handle3 ? parseFloat(handle3.getAttribute('cx') ?? '0') : 0;

    expect(cx0).toBeGreaterThan(32);
    expect(cx1).toBeGreaterThan(cx0);
    expect(cx2).toBeGreaterThan(cx1);
    expect(cx3).toBeGreaterThan(cx2);
  });

  it('updates OperatorPanel numeric inputs live during drag and applies patch on release', () => {
    const onApplyPatch = vi.fn();
    const voice = createDefaultBlueX7Voice();

    act(() => {
      root?.render(
        <OperatorPanel
          instanceId="test-ops"
          active={true}
          operators={voice.operators}
          operatorEnabled={voice.common.operatorEnabled}
          effectiveValues={new Map()}
          onVisibleOperatorChange={vi.fn()}
          onApplyPatch={onApplyPatch}
        />,
      );
    });

    const handle0 = container?.querySelector(
      '[data-testid="envelope-handle-0"]',
    ) as SVGCircleElement;
    const rateInput1 = container?.querySelector('#bluex7-op-r1') as HTMLInputElement;
    const levelInput1 = container?.querySelector('#bluex7-op-l1') as HTMLInputElement;

    expect(handle0).not.toBeNull();
    expect(rateInput1).not.toBeNull();
    expect(levelInput1).not.toBeNull();

    // Start dragging Op 1 Stage 1 handle
    act(() => {
      handle0.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true }));
      handle0.dispatchEvent(
        new MouseEvent('pointermove', {
          bubbles: true,
          cancelable: true,
          clientX: 134,
          clientY: 80,
        }),
      );
    });

    // In-flight input values reflect drag
    expect(rateInput1.value).toBe('70');
    expect(levelInput1.value).toBe('50');
    expect(onApplyPatch).not.toHaveBeenCalled();

    // Release drag
    act(() => {
      handle0.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, cancelable: true }));
    });

    expect(onApplyPatch).toHaveBeenCalledTimes(1);
    expect(onApplyPatch).toHaveBeenCalledWith('Change Op 1 Env Stage 1', {
      type: 'setOperatorEnvelopePoint',
      operatorIndex: 0,
      stageIndex: 0,
      point: { rate: 70, level: 50 },
    });
  });
});
