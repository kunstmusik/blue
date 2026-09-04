import { describe, expect, it, vi } from 'vitest';
import type { BlueData } from '@blue/data';
import { createProjectLifecycle } from './project-lifecycle';
import { ProjectSession } from './project-session';

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
});
