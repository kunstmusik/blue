import { EditorSelection, EditorState, type TransactionSpec } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';

export interface CsoundEditorClipboardBridge {
  readText: () => Promise<string>;
  writeText: (text: string) => Promise<void>;
}

function hasSelectionText(state: EditorState): boolean {
  return state.selection.ranges.some((range) => !range.empty);
}

function canEditDocument(state: EditorState): boolean {
  return !state.facet(EditorState.readOnly);
}

function writeTextWithLegacyClipboardFallback(text: string): boolean {
  if (typeof document === 'undefined' || !document.body) {
    return false;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.readOnly = true;
  textarea.setAttribute('aria-hidden', 'true');
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '-9999px';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  let success = false;
  try {
    success = document.execCommand('copy');
  } catch {
    success = false;
  } finally {
    textarea.remove();
  }

  return success;
}

async function writeClipboardText(text: string): Promise<void> {
  if (typeof window !== 'undefined' && window.blueAPI?.writeClipboardText) {
    await window.blueAPI.writeClipboardText(text);
    return;
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  if (writeTextWithLegacyClipboardFallback(text)) {
    return;
  }

  throw new Error('Clipboard write is unavailable');
}

async function readClipboardText(): Promise<string> {
  if (typeof window !== 'undefined' && window.blueAPI?.readClipboardText) {
    return window.blueAPI.readClipboardText();
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
    return navigator.clipboard.readText();
  }

  return '';
}

export function getSelectedText(state: EditorState): string {
  if (!hasSelectionText(state)) {
    return '';
  }

  return state.selection.ranges.map((range) => state.sliceDoc(range.from, range.to)).join('\n');
}

export function replaceSelectionWithText(state: EditorState, text: string): TransactionSpec {
  return state.changeByRange((range) => ({
    changes: {
      from: range.from,
      to: range.to,
      insert: text,
    },
    range: EditorSelection.cursor(range.from + text.length),
  }));
}

export function insertTextAtSelection(view: EditorView, text: string): boolean {
  if (!canEditDocument(view.state) || text.length === 0) {
    view.focus();
    return false;
  }

  view.dispatch({
    ...replaceSelectionWithText(view.state, text),
    scrollIntoView: true,
  });
  view.focus();
  return true;
}

export async function copySelectionToClipboard(
  view: EditorView,
  clipboardBridge: CsoundEditorClipboardBridge = {
    readText: readClipboardText,
    writeText: writeClipboardText,
  },
): Promise<boolean> {
  const selectedText = getSelectedText(view.state);
  try {
    if (selectedText.length === 0) {
      return false;
    }

    await clipboardBridge.writeText(selectedText);
    return true;
  } catch {
    return false;
  } finally {
    view.focus();
  }
}

export async function cutSelectionToClipboard(
  view: EditorView,
  clipboardBridge: CsoundEditorClipboardBridge = {
    readText: readClipboardText,
    writeText: writeClipboardText,
  },
): Promise<boolean> {
  const selectedText = getSelectedText(view.state);
  if (!canEditDocument(view.state) || selectedText.length === 0) {
    view.focus();
    return false;
  }

  try {
    await clipboardBridge.writeText(selectedText);
    view.dispatch({
      ...replaceSelectionWithText(view.state, ''),
      scrollIntoView: true,
    });
    return true;
  } catch {
    return false;
  } finally {
    view.focus();
  }
}

export async function pasteClipboardText(
  view: EditorView,
  clipboardBridge: CsoundEditorClipboardBridge = {
    readText: readClipboardText,
    writeText: writeClipboardText,
  },
): Promise<boolean> {
  if (!canEditDocument(view.state)) {
    view.focus();
    return false;
  }

  try {
    const clipboardText = await clipboardBridge.readText();
    if (clipboardText.length === 0) {
      return false;
    }

    view.dispatch({
      ...replaceSelectionWithText(view.state, clipboardText),
      scrollIntoView: true,
    });
    return true;
  } catch {
    return false;
  } finally {
    view.focus();
  }
}
