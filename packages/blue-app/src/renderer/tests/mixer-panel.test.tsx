// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BlueData, Channel, Effect, GenericInstrument } from '@blue/data';
import MixerPanel from '../components/workbench/panels/MixerPanel';
import {
  createEmptyMixerSnapshot,
  createProjectEditorSnapshot,
  type MixerPatch,
  type MixerSnapshot,
} from '../../shared/project-editor';

declare global {
  interface Window {
    blueAPI?: {
      openEffectEditor?: (request: unknown) => Promise<unknown> | unknown;
      openEffectInterface?: (request: unknown) => Promise<unknown> | unknown;
    };
  }
}

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

interface MockProjectState {
  loaded: boolean;
  mixer: MixerSnapshot;
  applyProjectDocumentPatch: (patch: { mixer: MixerPatch }) => Promise<void> | void;
}

interface MockUIState {
  openEffectsLibrary: (target?: { channelId: string; chain: 'pre' | 'post' }) => void;
}

const { mockProjectState, mockUIState } = vi.hoisted(() => ({
  mockProjectState: {
    loaded: false,
    mixer: {} as MixerSnapshot,
    applyProjectDocumentPatch: vi.fn(),
  } satisfies MockProjectState,
  mockUIState: {
    openEffectsLibrary: vi.fn(),
  } satisfies MockUIState,
}));

vi.mock('../stores/project-store', () => ({
  useProjectStore: (selector: (state: MockProjectState) => unknown) => selector(mockProjectState),
  getProjectDocumentRevision: () => 0,
}));

vi.mock('../stores/ui-store', () => ({
  useUIStore: (selector: (state: MockUIState) => unknown) => selector(mockUIState),
}));

function seedLoadedProject(): void {
  const data = new BlueData();

  const instrument = new GenericInstrument();
  instrument.setName('Lead');
  data.getArrangement().addInstrument(instrument, '1');

  const channel = new Channel();
  channel.setName('Lead Channel');
  channel.setAssociation('1');
  data.getMixer().getChannels().splice(0, 0, channel);

  const snapshot = createProjectEditorSnapshot(data, '/test.blue');
  mockProjectState.loaded = true;
  mockProjectState.mixer = snapshot.mixer!;
}

function seedLoadedProjectWithEffects(): void {
  const data = new BlueData();
  for (let index = 1; index <= 2; index += 1) {
    const instrument = new GenericInstrument();
    instrument.setName(`Instrument ${index}`);
    data.getArrangement().addInstrument(instrument, String(index));
    const channel = new Channel();
    channel.setName(`Channel ${index}`);
    channel.setAssociation(String(index));
    const effect = new Effect();
    effect.setName(`Effect ${index}`);
    channel.getPreEffects().push(effect);
    data.getMixer().getChannels().push(channel);
  }
  const snapshot = createProjectEditorSnapshot(data, '/test.blue');
  mockProjectState.loaded = true;
  mockProjectState.mixer = snapshot.mixer!;
}

function seedLoadedProjectWithTrackGroup(): void {
  const snapshot = createEmptyMixerSnapshot();
  snapshot.channelListGroups = [
    {
      association: 'audio-group-unique',
      listName: 'Track Layer Group',
      listNameEditSupported: true,
      channels: [
        {
          id: 'audio-channel-1',
          name: '',
          channelKind: 'instrument',
          association: 'audio-layer-1',
          outChannel: 'Master',
          muted: false,
          solo: false,
          level: 0,
          volume: 1,
          pan: 0.5,
          preChain: [],
          postChain: [],
        },
        {
          id: 'audio-channel-2',
          name: '',
          channelKind: 'instrument',
          association: 'audio-layer-2',
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
    },
  ];

  mockProjectState.loaded = true;
  mockProjectState.mixer = snapshot;
}

function renderPanel(): { container: HTMLDivElement; root: Root } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<MixerPanel />);
  });

  return { container, root };
}

