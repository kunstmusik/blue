// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectDocumentCommitMetadata } from '../../shared/project-history';
import {
  detectTextOperation,
  useBatchedTextEditor,
  type UseBatchedTextEditorOptions,
  type UseBatchedTextEditorResult,
} from '../hooks/use-batched-text-editor';
import { settleHistoryEditors } from '../lib/history-scope-router';
import InstrumentCommentsPanel from '../components/workbench/panels/orchestra/InstrumentCommentsPanel';
import { InputBase } from '../components/workbench/panels/project-properties/ProjectPropertyFields';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe('detectTextOperation', () => {
  it('detects none for identical strings', () => {
    expect(detectTextOperation('abc', 'abc')).toEqual({ kind: 'none' });
  });

  it('detects pure insertions at start, middle, and end', () => {
    expect(detectTextOperation('bc', 'abc')).toEqual({ kind: 'insert', insertedText: 'a' });
    expect(detectTextOperation('ac', 'abc')).toEqual({ kind: 'insert', insertedText: 'b' });
    expect(detectTextOperation('ab', 'abc')).toEqual({ kind: 'insert', insertedText: 'c' });
    expect(detectTextOperation('hello', 'hello world')).toEqual({
      kind: 'insert',
      insertedText: ' world',
    });
  });

  it('detects pure deletions at start, middle, and end', () => {
    expect(detectTextOperation('abc', 'bc')).toEqual({ kind: 'delete', deletedLength: 1 });
    expect(detectTextOperation('abc', 'ac')).toEqual({ kind: 'delete', deletedLength: 1 });
    expect(detectTextOperation('abc', 'ab')).toEqual({ kind: 'delete', deletedLength: 1 });
    expect(detectTextOperation('hello world', 'hello')).toEqual({
      kind: 'delete',
      deletedLength: 6,
    });
  });

  it('detects mutations for replacements or pastes', () => {
    expect(detectTextOperation('abc', 'xyz')).toEqual({ kind: 'mutation' });
    expect(detectTextOperation('foo bar baz', 'foo qux baz')).toEqual({ kind: 'mutation' });
  });
});

