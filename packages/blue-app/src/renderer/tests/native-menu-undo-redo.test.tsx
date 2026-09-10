// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { EditorView } from 'codemirror';
import { history, defaultKeymap, historyKeymap } from '@codemirror/commands';
import { keymap } from '@codemirror/view';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  dispatchHistoryAction,
  registerHostDocument,
  resolveHistoryScope,
} from '../lib/history-scope-router';
import { useWorkbenchStore } from '../stores/workbench-store';
import { useProjectStore } from '../stores/project-store';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe('native menu undo/redo and scope routing (US4, T048/T051)', () => {
  let container: HTMLDivElement;
  let root: Root;
  let undoProjectHistoryMock: ReturnType<typeof vi.fn>;
  let redoProjectHistoryMock: ReturnType<typeof vi.fn>;
  let rangeRectsDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    rangeRectsDescriptor = Object.getOwnPropertyDescriptor(Range.prototype, 'getClientRects');
    Object.defineProperty(Range.prototype, 'getClientRects', {
      configurable: true,
      value: () => ({ length: 0, item: () => null }),
    });

    document.execCommand = vi.fn();

    undoProjectHistoryMock = vi.fn(async () => ({
      status: 'committed',
      operationId: 'undo-1',
      documentId: 'doc-1',
      revision: 2,
    }));
    redoProjectHistoryMock = vi.fn(async () => ({
      status: 'committed',
      operationId: 'redo-1',
      documentId: 'doc-1',
      revision: 3,
    }));

    window.blueAPI = {
      ...window.blueAPI,
      undoProjectHistory: undoProjectHistoryMock,
      redoProjectHistory: redoProjectHistoryMock,
    } as unknown as typeof window.blueAPI;

    useProjectStore.setState({
      loaded: true,
      documentId: 'doc-1',
      projectInfo: { title: 'Test Project', documentId: 'doc-1' },
      sessionId: 1,
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    if (rangeRectsDescriptor) {
      Object.defineProperty(Range.prototype, 'getClientRects', rangeRectsDescriptor);
    } else {
      delete (Range.prototype as { getClientRects?: unknown }).getClientRects;
    }
  });

  it('routes to project undo when no draft/input element is focused', async () => {
    // Focus is on the container or body (project scope)
    container.focus();

    await act(async () => {
      useWorkbenchStore.getState().handleNativeMenuCommand({ type: 'undo' });
    });

    expect(undoProjectHistoryMock).toHaveBeenCalledTimes(1);
    expect(redoProjectHistoryMock).not.toHaveBeenCalled();
  });

  it('routes to project redo when no draft/input element is focused', async () => {
    container.focus();

    await act(async () => {
      useWorkbenchStore.getState().handleNativeMenuCommand({ type: 'redo' });
    });

    expect(redoProjectHistoryMock).toHaveBeenCalledTimes(1);
    expect(undoProjectHistoryMock).not.toHaveBeenCalled();
  });

  it('delegates to native undo for native input elements and never falls through to project undo', async () => {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = 'search query';
    container.appendChild(input);
    input.focus();

    await act(async () => {
      useWorkbenchStore.getState().handleNativeMenuCommand({ type: 'undo' });
    });

    expect(document.execCommand).toHaveBeenCalledWith('undo');
    // Crucial: empty or failed native undo must NEVER fall through to project undo!
    expect(undoProjectHistoryMock).not.toHaveBeenCalled();

    await act(async () => {
      useWorkbenchStore.getState().handleNativeMenuCommand({ type: 'redo' });
    });

    expect(document.execCommand).toHaveBeenCalledWith('redo');
    expect(redoProjectHistoryMock).not.toHaveBeenCalled();
  });

  it('delegates to local CodeMirror history for draft editors and isolates from project history', async () => {
    const draftContainer = document.createElement('div');
    draftContainer.setAttribute('data-history-scope', 'draft');
    container.appendChild(draftContainer);

    const draftView = new EditorView({
      doc: 'initial text',
      extensions: [history(), keymap.of([...defaultKeymap, ...historyKeymap])],
      parent: draftContainer,
    });

    // Type into draft view
    draftView.dispatch({
      changes: { from: 12, insert: ' added' },
      userEvent: 'input.type',
    });
    expect(draftView.state.doc.toString()).toBe('initial text added');

    // Focus the draft view's content element
    draftView.contentDOM.focus();
    expect(resolveHistoryScope().scope).toBe('draft');

    // Invoke undo via menu command
    await act(async () => {
      useWorkbenchStore.getState().handleNativeMenuCommand({ type: 'undo' });
    });

    // Local text is reverted
    expect(draftView.state.doc.toString()).toBe('initial text');
    // Project history is untouched
    expect(undoProjectHistoryMock).not.toHaveBeenCalled();

    // Undo again when draft history is now empty: must NOT fall through!
    await act(async () => {
      useWorkbenchStore.getState().handleNativeMenuCommand({ type: 'undo' });
    });

    expect(undoProjectHistoryMock).not.toHaveBeenCalled();

    // Redo in draft view
    await act(async () => {
      useWorkbenchStore.getState().handleNativeMenuCommand({ type: 'redo' });
    });

    expect(draftView.state.doc.toString()).toBe('initial text added');
    expect(redoProjectHistoryMock).not.toHaveBeenCalled();

    draftView.destroy();
  });

  it('routes to project history for project-scoped CodeMirror editors', async () => {
    const projectContainer = document.createElement('div');
    projectContainer.setAttribute('data-history-scope', 'project');
    container.appendChild(projectContainer);

    const projectView = new EditorView({
      doc: 'instrument code',
      extensions: [],
      parent: projectContainer,
    });

    projectView.contentDOM.focus();
    expect(resolveHistoryScope().scope).toBe('project');

    await act(async () => {
      useWorkbenchStore.getState().handleNativeMenuCommand({ type: 'undo' });
    });

    expect(undoProjectHistoryMock).toHaveBeenCalledTimes(1);

    projectView.destroy();
  });

  it('resolves active scope across popout host documents in the same JS realm', async () => {
    // Create a synthetic popout document
    const popoutDoc = document.implementation.createHTMLDocument('Popout');
    const popoutInput = popoutDoc.createElement('input');
    popoutDoc.body.appendChild(popoutInput);

    // Mock hasFocus
    Object.defineProperty(popoutDoc, 'hasFocus', {
      value: () => true,
      configurable: true,
    });
    Object.defineProperty(document, 'hasFocus', {
      value: () => false,
      configurable: true,
    });

    popoutDoc.execCommand = vi.fn();
    Object.defineProperty(popoutDoc, 'activeElement', {
      value: popoutInput,
      configurable: true,
    });
    const unregister = registerHostDocument(popoutDoc);

    await act(async () => {
      useWorkbenchStore.getState().handleNativeMenuCommand({ type: 'undo' });
    });

    expect(popoutDoc.execCommand).toHaveBeenCalledWith('undo');
    expect(undoProjectHistoryMock).not.toHaveBeenCalled();

    unregister();
  });

  it('keeps input and textarea commands local in an actual secondary document', async () => {
    const popoutDoc = document.implementation.createHTMLDocument('Popout Native Inputs');
    const popoutInput = popoutDoc.createElement('input');
    const popoutTextarea = popoutDoc.createElement('textarea');
    popoutTextarea.setAttribute('data-history-scope', 'draft');
    popoutDoc.body.append(popoutInput, popoutTextarea);

    const originalDocumentHasFocus = Object.getOwnPropertyDescriptor(document, 'hasFocus');
    Object.defineProperty(popoutDoc, 'hasFocus', {
      value: () => true,
      configurable: true,
    });
    Object.defineProperty(document, 'hasFocus', {
      value: () => false,
      configurable: true,
    });
    popoutDoc.execCommand = vi.fn();
    const unregister = registerHostDocument(popoutDoc);

    try {
      Object.defineProperty(popoutDoc, 'activeElement', {
        value: popoutInput,
        configurable: true,
      });
      await act(async () => {
        await dispatchHistoryAction('undo');
      });
      expect(resolveHistoryScope()).toMatchObject({ scope: 'draft', type: 'native' });

      Object.defineProperty(popoutDoc, 'activeElement', {
        value: popoutTextarea,
        configurable: true,
      });
      await act(async () => {
        await dispatchHistoryAction('redo');
      });

      expect(popoutDoc.execCommand).toHaveBeenNthCalledWith(1, 'undo');
      expect(popoutDoc.execCommand).toHaveBeenNthCalledWith(2, 'redo');
      expect(undoProjectHistoryMock).not.toHaveBeenCalled();
      expect(redoProjectHistoryMock).not.toHaveBeenCalled();
    } finally {
      unregister();
      if (originalDocumentHasFocus) {
        Object.defineProperty(document, 'hasFocus', originalDocumentHasFocus);
      } else {
        delete (document as Document & { hasFocus?: () => boolean }).hasFocus;
      }
    }
  });
});
