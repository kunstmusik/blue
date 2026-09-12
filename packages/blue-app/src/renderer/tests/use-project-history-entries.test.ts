// @vitest-environment jsdom

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import {
  cancelScheduledProjectHistoryEntriesRefresh,
  getProjectHistoryEntries,
  refreshProjectHistoryEntries,
  scheduleProjectHistoryEntriesRefresh,
  setProjectHistoryEntries,
} from '../hooks/use-project-history';
import { useProjectStore } from '../stores/project-store';
import type { ProjectHistoryEntriesSnapshot } from '../../shared/project-history';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const SNAPSHOT_A: ProjectHistoryEntriesSnapshot = {
  documentId: 'doc-1',
  revision: 1,
  cursor: 1,
  entries: [{ entryId: 'e1', label: 'Edit One', timestamp: 100, afterStateId: 's1' }],
};

const SNAPSHOT_B: ProjectHistoryEntriesSnapshot = {
  documentId: 'doc-1',
  revision: 2,
  cursor: 2,
  entries: [
    { entryId: 'e1', label: 'Edit One', timestamp: 100, afterStateId: 's1' },
    { entryId: 'e2', label: 'Edit Two', timestamp: 200, afterStateId: 's2' },
  ],
};

const invokeMock = vi.fn();

beforeEach(() => {
  invokeMock.mockReset();
  setProjectHistoryEntries(null);
  useProjectStore.setState({ documentId: 'doc-1' });
  (window as unknown as { blueAPI: unknown }).blueAPI = {
    readProjectHistoryEntries: invokeMock,
  };
});

afterEach(() => {
  cancelScheduledProjectHistoryEntriesRefresh();
  vi.useRealTimers();
  setProjectHistoryEntries(null);
  useProjectStore.setState({ documentId: null });
});

