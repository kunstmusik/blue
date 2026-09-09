import { EditorView } from 'codemirror';
import { undo as cmUndo, redo as cmRedo } from '@codemirror/commands';
import {
  acceptProjectDocumentRevision,
  getProjectDocumentId,
  getProjectDocumentRevision,
  useProjectStore,
} from '../stores/project-store';

export type HistoryScope = 'project' | 'draft' | 'none';

export type HistoryScopeResolution =
  | { scope: 'none' }
  | { scope: 'draft'; type: 'codemirror'; view: EditorView }
  | { scope: 'draft'; type: 'native'; element: HTMLElement }
  | { scope: 'draft'; type: 'custom' }
  | { scope: 'project' };

const registeredHostDocuments = new Set<Document>();

/**
 * Registers an active host document (e.g. from a popout window) so focus
 * resolution inspects all live host documents in this JS realm.
 */
export function registerHostDocument(doc: Document): () => void {
  registeredHostDocuments.add(doc);
  return () => {
    registeredHostDocuments.delete(doc);
  };
}

/**
 * Returns the currently focused host document across main and popout windows.
 */
export function getActiveHostDocument(): Document | null {
  if (typeof document === 'undefined') return null;

  for (const doc of registeredHostDocuments) {
    if (doc !== document && typeof doc.hasFocus === 'function' && doc.hasFocus()) {
      return doc;
    }
  }

  return document;
}

/**
 * Resolves the currently focused DOM element across all known host documents.
 */
export function getActiveHostElement(): Element | null {
  const doc = getActiveHostDocument();
  return doc?.activeElement ?? null;
}

let commandSequence = 0;

function nextCommandSequence(): number {
  commandSequence += 1;
  return commandSequence;
}

/**
 * Executes a project-scoped undo through the canonical IPC bridge.
 */
export async function executeProjectUndo(): Promise<void> {
  const documentId = getProjectDocumentId();
  const sessionId = useProjectStore.getState().sessionId;
  if (!documentId || !window.blueAPI?.undoProjectHistory) return;

  const response = await window.blueAPI.undoProjectHistory({
    documentId,
    operationId: `undo-${crypto.randomUUID()}`,
    expectedRevision: getProjectDocumentRevision(),
    contextSequence: nextCommandSequence(),
  });

  if (response.status === 'committed') {
    acceptProjectDocumentRevision(sessionId, response.revision);
  } else if (response.status === 'stale') {
    acceptProjectDocumentRevision(sessionId, response.currentRevision);
  } else if (response.status === 'unchanged') {
    acceptProjectDocumentRevision(sessionId, response.revision);
  }
}

/**
 * Executes a project-scoped redo through the canonical IPC bridge.
 */
export async function executeProjectRedo(): Promise<void> {
  const documentId = getProjectDocumentId();
  const sessionId = useProjectStore.getState().sessionId;
  if (!documentId || !window.blueAPI?.redoProjectHistory) return;

  const response = await window.blueAPI.redoProjectHistory({
    documentId,
    operationId: `redo-${crypto.randomUUID()}`,
    expectedRevision: getProjectDocumentRevision(),
    contextSequence: nextCommandSequence(),
  });

  if (response.status === 'committed') {
    acceptProjectDocumentRevision(sessionId, response.revision);
  } else if (response.status === 'stale') {
    acceptProjectDocumentRevision(sessionId, response.currentRevision);
  } else if (response.status === 'unchanged') {
    acceptProjectDocumentRevision(sessionId, response.revision);
  }
}

/**
 * Resolves the history scope of the currently focused editable element.
 */
export function resolveHistoryScope(): HistoryScopeResolution {
  const activeEl = getActiveHostElement();
  if (!activeEl) {
    return { scope: 'project' };
  }

  // Check for explicit data-history-scope attribute
  const scopedAncestor = activeEl.closest('[data-history-scope]');
  const explicitScope = scopedAncestor?.getAttribute('data-history-scope') as HistoryScope | null;

  if (explicitScope === 'none') {
    return { scope: 'none' };
  }

  // Check if inside CodeMirror
  const cmMount = activeEl.closest('.cm-editor');
  if (cmMount) {
    const view = EditorView.findFromDOM(cmMount as HTMLElement);
    if (explicitScope === 'draft') {
      return view
        ? { scope: 'draft', type: 'codemirror', view }
        : { scope: 'draft', type: 'custom' };
    }
    if (explicitScope === 'project') {
      return { scope: 'project' };
    }
    // Default CodeMirror to project unless marked draft
    return { scope: 'project' };
  }

  if (explicitScope === 'draft') {
    if (
      activeEl instanceof HTMLInputElement ||
      activeEl instanceof HTMLTextAreaElement ||
      (activeEl as HTMLElement).isContentEditable
    ) {
      return { scope: 'draft', type: 'native', element: activeEl as HTMLElement };
    }
    return { scope: 'draft', type: 'custom' };
  }

  if (explicitScope === 'project') {
    return { scope: 'project' };
  }

  // Native input elements outside CodeMirror default to draft (search bars, text fields, etc.)
  if (
    activeEl instanceof HTMLInputElement ||
    activeEl instanceof HTMLTextAreaElement ||
    (activeEl as HTMLElement).isContentEditable
  ) {
    return { scope: 'draft', type: 'native', element: activeEl as HTMLElement };
  }

  return { scope: 'project' };
}

/**
 * Dispatches an undo or redo action to the appropriate scope (draft vs project).
 * A draft-scoped element consumes the action locally and never falls through
 * to project history, even if its local undo stack is empty.
 */
export async function dispatchHistoryAction(
  action: 'undo' | 'redo',
): Promise<{ handled: boolean; scope: HistoryScope }> {
  const resolution = resolveHistoryScope();

  if (resolution.scope === 'none') {
    return { handled: true, scope: 'none' };
  }

  if (resolution.scope === 'draft') {
    if (resolution.type === 'codemirror') {
      if (action === 'undo') {
        cmUndo(resolution.view);
      } else {
        cmRedo(resolution.view);
      }
    } else if (resolution.type === 'native') {
      const doc = resolution.element.ownerDocument || document;
      try {
        doc.execCommand(action);
      } catch {
        // execCommand fallback
      }
    }
    // Consumed! Under no circumstances does a draft action fall through to project history.
    return { handled: true, scope: 'draft' };
  }

  // Project scope
  if (action === 'undo') {
    await executeProjectUndo();
  } else {
    await executeProjectRedo();
  }

  return { handled: true, scope: 'project' };
}
