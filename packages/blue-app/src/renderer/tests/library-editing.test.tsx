// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import type { LibraryEditorSessionSnapshot } from '../../shared/unified-library';
import { LibraryBreadcrumbs } from '../components/libraries/LibraryBreadcrumbs';
import { LibraryEditorToolbar } from '../components/libraries/LibraryEditorToolbar';
import { LibrarySessionDialog } from '../components/libraries/LibrarySessionDialog';
import { LibraryControlledEditor } from '../components/libraries/editor-registry';
import { validateLibraryNodeName } from '../components/libraries/LibraryTree';
import { LibraryTree } from '../components/libraries/LibraryTree';
import { LibraryBlockDropMarker } from '../components/libraries/LibraryDropMarker';
import { BLUE_LIBRARY_DRAG_MIME } from '../components/libraries/library-drag-drop';
import { useLibraryStore } from '../stores/library-store';
import { createTestDataTransfer, dispatchContextMenuKey, dispatchDragEvent } from './library-interaction-test-helpers';
import { instrumentDocument } from './library-editor-fixtures';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const session: LibraryEditorSessionSnapshot = {
  sessionId: 'session-1',
  key: { scope: 'user', libraryType: 'instrument', nodeId: 'node-1' },
  displayName: 'Warm Pad',
  objectType: 'GenericInstrument',
  breadcrumb: ['Instruments', 'Pads', 'Warm Pad'],
  baseRevision: 2,
  document: instrumentDocument,
  dirty: true,
  pinned: true,
  status: 'ready',
};

