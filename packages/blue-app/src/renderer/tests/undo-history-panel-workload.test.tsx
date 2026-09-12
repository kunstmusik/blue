// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import UndoHistoryPanel from '../components/workbench/panels/UndoHistoryPanel';
import {
  cancelScheduledProjectHistoryEntriesRefresh,
  setProjectHistoryEntries,
  setProjectHistoryProjection,
} from '../hooks/use-project-history';
import { useProjectStore } from '../stores/project-store';
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

const WORKLOAD_SIZE = 100;
const BASE_TIMESTAMP = new Date(2026, 8, 11, 12, 0, 0).getTime();

interface WorkloadEntry {
  entryId: string;
  label: string;
  timestamp: number;
  afterStateId: string;
}

const WORKLOAD: WorkloadEntry[] = Array.from({ length: WORKLOAD_SIZE }, (_, i) => ({
  entryId: `e${i + 1}`,
  label: `Action ${i + 1}`,
  timestamp: BASE_TIMESTAMP + i * 1000,
  afterStateId: `s${i + 1}`,
}));

function snapshotAt(length: number, cursor: number): ProjectHistoryEntriesSnapshot {
  return {
    documentId: 'doc-1',
    revision: length,
    cursor,
    entries: WORKLOAD.slice(0, length),
  };
}

function projectionAt(
  length: number,
  cursor: number,
  revision: number,
): ProjectHistoryStateProjection {
  return {
    canUndo: cursor > 0,
    canRedo: cursor < length,
    undoLabel: cursor > 0 ? WORKLOAD[cursor - 1]!.label : null,
    redoLabel: cursor < length ? WORKLOAD[cursor]!.label : null,
    cursor,
    length,
    retainedBytes: length * 8,
    savedStateId: null,
    stateId: cursor > 0 ? WORKLOAD[cursor - 1]!.afterStateId : 's0',
    revision,
  };
}

function rowLabels(container: HTMLDivElement): string[] {
  return Array.from(container.querySelectorAll('[role="listitem"]')).map(
    (row) => row.textContent ?? '',
  );
}

function rowStates(container: HTMLDivElement): string[] {
  return Array.from(container.querySelectorAll('[role="listitem"]')).map(
    (row) => row.getAttribute('data-history-state') ?? '',
  );
}

function expectedLabels(length: number): string[] {
  return WORKLOAD.slice(0, length)
    .map((entry) => entry.label)
    .reverse();
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.useFakeTimers();
  useProjectStore.getState().clearProject();
  useProjectStore.setState({ loaded: true, documentId: 'doc-1' });
  setProjectHistoryProjection(null);
  setProjectHistoryEntries(null);
  (window as unknown as { blueAPI: unknown }).blueAPI = {
    readProjectHistoryEntries: vi.fn(async () => null as never),
  };
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(<UndoHistoryPanel />);
  });
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  cancelScheduledProjectHistoryEntriesRefresh();
  vi.useRealTimers();
  setProjectHistoryProjection(null);
  setProjectHistoryEntries(null);
  useProjectStore.getState().clearProject();
});

describe('UndoHistoryPanel 100-action workload (spec 106 SC-002)', () => {
  it('tracks 100 mixed commits, undoes, redoes, and a branch discard exactly', () => {
    // 100 commits: after each publication the list shows every entry applied,
    // most recent first, with no duplicates or reordering.
    for (let i = 1; i <= WORKLOAD_SIZE; i += 1) {
      act(() => {
        setProjectHistoryProjection(projectionAt(i, i, i));
        setProjectHistoryEntries(snapshotAt(i, i));
      });
      const labels = rowLabels(container).map((label) => label.replace(/\d\d:\d\d:\d\d/, ''));
      expect(labels).toEqual(expectedLabels(i));
      expect(rowStates(container).every((state) => state === 'applied')).toBe(true);
    }

    // Undo the entire span: the cursor moves down one row per publication and
    // the undone rows stay listed, muted, above the divider.
    for (let cursor = WORKLOAD_SIZE - 1; cursor >= 0; cursor -= 1) {
      act(() => {
        setProjectHistoryProjection(
          projectionAt(WORKLOAD_SIZE, cursor, 2 * WORKLOAD_SIZE - cursor),
        );
        setProjectHistoryEntries(snapshotAt(WORKLOAD_SIZE, cursor));
      });
      const states = rowStates(container);
      expect(states).toHaveLength(WORKLOAD_SIZE);
      expect(states.filter((state) => state === 'undone')).toHaveLength(WORKLOAD_SIZE - cursor);
      expect(states.filter((state) => state === 'applied')).toHaveLength(cursor);
    }
    expect(container.querySelectorAll('[role="separator"]')).toHaveLength(1);

    // Redo half the span.
    for (let cursor = 1; cursor <= WORKLOAD_SIZE / 2; cursor += 1) {
      act(() => {
        setProjectHistoryProjection(
          projectionAt(WORKLOAD_SIZE, cursor, 3 * WORKLOAD_SIZE + cursor),
        );
        setProjectHistoryEntries(snapshotAt(WORKLOAD_SIZE, cursor));
      });
      const states = rowStates(container);
      expect(states.filter((state) => state === 'applied')).toHaveLength(cursor);
    }

    // A new commit at the half-way point discards the redo branch: the stack
    // becomes 51 entries (50 kept + the new one), all applied, no divider.
    const branchEntries: WorkloadEntry[] = [
      ...WORKLOAD.slice(0, WORKLOAD_SIZE / 2),
      {
        entryId: 'e-branch',
        label: 'Branched Final',
        timestamp: BASE_TIMESTAMP + WORKLOAD_SIZE * 1000,
        afterStateId: 's-branch',
      },
    ];
    const branchLength = WORKLOAD_SIZE / 2 + 1;
    act(() => {
      setProjectHistoryProjection({
        ...projectionAt(branchLength, branchLength, 4 * WORKLOAD_SIZE),
        undoLabel: 'Branched Final',
        stateId: 's-branch',
      });
      setProjectHistoryEntries({
        documentId: 'doc-1',
        revision: 4 * WORKLOAD_SIZE,
        cursor: branchLength,
        entries: branchEntries,
      });
    });

    const labels = rowLabels(container).map((label) => label.replace(/\d\d:\d\d:\d\d/, ''));
    expect(labels).toEqual(['Branched Final', ...expectedLabels(WORKLOAD_SIZE / 2)]);
    expect(rowStates(container).every((state) => state === 'applied')).toBe(true);
    expect(container.querySelectorAll('[role="separator"]')).toHaveLength(0);
  });
});
