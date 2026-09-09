// @vitest-environment browser
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  acceptProjectDocumentRevision,
  getProjectDocumentRevision,
  useProjectStore,
} from '../stores/project-store';
import {
  reconcileExternalSelectionHints,
  useScoreSelectionStore,
} from '../stores/score-selection-store';
import type { ProjectDocumentUpdatedEvent } from '../../shared/project-history';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

type DocumentUpdatedListener = (event: ProjectDocumentUpdatedEvent) => void;

const documentUpdatedListeners = new Set<DocumentUpdatedListener>();

function makeEvent(
  overrides: Partial<ProjectDocumentUpdatedEvent> = {},
): ProjectDocumentUpdatedEvent {
  return {
    documentId: 'doc-1',
    sessionId: 7,
    revision: 2,
    stateId: 'state-2',
    isDirty: true,
    history: {
      canUndo: true,
      canRedo: false,
      undoLabel: 'Set Master Level',
      redoLabel: null,
      cursor: 2,
      length: 2,
      retainedBytes: 0,
      savedStateId: 'state-0',
      stateId: 'state-2',
    },
    acceptedOperationIds: [],
    snapshot: null,
    ...overrides,
  };
}

function dispatchDocumentUpdated(event: ProjectDocumentUpdatedEvent): void {
  for (const listener of documentUpdatedListeners) {
    listener(event);
  }

  // Mirrors the production use-ipc-listeners canonical-update handling.
  const store = useProjectStore.getState();
  if (event.sessionId !== store.sessionId) return;
  if (store.documentId && event.documentId !== store.documentId) return;
  if (event.revision <= getProjectDocumentRevision() && store.loaded) return;
  if (event.snapshot) {
    acceptProjectDocumentRevision(event.sessionId, event.revision);
    useProjectStore.getState().setProjectInfo(event.snapshot as never);
    if (event.isDirty) {
      useProjectStore.getState().markDirty();
    } else {
      useProjectStore.getState().markClean();
    }
    if (event.selectionHints && event.selectionHints.length > 0) {
      reconcileExternalSelectionHints(event.selectionHints, store.score);
    }
  }
}

/**
 * Two views of the same document (main window + Dockview popout share one
 * renderer JS context): both subscribe to the project store and to canonical
 * publications. An undo issued from either view must refresh both.
 */
function createView(label: string, host: HTMLElement): Root {
  const root = createRoot(host);
  function View(): React.ReactElement {
    const title = useProjectStore((s) => s.title);
    const isDirty = useProjectStore((s) => s.isDirty);
    const selection = useScoreSelectionStore((s) => s.selectedObjectIds);
    return React.createElement(
      'div',
      { 'data-view': label },
      React.createElement('span', { 'data-field': 'title' }, title),
      React.createElement('span', { 'data-field': 'dirty' }, isDirty ? 'dirty' : 'clean'),
      React.createElement('span', { 'data-field': 'selection' }, [...selection].sort().join(',')),
    );
  }
  act(() => {
    root.render(React.createElement(View));
  });
  return root;
}

