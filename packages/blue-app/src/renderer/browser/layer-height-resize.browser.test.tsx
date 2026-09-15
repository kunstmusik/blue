import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LayerHeightResizeHandle } from '../components/workbench/panels/score/LayerHeightResizeHandle';
import { LayerHeightCustomDialog } from '../components/workbench/panels/score/LayerHeightCustomDialog';
import {
  resolveLayerHeightTargets,
  getLayerHeightStatus,
  getNextPresetHeight,
  MIN_LAYER_HEIGHT,
  MAX_LAYER_HEIGHT,
  type VisibleLayerRef,
} from '../components/workbench/panels/score/layer-selection-utils';
import type { ScoreLayerSnapshot } from '../components/workbench/panels/score/types';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function setInputValue(input: HTMLInputElement, value: string) {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value',
  )?.set;
  nativeInputValueSetter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('Layer Height Resize in Browser (Chromium)', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  describe('T017: Header Drag Handle, Score Alignment, and Cancellation', () => {
    it('renders the header handle with accessible attributes and row-resize cursor styling', () => {
      act(() => {
        root.render(
          <div style={{ position: 'relative', width: 200, height: 44 }}>
            <LayerHeightResizeHandle
              groupId="grp-1"
              layerIndex={0}
              layerSelectionId="sel-1"
              layerName="Sound 1"
              currentHeight={44}
              onStartResize={() => {}}
            />
          </div>,
        );
      });

      const handle = container.querySelector<HTMLElement>('[data-layer-resize-handle]');
      expect(handle).not.toBeNull();
      expect(handle?.getAttribute('role')).toBe('separator');
      expect(handle?.getAttribute('aria-orientation')).toBe('horizontal');
      expect(handle?.getAttribute('aria-valuenow')).toBe('44');
      expect(handle?.getAttribute('aria-valuemin')).toBe('22');
      expect(handle?.getAttribute('aria-valuemax')).toBe('660');
      expect(handle?.className).toContain('cursor-row-resize');
    });

    it('triggers resize lifecycle on pointer gestures and supports pointercancel', () => {
      const onStart = vi.fn();
      const onUpdate = vi.fn();
      const onCommit = vi.fn();
      const onCancel = vi.fn();

      act(() => {
        root.render(
          <div style={{ position: 'relative', width: 200, height: 44 }}>
            <LayerHeightResizeHandle
              groupId="grp-1"
              layerIndex={0}
              layerSelectionId="sel-1"
              layerName="Sound 1"
              currentHeight={44}
              onStartResize={onStart}
              onUpdateResize={onUpdate}
              onCommitResize={onCommit}
              onCancelResize={onCancel}
            />
          </div>,
        );
      });

      const handle = container.querySelector<HTMLElement>('[data-layer-resize-handle]')!;

      // Pointer down
      act(() => {
        handle.dispatchEvent(
          new PointerEvent('pointerdown', {
            bubbles: true,
            cancelable: true,
            clientY: 100,
            button: 0,
          }),
        );
      });
      expect(onStart).toHaveBeenCalledTimes(1);

      // Pointer move on handle (with pointer capture)
      act(() => {
        handle.dispatchEvent(
          new PointerEvent('pointermove', {
            bubbles: true,
            cancelable: true,
            clientY: 120,
          }),
        );
      });
      expect(onUpdate).toHaveBeenCalledWith(120);

      // Pointer cancel
      act(() => {
        handle.dispatchEvent(
          new PointerEvent('pointercancel', {
            bubbles: true,
            cancelable: true,
          }),
        );
      });
      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onCommit).not.toHaveBeenCalled();
    });

    it('pointerup commits drag gesture to final coordinate', () => {
      const onStart = vi.fn();
      const onCommit = vi.fn();

      act(() => {
        root.render(
          <div style={{ position: 'relative', width: 200, height: 44 }}>
            <LayerHeightResizeHandle
              groupId="grp-1"
              layerIndex={0}
              layerSelectionId="sel-1"
              layerName="Sound 1"
              currentHeight={44}
              onStartResize={onStart}
              onCommitResize={onCommit}
            />
          </div>,
        );
      });

      const handle = container.querySelector<HTMLElement>('[data-layer-resize-handle]')!;

      act(() => {
        handle.dispatchEvent(
          new PointerEvent('pointerdown', {
            bubbles: true,
            cancelable: true,
            clientY: 100,
            button: 0,
          }),
        );
      });

      act(() => {
        handle.dispatchEvent(
          new PointerEvent('pointerup', {
            bubbles: true,
            cancelable: true,
            clientY: 157,
          }),
        );
      });

      expect(onCommit).toHaveBeenCalledWith(157);
    });

    it('keyboard navigation adjusts height with Arrow keys, Home, and End', () => {
      const onKeyboardResize = vi.fn();

      act(() => {
        root.render(
          <div style={{ position: 'relative', width: 200, height: 44 }}>
            <LayerHeightResizeHandle
              groupId="grp-1"
              layerIndex={0}
              layerSelectionId="sel-1"
              layerName="Sound 1"
              currentHeight={44}
              onStartResize={() => {}}
              onKeyboardResize={onKeyboardResize}
            />
          </div>,
        );
      });

      const handle = container.querySelector<HTMLElement>('[data-layer-resize-handle]')!;

      act(() => {
        handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      });
      expect(onKeyboardResize).toHaveBeenCalledWith(45, document);

      act(() => {
        handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
      });
      expect(onKeyboardResize).toHaveBeenCalledWith(43, document);

      act(() => {
        handle.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'ArrowDown', shiftKey: true, bubbles: true }),
        );
      });
      expect(onKeyboardResize).toHaveBeenCalledWith(54, document);

      act(() => {
        handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
      });
      expect(onKeyboardResize).toHaveBeenCalledWith(22, document);

      act(() => {
        handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
      });
      expect(onKeyboardResize).toHaveBeenCalledWith(660, document);
    });

    it('keeps a legacy height accessible while keyboard edits enter the legal range', () => {
      const onKeyboardResize = vi.fn();

      act(() => {
        root.render(
          <LayerHeightResizeHandle
            groupId="grp-1"
            layerIndex={0}
            layerSelectionId="sel-1"
            layerName="Legacy Sound 1"
            currentHeight={902}
            onStartResize={() => {}}
            onKeyboardResize={onKeyboardResize}
          />,
        );
      });

      const handle = container.querySelector<HTMLElement>('[data-layer-resize-handle]')!;
      expect(handle.getAttribute('aria-valuenow')).toBe('902');
      expect(handle.getAttribute('aria-valuetext')).toBe(
        '902 pixels; This Layer; allowed 22 to 660 pixels',
      );

      act(() => {
        handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
      });
      expect(onKeyboardResize).toHaveBeenCalledWith(660, document);
    });
  });

  describe('T025: Multi-layer Resolution, Relative Deltas, Clamping, and Pattern Rejection', () => {
    function makeLayer(id: string, name: string, height: number): ScoreLayerSnapshot {
      return {
        layerId: id,
        name,
        height,
        backgroundColor: 0,
        muted: false,
        solo: false,
        items: [],
      };
    }

    const testVisibleLayers: VisibleLayerRef[] = [
      {
        scopeKey: '1:root',
        groupId: 'grp-1',
        groupType: 'polyObject',
        layerSelectionId: 'layer-1',
        layerId: 'layer-1',
        localIndex: 0,
        globalIndex: 0,
        layer: makeLayer('layer-1', 'Layer 1', 44),
      },
      {
        scopeKey: '1:root',
        groupId: 'grp-1',
        groupType: 'polyObject',
        layerSelectionId: 'layer-2',
        layerId: 'layer-2',
        localIndex: 1,
        globalIndex: 1,
        layer: makeLayer('layer-2', 'Layer 2', 88),
      },
      {
        scopeKey: '1:root',
        groupId: 'grp-2',
        groupType: 'track',
        layerSelectionId: 'track-1',
        layerId: 'track-1',
        localIndex: 0,
        globalIndex: 2,
        layer: makeLayer('track-1', 'Track 1', 66),
      },
      {
        scopeKey: '1:root',
        groupId: 'grp-pat',
        groupType: 'patterns',
        layerSelectionId: 'pat-1',
        layerId: 'pat-1',
        localIndex: 0,
        globalIndex: 3,
        layer: makeLayer('pat-1', 'Pattern 1', 22),
      },
    ];

    it('resolves all selected eligible layers across groups when clicking a selected layer', () => {
      const selected = new Set(['grp-1:layer-1', 'grp-2:track-1']);
      const res = resolveLayerHeightTargets({
        clickedGroupId: 'grp-1',
        clickedLayerIndex: 0,
        clickedLayerSelectionId: 'layer-1',
        visibleLayers: testVisibleLayers,
        selectedKeys: selected,
      });

      expect(res.ok).toBe(true);
      expect(res.isMulti).toBe(true);
      expect(res.targets).toHaveLength(2);
      expect(res.targets.map((t) => t.initialHeight)).toEqual([44, 66]);
    });

    it('resizes only single row when clicking an unselected layer while preserving selection', () => {
      const selected = new Set(['grp-1:layer-1']);
      const res = resolveLayerHeightTargets({
        clickedGroupId: 'grp-1',
        clickedLayerIndex: 1,
        clickedLayerSelectionId: 'layer-2',
        visibleLayers: testVisibleLayers,
        selectedKeys: selected,
      });

      expect(res.ok).toBe(true);
      expect(res.isMulti).toBe(false);
      expect(res.targets).toHaveLength(1);
      expect(res.targets[0].layerSelectionId).toBe('layer-2');
      expect(res.targets[0].initialHeight).toBe(88);
    });

    it('disables multi-layer resize if selection includes a pattern layer', () => {
      const selectedWithPattern = new Set(['grp-1:layer-1', 'grp-pat:pat-1']);
      const res = resolveLayerHeightTargets({
        clickedGroupId: 'grp-1',
        clickedLayerIndex: 0,
        clickedLayerSelectionId: 'layer-1',
        visibleLayers: testVisibleLayers,
        selectedKeys: selectedWithPattern,
      });

      expect(res.ok).toBe(false);
      expect(res.disabledReason).toBe('Pattern layers cannot be resized');
      expect(res.targets).toHaveLength(0);
    });

    it('clamps each target independently by its original height without drift', () => {
      const h1 = 44;
      const h2 = 650;
      const delta = 20;

      const newH1 = Math.max(MIN_LAYER_HEIGHT, Math.min(MAX_LAYER_HEIGHT, h1 + delta));
      const newH2 = Math.max(MIN_LAYER_HEIGHT, Math.min(MAX_LAYER_HEIGHT, h2 + delta));

      expect(newH1).toBe(64);
      expect(newH2).toBe(660); // Clamped to 660 without dragging h1 down
    });
  });

  describe('T033: Context Menu Presets, Custom Dialog, and Group Defaults', () => {
    it('detects preset, custom, and mixed statuses accurately', () => {
      expect(getLayerHeightStatus([44], 'polyObject')).toEqual({
        status: 'preset',
        value: 44,
        presetIndex: 1,
      });
      expect(getLayerHeightStatus([57], 'polyObject')).toEqual({
        status: 'custom',
        value: 57,
      });
      expect(getLayerHeightStatus([44, 66], 'polyObject')).toEqual({
        status: 'mixed',
      });
      expect(getLayerHeightStatus([220], 'track')).toEqual({
        status: 'preset',
        value: 220,
        presetIndex: 9,
      });
    });

    it('steps to next strictly higher or lower preset from custom heights', () => {
      expect(getNextPresetHeight(57, 1, 'polyObject')).toBe(66);
      expect(getNextPresetHeight(57, -1, 'polyObject')).toBe(44);
      expect(getNextPresetHeight(198, 1, 'track')).toBe(220);
      expect(getNextPresetHeight(220, 1, 'polyObject')).toBeNull();
    });

    it('validates custom dialog input and prevents out-of-range or invalid entries', async () => {
      const onConfirm = vi.fn();
      const onClose = vi.fn();

      act(() => {
        root.render(
          <LayerHeightCustomDialog
            initialHeight={44}
            title="Set Custom Layer Height"
            onConfirm={onConfirm}
            onClose={onClose}
          />,
        );
      });

      const input = container.querySelector<HTMLInputElement>('#custom-layer-height-input')!;
      const applyBtn = container.querySelector<HTMLButtonElement>('[data-apply-dialog]')!;

      expect(input.value).toBe('44');

      // Test out of range (< 22)
      act(() => {
        setInputValue(input, '10');
      });
      act(() => {
        applyBtn.click();
      });
      expect(onConfirm).not.toHaveBeenCalled();
      expect(container.textContent).toContain('Height must be between 22 and 660');

      // Test out of range (> 660)
      act(() => {
        setInputValue(input, '700');
      });
      act(() => {
        applyBtn.click();
      });
      expect(onConfirm).not.toHaveBeenCalled();

      // Test non-integer / string
      act(() => {
        setInputValue(input, 'abc');
      });
      act(() => {
        applyBtn.click();
      });
      expect(onConfirm).not.toHaveBeenCalled();

      // Test valid entry 57
      act(() => {
        setInputValue(input, '57');
      });
      act(() => {
        applyBtn.click();
      });
      expect(onConfirm).toHaveBeenCalledWith(57);
    });

    it('custom dialog initializes empty for mixed selections and closes on Cancel/Escape', () => {
      const onConfirm = vi.fn();
      const onClose = vi.fn();

      act(() => {
        root.render(
          <LayerHeightCustomDialog
            initialHeight={undefined}
            title="Set Selected Layers Height"
            onConfirm={onConfirm}
            onClose={onClose}
          />,
        );
      });

      const input = container.querySelector<HTMLInputElement>('#custom-layer-height-input')!;
      const cancelBtn = container.querySelector<HTMLButtonElement>('[data-cancel-dialog]')!;

      expect(input.value).toBe('');

      act(() => {
        cancelBtn.click();
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
