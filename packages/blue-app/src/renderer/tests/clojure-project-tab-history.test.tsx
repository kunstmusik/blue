// @vitest-environment jsdom

import React, { act, useState } from 'react';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BlueData, ClojureLibraryEntry, ClojureProjectData } from '@blue/data';
import {
  createProjectEditorSnapshot,
  createClojureProjectSnapshot,
  type ClojureProjectSnapshot,
} from '../../shared/project-editor';
import type {
  ProjectDocumentCommitMetadata,
  ProjectHistoryCommitRequest,
  ProjectHistoryResponse,
} from '../../shared/project-history';
import { ProjectHistory } from '../../main/project-history';
import { ProjectSession } from '../../main/project-session';
import { MockHistoryContext } from '../../main/project-history-test-support';
import ClojureProjectTab from '../components/workbench/panels/project-properties/ClojureProjectTab';
import {
  dispatchHistoryAction,
  resolveHistoryScope,
  settleHistoryEditors,
} from '../lib/history-scope-router';
import {
  acceptProjectDocumentRevision,
  handleProjectHistoryBoundary as prepareProjectHistoryBoundary,
  handleProjectHistoryRelease as releaseProjectHistoryBoundary,
  useProjectStore,
} from '../stores/project-store';
import { setProjectHistoryProjection } from '../hooks/use-project-history';
import { HostDocumentContext } from '../hooks/use-host-document';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function createClojureModel(): ClojureProjectData {
  const projectData = new ClojureProjectData();
  for (let index = 0; index < 2; index += 1) {
    const entry = new ClojureLibraryEntry();
    entry.setDependencyCoordinates('org.clojure/data.json');
    entry.setVersion('2.4.0');
    projectData.addLibraryEntry(entry);
  }
  return projectData;
}

function setInputValue(input: HTMLInputElement, value: string): void {
  const tracker = (
    input as HTMLInputElement & {
      _valueTracker?: { setValue: (value: string) => void };
    }
  )._valueTracker;
  tracker?.setValue('');
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
  const event = new Event('input', { bubbles: true });
  Object.defineProperties(event, {
    data: { value: value.slice(-1) },
    inputType: { value: 'insertText' },
    isComposing: { value: false },
  });
  input.dispatchEvent(event);
}

function ClojureTabHarness({
  initial,
  onUpdate,
}: {
  initial: ClojureProjectSnapshot;
  onUpdate: (snapshot: ClojureProjectSnapshot, metadata?: ProjectDocumentCommitMetadata) => void;
}): React.ReactElement {
  const [snapshot, setSnapshot] = useState(initial);
  return (
    <ClojureProjectTab
      disabled={false}
      clojureProject={snapshot}
      updateClojureProject={(nextSnapshot, metadata) => {
        onUpdate(nextSnapshot, metadata);
        setSnapshot(nextSnapshot);
      }}
    />
  );
}

function StoreClojureTab(): React.ReactElement {
  const clojureProject = useProjectStore((state) => state.clojureProject);
  const updateClojureProject = useProjectStore((state) => state.updateClojureProject);
  return (
    <ClojureProjectTab
      disabled={false}
      clojureProject={clojureProject}
      updateClojureProject={updateClojureProject}
    />
  );
}

function toCommitReceipt(
  response: ProjectHistoryResponse,
  session: ProjectSession,
): {
  revision: number;
  sessionId: number;
  changed: boolean;
  patchChanged?: boolean[];
  patchAccepted?: boolean[];
  error?: string;
} {
  if (response.status === 'committed' || response.status === 'unchanged') {
    return (
      response.receipt ?? {
        revision: session.read().revision,
        sessionId: session.read().sessionId,
        changed: response.status === 'committed',
      }
    );
  }

  return {
    revision: session.read().revision,
    sessionId: session.read().sessionId,
    changed: false,
    error:
      'reason' in response
        ? response.reason
        : 'error' in response
          ? response.error
          : response.status === 'oversize'
            ? response.explanation
            : response.status,
  };
}

