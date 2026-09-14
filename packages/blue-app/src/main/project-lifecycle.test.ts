import { describe, expect, it, vi } from 'vitest';
import type { BlueData } from '@blue/data';
import { createProjectLifecycle } from './project-lifecycle';
import { ProjectSession } from './project-session';
import { ProjectHistory } from './project-history';

const data = {} as BlueData;

describe('ProjectLifecycle', () => {
  it('orders replacement cleanup, identity replacement, service reset, and publication', async () => {
    const events: string[] = [];
    const session = new ProjectSession();
    session.replace(data, '/tmp/old.blue');
    const lifecycle = createProjectLifecycle({
      session,
      stopProjectRuntimes: () => {
        events.push('stop');
      },
      closeProjectEditors: () => {
        events.push('editors');
      },
      clearProjectServices: () => {
        events.push('clear');
      },
      publishProjectChanged: () => {
        events.push('changed');
      },
      publishProjectLoaded: () => {
        events.push('loaded');
      },
    });

    const snapshot = await lifecycle.replace({ data, filePath: '/tmp/new.blue' });

    expect(events).toEqual(['stop', 'editors', 'clear', 'changed', 'loaded']);
    expect(snapshot.filePath).toBe('/tmp/new.blue');
    expect(session.read().sessionId).toBe(2);
  });

  it('loads candidates before touching the active project', async () => {
    const events: string[] = [];
    const session = new ProjectSession();
    session.replace(data, '/tmp/active.blue');
    const lifecycle = createProjectLifecycle({
      session,
      stopProjectRuntimes: () => {
        events.push('stop');
      },
    });

    await expect(
      lifecycle.open(() => {
        throw new Error('parse failed');
      }),
    ).rejects.toThrow('parse failed');
    expect(session.read().filePath).toBe('/tmp/active.blue');
    expect(events).toEqual([]);
  });

  it('keeps save and save-as writes ahead of publication and preserves cancellation status', async () => {
    const events: string[] = [];
    const writes = vi.fn(async (_value: BlueData, path: string) => {
      events.push(`write:${path}`);
    });
    const session = new ProjectSession();
    const lifecycle = createProjectLifecycle({
      session,
      publishProjectChanged: (snapshot) => {
        events.push(`changed:${snapshot.filePath}`);
      },
    });

    expect(await lifecycle.save(writes)).toBe(false);
    session.replace(data, '/tmp/project.blue');
    expect(await lifecycle.save(writes)).toBe(true);
    expect(await lifecycle.saveAs('/tmp/renamed.blue', writes)).toBe(true);
    expect(writes).toHaveBeenCalledTimes(2);
    expect(events).toEqual([
      'write:/tmp/project.blue',
      'changed:/tmp/project.blue',
      'write:/tmp/renamed.blue',
      'changed:/tmp/renamed.blue',
    ]);
  });

  it('closes runtime/editor owners before clearing identity and publishes one closed snapshot', async () => {
    const events: string[] = [];
    const session = new ProjectSession();
    session.replace(data, '/tmp/project.blue');
    const lifecycle = createProjectLifecycle({
      session,
      stopProjectRuntimes: () => {
        events.push('stop');
      },
      closeProjectEditors: () => {
        events.push('editors');
      },
      clearProjectServices: () => {
        events.push('clear');
      },
      publishProjectClosed: (snapshot) => {
        events.push(`closed:${snapshot.data}`);
      },
    });

    const snapshot = await lifecycle.close();
    expect(events).toEqual(['stop', 'editors', 'clear', 'closed:null']);
    expect(snapshot.data).toBeNull();
  });

  describe('history boundary integration', () => {
    it('clears history and checkpoints initial stateId on replace', async () => {
      const session = new ProjectSession();
      session.replace(data, '/tmp/initial.blue');

      const historyMock = {
        checkpointSave: vi.fn(),
        clear: vi.fn(),
        closeGroup: vi.fn(),
      };

      const lifecycle = createProjectLifecycle({
        session,
        history: historyMock,
      });

      const nextData = {} as BlueData;
      const snapshot = await lifecycle.replace({ data: nextData, filePath: '/tmp/next.blue' });

      expect(historyMock.clear).toHaveBeenCalledTimes(1);
      expect(historyMock.checkpointSave).toHaveBeenCalledTimes(1);
      expect(historyMock.checkpointSave).toHaveBeenCalledWith(snapshot.stateId);
    });

    it('leaves prior session and history checkpoint unchanged when open fails', async () => {
      const session = new ProjectSession();
      const initial = session.replace(data, '/tmp/current.blue');

      const historyMock = {
        checkpointSave: vi.fn(),
        clear: vi.fn(),
        closeGroup: vi.fn(),
      };

      const lifecycle = createProjectLifecycle({
        session,
        history: historyMock,
      });

      await expect(
        lifecycle.open(() => {
          throw new Error('Load failed');
        }),
      ).rejects.toThrow('Load failed');

      expect(historyMock.clear).not.toHaveBeenCalled();
      expect(historyMock.checkpointSave).not.toHaveBeenCalled();
      expect(session.read().documentId).toBe(initial.documentId);
      expect(session.read().stateId).toBe(initial.stateId);
    });

    it('closes group and checkpoints exact written state on successful save', async () => {
      const session = new ProjectSession();
      session.replace(data, '/tmp/test.blue');
      const mutation = session.recordMutation({ changed: true });

      const historyMock = {
        checkpointSave: vi.fn(),
        clear: vi.fn(),
        closeGroup: vi.fn(),
      };

      const lifecycle = createProjectLifecycle({
        session,
        history: historyMock,
      });

      const write = vi.fn();
      const success = await lifecycle.save(write);

      expect(success).toBe(true);
      expect(write).toHaveBeenCalledWith(data, '/tmp/test.blue');
      expect(historyMock.closeGroup).toHaveBeenCalledTimes(1);
      expect(historyMock.checkpointSave).toHaveBeenCalledWith(mutation.stateId);
    });

    it('leaves prior checkpoint unchanged when save write fails', async () => {
      const session = new ProjectSession();
      session.replace(data, '/tmp/test.blue');
      session.recordMutation({ changed: true });

      const historyMock = {
        checkpointSave: vi.fn(),
        clear: vi.fn(),
        closeGroup: vi.fn(),
      };

      const lifecycle = createProjectLifecycle({
        session,
        history: historyMock,
      });

      const write = vi.fn().mockRejectedValue(new Error('Disk write error'));

      await expect(lifecycle.save(write)).rejects.toThrow('Disk write error');
      expect(historyMock.closeGroup).toHaveBeenCalledTimes(1);
      expect(historyMock.checkpointSave).not.toHaveBeenCalled();
    });

    it('checkpoints the written state even if a newer edit arrives while write is in flight', async () => {
      const session = new ProjectSession();
      session.replace(data, '/tmp/test.blue');
      const firstMutation = session.recordMutation({ changed: true });

      const historyMock = {
        checkpointSave: vi.fn(),
        clear: vi.fn(),
        closeGroup: vi.fn(),
      };

      const lifecycle = createProjectLifecycle({
        session,
        history: historyMock,
      });

      let secondMutationStateId = '';
      const slowWrite = vi.fn(async () => {
        // A newer mutation arrives while saving
        const second = session.recordMutation({ changed: true });
        secondMutationStateId = second.stateId!;
      });

      const success = await lifecycle.save(slowWrite);
      expect(success).toBe(true);
      // It checkpointed the state that was written (firstMutation), NOT the newer state
      expect(historyMock.checkpointSave).toHaveBeenCalledWith(firstMutation.stateId);
      expect(historyMock.checkpointSave).not.toHaveBeenCalledWith(secondMutationStateId);
    });

    it('publishes path and checkpoints state on successful saveAs, but not on failed saveAs', async () => {
      const session = new ProjectSession();
      session.replace(data, '/tmp/original.blue');
      const mutation = session.recordMutation({ changed: true });

      const historyMock = {
        checkpointSave: vi.fn(),
        clear: vi.fn(),
        closeGroup: vi.fn(),
      };

      const lifecycle = createProjectLifecycle({
        session,
        history: historyMock,
      });

      // Failed saveAs
      const failingWrite = vi.fn().mockRejectedValue(new Error('SaveAs failed'));
      await expect(lifecycle.saveAs('/tmp/attempted.blue', failingWrite)).rejects.toThrow(
        'SaveAs failed',
      );
      expect(session.read().filePath).toBe('/tmp/original.blue');
      expect(historyMock.checkpointSave).not.toHaveBeenCalled();

      // Successful saveAs
      const successfulWrite = vi.fn();
      const success = await lifecycle.saveAs('/tmp/renamed.blue', successfulWrite);
      expect(success).toBe(true);
      expect(session.read().filePath).toBe('/tmp/renamed.blue');
      expect(historyMock.checkpointSave).toHaveBeenCalledWith(mutation.stateId);
    });

    it('clears history and clears checkpoint on close', async () => {
      const session = new ProjectSession();
      session.replace(data, '/tmp/test.blue');

      const historyMock = {
        checkpointSave: vi.fn(),
        clear: vi.fn(),
        closeGroup: vi.fn(),
      };

      const lifecycle = createProjectLifecycle({
        session,
        history: historyMock,
      });

      await lifecycle.close();
      expect(historyMock.clear).toHaveBeenCalledTimes(1);
      expect(historyMock.checkpointSave).toHaveBeenCalledWith(undefined);
    });

    it('preserves history and checkpoint across editor closure and runtime restart', async () => {
      const session = new ProjectSession();
      session.replace(data, '/tmp/test.blue');
      const mutation = session.recordMutation({ changed: true });

      const historyMock = {
        checkpointSave: vi.fn(),
        clear: vi.fn(),
        closeGroup: vi.fn(),
      };

      const closeEditors = vi.fn();
      const stopRuntimes = vi.fn();

      const lifecycle = createProjectLifecycle({
        session,
        history: historyMock,
        closeProjectEditors: closeEditors,
        stopProjectRuntimes: stopRuntimes,
      });

      // Save to establish checkpoint
      await lifecycle.save(vi.fn());
      expect(historyMock.checkpointSave).toHaveBeenCalledWith(mutation.stateId);
      historyMock.checkpointSave.mockClear();

      // Editor closure hook (e.g. closing an effect editor window or track instrument window)
      // Closing editors must not clear project history or the saved checkpoint
      closeEditors();
      expect(historyMock.clear).not.toHaveBeenCalled();
      expect(historyMock.checkpointSave).not.toHaveBeenCalled();

      // Runtime restart (stopping runtimes, e.g. for playback restart or recompilation)
      // Restarting runtime must not clear project history or the saved checkpoint
      stopRuntimes();
      expect(historyMock.clear).not.toHaveBeenCalled();
      expect(historyMock.checkpointSave).not.toHaveBeenCalled();
    });

    it('isolates project history across project replacement', async () => {
      const session = new ProjectSession();
      session.replace(data, '/tmp/first.blue');
      session.recordMutation({ changed: true });

      const historyMock = {
        checkpointSave: vi.fn(),
        clear: vi.fn(),
        closeGroup: vi.fn(),
      };

      const lifecycle = createProjectLifecycle({
        session,
        history: historyMock,
      });

      const nextData = { id: 'second-project' } as unknown as BlueData;
      const snapshot = await lifecycle.replace({ data: nextData, filePath: '/tmp/second.blue' });

      // Replacement must clear old history and checkpoint the new project initial state
      expect(historyMock.clear).toHaveBeenCalledTimes(1);
      expect(historyMock.checkpointSave).toHaveBeenCalledWith(snapshot.stateId);
      expect(session.read().filePath).toBe('/tmp/second.blue');
      expect(session.read().data).toBe(nextData);
    });
  });

  describe('save-state lifecycle (spec 109)', () => {
    function setupSaveStateLifecycle() {
      const session = new ProjectSession();
      const history = new ProjectHistory({ session });
      const lifecycle = createProjectLifecycle({ session, history });
      return { session, history, lifecycle };
    }

    it('yields unsaved on create even with a clean initial history', async () => {
      const { session, history, lifecycle } = setupSaveStateLifecycle();
      await lifecycle.open(async () => ({ data, filePath: null }));
      expect(session.read().filePath).toBeNull();
      expect(history.isDirty()).toBe(false);
      expect(history.getSaveState()).toBe('unsaved');
    });

    it('yields saved on a successful open', async () => {
      const { history, lifecycle } = setupSaveStateLifecycle();
      await lifecycle.open(async () => ({ data, filePath: '/tmp/opened.blue' }));
      expect(history.getSaveState()).toBe('saved');
    });

    it('checkpoints the written stateId on successful save and save-as', async () => {
      const { session, history, lifecycle } = setupSaveStateLifecycle();
      await lifecycle.open(async () => ({ data, filePath: '/tmp/project.blue' }));
      session.recordMutation({ changed: true });
      expect(history.getSaveState()).toBe('modified');

      expect(await lifecycle.save(vi.fn())).toBe(true);
      expect(history.getSaveState()).toBe('saved');

      session.recordMutation({ changed: true });
      expect(history.getSaveState()).toBe('modified');
      expect(await lifecycle.saveAs('/tmp/renamed.blue', vi.fn())).toBe(true);
      expect(session.read().filePath).toBe('/tmp/renamed.blue');
      expect(history.getSaveState()).toBe('saved');
    });

    it('preserves the prior path and checkpoint when a save fails or is cancelled', async () => {
      const { session, history, lifecycle } = setupSaveStateLifecycle();
      await lifecycle.open(async () => ({ data, filePath: '/tmp/project.blue' }));
      const mutation = session.recordMutation({ changed: true });
      const checkpointBefore = history.getSavedStateId();

      await expect(
        lifecycle.save(vi.fn().mockRejectedValue(new Error('Disk full'))),
      ).rejects.toThrow('Disk full');
      expect(session.read().filePath).toBe('/tmp/project.blue');
      expect(history.getSavedStateId()).toBe(checkpointBefore);
      expect(history.getSaveState()).toBe('modified');
      expect(session.read().stateId).toBe(mutation.stateId);

      await expect(
        lifecycle.saveAs('/tmp/attempted.blue', vi.fn().mockRejectedValue(new Error('Nope'))),
      ).rejects.toThrow('Nope');
      expect(session.read().filePath).toBe('/tmp/project.blue');
      expect(history.getSavedStateId()).toBe(checkpointBefore);
    });

    it('yields none after close', async () => {
      const { history, lifecycle } = setupSaveStateLifecycle();
      await lifecycle.open(async () => ({ data, filePath: '/tmp/project.blue' }));
      await lifecycle.close();
      expect(history.getSaveState()).toBe('none');
    });

    it('fences async save completion by document identity', async () => {
      const { session, history, lifecycle } = setupSaveStateLifecycle();
      await lifecycle.open(async () => ({ data, filePath: '/tmp/project.blue' }));
      const mutation = session.recordMutation({ changed: true });
      const checkpointBefore = history.getSavedStateId();

      // The project is replaced by a different document while the write is in
      // flight; the stale save must not checkpoint the replacement baseline.
      const stalledWrite = vi.fn(async () => {
        await lifecycle.replace({ data: {} as BlueData, filePath: '/tmp/other.blue' });
      });
      await lifecycle.save(stalledWrite);

      expect(history.getSavedStateId()).not.toBe(mutation.stateId);
      expect(history.getSavedStateId()).toBe(session.read().stateId);
      expect(history.getSaveState()).toBe('saved');
      expect(checkpointBefore).not.toBe(session.read().stateId);
    });
  });
});
