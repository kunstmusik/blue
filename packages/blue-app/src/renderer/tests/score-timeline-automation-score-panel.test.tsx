// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import type { AutomationTargetGroupSnapshot } from '../../shared/project-editor';
import ScorePanel from '../components/workbench/panels/ScorePanel';
import { HostDocumentContext } from '../hooks/use-host-document';
import { __testClearPendingPatches, useProjectStore } from '../stores/project-store';
import { useLayerSelectionStore } from '../stores/layer-selection-store';
import { createEmptyProjectEditorSnapshot } from '../../shared/project-editor';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

class MockResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

(globalThis as unknown as { ResizeObserver: typeof MockResizeObserver }).ResizeObserver =
  MockResizeObserver;

const { mockScorePathState } = vi.hoisted(() => ({
  mockScorePathState: {
    session: {
      activeGroupId: null,
      segments: [{ groupId: null, label: 'Root' }],
      scrollByGroupId: {},
    } as any,
    scrollContainerRef: { current: null },
    navigateToGroup: vi.fn(),
    navigateToRoot: vi.fn(),
    navigateToSegment: vi.fn(),
    resetSession: vi.fn(),
  },
}));

vi.mock('../components/workbench/panels/score/useScorePathState', () => ({
  useScorePathState: () => mockScorePathState,
}));

describe('ScorePanel sound-object automation in a popout', () => {
  let popout: JSDOM;
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    useProjectStore.getState().clearProject();
    useLayerSelectionStore.getState().clear();
    __testClearPendingPatches();
    mockScorePathState.session = {
      activeGroupId: null,
      segments: [{ groupId: null, label: 'Root' }],
      scrollByGroupId: {},
    } as any;

    const snapshot = createEmptyProjectEditorSnapshot();
    const target: AutomationTargetGroupSnapshot = {
      groupId: 'instr-1',
      label: '1) Synth',
      subGroups: [],
      targets: [
        {
          parameterId: 'synth-frequency',
          label: 'Frequency',
          sourceKind: 'instrument',
          automationEnabled: false,
          assignmentState: 'available',
        },
      ],
    };
    snapshot.score.layerGroups = [
      {
        groupId: 'sound-group',
        groupType: 'polyObject',
        name: 'Sound Objects',
        layerCount: 1,
        isOpenableContainer: true,
        layers: [
          {
            layerId: 'sound-layer-0',
            name: 'Sound 1',
            height: 44,
            muted: false,
            solo: false,
            items: [],
            automation: {
              layerId: 'sound-layer-0',
              layerKind: 'soundObject',
              parameterIds: [],
              parameters: [],
              targetGroups: [
                {
                  groupId: 'instrument',
                  label: 'Instrument',
                  subGroups: [target],
                  targets: [],
                },
              ],
              missingParameterIds: [],
            },
          },
        ],
      },
    ];

    useProjectStore.getState().setProjectInfo({
      title: 'Test Project',
      author: 'Test Author',
      sampleRate: '44100',
      version: '2.10.0',
      filePath: '/path/to/test.blue',
      sessionId: 1,
      loaded: true,
      globalOrc: snapshot.globalOrc,
      globalSco: snapshot.globalSco,
      orchestra: { ...snapshot.orchestra, loaded: true },
      projectProperties: snapshot.projectProperties,
      transport: snapshot.transport,
      score: snapshot.score,
    });

    window.blueAPI = {
      commitProjectDocumentPatches: vi
        .fn()
        .mockResolvedValue({ changed: true, revision: 1, sessionId: 1 }),
      getProjectDocument: vi.fn().mockResolvedValue(null),
      getNestedPolyObjectSnapshot: vi.fn().mockResolvedValue(null),
    } as typeof window.blueAPI;

    popout = new JSDOM('<!doctype html><html><body></body></html>', {
      url: 'https://score-popout.test',
    });
    host = popout.window.document.createElement('div');
    popout.window.document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
    popout?.window.close();
    __testClearPendingPatches();
    useLayerSelectionStore.getState().clear();
    useProjectStore.getState().clearProject();
  });

  it('assigns a nested target and closes the menu', async () => {
    await act(async () => {
      root.render(
        <HostDocumentContext.Provider value={popout.window.document}>
          <ScorePanel />
        </HostDocumentContext.Provider>,
      );
      await Promise.resolve();
    });

    const trigger =
      popout.window.document.querySelector<HTMLButtonElement>('[title="Automation"]')!;
    const PopoutPointerEvent = popout.window.PointerEvent ?? popout.window.MouseEvent;
    act(() => {
      trigger.dispatchEvent(new PopoutPointerEvent('pointerdown', { bubbles: true, button: 0 }));
      trigger.dispatchEvent(new PopoutPointerEvent('click', { bubbles: true, button: 0 }));
    });

    const instrument = Array.from(
      popout.window.document.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    ).find((item) => item.textContent?.includes('1) Synth'))!;
    expect(instrument).toBeTruthy();

    act(() => {
      instrument.dispatchEvent(
        new PopoutPointerEvent('pointermove', { bubbles: true, pointerType: 'mouse' }),
      );
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 160));
    });

    const frequency = Array.from(
      popout.window.document.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    ).find((item) => item.textContent?.trim() === 'Frequency')!;
    expect(frequency).toBeTruthy();

    await act(async () => {
      frequency.click();
      await Promise.resolve();
    });

    expect(popout.window.document.querySelector('[role="menu"]')).toBeNull();
    expect(window.blueAPI.commitProjectDocumentPatches).toHaveBeenCalledWith([
      expect.objectContaining({
        score: expect.objectContaining({
          type: 'assignAutomationToLayer',
          parameterId: 'synth-frequency',
          layer: expect.objectContaining({
            groupId: 'sound-group',
            layerId: 'sound-layer-0',
            layerKind: 'soundObject',
          }),
        }),
      }),
    ]);
  });
});
