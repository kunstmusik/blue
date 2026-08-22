// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LiveSpaceTab from '../components/workbench/panels/blue-live/LiveSpaceTab';
import LiveCodeTab from '../components/workbench/panels/blue-live/LiveCodeTab';
import OptionsTab from '../components/workbench/panels/blue-live/OptionsTab';
import { useProjectStore } from '../stores/project-store';
import { createEmptyProjectEditorSnapshot } from '../../shared/project-editor';
import type { BlueLiveProjectSnapshot } from '../../shared/project-editor';
import { GenericScore } from '@blue/data';
import { useScoreSelectionStore } from '../stores/score-selection-store';
import { useWorkbenchStore } from '../stores/workbench-store';
import { useLibraryStore } from '../stores/library-store';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function makeBlueLiveSnapshot(): BlueLiveProjectSnapshot {
  const scoreXml = new GenericScore().saveAsXML().toXml();
  return {
    tempo: 120,
    repeat: 4,
    repeatEnabled: false,
    commandLine: '',
    commandLineEnabled: false,
    commandLineOverride: false,
    liveCodeText: '',
    bins: {
      rows: 2,
      columns: 3,
      cells: [
        [
          { uniqueId: 'obj1', displayName: 'OSC1', enabled: true, keyTrigger: 0, midiTrigger: 0, soundObjectType: 'GenericScore', hasSoundObject: true, serializedXml: scoreXml },
          { uniqueId: 'obj2', displayName: 'OSC2', enabled: false, keyTrigger: 0, midiTrigger: 0, soundObjectType: 'GenericScore', hasSoundObject: true, serializedXml: scoreXml },
        ],
        [
          null,
          { uniqueId: 'obj3', displayName: 'FX1', enabled: false, keyTrigger: 0, midiTrigger: 0, soundObjectType: 'GenericScore', hasSoundObject: true, serializedXml: scoreXml },
        ],
        [
          { uniqueId: 'obj4', displayName: 'SUB1', enabled: true, keyTrigger: 0, midiTrigger: 0, soundObjectType: 'GenericScore', hasSoundObject: true, serializedXml: scoreXml },
          null,
        ],
      ],
    },
    sets: [
      { name: 'Set A', liveObjectIds: ['obj1', 'obj4'] },
      { name: 'Set B', liveObjectIds: ['obj2'] },
    ],
  };
}

function seedProject(blueLive?: BlueLiveProjectSnapshot): void {
  const snapshot = createEmptyProjectEditorSnapshot();
  useProjectStore.getState().setProjectInfo({
    title: 'BlueLive Test',
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

  if (blueLive) {
    useProjectStore.setState({ blueLive });
  }
}

let container: HTMLDivElement;
let root: Root;
const originalOpenPanel = useWorkbenchStore.getState().openPanel;
const originalLibraryActions = {
  captureBlueLiveSoundObject: useLibraryStore.getState().captureBlueLiveSoundObject,
  transferToProject: useLibraryStore.getState().transferToProject,
};
const captureBlueLiveSoundObject = vi.fn().mockResolvedValue(true);
const transferToProject = vi.fn().mockResolvedValue(true);

async function openCellMenu(column: number, row: number): Promise<HTMLElement> {
  const cell = container.querySelector(
    `[data-blue-live-cell][data-column="${column}"][data-row="${row}"]`,
  ) as HTMLElement;
  await act(async () => {
    cell.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      button: 2,
      clientX: 20,
      clientY: 20,
    }));
    await Promise.resolve();
  });
  return document.body.querySelector('[data-blue-live-cell-menu]') as HTMLElement;
}

