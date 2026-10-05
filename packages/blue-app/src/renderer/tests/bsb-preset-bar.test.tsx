// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import BSBPresetBar from '../components/workbench/panels/orchestra/bsb/BSBPresetBar';
import type {
  BlueSynthBuilderInstrumentSnapshot,
  BsbInterfacePatch,
  PresetGroupSnapshot,
} from '../../shared/project-editor';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
  if (!window.ResizeObserver) {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

function createMockInstrument(
  overrides: Partial<BlueSynthBuilderInstrumentSnapshot> = {},
): BlueSynthBuilderInstrumentSnapshot {
  const presetGroup: PresetGroupSnapshot = {
    name: 'Presets',
    presets: [
      { uniqueId: 'preset-1', name: 'Preset 1', values: {} },
      { uniqueId: 'preset-2', name: 'Preset 2', values: {} },
    ],
    subGroups: [
      {
        name: 'Factory',
        presets: Array.from({ length: 60 }, (_, i) => ({
          uniqueId: `factory-${i + 1}`,
          name: `Factory Sound ${i + 1}`,
          values: {},
        })),
        subGroups: [],
      },
    ],
    currentPresetUniqueId: 'preset-1',
    currentPresetModified: false,
  };

  return {
    assignmentId: '1',
    type: 'blueSynthBuilder',
    name: 'Synth',
    enabled: true,
    comment: '',
    instrumentText: '',
    alwaysOnInstrumentText: '',
    globalOrc: '',
    globalSco: '',
    graphicInterface: {
      gridSettings: { enabled: false, snapEnabled: false, gridSize: 10 },
      nodes: [],
    },
    presetGroup,
    ...overrides,
  };
}

describe('BSBPresetBar', () => {
  it('opens menu with max-height and overflow-y-auto scroll constraints', async () => {
    const instrument = createMockInstrument();
    const onBsbInterfacePatch = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <BSBPresetBar instrument={instrument} onBsbInterfacePatch={onBsbInterfacePatch} />,
      );
    });

    const trigger = container.querySelector('button')!;
    expect(trigger).toBeTruthy();
    expect(trigger.textContent).toContain('Presets');

    await act(async () => {
      trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
      trigger.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
      await Promise.resolve();
    });

    const content = document.querySelector('[role="menu"]') as HTMLElement;
    expect(content).toBeTruthy();
    // Verify viewport constraint & scrolling styles are present
    expect(content.className).toContain('max-h-[min(80vh,500px)]');
    expect(content.className).toContain('overflow-y-auto');

    root.unmount();
    container.remove();
  });

  it('dispatches applyPreset when a preset item is clicked', async () => {
    const instrument = createMockInstrument();
    const onBsbInterfacePatch = vi.fn<(patch: BsbInterfacePatch) => void>();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <BSBPresetBar instrument={instrument} onBsbInterfacePatch={onBsbInterfacePatch} />,
      );
    });

    const trigger = container.querySelector('button')!;
    await act(async () => {
      trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
      trigger.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
      await Promise.resolve();
    });

    const items = Array.from(document.querySelectorAll('[role="menuitem"]')) as HTMLElement[];
    const preset2Item = items.find((item) => item.textContent?.includes('Preset 2'));
    expect(preset2Item).toBeTruthy();

    await act(async () => {
      preset2Item?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(onBsbInterfacePatch).toHaveBeenCalledWith({
      type: 'applyPreset',
      presetUniqueId: 'preset-2',
    });

    root.unmount();
    container.remove();
  });
});
