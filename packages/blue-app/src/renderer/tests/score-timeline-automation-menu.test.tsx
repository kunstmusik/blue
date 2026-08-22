// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import AutomationTargetMenu from '../components/workbench/panels/score/automation/AutomationTargetMenu';
import type {
  AutomationTargetSnapshot,
  ScoreAutomationLayerRef,
  ScoreAutomationPatch,
  ScoreLayerAutomationSnapshot,
} from '../../shared/project-editor';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Radix DropdownMenu relies on pointer-capture APIs that jsdom does not implement.
beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
});

function buildAutomation(): ScoreLayerAutomationSnapshot {
  const targets: AutomationTargetSnapshot[] = [
    { parameterId: 'p-avail', label: 'Freq', sourceKind: 'instrument', automationEnabled: false, assignmentState: 'available' },
    { parameterId: 'p-current', label: 'Amp', sourceKind: 'instrument', automationEnabled: true, assignmentState: 'assignedCurrentLayer' },
    { parameterId: 'p-other', label: 'Ch1 Level', sourceKind: 'mixer', automationEnabled: true, assignmentState: 'assignedOtherLayer', ownerLayerName: 'Layer 2' },
  ];
  return {
    layerId: 'layer-1',
    layerKind: 'soundObject',
    parameterIds: ['p-current'],
    selectedParameterId: 'p-current',
    parameters: [],
    targetGroups: [
      { groupId: 'instrument', label: 'Instrument', subGroups: [], targets: targets.slice(0, 2) },
      { groupId: 'mixer', label: 'Mixer', subGroups: [], targets: targets.slice(2) },
    ],
    missingParameterIds: ['p-missing'],
  };
}

const layerRef: ScoreAutomationLayerRef = {
  rootGroupIndex: 0,
  groupId: 'g0',
  layerId: 'layer-1',
  layerIndex: 0,
  layerKind: 'soundObject',
};

function buildTrackAutomation(): ScoreLayerAutomationSnapshot {
  const buildTarget = (parameterId: string, label: string): AutomationTargetSnapshot => ({
    parameterId,
    label,
    sourceKind: 'mixer',
    automationEnabled: false,
    assignmentState: 'available',
  });

  return {
    layerId: 'track-1',
    layerKind: 'track',
    parameterIds: [],
    parameters: [],
    targetGroups: [{
      groupId: 'track-channel',
      label: 'Track Channel',
      subGroups: [
        {
          groupId: 'track-channel-pre',
          label: 'Pre-Effects',
          subGroups: [{
            groupId: 'pre-filter',
            label: 'Filter',
            subGroups: [],
            targets: [buildTarget('pre-cutoff', 'Cutoff')],
          }],
          targets: [],
        },
        {
          groupId: 'track-channel-post',
          label: 'Post-Effects',
          subGroups: [{
            groupId: 'post-reverb',
            label: 'Reverb',
            subGroups: [],
            targets: [buildTarget('post-room', 'Room Size')],
          }],
          targets: [],
        },
      ],
      targets: [buildTarget('track-db', 'dB')],
    }],
    missingParameterIds: [],
  };
}

function renderMenu(automation = buildAutomation()) {
  const onPatch = vi.fn();
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  void act(() => {
    root.render(
      <AutomationTargetMenu
        trigger={<button type="button">A</button>}
        automation={automation}
        layerRef={layerRef}
        onPatch={(patch: ScoreAutomationPatch) => onPatch(patch)}
      />,
    );
  });
  return { onPatch, container, root };
}

/** Opens the Radix DropdownMenu by activating the trigger button. */
async function openMenu(container: HTMLElement) {
  const trigger = container.querySelector('button')!;
  await act(async () => {
    trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
    await Promise.resolve();
  });
}

function getMenuText(): string {
  return document.querySelector('[role="menu"]')?.textContent ?? '';
}

async function clickMenuItem(label: string) {
  const items = Array.from(document.querySelectorAll('[role="menuitem"]')) as HTMLElement[];
  const item = items.find((el) => el.textContent?.includes(label));
  await act(async () => {
    item?.click();
    await Promise.resolve();
  });
}

describe('AutomationTargetMenu', () => {
  it('shows Track channel targets directly in Pre-Effects, dB, Post-Effects order', async () => {
    const { container, root } = renderMenu(buildTrackAutomation());
    try {
      await openMenu(container);
      const text = getMenuText();
      const preIdx = text.indexOf('Pre-Effects');
      const dbIdx = text.indexOf('dB');
      const postIdx = text.indexOf('Post-Effects');
      expect(preIdx).toBeGreaterThanOrEqual(0);
      expect(dbIdx).toBeGreaterThan(preIdx);
      expect(postIdx).toBeGreaterThan(dbIdx);
    } finally {
      void act(() => {
        root.unmount();
      });
    }
  });

  it('groups instrument and mixer targets and offers Clear All / Cleanup Missing', async () => {
    const { container, root } = renderMenu();
    try {
      await openMenu(container);
      const text = getMenuText();
      expect(text).toContain('Instrument');
      expect(text).toContain('Mixer');
      expect(text).toContain('Freq');
      expect(text).toContain('Amp');
      expect(text).toContain('Ch1 Level');
      expect(text).toContain('Clear All');
      expect(text).toContain('Cleanup Missing');
    } finally {
      void act(() => {
        root.unmount();
      });
    }
  });

  it('removes the parameter when an assigned-to-current target is selected', async () => {
    const { container, onPatch, root } = renderMenu();
    try {
      await openMenu(container);
      await clickMenuItem('Amp');
      expect(onPatch).toHaveBeenCalledWith({
        type: 'removeAutomationFromLayer',
        layer: layerRef,
        parameterId: 'p-current',
      });
    } finally {
      void act(() => {
        root.unmount();
      });
    }
  });

  it('claims a parameter assigned elsewhere onto the current layer', async () => {
    const { container, onPatch, root } = renderMenu();
    try {
      await openMenu(container);
      await clickMenuItem('Ch1 Level');
      expect(onPatch).toHaveBeenCalledWith({
        type: 'assignAutomationToLayer',
        layer: layerRef,
        parameterId: 'p-other',
      });
    } finally {
      void act(() => {
        root.unmount();
      });
    }
  });

  it('enables automation when assigning an available target', async () => {
    const { container, onPatch, root } = renderMenu();
    try {
      await openMenu(container);
      await clickMenuItem('Freq');
      expect(onPatch).toHaveBeenCalledWith({
        type: 'assignAutomationToLayer',
        layer: layerRef,
        parameterId: 'p-avail',
        enableAutomation: true,
      });
    } finally {
      void act(() => {
        root.unmount();
      });
    }
  });

  it('dispatches Clear All for the current layer', async () => {
    const { container, onPatch, root } = renderMenu();
    try {
      await openMenu(container);
      await clickMenuItem('Clear All');
      expect(onPatch).toHaveBeenCalledWith({ type: 'clearLayerAutomations', layer: layerRef });
    } finally {
      void act(() => {
        root.unmount();
      });
    }
  });
});