async function selectMenuItem(label: string): Promise<void> {
  const item = Array.from(document.body.querySelectorAll('[role="menuitem"]'))
    .find((candidate) => candidate.textContent?.trim() === label) as HTMLElement;
  const PointerEventCtor = window.PointerEvent ?? MouseEvent;
  await act(async () => {
    item.dispatchEvent(new PointerEventCtor('pointermove', { bubbles: true }));
    item.dispatchEvent(new PointerEventCtor('pointerdown', { bubbles: true, button: 0 }));
    item.dispatchEvent(new PointerEventCtor('pointerup', { bubbles: true, button: 0 }));
    item.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
    await Promise.resolve();
  });
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  useProjectStore.getState().clearProject();
  useScoreSelectionStore.getState().clearClipboard();
  useScoreSelectionStore.getState().clearSelection();
  useWorkbenchStore.setState({ openPanel: originalOpenPanel });
  captureBlueLiveSoundObject.mockClear();
  transferToProject.mockClear();
  useLibraryStore.setState({
    clipboard: null,
    captureBlueLiveSoundObject,
    transferToProject,
  });
});

afterEach(() => {
  useWorkbenchStore.setState({ openPanel: originalOpenPanel });
  useLibraryStore.setState({ ...originalLibraryActions, clipboard: null });
  act(() => { root.unmount(); });
  container.remove();
});

