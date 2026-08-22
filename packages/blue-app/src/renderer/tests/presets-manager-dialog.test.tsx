// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  BlueSynthBuilderInstrumentSnapshot,
  PresetGroupSnapshot,
} from '../../shared/project-editor';
import PresetsManagerDialog, {
  buildPresetTree,
} from '../components/workbench/panels/orchestra/bsb/PresetsManagerDialog';
import { applyBsbInterfacePatchToSnapshot } from '../stores/project-store';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function createPresetGroup(): PresetGroupSnapshot {
  return {
    name: 'Presets',
    currentPresetUniqueId: 'preset-b',
    currentPresetModified: false,
    subGroups: [
      {
        name: 'Nested',
        currentPresetModified: false,
        subGroups: [],
        presets: [{ uniqueId: 'preset-c', name: 'C' }],
      },
    ],
    presets: [
      { uniqueId: 'preset-a', name: 'A' },
      { uniqueId: 'preset-b', name: 'B' },
    ],
  };
}

function createInstrument(): BlueSynthBuilderInstrumentSnapshot {
  return {
    assignmentId: '1',
    type: 'blueSynthBuilder',
    name: 'Test BSB',
    enabled: true,
    comment: '',
    instrumentText: '',
    alwaysOnInstrumentText: '',
    globalOrc: '',
    globalSco: '',
    objectNames: [],
    widgets: [],
    editEnabled: true,
    gridSettings: {
      enabled: true,
      snapEnabled: true,
      width: 10,
      height: 10,
      gridStyle: 'NONE',
    },
    widgetTree: {
      id: 'root',
      type: 'BSBRootGroup',
      objectName: '',
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      value: 0,
      minimum: 0,
      maximum: 1,
      editable: true,
      properties: {},
      children: [],
    },
    presetGroup: createPresetGroup(),
  };
}

function findTreeRow(container: HTMLDivElement, label: string): HTMLDivElement | undefined {
  return Array.from(container.querySelectorAll<HTMLDivElement>('.cursor-pointer'))
    .find((row) => row.textContent?.trim() === label);
}

async function openContextMenu(row: HTMLDivElement): Promise<void> {
  await act(async () => {
    row.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      button: 2,
    }));
    await Promise.resolve();
  });
}

function findMenuItem(label: string): HTMLElement | undefined {
  return Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')).reverse()
    .find((item) => item.textContent?.trim() === label);
}

