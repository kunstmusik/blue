// @vitest-environment jsdom

import React, { act } from 'react';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ProjectHistoryStateProjection,
  ProjectDocumentUpdatedEvent,
  PrepareHistoryBoundaryEvent,
  ReleaseHistoryBoundaryEvent,
} from '../../shared/project-history';
import {
  getProjectHistoryProjection,
  setProjectHistoryProjection,
} from '../hooks/use-project-history';
import {
  useDedicatedProjectHistory,
  type DedicatedHistoryDrainResult,
  type DedicatedProjectHistoryClient,
} from '../hooks/use-dedicated-project-history';
import { registerHistoryEditorSettlement } from '../lib/history-scope-router';
import { BlueData } from '@blue/data';
import { ProjectHistory } from '../../main/project-history';
import { ProjectSession } from '../../main/project-session';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function projection(
  revision: number,
  canUndo: boolean,
  canRedo = false,
): ProjectHistoryStateProjection {
  return {
    canUndo,
    canRedo,
    undoLabel: canUndo ? 'Edit Project' : null,
    redoLabel: canRedo ? 'Edit Project' : null,
    cursor: canUndo ? 1 : 0,
    length: canUndo || canRedo ? 1 : 0,
    retainedBytes: 10,
    savedStateId: null,
    stateId: `state-${revision}`,
    revision,
  };
}

function makeDocumentSnapshot(): { documentId: string } {
  return { documentId: 'doc-dedicated' };
}

