// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import NoteProcessorChainEditor from '../components/workbench/panels/score-object/note-processors/NoteProcessorChainEditor';
import RulerConfigDialog from '../components/workbench/panels/score/RulerConfigDialog';
import { HostDocumentContext } from '../hooks/use-host-document';
import type {
  NoteProcessorChainSnapshot,
  ScoreTimeStateSnapshot,
} from '../../shared/project-editor';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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
        <HostDocumentContext.Provider value={popoutDoc}>
          {node}
        </HostDocumentContext.Provider>,
      );
    });
  }

  it('NoteProcessorChainEditor: add menu dismisses on popout mousedown, ignores main-window input', async () => {
    renderUnderPopout(
      <NoteProcessorChainEditor chain={EMPTY_CHAIN} onCommit={vi.fn()} />,
    );

    const addButton = [...host.querySelectorAll<HTMLElement>('button')]
      .find((node) => node.textContent?.trim() === '+ Add')!;
    expect(addButton).toBeTruthy();

    act(() => {
      addButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    const openMenu = () => host.querySelector<HTMLElement>('div.relative > div.absolute');
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
});