describe('useBatchedTextEditor', () => {
  let root: Root;
  let container: HTMLDivElement;
  let hookResult: UseBatchedTextEditorResult;
  let commits: Array<{ value: string; metadata?: ProjectDocumentCommitMetadata }>;

  function TestComponent(props: Partial<UseBatchedTextEditorOptions>) {
    hookResult = useBatchedTextEditor({
      value: props.value ?? '',
      onChange: (v, m) => {
        commits.push({ value: v, metadata: m });
        props.onChange?.(v, m);
      },
      fieldId: props.fieldId ?? 'test-field',
      label: props.label ?? 'Test Label',
      debounceMs: props.debounceMs ?? 500,
      hostDocument: document,
    });
    return (
      <textarea
        value={hookResult.text}
        onChange={(e) => hookResult.handleTextChange(e.target.value)}
        onBlur={hookResult.flush}
      />
    );
  }

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    commits = [];
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
  });

  it('batches consecutive character insertions into a single gesture until a word boundary', () => {
    act(() => {
      root.render(<TestComponent value="" />);
    });

    // Type 'H'
    act(() => {
      hookResult.handleTextChange('H');
    });
    expect(hookResult.text).toBe('H');
    expect(commits.length).toBe(1);
    expect(commits[0].value).toBe('H');
    expect(commits[0].metadata?.phase).toBe('begin');
    const gestureId = commits[0].metadata?.gestureId;
    expect(gestureId).toBeDefined();

    // Type 'i'
    act(() => {
      hookResult.handleTextChange('Hi');
    });
    expect(hookResult.text).toBe('Hi');
    expect(commits.length).toBe(2);
    expect(commits[1].value).toBe('Hi');
    expect(commits[1].metadata?.phase).toBe('update');
    expect(commits[1].metadata?.gestureId).toBe(gestureId);

    // Type space -> word boundary
    act(() => {
      hookResult.handleTextChange('Hi ');
    });
    expect(hookResult.text).toBe('Hi ');
    expect(commits.length).toBe(3);
    expect(commits[2].value).toBe('Hi ');
    expect(commits[2].metadata?.phase).toBe('end');
    expect(commits[2].metadata?.gestureId).toBe(gestureId);

    // Next character starts a new batch
    act(() => {
      hookResult.handleTextChange('Hi t');
    });
    expect(commits.length).toBe(4);
    expect(commits[3].value).toBe('Hi t');
    expect(commits[3].metadata?.phase).toBe('begin');
    expect(commits[3].metadata?.gestureId).not.toBe(gestureId);
  });

  it('closes the active batch upon typing pause (inactivity timeout)', () => {
    act(() => {
      root.render(<TestComponent value="" />);
    });

    act(() => {
      hookResult.handleTextChange('foo');
    });
    expect(commits.length).toBe(1);
    expect(commits[0].metadata?.phase).toBe('begin');
    const gestureId = commits[0].metadata?.gestureId;

    // Advance 500ms
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(commits.length).toBe(2);
    expect(commits[1].value).toBe('foo');
    expect(commits[1].metadata?.phase).toBe('end');
    expect(commits[1].metadata?.gestureId).toBe(gestureId);
  });

  it('switches batches when transitioning from insert to delete', () => {
    act(() => {
      root.render(<TestComponent value="" />);
    });

    // Insert 'abc'
    act(() => {
      hookResult.handleTextChange('a');
    });
    act(() => {
      hookResult.handleTextChange('ab');
    });
    const insertGestureId = commits[0].metadata?.gestureId;

    // Backspace to 'a' -> switches to delete
    act(() => {
      hookResult.handleTextChange('a');
    });

    // Should have flushed insert batch with 'end', then begun delete batch with 'begin'
    const endInsert = commits.find(
      (c) => c.metadata?.gestureId === insertGestureId && c.metadata?.phase === 'end',
    );
    expect(endInsert).toBeDefined();

    const lastCommit = commits[commits.length - 1];
    expect(lastCommit.value).toBe('a');
    expect(lastCommit.metadata?.phase).toBe('begin');
    expect(lastCommit.metadata?.gestureId).not.toBe(insertGestureId);
  });

  it('flushes pending batch upon settlement barrier', async () => {
    act(() => {
      root.render(<TestComponent value="" />);
    });

    act(() => {
      hookResult.handleTextChange('test');
    });
    expect(commits.length).toBe(1);
    expect(commits[0].metadata?.phase).toBe('begin');
    const gestureId = commits[0].metadata?.gestureId;

    // Settlement barrier triggers before undo
    await act(async () => {
      await settleHistoryEditors(document);
    });

    const endCommit = commits.find((c) => c.metadata?.phase === 'end');
    expect(endCommit).toBeDefined();
    expect(endCommit?.metadata?.gestureId).toBe(gestureId);
    expect(endCommit?.value).toBe('test');
  });

  it('accepts external value updates when different from last committed value', () => {
    let propValue = 'initial';
    act(() => {
      root.render(<TestComponent value={propValue} />);
    });
    expect(hookResult.text).toBe('initial');

    // External change (e.g. undo restores previous version)
    act(() => {
      propValue = 'restored version';
      root.render(<TestComponent value={propValue} />);
    });
    expect(hookResult.text).toBe('restored version');
  });

  it('flushes a previous field through its previous callback before switching fields', () => {
    const fieldCommits: Array<{ field: string; value: string }> = [];
    let field = 'instrument-a';
    let value = '';
    function FieldComponent() {
      const currentField = field;
      const result = useBatchedTextEditor({
        value,
        fieldId: field,
        onChange: (nextValue) => fieldCommits.push({ field: currentField, value: nextValue }),
        hostDocument: document,
      });
      hookResult = result;
      return <textarea value={result.text} readOnly />;
    }

    act(() => {
      root.render(<FieldComponent />);
    });
    act(() => {
      hookResult.handleTextChange('abc');
    });

    field = 'instrument-b';
    value = '';
    act(() => {
      root.render(<FieldComponent />);
    });

    expect(fieldCommits.at(-1)).toEqual({ field: 'instrument-a', value: 'abc' });
  });

  it('ignores delayed acknowledgements for older submitted text', () => {
    let value = '';
    function ControlledComponent() {
      const result = useBatchedTextEditor({
        value,
        fieldId: 'controlled',
        onChange: vi.fn(),
        hostDocument: document,
      });
      hookResult = result;
      return <textarea value={result.text} readOnly />;
    }

    act(() => {
      root.render(<ControlledComponent />);
    });
    act(() => {
      hookResult.handleTextChange('a');
      hookResult.handleTextChange('ab');
    });

    value = 'a';
    act(() => {
      root.render(<ControlledComponent />);
    });
    expect(hookResult.text).toBe('ab');
  });

  it('treats paste as a single mutation and composition as one commit', () => {
    act(() => {
      root.render(<TestComponent value="" />);
    });

    act(() => {
      hookResult.handleTextChange('PASTED', {
        inputType: 'insertFromPaste',
        selectionStart: 6,
        selectionEnd: 6,
      });
    });
    expect(commits).toHaveLength(1);
    expect(commits[0].metadata?.phase).toBe('single');

    act(() => {
      hookResult.handleCompositionStart();
      hookResult.handleTextChange('PASTEDあ', {
        inputType: 'insertCompositionText',
        isComposing: true,
        selectionStart: 7,
        selectionEnd: 7,
      });
      hookResult.handleCompositionEnd();
    });
    expect(commits).toHaveLength(2);
    expect(commits[1]).toMatchObject({ value: 'PASTEDあ' });
    expect(commits[1].metadata?.phase).toBe('single');
  });

  it('retains explicit inserted text for whitespace gesture boundaries', () => {
    act(() => {
      root.render(<TestComponent value="" />);
    });

    act(() => {
      hookResult.handleTextChange('a', {
        inputType: 'insertText',
        insertedText: 'a',
        selectionStart: 1,
        selectionEnd: 1,
      });
    });
    const firstGestureId = commits[0]?.metadata?.gestureId;

    act(() => {
      hookResult.handleTextChange('a ', {
        inputType: 'insertText',
        insertedText: ' ',
        selectionStart: 2,
        selectionEnd: 2,
      });
    });

    expect(commits.at(-1)?.metadata).toMatchObject({
      gestureId: firstGestureId,
      phase: 'end',
    });

    act(() => {
      hookResult.handleTextChange('a b', {
        inputType: 'insertText',
        insertedText: 'b',
        selectionStart: 3,
        selectionEnd: 3,
      });
    });

    expect(commits.at(-1)?.metadata?.phase).toBe('begin');
    expect(commits.at(-1)?.metadata?.gestureId).not.toBe(firstGestureId);
  });

  it('does not replay an unsettled composition after the settlement timeout', async () => {
    act(() => {
      root.render(<TestComponent value="" />);
    });
    act(() => {
      hookResult.handleCompositionStart();
      hookResult.handleTextChange('あ', {
        inputType: 'insertCompositionText',
        isComposing: true,
      });
    });

    const settling = expect(settleHistoryEditors(document)).rejects.toThrow(/did not settle/i);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    await settling;
    expect(commits).toHaveLength(0);

    act(() => {
      hookResult.handleCompositionEnd();
    });
    expect(commits).toHaveLength(0);

    act(() => {
      hookResult.handleTextChange('あ!', {
        inputType: 'insertText',
        insertedText: '!',
      });
    });
    expect(commits.at(-1)?.value).toBe('あ!');
  });

  it('passes realistic InputEvent metadata through InstrumentCommentsPanel', () => {
    act(() => {
      root.render(
        <InstrumentCommentsPanel
          comment=""
          fieldId="instrument-comments:test"
          onCommentChange={(value, metadata) => commits.push({ value, metadata })}
        />,
      );
    });

    const textarea = container.querySelector('textarea');
    expect(textarea).not.toBeNull();
    if (!textarea) return;

    const setNativeValue = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      'value',
    )?.set;
    expect(setNativeValue).toBeDefined();

    const dispatchInput = (value: string, data: string) => {
      setNativeValue?.call(textarea, value);
      textarea.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          inputType: 'insertText',
          data,
        }),
      );
    };

    act(() => {
      dispatchInput('a', 'a');
      dispatchInput('a ', ' ');
      dispatchInput('a b', 'b');
    });

    expect(commits.map((commit) => commit.value)).toEqual(['a', 'a ', 'a b']);
    expect(commits[1]?.metadata).toMatchObject({
      fieldId: 'instrument-comments:test',
      phase: 'end',
    });
    expect(commits[2]?.metadata?.phase).toBe('begin');
    expect(commits[2]?.metadata?.gestureId).not.toBe(commits[1]?.metadata?.gestureId);
  });

  it('keeps project-property inputs project-scoped while acknowledging canonical updates', async () => {
    function ProjectPropertyHarness() {
      const [value, setValue] = React.useState('');
      return (
        <InputBase
          value={value}
          disabled={false}
          fieldId="project-properties:title"
          label="Title"
          onChange={(nextValue, metadata) => {
            commits.push({ value: nextValue, metadata });
            setValue(nextValue);
          }}
        />
      );
    }

    act(() => {
      root.render(<ProjectPropertyHarness />);
    });

    const input = container.querySelector('input');
    expect(input?.getAttribute('data-history-scope')).toBe('project');
    if (!input) return;

    const setNativeValue = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )?.set;
    expect(setNativeValue).toBeDefined();
    const dispatchInput = (value: string, data: string) => {
      setNativeValue?.call(input, value);
      input.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          inputType: 'insertText',
          data,
        }),
      );
    };

    act(() => dispatchInput('a', 'a'));
    act(() => dispatchInput('a ', ' '));
    act(() => dispatchInput('a b', 'b'));

    expect(commits.map((commit) => commit.value)).toEqual(['a', 'a ', 'a b']);
    expect(commits[0]?.metadata).toMatchObject({
      fieldId: 'project-properties:title',
      phase: 'begin',
    });
    expect(commits[1]?.metadata).toMatchObject({ phase: 'end' });
    expect(commits[2]?.metadata).toMatchObject({ phase: 'begin' });

    await act(async () => {
      await settleHistoryEditors(document);
    });
    expect(commits.at(-1)?.metadata).toMatchObject({
      fieldId: 'project-properties:title',
      phase: 'end',
    });
  });
});
