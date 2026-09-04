// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import AutomationTargetMenu from '../components/workbench/panels/score/automation/AutomationTargetMenu';
import AutomationLineView from '../components/workbench/panels/score/automation/AutomationLineView';
import { HostDocumentContext } from '../hooks/use-host-document';
import type {
  AutomationParameterSnapshot,
  AutomationTargetGroupSnapshot,
  AutomationTargetSnapshot,
  ScoreAutomationLayerRef,
  ScoreLayerAutomationSnapshot,
} from '../../shared/project-editor';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const popout = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'https://popout.test',
});
const popoutDoc = popout.window.document;
const PopoutMouseEvent = popout.window.MouseEvent;
const PopoutPointerEvent = popout.window.PointerEvent ?? popout.window.MouseEvent;

function makePopoutPointerEvent(type: string, init: MouseEventInit = {}): Event {
  const event = new PopoutPointerEvent(type, { bubbles: true, ...init });
  Object.defineProperty(event, 'pointerType', { configurable: true, value: 'mouse' });
  return event;
}

if (!popout.window.Element.prototype.hasPointerCapture) {
  popout.window.Element.prototype.hasPointerCapture = () => false;
}
if (!popout.window.Element.prototype.releasePointerCapture) {
  popout.window.Element.prototype.releasePointerCapture = () => {};
}

const layerRef: ScoreAutomationLayerRef = {
  rootGroupIndex: 0,
  groupId: 'group-1',
  layerId: 'layer-1',
  layerIndex: 0,
  layerKind: 'soundObject',
};

const target: AutomationTargetSnapshot = {
  parameterId: 'p-freq',
  label: 'Frequency',
  sourceKind: 'instrument',
  automationEnabled: false,
  assignmentState: 'available',
};

const automation: ScoreLayerAutomationSnapshot = {
  layerId: layerRef.layerId,
  layerKind: layerRef.layerKind,
  parameterIds: [],
  selectedParameterId: undefined,
  parameters: [],
  targetGroups: [
    {
      groupId: 'instrument',
      label: 'Instrument',
      targets: [],
      subGroups: [
        {
          groupId: 'instrument-1',
          label: '1) Synth',
          targets: [target],
          subGroups: [],
        },
      ],
    } satisfies AutomationTargetGroupSnapshot,
  ],
  missingParameterIds: [],
};

describe('AutomationTargetMenu in a floated panel', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    host = popoutDoc.createElement('div');
    popoutDoc.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    popoutDoc.body.innerHTML = '';
  });

  it('commits a nested sound-object parameter and closes the popout menu', async () => {
    const onPatch = vi.fn();
    act(() => {
      root.render(
        <HostDocumentContext.Provider value={popoutDoc}>
          <AutomationTargetMenu
            trigger={<button type="button">A</button>}
            automation={automation}
            layerRef={layerRef}
            onPatch={onPatch}
          />
        </HostDocumentContext.Provider>,
      );
    });

    const trigger = host.querySelector('button')!;
    await act(async () => {
      trigger.dispatchEvent(makePopoutPointerEvent('pointerdown', { button: 0 }));
      trigger.dispatchEvent(new PopoutMouseEvent('click', { bubbles: true, button: 0 }));
      await Promise.resolve();
    });

    const groupTrigger = [...popoutDoc.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
      (item) => item.textContent?.trim() === '1) Synth',
    );
    expect(groupTrigger).toBeTruthy();

    await act(async () => {
      groupTrigger!.dispatchEvent(
        makePopoutPointerEvent('pointermove', {
          clientX: 30,
          clientY: 30,
        }),
      );
      await new Promise((resolve) => setTimeout(resolve, 150));
    });

    const parameterItem = [...popoutDoc.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
      (item) => item.textContent?.trim() === target.label,
    );
    expect(parameterItem).toBeTruthy();

    await act(async () => {
      parameterItem!.click();
      await Promise.resolve();
    });

    expect(onPatch).toHaveBeenCalledWith({
      type: 'assignAutomationToLayer',
      layer: layerRef,
      parameterId: target.parameterId,
      enableAutomation: true,
    });
    expect(popoutDoc.querySelector('[role="menu"]')).toBeNull();
  });
});

class MockResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
(globalThis as unknown as { ResizeObserver: typeof MockResizeObserver }).ResizeObserver =
  MockResizeObserver;