describe('Blue Live panel tab render tests (T045)', () => {
  it('LiveSpaceTab renders no-project message without project', () => {
    act(() => {
      root.render(<LiveSpaceTab />);
    });
    expect(container.textContent).toContain('No project loaded');
  });

  it('LiveSpaceTab renders grid with project loaded', () => {
    seedProject(makeBlueLiveSnapshot());
    act(() => {
      root.render(<LiveSpaceTab />);
    });
    expect(container.textContent).toContain('Saved Sets');
    expect(container.textContent).toContain('OSC1');
    expect(container.textContent).toContain('FX1');
  });

  it('LiveCodeTab renders no-project message without project', () => {
    act(() => {
      root.render(<LiveCodeTab />);
    });
    expect(container.textContent).toContain('No project loaded');
  });

  it('LiveCodeTab renders editor with project loaded', () => {
    seedProject(makeBlueLiveSnapshot());
    act(() => {
      root.render(<LiveCodeTab />);
    });
    expect(container.textContent).toContain('Live Code');
  });

  it('OptionsTab renders no-project message without project', () => {
    act(() => {
      root.render(<OptionsTab />);
    });
    expect(container.textContent).toContain('No project loaded');
  });

  it('OptionsTab renders form with project loaded', () => {
    seedProject(makeBlueLiveSnapshot());
    act(() => {
      root.render(<OptionsTab />);
    });
    expect(container.textContent).toContain('Command Line');
    expect(container.textContent).toContain('Command Line Enabled');
  });

  it('LiveSpaceTab renders toolbar buttons', () => {
    seedProject(makeBlueLiveSnapshot());
    act(() => {
      root.render(<LiveSpaceTab />);
    });
    const buttons = container.querySelectorAll('button');
    const texts = Array.from(buttons).map((b) => b.textContent);
    expect(texts).toContain('Repeat');
    expect(texts).toContain('Trigger');
  });

  it('LiveSpaceTab renders saved sets', () => {
    seedProject(makeBlueLiveSnapshot());
    act(() => {
      root.render(<LiveSpaceTab />);
    });
    expect(container.textContent).toContain('Set A');
    expect(container.textContent).toContain('Set B');
  });

  it('LiveSpaceTab uses semantic roles for headings, annotations, and cell values', () => {
    seedProject(makeBlueLiveSnapshot());
    act(() => {
      root.render(<LiveSpaceTab />);
    });

    const savedSetsHeading = container.querySelector('[data-blue-live-saved-sets-heading]') as HTMLElement;
    expect(savedSetsHeading.style.fontSize).toBe('var(--text-role-headline)');
    expect(savedSetsHeading.style.lineHeight).toBe('var(--text-role-headline--line-height)');
    expect(savedSetsHeading.style.fontWeight).toBe('700');

    const columnHeaders = Array.from(container.querySelectorAll('[data-blue-live-column-header]')) as HTMLElement[];
    expect(columnHeaders).toHaveLength(3);
    for (const header of columnHeaders) {
      expect(header.style.fontSize).toBe('var(--text-role-headline)');
      expect(header.style.lineHeight).toBe('var(--text-role-headline--line-height)');
      expect(header.style.fontWeight).toBe('700');
    }

    const rowLabels = Array.from(container.querySelectorAll('[data-blue-live-row-label]')) as HTMLElement[];
    expect(rowLabels).toHaveLength(2);
    for (const label of rowLabels) {
      expect(label.style.fontSize).toBe('var(--text-role-subheadline)');
      expect(label.style.lineHeight).toBe('var(--text-role-subheadline--line-height)');
    }

    const cell = container.querySelector(
      '[data-blue-live-cell][data-column="0"][data-row="0"]',
    ) as HTMLElement;
    expect(cell.style.fontSize).toBe('var(--text-role-body)');
    expect(cell.style.lineHeight).toBe('var(--text-role-body--line-height)');
  });

  it('publishes a populated Live cell to the shared editor/properties selection and activates the editor', () => {
    const openPanel = vi.fn();
    useWorkbenchStore.setState({ openPanel });
    seedProject(makeBlueLiveSnapshot());
    act(() => {
      root.render(<LiveSpaceTab />);
    });

    const cell = container.querySelector(
      '[data-blue-live-cell][data-column="0"][data-row="0"]',
    ) as HTMLElement;
    act(() => {
      cell.click();
    });

    expect(useScoreSelectionStore.getState().selectedObjectIds).toEqual(new Set(['obj1']));
    expect(useScoreSelectionStore.getState().selectedObjectTarget).toMatchObject({
      selectionId: 'obj1',
      selectedObjectType: 'GenericScore',
      editorObjectType: 'GenericScore',
      ownerKind: 'blueLive',
      displayContext: 'blueLive',
      blueLive: {
        liveObjectId: 'obj1',
        column: 0,
        row: 0,
      },
    });
    expect(openPanel).toHaveBeenCalledWith('ScoreObjectEditorTopComponent');
    expect(openPanel).not.toHaveBeenCalledWith('SoundObjectPropertiesTopComponent');
  });

  it('clears the shared editor/properties selection when an empty Live cell is selected', () => {
    const openPanel = vi.fn();
    useWorkbenchStore.setState({ openPanel });
    seedProject(makeBlueLiveSnapshot());
    useScoreSelectionStore.getState().select('prior-score-object', false);
    act(() => {
      root.render(<LiveSpaceTab />);
    });

    const emptyCell = container.querySelector(
      '[data-blue-live-cell][data-column="1"][data-row="0"]',
    ) as HTMLElement;
    act(() => {
      emptyCell.click();
    });

    expect(useScoreSelectionStore.getState().selectedObjectIds.size).toBe(0);
    expect(useScoreSelectionStore.getState().selectedObjectTarget).toBeNull();
    expect(openPanel).not.toHaveBeenCalled();
  });

  it('LiveSpaceTab omits the non-Java row/column button strip', () => {
    seedProject(makeBlueLiveSnapshot());
    act(() => {
      root.render(<LiveSpaceTab />);
    });
    expect(container.textContent).not.toContain('+Row Top');
    expect(container.textContent).not.toContain('+Row Bottom');
    expect(container.textContent).not.toContain('−Row');
    expect(container.textContent).not.toContain('+Col Left');
    expect(container.textContent).not.toContain('+Col Right');
    expect(container.textContent).not.toContain('−Col');
  });

  it('opens the Java-ordered cell context menu on the right-clicked cell', async () => {
    seedProject(makeBlueLiveSnapshot());
    act(() => {
      root.render(<LiveSpaceTab />);
    });
    const menu = await openCellMenu(1, 0);
    expect(menu).not.toBeNull();
    const labels = Array.from(menu.querySelectorAll('[role="menuitem"]'))
      .map((item) => item.textContent?.trim());
    expect(labels).toEqual([
      'Add SoundObject',
      'Remove',
      'Cut',
      'Copy',
      'Paste',
      'Insert Row Before',
      'Insert Row After',
      'Remove Row',
      'Insert Column Before',
      'Insert Column After',
      'Remove Column',
    ]);
    expect(menu.querySelectorAll('[role="separator"]')).toHaveLength(3);
    expect(menu.textContent).not.toContain('+Row Top');
    const byLabel = (label: string) => Array.from(menu.querySelectorAll('[role="menuitem"]'))
      .find((item) => item.textContent?.trim() === label);
    expect(byLabel('Remove')?.hasAttribute('data-disabled')).toBe(true);
    expect(byLabel('Cut')?.hasAttribute('data-disabled')).toBe(true);
    expect(byLabel('Copy')?.hasAttribute('data-disabled')).toBe(true);
    expect(byLabel('Paste')?.hasAttribute('data-disabled')).toBe(true);
    expect(byLabel('Remove Row')?.hasAttribute('data-disabled')).toBe(false);
    expect(byLabel('Remove Column')?.hasAttribute('data-disabled')).toBe(false);
  });

  it('disables removal of the final row and column', async () => {
    const snapshot = makeBlueLiveSnapshot();
    snapshot.bins = { rows: 1, columns: 1, cells: [[null]] };
    seedProject(snapshot);
    act(() => {
      root.render(<LiveSpaceTab />);
    });
    const menu = await openCellMenu(0, 0);
    const byLabel = (label: string) => Array.from(menu.querySelectorAll('[role="menuitem"]'))
      .find((item) => item.textContent?.trim() === label);
    expect(byLabel('Remove Row')?.hasAttribute('data-disabled')).toBe(true);
    expect(byLabel('Remove Column')?.hasAttribute('data-disabled')).toBe(true);
  });

  it('uses the shared ScoreObject clipboard for Live Space copy and paste eligibility', async () => {
    seedProject(makeBlueLiveSnapshot());
    useScoreSelectionStore.getState().copySelected([{
      objectId: 'score-copy',
      objectType: 'GenericScore',
      name: 'Score phrase',
      startBeats: 4,
      durationBeats: 2,
      backgroundColor: -1,
      isContainer: false,
      layerIndex: 0,
      groupId: 'score-root',
      serializedXml: new GenericScore().saveAsXML().toXml(),
    }]);
    act(() => {
      root.render(<LiveSpaceTab />);
    });
    await openCellMenu(1, 0);
    const paste = Array.from(document.body.querySelectorAll('[role="menuitem"]'))
      .find((item) => item.textContent?.trim() === 'Paste');
    expect(paste?.hasAttribute('data-disabled')).toBe(false);
    await selectMenuItem('Paste');

    const pasted = useProjectStore.getState().blueLive!.bins.cells[1]![0]!;
    expect(pasted).not.toBeNull();
    expect(pasted.uniqueId).not.toBe('score-copy');
    expect(pasted.soundObjectType).toBe('GenericScore');
    expect(pasted.startBeats).toBe(0);
  });

  it('disables Live Space Paste for multi-object and unsupported Score buffers', async () => {
    seedProject(makeBlueLiveSnapshot());
    const compatible = {
      objectId: 'score-copy',
      objectType: 'GenericScore',
      name: 'Score phrase',
      startBeats: 0,
      durationBeats: 1,
      backgroundColor: -1,
      isContainer: false,
      layerIndex: 0,
      groupId: 'score-root',
      serializedXml: new GenericScore().saveAsXML().toXml(),
    };
    useScoreSelectionStore.getState().copySelected([
      compatible,
      { ...compatible, objectId: 'score-copy-2' },
    ]);
    act(() => {
      root.render(<LiveSpaceTab />);
    });

    let menu = await openCellMenu(1, 0);
    let paste = Array.from(menu.querySelectorAll('[role="menuitem"]'))
      .find((item) => item.textContent?.trim() === 'Paste');
    expect(paste?.hasAttribute('data-disabled')).toBe(true);

    useScoreSelectionStore.getState().copySelected([{
      ...compatible,
      objectId: 'unsupported',
      objectType: 'Sound',
    }]);
    await act(async () => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await Promise.resolve();
    });
    menu = await openCellMenu(1, 0);
    paste = Array.from(menu.querySelectorAll('[role="menuitem"]'))
      .find((item) => item.textContent?.trim() === 'Paste');
    expect(paste?.hasAttribute('data-disabled')).toBe(true);
  });

  it('applies row and column commands relative to the right-clicked cell', async () => {
    seedProject(makeBlueLiveSnapshot());
    act(() => {
      root.render(<LiveSpaceTab />);
    });

    await openCellMenu(1, 1);
    await selectMenuItem('Insert Row Before');
    let bins = useProjectStore.getState().blueLive!.bins;
    expect(bins.rows).toBe(3);
    expect(bins.cells[1]![1]).toBeNull();
    expect(bins.cells[1]![2]?.uniqueId).toBe('obj3');

    await openCellMenu(1, 1);
    await selectMenuItem('Insert Column After');
    bins = useProjectStore.getState().blueLive!.bins;
    expect(bins.columns).toBe(4);
    expect(bins.cells[2]).toEqual([null, null, null]);
    expect(bins.cells[3]![0]?.uniqueId).toBe('obj4');
  });

  it('copies a Live Space SoundObject into the shared Score and Library buffers', async () => {
    seedProject(makeBlueLiveSnapshot());
    act(() => {
      root.render(<LiveSpaceTab />);
    });

    await openCellMenu(0, 0);
    await selectMenuItem('Copy');

    expect(useScoreSelectionStore.getState().clipboard).toEqual([
      expect.objectContaining({
        objectId: 'obj1',
        objectType: 'GenericScore',
        groupId: 'blue-live',
        serializedXml: expect.stringContaining('GenericScore'),
      }),
    ]);
    expect(captureBlueLiveSoundObject).toHaveBeenCalledWith({
      projectSessionId: useProjectStore.getState().sessionId,
      projectRevision: expect.any(Number),
      liveObjectId: 'obj1',
    });
  });

  it('leaves the Live Space cell and prior Score buffer unchanged when portable capture fails', async () => {
    seedProject(makeBlueLiveSnapshot());
    captureBlueLiveSoundObject.mockResolvedValueOnce(false);
    act(() => {
      root.render(<LiveSpaceTab />);
    });

    await openCellMenu(0, 0);
    await selectMenuItem('Cut');

    expect(useProjectStore.getState().blueLive!.bins.cells[0]?.[0]?.uniqueId).toBe('obj1');
    expect(useScoreSelectionStore.getState().clipboard).toEqual([]);
  });

  it('pastes the shared Library SoundObject buffer into an exact Blue Live cell', async () => {
    seedProject(makeBlueLiveSnapshot());
    useLibraryStore.setState({
      clipboard: {
        operation: 'copy',
        source: {
          kind: 'userNode',
          libraryType: 'soundObject',
          nodeId: 'library-sound',
          revision: 4,
        },
        capturedAt: 1,
      },
    });
    act(() => root.render(<LiveSpaceTab />));

    await openCellMenu(1, 0);
    await selectMenuItem('Paste');
    expect(transferToProject).toHaveBeenCalledWith(
      { kind: 'clipboard', source: expect.objectContaining({ nodeId: 'library-sound' }) },
      {
        kind: 'blueLive',
        projectSessionId: useProjectStore.getState().sessionId,
        projectRevision: expect.any(Number),
        liveCell: { column: 1, row: 0, expectedLiveObjectId: null },
      },
    );
  });
});

