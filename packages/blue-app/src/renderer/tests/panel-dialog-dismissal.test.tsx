// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import NoteProcessorChainEditor from '../components/workbench/panels/score-object/note-processors/NoteProcessorChainEditor';
import RulerConfigDialog from '../components/workbench/panels/score/RulerConfigDialog';
import ShiftObjectsDialog from '../components/workbench/panels/score/ShiftObjectsDialog';
import MeterEntryDialog from '../components/workbench/panels/score/MeterEntryDialog';
import { FileManagerRootRenameDialog } from '../components/workbench/panels/tools/file-manager/FileManagerRootRenameDialog';
import { HostDocumentContext } from '../hooks/use-host-document';
import type {
  MeterMapSnapshot,
  NoteProcessorChainSnapshot,
  ScoreTimeStateSnapshot,
} from '../../shared/project-editor';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

// The "popout window": a second JSDOM realm hosting a floated panel.
const popout = new JSDOM('<!doctype html><html><body></body></html>');
const popoutDoc = popout.window.document;
const PopoutMouseEvent = popout.window.MouseEvent;
const PopoutKeyboardEvent = popout.window.KeyboardEvent;

const EMPTY_CHAIN: NoteProcessorChainSnapshot = {
  processors: [],
  hasUnsupportedProcessors: false,
  hasDeferredProcessors: false,
};

const MOCK_METER_MAP: MeterMapSnapshot = {
  entries: [{ measure: 1, numBeats: 4, beatLength: 4, startBeat: 0 }],
};

const TIME_STATE: ScoreTimeStateSnapshot = {
  snapEnabled: false,
  snapValue: 'BEAT',
  primaryTimeDisplay: 'BEATS',
  secondaryTimeDisplay: 'SMPTE',
  secondaryRulerEnabled: false,
  tempoRowVisible: true,
  meterRowVisible: false,
  markersRowVisible: false,
  smpteFrameRate: 30,
  zoomIterations: 3,
};

describe('panel dialogs and inline menus in a floated (popout) panel', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    popoutDoc.body.innerHTML = '';
  });

  function renderUnderPopout(node: React.ReactElement): void {
    act(() => {
      root.render(
        <HostDocumentContext.Provider value={popoutDoc}>{node}</HostDocumentContext.Provider>,
      );
    });
  }

  it('NoteProcessorChainEditor: add menu dismisses on popout mousedown, ignores main-window input', async () => {
    renderUnderPopout(<NoteProcessorChainEditor chain={EMPTY_CHAIN} onCommit={vi.fn()} />);

    const addButton = [...host.querySelectorAll<HTMLElement>('button')].find(
      (node) => node.textContent?.trim() === '+ Add',
    )!;
    expect(addButton).toBeTruthy();

    act(() => {
      addButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    const openMenu = () => popoutDoc.body.querySelector<HTMLElement>('[data-host-surface]');
    expect(openMenu()).toBeTruthy();

    // Listener attaches in an effect; flush before asserting dismissal routing.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // Main-window input must not dismiss a panel hosted in the popout window.
    act(() => {
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(openMenu()).toBeTruthy();

    // Outside mousedown inside the hosting document dismisses.
    act(() => {
      popoutDoc.body.dispatchEvent(new PopoutMouseEvent('mousedown', { bubbles: true }));
    });
    expect(openMenu()).toBeFalsy();
  });

  it('RulerConfigDialog: Escape routes through the hosting window only', async () => {
    const onClose = vi.fn();
    const onApply = vi.fn();
    renderUnderPopout(
      <RulerConfigDialog timeState={TIME_STATE} onApply={onApply} onClose={onClose} />,
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // Main-window Escape must NOT close a dialog hosted by the popout window.
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onClose).not.toHaveBeenCalled();

    // Hosting-window Escape closes.
    act(() => {
      popout.window.dispatchEvent(new PopoutKeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    void onApply;
  });

  it('ShiftObjectsDialog: modal state, backdrop dismissal, and popout Escape routing', async () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    renderUnderPopout(<ShiftObjectsDialog onConfirm={onConfirm} onClose={onClose} />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const dialog = host.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');

    // Main-window Escape must NOT close
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onClose).not.toHaveBeenCalled();

    // Clicking dialog content does not close
    act(() => {
      dialog?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onClose).not.toHaveBeenCalled();

    // Popout-window Escape closes
    act(() => {
      popout.window.dispatchEvent(new PopoutKeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('MeterEntryDialog: traps focus, honors popout Escape, and dismisses on backdrop click', async () => {
    const onClose = vi.fn();
    const onMeterPatch = vi.fn();
    renderUnderPopout(
      <MeterEntryDialog
        entryIndex={0}
        meterMap={MOCK_METER_MAP}
        onMeterPatch={onMeterPatch}
        onClose={onClose}
      />,
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const dialog = host.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');

    // Main-window Escape must NOT close
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onClose).not.toHaveBeenCalled();

    // Popout-window Escape closes
    act(() => {
      popout.window.dispatchEvent(new PopoutKeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('FileManagerRootRenameDialog: modal state and popout Escape routing', async () => {
    const onCancel = vi.fn();
    const onSubmit = vi.fn();
    renderUnderPopout(
      <FileManagerRootRenameDialog
        initialLabel="Samples"
        path="/audio/samples"
        onCancel={onCancel}
        onSubmit={onSubmit}
      />,
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const dialog = host.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');

    // Main-window Escape must NOT cancel
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onCancel).not.toHaveBeenCalled();

    // Popout-window Escape cancels
    act(() => {
      popout.window.dispatchEvent(new PopoutKeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