describe('library editing UI', () => {
  it('validates names and renders accessible breadcrumbs', () => {
    expect(validateLibraryNodeName('')).toMatch(/required/i);
    expect(validateLibraryNodeName('  Pad  ')).toBeNull();
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => root.render(<LibraryBreadcrumbs parts={session.breadcrumb} />));
    expect(container.querySelector('nav')?.getAttribute('aria-label')).toBe('Library location');
    expect(container.textContent).toContain('Pads');
    act(() => root.unmount());
  });

  it('renders the native Instrument editor without exposing a supported-item XML textarea', () => {
    const onPatch = vi.fn();
    const onSave = vi.fn();
    const onRevert = vi.fn();
    const onResolveConflict = vi.fn();
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => root.render(<>
      <LibraryEditorToolbar session={session} onSave={onSave} onRevert={onRevert} onResolveConflict={onResolveConflict} />
      <LibraryControlledEditor session={session} onPatch={onPatch} />
    </>));
    expect(container.querySelector('[aria-label="Instrument editor"]')).toBeTruthy();
    expect(container.textContent).not.toContain('Instrument XML');
    const buttons = [...container.querySelectorAll('button')];
    act(() => buttons.find((button) => button.textContent === 'Save')?.click());
    act(() => buttons.find((button) => button.textContent === 'Revert')?.click());
    expect(onSave).toHaveBeenCalledOnce();
    expect(onRevert).toHaveBeenCalledOnce();
    act(() => root.unmount());
  });

  it('offers reload, overwrite, and cancel as explicit conflict choices', () => {
    const onReload = vi.fn();
    const onOverwrite = vi.fn();
    const onCancel = vi.fn();
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => root.render(
      <LibrarySessionDialog
        title="Library item changed"
        message="Choose a conflict resolution."
        primaryLabel="Reload latest"
        secondaryLabel="Overwrite latest"
        onPrimary={onReload}
        onSecondary={onOverwrite}
        onCancel={onCancel}
      />,
    ));
    for (const label of ['Reload latest', 'Overwrite latest', 'Cancel']) {
      act(() => [...container.querySelectorAll('button')].find((button) => button.textContent === label)?.click());
    }
    expect(onReload).toHaveBeenCalledOnce();
    expect(onOverwrite).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
    act(() => root.unmount());
  });

  it('uses name-only inline rename and mouse/keyboard contextual commands without row buttons', async () => {
    const node = {
      key: { scope: 'user' as const, libraryType: 'instrument' as const, nodeId: 'node-1' },
      nodeId: 'node-1', parentId: 'root', libraryType: 'instrument' as const, scope: 'user' as const,
      nodeKind: 'item' as const, displayName: 'Warm Pad', breadcrumb: ['Instruments', 'Warm Pad'],
      supportStatus: 'supported' as const, objectType: 'GenericInstrument', revision: 2, hasChildren: false,
    };
    const onRename = vi.fn();
    const onDuplicate = vi.fn();
    const onDelete = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(
      <LibraryTree
        label="User Instruments"
        nodes={[node]}
        onSelect={vi.fn()}
        onRename={onRename}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        onCut={vi.fn()}
        onCopy={vi.fn()}
      />,
    ));
    const name = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Warm Pad')!;
    act(() => { name.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); });
    let input = container.querySelector('input[aria-label="Rename Warm Pad"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, '');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    expect(container.querySelector('[role="alert"]')?.textContent).toMatch(/required/i);
    expect(container.querySelector('input[aria-label="Rename Warm Pad"]')).toBeTruthy();
    input = container.querySelector('input[aria-label="Rename Warm Pad"]') as HTMLInputElement;
    act(() => { input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect(container.querySelector('input[aria-label="Rename Warm Pad"]')).toBeNull();

    const tree = container.querySelector('[role="tree"]')!;
    act(() => {
      tree.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });
    dispatchContextMenuKey(tree);
    await act(async () => { await Promise.resolve(); });
    expect(document.body.textContent).toContain('Duplicate');
    expect(document.body.textContent).toContain('Delete…');
    expect(container.querySelectorAll('button')).toHaveLength(2);
    act(() => root.unmount());
    container.remove();
  });

  it('announces incompatible drag and keyboard Paste at an exact destination', async () => {
    useLibraryStore.setState({
      clipboard: {
        operation: 'copy',
        source: { kind: 'userNode', libraryType: 'udo', nodeId: 'udo-1', revision: 1 },
        capturedAt: 1,
      },
      error: null,
    });
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(
      <LibraryBlockDropMarker
        label="Insert Instrument at end"
        target={{ kind: 'orchestra', projectSessionId: 1, projectRevision: 3, insertIndex: 0 }}
      />,
    ));
    const marker = container.querySelector('[aria-label^="Insert Instrument"]') as HTMLElement;
    await act(async () => {
      marker.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'v', ctrlKey: true, bubbles: true, cancelable: true,
      }));
      await Promise.resolve();
    });
    expect(container.querySelector('[role="status"]')?.textContent).toMatch(/accepts instrument/i);

    const transfer = createTestDataTransfer();
    transfer.setData(BLUE_LIBRARY_DRAG_MIME, JSON.stringify({
      dragSessionId: 'drag-udo', libraryType: 'udo',
    }));
    dispatchDragEvent(marker, 'dragover', transfer);
    expect(container.querySelector('[role="status"]')?.textContent).toMatch(/invalid drop/i);
    expect(marker.className).not.toContain('bg-app-accent ');
    act(() => root.unmount());
    container.remove();
  });

  it('publishes an opaque descriptor on the first drag gesture', () => {
    const beginLibraryDrag = vi.fn(async () => ({
      ok: true as const,
      value: { dragSessionId: 'unused-main-response', libraryType: 'instrument' as const },
    }));
    window.blueAPI = { ...window.blueAPI, beginLibraryDrag };
    const node = {
      key: { scope: 'user' as const, libraryType: 'instrument' as const, nodeId: 'node-drag' },
      nodeId: 'node-drag', parentId: 'root', libraryType: 'instrument' as const, scope: 'user' as const,
      nodeKind: 'item' as const, displayName: 'Immediate Drag', breadcrumb: ['Instruments', 'Immediate Drag'],
      supportStatus: 'supported' as const, objectType: 'GenericInstrument', revision: 4, hasChildren: false,
    };
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => root.render(<LibraryTree label="Drag test" nodes={[node]} onSelect={vi.fn()} />));
    const row = container.querySelector('[role="treeitem"]') as HTMLElement;
    act(() => row.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })));
    const transfer = createTestDataTransfer();
    const dragStart = new Event('dragstart', { bubbles: true, cancelable: true });
    Object.defineProperty(dragStart, 'dataTransfer', { value: transfer });
    act(() => row.dispatchEvent(dragStart));

    const descriptor = JSON.parse(transfer.getData(BLUE_LIBRARY_DRAG_MIME));
    expect(descriptor).toEqual({ dragSessionId: expect.any(String), libraryType: 'instrument' });
    expect(JSON.stringify(descriptor)).not.toContain('xml');
    expect(beginLibraryDrag).toHaveBeenCalledWith(expect.objectContaining({
      dragSessionId: descriptor.dragSessionId,
      key: node.key,
      revision: 4,
    }));
    act(() => root.unmount());
  });
});
