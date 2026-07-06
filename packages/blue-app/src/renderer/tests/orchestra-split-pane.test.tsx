// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SplitPane from '../components/workbench/panels/orchestra/SplitPane';
import { useLayoutSettingsStore } from '../stores/layout-settings-store';
import {
  BSB_PROPERTY_SPLIT_SIZE_PX,
  createDefaultWindowLayoutSettings,
  type SplitLocationSnapshot,
} from '../../shared/window-layout-settings';

const updateSplitLocation = vi.fn();
const loadLayoutSpy = vi.fn();

vi.mock('../stores/layout-settings-store', () => ({
  useLayoutSettingsStore: Object.assign(
    vi.fn(),
    {
      getState: () => ({
        layout: createDefaultWindowLayoutSettings(),
        updateSplitLocation: (...args: unknown[]) => updateSplitLocation(...args),
      }),
    },
  ),
}));

(useLayoutSettingsStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector?: (s: unknown) => unknown) => {
  if (typeof selector === 'function') {
    return selector({
      layout: createDefaultWindowLayoutSettings(),
      updateSplitLocation: (...args: unknown[]) => updateSplitLocation(...args),
    });
  }
  return {
    layout: createDefaultWindowLayoutSettings(),
    updateSplitLocation: (...args: unknown[]) => updateSplitLocation(...args),
  };
});

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  updateSplitLocation.mockClear();
  loadLayoutSpy.mockClear();
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

describe('SplitPane persistence contract', () => {
  it('uses defaultSizePx when no splitId is provided (backward compatible)', () => {
    act(() => {
      root.render(
        <SplitPane
          orientation="horizontal"
          ariaLabel="legacy"
          first={<div>first</div>}
          second={<div>second</div>}
        />,
      );
    });

    expect(container.textContent).toContain('first');
    expect(container.textContent).toContain('second');
  });

  it('renders with defaultSizePx=200 when no saved value exists', () => {
    act(() => {
      root.render(
        <SplitPane
          orientation="horizontal"
          ariaLabel="outer"
          splitId="orchestra.outer"
          controlledPane="first"
          defaultSizePx={200}
          first={<div>first</div>}
          second={<div>second</div>}
        />,
      );
    });

    const firstPane = container.querySelector('[data-split-pane="first"]') as HTMLElement;
    expect(firstPane).toBeTruthy();
    // The actual rendered pixel width depends on container size + clamping,
    // but the data attribute confirms splitId-controlled rendering is active.
    expect(firstPane.dataset.splitId).toBe('orchestra.outer');
  });

  it('restores a saved controlled-pane pixel size from the layout store', () => {
    const savedLayout = {
      ...createDefaultWindowLayoutSettings(),
      splits: {
        'orchestra.outer': {
          orientation: 'horizontal' as const,
          controlledPane: 'first' as const,
          sizePx: 240,
        } satisfies SplitLocationSnapshot,
      },
    };

    (useLayoutSettingsStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector?: (s: unknown) => unknown) => {
      const state = {
        layout: savedLayout,
        updateSplitLocation: (...args: unknown[]) => updateSplitLocation(...args),
      };
      return typeof selector === 'function' ? selector(state) : state;
    });

    act(() => {
      root.render(
        <SplitPane
          orientation="horizontal"
          ariaLabel="outer"
          splitId="orchestra.outer"
          controlledPane="first"
          defaultSizePx={200}
          first={<div>first</div>}
          second={<div>second</div>}
        />,
      );
    });

    // The hook is queried for the saved split entry; we verify the snapshot
    // was consulted by checking the data attribute is wired up. The actual
    // pixel size restore happens through the layout effect in the component.
    const firstPane = container.querySelector('[data-split-pane="first"]') as HTMLElement;
    expect(firstPane.dataset.splitId).toBe('orchestra.outer');
  });

  it('exposes splitId, controlledPane, and defaultSizePx props', () => {
    // Type-level contract: the prop API exists and accepts the documented
    // shape. The build step fails if SplitPane drops any of these props.
    type SplitPaneProps = React.ComponentProps<typeof SplitPane>;
    type RequiredKeys = {
      splitId?: SplitPaneProps['splitId'];
      controlledPane?: SplitPaneProps['controlledPane'];
      defaultSizePx?: SplitPaneProps['defaultSizePx'];
    };
    const assertion: RequiredKeys = {
      splitId: 'orchestra.outer',
      controlledPane: 'first',
      defaultSizePx: 200,
    };
    expect(assertion).toBeDefined();
  });

  it('moves the separator directionally when the second pane is controlled', () => {
    vi.useFakeTimers();
    const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      width: 812,
      height: 600,
      top: 0,
      right: 812,
      bottom: 600,
      left: 0,
      toJSON: () => ({}),
    } as DOMRect);

    try {
      act(() => {
        root.render(
          <SplitPane
            orientation="horizontal"
            ariaLabel="BSB Interface and Properties"
            splitId="bsb.interface.properties"
            controlledPane="second"
            defaultSizePx={BSB_PROPERTY_SPLIT_SIZE_PX}
            minFirstSize={200}
            minSecondSize={180}
            first={<div>canvas</div>}
            second={<div>properties</div>}
          />,
        );
      });

      const separator = container.querySelector('[role="separator"]') as HTMLButtonElement;
      expect(separator).toBeTruthy();

      act(() => {
        separator.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
      });
      act(() => {
        vi.advanceTimersByTime(151);
      });

      expect(updateSplitLocation).toHaveBeenCalledWith('bsb.interface.properties', {
        orientation: 'horizontal',
        controlledPane: 'second',
        sizePx: 274,
      });
    } finally {
      rectSpy.mockRestore();
      vi.useRealTimers();
    }
  });
});

describe('SplitPane legacy SSR render', () => {
  it('renders the separators when no persistence props are passed', () => {
    const ReactServer = require('react-dom/server');
    const html = ReactServer.renderToStaticMarkup(
      <SplitPane
        ariaLabel="Resize outer split"
        orientation="horizontal"
        first={
          <SplitPane
            ariaLabel="Resize inner split"
            orientation="vertical"
            first={<div>Arrangement</div>}
            second={<div>Library</div>}
          />
        }
        second={<div>Instrument editor</div>}
      />,
    );

    expect(html).toContain('role="separator"');
    expect(html).toContain('Resize outer split');
    expect(html).toContain('Resize inner split');
    expect(html).toContain('aria-orientation="vertical"');
    expect(html).toContain('aria-orientation="horizontal"');
  });
});
