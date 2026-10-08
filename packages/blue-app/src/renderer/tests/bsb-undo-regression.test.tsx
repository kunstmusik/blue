// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BlueData, BlueSynthBuilder, BSBGroup, BSBKnob } from '@blue/data';
import { prepareBsbWidgetCreation } from '../../shared/bsb-widget-commands';
import type { BsbInterfacePatch } from '../../shared/project-editor';
import { ProjectSession } from '../../main/project-session';
import { ProjectHistory } from '../../main/project-history';
import { MockHistoryContext } from '../../main/project-history-test-support';
import { buildSoundBSBInstrumentSnapshot } from '../../shared/project-editor/snapshot-mixer-orchestra';
import { buildWidgetTreeSnapshot } from '../../shared/project-editor/bsb-widgets';
import type {
  InstrumentPatch,
  BlueSynthBuilderInstrumentSnapshot,
} from '../../shared/project-editor';
import type { ProjectDocumentCommitMetadata } from '../../shared/project-history';
import BSBInterfaceEditor from '../components/workbench/panels/orchestra/bsb/BSBInterfaceEditor';
import { createProjectPatchQueue } from '../stores/project-store/project-patch-queue';
import { applyBsbInterfacePatchToSnapshot } from '../stores/project-store/bsb-interface-snapshot';
import { useBsbClipboardStore } from '../stores/bsb-clipboard-store';
import { settleHistoryEditors } from '../lib/history-scope-router';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
let mounted: { root: Root; container: HTMLDivElement } | undefined;
let frames: Map<number, FrameRequestCallback>;
let nextFrame: number;

beforeEach(() => {
  frames = new Map();
  nextFrame = 0;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    frames.delete(id);
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});
afterEach(() => {
  if (mounted) {
    act(() => mounted!.root.unmount());
    mounted.container.remove();
    mounted = undefined;
  }
  useBsbClipboardStore.getState().clearClipboard();
  vi.restoreAllMocks();
});

function frame() {
  act(() => {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach((callback) => callback(0));
  });
}

