// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TrackInstrumentControl from '../components/workbench/panels/score/TrackInstrumentControl';
import type { TrackInstrumentSummary } from '../../shared/project-editor';

const mocks = vi.hoisted(() => ({
  applyProjectDocumentPatch: vi.fn(),
  flushPendingPatches: vi.fn(),
  captureTrackInstrument: vi.fn(),
  openTrackInstrumentEditor: vi.fn(),
  pasteLibraryInstrument: vi.fn(),
  focusTrack: vi.fn(),
  getProjectDocumentRevision: vi.fn(() => 3),
  toastError: vi.fn(),
  libraryDrop: {
    active: false,
    canPaste: false,
    feedback: null as string | null,
    paste: vi.fn(),
    dropProps: {},
  },
}));

vi.mock('../stores/project-store', () => ({
  getProjectDocumentRevision: mocks.getProjectDocumentRevision,
  useProjectStore: (
    selector: (state: {
      applyProjectDocumentPatch: typeof mocks.applyProjectDocumentPatch;
      flushPendingPatches: typeof mocks.flushPendingPatches;
    }) => unknown,
  ) =>
    selector({
      applyProjectDocumentPatch: mocks.applyProjectDocumentPatch,
      flushPendingPatches: mocks.flushPendingPatches,
    }),
}));

vi.mock('sonner', () => ({
  toast: { error: mocks.toastError },
}));

vi.mock('../stores/library-store', () => ({
  useLibraryStore: (
    selector: (state: { captureTrackInstrument: typeof mocks.captureTrackInstrument }) => unknown,
  ) =>
    selector({
      captureTrackInstrument: mocks.captureTrackInstrument,
    }),
}));

vi.mock('../stores/midi-routing-store', () => ({
  useMidiRoutingStore: {
    getState: () => ({ focusTrack: mocks.focusTrack }),
  },
}));

vi.mock('../components/libraries/use-library-drop-target', () => ({
  useLibraryDropTarget: () => mocks.libraryDrop,
}));

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function makeInstrument(): TrackInstrumentSummary {
  return {
    trackId: 'control-track',
    type: 'generic',
    name: 'Lead Instrument',
    enabled: true,
    instrumentType: 'GenericInstrument',
    snapshot: {
      assignmentId: 'control-track',
      type: 'generic',
      name: 'Lead Instrument',
      enabled: true,
      comment: '',
      text: 'out a1',
      globalOrc: '',
      globalSco: '',
      udolist: [],
    },
  };
}

