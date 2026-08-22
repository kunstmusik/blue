// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ReplConsolePanel from './ReplConsolePanel';

const project = {
  loaded: true,
  sessionId: 1,
  label: 'Test Project',
  filePath: '/tmp/test.blue',
  projectDir: '/tmp',
};

let container: HTMLDivElement;
let root: Root;

function renderPanel(language: 'javascript' | 'python' | 'clojure'): HTMLTextAreaElement {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root.render(<ReplConsolePanel language={language} />);
  });

  return container.querySelector('textarea') as HTMLTextAreaElement;
}

beforeEach(() => {
  window.blueAPI = {
    ...window.blueAPI,
    openReplConsole: vi.fn(async ({ language }) => ({
      ok: true,
      language,
      prompt: '',
      project,
      runtime: 'ready' as const,
    })),
    evaluateReplConsole: vi.fn(async ({ language }) => ({
      ok: true,
      language,
      projectSessionId: project.sessionId,
      value: 'ok',
      stdout: '',
      stderr: '',
      elapsedMs: 0,
    })),
    closeReplConsole: vi.fn(async () => ({ ok: true })),
    onProjectLoaded: vi.fn(() => () => {}),
    onProjectClosed: vi.fn(() => () => {}),
  };
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  document.body.innerHTML = '';
});

describe('ReplConsolePanel', () => {
  it.each([
    ['javascript', 'JavaScript Console', 'js&gt;'],
    ['python', 'Python Console', '&gt;&gt;&gt;'],
    ['clojure', 'Clojure REPL', 'user=&gt;'],
  ] as const)('renders the shared %s console surface', (language, title, prompt) => {
    const markup = renderToStaticMarkup(<ReplConsolePanel language={language} />);

    expect(markup).toContain(`data-testid="${language}-repl-console"`);
    expect(markup).toContain(title);
    expect(markup).toContain(prompt);
    expect(markup).toContain(`aria-label="${title} input"`);
    expect(markup).toContain('font-mono text-role-body');
    expect(markup).not.toContain('Enter run');
    expect(markup).not.toContain('Shift+Enter newline');
  });

  it.each(['javascript', 'python', 'clojure'] as const)(
    'returns focus to the %s prompt after evaluation',
    async (language) => {
      const input = renderPanel(language);

      await act(async () => {
        await Promise.resolve();
      });

      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        'value',
      )?.set;
      act(() => {
        valueSetter?.call(input, '1 + 1');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });

      await act(async () => {
        input.dispatchEvent(new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          key: 'Enter',
        }));
        await Promise.resolve();
      });

      expect(window.blueAPI.evaluateReplConsole).toHaveBeenCalledWith({
        language,
        code: '1 + 1',
      });
      expect(document.activeElement).toBe(input);
    },
  );
});
