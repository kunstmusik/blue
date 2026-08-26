// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import ArrangementPanel from '../components/workbench/panels/orchestra/ArrangementPanel';
import JMaskEditor from '../components/workbench/panels/score-object/editors/JMaskEditor';
import FontChooserDialog from '../components/workbench/panels/orchestra/bsb/FontChooserDialog';
import { HostDocumentContext } from '../hooks/use-host-document';
import {
  BlueData,
  JMask,
  PolyObject,
  SoundLayer,
  TimeDuration,
} from '@blue/data';
import {
  createScoreObjectEditorDocument,
  type ScoreObjectEditorDocumentSnapshot,
  type ScoreObjectEditorTargetSnapshot,
} from '../../shared/project-editor';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const popout = new JSDOM('<!doctype html><html><body></body></html>');
const popoutDoc = popout.window.document;
const PopoutMouseEvent = popout.window.MouseEvent;
(popout.window.HTMLElement.prototype as HTMLElement & { scrollIntoView?: () => void }).scrollIntoView ??= () => undefined;
popout.window.Element.prototype.hasPointerCapture ??= () => false;
popout.window.Element.prototype.setPointerCapture ??= () => undefined;
popout.window.Element.prototype.releasePointerCapture ??= () => undefined;

function makeJMaskDocument(): ScoreObjectEditorDocumentSnapshot {
  const data = new BlueData();
  data.getScore().length = 0;
  const poly = new PolyObject();
  const layer = new SoundLayer();
  const jmask = new JMask();
  jmask.setName('JMask');
  jmask.setSubjectiveDuration(TimeDuration.beats(6));
  layer.push(jmask);
  poly.push(layer);
  data.getScore().push(poly);
  const target: ScoreObjectEditorTargetSnapshot = {
    selectionId: 'sobj-0-0',
    selectedObjectType: 'JMask',
    editorObjectType: 'JMask',
    ownerKind: 'timeline',
    displayContext: 'timeline',
    location: { rootGroupIndex: 0, containerPath: [], layerIndex: 0, objectIndex: 0 },
    supportsTimeBehavior: true,
    supportsRepeatPoint: true,
    supportsNoteProcessorChain: true,
  };
  const doc = createScoreObjectEditorDocument(data, { target });
  if (!doc) throw new Error('expected JMask document');
  return doc;
}