describe('TrackInstrumentControl', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    mocks.applyProjectDocumentPatch.mockReset();
    mocks.flushPendingPatches.mockReset();
    mocks.flushPendingPatches.mockResolvedValue(undefined);
    mocks.captureTrackInstrument.mockReset();
    mocks.captureTrackInstrument.mockResolvedValue(true);
    mocks.openTrackInstrumentEditor.mockReset();
    mocks.getProjectDocumentRevision.mockClear();
    mocks.toastError.mockReset();
    mocks.pasteLibraryInstrument.mockReset();
    mocks.focusTrack.mockReset();
    mocks.libraryDrop = {
      active: false,
      canPaste: false,
      feedback: null,
      paste: mocks.pasteLibraryInstrument,
      dropProps: {},
    };
  });

  it('uses an icon-only control, focuses on click, and opens the assigned instrument on double click', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    window.blueAPI = {
      openTrackInstrumentEditor: mocks.openTrackInstrumentEditor,
    } as never;

    act(() => {
      root.render(
        <TrackInstrumentControl
          groupId="control-group"
          trackId="control-track"
          instrument={makeInstrument()}
          projectSessionId={1}
          projectRevision={2}
          displayName="Lead"
        />,
      );
    });

    const instrumentButton = container.querySelector(
      'button[title="Track Instrument: Lead Instrument"]',
    ) as HTMLButtonElement;
    act(() => instrumentButton.click());
    expect(mocks.openTrackInstrumentEditor).not.toHaveBeenCalled();

    await act(async () => {
      instrumentButton.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      await Promise.resolve();
    });
    expect(mocks.flushPendingPatches).toHaveBeenCalledTimes(1);
    expect(mocks.openTrackInstrumentEditor).toHaveBeenCalledWith({
      track: {
        rootGroupId: 'control-group',
        trackId: 'control-track',
        projectSessionId: 1,
        projectRevision: 2,
      },
    });
    expect(instrumentButton.querySelector('svg')).not.toBeNull();
    expect(container.textContent).not.toContain('Lead Instrument');

    act(() => root.unmount());
  });

  it('can open a newly assigned instrument before its canonical snapshot arrives', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    window.blueAPI = {
      openTrackInstrumentEditor: mocks.openTrackInstrumentEditor,
    } as never;

    const optimisticInstrument = makeInstrument();
    delete optimisticInstrument.snapshot;
    act(() => {
      root.render(
        <TrackInstrumentControl
          groupId="control-group"
          trackId="control-track"
          instrument={optimisticInstrument}
          projectSessionId={1}
          projectRevision={2}
          displayName="Lead"
        />,
      );
    });

    await act(async () => {
      (
        container.querySelector(
          'button[title="Track Instrument: Lead Instrument"]',
        ) as HTMLButtonElement
      ).dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      await Promise.resolve();
    });

    expect(mocks.openTrackInstrumentEditor).toHaveBeenCalledWith({
      track: {
        rootGroupId: 'control-group',
        trackId: 'control-track',
        projectSessionId: 1,
        projectRevision: 2,
      },
    });

    act(() => root.unmount());
  });

  it('reports an editor-open failure to the user', async () => {
    mocks.openTrackInstrumentEditor.mockRejectedValue(
      new Error('Track instrument is not available'),
    );

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    window.blueAPI = {
      openTrackInstrumentEditor: mocks.openTrackInstrumentEditor,
    } as never;

    act(() => {
      root.render(
        <TrackInstrumentControl
          groupId="control-group"
          trackId="control-track"
          instrument={makeInstrument()}
          projectSessionId={1}
          projectRevision={2}
          displayName="Lead"
        />,
      );
    });

    await act(async () => {
      (
        container.querySelector(
          'button[title="Track Instrument: Lead Instrument"]',
        ) as HTMLButtonElement
      ).dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      await Promise.resolve();
    });

    expect(mocks.toastError).toHaveBeenCalledWith(
      'Failed to open Track instrument editor: Track instrument is not available',
    );

    act(() => root.unmount());
  });

  it('keeps the unassigned state icon-only', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <TrackInstrumentControl
          groupId="control-group"
          trackId="control-track"
          instrument={null}
          projectSessionId={1}
          projectRevision={2}
          displayName="Lead"
        />,
      );
    });

    const instrumentButton = container.querySelector(
      'button[aria-label="Assign Track Instrument"]',
    );
    expect(instrumentButton).not.toBeNull();
    expect(container.textContent).not.toContain('No Instrument');

    act(() => root.unmount());
  });

  it('opens a nested instrument-type submenu from the context menu', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <TrackInstrumentControl
          groupId="control-group"
          trackId="control-track"
          instrument={null}
          projectSessionId={1}
          projectRevision={2}
          displayName="Lead"
        />,
      );
    });

    const control = container.querySelector(
      '[data-track-instrument-control="control-track"]',
    ) as HTMLElement;
    await act(async () => {
      control.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          button: 2,
          clientX: 20,
          clientY: 20,
        }),
      );
      await Promise.resolve();
    });

    const menuItems = Array.from(document.body.querySelectorAll('[role="menuitem"]'));
    const instrumentSubmenu = menuItems.find((item) => item.textContent === 'Use New Instrument');
    expect(instrumentSubmenu?.getAttribute('aria-haspopup')).toBe('menu');
    expect(menuItems.some((item) => item.textContent?.includes('Use New Instrument ·'))).toBe(
      false,
    );
    expect(
      menuItems
        .find((item) => item.textContent === 'Edit Instrument')
        ?.getAttribute('data-disabled'),
    ).not.toBeNull();

    act(() => root.unmount());
  });

  it('reports a failed BlueX7 Track assignment instead of swallowing it', async () => {
    mocks.applyProjectDocumentPatch.mockResolvedValue(undefined);
    mocks.flushPendingPatches
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Track instrument change was not applied'));

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <TrackInstrumentControl
          groupId="control-group"
          trackId="control-track"
          instrument={null}
          projectSessionId={1}
          projectRevision={2}
          displayName="Lead"
        />,
      );
    });

    const control = container.querySelector(
      '[data-track-instrument-control="control-track"]',
    ) as HTMLElement;
    act(() =>
      control.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })),
    );
    await act(async () => {
      await Promise.resolve();
    });

    const submenuTrigger = Array.from(document.body.querySelectorAll('[role="menuitem"]')).find(
      (item) => item.textContent === 'Use New Instrument',
    ) as HTMLElement;
    const pointerMove = new Event('pointermove', { bubbles: true });
    Object.defineProperty(pointerMove, 'pointerType', { value: 'mouse' });
    act(() => submenuTrigger.dispatchEvent(pointerMove));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 120));
    });

    const blueX7Item = Array.from(document.body.querySelectorAll('[role="menuitem"]')).find(
      (item) => item.textContent === 'BlueX7 Instrument',
    ) as HTMLElement;
    expect(blueX7Item).toBeDefined();

    await act(async () => {
      blueX7Item.click();
      await Promise.resolve();
    });

    expect(mocks.applyProjectDocumentPatch).toHaveBeenCalledWith({
      score: {
        type: 'createTrackInstrument',
        track: {
          rootGroupId: 'control-group',
          trackId: 'control-track',
          projectSessionId: 1,
          projectRevision: 3,
        },
        instrumentType: 'blueX7',
      },
    });
    expect(mocks.flushPendingPatches).toHaveBeenCalledTimes(2);
    expect(mocks.toastError).toHaveBeenCalledWith(
      'Failed to add BlueX7 Instrument to Track: Track instrument change was not applied',
    );

    act(() => root.unmount());
  });

  it('dispatches a BlueX7 assignment when nested in the Track row context menu', async () => {
    mocks.applyProjectDocumentPatch.mockResolvedValue(undefined);
    const parentContextMenu = vi.fn();
    const parentMouseDown = vi.fn();
    const parentPointerDown = vi.fn();

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <ContextMenu.Root>
          <ContextMenu.Trigger asChild>
            <div
              onContextMenu={parentContextMenu}
              onMouseDown={parentMouseDown}
              onPointerDown={parentPointerDown}
            >
              <TrackInstrumentControl
                groupId="control-group"
                trackId="control-track"
                instrument={null}
                projectSessionId={1}
                projectRevision={2}
                displayName="Lead"
              />
            </div>
          </ContextMenu.Trigger>
          <ContextMenu.Portal>
            <ContextMenu.Content>
              <ContextMenu.Item>Track row action</ContextMenu.Item>
            </ContextMenu.Content>
          </ContextMenu.Portal>
        </ContextMenu.Root>,
      );
    });

    const control = container.querySelector(
      '[data-track-instrument-control="control-track"]',
    ) as HTMLElement;
    act(() =>
      control.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })),
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(parentContextMenu).not.toHaveBeenCalled();

    const submenuTrigger = Array.from(document.body.querySelectorAll('[role="menuitem"]')).find(
      (item) => item.textContent === 'Use New Instrument',
    ) as HTMLElement;
    const pointerMove = new Event('pointermove', { bubbles: true });
    Object.defineProperty(pointerMove, 'pointerType', { value: 'mouse' });
    act(() => submenuTrigger.dispatchEvent(pointerMove));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 120));
    });

    const blueX7Item = Array.from(document.body.querySelectorAll('[role="menuitem"]')).find(
      (item) => item.textContent === 'BlueX7 Instrument',
    ) as HTMLElement;
    await act(async () => {
      blueX7Item.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      blueX7Item.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      blueX7Item.dispatchEvent(new Event('pointerup', { bubbles: true }));
      blueX7Item.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      blueX7Item.click();
      await Promise.resolve();
    });

    expect(parentPointerDown).not.toHaveBeenCalled();
    expect(parentMouseDown).not.toHaveBeenCalled();

    expect(mocks.applyProjectDocumentPatch).toHaveBeenCalledWith(
      expect.objectContaining({
        score: expect.objectContaining({
          type: 'createTrackInstrument',
          instrumentType: 'blueX7',
        }),
      }),
    );

    act(() => root.unmount());
  });

  it('orders Cut, Copy, and Paste exactly and invokes clipboard mutations', async () => {
    mocks.libraryDrop = {
      active: false,
      canPaste: true,
      feedback: null,
      paste: mocks.pasteLibraryInstrument,
      dropProps: {},
    };
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        <TrackInstrumentControl
          groupId="control-group"
          trackId="control-track"
          instrument={makeInstrument()}
          projectSessionId={1}
          projectRevision={2}
          displayName="Lead"
        />,
      );
    });

    const control = container.querySelector(
      '[data-track-instrument-control="control-track"]',
    ) as HTMLElement;
    act(() =>
      control.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })),
    );
    await act(async () => {
      await Promise.resolve();
    });
    let menuItems = Array.from(
      document.body.querySelectorAll('[role="menuitem"]'),
    ) as HTMLElement[];
    expect(menuItems.map((item) => item.textContent)).toEqual([
      'Edit Instrument',
      'Use New Instrument',
      'Cut',
      'Copy',
      'Paste',
    ]);
    expect(menuItems[1]!.getAttribute('data-disabled')).toBeNull();
    expect(menuItems[2]!.getAttribute('data-disabled')).toBeNull();
    expect(menuItems[3]!.getAttribute('data-disabled')).toBeNull();

    act(() => menuItems.find((item) => item.textContent === 'Copy')!.click());
    expect(mocks.captureTrackInstrument).toHaveBeenCalledWith({
      projectSessionId: 1,
      projectRevision: 2,
      rootGroupId: 'control-group',
      trackId: 'control-track',
    });

    act(() =>
      control.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })),
    );
    await act(async () => {
      await Promise.resolve();
    });
    menuItems = Array.from(document.body.querySelectorAll('[role="menuitem"]')) as HTMLElement[];
    await act(async () => {
      menuItems.find((item) => item.textContent === 'Cut')!.click();
      await Promise.resolve();
    });
    expect(mocks.captureTrackInstrument).toHaveBeenLastCalledWith({
      projectSessionId: 1,
      projectRevision: 2,
      rootGroupId: 'control-group',
      trackId: 'control-track',
    });
    expect(mocks.applyProjectDocumentPatch).toHaveBeenCalledWith({
      score: {
        type: 'clearTrackInstrument',
        track: {
          rootGroupId: 'control-group',
          trackId: 'control-track',
          projectSessionId: 1,
          projectRevision: 2,
        },
      },
    });

    act(() =>
      control.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })),
    );
    await act(async () => {
      await Promise.resolve();
    });
    menuItems = Array.from(document.body.querySelectorAll('[role="menuitem"]')) as HTMLElement[];
    act(() => menuItems.find((item) => item.textContent === 'Paste')!.click());
    expect(mocks.pasteLibraryInstrument).toHaveBeenCalledTimes(1);

    act(() => root.unmount());
  });

  it('disables Cut and Copy when unassigned and displays library drop feedback', async () => {
    mocks.libraryDrop = {
      active: true,
      canPaste: false,
      feedback: 'Compatible Library insertion point.',
      paste: mocks.pasteLibraryInstrument,
      dropProps: { 'data-drop-probe': 'active' },
    };
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        <TrackInstrumentControl
          groupId="control-group"
          trackId="control-track"
          instrument={null}
          projectSessionId={1}
          projectRevision={2}
          displayName="Lead"
        />,
      );
    });

    const control = container.querySelector(
      '[data-track-instrument-control="control-track"]',
    ) as HTMLElement;
    expect(control.title).toBe('Compatible Library insertion point.');
    expect(control.getAttribute('data-drop-probe')).toBe('active');
    act(() =>
      control.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })),
    );
    await act(async () => {
      await Promise.resolve();
    });
    const byLabel = (label: string) =>
      Array.from(document.body.querySelectorAll('[role="menuitem"]')).find(
        (item) => item.textContent === label,
      ) as HTMLElement;
    expect(byLabel('Cut').getAttribute('data-disabled')).not.toBeNull();
    expect(byLabel('Copy').getAttribute('data-disabled')).not.toBeNull();
    expect(byLabel('Paste').getAttribute('data-disabled')).not.toBeNull();

    act(() => root.unmount());
  });

  it('focuses the Track for MIDI routing on single click (Spec 067)', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    window.blueAPI = { openTrackInstrumentEditor: mocks.openTrackInstrumentEditor } as never;

    act(() => {
      root.render(
        <TrackInstrumentControl
          groupId="control-group"
          trackId="control-track"
          instrument={makeInstrument()}
          projectSessionId={1}
          projectRevision={2}
          displayName="Lead"
        />,
      );
    });

    const instrumentButton = container.querySelector(
      'button[title="Track Instrument: Lead Instrument"]',
    ) as HTMLButtonElement;
    act(() => instrumentButton.click());
    expect(mocks.focusTrack).toHaveBeenCalledWith({
      projectSessionId: 1,
      rootGroupId: 'control-group',
      trackId: 'control-track',
      displayName: 'Lead',
    });

    act(() => root.unmount());
  });
});