describe('Live Space grid action tests (T046)', () => {
  it('setCellEnabled patch toggles enabled on a cell', () => {
    seedProject(makeBlueLiveSnapshot());
    const before = useProjectStore.getState().blueLive!;
    expect(before.bins.cells[0][0]!.enabled).toBe(true);

    useProjectStore.getState().applyBlueLivePatch({ type: 'setCellEnabled', column: 0, row: 0, enabled: false });

    const after = useProjectStore.getState().blueLive!;
    expect(after.bins.cells[0][0]!.enabled).toBe(false);
  });

  it('insertRow adds a row of null cells', () => {
    seedProject(makeBlueLiveSnapshot());
    const before = useProjectStore.getState().blueLive!;
    expect(before.bins.rows).toBe(2);

    useProjectStore.getState().applyBlueLivePatch({ type: 'insertRow', index: 0 });

    const after = useProjectStore.getState().blueLive!;
    expect(after.bins.rows).toBe(3);
    expect(after.bins.cells[0].length).toBe(3);
  });

  it('removeRow removes the last row', () => {
    seedProject(makeBlueLiveSnapshot());
    useProjectStore.getState().applyBlueLivePatch({ type: 'removeRow', index: 1 });

    const after = useProjectStore.getState().blueLive!;
    expect(after.bins.rows).toBe(1);
  });

  it('insertColumn adds a column of null cells', () => {
    seedProject(makeBlueLiveSnapshot());
    const before = useProjectStore.getState().blueLive!;
    expect(before.bins.columns).toBe(3);

    useProjectStore.getState().applyBlueLivePatch({ type: 'insertColumn', index: 0 });

    const after = useProjectStore.getState().blueLive!;
    expect(after.bins.columns).toBe(4);
  });

  it('removeColumn removes the last column', () => {
    seedProject(makeBlueLiveSnapshot());
    useProjectStore.getState().applyBlueLivePatch({ type: 'removeColumn', index: 2 });

    const after = useProjectStore.getState().blueLive!;
    expect(after.bins.columns).toBe(2);
  });

  it('moveSet reorders saved sets', () => {
    seedProject(makeBlueLiveSnapshot());
    useProjectStore.getState().applyBlueLivePatch({ type: 'moveSet', from: 0, to: 1 });

    const after = useProjectStore.getState().blueLive!;
    expect(after.sets[0].name).toBe('Set B');
    expect(after.sets[1].name).toBe('Set A');
  });

  it('removeSet removes a saved set', () => {
    seedProject(makeBlueLiveSnapshot());
    useProjectStore.getState().applyBlueLivePatch({ type: 'removeSet', index: 0 });

    const after = useProjectStore.getState().blueLive!;
    expect(after.sets).toHaveLength(1);
    expect(after.sets[0].name).toBe('Set B');
  });
});

