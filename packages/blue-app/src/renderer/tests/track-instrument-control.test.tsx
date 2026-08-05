// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TrackInstrumentControl from '../components/workbench/panels/score/TrackInstrumentControl';
import type { TrackInstrumentSummary } from '../../shared/project-editor';

const mocks = vi.hoisted(() => ({
  applyProjectDocumentPatch: vi.fn(),
  captureTrackInstrument: vi.fn(),
  openTrackInstrumentEditor: vi.fn(),
  pasteLibraryInstrument: vi.fn(),
  libraryDrop: {
    active: false,
    canPaste: false,
    feedback: null as string | null,
    paste: vi.fn(),
    dropProps: {},
  },
}));

vi.mock('../stores/project-store', () => ({
  useProjectStore: (selector: (state: { applyProjectDocumentPatch: typeof mocks.applyProjectDocumentPatch }) => unknown) => selector({
    applyProjectDocumentPatch: mocks.applyProjectDocumentPatch,
  }),
}));

vi.mock('../stores/library-store', () => ({
  useLibraryStore: (selector: (state: { captureTrackInstrument: typeof mocks.captureTrackInstrument }) => unknown) => selector({
    captureTrackInstrument: mocks.captureTrackInstrument,
  }),
}));

vi.mock('../components/libraries/use-library-drop-target', () => ({
  useLibraryDropTarget: () => mocks.libraryDrop,
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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
    mocks.captureTrackInstrument.mockReset();
    mocks.captureTrackInstrument.mockResolvedValue(true);
    mocks.openTrackInstrumentEditor.mockReset();
    mocks.pasteLibraryInstrument.mockReset();
    mocks.libraryDrop = {
      active: false,
      canPaste: false,
      feedback: null,
      paste: mocks.pasteLibraryInstrument,
      dropProps: {},
    };
  });

  it('uses an icon-only control and opens the assigned instrument only on double click', () => {
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
        />,
      );
    });

    const instrumentButton = container.querySelector('button[title="Track Instrument: Lead Instrument"]') as HTMLButtonElement;
    act(() => instrumentButton.click());
    expect(mocks.openTrackInstrumentEditor).not.toHaveBeenCalled();

    act(() => instrumentButton.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })));
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
        />,
      );
    });

    const instrumentButton = container.querySelector('button[aria-label="Assign Track Instrument"]');
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
        />,
      );
    });

    const control = container.querySelector('[data-track-instrument-control="control-track"]') as HTMLElement;
    await act(async () => {
      control.dispatchEvent(new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        button: 2,
        clientX: 20,
        clientY: 20,
      }));
      await Promise.resolve();
    });

    const menuItems = Array.from(document.body.querySelectorAll('[role="menuitem"]'));
    const instrumentSubmenu = menuItems.find((item) => item.textContent === 'Use New Instrument');
    expect(instrumentSubmenu?.getAttribute('aria-haspopup')).toBe('menu');
    expect(menuItems.some((item) => item.textContent?.includes('Use New Instrument ·'))).toBe(false);

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
        />,
      );
    });

    const control = container.querySelector('[data-track-instrument-control="control-track"]') as HTMLElement;
    act(() => control.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })));
    await act(async () => { await Promise.resolve(); });
    let menuItems = Array.from(document.body.querySelectorAll('[role="menuitem"]')) as HTMLElement[];
    expect(menuItems.map((item) => item.textContent)).toEqual([
      'Use New Instrument',
      'Cut',
      'Copy',
      'Paste',
    ]);
    expect(menuItems[1]!.getAttribute('data-disabled')).toBeNull();
    expect(menuItems[2]!.getAttribute('data-disabled')).toBeNull();
    expect(menuItems[3]!.getAttribute('data-disabled')).toBeNull();

    act(() => menuItems[2]!.click());
    expect(mocks.captureTrackInstrument).toHaveBeenCalledWith({
      projectSessionId: 1,
      projectRevision: 2,
      rootGroupId: 'control-group',
      trackId: 'control-track',
    });

    act(() => control.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })));
    await act(async () => { await Promise.resolve(); });
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

    act(() => control.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })));
    await act(async () => { await Promise.resolve(); });
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
        />,
      );
    });

    const control = container.querySelector('[data-track-instrument-control="control-track"]') as HTMLElement;
    expect(control.title).toBe('Compatible Library insertion point.');
    expect(control.getAttribute('data-drop-probe')).toBe('active');
    act(() => control.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })));
    await act(async () => { await Promise.resolve(); });
    const byLabel = (label: string) => Array.from(document.body.querySelectorAll('[role="menuitem"]'))
      .find((item) => item.textContent === label) as HTMLElement;
    expect(byLabel('Cut').getAttribute('data-disabled')).not.toBeNull();
    expect(byLabel('Copy').getAttribute('data-disabled')).not.toBeNull();
    expect(byLabel('Paste').getAttribute('data-disabled')).not.toBeNull();

    act(() => root.unmount());
  });
});