describe('Clojure project tab history integration', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    useProjectStore.getState().clearProject();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    useProjectStore.getState().clearProject();
    setProjectHistoryProjection(null);
  });

  it.each([
    ['ordinary', 'discard', false, null],
    ['ordinary', 'apply', false, null],
    ['boundary', 'discard', false, null],
    ['boundary', 'apply', false, null],
    ['ordinary', 'discard', true, null],
    ['ordinary', 'discard', true, 'stale'],
    ['ordinary', 'discard', false, 'rejected'],
  ] as const)(
    'recovers a %s conflict through the editor using %s and settles Save/Undo%s',
    async (mode, decision, checkpointRemote, transientHistoryFailure) => {
      vi.useFakeTimers();
      const frame = document.createElement('iframe');
      document.body.appendChild(frame);
      const dialogDocument = mode === 'boundary' ? frame.contentDocument! : document;
      try {
        const data = new BlueData();
        data.setClojureProjectData(createClojureModel());
        const session = new ProjectSession();
        session.replace(data, join(tmpdir(), 'clojure-conflict.blue'));
        const documentId = session.read().documentId!;
        const snapshot = () =>
          createProjectEditorSnapshot(
            session.read().data!,
            session.read().filePath,
            session.read().sessionId,
            documentId,
          );
        const history = new ProjectHistory({
          session,
          publishUpdated: (event) => {
            setProjectHistoryProjection(event.history);
          },
        });
        history.markClean();
        setProjectHistoryProjection(history.read());
        const initial = snapshot();
        const acknowledgeHistoryBoundary = vi.fn().mockResolvedValue({ ok: true });
        const readProjectHistory = vi.fn(async () => history.read());
        window.blueAPI = {
          ...window.blueAPI,
          getProjectDocument: vi.fn(async () => snapshot()),
          readProjectHistory,
          acknowledgeHistoryBoundary,
          commitProjectDocumentPatches: vi.fn(async (patches, metadata) => {
            const response = await history.commit({
              documentId,
              operationId: metadata!.operationId!,
              contextSequence: metadata!.contextSequence!,
              origin: metadata?.origin,
              expectedRevision: metadata!.expectedRevision!,
              phase: metadata?.phase,
              label: metadata?.label ?? 'Edit',
              patches,
            });
            return toCommitReceipt(response, session);
          }),
        } as typeof window.blueAPI;
        useProjectStore.getState().setProjectInfo(initial);
        act(() =>
          root.render(
            <HostDocumentContext.Provider value={dialogDocument}>
              <StoreClojureTab />
            </HostDocumentContext.Provider>,
          ),
        );
        await act(async () => {
          setInputValue(container.querySelector('input')!, 'local-draft');
          await settleHistoryEditors();
        });
        expect(
          (
            await history.commit({
              documentId,
              operationId: 'remote',
              contextSequence: 1,
              origin: { contextId: 'other-editor' },
              expectedRevision: 0,
              label: 'Remote edit',
              patches: [
                {
                  clojureProject: {
                    libraryEntries: initial.clojureProject.libraryEntries.map((entry, index) => ({
                      ...entry,
                      dependencyCoordinates:
                        index === 0 ? 'remote-value' : entry.dependencyCoordinates,
                    })),
                  },
                },
              ],
            })
          ).status,
        ).toBe('committed');
        if (checkpointRemote) {
          history.checkpointSave();
          setProjectHistoryProjection(history.read());
        }
        act(() => acceptProjectDocumentRevision(session.read().sessionId, session.read().revision));
        await act(async () => {
          if (mode === 'ordinary')
            await expect(useProjectStore.getState().flushPendingPatches()).rejects.toThrow(
              'changed remotely',
            );
          else {
            await prepareProjectHistoryBoundary({ barrierId: 'conflict', reason: 'undo' });
            releaseProjectHistoryBoundary({ barrierId: 'conflict', status: 'aborted' });
          }
        });
        expect(useProjectStore.getState().clojureFieldConflicts).toHaveLength(1);
        const reviewButton = [...container.querySelectorAll('button')].find(
          (button) => button.textContent === 'Review draft',
        )!;
        await act(async () => {
          reviewButton.click();
        });
        expect(dialogDocument.activeElement?.textContent).toBe('Cancel');
        expect(dialogDocument.querySelector('[role="alertdialog"]')?.textContent).toContain(
          'remote-value',
        );
        if (mode === 'boundary') {
          expect(document.querySelector('[role="alertdialog"]')).toBeNull();
          act(() =>
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })),
          );
          expect(dialogDocument.querySelector('[role="alertdialog"]')).not.toBeNull();
        }
        // Cancel is fail-closed and does not retire the retained draft.
        await act(async () => {
          dialogDocument.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
          );
        });
        expect(useProjectStore.getState().clojureFieldConflicts).toHaveLength(1);
        await act(async () => {
          reviewButton.click();
        });
        if (transientHistoryFailure === 'stale') {
          readProjectHistory.mockResolvedValueOnce({
            ...history.read(),
            revision: session.read().revision - 1,
          });
        } else if (transientHistoryFailure === 'rejected') {
          readProjectHistory.mockRejectedValueOnce(new Error('history unavailable'));
        }
        if (transientHistoryFailure) {
          await act(async () => {
            (
              dialogDocument.querySelector('[data-action-id="discard"]') as HTMLButtonElement
            ).click();
          });
          await act(async () => {
            await vi.waitFor(() => {
              expect(useProjectStore.getState().clojureFieldConflicts).toHaveLength(1);
              expect(dialogDocument.querySelector('[role="alert"]')?.textContent).toContain(
                'dirty state is unavailable',
              );
            });
          });
          await act(async () => {
            await prepareProjectHistoryBoundary({ barrierId: 'indeterminate', reason: 'save' });
          });
          expect(acknowledgeHistoryBoundary).toHaveBeenLastCalledWith(
            expect.objectContaining({ outstandingPrefixCount: 1 }),
          );
          releaseProjectHistoryBoundary({ barrierId: 'indeterminate', status: 'aborted' });
          await act(async () => {
            reviewButton.click();
          });
        }
        if (decision === 'apply') {
          act(() =>
            setInputValue(
              dialogDocument.querySelector('[aria-label="Draft value"]')!,
              'revised-draft',
            ),
          );
        }
        await act(async () => {
          (
            dialogDocument.querySelector(`[data-action-id="${decision}"]`) as HTMLButtonElement
          ).click();
        });
        expect(useProjectStore.getState().clojureFieldConflicts).toEqual([]);
        const expected = decision === 'apply' ? 'revised-draft' : 'remote-value';
        expect(snapshot().clojureProject.libraryEntries[0]!.dependencyCoordinates).toBe(expected);
        expect(useProjectStore.getState().clojureProject).toEqual(snapshot().clojureProject);
        expect((container.querySelector('input') as HTMLInputElement).value).toBe(expected);
        expect(useProjectStore.getState().isDirty).toBe(
          checkpointRemote && decision === 'discard' ? false : true,
        );
        expect(session.read().revision).toBe(decision === 'apply' ? 2 : 1);
        for (const reason of ['save', 'undo'] as const) {
          await act(async () => {
            await prepareProjectHistoryBoundary(
              { barrierId: reason, reason },
              settleHistoryEditors,
            );
            releaseProjectHistoryBoundary({ barrierId: reason, status: 'ready' });
          });
          expect(acknowledgeHistoryBoundary).toHaveBeenLastCalledWith(
            expect.objectContaining({ outstandingPrefixCount: 0 }),
          );
        }
        const result = await history.undo({
          documentId,
          operationId: 'undo-resolved',
          contextSequence: 2,
          origin: { contextId: 'other-editor' },
          expectedRevision: session.read().revision,
        });
        expect(result.status).toBe('committed');
        expect(snapshot().clojureProject.libraryEntries[0]!.dependencyCoordinates).toBe(
          decision === 'apply' ? 'remote-value' : 'org.clojure/data.json',
        );
      } finally {
        frame.remove();
        vi.useRealTimers();
      }
    },
  );

  it.each(['ordinary', 'boundary'] as const)(
    'keeps same-field drafts distinct through %s editor conflict recovery and history replay',
    async (mode) => {
      const data = new BlueData();
      const projectData = new ClojureProjectData();
      for (const [coordinates, version] of [
        ['aaa', '1.0.0'],
        ['bbb', '2.0.0'],
      ]) {
        const entry = new ClojureLibraryEntry();
        entry.setDependencyCoordinates(coordinates);
        entry.setVersion(version);
        projectData.addLibraryEntry(entry);
      }
      data.setClojureProjectData(projectData);

      const session = new ProjectSession();
      session.replace(data, join(tmpdir(), `clojure-retained-${mode}.blue`));
      const documentId = session.read().documentId!;
      const canonicalSnapshot = () =>
        createProjectEditorSnapshot(
          session.read().data!,
          session.read().filePath,
          session.read().sessionId,
          documentId,
        );
      const history = new ProjectHistory({
        session,
        publishUpdated: (event) => setProjectHistoryProjection(event.history),
      });
      history.markClean();
      setProjectHistoryProjection(history.read());
      const initial = canonicalSnapshot();
      const firstEntryId = initial.clojureProject.libraryEntries[0]!.entryId;
      const secondEntryId = initial.clojureProject.libraryEntries[1]!.entryId;
      const remoteEntries = initial.clojureProject.libraryEntries.map((entry, index) => ({
        ...entry,
        dependencyCoordinates: index === 0 ? 'remote-a' : 'remote-b',
      }));
      expect(
        (
          await history.commit({
            documentId,
            operationId: `${mode}-remote-seed`,
            contextSequence: 1,
            origin: { contextId: 'remote' },
            expectedRevision: 0,
            phase: 'single',
            label: 'Remote seed',
            patches: [{ clojureProject: { libraryEntries: remoteEntries } }],
          })
        ).status,
      ).toBe('committed');
      act(() => acceptProjectDocumentRevision(session.read().sessionId, session.read().revision));

      const acknowledgeHistoryBoundary = vi.fn().mockResolvedValue({ ok: true });
      window.blueAPI = {
        ...window.blueAPI,
        getProjectDocument: vi.fn(async () => canonicalSnapshot()),
        readProjectHistory: vi.fn(async () => history.read()),
        acknowledgeHistoryBoundary,
        commitProjectDocumentPatches: vi.fn(async (patches, metadata) => {
          const response = await history.commit({
            documentId,
            operationId: metadata!.operationId!,
            contextSequence: metadata!.contextSequence!,
            origin: metadata?.origin,
            expectedRevision: metadata!.expectedRevision!,
            phase: metadata?.phase,
            label: metadata?.label ?? 'Edit',
            patches,
          });
          return toCommitReceipt(response, session);
        }),
      } as typeof window.blueAPI;
      useProjectStore.getState().setProjectInfo(initial);
      act(() =>
        root.render(
          <HostDocumentContext.Provider value={document}>
            <StoreClojureTab />
          </HostDocumentContext.Provider>,
        ),
      );

      const updateEntry = async (
        entryId: string,
        field: 'dependencyCoordinates' | 'version',
        value: string,
        metadata?: ProjectDocumentCommitMetadata,
      ): Promise<void> => {
        const current = useProjectStore.getState().clojureProject;
        const next = {
          libraryEntries: current.libraryEntries.map((entry) =>
            entry.entryId === entryId ? { ...entry, [field]: value } : { ...entry },
          ),
        };
        await act(async () => {
          await useProjectStore.getState().updateClojureProject(next, {
            phase: 'single',
            fieldId: `clojure-library:${entryId}:${field === 'version' ? 'version' : 'coordinates'}`,
            ...metadata,
          });
        });
      };

      await updateEntry(firstEntryId, 'dependencyCoordinates', 'local-a-1');
      await updateEntry(firstEntryId, 'dependencyCoordinates', 'local-a-2');
      await updateEntry(secondEntryId, 'dependencyCoordinates', 'local-b');

      if (mode === 'boundary') {
        await act(async () => {
          await prepareProjectHistoryBoundary({ barrierId: 'blocked', reason: 'undo' });
        });
        releaseProjectHistoryBoundary({ barrierId: 'blocked', status: 'aborted' });
      }
      const pendingFailures = mode === 'boundary' ? 2 : 3;
      for (let index = 0; index < pendingFailures; index += 1) {
        await act(async () => {
          await expect(useProjectStore.getState().flushPendingPatches()).rejects.toThrow(
            'changed remotely',
          );
        });
      }
      expect(useProjectStore.getState().clojureFieldConflicts).toHaveLength(3);
      await act(async () => {
        await Promise.resolve();
      });

      const conflictButtons = (): HTMLButtonElement[] =>
        [...container.querySelectorAll('[aria-label="Clojure library conflicts"] button')].filter(
          (button): button is HTMLButtonElement => button.textContent === 'Review draft',
        );
      const openConflict = async (index: number): Promise<void> => {
        await act(async () => {
          conflictButtons()[index]!.click();
          await Promise.resolve();
        });
        await act(async () => {
          await vi.waitFor(() =>
            expect(document.querySelector('[role="alertdialog"]')).not.toBeNull(),
          );
        });
      };
      const clickDecision = async (
        action: 'discard' | 'apply',
        expectedConflictCount: number,
        expectError = false,
      ): Promise<void> => {
        await act(async () => {
          (document.querySelector(`[data-action-id="${action}"]`) as HTMLButtonElement).click();
        });
        await act(async () => {
          await vi.waitFor(() => {
            expect(useProjectStore.getState().clojureFieldConflicts).toHaveLength(
              expectedConflictCount,
            );
            if (expectError) {
              expect(document.querySelector('[role="alert"]')).not.toBeNull();
            }
          });
        });
      };

      await openConflict(0);
      await act(async () => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      });
      expect(useProjectStore.getState().clojureFieldConflicts).toHaveLength(3);

      await openConflict(0);
      expect(
        (
          await history.commit({
            documentId,
            operationId: `${mode}-remote-follow-up`,
            contextSequence: 2,
            origin: { contextId: 'remote' },
            expectedRevision: session.read().revision,
            phase: 'single',
            label: 'Remote follow-up',
            patches: [
              {
                clojureProject: {
                  libraryEntries: remoteEntries.map((entry, index) =>
                    index === 1 ? { ...entry, version: '2.1.0' } : { ...entry },
                  ),
                },
              },
            ],
          })
        ).status,
      ).toBe('committed');
      act(() => acceptProjectDocumentRevision(session.read().sessionId, session.read().revision));
      await clickDecision('discard', 3, true);
      expect(useProjectStore.getState().clojureFieldConflicts).toHaveLength(3);
      expect(document.querySelector('[role="alert"]')?.textContent).toContain('changed');

      await openConflict(0);
      await clickDecision('discard', 2);
      expect(
        useProjectStore.getState().clojureFieldConflicts.map((conflict) => conflict.value),
      ).toEqual(['local-a-2', 'local-b']);

      await openConflict(0);
      act(() => {
        setInputValue(document.querySelector('[aria-label="Draft value"]')!, 'revised-a');
      });
      await clickDecision('apply', 1);
      expect(
        useProjectStore.getState().clojureFieldConflicts.map((conflict) => conflict.value),
      ).toEqual(['local-b']);
      expect(history.read().undoLabel).toBe('Resolve Clojure Library Draft');
      expect(canonicalSnapshot().clojureProject.libraryEntries[0]!.dependencyCoordinates).toBe(
        'revised-a',
      );
      expect(
        useProjectStore.getState().clojureProject.libraryEntries[0]!.dependencyCoordinates,
      ).toBe('revised-a');
      expect(
        useProjectStore.getState().clojureProject.libraryEntries[1]!.dependencyCoordinates,
      ).toBe('local-b');

      await openConflict(0);
      await clickDecision('discard', 0);
      expect(useProjectStore.getState().clojureFieldConflicts).toEqual([]);
      expect(useProjectStore.getState().clojureProject).toEqual(canonicalSnapshot().clojureProject);
      expect(useProjectStore.getState().isDirty).toBe(true);

      await act(async () => {
        await prepareProjectHistoryBoundary({ barrierId: 'resolved', reason: 'save' });
      });
      releaseProjectHistoryBoundary({ barrierId: 'resolved', status: 'ready' });
      expect(acknowledgeHistoryBoundary).toHaveBeenLastCalledWith(
        expect.objectContaining({ outstandingPrefixCount: 0 }),
      );

      const undo = await history.undo({
        documentId,
        operationId: `${mode}-undo`,
        contextSequence: 10,
        origin: { contextId: 'other-editor' },
        expectedRevision: session.read().revision,
      });
      expect(undo.status).toBe('committed');
      expect(canonicalSnapshot().clojureProject.libraryEntries[0]!.dependencyCoordinates).toBe(
        'remote-a',
      );
      expect(history.read()).toMatchObject({
        undoLabel: 'Remote follow-up',
        redoLabel: 'Resolve Clojure Library Draft',
      });
      act(() => {
        useProjectStore.getState().refreshFromCanonical(canonicalSnapshot(), history.isDirty());
      });
      expect(
        useProjectStore.getState().clojureProject.libraryEntries[0]!.dependencyCoordinates,
      ).toBe('remote-a');

      const redo = await history.redo({
        documentId,
        operationId: `${mode}-redo`,
        contextSequence: 11,
        origin: { contextId: 'other-editor' },
        expectedRevision: session.read().revision,
      });
      expect(redo.status).toBe('committed');
      expect(canonicalSnapshot().clojureProject.libraryEntries[0]!.dependencyCoordinates).toBe(
        'revised-a',
      );
      expect(history.read()).toMatchObject({
        undoLabel: 'Resolve Clojure Library Draft',
        redoLabel: null,
      });
      act(() => {
        useProjectStore.getState().refreshFromCanonical(canonicalSnapshot(), history.isDirty());
      });
      expect(
        useProjectStore.getState().clojureProject.libraryEntries[0]!.dependencyCoordinates,
      ).toBe('revised-a');
    },
  );

  it('keeps distinct identical dependency rows stable across canonical refreshes (T129)', () => {
    const projectData = createClojureModel();
    const firstSnapshot = createClojureProjectSnapshot(projectData);
    const refreshedSnapshot = createClojureProjectSnapshot(projectData);
    const firstIds = firstSnapshot.libraryEntries.map((entry) => entry.entryId);

    expect(new Set(firstIds).size).toBe(2);
    expect(refreshedSnapshot.libraryEntries.map((entry) => entry.entryId)).toEqual(firstIds);

    const update = vi.fn();
    act(() => {
      root.render(
        <ClojureProjectTab
          disabled={false}
          clojureProject={firstSnapshot}
          updateClojureProject={update}
        />,
      );
    });

    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    act(() => {
      input.focus();
      input.setSelectionRange(1, 4);
    });

    act(() => {
      root.render(
        <ClojureProjectTab
          disabled={false}
          clojureProject={refreshedSnapshot}
          updateClojureProject={update}
        />,
      );
    });

    const refreshedInput = container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(refreshedInput).toBe(input);
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(1);
    expect(input.selectionEnd).toBe(4);
  });

  it('forwards stable field metadata and routes focused Undo through project history (T130)', async () => {
    const initial: ClojureProjectSnapshot = {
      libraryEntries: [
        {
          entryId: 'clj-a',
          dependencyCoordinates: 'org.clojure/data.json',
          version: '2.4.0',
        },
      ],
    };
    const updates = vi.fn();
    const undoProjectHistory = vi.fn().mockResolvedValue({
      status: 'unchanged',
      revision: 0,
    });
    window.blueAPI = {
      ...window.blueAPI,
      undoProjectHistory,
    } as unknown as typeof window.blueAPI;
    useProjectStore.setState({ loaded: true, documentId: 'doc-clj', sessionId: 1 });

    act(() => {
      root.render(
        <ClojureProjectTab
          disabled={false}
          clojureProject={initial}
          updateClojureProject={(nextSnapshot, metadata) => updates(nextSnapshot, metadata)}
        />,
      );
    });
    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(input.dataset.historyScope).toBe('project');

    act(() => {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
      setInputValue(input, `${input.value}x`);
      setInputValue(input, `${input.value}y`);
    });

    expect(updates).toHaveBeenCalled();
    expect(updates.mock.calls[0]?.[0]).toMatchObject({
      libraryEntries: [
        expect.objectContaining({
          entryId: 'clj-a',
          dependencyCoordinates: 'org.clojure/data.jsonx',
        }),
      ],
    });
    expect(updates.mock.calls[0]?.[1]).toMatchObject({
      label: 'Edit Clojure Library Coordinates',
      fieldId: 'clojure-library:clj-a:coordinates',
      gestureId: expect.any(String),
      phase: 'begin',
    });

    expect(resolveHistoryScope(document)).toEqual({ scope: 'project' });
    await act(async () => {
      await settleHistoryEditors(document);
      await dispatchHistoryAction('undo', document);
    });
    expect(undoProjectHistory).toHaveBeenCalledWith(
      expect.objectContaining({ documentId: 'doc-clj', expectedRevision: 0 }),
    );
  });

  it('does not resubmit a pending text batch after its row is removed (T130)', () => {
    const initial: ClojureProjectSnapshot = {
      libraryEntries: [
        {
          entryId: 'clj-remove',
          dependencyCoordinates: 'org.clojure/data.json',
          version: '2.4.0',
        },
      ],
    };
    const updates = vi.fn();

    act(() => {
      root.render(
        <ClojureProjectTab
          disabled={false}
          clojureProject={initial}
          updateClojureProject={(nextSnapshot, metadata) => {
            updates(nextSnapshot, metadata);
          }}
        />,
      );
    });
    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    act(() => setInputValue(input, `${input.value}x`));
    const callsBeforeRemove = updates.mock.calls.length;

    const removeButton = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'Remove',
    );
    expect(removeButton).toBeDefined();
    act(() => removeButton?.click());

    expect(updates).toHaveBeenCalledTimes(callsBeforeRemove + 1);
    expect(updates.mock.lastCall?.[0]).toEqual({ libraryEntries: [] });
  });

  it('allocates a fresh insertion identity and edits seeded and inserted rows independently (T132)', async () => {
    const initial: ClojureProjectSnapshot = {
      libraryEntries: [
        {
          entryId: 'draft-clj-lib-1',
          dependencyCoordinates: 'org/seeded',
          version: '1.0.0',
        },
      ],
    };
    const updates = vi.fn();

    act(() => {
      root.render(<ClojureTabHarness initial={initial} onUpdate={updates} />);
    });

    const addButton = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'Add Library',
    );
    expect(addButton).toBeDefined();
    act(() => addButton?.click());

    const added = updates.mock.lastCall?.[0] as ClojureProjectSnapshot;
    expect(added.libraryEntries).toHaveLength(2);
    expect(added.libraryEntries[0]?.entryId).toBe('draft-clj-lib-1');
    expect(added.libraryEntries[1]?.entryId).not.toBe('draft-clj-lib-1');
    expect(added.libraryEntries[1]?.entryId).toMatch(/^draft-clj-lib-/);

    const inputs = [...container.querySelectorAll('input[type="text"]')] as HTMLInputElement[];
    await act(async () => {
      setInputValue(inputs[0]!, 'org/seeded-edited');
      await Promise.resolve();
    });
    await act(async () => {
      setInputValue(inputs[2]!, 'org/inserted-edited');
      await Promise.resolve();
    });

    const edited = updates.mock.lastCall?.[0] as ClojureProjectSnapshot;
    expect(edited.libraryEntries).toEqual([
      expect.objectContaining({
        entryId: 'draft-clj-lib-1',
        dependencyCoordinates: 'org/seeded-edited',
      }),
      expect.objectContaining({
        entryId: added.libraryEntries[1]?.entryId,
        dependencyCoordinates: 'org/inserted-edited',
      }),
    ]);
  });

  it('keeps the focused identity through an equal-row reorder and edits that row after refresh (T133)', () => {
    const initial: ClojureProjectSnapshot = {
      libraryEntries: [
        {
          entryId: 'clj-reorder-a',
          dependencyCoordinates: 'org.clojure/data.json',
          version: '2.4.0',
        },
        {
          entryId: 'clj-reorder-b',
          dependencyCoordinates: 'org.clojure/data.json',
          version: '2.4.0',
        },
      ],
    };
    const updates = vi.fn();

    act(() => {
      root.render(
        <ClojureProjectTab
          disabled={false}
          clojureProject={initial}
          updateClojureProject={(nextSnapshot, metadata) => updates(nextSnapshot, metadata)}
        />,
      );
    });
    const secondInput = container.querySelectorAll('input[type="text"]')[2] as HTMLInputElement;
    act(() => {
      secondInput.focus();
      secondInput.setSelectionRange(1, 4);
    });

    const moveUpButton = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'Move Up' && !button.disabled,
    );
    expect(moveUpButton).toBeDefined();
    act(() => moveUpButton?.click());

    const reordered = updates.mock.lastCall?.[0] as ClojureProjectSnapshot;
    expect(reordered.libraryEntries.map((entry) => entry.entryId)).toEqual([
      'clj-reorder-b',
      'clj-reorder-a',
    ]);
    const refreshedSnapshot = {
      libraryEntries: reordered.libraryEntries.map((entry) => ({ ...entry })),
    };
    act(() => {
      root.render(
        <ClojureProjectTab
          disabled={false}
          clojureProject={reordered}
          updateClojureProject={updates}
        />,
      );
    });
    const refreshedInput = container.querySelectorAll('input[type="text"]')[0] as HTMLInputElement;
    expect(refreshedInput).toBe(secondInput);
    expect(document.activeElement).toBe(secondInput);
    expect(secondInput.selectionStart).toBe(1);
    expect(secondInput.selectionEnd).toBe(4);

    act(() => {
      root.render(
        <ClojureProjectTab
          disabled={false}
          clojureProject={refreshedSnapshot}
          updateClojureProject={updates}
        />,
      );
    });
    const postRefreshInput = container.querySelectorAll(
      'input[type="text"]',
    )[0] as HTMLInputElement;
    expect(postRefreshInput).toBe(secondInput);
    expect(document.activeElement).toBe(secondInput);

    act(() => setInputValue(postRefreshInput, 'org.clojure/data.json-edited'));
    expect(updates.mock.lastCall?.[0]).toEqual({
      libraryEntries: [
        {
          entryId: 'clj-reorder-b',
          dependencyCoordinates: 'org.clojure/data.json-edited',
          version: '2.4.0',
        },
        initial.libraryEntries[0],
      ],
    });
  });

  it('preserves interleaved Clojure field intents across delayed real-history acknowledgements (T131)', async () => {
    const data = new BlueData();
    const projectData = new ClojureProjectData();
    const first = new ClojureLibraryEntry();
    first.setDependencyCoordinates('aaa');
    first.setVersion('1.0.0');
    const second = new ClojureLibraryEntry();
    second.setDependencyCoordinates('bbb');
    second.setVersion('2.0.0');
    projectData.setLibraryEntries([first, second]);
    data.setClojureProjectData(projectData);

    const session = new ProjectSession();
    session.replace(data, '/tmp/clojure-delayed.blue');
    const documentId = session.read().documentId!;
    const canonicalSnapshot = () =>
      createProjectEditorSnapshot(
        session.read().data!,
        session.read().filePath,
        session.read().sessionId,
        documentId,
      );
    const initial = canonicalSnapshot();
    const history = new ProjectHistory({ session, publishUpdated: () => {} });
    let resolveFirst!: () => void;
    let resolveSecond!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });
    const secondGate = new Promise<void>((resolve) => {
      resolveSecond = resolve;
    });
    let commitCount = 0;
    const commitProjectDocumentPatches = vi.fn(
      async (
        patches: ProjectHistoryCommitRequest['patches'],
        metadata?: ProjectDocumentCommitMetadata & { expectedRevision?: number },
      ) => {
        commitCount += 1;
        const request: ProjectHistoryCommitRequest = {
          documentId,
          operationId: metadata?.operationId ?? `clojure-commit-${commitCount}`,
          expectedRevision: metadata?.expectedRevision ?? session.read().revision,
          contextSequence: metadata?.contextSequence ?? commitCount,
          label: metadata?.label ?? 'Edit Project',
          gestureId: metadata?.gestureId,
          fieldId: metadata?.fieldId,
          phase: metadata?.phase ?? 'single',
          origin: metadata?.origin,
          patches: patches ?? [],
        };
        const response = await history.commit(request);
        if (commitCount === 1) await firstGate;
        if (commitCount === 2) await secondGate;
        return toCommitReceipt(response, session);
      },
    );
    window.blueAPI = {
      ...window.blueAPI,
      commitProjectDocumentPatches,
      getProjectDocument: vi.fn(async () => canonicalSnapshot()),
    } as unknown as typeof window.blueAPI;
    useProjectStore.getState().setProjectInfo(initial);

    act(() => root.render(<StoreClojureTab />));
    const inputs = [...container.querySelectorAll('input[type="text"]')] as HTMLInputElement[];
    await act(async () => {
      setInputValue(inputs[0]!, 'aaax');
      await Promise.resolve();
    });

    const firstFlush = useProjectStore.getState().flushPendingPatches();
    await Promise.resolve();
    await Promise.resolve();
    expect(commitProjectDocumentPatches).toHaveBeenCalledTimes(1);

    const inputsAfterFirst = [
      ...container.querySelectorAll('input[type="text"]'),
    ] as HTMLInputElement[];
    await act(async () => {
      setInputValue(inputsAfterFirst[2]!, 'bbby');
      await Promise.resolve();
    });

    await act(async () => {
      resolveFirst();
      await vi.waitFor(() => expect(commitProjectDocumentPatches).toHaveBeenCalledTimes(2));
    });
    expect(commitProjectDocumentPatches).toHaveBeenCalledTimes(2);
    expect(useProjectStore.getState().clojureProject.libraryEntries).toEqual([
      expect.objectContaining({ dependencyCoordinates: 'aaax' }),
      expect.objectContaining({ dependencyCoordinates: 'bbby' }),
    ]);

    const inputsAfterRefresh = [
      ...container.querySelectorAll('input[type="text"]'),
    ] as HTMLInputElement[];
    await act(async () => {
      setInputValue(inputsAfterRefresh[0]!, 'aaaxx');
      await Promise.resolve();
    });

    await act(async () => {
      resolveSecond();
      await firstFlush;
      await useProjectStore.getState().flushPendingPatches();
    });

    expect(commitProjectDocumentPatches).toHaveBeenCalledTimes(3);
    expect(useProjectStore.getState().clojureProject.libraryEntries).toEqual([
      expect.objectContaining({ dependencyCoordinates: 'aaaxx' }),
      expect.objectContaining({ dependencyCoordinates: 'bbby' }),
    ]);
    expect(canonicalSnapshot().clojureProject.libraryEntries).toEqual(
      useProjectStore.getState().clojureProject.libraryEntries,
    );
  });

  it('merges a queued field intent with a published two-context canonical revision (T134)', async () => {
    vi.useFakeTimers();
    try {
      const data = new BlueData();
      const projectData = new ClojureProjectData();
      const first = new ClojureLibraryEntry();
      first.setDependencyCoordinates('aaa');
      first.setVersion('1.0.0');
      const second = new ClojureLibraryEntry();
      second.setDependencyCoordinates('bbb');
      second.setVersion('2.0.0');
      projectData.setLibraryEntries([first, second]);
      data.setClojureProjectData(projectData);

      const session = new ProjectSession();
      session.replace(data, '/tmp/clojure-two-context.blue');
      const documentId = session.read().documentId!;
      const canonicalSnapshot = () =>
        createProjectEditorSnapshot(
          session.read().data!,
          session.read().filePath,
          session.read().sessionId,
          documentId,
        );
      const initial = canonicalSnapshot();
      const firstEntryId = initial.clojureProject.libraryEntries[0]!.entryId;
      const secondEntryId = initial.clojureProject.libraryEntries[1]!.entryId;
      const localHistory = new ProjectHistory({ session, publishUpdated: () => {} });
      const remoteHistory = localHistory;
      const remoteContext = 'ctx-clojure-remote';
      let localCommitCount = 0;
      const commitProjectDocumentPatches = vi.fn(
        async (
          patches: ProjectHistoryCommitRequest['patches'],
          metadata?: ProjectDocumentCommitMetadata,
        ) => {
          localCommitCount += 1;
          const response = await localHistory.commit({
            documentId,
            operationId: metadata?.operationId ?? `clojure-local-${localCommitCount}`,
            expectedRevision: metadata?.expectedRevision ?? session.read().revision,
            contextSequence: metadata?.contextSequence ?? localCommitCount,
            label: metadata?.label ?? 'Edit Project',
            fieldId: metadata?.fieldId,
            gestureId: metadata?.gestureId,
            phase: metadata?.phase ?? 'single',
            patches: patches ?? [],
          });
          return toCommitReceipt(response, session);
        },
      );
      window.blueAPI = {
        ...window.blueAPI,
        commitProjectDocumentPatches,
        getProjectDocument: vi.fn(async () => canonicalSnapshot()),
      } as unknown as typeof window.blueAPI;
      useProjectStore.getState().setProjectInfo(initial);

      act(() => root.render(<StoreClojureTab />));
      const inputs = [...container.querySelectorAll('input[type="text"]')] as HTMLInputElement[];
      await act(async () => {
        setInputValue(inputs[0]!, 'aaax');
        await Promise.resolve();
      });

      const remote = await remoteHistory.commit(
        new MockHistoryContext(remoteContext).nextCommitRequest(
          documentId,
          session.read().revision,
          'Remote Clojure update',
          [
            {
              clojureProject: {
                libraryEntries: [
                  { entryId: firstEntryId, dependencyCoordinates: 'aaa', version: '1.0.0' },
                  {
                    entryId: secondEntryId,
                    dependencyCoordinates: 'bbby',
                    version: '2.0.0',
                  },
                ],
              },
            },
          ],
        ),
      );
      expect(remote.status).toBe('committed');

      const published = canonicalSnapshot();
      act(() => {
        acceptProjectDocumentRevision(session.read().sessionId, session.read().revision);
        useProjectStore.getState().refreshFromCanonical(published, true);
      });
      expect(useProjectStore.getState().clojureProject.libraryEntries).toEqual([
        expect.objectContaining({ entryId: firstEntryId, dependencyCoordinates: 'aaax' }),
        expect.objectContaining({ entryId: secondEntryId, dependencyCoordinates: 'bbby' }),
      ]);

      await act(async () => {
        await useProjectStore.getState().flushPendingPatches();
      });

      expect(commitProjectDocumentPatches).toHaveBeenCalledWith(
        [
          {
            clojureProject: {
              libraryEntries: [
                { entryId: firstEntryId, dependencyCoordinates: 'aaax', version: '1.0.0' },
                {
                  entryId: secondEntryId,
                  dependencyCoordinates: 'bbby',
                  version: '2.0.0',
                },
              ],
            },
          },
        ],
        expect.objectContaining({ expectedRevision: 1 }),
      );
      expect(useProjectStore.getState().clojureProject.libraryEntries).toEqual(
        canonicalSnapshot().clojureProject.libraryEntries,
      );
      expect(canonicalSnapshot().clojureProject.libraryEntries).toEqual([
        expect.objectContaining({ entryId: firstEntryId, dependencyCoordinates: 'aaax' }),
        expect.objectContaining({ entryId: secondEntryId, dependencyCoordinates: 'bbby' }),
      ]);
    } finally {
      vi.useRealTimers();
    }
  });
});
