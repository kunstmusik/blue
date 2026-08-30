// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useBlueX7EffectiveValues } from '../components/instruments/blue-x7/use-blue-x7-effective-values';
import { NextNoteBadge } from '../components/instruments/blue-x7/next-note-badge';
import { CommonPanel } from '../components/instruments/blue-x7/common-panel';
import { BlueX7Editor } from '../components/instruments/blue-x7-editor';
import type { BlueX7Voice } from '@blue/data';
import { createDefaultBlueX7Voice } from '@blue/data';
import type { BlueX7InstrumentSnapshot, BlueX7Patch } from '../../shared/project-editor';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type ProbeProps = Parameters<typeof useBlueX7EffectiveValues>[0];

function HookProbe(props: ProbeProps): React.ReactElement {
  const state = useBlueX7EffectiveValues(props);
  return React.createElement(
    'div',
    { 'data-testid': 'hook-probe', 'data-size': String(state.values.size) },
    JSON.stringify([...state.values.entries()]),
  );
}

describe('next-note catalog labels (Spec 092 FR-012)', () => {
  it('renders a next-note badge element', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(React.createElement(NextNoteBadge, { semanticKey: 'common.algorithm' }));
    });
    const badge = container.querySelector('[data-testid="bluex7-next-note-badge"]');
    expect(badge?.textContent).toBe('next note');
    act(() => root.unmount());
    container.remove();
  });

  it('labels algorithm and shared oscillator sync as next-note in the common panel', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const voice: BlueX7Voice = createDefaultBlueX7Voice();
    act(() => {
      root.render(
        React.createElement(CommonPanel, {
          common: voice.common,
          onApplyPatch: () => undefined,
        }),
      );
    });
    const badges = container.querySelectorAll('[data-testid="bluex7-next-note-badge"]');
    expect(badges.length).toBe(2);
    // the labels they attach to are the algorithm select and the shared sync
    expect(container.querySelector('label[for="bluex7-algorithm"]')?.textContent).toContain('next note');
    expect(container.querySelector('input[aria-label="Shared Oscillator Sync"]')).not.toBeNull();
    act(() => root.unmount());
    container.remove();
  });
});