function fixture() {
  const data = new BlueData();
  const bsb = new BlueSynthBuilder();
  bsb.setBsbEditEnabled(true);
  bsb.setBsbGridSettings({ snapEnabled: false });
  const rootGroup = bsb.getGraphicInterface().getRootGroup();
  const panels = ['panel-a', 'panel-b'].map((id, index) => {
    const panel = new BSBGroup();
    panel.id = id;
    panel.groupName = id;
    panel.x = 10 + index * 200;
    panel.y = 20;
    rootGroup.addChild(panel);
    return panel;
  });
  const knob = new BSBKnob();
  knob.id = 'knob';
  knob.objectName = 'amp';
  knob.x = 10;
  knob.y = 15;
  panels[0].addChild(knob);
  data.getArrangement().addInstrument(bsb, '6');
  const session = new ProjectSession();
  session.replace(data);
  const history = new ProjectHistory({ session });
  history.checkpointSave();
  const context = new MockHistoryContext('bsb-undo');
  const documentId = session.read().documentId!;
  const currentBsb = () =>
    session.read().data!.getArrangement().getInstrumentById('6') as BlueSynthBuilder;
  const canonical = () => ({ ...buildSoundBSBInstrumentSnapshot(currentBsb()), assignmentId: '6' });
  let optimistic: BlueSynthBuilderInstrumentSnapshot = canonical();
  const errors: unknown[] = [];
  const submissions: ProjectDocumentCommitMetadata[] = [];
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  mounted = { root, container };
  const queue = createProjectPatchQueue({
    commit: async (patches, options) => {
      submissions.push(options!.metadata!);
      const result = await history.commit(
        context.nextCommitRequest(
          documentId,
          session.read().revision,
          options?.metadata?.label ?? 'BSB',
          [...patches],
          options?.metadata,
        ),
      );
      if (result.status !== 'committed' && result.status !== 'unchanged')
        throw new Error(JSON.stringify(result));
      return result.receipt!;
    },
    fetchCanonicalSnapshot: async () => null,
    applyCanonicalSnapshot: () => {},
    setDirty: () => {},
    reportBackgroundError: (error) => {
      errors.push(error);
    },
    logRefreshError: (error) => {
      errors.push(error);
    },
  });
  queue.reset(session.read().sessionId);
  const dispatch = (patch: InstrumentPatch, metadata?: ProjectDocumentCommitMetadata) => {
    expect(metadata?.phase).toBeDefined();
    optimistic = structuredClone(optimistic);
    applyBsbInterfacePatchToSnapshot(optimistic, patch.bsbInterface!);
    queue.enqueue(
      { orchestra: { type: 'updateInstrument', assignmentId: '6', patch } },
      history.isDirty(),
      metadata,
    );
    render();
  };
  const render = () =>
    root.render(<BSBInterfaceEditor instrument={optimistic} onInstrumentPatch={dispatch} />);
  act(render);
  const flush = async () => {
    await act(async () => {
      await queue.flush();
    });
    expect(errors).toEqual([]);
  };
  const refresh = () => {
    optimistic = canonical();
    act(render);
  };
  const state = () => JSON.stringify(buildWidgetTreeSnapshot(currentBsb()));
  const widget = (id: string) => {
    const element = container.querySelector<HTMLElement>(`[data-widget-id="${id}"]`);
    expect(element).not.toBeNull();
    return element!;
  };
  const mouse = (target: EventTarget, type: string, clientX = 0, clientY = 0, shiftKey = false) => {
    act(() => {
      target.dispatchEvent(
        new MouseEvent(type, { bubbles: true, button: 0, clientX, clientY, shiftKey }),
      );
    });
  };
  const select = (id: string, shift = false) => mouse(widget(id), 'click', 0, 0, shift);
  const enter = (id: string) => {
    mouse(widget(id), 'dblclick');
    frame();
  };
  const key = (key: string, command = false) => {
    const canvas = container.querySelector<HTMLElement>(
      '[data-shortcut-scope="bsb-interface-canvas"]',
    )!;
    act(() => {
      canvas.focus();
      canvas.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key, ctrlKey: command }),
      );
    });
  };
  const navigateRoot = () => {
    const button = [...container.querySelectorAll('button')].find(
      (node) => node.textContent === 'Root',
    );
    expect(button).toBeDefined();
    mouse(button!, 'click');
    frame();
  };
  const undo = async () => {
    expect(
      (await history.undo(context.nextUndoRequest(documentId, session.read().revision))).status,
    ).toBe('committed');
    refresh();
  };
  const redo = async () => {
    expect(
      (await history.redo(context.nextRedoRequest(documentId, session.read().revision))).status,
    ).toBe('committed');
    refresh();
  };
  return {
    container,
    session,
    history,
    queue,
    canonical,
    currentBsb,
    flush,
    refresh,
    state,
    widget,
    mouse,
    select,
    enter,
    key,
    navigateRoot,
    undo,
    redo,
    submissions,
    dispatch,
    optimistic: () => optimistic,
    context,
    documentId,
  };
}