describe('useDedicatedProjectHistory', () => {
  let root: Root;
  let container: HTMLDivElement;
  let documentUpdated: ((event: ProjectDocumentUpdatedEvent) => void) | undefined;
  let prepareBoundary: ((event: PrepareHistoryBoundaryEvent) => void) | undefined;
  let releaseBoundary: ((event: ReleaseHistoryBoundaryEvent) => void) | undefined;
  let nativeMenuCommand: ((command: { type: 'undo' | 'redo' }) => void) | undefined;
  let client: DedicatedProjectHistoryClient | null;
  let drain: ReturnType<typeof vi.fn>;
  let syncAvailability: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setProjectHistoryProjection(null);
    client = null;
    documentUpdated = undefined;
    prepareBoundary = undefined;
    releaseBoundary = undefined;
    nativeMenuCommand = undefined;
    drain = vi.fn<() => Promise<DedicatedHistoryDrainResult>>().mockResolvedValue({
      outstandingPrefixCount: 0,
      failedPrefixCount: 0,
      unresolvedPrefixCount: 0,
    });
    syncAvailability = vi.fn();

    window.blueAPI = {
      getProjectDocument: vi.fn().mockResolvedValue(makeDocumentSnapshot()),
      readProjectHistory: vi.fn().mockResolvedValue(projection(0, false)),
      registerHistoryParticipant: vi.fn().mockResolvedValue({ ok: true }),
      unregisterHistoryParticipant: vi.fn().mockResolvedValue({ ok: true }),
      acknowledgeHistoryBoundary: vi.fn().mockResolvedValue({ ok: true }),
      undoProjectHistory: vi.fn().mockResolvedValue({
        status: 'committed',
        documentId: 'doc-dedicated',
        revision: 2,
        stateId: 'state-2',
        isDirty: true,
        history: projection(2, false, true),
      }),
      redoProjectHistory: vi.fn(),
      syncHistoryAvailability: syncAvailability,
      onProjectDocumentUpdated: vi.fn((callback) => {
        documentUpdated = callback;
        return () => undefined;
      }),
      onPrepareHistoryBoundary: vi.fn((callback) => {
        prepareBoundary = callback;
        return () => undefined;
      }),
      onReleaseHistoryBoundary: vi.fn((callback) => {
        releaseBoundary = callback;
        return () => undefined;
      }),
      onNativeMenuCommand: vi.fn((callback) => {
        nativeMenuCommand = callback;
        return () => undefined;
      }),
    } as never;

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    setProjectHistoryProjection(null);
    delete (window as typeof window & { blueAPI?: unknown }).blueAPI;
  });

  function Harness(): React.ReactElement {
    client = useDedicatedProjectHistory({
      enabled: true,
      viewId: 'dedicated-test',
      drain,
    });
    return React.createElement('div');
  }

  async function flushEffects(): Promise<void> {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it('drains an ordinary in-flight dedicated submission queued just after undo', async () => {
    const session = new ProjectSession();
    session.replace(new BlueData(), join(tmpdir(), 'dedicated-history.blue'));
    const documentId = session.read().documentId!;
    const history = new ProjectHistory({
      session,
      barrierTimeoutMs: 100,
      broadcastPrepareBoundary: (event) => prepareBoundary?.(event),
      broadcastReleaseBoundary: (event) => releaseBoundary?.(event),
    });
    await history.commit({
      documentId,
      operationId: 'seed',
      expectedRevision: 0,
      contextSequence: 0,
      label: 'Seed',
      patches: [{ projectProperties: { title: 'Seed' } }],
    });
    vi.mocked(window.blueAPI.getProjectDocument).mockResolvedValue({ documentId } as never);
    vi.mocked(window.blueAPI.readProjectHistory).mockImplementation(async () => history.read());
    vi.mocked(window.blueAPI.registerHistoryParticipant).mockImplementation(async (request) =>
      history.registerParticipant(request),
    );
    vi.mocked(window.blueAPI.acknowledgeHistoryBoundary).mockImplementation(async (ack) =>
      history.acknowledgeBoundary(ack),
    );
    act(() => root.render(<Harness />));
    await flushEffects();
    const editor = client!;
    expect(history.getParticipants()).toHaveLength(1);

    const undo = history.undo({
      documentId,
      operationId: 'undo',
      expectedRevision: 1,
      contextSequence: 0,
    });
    const context = editor.nextContext();
    expect(context.barrierId).toBeUndefined();
    const submitted = history.commit({
      ...context,
      documentId,
      expectedRevision: context.expectedRevision!,
      origin: { contextId: context.contextId, viewId: context.viewId },
      label: 'Dedicated edit',
      patches: [{ projectProperties: { title: 'Dedicated edit' } }],
    });
    // The page drain waits for its existing write before capturing more work.
    drain.mockImplementation(async () => {
      const receipt = await submitted;
      expect(receipt.status).toBe('committed');
      if (receipt.status === 'committed') editor.setRevision(receipt.revision);
      return { outstandingPrefixCount: 0, failedPrefixCount: 0, unresolvedPrefixCount: 0 };
    });
    await act(async () => {
      expect((await undo).status).toBe('committed');
    });
    expect(drain).toHaveBeenCalledWith(true);
    expect(window.blueAPI.acknowledgeHistoryBoundary).toHaveBeenCalledWith(
      expect.objectContaining({ lastAcknowledgedRevision: 2, outstandingPrefixCount: 0 }),
    );
    expect(editor.isPaused()).toBe(false);
    expect(session.read().data?.getProjectProperties().title).toBe('Seed');
    expect(session.read().revision).toBe(3);
  });

  it('refreshes the shared projection from canonical events and command responses', async () => {
    act(() => root.render(<Harness />));
    await flushEffects();

    // Registration seeds the local projection but does not publish a menu
    // update before the dedicated window has focus.
    expect(getProjectHistoryProjection()).toEqual(projection(0, false));
    expect(syncAvailability).not.toHaveBeenCalled();

    act(() => window.dispatchEvent(new Event('focus')));
    expect(syncAvailability).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'project', canUndo: false }),
    );

    act(() => {
      documentUpdated?.({
        documentId: 'doc-dedicated',
        sessionId: 1,
        revision: 1,
        stateId: 'state-1',
        isDirty: true,
        history: projection(1, true),
        acceptedOperationIds: ['edit-1'],
        snapshot: {},
      });
    });
    expect(getProjectHistoryProjection()).toEqual(projection(1, true));

    act(() => nativeMenuCommand?.({ type: 'undo' }));
    await flushEffects();
    expect(window.blueAPI.undoProjectHistory).toHaveBeenCalledWith(
      expect.objectContaining({ documentId: 'doc-dedicated', expectedRevision: 1 }),
    );
    expect(getProjectHistoryProjection()).toEqual(projection(2, false, true));
  });

  it('settles registered editor input before draining the dedicated prefix', async () => {
    act(() => root.render(<Harness />));
    await flushEffects();

    let resolveSettlement!: () => void;
    const unregisterSettlement = registerHistoryEditorSettlement(
      document,
      () =>
        new Promise<void>((resolve) => {
          resolveSettlement = resolve;
        }),
    );

    try {
      act(() => prepareBoundary?.({ barrierId: 'barrier-dedicated', reason: 'undo' }));
      await act(async () => {
        await Promise.resolve();
      });
      expect(client?.isPaused()).toBe(true);
      expect(drain).not.toHaveBeenCalled();

      await act(async () => {
        resolveSettlement();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(drain).toHaveBeenCalledWith(true);
      expect(window.blueAPI.acknowledgeHistoryBoundary).toHaveBeenCalledWith(
        expect.objectContaining({
          barrierId: 'barrier-dedicated',
          outstandingPrefixCount: 0,
          failedPrefixCount: 0,
          unresolvedPrefixCount: 0,
        }),
      );
      expect(client?.nextContext().barrierId).toBe('barrier-dedicated');
    } finally {
      unregisterSettlement();
      act(() => releaseBoundary?.({ barrierId: 'barrier-dedicated', status: 'aborted' }));
    }
  });
});