describe('global project history across two views (T029, US2)', () => {
  let hostA: HTMLElement;
  let hostB: HTMLElement;
  let rootA: Root;
  let rootB: Root;

  beforeEach(() => {
    documentUpdatedListeners.clear();
    (window as { blueAPI?: unknown }).blueAPI = {
      onProjectDocumentUpdated: vi.fn((cb: DocumentUpdatedListener) => {
        documentUpdatedListeners.add(cb);
        return () => documentUpdatedListeners.delete(cb);
      }),
      getProjectDocument: vi.fn(async () => null),
      commitProjectDocumentPatches: vi.fn(async () => ({
        changed: false,
        revision: 0,
        sessionId: 7,
      })),
    };

    useProjectStore.setState({
      sessionId: 7,
      documentId: 'doc-1',
      loaded: true,
      title: 'Before Edit',
      isDirty: false,
      score: {
        ...useProjectStore.getState().score,
        layerGroups: [
          {
            groupId: 'g1',
            groupType: 'soundObject' as const,
            layers: [
              {
                layerId: 'l1',
                name: 'Layer',
                height: 40,
                muted: false,
                solo: false,
                items: [
                  {
                    objectId: 'obj-1',
                    objectType: 'GenericScore',
                    name: 'Object One',
                    startBeats: 0,
                    durationBeats: 2,
                  },
                  {
                    objectId: 'obj-2',
                    objectType: 'GenericScore',
                    name: 'Object Two',
                    startBeats: 4,
                    durationBeats: 2,
                  },
                ],
              },
            ],
          },
        ],
      },
    });

    hostA = document.createElement('div');
    hostB = document.createElement('div');
    document.body.appendChild(hostA);
    document.body.appendChild(hostB);
    rootA = createView('main', hostA);
    rootB = createView('popout', hostB);
  });

  function titleOf(host: HTMLElement): string | null {
    return host.querySelector('[data-field="title"]')?.textContent ?? null;
  }

  function dirtyOf(host: HTMLElement): string | null {
    return host.querySelector('[data-field="dirty"]')?.textContent ?? null;
  }

  function selectionOf(host: HTMLElement): string | null {
    return host.querySelector('[data-field="selection"]')?.textContent ?? null;
  }

  it('refreshes every mounted view when another context edits the document', () => {
    expect(titleOf(hostA)).toBe('Before Edit');
    expect(titleOf(hostB)).toBe('Before Edit');

    act(() => {
      dispatchDocumentUpdated(
        makeEvent({
          revision: 5,
          isDirty: true,
          snapshot: { sessionId: 7, documentId: 'doc-1', title: 'Edited Elsewhere' },
        }),
      );
    });

    expect(titleOf(hostA)).toBe('Edited Elsewhere');
    expect(titleOf(hostB)).toBe('Edited Elsewhere');
    expect(dirtyOf(hostA)).toBe('dirty');
    expect(dirtyOf(hostB)).toBe('dirty');
  });

  it('propagates an undo issued from one view to the other view', () => {
    act(() => {
      useProjectStore.setState({ title: 'Edited State', isDirty: true });
    });
    expect(titleOf(hostA)).toBe('Edited State');
    expect(titleOf(hostB)).toBe('Edited State');

    // Undo issued from the popout view: the canonical publication restores.
    act(() => {
      dispatchDocumentUpdated(
        makeEvent({
          revision: 6,
          isDirty: true,
          history: makeEvent().history && {
            ...makeEvent().history,
            canUndo: true,
            canRedo: true,
            redoLabel: 'Set Master Level',
            cursor: 1,
          },
          snapshot: { sessionId: 7, documentId: 'doc-1', title: 'Restored State' },
        }),
      );
    });

    expect(titleOf(hostA)).toBe('Restored State');
    expect(titleOf(hostB)).toBe('Restored State');
  });

  it('restores origin selections in every view and reconciles invalid hints', () => {
    act(() => {
      dispatchDocumentUpdated(
        makeEvent({
          revision: 7,
          isDirty: true,
          originViewId: 'origin-view',
          selectionHints: [
            { targetType: 'scoreObject', targetId: 'obj-2' },
            { targetType: 'scoreObject', targetId: 'obj-1' },
          ],
          snapshot: { sessionId: 7, documentId: 'doc-1', title: 'With Selection' },
        }),
      );
    });

    expect(selectionOf(hostA)).toBe('obj-1,obj-2');
    expect(selectionOf(hostB)).toBe('obj-1,obj-2');

    // Hints whose targets no longer exist reconcile to a clear selection.
    act(() => {
      dispatchDocumentUpdated(
        makeEvent({
          revision: 8,
          isDirty: true,
          originViewId: 'origin-view',
          selectionHints: [{ targetType: 'scoreObject', targetId: 'obj-deleted' }],
          snapshot: { sessionId: 7, documentId: 'doc-1', title: 'After Delete' },
        }),
      );
    });

    expect(selectionOf(hostA)).toBe('');
    expect(selectionOf(hostB)).toBe('');
  });

  it('keeps stale-document publications away from both views', () => {
    act(() => {
      dispatchDocumentUpdated(
        makeEvent({
          documentId: 'doc-replaced',
          revision: 9,
          snapshot: { sessionId: 7, title: 'Replaced leakage' },
        }),
      );
    });

    expect(titleOf(hostA)).toBe('Before Edit');
    expect(titleOf(hostB)).toBe('Before Edit');
  });
});
