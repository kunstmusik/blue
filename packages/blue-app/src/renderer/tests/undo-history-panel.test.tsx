// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WorkbenchPanelContent from '../components/workbench/WorkbenchPanelContent';
import UndoHistoryPanel from '../components/workbench/panels/UndoHistoryPanel';
import {
  cancelScheduledProjectHistoryEntriesRefresh,
  setProjectHistoryEntries,
  setProjectHistoryProjection,
} from '../hooks/use-project-history';
import { executeProjectRedo, executeProjectUndo } from '../lib/history-scope-router';
import { useProjectStore } from '../stores/project-store';
import { createEmptyProjectEditorSnapshot } from '../../shared/project-editor';
import type {
  ProjectHistoryEntriesSnapshot,
  ProjectHistoryStateProjection,
} from '../../shared/project-history';

vi.mock('../lib/history-scope-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/history-scope-router')>();
  return {
    ...actual,
    executeProjectUndo: vi.fn(async () => undefined),
    executeProjectRedo: vi.fn(async () => undefined),
  };
});

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const ENTRY_TIMES = {
  one: new Date(2026, 8, 11, 12, 5, 9).getTime(),
  two: new Date(2026, 8, 11, 12, 6, 3).getTime(),
  three: new Date(2026, 8, 11, 12, 7, 1).getTime(),
};

const ENTRIES = [
  { entryId: 'e1', label: 'Edit One', timestamp: ENTRY_TIMES.one, afterStateId: 's1' },
  { entryId: 'e2', label: 'Edit Two', timestamp: ENTRY_TIMES.two, afterStateId: 's2' },
  { entryId: 'e3', label: 'Edit Three', timestamp: ENTRY_TIMES.three, afterStateId: 's3' },
];

function makeSnapshot(cursor: number, entries = ENTRIES): ProjectHistoryEntriesSnapshot {
  return { documentId: 'doc-1', revision: 3, cursor, entries };
}

function makeProjection(
  overrides: Partial<ProjectHistoryStateProjection>,
): ProjectHistoryStateProjection {
  return {
    canUndo: true,
    canRedo: false,
    undoLabel: 'Edit Three',
    redoLabel: null,
    cursor: 3,
    length: 3,
    retainedBytes: 100,
    savedStateId: 's2',
    stateId: 's3',
    revision: 3,
    ...overrides,
  };
}

function seedLoadedProject(): void {
  const snapshot = createEmptyProjectEditorSnapshot();
  useProjectStore.getState().setProjectInfo({
    title: 'Undo Panel Test',
    author: 'Test',
    sampleRate: '44100',
    version: '2.10.0',
    filePath: '/test.blue',
    loaded: true,
    globalOrc: snapshot.globalOrc,
    globalSco: snapshot.globalSco,
    orchestra: { ...snapshot.orchestra, loaded: true },
    projectProperties: snapshot.projectProperties,
    transport: snapshot.transport,
  });
}

const roots: Array<{ container: HTMLDivElement; root: Root }> = [];

async function renderPanel(
  panel: React.ReactElement = <UndoHistoryPanel />,
): Promise<HTMLDivElement> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push({ container, root });

  await act(async () => {
    root.render(panel);
  });
  // The panel refreshes entries on a trailing debounce (500ms); advance past
  // it so mount-time fetches are observable.
  await act(async () => {
    await vi.advanceTimersByTimeAsync(500);
  });

  return container;
}

function rowStates(container: HTMLDivElement): string[] {
  return Array.from(container.querySelectorAll('[role="listitem"]')).map(
    (row) => row.getAttribute('data-history-state') ?? '',
  );
}

function rowLabels(container: HTMLDivElement): string[] {
  return Array.from(container.querySelectorAll('[role="listitem"]')).map(
    (row) => row.textContent ?? '',
  );
}

// The panel refetches entries on mount; the stub always answers with the
// snapshot the test currently expects so assertions are deterministic.
let currentSnapshot: ProjectHistoryEntriesSnapshot = makeSnapshot(3);

