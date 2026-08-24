import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createStartupLifecycle } from './startup-lifecycle';

describe('StartupLifecycle', () => {
  it('starts in order and rolls completed reversible stages back in reverse order', async () => {
    const events: string[] = [];
    const lifecycle = createStartupLifecycle([
      { name: 'protocol', start: () => { events.push('start:protocol'); }, rollback: () => { events.push('rollback:protocol'); } },
      { name: 'windows', start: () => { events.push('start:windows'); }, rollback: () => { events.push('rollback:windows'); } },
      { name: 'registrars', start: () => { events.push('start:registrars'); throw new Error('registrar failed'); } },
    ]);

    await expect(lifecycle.start()).rejects.toThrow('registrar failed');
    expect(events).toEqual([
      'start:protocol',
      'start:windows',
      'start:registrars',
      'rollback:windows',
      'rollback:protocol',
    ]);
    expect(lifecycle.startedStageNames()).toEqual([]);
  });

  it('continues rollback after cleanup errors and preserves the startup error', async () => {
    const errors: unknown[] = [];
    const errorSpy = vi.spyOn(console, 'error').mockImplementation((...args) => errors.push(args));
    const events: string[] = [];
    const lifecycle = createStartupLifecycle([
      { name: 'one', start: () => { events.push('start:one'); }, rollback: () => { throw new Error('cleanup one'); } },
      { name: 'two', start: () => { events.push('start:two'); }, rollback: () => { events.push('rollback:two'); } },
      { name: 'three', start: () => { throw new Error('startup three'); } },
    ]);

    await expect(lifecycle.start()).rejects.toThrow('startup three');
    expect(events).toEqual(['start:one', 'start:two', 'rollback:two']);
    expect(errors).toHaveLength(1);
    errorSpy.mockRestore();
  });

  it('does not roll back irreversible process-lifetime stages and does not duplicate start work', async () => {
    const starts = vi.fn();
    const lifecycle = createStartupLifecycle([
      { name: 'audio-scheme', start: starts, irreversible: true, rollback: vi.fn() },
      { name: 'window', start: starts, rollback: vi.fn() },
    ]);

    await lifecycle.start();
    await lifecycle.start();
    expect(starts).toHaveBeenCalledTimes(2);
    expect(lifecycle.startedStageNames()).toEqual(['audio-scheme', 'window']);
  });

  it('can retry from the first stage after a failed startup rollback', async () => {
    const events: string[] = [];
    let shouldFail = true;
    const lifecycle = createStartupLifecycle([
      {
        name: 'registrars',
        start: () => { events.push('start:registrars'); },
        rollback: () => { events.push('rollback:registrars'); },
      },
      {
        name: 'services',
        start: () => {
          events.push('start:services');
          if (shouldFail) throw new Error('services failed');
        },
      },
    ]);

    await expect(lifecycle.start()).rejects.toThrow('services failed');
    shouldFail = false;
    await lifecycle.start();

    expect(events).toEqual([
      'start:registrars',
      'start:services',
      'rollback:registrars',
      'start:registrars',
      'start:services',
    ]);
    expect(lifecycle.startedStageNames()).toEqual(['registrars', 'services']);
  });

  it('keeps normal shutdown explicit and ordered separately from failed-startup rollback', () => {
    const source = readFileSync(path.join(__dirname, 'main.ts'), 'utf8');
    const shutdownStart = source.indexOf('async function doQuit()');
    const shutdownEnd = source.indexOf('// ─── File Operations', shutdownStart);
    const shutdown = source.slice(shutdownStart, shutdownEnd);
    const orderedOperations = [
      'await oscControlService?.shutdown()',
      'unregisterDomainIpc?.()',
      'unregisterUnifiedLibraryIpc?.()',
      'await unifiedLibraryService?.stop()',
      'unregisterCodeRepositoryIpc?.()',
      'await codeRepositoryService?.stop()',
      'await midiInputCoordinator?.requestShutdown()',
      'await blueLiveSession.stop()',
      'await engineBridge.dispose()',
      'await javaRuntimeSessionManager?.dispose()',
      'disposeJavaScriptSession()',
      "closeEffectEditorWindowsForOwner('project')",
      'projectSession.resetForShutdown()',
      'await cleanupTempCsdSnapshots()',
      'app.quit()',
    ];

    let previous = -1;
    for (const operation of orderedOperations) {
      const index = shutdown.indexOf(operation);
      expect(index, operation).toBeGreaterThan(previous);
      previous = index;
    }
    expect(shutdown).not.toContain('rollbackFailedStartup');
  });
});
