// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ScorePanel from '../components/workbench/panels/ScorePanel';
import { useProjectStore } from '../stores/project-store';
import { useLayerSelectionStore } from '../stores/layer-selection-store';
import { useScoreSelectionStore } from '../stores/score-selection-store';
import { createEmptyProjectEditorSnapshot } from '../../shared/project-editor';
import type { AutomationParameterSnapshot } from '../../shared/project-editor';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

class MockResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

(globalThis as unknown as { ResizeObserver: typeof MockResizeObserver }).ResizeObserver = MockResizeObserver;

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

function seedProjectWithAutomation(param: AutomationParameterSnapshot): void {
  const snapshot = createEmptyProjectEditorSnapshot();
  snapshot.score.layerGroups = [
    {
      groupId: 'sound-group',
      groupType: 'polyObject',
      name: 'SoundObjects',
      layerCount: 1,
      isOpenableContainer: true,
      layers: [
        {
          layerId: 'sound-layer-0',
          layerSelectionId: 'lsel-sound-0',
          name: 'Sound 1',
          height: 44,
          muted: false,
          solo: false,
          items: [],
          automation: {
            layerId: 'sound-layer-0',
            layerKind: 'soundObject',
            parameterIds: [param.parameterId],
            selectedParameterId: param.parameterId,
            parameters: [param],
            targetGroups: [],
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
}

describe('SoundLayerHeader automation parameter display and tooltip', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    useProjectStore.getState().clearProject();
    useLayerSelectionStore.getState().clear();
    useScoreSelectionStore.getState().clearSelection();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    useProjectStore.getState().clearProject();
    useLayerSelectionStore.getState().clear();
    useScoreSelectionStore.getState().clearSelection();
  });

  it('renders the parameter name and path tooltip for instrument parameters', () => {
    const param: AutomationParameterSnapshot = {
      parameterId: 'param-1',
      name: 'chorus_mode',
      label: '',
      displayName: 'chorus_mode',
      minimum: 0,
      maximum: 1,
      resolutionDecimal: '-1',
      resolution: -1,
      curve: 'LINEAR',
      fixedValue: 0.5,
      automationEnabled: true,
      lineColor: 0x00ff00,
      sourceKind: 'instrument',
      targetPath: ['instr 1', 'chorus_mode'],
      points: [],
    };

    seedProjectWithAutomation(param);

    act(() => {
      root.render(<ScorePanel />);
    });

    const header = container.querySelector<HTMLElement>('[data-layer-id="sound-layer-0"]')!;
    expect(header).toBeTruthy();

    const paramSpan = header.querySelector<HTMLSpanElement>('span.max-w-\\[70px\\]')!;
    expect(paramSpan).toBeTruthy();
    expect(paramSpan.textContent).toBe('chorus_mode');
    expect(paramSpan.getAttribute('title')).toBe('instr 1 > chorus_mode');
  });

  it('renders the parameter name and path tooltip for mixer parameters', () => {
    const param: AutomationParameterSnapshot = {
      parameterId: 'mixer-vol',
      name: 'Volume',
      label: 'dB',
      displayName: 'dB',
      minimum: -96,
      maximum: 12,
      resolutionDecimal: '0.1',
      resolution: 0.1,
      curve: 'LINEAR',
      fixedValue: 0,
      automationEnabled: true,
      lineColor: 0x0000ff,
      sourceKind: 'mixer',
      targetPath: ['Mixer', 'Master', 'Volume'],
      points: [],
    };

    seedProjectWithAutomation(param);

    act(() => {
      root.render(<ScorePanel />);
    });

    const header = container.querySelector<HTMLElement>('[data-layer-id="sound-layer-0"]')!;
    const paramSpan = header.querySelector<HTMLSpanElement>('span.max-w-\\[70px\\]')!;
    expect(paramSpan).toBeTruthy();
    expect(paramSpan.textContent).toBe('dB');
    expect(paramSpan.getAttribute('title')).toBe('Mixer > Master > Volume');
  });

  it('falls back to displayName when targetPath is empty', () => {
    const param: AutomationParameterSnapshot = {
      parameterId: 'custom-param',
      name: 'cutoff',
      label: 'Cutoff Freq',
      displayName: 'Cutoff Freq',
      minimum: 20,
      maximum: 20000,
      resolutionDecimal: '1',
      resolution: 1,
      curve: 'LINEAR',
      fixedValue: 1000,
      automationEnabled: true,
      lineColor: 0xff0000,
      sourceKind: 'unknown',
      targetPath: [],
      points: [],
    };

    seedProjectWithAutomation(param);

    act(() => {
      root.render(<ScorePanel />);
    });

    const header = container.querySelector<HTMLElement>('[data-layer-id="sound-layer-0"]')!;
    const paramSpan = header.querySelector<HTMLSpanElement>('span.max-w-\\[70px\\]')!;
    expect(paramSpan).toBeTruthy();
    expect(paramSpan.textContent).toBe('Cutoff Freq');
    expect(paramSpan.getAttribute('title')).toBe('Cutoff Freq');
  });
});