describe('project history entries store (spec 106)', () => {
  it('stores a successful snapshot and sends the active documentId', async () => {
    invokeMock.mockResolvedValueOnce(SNAPSHOT_B);

    await refreshProjectHistoryEntries();

    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(invokeMock).toHaveBeenCalledWith({ documentId: 'doc-1' });
    expect(getProjectHistoryEntries()).toEqual(SNAPSHOT_B);
  });

  it('keeps the previous snapshot when main answers invalid', async () => {
    setProjectHistoryEntries(SNAPSHOT_A);
    invokeMock.mockResolvedValueOnce({
      status: 'invalid',
      operationId: 'invalid-history-request',
      documentId: '',
      reason: 'mismatch',
    });

    await refreshProjectHistoryEntries();

    expect(getProjectHistoryEntries()).toEqual(SNAPSHOT_A);
  });

  it('coalesces concurrent refreshes into one queued re-fetch with latest data', async () => {
    const first = createDeferred<ProjectHistoryEntriesSnapshot>();
    const second = createDeferred<ProjectHistoryEntriesSnapshot>();
    invokeMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    const leading = refreshProjectHistoryEntries();
    const queued = refreshProjectHistoryEntries();

    first.resolve(SNAPSHOT_A);
    second.resolve(SNAPSHOT_B);
    await Promise.all([leading, queued]);

    expect(invokeMock).toHaveBeenCalledTimes(2);
    expect(getProjectHistoryEntries()).toEqual(SNAPSHOT_B);
  });

  it('keeps the previous snapshot when the fetch rejects', async () => {
    setProjectHistoryEntries(SNAPSHOT_A);
    invokeMock.mockRejectedValueOnce(new Error('ipc unavailable'));

    await expect(refreshProjectHistoryEntries()).resolves.toBeUndefined();

    expect(getProjectHistoryEntries()).toEqual(SNAPSHOT_A);
  });

  it('clears on project close via the null sentinel', () => {
    setProjectHistoryEntries(SNAPSHOT_A);

    setProjectHistoryEntries(null);

    expect(getProjectHistoryEntries()).toBeNull();
  });

  it('drops an in-flight response after the document switches (FR-011)', async () => {
    const inFlight = createDeferred<ProjectHistoryEntriesSnapshot>();
    invokeMock.mockReturnValueOnce(inFlight.promise);

    const pending = refreshProjectHistoryEntries();

    // The project is replaced while the fetch for the old document is pending.
    useProjectStore.setState({ documentId: 'doc-2' });
    inFlight.resolve(SNAPSHOT_A);
    await pending;

    expect(getProjectHistoryEntries()).toBeNull();
  });

  it('coalesces a burst of scheduled refreshes into one trailing fetch (FR-006)', async () => {
    vi.useFakeTimers();
    invokeMock.mockResolvedValue(SNAPSHOT_B);

    scheduleProjectHistoryEntriesRefresh();
    scheduleProjectHistoryEntriesRefresh();
    scheduleProjectHistoryEntriesRefresh();
    scheduleProjectHistoryEntriesRefresh();
    scheduleProjectHistoryEntriesRefresh();
    expect(invokeMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(500);

    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(getProjectHistoryEntries()).toEqual(SNAPSHOT_B);

    // A later burst after the window schedules a fresh fetch.
    await vi.advanceTimersByTimeAsync(500);
    scheduleProjectHistoryEntriesRefresh();
    await vi.advanceTimersByTimeAsync(500);

    expect(invokeMock).toHaveBeenCalledTimes(2);
  });

  it('re-fetches when a burst lands while a fetch is in flight', async () => {
    vi.useFakeTimers();
    const slow = createDeferred<ProjectHistoryEntriesSnapshot>();
    invokeMock.mockReturnValueOnce(slow.promise).mockResolvedValueOnce(SNAPSHOT_B);

    scheduleProjectHistoryEntriesRefresh();
    await vi.advanceTimersByTimeAsync(500);
    expect(invokeMock).toHaveBeenCalledTimes(1);

    // A new publication lands while the first fetch is still pending: the
    // scheduled refresh queues behind it and must land the newer snapshot.
    scheduleProjectHistoryEntriesRefresh();
    slow.resolve(SNAPSHOT_A);
    await vi.advanceTimersByTimeAsync(500);

    expect(invokeMock).toHaveBeenCalledTimes(2);
    expect(getProjectHistoryEntries()).toEqual(SNAPSHOT_B);
  });

  it('drops a deferred response from an older revision for the same document (T042)', async () => {
    // Newer snapshot already applied.
    setProjectHistoryEntries(SNAPSHOT_B);

    // A slow hydration from revision 1 arrives after revision 2 is stored.
    setProjectHistoryEntries(SNAPSHOT_A);

    // Revision 2 must survive: the older response was dropped.
    expect(getProjectHistoryEntries()).toEqual(SNAPSHOT_B);
  });

  it('allows a different document to overwrite regardless of revision (T042)', async () => {
    // Newer snapshot for doc-1 already applied.
    setProjectHistoryEntries(SNAPSHOT_B);

    // Snapshot for a different document at revision 1 — not same-document fencing.
    const otherDoc: ProjectHistoryEntriesSnapshot = {
      ...SNAPSHOT_A,
      documentId: 'doc-2',
    };
    setProjectHistoryEntries(otherDoc);
    expect(getProjectHistoryEntries()).toEqual(otherDoc);
  });

  it('coalesces spaced keystrokes within the gesture window into one fetch (T043)', async () => {
    vi.useFakeTimers();
    invokeMock.mockResolvedValue(SNAPSHOT_B);

    // Simulate keystrokes spaced 200ms apart — well within the 500ms gesture
    // grouping window. The trailing debounce must reset on each call, so no
    // IPC read fires until 500ms after the last keystroke.
    scheduleProjectHistoryEntriesRefresh(); // t=0
    await vi.advanceTimersByTimeAsync(200);
    expect(invokeMock).not.toHaveBeenCalled();

    scheduleProjectHistoryEntriesRefresh(); // t=200
    await vi.advanceTimersByTimeAsync(200);
    expect(invokeMock).not.toHaveBeenCalled();

    scheduleProjectHistoryEntriesRefresh(); // t=400
    await vi.advanceTimersByTimeAsync(200);
    expect(invokeMock).not.toHaveBeenCalled();

    scheduleProjectHistoryEntriesRefresh(); // t=600
    await vi.advanceTimersByTimeAsync(200);
    expect(invokeMock).not.toHaveBeenCalled();

    scheduleProjectHistoryEntriesRefresh(); // t=800 — last keystroke
    // Advance past the full debounce window (500ms from last call).
    await vi.advanceTimersByTimeAsync(500);

    // Only one IPC read for the entire typing gesture.
    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(getProjectHistoryEntries()).toEqual(SNAPSHOT_B);
  });
});
