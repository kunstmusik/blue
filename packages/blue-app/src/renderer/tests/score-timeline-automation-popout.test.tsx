// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import AutomationTargetMenu from '../components/workbench/panels/score/automation/AutomationTargetMenu';
import { HostDocumentContext } from '../hooks/use-host-document';
import type {
  AutomationTargetGroupSnapshot,
  AutomationTargetSnapshot,
  ScoreAutomationLayerRef,
  ScoreLayerAutomationSnapshot,
} from '../../shared/project-editor';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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
  targetGroups: [{
    groupId: 'instrument',
    label: 'Instrument',
    targets: [],
    subGroups: [{
      groupId: 'instrument-1',
      label: '1) Synth',
      targets: [target],
      subGroups: [],
    }],
  } satisfies AutomationTargetGroupSnapshot],
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

    const groupTrigger = [...popoutDoc.querySelectorAll<HTMLElement>('[role="menuitem"]')]
      .find((item) => item.textContent?.trim() === '1) Synth');
    expect(groupTrigger).toBeTruthy();

    await act(async () => {
      groupTrigger!.dispatchEvent(makePopoutPointerEvent('pointermove', {
        clientX: 30,
        clientY: 30,
      }));
      await new Promise((resolve) => setTimeout(resolve, 150));
    });

    const parameterItem = [...popoutDoc.querySelectorAll<HTMLElement>('[role="menuitem"]')]
      .find((item) => item.textContent?.trim() === target.label);
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
