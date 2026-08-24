import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initializeJavaScriptRuntime, JavaScriptSession } from '@blue/data';
import { evaluateJavaScriptConsole } from './repl-console-runtime';

describe('evaluateJavaScriptConsole', () => {
  let session: JavaScriptSession;

  beforeAll(async () => {
    await initializeJavaScriptRuntime();
  });

  afterEach(() => {
    session?.dispose();
  });

  function createSession(): void {
    session = new JavaScriptSession();
  }

  const project = {
    projectDir: '/tmp/blue-project/',
    data: {
      projectProperties: { title: 'Console Project' },
    },
    project: {
      loaded: true,
      sessionId: 7,
      label: 'Console Project',
      filePath: '/tmp/blue-project/project.blue',
      projectDir: '/tmp/blue-project',
    },
  };

  it('keeps a session alive and exposes project context', () => {
    createSession();

    const first = evaluateJavaScriptConsole(
      session,
      { code: 'globalThis.counter = 4; console.log("hello", counter); counter', projectSessionId: 7 },
      project,
    );
    const second = evaluateJavaScriptConsole(
      session,
      {
        code: '({ count: counter + 1, title: blueData.projectProperties.title, dir: blueProjectDir, label: blueProject.label })',
        projectSessionId: 7,
      },
      project,
    );

    expect(first).toMatchObject({
      ok: true,
      value: '4',
      stdout: 'hello 4',
      stderr: '',
      projectSessionId: 7,
    });
    expect(second.ok).toBe(true);
    expect(second.value).toContain('"count": 5');
    expect(second.value).toContain('"title": "Console Project"');
    expect(second.value).toContain('"dir": "/tmp/blue-project/"');
    expect(second.value).toContain('"label": "Console Project"');
  });

  it('returns console errors and captured stderr without losing the session', () => {
    createSession();

    const failed = evaluateJavaScriptConsole(
      session,
      { code: 'console.warn("warning"); throw new Error("boom")', projectSessionId: 7 },
      project,
    );
    const recovered = evaluateJavaScriptConsole(
      session,
      { code: 'counterWasNotCreated = 9; counterWasNotCreated', projectSessionId: 7 },
      project,
    );

    expect(failed.ok).toBe(false);
    expect(failed.stderr).toBe('warning');
    expect(failed.error?.message).toBe('boom');
    expect(recovered).toMatchObject({ ok: true, value: '9' });
  });

  it('does not carry runtime globals into a replacement project session', () => {
    createSession();
    expect(evaluateJavaScriptConsole(
      session,
      { code: 'globalThis.projectScopedValue = 42; projectScopedValue', projectSessionId: 7 },
      project,
    )).toMatchObject({ ok: true, value: '42', projectSessionId: 7 });

    session.dispose();
    session = new JavaScriptSession();
    const replacementProject = {
      ...project,
      project: { ...project.project, sessionId: 8, label: 'Replacement Project' },
    };
    expect(evaluateJavaScriptConsole(
      session,
      { code: 'typeof projectScopedValue', projectSessionId: 8 },
      replacementProject,
    )).toMatchObject({ ok: true, value: 'undefined', projectSessionId: 8 });
  });
});