describe('PresetsManagerDialog', () => {
  let container: HTMLDivElement | undefined;
  let root: Root | undefined;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    root = undefined;
    container = undefined;
  });

  it('builds a stable group-first tree with numeric group paths', () => {
    const tree = buildPresetTree(createPresetGroup());

    expect(tree.id).toBe('group:root');
    expect(tree.children?.map((node) => node.name)).toEqual([
      'Nested',
      'A',
      'B',
    ]);
    expect(tree.children?.[0]).toMatchObject({
      id: 'group:0',
      kind: 'group',
      groupPath: [0],
    });
    expect(tree.children?.[2]).toMatchObject({
      id: 'preset:preset-b',
      kind: 'preset',
      groupPath: [],
      presetUniqueId: 'preset-b',
    });
  });

  it('applies optimistic reorder, rename, and delete mutations', () => {
    const instrument = createInstrument();

    applyBsbInterfacePatchToSnapshot(instrument, {
      type: 'movePreset',
      presetUniqueId: 'preset-a',
      parentGroupPath: [],
      targetIndex: 3,
    });
    expect(
      instrument.presetGroup?.presets.map((preset) => preset.uniqueId),
    ).toEqual(['preset-b', 'preset-a']);

    applyBsbInterfacePatchToSnapshot(instrument, {
      type: 'renamePresetGroup',
      groupPath: [0],
      name: 'Renamed',
    });
    expect(instrument.presetGroup?.subGroups[0]?.name).toBe('Renamed');

    applyBsbInterfacePatchToSnapshot(instrument, {
      type: 'removePreset',
      presetUniqueId: 'preset-b',
    });
    expect(instrument.presetGroup?.currentPresetUniqueId).toBeUndefined();
    expect(instrument.presetGroup?.currentPresetModified).toBe(false);
  });

  it('renders an accessible modal and closes on Escape', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    const onClose = vi.fn<() => void>();
    const onPatch = vi.fn();

    act(() => {
      root?.render(
        <PresetsManagerDialog
          presetGroup={createPresetGroup()}
          onBsbInterfacePatch={onPatch}
          onClose={onClose}
        />,
      );
    });

    expect(container.querySelector('[role="dialog"]')).toBeTruthy();
    expect(container.querySelector('h2')?.textContent).toBe('Presets Manager');
    expect(container.textContent).toContain('Nested');
    expect(container.textContent).toContain('Delete key removes');

    const presetRow = Array.from(container.querySelectorAll('.cursor-pointer'))
      .find((row) => row.textContent?.trim() === 'B') as HTMLDivElement | undefined;
    expect(presetRow).toBeTruthy();
    act(() => {
      presetRow?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });
    const renameInput = container.querySelector('input[type="text"]') as HTMLInputElement | null;
    expect(renameInput).toBeTruthy();
    if (renameInput) {
      renameInput.value = 'Bravo';
      act(() => {
        renameInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      });
    }
    expect(onPatch).toHaveBeenCalledWith({
      type: 'renamePreset',
      presetUniqueId: 'preset-b',
      name: 'Bravo',
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows Java Blue context menu actions with target-specific disabled states', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        <PresetsManagerDialog
          presetGroup={createPresetGroup()}
          onBsbInterfacePatch={vi.fn()}
          onClose={vi.fn()}
        />,
      );
    });

    const rootRow = findTreeRow(container, 'Presets');
    expect(rootRow).toBeTruthy();
    if (!rootRow) return;
    await openContextMenu(rootRow);

    expect(Array.from(document.body.querySelectorAll('[role="menuitem"]')).map((item) => item.textContent?.trim())).toEqual(
      expect.arrayContaining([
        'Remove',
        'Cut',
        'Copy',
        'Paste',
        'Import',
        'Export',
        'Add Folder',
        'Rename',
      ]),
    );
    expect(findMenuItem('Remove')?.getAttribute('data-disabled')).not.toBeNull();
    expect(findMenuItem('Cut')?.getAttribute('data-disabled')).not.toBeNull();
    expect(findMenuItem('Copy')?.getAttribute('data-disabled')).toBeNull();
    expect(findMenuItem('Paste')?.getAttribute('data-disabled')).not.toBeNull();
    expect(findMenuItem('Import')?.getAttribute('data-disabled')).toBeNull();
    expect(findMenuItem('Export')?.getAttribute('data-disabled')).toBeNull();
    expect(findMenuItem('Add Folder')?.getAttribute('data-disabled')).toBeNull();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    const presetRow = findTreeRow(container, 'B');
    expect(presetRow).toBeTruthy();
    if (!presetRow) return;
    await openContextMenu(presetRow);

    expect(findMenuItem('Remove')?.getAttribute('data-disabled')).toBeNull();
    expect(findMenuItem('Cut')?.getAttribute('data-disabled')).toBeNull();
    expect(findMenuItem('Copy')?.getAttribute('data-disabled')).toBeNull();
    expect(findMenuItem('Paste')?.getAttribute('data-disabled')).not.toBeNull();
    expect(findMenuItem('Import')?.getAttribute('data-disabled')).not.toBeNull();
    expect(findMenuItem('Export')?.getAttribute('data-disabled')).toBeNull();
    expect(findMenuItem('Add Folder')?.getAttribute('data-disabled')).not.toBeNull();
  });

  it('imports and exports preset XML through the Electron file bridge', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    const onPatch = vi.fn();
    const importPresetFile = vi.fn<() => Promise<string | null>>().mockResolvedValue(
      '<preset name="Imported" uniqueId="source"><setting name="cutoff">0.5</setting></preset>',
    );
    const exportPresetFile = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    window.blueAPI = {
      ...window.blueAPI,
      importPresetFile,
      exportPresetFile,
    } as Window['blueAPI'];

    act(() => {
      root?.render(
        <PresetsManagerDialog
          presetGroup={createPresetGroup()}
          onBsbInterfacePatch={onPatch}
          onClose={vi.fn()}
        />,
      );
    });

    const nestedRow = findTreeRow(container, 'Nested');
    expect(nestedRow).toBeTruthy();
    if (!nestedRow) return;
    await openContextMenu(nestedRow);
    await act(async () => {
      findMenuItem('Import')?.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(importPresetFile).toHaveBeenCalledTimes(1);
    expect(onPatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'addPresetFromSnapshot',
      parentGroupPath: [0],
      preset: expect.objectContaining({
        name: 'Imported',
        values: { cutoff: '0.5' },
      }),
    }));

    const rootRow = findTreeRow(container, 'Presets');
    expect(rootRow).toBeTruthy();
    if (!rootRow) return;
    await openContextMenu(rootRow);
    await act(async () => {
      findMenuItem('Export')?.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(exportPresetFile).toHaveBeenCalledWith(
      expect.stringContaining('<presetGroup'),
      'Presets',
    );
  });

  it('copies, pastes, and adds folders through the context menu', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    const onPatch = vi.fn();

    act(() => {
      root?.render(
        <PresetsManagerDialog
          presetGroup={createPresetGroup()}
          onBsbInterfacePatch={onPatch}
          onClose={vi.fn()}
        />,
      );
    });

    const presetRow = findTreeRow(container, 'B');
    expect(presetRow).toBeTruthy();
    if (!presetRow) return;
    await openContextMenu(presetRow);
    act(() => findMenuItem('Copy')?.click());

    const nestedRow = findTreeRow(container, 'Nested');
    expect(nestedRow).toBeTruthy();
    if (!nestedRow) return;
    await openContextMenu(nestedRow);
    expect(findMenuItem('Paste')?.getAttribute('data-disabled')).toBeNull();
    act(() => findMenuItem('Paste')?.click());

    expect(onPatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'addPresetFromSnapshot',
      parentGroupPath: [0],
      preset: expect.objectContaining({ name: 'B' }),
    }));

    await openContextMenu(nestedRow);
    act(() => findMenuItem('Add Folder')?.click());
    expect(onPatch).toHaveBeenLastCalledWith({
      type: 'addPresetGroup',
      groupName: 'New Folder',
      parentGroupPath: [0],
    });
  });

  it('confirms preset removal with explicit Delete button and preserves on Cancel', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    const onPatch = vi.fn();

    act(() => {
      root?.render(
        <PresetsManagerDialog
          presetGroup={createPresetGroup()}
          onBsbInterfacePatch={onPatch}
          onClose={vi.fn()}
        />,
      );
    });

    const presetRow = findTreeRow(container, 'B');
    expect(presetRow).toBeTruthy();
    if (!presetRow) return;
    await openContextMenu(presetRow);

    // Click Remove in context menu -> opens ConfirmationDialog
    await act(async () => {
      findMenuItem('Remove')?.click();
      await Promise.resolve();
    });

    const dialog = document.body.querySelector('[role="alertdialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog?.textContent).toContain('Delete Preset “B”?');

    // Cancel first
    const cancelButton = dialog?.querySelector<HTMLButtonElement>('[data-action-id="cancel"]');
    expect(cancelButton).toBeTruthy();
    act(() => {
      cancelButton?.click();
    });
    expect(document.body.querySelector('[role="alertdialog"]')).toBeNull();
    expect(onPatch).not.toHaveBeenCalled();

    // Open again and confirm
    await openContextMenu(presetRow);
    await act(async () => {
      findMenuItem('Remove')?.click();
      await Promise.resolve();
    });

    const confirmDialog = document.body.querySelector('[role="alertdialog"]');
    const deleteButton = confirmDialog?.querySelector<HTMLButtonElement>('[data-action-id="delete"]');
    expect(deleteButton).toBeTruthy();
    act(() => {
      deleteButton?.click();
    });

    expect(document.body.querySelector('[role="alertdialog"]')).toBeNull();
    expect(onPatch).toHaveBeenCalledWith({
      type: 'removePreset',
      presetUniqueId: 'preset-b',
    });
  });
});
