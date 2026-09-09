// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useIPCListeners } from '../hooks/use-ipc-listeners';
import { installMockProjectHistoryBridge, type MockProjectHistoryBridge } from './mock-blueapi';
import { useProjectStore } from '../stores/project-store';
import { __testClearPendingPatches } from '../stores/project-store';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe('global project history views settlement (T037, US2)', () => {
  let container: HTMLDivElement;
  let root: Root;
  let bridge: MockProjectHistoryBridge;

  function createView(label: string, host: HTMLElement): Root {
    const viewRoot = createRoot(host);
    function View(): React.ReactElement {
      const title = useProjectStore((s) => s.title);
      return React.createElement(
        'div',
        { 'data-view': label },
        React.createElement('span', { 'data-field': 'title' }, title),
      );
    }
    act(() => {
      viewRoot.render(React.createElement(View));
    });
    return viewRoot;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    bridge = installMockProjectHistoryBridge({ revision: 3 });
    // Any channel useIPCListeners touches that this test does not exercise
    // gets a generic unsubscribe stub, so mounting the full hook succeeds.
    const api = window.blueAPI as unknown as Record<string, unknown>;
    api.setRecentFiles = api.setRecentFiles ?? vi.fn(async () => undefined);
    const stubbed = new Proxy(api, {
      get(target, prop, receiver) {
        if (prop.startsWith('on') && typeof target[prop as string] !== 'function') {
          return () => () => undefined;
        }
        return Reflect.get(target, prop, receiver);
      },
    });
    Object.defineProperty(window, 'blueAPI', {
      configurable: true,
      value: stubbed,
    });
    useProjectStore.setState({
      sessionId: 7,
      documentId: 'doc-1',
      loaded: true,
      title: 'Before Undo',
      isDirty: true,
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(React.createElement(Harness));
    });
  });

  afterEach(() => {
    __testClearPendingPatches();
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
  });

  function Harness(): React.ReactElement {
    useIPCListeners();
    return React.createElement('div');
  }

  it('settles every view before a history command reports completion', async () => {
    const hostA = document.createElement('div');
    const hostB = document.createElement('div');
    document.body.appendChild(hostA);
    document.body.appendChild(hostB);
    const viewRootA = createView('main', hostA);
    const viewRootB = createView('popout', hostB);

    expect((hostA.querySelector('[data-field="title"]') as HTMLElement).textContent).toBe(
      'Before Undo',
    );
    expect((hostB.querySelector('[data-field="title"]') as HTMLElement).textContent).toBe(
      'Before Undo',
    );

    // A view-local edit is queued but not yet flushed when the undo lands.
    let patchApplied: Promise<void> | null = null;
    act(() => {
      patchApplied = useProjectStore.getState().applyProjectDocumentPatch({
        projectProperties: { author: 'Pending Author' },
      });
    });
    void patchApplied;

    // The undo request enters the settlement barrier.
    let undoResult: { status: string } | null = null;
    const undoPromise = window.blueAPI.undoProjectHistory({
      documentId: 'doc-1',
      operationId: 'undo-views-1',
    });
    void undoPromise.then((result) => {
      undoResult = result as { status: string };
    });

    // Drive the barrier: prefix drain, ack polling, and release.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    // The pending patch drained as a barrier-tagged prefix before the undo.
    expect(bridge.commits).toHaveLength(1);
    expect(bridge.commits[0]!.patches).toEqual([
      { projectProperties: { author: 'Pending Author' } },
    ]);
    expect((bridge.commits[0]!.metadata as { barrierId?: string } | undefined)?.barrierId).toMatch(
      /^barrier-for-/,
    );

    // The participating view acknowledged zero outstanding work.
    expect(bridge.acks).toHaveLength(1);
    expect(bridge.acks[0]!.outstandingPrefixCount).toBe(0);
    expect(bridge.acks[0]!.barrierId).toBe(bridge.commits[0]!.metadata?.barrierId);

    // Only then does the undo report completion.
    await act(async () => {
      await undoPromise;
    });
    expect(undoResult).not.toBeNull();
    expect((undoResult as { status: string }).status).toBe('committed');

    // The canonical restoration reaches both views.
    act(() => {
      bridge.dispatchDocumentUpdated({
        documentId: 'doc-1',
        sessionId: 7,
        revision: 5,
        stateId: 'state-5',
        isDirty: true,
        history: {
          canUndo: true,
          canRedo: false,
          undoLabel: null,
          redoLabel: null,
          cursor: 5,
          length: 5,
          retainedBytes: 0,
          savedStateId: null,
          stateId: 'state-5',
        },
        acceptedOperationIds: ['undo-views-1'],
        snapshot: { sessionId: 7, documentId: 'doc-1', title: 'Restored Everywhere' },
      });
    });

    expect((hostA.querySelector('[data-field="title"]') as HTMLElement).textContent).toBe(
      'Restored Everywhere',
    );
    expect((hostB.querySelector('[data-field="title"]') as HTMLElement).textContent).toBe(
      'Restored Everywhere',
    );

    act(() => {
      viewRootA.unmount();
      viewRootB.unmount();
    });
    hostA.remove();
    hostB.remove();
  });
});
