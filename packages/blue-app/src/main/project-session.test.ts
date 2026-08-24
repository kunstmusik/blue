import { describe, expect, it } from 'vitest';
import type { BlueData } from '@blue/data';
import { ProjectSession } from './project-session';

const data = {} as BlueData;

describe('ProjectSession', () => {
  it('owns empty, unsaved, saved, replaced, closed, and shutdown transitions', () => {
    const session = new ProjectSession();
    expect(session.read()).toMatchObject({ data: null, filePath: null, revision: 0, sessionId: 0 });

    const unsaved = session.replace(data, null);
    expect(unsaved).toMatchObject({ data, filePath: null, revision: 0, sessionId: 1 });

    const saved = session.publishPath('/tmp/example.blue');
    expect(saved).toMatchObject({ data, filePath: '/tmp/example.blue', revision: 0, sessionId: 1 });

    const changed = session.recordMutation({ changed: true });
    expect(changed).toEqual({ changed: true, revision: 1, sessionId: 1 });
    expect(session.recordMutation({ changed: false })).toEqual({ changed: false, revision: 1, sessionId: 1 });

    const replaced = session.replace(data, 'C:\\Projects\\next.blue');
    expect(replaced).toMatchObject({ data, filePath: 'C:\\Projects\\next.blue', revision: 0, sessionId: 2 });

    const closed = session.close();
    expect(closed).toMatchObject({ data: null, filePath: null, revision: 0, sessionId: 3 });

    session.resetForShutdown();
    expect(session.read()).toEqual(closed);
  });

  it('advances the session fence without resetting the accepted revision when requested', () => {
    const session = new ProjectSession();
    session.replace(data, '\\\\server\\share\\project.blue');
    const receipt = session.recordMutation({ changed: true, invalidateSession: true });

    expect(receipt).toEqual({ changed: true, revision: 1, sessionId: 2 });
    expect(session.read().revision).toBe(1);
    expect(session.read().filePath).toBe('\\\\server\\share\\project.blue');
  });

  it('fails closed for invalid operations and keeps resetForShutdown idempotent', () => {
    const session = new ProjectSession();
    expect(() => session.publishPath('/tmp/no-project.blue')).toThrow('without an active project');
    expect(() => session.recordMutation({ changed: true })).toThrow('without an active project');

    session.replace(data, '/tmp/project.blue');
    session.recordMutation({ changed: true });
    session.resetForShutdown();
    const first = session.read();
    session.resetForShutdown();
    expect(session.read()).toEqual(first);
  });
});
