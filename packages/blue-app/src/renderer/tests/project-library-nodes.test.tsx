// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDeferred } from '../../main/project-history-test-support';
import { useProjectLibraryNodes } from '../components/libraries/use-project-library-nodes';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function Probe({ session = 1, revision = 0 }: { session?: number; revision?: number }) {
  const nodes = useProjectLibraryNodes('projectOwned', 'effect', session, revision);
  return <span>{nodes.map((node) => node.nodeId).join(',')}</span>;
}
function page(nodeId: string, nextCursor?: string) {
  return { ok: true, value: { children: [{ nodeId }], contentRevision: 7, nextCursor } };
}

describe('project library refresh ownership', () => {
  let host: HTMLDivElement;
  let root: Root;
  let changed: () => void;
  const browse = vi.fn();
  const unsubscribe = vi.fn();
  beforeEach(() => {
    browse.mockReset();
    unsubscribe.mockReset();
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    window.blueAPI = {
      browseLibraries: browse,
      onLibraryChanged: (listener: () => void) => {
        changed = listener;
        return unsubscribe;
      },
    } as never;
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it('coalesces bursts and stops invalidated pagination before publishing a replacement', async () => {
    const first = createDeferred<unknown>();
    const next = createDeferred<unknown>();
    browse.mockReturnValueOnce(first.promise).mockReturnValueOnce(next.promise);
    await act(async () => root.render(<Probe />));
    act(() => {
      changed();
      changed();
      changed();
    });
    expect(browse).toHaveBeenCalledOnce();
    await act(async () => first.resolve(page('stale', 'old-page-2')));
    expect(browse).toHaveBeenCalledTimes(2);
    expect(browse.mock.calls[1][0].cursor).toBeUndefined();
    expect(host.textContent).toBe('');
    await act(async () => next.resolve(page('fresh')));
    expect(host.textContent).toBe('fresh');
  });

  it('fences late old-session results and stops fetching pages after unmount', async () => {
    const old = createDeferred<unknown>();
    const current = createDeferred<unknown>();
    browse.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    await act(async () => root.render(<Probe />));
    await act(async () => root.render(<Probe session={2} />));
    await act(async () => current.resolve(page('current')));
    expect(host.textContent).toBe('current');
    await act(async () => old.resolve(page('old', 'old-page-2')));
    expect(browse).toHaveBeenCalledTimes(2);
    expect(host.textContent).toBe('current');
    const pending = createDeferred<unknown>();
    browse.mockReturnValueOnce(pending.promise);
    act(() => changed());
    act(() => root.unmount());
    await act(async () => pending.resolve(page('unmounted', 'page-2')));
    expect(browse).toHaveBeenCalledTimes(3);
    expect(unsubscribe).toHaveBeenCalledTimes(2);
    root = createRoot(host);
  });

  it('preserves pagination validation and retries after a current refresh failure', async () => {
    browse.mockResolvedValueOnce(page('a', 'page-2')).mockResolvedValueOnce(page('b'));
    await act(async () => root.render(<Probe />));
    expect(host.textContent).toBe('a,b');
    expect(browse.mock.calls[1][0]).toMatchObject({ cursor: 'page-2', expectedContentRevision: 7 });
    browse.mockRejectedValueOnce(new Error('browse failed'));
    await act(async () => changed());
    expect(host.textContent).toBe('');
    browse.mockResolvedValueOnce(page('recovered'));
    await act(async () => changed());
    expect(host.textContent).toBe('recovered');
    browse
      .mockResolvedValueOnce(page('same-cursor', 'repeat'))
      .mockResolvedValueOnce(page('same-cursor', 'repeat'));
    await act(async () => changed());
    expect(host.textContent).toBe('');
  });
});
