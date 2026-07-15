// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import MixerPanel from '../components/workbench/panels/MixerPanel';
import type {
  EffectEditorRequest,
  MixerPatch,
  MixerSnapshot,
} from '../../shared/project-editor';

declare global {
  interface Window {
    blueAPI?: {
      focusEffectEditor?: (request: EffectEditorRequest) => Promise<boolean> | boolean;
      openEffectEditor?: (request: EffectEditorRequest) => Promise<unknown> | unknown;
      openEffectInterface?: (request: EffectEditorRequest) => Promise<unknown> | unknown;
    };
  }
}

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface MockProjectState {
  loaded: boolean;
  mixer: MixerSnapshot;
  applyProjectDocumentPatch: (patch: { mixer: MixerPatch }) => Promise<void> | void;
  flushPendingPatches: () => Promise<void>;
}

interface MockUIState {
  openEffectsLibrary: (target?: { channelId: string; chain: 'pre' | 'post' }) => void;
}

const editorRequest: EffectEditorRequest = {
  ownerType: 'project',
  effectId: 'fx-1',
  projectRef: {
    channelId: 'channel-1',
    chain: 'post',
    entryId: 'fx-1',
  },
};

const { mockProjectState, mockUIState } = vi.hoisted(() => ({
  mockProjectState: {
    loaded: true,
    mixer: {
      enabled: true,
      extraRenderTime: 0,
      channelListGroups: [],
      channels: [
        {
          id: 'channel-1',
          name: 'Lead Channel',
          channelKind: 'instrument',
          association: '1',
          outChannel: 'Master',
          muted: false,
          solo: false,
          level: 0,
          volume: 1,
          pan: 0.5,
          preChain: [],
          postChain: [],
        },
      ],
      subChannels: [],
      master: {
        id: 'master',
        name: 'Master',
        channelKind: 'master',
        outChannel: '',
        muted: false,
        solo: false,
        level: 0,
        volume: 1,
        pan: 0.5,
        preChain: [],
        postChain: [],
      },
    } as MixerSnapshot,
    applyProjectDocumentPatch: vi.fn(),
    flushPendingPatches: vi.fn().mockResolvedValue(undefined),
  } satisfies MockProjectState,
  mockUIState: {
    openEffectsLibrary: vi.fn(),
  } satisfies MockUIState,
}));

vi.mock('../stores/project-store', () => ({
  useProjectStore: (selector: (state: MockProjectState) => unknown) => selector(mockProjectState),
}));

vi.mock('../stores/ui-store', () => ({
  useUIStore: (selector: (state: MockUIState) => unknown) => selector(mockUIState),
}));

vi.mock('../stores/playback-store', () => ({
  usePlaybackStore: () => 'stopped',
}));

vi.mock('../stores/blue-live-store', () => ({
  useBlueLiveStore: () => 'idle',
}));

vi.mock('../stores/mixer-playback-ui', () => ({
  deriveMixerPlaybackUiState: () => ({
    isPlaying: false,
    isBlueLiveActive: false,
    statusLabel: 'Stopped',
  }),
}));

vi.mock('../components/workbench/panels/mixer/ChannelStrip', () => ({
  default: ({
    onOpenEffectInterface,
  }: {
    onOpenEffectInterface: (request: EffectEditorRequest) => void;
  }) => (
    <div>
      <button type="button" onClick={() => onOpenEffectInterface(editorRequest)}>
        Open Effect Interface
      </button>
    </div>
  ),
}));

function renderPanel(): { container: HTMLDivElement; root: Root } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<MixerPanel />);
  });

  return { container, root };
}

beforeEach(() => {
  mockProjectState.flushPendingPatches = vi.fn().mockResolvedValue(undefined);
  mockProjectState.applyProjectDocumentPatch = vi.fn();
  mockUIState.openEffectsLibrary = vi.fn();
  window.blueAPI = {
    focusEffectEditor: vi.fn().mockResolvedValue(false),
    openEffectEditor: vi.fn().mockResolvedValue(undefined),
    openEffectInterface: vi.fn().mockResolvedValue(undefined),
  };
});

afterEach(() => {
  delete window.blueAPI;
});

describe('MixerPanel effect editor opening', () => {
  it('flushes pending patches before opening the effect interface window', async () => {
    const { container, root } = renderPanel();

    await act(async () => {
      const button = Array.from(container.querySelectorAll('button')).find(
        (candidate) => candidate.textContent === 'Open Effect Interface',
      ) as HTMLButtonElement | undefined;
      button?.click();
      await Promise.resolve();
    });

    expect(mockProjectState.flushPendingPatches).toHaveBeenCalledOnce();
    expect(window.blueAPI?.focusEffectEditor).toHaveBeenCalledWith(editorRequest);
    expect(window.blueAPI?.openEffectInterface).toHaveBeenCalledWith(editorRequest);
    expect(mockProjectState.flushPendingPatches.mock.invocationCallOrder[0]).toBeLessThan(
      (window.blueAPI?.focusEffectEditor as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0],
    );

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