function setTextInputValue(input: HTMLInputElement, value: string): void {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  valueSetter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

beforeEach(() => {
  mockProjectState.loaded = false;
  mockProjectState.mixer = createEmptyMixerSnapshot();
  mockProjectState.applyProjectDocumentPatch.mockReset();
  mockUIState.openEffectsLibrary.mockReset();
  window.blueAPI = {
    openEffectEditor: vi.fn().mockResolvedValue(undefined),
    openEffectInterface: vi.fn().mockResolvedValue(undefined),
    sendMixerRealtimeLevelUpdate: vi.fn().mockResolvedValue(undefined),
  };
});

afterEach(() => {
  delete window.blueAPI;
});

describe('MixerPanel', () => {
  it('renders the unloaded empty state', () => {
    const { container, root } = renderPanel();

    expect(container.textContent).toContain('No project loaded');

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('renders mixer strips for loaded project', async () => {
    seedLoadedProject();

    const { container, root } = renderPanel();

    expect(container.textContent).toContain('Lead Channel');
    expect(container.textContent).toContain('Master');
    expect(container.textContent).toContain('Add Subchannel');

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('fills the available level slider height', async () => {
    seedLoadedProject();
    const heightSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        if (
          this.classList.contains('mixer-level-slider-wrapper') ||
          this.classList.contains('mixer-level-controls')
        ) {
          return { height: 180 } as DOMRect;
        }
        return { height: 0 } as DOMRect;
      });

    const { container, root } = renderPanel();

    try {
      await act(async () => {
        await Promise.resolve();
      });

      expect(
        [...container.querySelectorAll('.mixer-level-slider-wrapper svg')].map((slider) =>
          slider.getAttribute('height'),
        ),
      ).toEqual(['180', '180']);
      expect(
        [...container.querySelectorAll('.mixer-level-controls canvas')].map(
          (canvas) => (canvas as HTMLElement).style.height,
        ),
      ).toEqual(['180px', '180px']);
    } finally {
      act(() => {
        root.unmount();
      });
      container.remove();
      heightSpy.mockRestore();
    }
  });

  it('keeps only one Effect selected across all channels', () => {
    seedLoadedProjectWithEffects();
    const { container, root } = renderPanel();
    const effectRows = [
      ...container.querySelectorAll<HTMLElement>('[data-library-drop-target="effect-row"]'),
    ];
    expect(effectRows).toHaveLength(2);

    act(() => effectRows[0]!.click());
    expect(container.querySelectorAll('[aria-selected="true"]')).toHaveLength(1);
    expect(effectRows[0]!.getAttribute('aria-selected')).toBe('true');

    act(() => effectRows[1]!.click());
    expect(container.querySelectorAll('[aria-selected="true"]')).toHaveLength(1);
    expect(effectRows[0]!.getAttribute('aria-selected')).toBe('false');
    expect(effectRows[1]!.getAttribute('aria-selected')).toBe('true');

    act(() => root.unmount());
    container.remove();
  });

  it('opens rename dialog on double-clicking Track group header and commits rename patch', async () => {
    seedLoadedProjectWithTrackGroup();
    const { container, root } = renderPanel();

    await act(async () => {
      await Promise.resolve();
    });

    const header = Array.from(container.querySelectorAll('.mixer-channel-group__header')).find(
      (node) => node.textContent?.includes('Track Layer Group'),
    ) as HTMLDivElement;
    expect(header).toBeTruthy();

    act(() => {
      header.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });

    const input = container.querySelector('input:not([type])') as HTMLInputElement;
    expect(input).toBeTruthy();

    act(() => {
      setTextInputValue(input, 'Renamed From Mixer Header');
    });

    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(mockProjectState.applyProjectDocumentPatch).toHaveBeenCalledWith(
      {
        mixer: {
          type: 'renameChannelListGroup',
          association: 'audio-group-unique',
          name: 'Renamed From Mixer Header',
        },
      },
      { label: 'Rename Channel List Group' },
    );

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('shows unnamed Track strips as italic one-based Track labels', () => {
    seedLoadedProjectWithTrackGroup();
    const { container, root } = renderPanel();

    const names = Array.from(
      container.querySelectorAll<HTMLElement>('.mixer-channel-group__strips .mixer-channel-name'),
    );

    expect(names.map((name) => name.textContent)).toEqual(['Track 1', 'Track 2']);
    expect(names.every((name) => name.classList.contains('mixer-channel-name--fallback'))).toBe(
      true,
    );

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('exposes accessible slider semantics on channel faders and supports keyboard stepping', async () => {
    seedLoadedProject();
    const { container, root } = renderPanel();

    const rangeInputs = Array.from(
      container.querySelectorAll<HTMLInputElement>(
        '.mixer-level-slider-wrapper input[type="range"]',
      ),
    );
    expect(rangeInputs.length).toBeGreaterThanOrEqual(1);
    const fader = rangeInputs[0]!;

    expect(fader.getAttribute('role')).toBe('slider');
    expect(fader.getAttribute('aria-label')).toBe('Level for Lead Channel');
    expect(fader.getAttribute('aria-valuemin')).toBe('-960');
    expect(fader.getAttribute('aria-valuemax')).toBe('240');
    expect(fader.getAttribute('aria-valuenow')).not.toBeNull();
    expect(fader.getAttribute('aria-valuetext')).toMatch(/dB/);

    // Test ArrowUp keydown
    mockProjectState.applyProjectDocumentPatch.mockClear();
    act(() => {
      fader.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    });
    expect(mockProjectState.applyProjectDocumentPatch).toHaveBeenCalledWith(
      expect.objectContaining({
        mixer: expect.objectContaining({
          type: 'updateChannel',
          channelId: '1',
          patch: expect.objectContaining({
            level: expect.any(Number),
          }),
        }),
      }),
      { label: 'Set Channel Level' },
    );

    // Test Shift+ArrowUp accelerated stepping
    mockProjectState.applyProjectDocumentPatch.mockClear();
    act(() => {
      fader.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowUp', shiftKey: true, bubbles: true }),
      );
    });
    expect(mockProjectState.applyProjectDocumentPatch).toHaveBeenCalledWith(
      expect.objectContaining({
        mixer: expect.objectContaining({
          type: 'updateChannel',
          channelId: '1',
          patch: expect.objectContaining({
            level: expect.any(Number),
          }),
        }),
      }),
      { label: 'Set Channel Level' },
    );

    // Test Home and End bounds
    mockProjectState.applyProjectDocumentPatch.mockClear();
    act(() => {
      fader.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    });
    expect(mockProjectState.applyProjectDocumentPatch).toHaveBeenCalledWith(
      {
        mixer: {
          type: 'updateChannel',
          channelId: '1',
          patch: {
            level: -96,
          },
        },
      },
      { label: 'Set Channel Level' },
    );

    mockProjectState.applyProjectDocumentPatch.mockClear();
    act(() => {
      fader.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    });
    expect(mockProjectState.applyProjectDocumentPatch).toHaveBeenCalledWith(
      {
        mixer: {
          type: 'updateChannel',
          channelId: '1',
          patch: {
            level: 12,
          },
        },
      },
      { label: 'Set Channel Level' },
    );

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('binds pointer drag listeners to the owner window and cleans them up without lingering global listeners', () => {
    seedLoadedProject();
    const { container, root } = renderPanel();

    const addListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeListenerSpy = vi.spyOn(window, 'removeEventListener');

    const sliderWrapper = container.querySelector<HTMLDivElement>('.mixer-level-slider-wrapper');
    expect(sliderWrapper).toBeTruthy();

    // Trigger mousedown to start drag
    act(() => {
      sliderWrapper!.dispatchEvent(
        new MouseEvent('mousedown', { clientY: 100, bubbles: true, cancelable: true }),
      );
    });

    expect(addListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
    expect(addListenerSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));

    // Trigger mouseup to end drag
    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup', { clientY: 80, bubbles: true }));
    });

    expect(removeListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
    expect(removeListenerSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));

    act(() => {
      root.unmount();
    });
    container.remove();

    addListenerSpy.mockRestore();
    removeListenerSpy.mockRestore();
  });
});
