import { afterEach, describe, expect, it, vi } from 'vitest';
import { onlineManager } from '@tanstack/react-query';
import {
  callBlueShare,
  blueShareKey,
  BlueShareQueryError,
  createBlueShareQueryClient,
  readBlueShare,
  unwrapBlueShare,
} from './blueshare-query';

const clients: ReturnType<typeof createBlueShareQueryClient>[] = [];
function client() {
  const c = createBlueShareQueryClient();
  clients.push(c);
  return c;
}
afterEach(() => {
  clients.splice(0).forEach((c) => c.clear());
  onlineManager.setOnline(true);
});

describe('BlueShare Query seam (T086)', () => {
  it('rejects checked failures, preserving only detached sanitized error details', () => {
    const failure = {
      code: 'invalid_input',
      message: 'Check category',
      outcome: 'rejected' as const,
      status: 400,
      fields: { categoryId: 'Select a category' },
    };
    try {
      unwrapBlueShare({ ok: false, error: failure });
      throw new Error('expected failure');
    } catch (error) {
      expect(error).toBeInstanceOf(BlueShareQueryError);
      expect((error as BlueShareQueryError).failure).toEqual(failure);
      expect((error as BlueShareQueryError).failure).not.toBe(failure);
    }
  });
  it('isolates scope/context/operation/kind/selection/account identities and clients', () => {
    const base = blueShareKey('https://a', 'ctx', 'mine', 'effect', null, { id: 'u1', epoch: 1 });
    for (const key of [
      blueShareKey('https://b', 'ctx', 'mine', 'effect'),
      blueShareKey('https://a', 'other', 'mine', 'effect'),
      blueShareKey('https://a', 'ctx', 'latest', 'effect'),
      blueShareKey('https://a', 'ctx', 'mine', 'instrument'),
      blueShareKey('https://a', 'ctx', 'mine', 'effect', 1),
      blueShareKey('https://a', 'ctx', 'mine', 'effect', null, { id: 'u1', epoch: 2 }),
    ])
      expect(key).not.toEqual(base);
    const a = client();
    a.setQueryData(base, ['public']);
    expect(client().getQueryData(base)).toBeUndefined();
  });
  it('dispatches reads and writes offline without retry or a resume queue', async () => {
    onlineManager.setOnline(false);
    const c = client();
    const read = vi
      .fn()
      .mockRejectedValue(new BlueShareQueryError({ code: 'offline', message: 'Unavailable' }));
    await expect(c.fetchQuery({ queryKey: ['test'], queryFn: read })).rejects.toThrow(
      'Unavailable',
    );
    const write = vi
      .fn()
      .mockRejectedValue(
        new BlueShareQueryError({ code: 'offline', message: 'Unavailable', outcome: 'unknown' }),
      );
    await expect(
      c.getMutationCache().build(c, { mutationFn: write }).execute({ key: 1 }),
    ).rejects.toThrow('Unavailable');
    onlineManager.setOnline(true);
    await c.resumePausedMutations();
    expect(read).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledTimes(1);
  });
  it('suppresses cancelled read observation after dispatched IPC', async () => {
    const controller = new AbortController();
    let resolve!: (v: { ok: true; value: number }) => void;
    const result = readBlueShare(
      controller.signal,
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    controller.abort();
    resolve({ ok: true, value: 1 });
    await expect(result).rejects.toThrow();
  });
});

it('never puts a raw IPC exception or proof into a Query error', async () => {
  try {
    await callBlueShare(async () => {
      throw Object.assign(new Error('token=synthetic-proof'), { body: 'synthetic-proof' });
    });
  } catch (error) {
    expect(error).toBeInstanceOf(BlueShareQueryError);
    expect(JSON.stringify(error)).not.toContain('synthetic-proof');
    expect((error as BlueShareQueryError).message).toBe('BlueShare request failed');
  }
});
