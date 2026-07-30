import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EngineBridge } from './engine-bridge';
import type { EngineRuntimeService } from './engine-runtime';

const { showErrorBox } = vi.hoisted(() => ({ showErrorBox: vi.fn() }));

vi.mock('electron', () => ({
  BrowserWindow: class BrowserWindow {},
  dialog: { showErrorBox },
}));

function windowStub() {
  return { webContents: { send: vi.fn() } } as never;
}

describe('EngineBridge runtime selection', () => {
  beforeEach(() => showErrorBox.mockClear());

  it('does not search PATH for a legacy relative engine name', () => {
    const bridge = new EngineBridge(windowStub(), 'blue-engine');
    expect((bridge as unknown as { findEngine(): string | null }).findEngine()).toBeNull();
  });

  it('accepts only an existing absolute legacy constructor path', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'blue-bridge-engine-'));
    const executablePath = path.join(root, 'blue-engine');
    writeFileSync(executablePath, 'fixture');
    const bridge = new EngineBridge(windowStub(), executablePath);
    expect((bridge as unknown as { findEngine(): string | null }).findEngine())
      .toBe(executablePath);
  });

  it('gates process startup on the runtime probe and reports missing Csound', async () => {
    const runtime = {
      probe: vi.fn(async () => ({
        ok: false,
        selection: {
          source: 'development',
          executablePath: '/workspace/native/blue-engine/dist/darwin-arm64/blue-engine',
          expectedProtocolVersion: 1,
          artifactSha256: 'hash',
          diagnostic: null,
        },
        report: null,
        errorCode: 'CSOUND_UNAVAILABLE',
        message: 'Csound 7 was not found',
        durationMs: 1,
      })),
    } as unknown as EngineRuntimeService;
    const bridge = new EngineBridge(windowStub(), undefined, undefined, undefined, 'realtime', runtime);

    await expect(bridge.startEngine()).resolves.toBe(false);
    expect(runtime.probe).toHaveBeenCalledOnce();
    expect(showErrorBox).toHaveBeenCalledWith(
      'Csound Is Not Available',
      'Csound 7 was not found',
    );
  });
});