describe('BSB editor → queue → canonical undo', () => {
  it('restores nested cut/paste/move/multi-panel move/delete with one undo per action', async () => {
    const f = fixture();
    const states = [f.state()];
    f.enter('panel-a');
    f.select('knob');
    f.key('x', true);
    await f.flush();
    states.push(f.state());
    f.navigateRoot();
    f.enter('panel-b');
    f.key('v', true);
    // Move immediately, using the optimistic identity before the paste commits.
    const pastedId = f.container.querySelector<HTMLElement>('[data-widget-type="BSBKnob"]')!.dataset
      .widgetId!;
    expect(pastedId).not.toBe('knob');
    f.select(pastedId);
    f.mouse(f.widget(pastedId), 'mousedown', 10, 10);
    f.mouse(window, 'mousemove', 60, 50);
    f.mouse(window, 'mouseup', 65, 55); // Release before requestAnimationFrame.
    await f.flush();
    // Undo the move first: paste remains as its own action.
    const moved = f.state();
    await f.undo();
    states.push(f.state());
    expect(f.currentBsb().getGraphicInterface().findWidgetById(pastedId)?.x).toBe(0);
    await f.redo();
    expect(f.state()).toBe(moved);
    states.push(moved);
    f.navigateRoot();
    f.select('panel-a');
    f.select('panel-b', true);
    f.mouse(f.widget('panel-a'), 'mousedown', 10, 10);
    f.mouse(window, 'mousemove', 30, 30);
    frame();
    await f.flush(); // Pause while the mouse remains down.
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 10_000);
    f.mouse(window, 'mousemove', 50, 50);
    frame();
    await f.flush();
    f.mouse(window, 'mouseup', 60, 60);
    await f.flush();
    states.push(f.state());
    f.select('panel-b');
    f.key('Delete');
    await f.flush();
    states.push(f.state());
    expect(f.history.isDirty()).toBe(true);
    for (let index = states.length - 2; index >= 0; index--) {
      await f.undo();
      expect(f.state()).toBe(states[index]);
    }
    expect(f.history.isDirty()).toBe(false);
    for (let index = 1; index < states.length; index++) {
      await f.redo();
      expect(f.state()).toBe(states[index]);
    }
    expect(f.history.isDirty()).toBe(true);
  });

  it('keeps rapid multi-selection nudge and deletion separate and atomic', async () => {
    const f = fixture();
    const initial = f.state();
    f.select('panel-a');
    f.select('panel-b', true);
    f.key('ArrowRight');
    f.key('Delete');
    await f.flush();
    expect(f.submissions.map((entry) => entry.phase)).toEqual(['single', 'single']);
    await f.undo();
    const children = f.canonical().widgetTree.children!;
    expect(children.map((node) => node.x)).toEqual([11, 211]);
    await f.undo();
    expect(f.state()).toBe(initial);
  });

  it('settles a pending gesture before navigation and repairs navigation after undo removes a panel', async () => {
    const f = fixture();
    const panel = f.canonical().widgetTree.children![0];
    act(() =>
      useBsbClipboardStore
        .getState()
        .setClipboard({ widgets: [panel], originX: panel.x, originY: panel.y }),
    );
    f.key('v', true);
    const newPanelId = [
      ...f.container.querySelectorAll<HTMLElement>('[data-widget-type="BSBGroup"]'),
    ].at(-1)!.dataset.widgetId!;
    f.enter(newPanelId);
    const childId = f.container.querySelector<HTMLElement>('[data-widget-type="BSBKnob"]')!.dataset
      .widgetId!;
    expect(childId).not.toBe('knob');
    f.select(childId);
    f.mouse(f.widget(childId), 'mousedown', 10, 10);
    f.mouse(window, 'mousemove', 20, 20);
    await act(async () => {
      await settleHistoryEditors(document);
    });
    await f.flush();
    await f.undo(); // Move
    await f.undo(); // Paste panel, while still inside it
    expect(f.container.textContent).not.toContain('Root');
    f.key('v', true);
    await f.flush();
    const canonicalChildren = f.canonical().widgetTree.children!;
    expect(canonicalChildren).toHaveLength(3);
    expect(canonicalChildren[2].children![0].id).not.toBe(childId);
  });

  it('records the final resize and keeps a later delete separate', async () => {
    const f = fixture();
    f.enter('panel-a');
    f.select('knob');
    const before = f.state();
    const handle = f.container.querySelector('[data-resize-edge="right"]')!;
    expect(handle).not.toBeNull();
    f.mouse(handle, 'mousedown', 10, 10);
    f.mouse(window, 'mousemove', 20, 10);
    f.mouse(window, 'mouseup', 30, 10);
    f.key('Delete');
    await f.flush();
    await f.undo();
    expect(f.currentBsb().getGraphicInterface().findWidgetById('knob')).toBeDefined();
    expect(f.state()).not.toBe(before);
    await f.undo();
    expect(f.state()).toBe(before);
  });
  it('shares add/group identities with the canonical model and restores them through history', async () => {
    const f = fixture();
    const initial = f.state();
    const add = prepareBsbWidgetCreation({
      type: 'addWidget',
      widgetType: 'BSBKnob',
      x: 30,
      y: 40,
      parentGroupId: 'panel-b',
    });
    act(() => f.dispatch({ bsbInterface: add }, { phase: 'single' }));
    const addedId = f.optimistic().widgetTree.children![1].children![0].id;
    await f.flush();
    expect(f.currentBsb().getGraphicInterface().findWidgetById(addedId)?.x).toBe(30);
    const grouped = prepareBsbWidgetCreation({
      type: 'makeGroup',
      widgetIds: ['panel-a', 'panel-b'],
    });
    act(() => f.dispatch({ bsbInterface: grouped }, { phase: 'single' }));
    const optimisticGroup = f.optimistic().widgetTree.children![0];
    await f.flush();
    const canonicalGroup = f.canonical().widgetTree.children![0];
    expect(canonicalGroup.id).toBe(optimisticGroup.id);
    expect(canonicalGroup.children!.map((node) => [node.id, node.x, node.y])).toEqual(
      optimisticGroup.children!.map((node) => [node.id, node.x, node.y]),
    );
    const final = f.state();
    await f.undo();
    await f.undo();
    expect(f.state()).toBe(initial);
    await f.redo();
    await f.redo();
    expect(f.state()).toBe(final);
  });

  it('rejects stale targets and colliding identities atomically without dirtying the project', async () => {
    const f = fixture();
    const initial = f.state();
    const wrap = (patch: BsbInterfacePatch, assignmentId = '6') => ({
      orchestra: {
        type: 'updateInstrument' as const,
        assignmentId,
        patch: { bsbInterface: patch },
      },
    });
    const panel = f.canonical().widgetTree.children![0];
    const paste = prepareBsbWidgetCreation({
      type: 'pasteWidgets',
      widgetData: JSON.stringify([panel]),
    });
    const duplicate = structuredClone(panel);
    duplicate.id = 'new-panel';
    duplicate.children![0].id = duplicate.id;
    for (const patches of [
      [wrap(paste), wrap({ type: 'moveWidget', widgetId: 'missing', x: 90, y: 90 })],
      [wrap({ type: 'addWidget', widgetType: 'BSBKnob', widgetId: 'knob', x: 0, y: 0 })],
      [wrap({ type: 'addWidget', widgetType: 'BSBKnob', parentGroupId: 'missing', x: 0, y: 0 })],
      [wrap({ type: 'pasteWidgets', widgetData: JSON.stringify([duplicate]), preserveIds: true })],
      [wrap({ type: 'moveWidget', widgetId: 'knob', x: 1, y: 1 }, 'missing')],
    ]) {
      const result = await f.history.commit(
        f.context.nextCommitRequest(
          f.documentId,
          f.session.read().revision,
          'Invalid BSB edit',
          patches,
        ),
      );
      expect(result.status).toBe('invalid');
      expect(f.state()).toBe(initial);
      expect(f.history.isDirty()).toBe(false);
      expect(f.history.read().length).toBe(0);
    }
  });
  it('keeps performance slider values in one gesture across queue flushes', async () => {
    const f = fixture();
    const add = prepareBsbWidgetCreation({
      type: 'addWidget',
      widgetType: 'BSBHSlider',
      x: 0,
      y: 0,
    });
    act(() => f.dispatch({ bsbInterface: add }, { phase: 'single' }));
    const sliderId = f.optimistic().widgetTree.children!.at(-1)!.id;
    act(() =>
      f.dispatch({ bsbInterface: { type: 'setEditEnabled', value: false } }, { phase: 'single' }),
    );
    await f.flush();
    const before = f.state();
    const entries = f.history.read().length;
    const slider = f.widget(sliderId).querySelector<SVGSVGElement>('svg[role="slider"]')!;
    vi.spyOn(slider, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 150,
      bottom: 20,
      width: 150,
      height: 20,
      toJSON: () => ({}),
    });
    f.mouse(slider, 'mousedown', 20, 10);
    f.mouse(window, 'mousemove', 70, 10);
    await f.flush();
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 10_000);
    f.mouse(window, 'mousemove', 120, 10);
    f.mouse(window, 'mouseup', 120, 10);
    await f.flush();
    expect(f.history.read().length).toBe(entries + 1);
    const final = f.state();
    expect(final).not.toBe(before);
    await f.undo();
    expect(f.state()).toBe(before);
    await f.redo();
    expect(f.state()).toBe(final);
  });
  it('settles a pending move before computing a keyboard nudge', async () => {
    const f = fixture();
    f.enter('panel-a');
    f.select('knob');
    f.mouse(f.widget('knob'), 'mousedown', 10, 10);
    f.mouse(window, 'mousemove', 60, 50);
    f.key('ArrowRight');
    await f.flush();
    expect(f.currentBsb().getGraphicInterface().findWidgetById('knob')?.x).toBe(61);
    await f.undo();
    expect(f.currentBsb().getGraphicInterface().findWidgetById('knob')?.x).toBe(60);
    await f.undo();
    expect(f.currentBsb().getGraphicInterface().findWidgetById('knob')?.x).toBe(10);
  });
});
