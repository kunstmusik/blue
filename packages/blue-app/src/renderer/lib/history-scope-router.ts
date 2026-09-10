import { EditorView } from 'codemirror';
import { undo as cmUndo, redo as cmRedo, undoDepth, redoDepth } from '@codemirror/commands';
import { toast } from 'sonner';
import type {
  FocusedHistoryAvailability,
  ProjectHistoryStateProjection,
} from '../../shared/project-history';
import {
  acceptProjectDocumentRevision,
  getProjectDocumentId,
  getProjectDocumentRevision,
  getProjectHistoryParticipantContextId,
  reserveProjectHistoryContextSequence,
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
const editorSettlements = new Map<Document, Set<() => Promise<void> | void>>();

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

/** Registers pending editor input that must settle before a project command. */
export function registerHistoryEditorSettlement(
  doc: Document,
  settle: () => Promise<void> | void,
): () => void {
  let settlements = editorSettlements.get(doc);
  if (!settlements) {
    settlements = new Set();
    editorSettlements.set(doc, settlements);
  }
  settlements.add(settle);
  return () => {
    settlements?.delete(settle);
    if (settlements?.size === 0) editorSettlements.delete(doc);
  };
}

/** Waits for registered editors in the selected host document to settle. */
export async function settleHistoryEditors(preferredDocument?: Document): Promise<void> {
  const documents = preferredDocument
    ? [preferredDocument]
    : [
        ...new Set([
          ...(typeof document === 'undefined' ? [] : [document]),
          ...registeredHostDocuments,
        ]),
      ];
  const settlements = documents.flatMap((doc) => [...(editorSettlements.get(doc) ?? [])]);
  await Promise.all(settlements.map((settle) => settle()));
}

/**
 * Returns the currently focused host document across main and popout windows.
 */
export function getActiveHostDocument(preferredDocument?: Document): Document | null {
  if (preferredDocument) return preferredDocument;
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
export function getActiveHostElement(preferredDocument?: Document): Element | null {
  const doc = getActiveHostDocument(preferredDocument);
  return doc?.activeElement ?? null;
}

function isNativeTextInput(element: Element): boolean {
  const tagName = element.tagName.toLowerCase();
  return tagName === 'input' || tagName === 'textarea';
}

export function flushFocusedProjectEditor(preferredDocument?: Document): void {
  const activeElement = getActiveHostElement(preferredDocument);
  const ownerWindow = activeElement?.ownerDocument?.defaultView;
  const CustomEventConstructor = ownerWindow?.CustomEvent ?? globalThis.CustomEvent;
  if (!activeElement || !CustomEventConstructor) return;

  activeElement.dispatchEvent(
    new CustomEventConstructor('blue-history-before-command', { bubbles: true }),
  );
}

/**
 * Surfaces a non-committed history command outcome. Undo and redo must never
 * fail silently: a barrier timeout or rejected command otherwise presents as a
 * dead Cmd-Z with no feedback.
 */
function reportHistoryCommandFailure(
  action: 'undo' | 'redo',
  response: { status: string; reason?: string; error?: string },
): void {
  if (response.status !== 'failed' && response.status !== 'invalid' && response.status !== 'busy') {
    return;
  }
  const detail = response.reason ?? response.error;
  toast.error(`${action === 'undo' ? 'Undo' : 'Redo'} failed${detail ? `: ${detail}` : ''}`);
}

/**
 * Executes a project-scoped undo through the canonical IPC bridge.
 */
export async function executeProjectUndo(hostDocument?: Document): Promise<void> {
  const documentId = getProjectDocumentId();
  const sessionId = useProjectStore.getState().sessionId;
  if (!documentId || !window.blueAPI?.undoProjectHistory) return;

  await settleHistoryEditors(hostDocument);
  flushFocusedProjectEditor(hostDocument);

  const response = await window.blueAPI.undoProjectHistory({
    documentId,
    operationId: `undo-${crypto.randomUUID()}`,
    expectedRevision: getProjectDocumentRevision(),
    contextSequence: reserveProjectHistoryContextSequence(),
    origin: { contextId: getProjectHistoryParticipantContextId(), viewId: 'workbench' },
  });

  if (response.status === 'committed') {
    acceptProjectDocumentRevision(sessionId, response.revision);
  } else if (response.status === 'stale') {
    acceptProjectDocumentRevision(sessionId, response.currentRevision);
  } else if (response.status === 'unchanged') {
    acceptProjectDocumentRevision(sessionId, response.revision);
  }
  reportHistoryCommandFailure('undo', response);
}

/**
 * Executes a project-scoped redo through the canonical IPC bridge.
 */
export async function executeProjectRedo(hostDocument?: Document): Promise<void> {
  const documentId = getProjectDocumentId();
  const sessionId = useProjectStore.getState().sessionId;
  if (!documentId || !window.blueAPI?.redoProjectHistory) return;

  await settleHistoryEditors(hostDocument);
  flushFocusedProjectEditor(hostDocument);

  const response = await window.blueAPI.redoProjectHistory({
    documentId,
    operationId: `redo-${crypto.randomUUID()}`,
    expectedRevision: getProjectDocumentRevision(),
    contextSequence: reserveProjectHistoryContextSequence(),
    origin: { contextId: getProjectHistoryParticipantContextId(), viewId: 'workbench' },
  });

  if (response.status === 'committed') {
    acceptProjectDocumentRevision(sessionId, response.revision);
  } else if (response.status === 'stale') {
    acceptProjectDocumentRevision(sessionId, response.currentRevision);
  } else if (response.status === 'unchanged') {
    acceptProjectDocumentRevision(sessionId, response.revision);
  }
  reportHistoryCommandFailure('redo', response);
}

/**
 * Resolves the history scope of the currently focused editable element.
 */
export function resolveHistoryScope(hostDocument?: Document): HistoryScopeResolution {
  const activeEl = getActiveHostElement(hostDocument);
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
    if (isNativeTextInput(activeEl) || (activeEl as HTMLElement).isContentEditable) {
      return { scope: 'draft', type: 'native', element: activeEl as HTMLElement };
    }
    return { scope: 'draft', type: 'custom' };
  }

  if (explicitScope === 'project') {
    return { scope: 'project' };
  }

  // Native input elements outside CodeMirror default to draft (search bars, text fields, etc.)
  if (isNativeTextInput(activeEl) || (activeEl as HTMLElement).isContentEditable) {
    return { scope: 'draft', type: 'native', element: activeEl as HTMLElement };
  }

  return { scope: 'project' };
}

/** Derives the native-menu projection from the currently focused scope. */
export function getFocusedHistoryAvailability(
  hostDocument?: Document,
  projectProjection?: ProjectHistoryStateProjection | null,
): FocusedHistoryAvailability {
  const resolution = resolveHistoryScope(hostDocument);
  if (resolution.scope === 'project') {
    return {
      scope: 'project',
      canUndo: projectProjection?.canUndo ?? false,
      canRedo: projectProjection?.canRedo ?? false,
      undoLabel: projectProjection?.undoLabel ?? null,
      redoLabel: projectProjection?.redoLabel ?? null,
    };
  }
  if (resolution.scope === 'draft' && resolution.type === 'codemirror') {
    return {
      scope: 'draft',
      canUndo: undoDepth(resolution.view.state) > 0,
      canRedo: redoDepth(resolution.view.state) > 0,
      undoLabel: 'Local Draft',
      redoLabel: 'Local Draft',
    };
  }
  if (resolution.scope === 'draft' && resolution.type === 'native') {
    return {
      scope: 'draft',
      canUndo: true,
      canRedo: true,
      undoLabel: 'Local Draft',
      redoLabel: 'Local Draft',
    };
  }
  return {
    scope: resolution.scope,
    canUndo: false,
    canRedo: false,
    undoLabel: null,
    redoLabel: null,
  };
}

export function publishFocusedHistoryAvailability(
  projectProjection?: ProjectHistoryStateProjection | null,
  hostDocument?: Document,
): void {
  window.blueAPI?.syncHistoryAvailability?.(
    getFocusedHistoryAvailability(hostDocument, projectProjection),
  );
}

/**
 * Dispatches an undo or redo action to the appropriate scope (draft vs project).
 * A draft-scoped element consumes the action locally and never falls through
 * to project history, even if its local undo stack is empty.
 */
export async function dispatchHistoryAction(
  action: 'undo' | 'redo',
  hostDocument?: Document,
): Promise<{ handled: boolean; scope: HistoryScope }> {
  const resolution = resolveHistoryScope(hostDocument);

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
    await executeProjectUndo(hostDocument);
  } else {
    await executeProjectRedo(hostDocument);
  }

  return { handled: true, scope: 'project' };
}