describe('useBlueX7EffectiveValues (Spec 092 FR-014)', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  const getBlueX7EffectiveValues = vi.fn();

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    getBlueX7EffectiveValues.mockReset();
    (window as unknown as { blueAPI: unknown }).blueAPI = { getBlueX7EffectiveValues };
    vi.useFakeTimers();
  });

  afterEach(async () => {
    await act(async () => {
      root?.unmount();
    });
    container?.remove();
    container = null;
    root = null;
    vi.useRealTimers();
  });

  const assignmentTarget = { assignmentId: '1' } as const;
  const baseProps: ProbeProps = {
    target: assignmentTarget,
    projectSessionId: 5,
    parameterIds: ['param-a', 'param-b'],
    enabled: true,
  };

  it('polls visible controls and exposes accepted values as display state', async () => {
    getBlueX7EffectiveValues.mockResolvedValue({
      ok: true,
      projectSessionId: 5,
      ownerIdentity: 'arrangement:1',
      engineSequence: 3,
      values: [{ parameterId: 'param-a', value: 42 }],
    });
    await act(async () => {
      root?.render(React.createElement(HookProbe, baseProps));
      await Promise.resolve();
    });
    expect(getBlueX7EffectiveValues).toHaveBeenCalledTimes(1);
    expect(getBlueX7EffectiveValues).toHaveBeenCalledWith({
      target: assignmentTarget,
      projectSessionId: 5,
      parameterIds: ['param-a', 'param-b'],
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    // 20 Hz polling: ~2 more ticks inside 100 ms
    expect(getBlueX7EffectiveValues.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(container?.querySelector('[data-testid="hook-probe"]')?.getAttribute('data-size')).toBe('1');
  });

  it('keeps at most one request in flight', async () => {
    let resolveFirst: (value: unknown) => void = () => undefined;
    getBlueX7EffectiveValues.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );
    await act(async () => {
      root?.render(React.createElement(HookProbe, baseProps));
      await Promise.resolve();
    });
    expect(getBlueX7EffectiveValues).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    // the first request never resolved, so no further request may start
    expect(getBlueX7EffectiveValues).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveFirst({
        ok: true,
        projectSessionId: 5,
        ownerIdentity: 'arrangement:1',
        engineSequence: 1,
        values: [],
      });
      await Promise.resolve();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(getBlueX7EffectiveValues.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('discards late responses after the editor target changes', async () => {
    const resolvers: Array<(value: unknown) => void> = [];
    getBlueX7EffectiveValues.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve);
        }),
    );
    await act(async () => {
      root?.render(React.createElement(HookProbe, baseProps));
      await Promise.resolve();
    });

    // retarget to another owner while the first request is in flight
    await act(async () => {
      root?.render(
        React.createElement(HookProbe, {
          ...baseProps,
          target: { assignmentId: '2' },
        }),
      );
      await Promise.resolve();
    });
    expect(resolvers.length).toBeGreaterThanOrEqual(2);
    // resolve ONLY the stale first request (the old owner's response arrives
    // late, after the editor retargeted)
    await act(async () => {
      resolvers[0]({
        ok: true,
        projectSessionId: 5,
        ownerIdentity: 'arrangement:1',
        engineSequence: 9,
        values: [{ parameterId: 'param-a', value: 99 }],
      });
      await Promise.resolve();
    });
    // the stale response must never be shown
    expect(container?.querySelector('[data-testid="hook-probe"]')?.getAttribute('data-size')).toBe('0');
  });

  it('reports unavailability without mutating project state or showing values', async () => {
    getBlueX7EffectiveValues.mockResolvedValue({ ok: false, reason: 'not-playing' });
    const onApplyPatch = vi.fn();
    await act(async () => {
      root?.render(
        React.createElement(CommonPanel, {
          common: createDefaultBlueX7Voice().common,
          onApplyPatch: (description: string, patch: BlueX7Patch) => onApplyPatch(description, patch),
        }),
      );
      root?.render(React.createElement(HookProbe, baseProps));
      await Promise.resolve();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(getBlueX7EffectiveValues).toHaveBeenCalled();
    // readback never dispatches project patches (disposable display state)
    expect(onApplyPatch).not.toHaveBeenCalled();
  });

  it('overlays automated engine values without dispatching a durable patch', async () => {
    const onInstrumentPatch = vi.fn();
    const snapshot: BlueX7InstrumentSnapshot = {
      assignmentId: '1',
      type: 'blueX7',
      name: 'Live X7',
      enabled: true,
      comment: '',
      voice: createDefaultBlueX7Voice(),
      parameters: [{
        parameterId: 'feedback-id',
        semanticKey: 'common.feedback',
        fixedValue: 0,
        automationEnabled: true,
      }],
    };
    getBlueX7EffectiveValues.mockResolvedValue({
      ok: true,
      projectSessionId: 5,
      ownerIdentity: 'arrangement:1',
      engineSequence: 4,
      values: [{ parameterId: 'feedback-id', value: 6 }],
    });

    await act(async () => {
      root?.render(React.createElement(BlueX7Editor, {
        instrument: snapshot,
        onInstrumentPatch,
        effectiveValues: {
          target: assignmentTarget,
          projectSessionId: 5,
          enabled: true,
        },
      }));
      await Promise.resolve();
    });

    expect((container?.querySelector('#bluex7-feedback') as HTMLInputElement).value).toBe('6');
    expect(onInstrumentPatch).not.toHaveBeenCalled();
  });
});

describe('catalog-derived widget domains (Spec 092 T088)', () => {
  function setInputValue(input: HTMLInputElement, value: string): void {
    const tracker = (input as unknown as { _valueTracker?: { setValue: (v: string) => void } })._valueTracker;
    if (tracker) {
      tracker.setValue('');
    }
    const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
    descriptor?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  it('clamps widget gestures to the parameter catalog domain', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const onApplyPatch = vi.fn<(description: string, patch: BlueX7Patch) => void>();
    act(() => {
      root.render(
        React.createElement(CommonPanel, {
          common: createDefaultBlueX7Voice().common,
          onApplyPatch: (description, patch) => onApplyPatch(description, patch),
        }),
      );
    });

    const feedback = container.querySelector<HTMLInputElement>('input[aria-label="Feedback"]');
    expect(feedback).not.toBeNull();
    expect(feedback!.min).toBe('0');
    expect(feedback!.max).toBe('7');
    act(() => setInputValue(feedback!, '99'));
    expect(onApplyPatch).toHaveBeenCalledTimes(1);
    expect(onApplyPatch.mock.calls[0]![1]).toEqual({ type: 'setCommonField', field: 'feedback', value: 7 });

    // Transpose shows centered semitones derived from the stored 0..48 domain.
    const transpose = container.querySelector<HTMLInputElement>('input[aria-label="Key Transpose"]');
    expect(transpose!.min).toBe('-24');
    expect(transpose!.max).toBe('24');
    act(() => setInputValue(transpose!, '99'));
    expect(onApplyPatch.mock.calls[1]![1]).toEqual({ type: 'setCommonField', field: 'keyTranspose', value: 48 });

    const pms = container.querySelector<HTMLInputElement>('input[aria-label="Shared Pitch Modulation Sensitivity"]');
    act(() => setInputValue(pms!, '9'));
    expect(onApplyPatch.mock.calls[2]![1]).toEqual({ type: 'setSharedPitchModulationSensitivity', value: 7 });

    act(() => root.unmount());
    container.remove();
  });
});
