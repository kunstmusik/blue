import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
import type {
  ReplConsoleLanguage,
  ReplConsoleProjectContext,
  ReplConsoleRuntimeState,
} from '../../../../../shared/repl-console';

interface ReplConsolePanelProps {
  language: ReplConsoleLanguage;
}

interface ConsoleLine {
  id: number;
  kind: 'input' | 'output' | 'error' | 'system';
  text: string;
}

interface ReplConsoleConfig {
  title: string;
  prompt: string;
  accent: string;
  placeholder: string;
}

const CONFIGS: Record<ReplConsoleLanguage, ReplConsoleConfig> = {
  javascript: {
    title: 'JavaScript Console',
    prompt: 'js> ',
    accent: '#f0b35a',
    placeholder: 'Try blueProjectDir or 1 + 1',
  },
  python: {
    title: 'Python Console',
    prompt: '>>> ',
    accent: '#70a7d8',
    placeholder: 'Try print(blueProjectDir)',
  },
  clojure: {
    title: 'Clojure REPL',
    prompt: 'user=> ',
    accent: '#c783c9',
    placeholder: 'Try (+ 1 1)',
  },
};

function runtimeLabel(
  runtime: ReplConsoleRuntimeState,
  project: ReplConsoleProjectContext | null,
  message: string | null,
): string {
  if (runtime === 'error') return message ?? 'Runtime error';
  if (runtime === 'unavailable') return message ?? 'Runtime unavailable';
  if (!project?.loaded) return 'Ready · no project loaded';
  return `Connected · ${project.label}`;
}

