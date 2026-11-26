import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import {
  MCP_SERVER_COPY_CLIENT_CONFIG_CHANNEL,
  MCP_SERVER_COPY_CREDENTIAL_CHANNEL,
  MCP_SERVER_GET_STATUS_CHANNEL,
  MCP_SERVER_ROTATE_CREDENTIAL_CHANNEL,
  MCP_SERVER_STATUS_CHANGED_CHANNEL,
  type McpServerStatus,
} from '../shared/mcp-server';

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn(),
  exposedApi: null as Record<string, any> | null,
}));

vi.mock('electron', () => ({
  clipboard: { readText: vi.fn(), writeText: vi.fn() },
  contextBridge: {
    exposeInMainWorld: (_name: string, api: Record<string, any>) => {
      mocks.exposedApi = api;
    },
  },
  ipcRenderer: {
    invoke: mocks.invoke,
    on: mocks.on,
    removeListener: mocks.removeListener,
    send: vi.fn(),
  },
}));

import './preload';

function makeStatus(overrides: Partial<McpServerStatus> = {}): McpServerStatus {
  return {
    phase: 'listening',
    preferredPort: 8765,
    accessMode: 'read-only',
    activePort: 8765,
    fallbackFrom: null,
    credentialStorage: 'persisted',
    error: null,
    revision: 1,
    updatedAt: '2026-11-26T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  mocks.invoke.mockReset();
  mocks.on.mockReset();
  mocks.removeListener.mockReset();
});

describe('MCP preload API (T012, T037)', () => {
  it('requests and validates the sanitized MCP server status', async () => {
    const validStatus = makeStatus({ activePort: 49210, fallbackFrom: 8765 });
    mocks.invoke.mockResolvedValueOnce(validStatus);

    const status = await mocks.exposedApi!.getMcpServerStatus();

    expect(mocks.invoke).toHaveBeenCalledWith(MCP_SERVER_GET_STATUS_CHANNEL);
    expect(status).toEqual(validStatus);
  });

  it('rejects invalid MCP server status payloads from IPC', async () => {
    mocks.invoke.mockResolvedValueOnce({ phase: 'unknown' });

    await expect(mocks.exposedApi!.getMcpServerStatus()).rejects.toThrow(
      'Invalid MCP server status payload.',
    );
  });

  it('forwards only valid MCP server status updates and cleans up subscriptions', () => {
    let handler: ((event: unknown, payload: unknown) => void) | null = null;
    mocks.on.mockImplementation((_channel: string, listener: typeof handler) => {
      handler = listener;
    });
    const callback = vi.fn();
    const unsubscribe = mocks.exposedApi!.onMcpServerStatus(callback);

    const listeningStatus = makeStatus({ revision: 3 });
    handler!({}, listeningStatus);
    handler!({}, { phase: 'invalid-phase' });
    handler!({}, { ...listeningStatus, preferredPort: 80 });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(listeningStatus);
    expect(mocks.on).toHaveBeenCalledWith(MCP_SERVER_STATUS_CHANGED_CHANNEL, expect.any(Function));

    unsubscribe();
    expect(mocks.removeListener).toHaveBeenCalledWith(
      MCP_SERVER_STATUS_CHANGED_CHANNEL,
      expect.any(Function),
    );
  });

  it('validates copyMcpCredential results and rejects payloads carrying extra token fields', async () => {
    mocks.invoke.mockResolvedValueOnce({ ok: true });
    expect(await mocks.exposedApi!.copyMcpCredential()).toEqual({ ok: true });
    expect(mocks.invoke).toHaveBeenCalledWith(MCP_SERVER_COPY_CREDENTIAL_CHANNEL);

    mocks.invoke.mockResolvedValueOnce({
      ok: false,
      code: 'MCP_UNAVAILABLE',
      message: 'Start MCP before copying credentials.',
    });
    expect(await mocks.exposedApi!.copyMcpCredential()).toEqual({
      ok: false,
      code: 'MCP_UNAVAILABLE',
      message: 'Start MCP before copying credentials.',
    });

    mocks.invoke.mockResolvedValueOnce({ ok: true, token: 'leaked-secret' });
    expect(await mocks.exposedApi!.copyMcpCredential()).toEqual({
      ok: false,
      code: 'MCP_UNAVAILABLE',
      message: 'Invalid MCP copy response.',
    });
  });

  it('validates client targets before invoking copyMcpClientConfig and validates results', async () => {
    const invalidResult = await mocks.exposedApi!.copyMcpClientConfig('claude-desktop');
    expect(invalidResult).toEqual({
      ok: false,
      code: 'MCP_UNAVAILABLE',
      message: 'Unsupported MCP client target.',
    });
    expect(mocks.invoke).not.toHaveBeenCalled();

    mocks.invoke.mockResolvedValueOnce({ ok: true });
    expect(await mocks.exposedApi!.copyMcpClientConfig('cursor')).toEqual({ ok: true });
    expect(mocks.invoke).toHaveBeenCalledWith(MCP_SERVER_COPY_CLIENT_CONFIG_CHANNEL, 'cursor');

    mocks.invoke.mockResolvedValueOnce({ ok: true, token: 'secret' });
    expect(await mocks.exposedApi!.copyMcpClientConfig('vscode')).toEqual({
      ok: false,
      code: 'MCP_UNAVAILABLE',
      message: 'Invalid MCP copy response.',
    });
  });

  it('validates rotateMcpCredential responses without exposing raw credentials', async () => {
    mocks.invoke.mockResolvedValueOnce({ ok: true, storage: 'persisted' });
    expect(await mocks.exposedApi!.rotateMcpCredential()).toEqual({
      ok: true,
      storage: 'persisted',
    });
    expect(mocks.invoke).toHaveBeenCalledWith(MCP_SERVER_ROTATE_CREDENTIAL_CHANNEL);

    mocks.invoke.mockResolvedValueOnce({ ok: true, storage: 'session-only' });
    expect(await mocks.exposedApi!.rotateMcpCredential()).toEqual({
      ok: true,
      storage: 'session-only',
    });

    mocks.invoke.mockResolvedValueOnce({
      ok: false,
      code: 'ROTATION_FAILED',
      message: 'Previous credential could not be cleared.',
    });
    expect(await mocks.exposedApi!.rotateMcpCredential()).toEqual({
      ok: false,
      code: 'ROTATION_FAILED',
      message: 'Previous credential could not be cleared.',
    });

    mocks.invoke.mockResolvedValueOnce({ ok: true, storage: 'persisted', token: 'leaked' });
    expect(await mocks.exposedApi!.rotateMcpCredential()).toEqual({
      ok: false,
      code: 'ROTATION_FAILED',
      message: 'Invalid MCP credential rotation response.',
    });
  });
});
