import { describe, expect, it, vi, beforeEach } from 'vitest';

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock('electron', () => ({
  clipboard: { writeText: vi.fn(), readText: vi.fn() },
  contextBridge: { exposeInMainWorld: vi.fn() },
  ipcRenderer: { invoke: invokeMock },
  webUtils: { getPathForFile: vi.fn(() => '') },
}));

type PreloadBridge = {
  getBlueX7EffectiveValues: (
    request: unknown,
  ) => Promise<unknown>;
};

async function loadBridge(): Promise<PreloadBridge> {
  vi.resetModules();
  await import('./preload');
  const { contextBridge } = await import('electron');
  const calls = (contextBridge as unknown as {
    exposeInMainWorld: ReturnType<typeof vi.fn>;
  }).exposeInMainWorld.mock.calls;
  const bridge = calls.find(([name]) => name === 'blueAPI')?.[1] as PreloadBridge;
  if (!bridge) throw new Error('blueAPI bridge was not exposed');
  return bridge;
}

describe('BlueX7 effective-values preload surface (Spec 092)', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it('forwards visible-control requests to the blue-x7-effective-values channel verbatim', async () => {
    const bridge = await loadBridge();
    const request = {
      target: { assignmentId: '1' },
      projectSessionId: 3,
      parameterIds: ['param-a', 'param-b'],
    };
    const result = {
      ok: true,
      projectSessionId: 3,
      ownerIdentity: 'arrangement:1',
      engineSequence: 7,
      values: [{ parameterId: 'param-a', value: 1 }],
    };
    invokeMock.mockResolvedValueOnce(result);

    await expect(bridge.getBlueX7EffectiveValues(request)).resolves.toEqual(result);
    expect(invokeMock).toHaveBeenCalledWith('blue-x7-effective-values', request);
  });

  it('propagates unavailable results unchanged (fail-closed pass-through)', async () => {
    const bridge = await loadBridge();
    invokeMock.mockResolvedValueOnce({ ok: false, reason: 'stale-session' });

    await expect(
      bridge.getBlueX7EffectiveValues({
        target: { track: { projectSessionId: 1, rootGroupId: 'g', trackId: 't' } },
        projectSessionId: 1,
        parameterIds: ['param-a'],
      }),
    ).resolves.toEqual({ ok: false, reason: 'stale-session' });
  });
});