export default function ReplConsolePanel({ language }: ReplConsolePanelProps): React.ReactElement {
  const config = CONFIGS[language];
  const [lines, setLines] = useState<ConsoleLine[]>([]);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [project, setProject] = useState<ReplConsoleProjectContext | null>(null);
  const [runtime, setRuntime] = useState<ReplConsoleRuntimeState>('unavailable');
  const [runtimeMessage, setRuntimeMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nextLineId = useRef(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const lastProjectMarker = useRef<string | null>(null);

  const appendLine = useCallback((kind: ConsoleLine['kind'], text: string) => {
    if (!text) return;
    setLines((current) => [
      ...current,
      { id: nextLineId.current++, kind, text },
    ]);
  }, []);

  const openConsole = useCallback(async () => {
    if (!window.blueAPI?.openReplConsole) return;

    try {
      const result = await window.blueAPI.openReplConsole({ language });
      setProject(result.project);
      setRuntime(result.runtime);
      setRuntimeMessage(result.error ?? null);
      const marker = `${result.project.sessionId}:${result.project.loaded ? result.project.label : 'No Project'}`;
      if (lastProjectMarker.current !== marker) {
        appendLine('system', `// project: ${result.project.loaded ? result.project.label : 'No Project'}`);
        lastProjectMarker.current = marker;
      }
    } catch (error: unknown) {
      setRuntime('error');
      setRuntimeMessage(error instanceof Error ? error.message : String(error));
    }
  }, [language]);

  useEffect(() => {
    let mounted = true;
    void openConsole();

    const unsubscribeProjectLoaded = window.blueAPI?.onProjectLoaded?.(() => {
      if (!mounted) return;
      void openConsole();
    });
    const unsubscribeProjectClosed = window.blueAPI?.onProjectClosed?.(() => {
      if (!mounted) return;
      void openConsole();
    });

    return () => {
      mounted = false;
      unsubscribeProjectLoaded?.();
      unsubscribeProjectClosed?.();
      if (window.blueAPI?.closeReplConsole) {
        void window.blueAPI.closeReplConsole({ language });
      }
    };
  }, [appendLine, language, openConsole]);

  useEffect(() => {
    const output = outputRef.current;
    if (output) output.scrollTop = output.scrollHeight;
  }, [lines, busy]);

  useEffect(() => {
    if (!busy && runtime === 'ready') {
      inputRef.current?.focus();
    }
  }, [busy, runtime]);

  const submit = useCallback(async () => {
    const code = input;
    if (!code.trim() || busy || runtime !== 'ready') return;

    setInput('');
    setHistory((current) => [...current, code]);
    setHistoryIndex(-1);
    appendLine('input', code);
    setBusy(true);

    try {
      if (!window.blueAPI?.evaluateReplConsole) {
        throw new Error('Console evaluation is unavailable in this build.');
      }

      const result = await window.blueAPI.evaluateReplConsole({ language, code });
      if (result.stdout) appendLine('output', result.stdout);
      if (result.stderr) appendLine('error', result.stderr);
      if (result.value) appendLine(result.ok ? 'output' : 'error', result.value);
      if (!result.ok) {
        appendLine('error', result.error?.message ?? 'Evaluation failed.');
      }
    } catch (error: unknown) {
      appendLine('error', error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }, [appendLine, busy, input, language, runtime]);

  const handleHistory = useCallback((direction: 'previous' | 'next') => {
    if (history.length === 0) return;
    const nextIndex = direction === 'previous'
      ? historyIndex < 0 ? history.length - 1 : Math.max(0, historyIndex - 1)
      : historyIndex < 0 ? -1 : Math.min(history.length - 1, historyIndex + 1);
    setHistoryIndex(nextIndex);
    setInput(nextIndex < 0 ? '' : history[nextIndex] ?? '');
  }, [history, historyIndex]);

  const handleReinitialize = useCallback(async () => {
    if (!window.blueAPI?.reinitializeReplConsole || busy) return;
    setBusy(true);
    setRuntimeMessage(null);
    try {
      const result = await window.blueAPI.reinitializeReplConsole({ language });
      setProject(result.project);
      setRuntime(result.runtime);
      setRuntimeMessage(result.error ?? null);
      if (result.ok) appendLine('system', `${config.title} interpreter reinitialized.`);
      else appendLine('error', result.error ?? 'Interpreter reinitialization failed.');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setRuntime('error');
      setRuntimeMessage(message);
      appendLine('error', message);
    } finally {
      setBusy(false);
    }
  }, [appendLine, busy, config.title, language]);

  const statusText = useMemo(
    () => runtimeLabel(runtime, project, runtimeMessage),
    [project, runtime, runtimeMessage],
  );
  const canRun = runtime === 'ready' && !busy;

  return (
    <div className="flex h-full min-h-0 flex-col bg-app-canvas text-app-text" data-testid={`${language}-repl-console`}>
      <div className="flex shrink-0 items-center justify-between border-b border-app-border bg-app-surface px-3 py-1.5">
        <span className="text-ui font-medium text-app-text-strong">{config.title}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded border border-transparent p-1.5 text-app-text-muted hover:border-app-border hover:bg-app-hover hover:text-app-text-strong disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => { void handleReinitialize(); }}
            disabled={busy}
            title={`Reinitialize ${config.title}`}
            aria-label={`Reinitialize ${config.title}`}
          >
            <RotateCcw size={14} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            className="rounded border border-transparent p-1.5 text-app-text-muted hover:border-app-border hover:bg-app-hover hover:text-app-text-strong"
            onClick={() => setLines([])}
            title="Clear console"
            aria-label="Clear console"
          >
            <Trash2 size={14} strokeWidth={1.8} />
          </button>
        </div>
      </div>

      <div ref={outputRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-2 font-mono text-content leading-6">
        {lines.map((line) => (
          <div key={line.id} className="group flex whitespace-pre-wrap break-words">
            {line.kind === 'input' ? (
              <span className="shrink-0 select-none font-semibold" style={{ color: config.accent }}>{config.prompt}</span>
            ) : (
              <span
                className="shrink-0 select-none text-app-text-subtle"
                style={{ width: `${config.prompt.length}ch` }}
                aria-hidden="true"
              >
                {' '}
              </span>
            )}
            <span className={line.kind === 'error' ? 'text-app-error' : line.kind === 'system' ? 'text-app-text-muted' : line.kind === 'input' ? 'text-app-text-strong' : 'text-app-text'}>
              {line.text}
            </span>
          </div>
        ))}
        {busy ? (
          <div className="mt-1 flex items-center gap-2 text-app-text-muted">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ backgroundColor: config.accent }} />
            Evaluating…
          </div>
        ) : null}
        <div className="flex items-start whitespace-pre-wrap break-words">
          <span className="shrink-0 select-none font-semibold" style={{ color: config.accent }}>{config.prompt}</span>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
              setHistoryIndex(-1);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.altKey) {
                event.preventDefault();
                void submit();
              } else if (event.key === 'ArrowUp' && !event.shiftKey && !event.altKey) {
                event.preventDefault();
                handleHistory('previous');
              } else if (event.key === 'ArrowDown' && !event.shiftKey && !event.altKey) {
                event.preventDefault();
                handleHistory('next');
              }
            }}
            disabled={!canRun}
            rows={1}
            spellCheck={false}
            aria-label={`${config.title} input`}
            placeholder={busy ? 'Evaluating…' : canRun ? config.placeholder : statusText}
            className="max-h-32 min-h-6 flex-1 resize-none overflow-y-auto bg-transparent p-0 font-mono text-content leading-6 text-app-text-strong outline-none placeholder:text-app-text-subtle disabled:cursor-not-allowed"
          />
        </div>
      </div>
    </div>
  );
}