describe('Live Code editor persistence tests (T047)', () => {
  it('updateLiveCodeText patch persists to store', () => {
    seedProject(makeBlueLiveSnapshot());
    useProjectStore.getState().applyBlueLivePatch({ type: 'updateLiveCodeText', text: 'instr 1\n  out aSignal\nendin' });

    const after = useProjectStore.getState().blueLive!;
    expect(after.liveCodeText).toBe('instr 1\n  out aSignal\nendin');
  });

  it('updateLiveCodeText with empty string', () => {
    seedProject(makeBlueLiveSnapshot());
    useProjectStore.getState().applyBlueLivePatch({ type: 'updateLiveCodeText', text: '' });

    const after = useProjectStore.getState().blueLive!;
    expect(after.liveCodeText).toBe('');
  });
});

describe('Options tab patch tests (T048)', () => {
  it('updateOptions patch for commandLine', () => {
    seedProject(makeBlueLiveSnapshot());
    useProjectStore.getState().applyBlueLivePatch({ type: 'updateOptions', patch: { commandLine: '-b512' } });

    const after = useProjectStore.getState().blueLive!;
    expect(after.commandLine).toBe('-b512');
  });

  it('updateOptions patch for commandLineEnabled', () => {
    seedProject(makeBlueLiveSnapshot());
    useProjectStore.getState().applyBlueLivePatch({ type: 'updateOptions', patch: { commandLineEnabled: true } });

    const after = useProjectStore.getState().blueLive!;
    expect(after.commandLineEnabled).toBe(true);
  });

  it('updateOptions patch for commandLineOverride', () => {
    seedProject(makeBlueLiveSnapshot());
    useProjectStore.getState().applyBlueLivePatch({ type: 'updateOptions', patch: { commandLineOverride: true } });

    const after = useProjectStore.getState().blueLive!;
    expect(after.commandLineOverride).toBe(true);
  });

  it('updateTempoRepeat patch for tempo', () => {
    seedProject(makeBlueLiveSnapshot());
    useProjectStore.getState().applyBlueLivePatch({ type: 'updateTempoRepeat', patch: { tempo: 140 } });

    const after = useProjectStore.getState().blueLive!;
    expect(after.tempo).toBe(140);
  });

  it('updateTempoRepeat patch for repeat', () => {
    seedProject(makeBlueLiveSnapshot());
    useProjectStore.getState().applyBlueLivePatch({ type: 'updateTempoRepeat', patch: { repeat: 8 } });

    const after = useProjectStore.getState().blueLive!;
    expect(after.repeat).toBe(8);
  });

  it('updateTempoRepeat patch for repeatEnabled', () => {
    seedProject(makeBlueLiveSnapshot());
    useProjectStore.getState().applyBlueLivePatch({ type: 'updateTempoRepeat', patch: { repeatEnabled: true } });

    const after = useProjectStore.getState().blueLive!;
    expect(after.repeatEnabled).toBe(true);
  });
});

