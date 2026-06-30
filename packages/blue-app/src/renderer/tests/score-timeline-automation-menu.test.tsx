// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import AutomationTargetMenu from '../components/workbench/panels/score/automation/AutomationTargetMenu';
import type {
  AutomationTargetSnapshot,
  ScoreAutomationLayerRef,
  ScoreAutomationPatch,
  ScoreLayerAutomationSnapshot,
} from '../../shared/project-editor';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

function renderMenu() {
  const onPatch = vi.fn();
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  void act(() => {
    root.render(
      <AutomationTargetMenu
        automation={buildAutomation()}
        layerRef={layerRef}
        onPatch={(patch: ScoreAutomationPatch) => onPatch(patch)}
      />,
    );
  });
  return { onPatch, container, root };
}

function clickTarget(container: HTMLElement, label: string) {
  const spans = Array.from(container.querySelectorAll('span')) as HTMLElement[];
  const span = spans.find((s) => s.textContent === label && s.className.includes('flex-1'));
  span?.parentElement?.click();
}

function clickByText(container: HTMLElement, text: string) {
  const els = Array.from(container.querySelectorAll('div')) as HTMLElement[];
  els.find((el) => el.textContent?.trim() === text)?.click();
}

describe('AutomationTargetMenu', () => {
  it('groups instrument and mixer targets and offers Clear All / Cleanup Missing', () => {
    const { container, root } = renderMenu();
    try {
      const text = container.textContent ?? '';
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

  it('removes the parameter when an assigned-to-current target is selected', () => {
    const { container, onPatch, root } = renderMenu();
    try {
      clickTarget(container, 'Amp');
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

  it('claims a parameter assigned elsewhere onto the current layer', () => {
    const { container, onPatch, root } = renderMenu();
    try {
      clickTarget(container, 'Ch1 Level');
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

  it('enables automation when assigning an available target', () => {
    const { container, onPatch, root } = renderMenu();
    try {
      clickTarget(container, 'Freq');
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

  it('dispatches Clear All for the current layer', () => {
    const { container, onPatch, root } = renderMenu();
    try {
      clickByText(container, 'Clear All');
      expect(onPatch).toHaveBeenCalledWith({ type: 'clearLayerAutomations', layer: layerRef });
    } finally {
      void act(() => {
        root.unmount();
      });
    }
  });
});