beforeEach(() => {
  vi.useFakeTimers();
  useProjectStore.getState().clearProject();
  useProjectStore.setState({ documentId: 'doc-1' });
  setProjectHistoryProjection(null);
  setProjectHistoryEntries(null);
  currentSnapshot = makeSnapshot(3);
  (window as unknown as { blueAPI: unknown }).blueAPI = {
    readProjectHistoryEntries: vi.fn(async () => currentSnapshot),
  };
  vi.mocked(executeProjectUndo).mockClear();
  vi.mocked(executeProjectRedo).mockClear();
});

afterEach(() => {
  while (roots.length > 0) {
    const entry = roots.pop();
    act(() => {
      entry?.root.unmount();
    });
    entry?.container.remove();
  }
  cancelScheduledProjectHistoryEntriesRefresh();
  vi.useRealTimers();
  const state = useProjectStore.getState();
  if (state.loaded) {
    state.clearProject();
  }
});

describe('UndoHistoryPanel', () => {
  it('renders the no-project empty state when no project is loaded', async () => {
    const container = await renderPanel();

    expect(container.textContent).toContain('No project loaded');
    expect(container.textContent).not.toContain('No edits yet');
  });

  it('renders the no-entries empty state when a project is loaded without history', async () => {
    seedLoadedProject();
    setProjectHistoryProjection(makeProjection({ cursor: 0, length: 0 }));
    currentSnapshot = makeSnapshot(0, []);
    const container = await renderPanel();

    expect(container.textContent).toContain('No edits yet');
    expect(container.textContent).not.toContain('No project loaded');
  });

  it('routes the registered workbench id to Undo History', async () => {
    seedLoadedProject();
    setProjectHistoryProjection(
      makeProjection({ canUndo: false, undoLabel: null, cursor: 0, length: 0 }),
    );
    currentSnapshot = makeSnapshot(0, []);
    const container = await renderPanel(
      <WorkbenchPanelContent panelId="UndoHistoryTopComponent" />,
    );

    expect(container.textContent).toContain('No edits yet.');
  });

  it('lists entries most recent first, all applied, with no divider at the tip', async () => {
    seedLoadedProject();
    setProjectHistoryProjection(makeProjection({ cursor: 3, length: 3 }));
    currentSnapshot = makeSnapshot(3);
    const container = await renderPanel();

    expect(rowLabels(container)).toEqual([
      'Edit Three12:07:01',
      'Edit TwoSaved12:06:03',
      'Edit One12:05:09',
    ]);
    expect(rowStates(container)).toEqual(['applied', 'applied', 'applied']);
    expect(container.querySelectorAll('[role="separator"]')).toHaveLength(0);
  });

  it('mutes undone entries and places the current divider between the groups', async () => {
    seedLoadedProject();
    setProjectHistoryProjection(
      makeProjection({
        canUndo: true,
        canRedo: true,
        undoLabel: 'Edit One',
        redoLabel: 'Edit Two',
        cursor: 1,
      }),
    );
    currentSnapshot = makeSnapshot(1);
    const container = await renderPanel();

    expect(rowLabels(container)).toEqual([
      'Edit Three12:07:01',
      'Edit TwoSaved12:06:03',
      'Edit One12:05:09',
    ]);

    const list = container.querySelector('[role="list"]')!;
    const children = Array.from(list.children);
    // Display order: undone entries first (most recent first), then the
    // current-position divider, then the applied entries.
    expect(children[0]?.getAttribute('data-history-state')).toBe('undone');
    expect(children[1]?.getAttribute('data-history-state')).toBe('undone');
    expect(children[2]?.getAttribute('role')).toBe('separator');
    expect(children[2]?.textContent).toContain('Current');
    expect(children[3]?.getAttribute('data-history-state')).toBe('applied');
  });

  it('places the divider after all rows when the history is fully undone', async () => {
    seedLoadedProject();
    setProjectHistoryProjection(
      makeProjection({
        canUndo: false,
        canRedo: true,
        undoLabel: null,
        redoLabel: 'Edit One',
        cursor: 0,
      }),
    );
    currentSnapshot = makeSnapshot(0);
    const container = await renderPanel();

    expect(rowStates(container)).toEqual(['undone', 'undone', 'undone']);
    const list = container.querySelector('[role="list"]')!;
    const last = list.lastElementChild!;
    expect(last.getAttribute('role')).toBe('separator');
    expect(last.textContent).toContain('Current');
  });

  it('marks only the entry matching the saved state', async () => {
    seedLoadedProject();
    setProjectHistoryProjection(makeProjection({ savedStateId: 's2' }));
    currentSnapshot = makeSnapshot(3);
    const container = await renderPanel();

    const rows = Array.from(container.querySelectorAll('[role="listitem"]'));
    expect(rows[0]?.textContent).not.toContain('Saved');
    expect(rows[1]?.textContent).toContain('Saved');
    expect(rows[2]?.textContent).not.toContain('Saved');
  });

  it('disables Undo and Redo at history bounds and labels them with the next action', async () => {
    seedLoadedProject();
    setProjectHistoryProjection(
      makeProjection({
        canUndo: false,
        canRedo: true,
        undoLabel: null,
        redoLabel: 'Edit One',
        cursor: 0,
      }),
    );
    currentSnapshot = makeSnapshot(0);
    const container = await renderPanel();

    const [undoButton, redoButton] = Array.from(
      container.querySelectorAll('button'),
    ) as HTMLButtonElement[];
    expect(undoButton?.disabled).toBe(true);
    expect(undoButton?.getAttribute('title')).toBe('Undo');
    expect(redoButton?.disabled).toBe(false);
    expect(redoButton?.getAttribute('title')).toBe('Redo Edit One');
  });

  it('dispatches undo and redo through the settlement-safe router path', async () => {
    seedLoadedProject();
    setProjectHistoryProjection(
      makeProjection({
        canUndo: true,
        canRedo: true,
        undoLabel: 'Edit Two',
        redoLabel: 'Edit Three',
        cursor: 2,
      }),
    );
    currentSnapshot = makeSnapshot(2);
    const container = await renderPanel();

    const [undoButton, redoButton] = Array.from(
      container.querySelectorAll('button'),
    ) as HTMLButtonElement[];
    await act(async () => {
      undoButton?.click();
    });
    expect(executeProjectUndo).toHaveBeenCalledTimes(1);
    await act(async () => {
      redoButton?.click();
    });
    expect(executeProjectRedo).toHaveBeenCalledTimes(1);
  });

  it('removes discarded redo rows when a new commit replaces the branch', async () => {
    seedLoadedProject();
    setProjectHistoryProjection(
      makeProjection({
        canUndo: true,
        canRedo: true,
        undoLabel: 'Edit Two',
        redoLabel: 'Edit Three',
        cursor: 2,
      }),
    );
    currentSnapshot = makeSnapshot(2);
    const container = await renderPanel();
    expect(rowStates(container)).toEqual(['undone', 'applied', 'applied']);

    // A new commit after the undo discards the redo branch: the stack becomes
    // Edit One, Edit Two, Edit New with everything applied.
    const branchSnapshot = makeSnapshot(3, [
      ENTRIES[0]!,
      ENTRIES[1]!,
      {
        entryId: 'e4',
        label: 'Edit New',
        timestamp: ENTRY_TIMES.three + 1000,
        afterStateId: 's4',
      },
    ]);
    currentSnapshot = branchSnapshot;
    await act(async () => {
      setProjectHistoryProjection(
        makeProjection({
          canUndo: true,
          canRedo: false,
          undoLabel: 'Edit New',
          cursor: 3,
          length: 3,
          revision: 4,
        }),
      );
      setProjectHistoryEntries(branchSnapshot);
    });

    expect(rowStates(container)).toEqual(['applied', 'applied', 'applied']);
    expect(rowLabels(container)[0]).toContain('Edit New');
    expect(container.querySelectorAll('[role="separator"]')).toHaveLength(0);
  });

  it('shows the retention footnote only when a history limit was reached', async () => {
    seedLoadedProject();
    setProjectHistoryProjection(makeProjection({ retentionStatus: 'within-limit' }));
    currentSnapshot = makeSnapshot(3);
    const container = await renderPanel();
    expect(container.textContent).not.toContain('History limit reached');

    await act(async () => {
      setProjectHistoryProjection(makeProjection({ retentionStatus: 'at-entry-limit' }));
    });

    expect(container.textContent).toContain('History limit reached');
    expect(container.textContent).toContain('oldest edits were dropped');
  });

  it('clears entries on project close and shows only the next document history', async () => {
    seedLoadedProject();
    setProjectHistoryProjection(makeProjection());
    currentSnapshot = makeSnapshot(3);
    const container = await renderPanel();
    expect(rowLabels(container)[0]).toContain('Edit Three');

    await act(async () => {
      useProjectStore.getState().clearProject();
      setProjectHistoryProjection(null);
      setProjectHistoryEntries(null);
    });
    expect(container.textContent).toContain('No project loaded');

    const otherSnapshot: ProjectHistoryEntriesSnapshot = {
      documentId: 'doc-2',
      revision: 1,
      cursor: 1,
      entries: [
        {
          entryId: 'x1',
          label: 'Other Project Edit',
          timestamp: ENTRY_TIMES.one,
          afterStateId: 't1',
        },
      ],
    };
    currentSnapshot = otherSnapshot;
    await act(async () => {
      seedLoadedProject();
      setProjectHistoryProjection(
        makeProjection({
          undoLabel: 'Other Project Edit',
          cursor: 1,
          length: 1,
          revision: 1,
        }),
      );
      setProjectHistoryEntries(otherSnapshot);
    });

    expect(container.textContent).not.toContain('Edit Three');
    expect(rowLabels(container)).toEqual(['Other Project Edit12:05:09']);
  });

  it('reflects the latest history state after rapid interleaved publications', async () => {
    seedLoadedProject();
    setProjectHistoryProjection(makeProjection({ cursor: 1, length: 1, revision: 1 }));
    currentSnapshot = makeSnapshot(1, [ENTRIES[0]!]);
    const container = await renderPanel();

    // Three rapid publications land before the panel settles; only the final
    // state may remain visible (no stale rows, no out-of-order updates).
    const steps = [
      {
        snapshot: makeSnapshot(2, [ENTRIES[0]!, ENTRIES[1]!]),
        projection: makeProjection({
          undoLabel: 'Edit Two',
          cursor: 2,
          length: 2,
          revision: 2,
        }),
      },
      {
        snapshot: makeSnapshot(1, [ENTRIES[0]!, ENTRIES[1]!]),
        projection: makeProjection({
          canUndo: true,
          canRedo: true,
          undoLabel: 'Edit One',
          redoLabel: 'Edit Two',
          cursor: 1,
          length: 2,
          revision: 3,
        }),
      },
      {
        snapshot: makeSnapshot(3, [
          ENTRIES[0]!,
          ENTRIES[1]!,
          {
            entryId: 'e5',
            label: 'Edit Final',
            timestamp: ENTRY_TIMES.three + 2000,
            afterStateId: 's5',
          },
        ]),
        projection: makeProjection({
          undoLabel: 'Edit Final',
          cursor: 3,
          length: 3,
          revision: 4,
        }),
      },
    ];

    for (const step of steps) {
      currentSnapshot = step.snapshot;
      await act(async () => {
        setProjectHistoryProjection(step.projection);
        setProjectHistoryEntries(step.snapshot);
      });
    }

    expect(rowStates(container)).toEqual(['applied', 'applied', 'applied']);
    expect(rowLabels(container)[0]).toContain('Edit Final');
    expect(container.querySelectorAll('[role="separator"]')).toHaveLength(0);
  });
});
