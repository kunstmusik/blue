// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ScorePanel from '../components/workbench/panels/ScorePanel';
import PatternLayerHeader from '../components/workbench/panels/score/PatternLayerHeader';
import { useProjectStore } from '../stores/project-store';
import { createEmptyProjectEditorSnapshot } from '../../shared/project-editor';
import {
  createMockScoreLayerSnapshot,
  createMockTrackSnapshot,
  createMockPatternLayerSnapshot,
} from '../../shared/project-editor-layer-color-test-utils';

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

describe('Score Layer Color Controls', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    useProjectStore.getState().clearProject();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
    document.body.innerHTML = '';
    useProjectStore.getState().clearProject();
  });

  it('renders visible swatches with accessible names in ordinary sound layer headers and dispatches edits', async () => {
    const applyPatchSpy = vi.spyOn(useProjectStore.getState(), 'applyProjectDocumentPatch');
    const snapshot = createEmptyProjectEditorSnapshot();
    snapshot.score.layerGroups = [
      {
        groupId: 'sound-group',
        groupType: 'polyObject',
        name: 'SoundObjects',
        layerCount: 1,
        isOpenableContainer: true,
        layers: [
          createMockScoreLayerSnapshot({
            layerId: 'sound-layer-0',
            name: 'Violin Layer',
            backgroundColor: -16776961, // #0000ff (blue)
          }),
        ],
      },
    ];
    useProjectStore.getState().setProjectInfo({
      title: 'Test Project',
      sessionId: 1,
      loaded: true,
      score: snapshot.score,
      orchestra: { ...snapshot.orchestra, loaded: true },
      projectProperties: snapshot.projectProperties,
      transport: snapshot.transport,
    } as any);

    act(() => {
      root.render(<ScorePanel />);
    });

    const swatchButton = host.querySelector<HTMLButtonElement>('button[aria-label*="Violin Layer"][aria-label*="color"], button[aria-label="Layer color for Violin Layer"]');
    expect(swatchButton).toBeTruthy();
    expect(swatchButton?.getAttribute('aria-label')).toMatch(/color/i);
    expect(swatchButton?.style.backgroundColor).toBe('rgb(0, 0, 255)');

    // Click to open picker
    act(() => {
      swatchButton?.click();
    });

    const hexInput = document.querySelector<HTMLInputElement>('input[aria-label="Hex color"]');
    expect(hexInput).toBeTruthy();

    act(() => {
      if (hexInput) {
        hexInput.value = '#00ff00';
        hexInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    expect(applyPatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        score: expect.objectContaining({
          type: 'updateLayerState',
          groupId: 'sound-group',
          layerIndex: 0,
          patch: expect.objectContaining({
            backgroundColor: -16711936, // Green
          }),
        }),
      }),
    );
  });

  it('renders visible swatches in track headers and dispatches edits', async () => {
    const applyPatchSpy = vi.spyOn(useProjectStore.getState(), 'applyProjectDocumentPatch');
    const snapshot = createEmptyProjectEditorSnapshot();
    snapshot.score.layerGroups = [
      {
        groupId: 'track-group',
        groupType: 'track',
        name: 'Tracks',
        layerCount: 1,
        isOpenableContainer: false,
        layers: [
          createMockTrackSnapshot({
            layerId: 'track-0',
            name: 'Bass Track',
            backgroundColor: -16711936, // #00ff00 (green)
          }),
        ],
      },
    ];
    useProjectStore.getState().setProjectInfo({
      title: 'Test Project',
      sessionId: 1,
      loaded: true,
      score: snapshot.score,
      orchestra: { ...snapshot.orchestra, loaded: true },
      projectProperties: snapshot.projectProperties,
      transport: snapshot.transport,
    } as any);

    act(() => {
      root.render(<ScorePanel />);
    });

    const swatchButton = host.querySelector<HTMLButtonElement>('button[aria-label*="Bass Track"][aria-label*="color"], button[aria-label="Layer color for Bass Track"]');
    expect(swatchButton).toBeTruthy();
    expect(swatchButton?.style.backgroundColor).toBe('rgb(0, 255, 0)');

    act(() => {
      swatchButton?.click();
    });

    const hexInput = document.querySelector<HTMLInputElement>('input[aria-label="Hex color"]');
    expect(hexInput).toBeTruthy();

    act(() => {
      if (hexInput) {
        hexInput.value = '#ff0000';
        hexInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    expect(applyPatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        score: expect.objectContaining({
          type: 'updateLayerState',
          groupId: 'track-group',
          layerIndex: 0,
          patch: expect.objectContaining({
            backgroundColor: -65536, // Red
          }),
        }),
      }),
    );
  });

  it('renders visible swatches in PatternLayerHeader and dispatches edits', async () => {
    const applyPatchSpy = vi.spyOn(useProjectStore.getState(), 'applyProjectDocumentPatch');
    const layer = createMockPatternLayerSnapshot({
      layerId: 'pattern-0',
      name: 'Drums Pattern',
      backgroundColor: -65536, // #ff0000 (red)
    });

    act(() => {
      root.render(
        <PatternLayerHeader
          layer={layer}
          groupId="pattern-group"
          layerIndex={0}
          layerCount={1}
        />,
      );
    });

    const swatchButton = host.querySelector<HTMLButtonElement>('button[aria-label*="Drums Pattern"][aria-label*="color"], button[aria-label="Layer color for Drums Pattern"]');
    expect(swatchButton).toBeTruthy();
    expect(swatchButton?.style.backgroundColor).toBe('rgb(255, 0, 0)');

    act(() => {
      swatchButton?.click();
    });

    const hexInput = document.querySelector<HTMLInputElement>('input[aria-label="Hex color"]');
    expect(hexInput).toBeTruthy();

    act(() => {
      if (hexInput) {
        hexInput.value = '#0000ff';
        hexInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    expect(applyPatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        score: expect.objectContaining({
          type: 'updateLayerState',
          groupId: 'pattern-group',
          layerIndex: 0,
          patch: expect.objectContaining({
            backgroundColor: -16776961, // Blue
          }),
        }),
      }),
    );
  });
});