describe('Blue Live trigger routing tests (T049)', () => {
  it('waits for pending edits before Trigger and aborts when acknowledgement fails', async () => {
    const triggerSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 'submitted',
      targetCount: 2,
      noteCount: 2,
      documentRevision: 0,
      blueLiveSessionId: 1,
    });
    (window as unknown as { blueAPI: unknown }).blueAPI = {
      triggerBlueLiveObjects: triggerSpy,
    };
    seedProject(makeBlueLiveSnapshot());
    let acknowledge = (): void => {};
    const flushPendingPatches = vi.fn(() => new Promise<void>((resolve) => {
      acknowledge = resolve;
    }));
    useProjectStore.setState({
      flushPendingPatches,
    } as unknown as Partial<ReturnType<typeof useProjectStore.getState>>);
    const { useBlueLiveStore } = await import('../stores/blue-live-store');
    useBlueLiveStore.setState({ running: true, status: 'running' });

    act(() => {
      root.render(<LiveSpaceTab />);
    });
    const triggerButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent === 'Trigger');

    act(() => {
      triggerButton?.click();
    });
    expect(flushPendingPatches).toHaveBeenCalledOnce();
    expect(triggerSpy).not.toHaveBeenCalled();

    acknowledge();
    await vi.waitFor(() => {
      expect(triggerSpy).toHaveBeenCalledWith({ mode: 'enabled' });
    });

    flushPendingPatches.mockRejectedValueOnce(new Error('commit failed'));
    triggerSpy.mockClear();
    await act(async () => {
      triggerButton?.click();
      await Promise.resolve();
    });
    expect(triggerSpy).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Could not apply pending edits before trigger');
  });

  it('Trigger button invokes enabled-batch trigger when Blue Live is running', async () => {
    const triggerSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 'submitted',
      targetCount: 2,
      noteCount: 2,
      documentRevision: 0,
      blueLiveSessionId: 1,
    });
    (window as unknown as { blueAPI: unknown }).blueAPI = {
      triggerBlueLiveObjects: triggerSpy,
    };
    seedProject(makeBlueLiveSnapshot());
    useProjectStore.setState({
      flushPendingPatches: vi.fn().mockResolvedValue(undefined),
    } as unknown as Partial<ReturnType<typeof useProjectStore.getState>>);

    // Mark Blue Live as running so the trigger button is enabled.
    const { useBlueLiveStore } = await import('../stores/blue-live-store');
    useBlueLiveStore.setState({ running: true, status: 'running' });

    act(() => {
      root.render(<LiveSpaceTab />);
    });

    const buttons = container.querySelectorAll('button');
    const triggerBtn = Array.from(buttons).find((b) => b.textContent === 'Trigger');
    expect(triggerBtn).toBeTruthy();
    expect((triggerBtn as HTMLButtonElement).disabled).toBe(false);

    await act(async () => {
      triggerBtn!.click();
    });
    await vi.waitFor(() => {
      expect(triggerSpy).toHaveBeenCalledWith({ mode: 'enabled' });
    });
  });

  it('Trigger button is disabled when Blue Live is not running', async () => {
    const { useBlueLiveStore } = await import('../stores/blue-live-store');
    useBlueLiveStore.setState({ running: false, status: 'idle' });
    seedProject(makeBlueLiveSnapshot());
    // Blue Live is not running by default (status idle).

    act(() => {
      root.render(<LiveSpaceTab />);
    });

    const buttons = container.querySelectorAll('button');
    const triggerBtn = Array.from(buttons).find((b) => b.textContent === 'Trigger');
    expect(triggerBtn).toBeTruthy();
    expect((triggerBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('Trigger Selected button is disabled when no populated cell is selected', async () => {
    const { useBlueLiveStore } = await import('../stores/blue-live-store');
    useBlueLiveStore.setState({ running: false, status: 'idle' });
    seedProject(makeBlueLiveSnapshot());

    act(() => {
      root.render(<LiveSpaceTab />);
    });

    const buttons = container.querySelectorAll('button');
    const selectedBtn = Array.from(buttons).find((b) => b.textContent === 'Trigger Selected');
    expect(selectedBtn).toBeTruthy();
    expect((selectedBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('scopes trigger shortcuts to the focused Live Space and ignores editors', async () => {
    const triggerSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 'submitted',
      targetCount: 1,
      noteCount: 1,
      documentRevision: 0,
      blueLiveSessionId: 1,
    });
    (window as unknown as { blueAPI: unknown }).blueAPI = {
      triggerBlueLiveObjects: triggerSpy,
    };
    seedProject(makeBlueLiveSnapshot());
    useProjectStore.setState({
      flushPendingPatches: vi.fn().mockResolvedValue(undefined),
    } as unknown as Partial<ReturnType<typeof useProjectStore.getState>>);

    const { useBlueLiveStore } = await import('../stores/blue-live-store');
    useBlueLiveStore.setState({ running: true, status: 'running' });

    act(() => {
      root.render(<LiveSpaceTab />);
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', {
        key: 't',
        ctrlKey: true,
        bubbles: true,
      }));
    });
    expect(triggerSpy).not.toHaveBeenCalled();

    const selectedCell = Array.from(container.querySelectorAll('div'))
      .find((element) => element.textContent === 'OSC1');
    expect(selectedCell).toBeTruthy();
    act(() => {
      selectedCell!.click();
    });
    expect(document.activeElement).toBe(container.querySelector('[data-blue-live-space-root]'));

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', {
        key: 't',
        ctrlKey: true,
        bubbles: true,
      }));
    });
    await vi.waitFor(() => {
      expect(triggerSpy).toHaveBeenCalledWith({ mode: 'selected', liveObjectId: 'obj1' });
    });

    triggerSpy.mockClear();
    const tempoInput = container.querySelector('input[type="number"]') as HTMLInputElement;
    tempoInput.focus();
    act(() => {
      tempoInput.dispatchEvent(new KeyboardEvent('keydown', {
        key: 't',
        ctrlKey: true,
        bubbles: true,
      }));
    });
    expect(triggerSpy).not.toHaveBeenCalled();
  });

  it('surfaces transient error feedback when the trigger fails', async () => {
    const triggerSpy = vi.fn().mockResolvedValue({
      ok: false,
      status: 'failed',
      code: 'engine-rejected',
      message: 'engine down',
      targetCount: 0,
      noteCount: 0,
      documentRevision: 0,
      blueLiveSessionId: 1,
    });
    (window as unknown as { blueAPI: unknown }).blueAPI = {
      triggerBlueLiveObjects: triggerSpy,
    };
    seedProject(makeBlueLiveSnapshot());
    useProjectStore.setState({
      flushPendingPatches: vi.fn().mockResolvedValue(undefined),
    } as unknown as Partial<ReturnType<typeof useProjectStore.getState>>);

    const { useBlueLiveStore } = await import('../stores/blue-live-store');
    useBlueLiveStore.setState({ running: true, status: 'running' });

    act(() => {
      root.render(<LiveSpaceTab />);
    });

    const buttons = container.querySelectorAll('button');
    const triggerBtn = Array.from(buttons).find((b) => b.textContent === 'Trigger');
    await act(async () => {
      triggerBtn!.click();
    });
    await vi.waitFor(() => {
      expect(container.textContent).toContain('engine down');
    });
  });
});
