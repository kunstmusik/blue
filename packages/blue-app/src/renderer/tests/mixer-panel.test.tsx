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
import { meterStore } from '../stores/meter-store';

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

  describe('User Story 1: Numeric peak readout and clear behavior (T015)', () => {
    it('displays -inf for numeric peak readout at silence and renders scale ruler when enabled', () => {
      seedLoadedProject();
      const { container, root } = renderPanel();

      const readouts = container.querySelectorAll('.mixer-peak-readout');
      expect(readouts.length).toBeGreaterThan(0);
      for (const readout of readouts) {
        expect(readout.textContent).toBe('-inf');
      }

      const ruler = container.querySelector('.mixer-scale-ruler');
      expect(ruler).not.toBeNull();

      act(() => {
        root.unmount();
      });
      container.remove();
    });

    it('updates readout to maximum held sample peak across channels when telemetry arrives', () => {
      seedLoadedProject();
      const leadChannelId = mockProjectState.mixer.channels[0]!.id;

      meterStore.setBindingMap({
        nchnls: 2,
        entries: [
          { kind: 'source', csdKey: '0', stripId: leadChannelId, displayName: 'Lead Channel' },
        ],
      });

      const { container, root } = renderPanel();

      // Feed telemetry: ch0 peak = 0.3 (-10.5 dBFS), ch1 peak = 0.7 (-3.1 dBFS)
      act(() => {
        meterStore.processMeterFrame(
          {
            sequence: 1,
            channels: [{ csdKey: '0', rms: [0.2, 0.4], peak: [0.3, 0.7] }],
          },
          1000,
        );
      });

      const readouts = container.querySelectorAll('.mixer-peak-readout');
      expect(readouts[0]?.textContent).toBe('-3.1');

      act(() => {
        root.unmount();
      });
      container.remove();
    });

    it('clears held peak and resets readout to -inf when either readout or canvas is clicked', () => {
      seedLoadedProject();
      const leadChannelId = mockProjectState.mixer.channels[0]!.id;

      meterStore.setBindingMap({
        nchnls: 2,
        entries: [
          { kind: 'source', csdKey: '0', stripId: leadChannelId, displayName: 'Lead Channel' },
        ],
      });

      const { container, root } = renderPanel();

      // Feed active audio
      act(() => {
        meterStore.processMeterFrame(
          {
            sequence: 1,
            channels: [{ csdKey: '0', rms: [0.5, 0.5], peak: [0.8, 0.8] }],
          },
          1000,
        );
      });

      const readout = container.querySelector<HTMLButtonElement>('.mixer-peak-readout')!;
      expect(readout.textContent).toBe('-1.9');

      // Click readout
      act(() => {
        readout.click();
      });
      expect(readout.textContent).toBe('-inf');
      expect(meterStore.getStripState(leadChannelId)!.maxHeldSamplePeak).toBe(-Infinity);

      // Feed audio again
      act(() => {
        meterStore.processMeterFrame(
          {
            sequence: 2,
            channels: [{ csdKey: '0', rms: [0.5, 0.5], peak: [0.8, 0.8] }],
          },
          2000,
        );
      });
      expect(readout.textContent).toBe('-1.9');

      // Click canvas
      const canvas = container.querySelector<HTMLCanvasElement>('canvas')!;
      act(() => {
        canvas.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      expect(meterStore.getStripState(leadChannelId)!.maxHeldSamplePeak).toBe(-Infinity);

      act(() => {
        root.unmount();
      });
      container.remove();
    });
  });

  describe('User Story 2: Meter profile selection (T020)', () => {
    it('keeps profile selection in the meter interaction surface and out of Mixer Settings', () => {
      seedLoadedProject();
      const { container, root } = renderPanel();

      const canvas = container.querySelector('canvas')!;
      act(() => {
        canvas.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
      });

      const profileItems = Array.from(
        document.body.querySelectorAll<HTMLElement>('[role="menuitemcheckbox"]'),
      );
      expect(profileItems).toHaveLength(5);
      expect(profileItems.map((item) => item.textContent?.trim())).toEqual([
        'Peak/RMS (+6 dBFS)',
        'Peak/RMS Linear (+6 dBFS)',
        'K20 (RMS + Peak)',
        'K14 (RMS + Peak)',
        'K12 (RMS + Peak)',
      ]);
      expect(profileItems[3]?.getAttribute('aria-label')).toContain(
        'does not calibrate monitor SPL',
      );

      const gearBtn = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Mixer Settings"]',
      )!;
      act(() => {
        gearBtn.click();
      });

      const dialog = document.body.querySelector('[role="dialog"]')!;
      expect(dialog.querySelector('select')).toBeNull();
      expect(dialog.textContent).not.toContain('Meter Profile');

      act(() => {
        root.unmount();
      });
      container.remove();
    });

    it('dispatches setMeterProfile from the meter context menu', () => {
      seedLoadedProject();
      const { container, root } = renderPanel();

      act(() => {
        container
          .querySelector('canvas')!
          .dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
      });

      const k14Item = Array.from(
        document.body.querySelectorAll<HTMLElement>('[role="menuitemcheckbox"]'),
      ).find((item) => item.textContent?.includes('K14'))!;
      mockProjectState.applyProjectDocumentPatch.mockClear();

      act(() => {
        k14Item.click();
      });

      expect(mockProjectState.applyProjectDocumentPatch).toHaveBeenCalledTimes(1);
      expect(mockProjectState.applyProjectDocumentPatch).toHaveBeenCalledWith(
        {
          mixer: {
            type: 'setMeterProfile',
            value: 'k14-rms-peak',
          },
        },
        { label: 'Set Meter Profile' },
      );

      act(() => {
        root.unmount();
      });
      container.remove();
    });

    it('provides meter context menu with Disable Meters and checkmark on selected profile', () => {
      seedLoadedProject();
      const { container, root } = renderPanel();

      const canvas = container.querySelector('canvas')!;
      expect(canvas).not.toBeNull();

      // Open context menu on meter canvas
      act(() => {
        canvas.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
      });

      const menu = document.body.querySelector('.editor-context-menu')!;
      expect(menu).not.toBeNull();

      // Check for Clear Meter and Disable Meters
      const items = Array.from(menu.querySelectorAll('.editor-context-menu__item'));
      const clearItem = items.find((i) => i.textContent?.includes('Clear Meter'));
      const disableItem = items.find((i) => i.textContent?.includes('Disable Meters'));
      expect(clearItem).not.toBeUndefined();
      expect(disableItem).not.toBeUndefined();

      // Profile options: active profile has checked state and item indicator
      const profileItems = Array.from(
        menu.querySelectorAll<HTMLElement>('[role="menuitemcheckbox"]'),
      );
      expect(profileItems.length).toBe(5);
      expect(profileItems[0].textContent).toContain('Peak/RMS (+6 dBFS)');
      expect(profileItems[1].textContent).toContain('Peak/RMS Linear (+6 dBFS)');

      const checkedItem = profileItems.find((p) => p.getAttribute('data-state') === 'checked')!;
      expect(checkedItem).not.toBeUndefined();
      expect(checkedItem.textContent).toContain('Peak/RMS (+6 dBFS)');
      expect(checkedItem.querySelector('.editor-context-menu__item-indicator')).not.toBeNull();

      // Selecting Disable Meters dispatches setMeterEnabled: false
      mockProjectState.applyProjectDocumentPatch.mockClear();
      act(() => {
        disableItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      expect(mockProjectState.applyProjectDocumentPatch).toHaveBeenCalledTimes(1);
      expect(mockProjectState.applyProjectDocumentPatch).toHaveBeenCalledWith(
        {
          mixer: {
            type: 'setMeterEnabled',
            value: false,
          },
        },
        { label: 'Disable Meters' },
      );

      act(() => {
        root.unmount();
      });
      container.remove();
    });
  });

  describe('User Story 3: Enable or Disable Meters Safely (T026)', () => {
    it('places the Mixer Settings gear at the far right of the toolbar and opens dialog on click', () => {
      seedLoadedProject();
      const { container, root } = renderPanel();

      const toolbar = container.querySelector('.mixer-toolbar')!;
      expect(toolbar).not.toBeNull();

      const addSubchannelBtn = toolbar.querySelector('button.toolbar-text-button')!;
      expect(addSubchannelBtn).not.toBeNull();
      expect(addSubchannelBtn.textContent).toContain('Add Subchannel');

      const gearBtn = toolbar.querySelector<HTMLButtonElement>(
        'button[aria-label="Mixer Settings"]',
      )!;
      expect(gearBtn).not.toBeNull();
      expect(addSubchannelBtn.nextElementSibling).toBe(gearBtn);
      expect(gearBtn.nextElementSibling).toBeNull();

      // Click gear button to open dialog
      act(() => {
        gearBtn.click();
      });

      const dialog = document.body.querySelector(
        '[role="dialog"][aria-labelledby="mixer-settings-dialog-title"]',
      )!;
      expect(dialog).not.toBeNull();
      expect(dialog.querySelector('#mixer-settings-dialog-title')?.textContent).toBe(
        'Mixer Settings',
      );
      expect(dialog.textContent).toContain(
        'Settings apply to this project and persist in the project file.',
      );

      const checkbox = dialog.querySelector<HTMLInputElement>(
        'input[type="checkbox"][aria-label="Enable Meters"]',
      )!;
      expect(checkbox).not.toBeNull();
      expect(checkbox.checked).toBe(true);

      // Close dialog via Close button (no-op)
      mockProjectState.applyProjectDocumentPatch.mockClear();
      const closeBtn = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button')).find(
        (b) => b.textContent?.trim() === 'Close',
      )!;
      expect(closeBtn).not.toBeNull();
      act(() => {
        closeBtn.click();
      });

      expect(mockProjectState.applyProjectDocumentPatch).not.toHaveBeenCalled();
      expect(document.body.querySelector('[role="dialog"]')).toBeNull();

      act(() => {
        root.unmount();
      });
      container.remove();
    });

    it('toggles enableMeters immediately with semantic label Disable Meters', () => {
      seedLoadedProject();
      const { container, root } = renderPanel();

      const gearBtn = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Mixer Settings"]',
      )!;
      act(() => {
        gearBtn.click();
      });

      const dialog = document.body.querySelector('[role="dialog"]')!;
      const checkbox = dialog.querySelector<HTMLInputElement>(
        'input[type="checkbox"][aria-label="Enable Meters"]',
      )!;

      mockProjectState.applyProjectDocumentPatch.mockClear();
      act(() => {
        checkbox.click();
      });

      expect(mockProjectState.applyProjectDocumentPatch).toHaveBeenCalledTimes(1);
      expect(mockProjectState.applyProjectDocumentPatch).toHaveBeenCalledWith(
        {
          mixer: {
            type: 'setMeterEnabled',
            value: false,
          },
        },
        { label: 'Disable Meters' },
      );

      act(() => {
        root.unmount();
      });
      container.remove();
    });

    it('derives meter visibility from enableMeters=false while keeping faders and settings', () => {
      seedLoadedProject();
      mockProjectState.mixer = {
        ...mockProjectState.mixer,
        enableMeters: false,
      };
      const { container, root } = renderPanel();

      expect(container.querySelector('canvas')).toBeNull();
      expect(container.querySelector('.mixer-peak-readout')).toBeNull();
      expect(container.querySelector('.mixer-scale-ruler')).toBeNull();
      const gearBtn = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Mixer Settings"]',
      )!;
      act(() => {
        gearBtn.click();
      });
      const dialog = document.body.querySelector('[role="dialog"]')!;
      expect(dialog.querySelector('select')).toBeNull();

      // Faders and strips still present
      expect(container.querySelectorAll('.mixer-channel-strip').length).toBeGreaterThan(0);
      expect(container.querySelectorAll('.mixer-level-slider-wrapper').length).toBeGreaterThan(0);

      act(() => {
        root.unmount();
      });
      container.remove();
    });
  });
});