describe('follow-up host-surface migrations (spec 090, T026-T028)', () => {
  let host: HTMLDivElement;
  let root: Root;

  const renderTree = (node: React.ReactElement) => {
    act(() => {
      root.render(<HostDocumentContext.Provider value={popoutDoc}>{node}</HostDocumentContext.Provider>);
    });
  };

  const flushFrame = async () => {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  };

  const click = (element: Element) => {
    act(() => {
      element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
  };

  const surface = () => popoutDoc.body.querySelector<HTMLElement>('[data-host-surface]');

  beforeEach(() => {
    Object.defineProperty(popout.window, 'innerWidth', { configurable: true, value: 800 });
    Object.defineProperty(popout.window, 'innerHeight', { configurable: true, value: 600 });
    for (const element of [popoutDoc.documentElement, popoutDoc.body]) {
      Object.defineProperty(element, 'clientWidth', { configurable: true, get: () => 800 });
      Object.defineProperty(element, 'clientHeight', { configurable: true, get: () => 600 });
    }
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    popoutDoc.body.innerHTML = '';
  });

  it('ArrangementPanel + Add menu portals into the host document and commits on select', async () => {
    const onOrchestraPatch = vi.fn();
    renderTree(
      <ArrangementPanel
        rows={[]}
        selectedAssignmentId={null}
        onSelectAssignment={vi.fn()}
        onOrchestraPatch={onOrchestraPatch}
        projectSessionId={1}
        projectRevision={1}
      />,
    );
    const addButton = [...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === '+ Add')!;
    click(addButton);
    await flushFrame();

    const menu = surface();
    expect(menu).toBeTruthy();
    expect(menu!.textContent).toContain('Generic Instrument');

    // Main-window input never dismisses a popout-hosted menu.
    act(() => {
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(surface()).toBeTruthy();

    click([...menu!.querySelectorAll('button')].find((b) => b.textContent === 'Generic Instrument')!);
    await flushFrame();
    expect(onOrchestraPatch).toHaveBeenCalledWith({ type: 'addInstrument', instrumentType: 'generic' });
    expect(surface()).toBeNull();
  });

  it('JMaskEditor parameter-visibility popup portals into the host document and dismisses outside', async () => {
    renderTree(<JMaskEditor document={makeJMaskDocument()} onPatch={vi.fn()} />);
    const visibilityButton = host.querySelector<HTMLButtonElement>('button[aria-label="Parameter Visibility"]')!;
    expect(visibilityButton).toBeTruthy();
    click(visibilityButton);
    await flushFrame();

    expect(surface()).toBeTruthy();
    expect(surface()!.getAttribute('role')).toBe('menu');

    // Main-window input is foreign; host-document outside press dismisses.
    act(() => {
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(surface()).toBeTruthy();
    act(() => {
      popoutDoc.body.dispatchEvent(new PopoutMouseEvent('mousedown', { bubbles: true }));
    });
    expect(surface()).toBeNull();
  });

  it('FontChooserDialog uses compact, consistent host menus for font and style', async () => {
    const onCancel = vi.fn();
    renderTree(
      <FontChooserDialog
        open
        font={{ name: 'Roboto', size: 12, style: 0 }}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );
    // The font trigger is the button showing the current font name.
    const fontButton = [...host.querySelectorAll('button')]
      .find((b) => b.textContent?.trim() === 'Roboto')!;
    expect(fontButton).toBeTruthy();
    Object.defineProperty(fontButton, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        left: 100, top: 100, right: 284, bottom: 130,
        width: 184, height: 30, x: 100, y: 100,
      }),
    });
    click(fontButton);
    await flushFrame();

    const dropdown = surface();
    expect(dropdown).toBeTruthy();
    const filterInput = dropdown!.querySelector('input')!;
    expect(filterInput).toBeTruthy();
    expect(dropdown!.style.width).toBe('max-content');
    expect(dropdown!.style.minWidth).toBe('184px');
    expect(dropdown!.style.maxHeight).not.toBe('192px'); // no fixed max-h-48 cap

    // Escape inside the dropdown closes the dropdown but NOT the dialog
    // (nested-surface rule).
    act(() => {
      filterInput.dispatchEvent(new popout.window.KeyboardEvent('keydown', {
        key: 'Escape', bubbles: true,
      }));
    });
    await flushFrame();
    expect(surface()).toBeNull();
    expect(onCancel).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Choose Font');

    // Outside press within the host document also closes only the dropdown.
    click(fontButton);
    await flushFrame();
    expect(surface()).toBeTruthy();
    act(() => {
      popoutDoc.body.dispatchEvent(new PopoutMouseEvent('mousedown', { bubbles: true }));
    });
    expect(surface()).toBeNull();
    expect(host.textContent).toContain('Choose Font');

    // Style uses the same app-owned surface instead of a native select menu.
    expect(host.querySelector('select')).toBeNull();
    const styleButton = [...host.querySelectorAll('button')]
      .find((button) => button.textContent?.trim() === 'Plain')!;
    click(styleButton);
    await flushFrame();
    const styleMenu = popoutDoc.querySelector<HTMLElement>('[role="listbox"]');
    expect(styleMenu).toBeTruthy();
    expect(styleMenu!.closest('[data-auxiliary-portal="true"]')?.className).toContain('bg-app-menu');
    const boldOption = [...styleMenu!.querySelectorAll<HTMLElement>('[role="option"]')]
      .find((option) => option.textContent?.trim() === 'Bold')!;
    click(boldOption);
    await flushFrame();
    expect(surface()).toBeNull();
    expect(host.textContent).toContain('Roboto 12 Bold');
  });
});
