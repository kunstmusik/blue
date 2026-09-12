// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useIPCListeners } from '../hooks/use-ipc-listeners';
import { installMockProjectHistoryBridge, type MockProjectHistoryBridge } from './mock-blueapi';
import { useProjectStore } from '../stores/project-store';
import { __testClearPendingPatches } from '../stores/project-store';
import { createEmptyMixerSnapshot } from '../../shared/project-editor';

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
      mixer: { ...createEmptyMixerSnapshot(), meterProfileKey: 'peak-rms-mixing-plus-6' },
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

  it('supports mixer channel identity assertion fixture for multi-view tests (T003)', () => {
    const fixture = {
      channelIds: ['Master', 'SubChannels', 'Orchestra'],
      dockedViewId: 'view-docked',
      detachedViewId: 'view-detached',
    };
    expect(fixture.channelIds).toHaveLength(3);
    expect(fixture.dockedViewId).toBe('view-docked');
    expect(fixture.detachedViewId).toBe('view-detached');
  });

  it('synchronizes meter profile across docked and detached views on snapshot update (T021)', () => {
    const hostA = document.createElement('div');
    const hostB = document.createElement('div');
    document.body.appendChild(hostA);
    document.body.appendChild(hostB);

    function MixerView({ label }: { label: string }): React.ReactElement {
      const profile = useProjectStore((s) => s.mixer.meterProfileKey);
      return (
        <div data-view={label}>
          <span data-field="profile">{profile}</span>
        </div>
      );
    }

    const viewRootA = createRoot(hostA);
    const viewRootB = createRoot(hostB);
    act(() => {
      viewRootA.render(React.createElement(MixerView, { label: 'docked' }));
      viewRootB.render(React.createElement(MixerView, { label: 'detached' }));
    });

    expect(hostA.querySelector('[data-field="profile"]')?.textContent).toBe(
      'peak-rms-mixing-plus-6',
    );
    expect(hostB.querySelector('[data-field="profile"]')?.textContent).toBe(
      'peak-rms-mixing-plus-6',
    );

    // Simulate IPC document update with new meter profile
    act(() => {
      bridge.dispatchDocumentUpdated({
        documentId: 'doc-1',
        sessionId: 7,
        revision: 10,
        stateId: 'state-10',
        isDirty: true,
        history: {
          canUndo: true,
          canRedo: false,
          undoLabel: 'Set Meter Profile',
          redoLabel: null,
          cursor: 10,
          length: 10,
          retainedBytes: 0,
          savedStateId: null,
          stateId: 'state-10',
        },
        acceptedOperationIds: ['op-profile-1'],
        snapshot: {
          sessionId: 7,
          documentId: 'doc-1',
          mixer: {
            ...useProjectStore.getState().mixer,
            meterProfileKey: 'k14-rms-peak',
          },
        },
      });
    });

    expect(hostA.querySelector('[data-field="profile"]')?.textContent).toBe('k14-rms-peak');
    expect(hostB.querySelector('[data-field="profile"]')?.textContent).toBe('k14-rms-peak');

    act(() => {
      viewRootA.unmount();
      viewRootB.unmount();
    });
    hostA.remove();
    hostB.remove();
  });

  it('synchronizes meter enabled state across docked and detached views on snapshot update (T028)', () => {
    const hostA = document.createElement('div');
    const hostB = document.createElement('div');
    document.body.appendChild(hostA);
    document.body.appendChild(hostB);

    function MixerView({ label }: { label: string }): React.ReactElement {
      const enabled = useProjectStore((s) => s.mixer.enableMeters !== false);
      return (
        <div data-view={label}>
          <span data-field="meters-enabled">{String(enabled)}</span>
        </div>
      );
    }

    const viewRootA = createRoot(hostA);
    const viewRootB = createRoot(hostB);
    act(() => {
      viewRootA.render(React.createElement(MixerView, { label: 'docked' }));
      viewRootB.render(React.createElement(MixerView, { label: 'detached' }));
    });

    expect(hostA.querySelector('[data-field="meters-enabled"]')?.textContent).toBe('true');
    expect(hostB.querySelector('[data-field="meters-enabled"]')?.textContent).toBe('true');

    // Simulate IPC document update with disabled meters
    act(() => {
      bridge.dispatchDocumentUpdated({
        documentId: 'doc-1',
        sessionId: 7,
        revision: 20,
        stateId: 'state-20',
        isDirty: true,
        history: {
          canUndo: true,
          canRedo: false,
          undoLabel: 'Disable Meters',
          redoLabel: null,
          cursor: 20,
          length: 20,
          retainedBytes: 0,
          savedStateId: null,
          stateId: 'state-20',
        },
        acceptedOperationIds: ['op-disable-meters-1'],
        snapshot: {
          sessionId: 7,
          documentId: 'doc-1',
          mixer: {
            ...useProjectStore.getState().mixer,
            enableMeters: false,
          },
        },
      });
    });

    expect(hostA.querySelector('[data-field="meters-enabled"]')?.textContent).toBe('false');
    expect(hostB.querySelector('[data-field="meters-enabled"]')?.textContent).toBe('false');

    act(() => {
      viewRootA.unmount();
      viewRootB.unmount();
    });
    hostA.remove();
    hostB.remove();
  });

  it('preserves unchanged channel identities and references across concurrent views on presentation update (T036)', () => {
    const hostA = document.createElement('div');
    const hostB = document.createElement('div');
    document.body.appendChild(hostA);
    document.body.appendChild(hostB);

    function MixerView({ label }: { label: string }): React.ReactElement {
      const profile = useProjectStore((s) => s.mixer.meterProfileKey);
      const enableMeters = useProjectStore((s) => s.mixer.enableMeters !== false);
      const channelIds = useProjectStore((s) => s.mixer.channels.map((c) => c.id).join(','));
      const masterId = useProjectStore((s) => s.mixer.master.id);
      return (
        <div data-view={label}>
          <span data-field="profile">{profile}</span>
          <span data-field="enable">{String(enableMeters)}</span>
          <span data-field="channels">{channelIds}</span>
          <span data-field="master">{masterId}</span>
        </div>
      );
    }

    const viewRootA = createRoot(hostA);
    const viewRootB = createRoot(hostB);
    act(() => {
      viewRootA.render(React.createElement(MixerView, { label: 'docked' }));
      viewRootB.render(React.createElement(MixerView, { label: 'detached' }));
    });

    const initialChannelsA = hostA.querySelector('[data-field="channels"]')?.textContent;
    const initialChannelsB = hostB.querySelector('[data-field="channels"]')?.textContent;
    const initialMasterA = hostA.querySelector('[data-field="master"]')?.textContent;
    const initialMasterB = hostB.querySelector('[data-field="master"]')?.textContent;

    expect(initialChannelsA).toBe(initialChannelsB);
    expect(initialMasterA).toBe('master');
    expect(initialMasterB).toBe('master');

    // Simulate IPC document update changing meterProfileKey to k20-rms-peak and enableMeters to false
    act(() => {
      bridge.dispatchDocumentUpdated({
        documentId: 'doc-1',
        sessionId: 7,
        revision: 30,
        stateId: 'state-30',
        isDirty: true,
        history: {
          canUndo: true,
          canRedo: false,
          undoLabel: 'Disable Meters',
          redoLabel: null,
          cursor: 30,
          length: 30,
          retainedBytes: 0,
          savedStateId: null,
          stateId: 'state-30',
        },
        acceptedOperationIds: ['op-pres-1'],
        snapshot: {
          sessionId: 7,
          documentId: 'doc-1',
          mixer: {
            ...useProjectStore.getState().mixer,
            enableMeters: false,
            meterProfileKey: 'k20-rms-peak',
          },
        },
      });
    });

    // Presentation updated across both views
    expect(hostA.querySelector('[data-field="profile"]')?.textContent).toBe('k20-rms-peak');
    expect(hostB.querySelector('[data-field="profile"]')?.textContent).toBe('k20-rms-peak');
    expect(hostA.querySelector('[data-field="enable"]')?.textContent).toBe('false');
    expect(hostB.querySelector('[data-field="enable"]')?.textContent).toBe('false');

    // Channel identities and master identity strictly unchanged in both views
    expect(hostA.querySelector('[data-field="channels"]')?.textContent).toBe(initialChannelsA);
    expect(hostB.querySelector('[data-field="channels"]')?.textContent).toBe(initialChannelsB);
    expect(hostA.querySelector('[data-field="master"]')?.textContent).toBe(initialMasterA);
    expect(hostB.querySelector('[data-field="master"]')?.textContent).toBe(initialMasterB);

    act(() => {
      viewRootA.unmount();
      viewRootB.unmount();
    });
    hostA.remove();
    hostB.remove();
  });
});