describe('AutomationLineView point readout (spec 090)', () => {
  let host: HTMLDivElement;
  let root: Root;

  const setViewport = (win: Window, doc: Document, width: number, height: number) => {
    Object.defineProperty(win, 'innerWidth', { configurable: true, value: width });
    Object.defineProperty(win, 'innerHeight', { configurable: true, value: height });
    for (const element of [doc.documentElement, doc.body]) {
      Object.defineProperty(element, 'clientWidth', { configurable: true, get: () => width });
      Object.defineProperty(element, 'clientHeight', { configurable: true, get: () => height });
    }
  };

  const makeParameter = (
    points: Array<{ time: number; value: number }>,
  ): AutomationParameterSnapshot => ({
    parameterId: 'p-readout',
    name: 'Frequency',
    label: 'Hz',
    displayName: 'Frequency',
    minimum: 0,
    maximum: 1,
    resolutionDecimal: '-1',
    resolution: -1,
    curve: 'LINEAR',
    fixedValue: 0,
    automationEnabled: true,
    lineColor: 0x20dd00,
    sourceKind: 'instrument',
    targetPath: ['instr 1', 'Frequency'],
    points,
  });

  /** Renders the line view inside a clipping timeline row hosted by `doc`. */
  const renderInRow = (parameter: AutomationParameterSnapshot, doc: Document): HTMLDivElement => {
    const rowRef = { current: null as HTMLDivElement | null };
    act(() => {
      root.render(
        <HostDocumentContext.Provider value={doc}>
          <div
            ref={(el) => {
              rowRef.current = el;
            }}
            style={{ overflow: 'hidden', width: 240, height: 40 }}
          >
            <AutomationLineView
              parameter={parameter}
              pixelsPerBeat={40}
              active
              mode="singleLine"
              selectedPointIndex={0}
            />
          </div>
        </HostDocumentContext.Provider>,
      );
    });
    const row = rowRef.current!;
    const rowRect = () => ({
      left: 0,
      top: 60,
      right: 240,
      bottom: 100,
      width: 240,
      height: 40,
      x: 0,
      y: 60,
      toJSON: () => undefined,
    });
    Object.defineProperty(row, 'getBoundingClientRect', { configurable: true, value: rowRect });
    const svg = row.querySelector('svg');
    if (svg) {
      Object.defineProperty(svg, 'getBoundingClientRect', { configurable: true, value: rowRect });
    }
    return row;
  };

  const flushFrame = async () => {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  };

  const READOUT_WIDTH = 120;
  const READOUT_HEIGHT = 40;

  beforeEach(() => {
    // The smallest supported host-panel size (plan decision for SC-005).
    setViewport(popout.window, popoutDoc, 240, 160);
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    popoutDoc.body.innerHTML = '';
  });

  it('renders the readout outside the clipping row, in the host document, with parity content', async () => {
    // time 5.5 @ 40px/beat -> x=220 near the right edge; value 0.9 near the
    // top of the row: both classic clipping positions.
    const row = renderInRow(makeParameter([{ time: 5.5, value: 0.9 }]), popoutDoc);
    await flushFrame();

    const readout = popoutDoc.body.querySelector<HTMLElement>('[data-host-surface]');
    expect(readout).toBeTruthy();
    expect(row.contains(readout)).toBe(false); // escaped the overflow-hidden row
    expect(readout!.textContent).toContain('x: 5.5');
    expect(readout!.textContent).toContain('y: 0.9 Hz'); // label appended (Java parity)
    expect(readout!.style.pointerEvents).toBe('none'); // informational only (Story 2.4)
  });

  it('flips the readout to the opposite side near the right edge (Java drawPointInformation parity)', async () => {
    renderInRow(makeParameter([{ time: 5.5, value: 0.9 }]), popoutDoc);
    await flushFrame();

    const readout = popoutDoc.body.querySelector<HTMLElement>('[data-host-surface]')!;
    Object.defineProperty(readout, 'offsetWidth', { configurable: true, get: () => READOUT_WIDTH });
    Object.defineProperty(readout, 'offsetHeight', {
      configurable: true,
      get: () => READOUT_HEIGHT,
    });
    // One more frame so the measured size participates in collision.
    act(() => {
      popout.window.dispatchEvent(new popout.window.Event('resize'));
    });
    await flushFrame();

    expect(readout.dataset.placement).toBe('left'); // opposite side of the point
    const left = Number.parseInt(readout.style.left, 10);
    expect(left + READOUT_WIDTH).toBeLessThanOrEqual(240 - 8);
    expect(left).toBeGreaterThanOrEqual(8);
    expect(Number.parseInt(readout.style.top, 10)).toBeGreaterThanOrEqual(8);
  });

  it('renders into the MAIN document when the panel is docked', async () => {
    setViewport(window, document, 240, 160);
    renderInRow(makeParameter([{ time: 2, value: 0.5 }]), document);
    await flushFrame();

    expect(document.body.querySelector('[data-host-surface]')).toBeTruthy();
    expect(popoutDoc.body.querySelector('[data-host-surface]')).toBeNull();
  });

  it('removes the readout from every document when the panel unmounts (SC-003)', async () => {
    renderInRow(makeParameter([{ time: 2, value: 0.5 }]), popoutDoc);
    await flushFrame();
    expect(popoutDoc.body.querySelector('[data-host-surface]')).toBeTruthy();

    act(() => root.unmount());
    expect(popoutDoc.body.querySelector('[data-host-surface]')).toBeNull();
    expect(document.body.querySelector('[data-host-surface]')).toBeNull();
  });
});
