// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { LibraryEditorSessionSnapshot } from '../../shared/unified-library';
import { LibraryBreadcrumbs } from '../components/libraries/LibraryBreadcrumbs';
import { LibraryEditorToolbar } from '../components/libraries/LibraryEditorToolbar';
import { LibrarySessionDialog } from '../components/libraries/LibrarySessionDialog';
import { LibraryControlledEditor } from '../components/libraries/editor-registry';
import { chooseAppSelectOption } from './app-select-test-utils';
import { EffectLibraryEditor } from '../components/libraries/editors/EffectLibraryEditor';
import { InstrumentLibraryEditor } from '../components/libraries/editors/InstrumentLibraryEditor';
import { SoundObjectLibraryEditor } from '../components/libraries/editors/SoundObjectLibraryEditor';
import { UdoLibraryEditor } from '../components/libraries/editors/UdoLibraryEditor';
import { validateLibraryNodeName } from '../components/libraries/LibraryTree';
import { LibraryTree } from '../components/libraries/LibraryTree';
import { LibraryBlockDropMarker } from '../components/libraries/LibraryDropMarker';
import { BLUE_LIBRARY_DRAG_MIME } from '../components/libraries/library-drag-drop';
import { useLibraryStore } from '../stores/library-store';
import {
  createTestDataTransfer,
  dispatchContextMenuKey,
  dispatchDragEvent,
} from './library-interaction-test-helpers';
import { effectDocument, instrumentDocument, udoDocument } from './library-editor-fixtures';
import { createDefaultBlueX7Voice } from '@blue/data';
import type {
  BlueSynthBuilderInstrumentSnapshot,
  BlueX7InstrumentSnapshot,
  ScoreObjectEditorDocumentSnapshot,
  UdoDefinitionSnapshot,
} from '../../shared/project-editor';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

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
    act(() =>
      root.render(
        <>
          <LibraryEditorToolbar
            session={session}
            onSave={onSave}
            onRevert={onRevert}
            onResolveConflict={onResolveConflict}
          />
          <LibraryControlledEditor session={session} onPatch={onPatch} />
        </>,
      ),
    );
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

    for (const [label, callback] of [
      ['Reload latest', onReload],
      ['Overwrite latest', onOverwrite],
      ['Cancel', onCancel],
    ] as const) {
      act(() =>
        root.render(
          <LibrarySessionDialog
            key={label}
            title="Library item changed"
            message="Choose a conflict resolution."
            primaryLabel="Reload latest"
            secondaryLabel="Overwrite latest"
            onPrimary={onReload}
            onSecondary={onOverwrite}
            onCancel={onCancel}
          />,
        ),
      );
      act(() =>
        [...container.querySelectorAll('button')]
          .find((button) => button.textContent === label)
          ?.click(),
      );
      expect(callback).toHaveBeenCalledOnce();
    }
    act(() => root.unmount());
  });

  it('always exposes a safe cancel path when a session has no cancel callback', () => {
    const onPrimary = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() =>
      root.render(
        <LibrarySessionDialog
          title="Library item missing"
          message="Choose how to continue."
          onPrimary={onPrimary}
        />,
      ),
    );
    const dialog = container.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.querySelector('[data-action-id="cancel"]')).toBeTruthy();
    act(() => {
      dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(onPrimary).not.toHaveBeenCalled();
    expect(container.querySelector('[role="dialog"]')).toBeNull();

    act(() =>
      root.render(
        <LibrarySessionDialog
          key="backdrop"
          title="Library item missing"
          message="Choose how to continue."
          onPrimary={onPrimary}
        />,
      ),
    );
    const backdrop = container.querySelector('[role="presentation"]') as HTMLElement;
    act(() => backdrop.click());
    expect(onPrimary).not.toHaveBeenCalled();
    expect(container.querySelector('[role="dialog"]')).toBeNull();

    act(() => root.unmount());
    container.remove();
  });

  it('uses name-only inline rename and mouse/keyboard contextual commands without row buttons', async () => {
    const node = {
      key: { scope: 'user' as const, libraryType: 'instrument' as const, nodeId: 'node-1' },
      nodeId: 'node-1',
      parentId: 'root',
      libraryType: 'instrument' as const,
      scope: 'user' as const,
      nodeKind: 'item' as const,
      displayName: 'Warm Pad',
      breadcrumb: ['Instruments', 'Warm Pad'],
      supportStatus: 'supported' as const,
      objectType: 'GenericInstrument',
      revision: 2,
      hasChildren: false,
    };
    const onRename = vi.fn();
    const onDuplicate = vi.fn();
    const onDelete = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() =>
      root.render(
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
      ),
    );
    const name = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'Warm Pad',
    )!;
    act(() => {
      name.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });
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
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(container.querySelector('input[aria-label="Rename Warm Pad"]')).toBeNull();

    const tree = container.querySelector('[role="tree"]')!;
    act(() => {
      tree.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });
    dispatchContextMenuKey(tree);
    await act(async () => {
      await Promise.resolve();
    });
    expect(document.body.textContent).toContain('Duplicate');
    expect(document.body.textContent).toContain('Delete…');
    expect(container.querySelectorAll('button')).toHaveLength(2);
    act(() => root.unmount());
    container.remove();
  });

  it('offers working folder clipboard commands, item-parent Paste, reorder, and never renames a root', async () => {
    const rootNode = {
      key: null,
      nodeId: 'root',
      parentId: null,
      libraryType: 'instrument' as const,
      scope: 'user' as const,
      nodeKind: 'root' as const,
      displayName: 'Instruments',
      breadcrumb: ['Instruments'],
      revision: 1,
      hasChildren: true,
    };
    const folder = {
      ...rootNode,
      nodeId: 'folder',
      parentId: 'root',
      nodeKind: 'folder' as const,
      displayName: 'Pads',
      breadcrumb: ['Instruments', 'Pads'],
    };
    const child = {
      ...folder,
      key: { scope: 'user' as const, libraryType: 'instrument' as const, nodeId: 'child' },
      nodeId: 'child',
      nodeKind: 'item' as const,
      displayName: 'Warm Pad',
      breadcrumb: ['Instruments', 'Warm Pad'],
      objectType: 'GenericInstrument',
      hasChildren: false,
    };
    const onRename = vi.fn();
    const onCut = vi.fn();
    const onCopy = vi.fn();
    const onPaste = vi.fn();
    const onImportInstrument = vi.fn();
    const onExportInstrument = vi.fn();
    const onReorder = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() =>
      root.render(
        <LibraryTree
          label="User Instruments"
          nodes={[rootNode]}
          childrenByParent={{ root: [folder, child] }}
          defaultExpandedNodeIds={['root']}
          clipboard={{
            operation: 'copy',
            source: { kind: 'userNode', libraryType: 'instrument', nodeId: 'child', revision: 1 },
            capturedAt: 1,
          }}
          onSelect={vi.fn()}
          onRename={onRename}
          onCut={onCut}
          onCopy={onCopy}
          onPaste={onPaste}
          onImportInstrument={onImportInstrument}
          onExportInstrument={onExportInstrument}
          onReorder={onReorder}
        />,
      ),
    );

    const instrumentName = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'Instruments',
    )!;
    act(() => instrumentName.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })));
    expect(onRename).not.toHaveBeenCalled();
    expect(container.querySelector('input[aria-label="Rename Instruments"]')).toBeNull();

    const folderRow = container.querySelector('#library-node-folder')!;
    expect(folderRow.getAttribute('title')).toBe('Pads');
    act(() => folderRow.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true })));
    await act(async () => {
      await Promise.resolve();
    });
    expect(document.body.textContent).toContain('Cut');
    expect(document.body.textContent).toContain('Copy');
    expect(document.body.textContent).toContain('Import…');
    expect(document.body.querySelector('[data-auxiliary-portal="true"]')).toBeTruthy();
    act(() => {
      [...document.body.querySelectorAll('[role="menuitem"]')]
        .find((entry) => entry.textContent === 'Import…')
        ?.dispatchEvent(new Event('click', { bubbles: true }));
    });
    expect(onImportInstrument).toHaveBeenCalledWith(folder);

    const itemRow = container.querySelector('#library-node-child')!;
    act(() => itemRow.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true })));
    await act(async () => {
      await Promise.resolve();
    });
    expect(document.body.textContent).toContain('Export…');
    act(() => {
      [...document.body.querySelectorAll('[role="menuitem"]')]
        .find((entry) => entry.textContent === 'Export…')
        ?.dispatchEvent(new Event('click', { bubbles: true }));
    });
    expect(onExportInstrument).toHaveBeenCalledWith(child);
    act(() => itemRow.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true })));
    await act(async () => {
      await Promise.resolve();
    });
    const paste = [...document.body.querySelectorAll('[role="menuitem"]')].find(
      (entry) => entry.textContent === 'Paste',
    );
    expect(paste?.getAttribute('data-disabled')).toBeNull();
    act(() => root.unmount());
    container.remove();
  });

  it('renders an empty folder with a legible high-contrast disclosure control', () => {
    const emptyFolder = {
      key: null,
      nodeId: 'empty-folder',
      parentId: null,
      libraryType: 'udo' as const,
      scope: 'user' as const,
      nodeKind: 'folder' as const,
      displayName: 'test3',
      breadcrumb: ['UDOs', 'test3'],
      revision: 1,
      hasChildren: false,
    };
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() =>
      root.render(<LibraryTree label="UDO Library" nodes={[emptyFolder]} onSelect={vi.fn()} />),
    );

    const disclosure = container.querySelector('button[aria-label="Expand test3"]');
    expect(disclosure).toBeTruthy();
    expect(disclosure?.className).toContain('text-app-text-strong');
    expect(disclosure?.querySelector('svg')?.getAttribute('width')).toBe('14');
    expect(disclosure?.textContent).not.toContain('·');
    act(() => root.unmount());
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
    act(() =>
      root.render(
        <LibraryBlockDropMarker
          label="Insert Instrument at end"
          target={{ kind: 'orchestra', projectSessionId: 1, projectRevision: 3, insertIndex: 0 }}
        />,
      ),
    );
    const marker = container.querySelector('[aria-label^="Insert Instrument"]') as HTMLElement;
    await act(async () => {
      marker.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'v',
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
      await Promise.resolve();
    });
    expect(container.querySelector('[role="status"]')?.textContent).toMatch(/accepts instrument/i);

    const transfer = createTestDataTransfer();
    transfer.setData(
      BLUE_LIBRARY_DRAG_MIME,
      JSON.stringify({
        dragSessionId: 'drag-udo',
        libraryType: 'udo',
      }),
    );
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
      nodeId: 'node-drag',
      parentId: 'root',
      libraryType: 'instrument' as const,
      scope: 'user' as const,
      nodeKind: 'item' as const,
      displayName: 'Immediate Drag',
      breadcrumb: ['Instruments', 'Immediate Drag'],
      supportStatus: 'supported' as const,
      objectType: 'GenericInstrument',
      revision: 4,
      hasChildren: false,
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
    expect(descriptor).toEqual({
      dragSessionId: expect.any(String),
      libraryType: 'instrument',
      sourceScope: 'user',
    });
    expect(JSON.stringify(descriptor)).not.toContain('xml');
    expect(beginLibraryDrag).toHaveBeenCalledWith(
      expect.objectContaining({
        dragSessionId: descriptor.dragSessionId,
        key: node.key,
        revision: 4,
      }),
    );
    act(() => root.unmount());
  });

  it('accepts project-item drops on the matching user Library tree', () => {
    const rootNode = {
      key: null,
      nodeId: 'instrument-root',
      parentId: null,
      libraryType: 'instrument' as const,
      scope: 'user' as const,
      nodeKind: 'root' as const,
      displayName: 'Instrument Library',
      breadcrumb: ['Instrument Library'],
      revision: 2,
      hasChildren: false,
    };
    const onTransferToUser = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() =>
      root.render(
        <LibraryTree
          label="User Instruments"
          nodes={[rootNode]}
          onSelect={vi.fn()}
          onTransferToUser={onTransferToUser}
        />,
      ),
    );
    const tree = container.querySelector('[role="treeitem"]') as HTMLElement;
    const transfer = createTestDataTransfer();
    const descriptor = {
      dragSessionId: 'project-drag',
      libraryType: 'instrument' as const,
      sourceScope: 'projectOwned' as const,
    };
    transfer.setData(BLUE_LIBRARY_DRAG_MIME, JSON.stringify(descriptor));
    const readData = transfer.getData.bind(transfer);
    let protectedHover = true;
    Object.defineProperty(transfer, 'getData', {
      configurable: true,
      value: (format: string) => (protectedHover ? '' : readData(format)),
    });
    dispatchDragEvent(tree, 'dragover', transfer);
    expect(transfer.dropEffect).toBe('copy');
    protectedHover = false;
    dispatchDragEvent(tree, 'drop', transfer);
    expect(onTransferToUser).toHaveBeenCalledWith(descriptor, rootNode);
    act(() => root.unmount());
    container.remove();
  });

  it('moves a user folder into another folder, including protected drag-over mode', () => {
    const rootNode = {
      key: null,
      nodeId: 'instrument-root',
      parentId: null,
      libraryType: 'instrument' as const,
      scope: 'user' as const,
      nodeKind: 'root' as const,
      displayName: 'Instrument Library',
      breadcrumb: ['Instrument Library'],
      revision: 2,
      hasChildren: true,
    };
    const sourceFolder = {
      ...rootNode,
      nodeId: 'source-folder',
      parentId: rootNode.nodeId,
      nodeKind: 'folder' as const,
      displayName: 'Source',
      breadcrumb: ['Instrument Library', 'Source'],
      hasChildren: false,
    };
    const destinationFolder = {
      ...rootNode,
      nodeId: 'destination-folder',
      parentId: rootNode.nodeId,
      nodeKind: 'folder' as const,
      displayName: 'Destination',
      breadcrumb: ['Instrument Library', 'Destination'],
      hasChildren: false,
    };
    const onMoveToUser = vi.fn();
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() =>
      root.render(
        <LibraryTree
          label="User Instruments"
          nodes={[rootNode]}
          childrenByParent={{ [rootNode.nodeId]: [sourceFolder, destinationFolder] }}
          defaultExpandedNodeIds={[rootNode.nodeId]}
          onSelect={vi.fn()}
          onMoveToUser={onMoveToUser}
        />,
      ),
    );
    const sourceRow = container.querySelector('#library-node-source-folder') as HTMLElement;
    const destinationRow = container.querySelector(
      '#library-node-destination-folder',
    ) as HTMLElement;
    act(() => sourceRow.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })));
    const transfer = createTestDataTransfer();
    const dragStart = new Event('dragstart', { bubbles: true, cancelable: true });
    Object.defineProperty(dragStart, 'dataTransfer', { value: transfer });
    act(() => sourceRow.dispatchEvent(dragStart));
    const readData = transfer.getData.bind(transfer);
    Object.defineProperty(transfer, 'getData', {
      configurable: true,
      value: () => '',
    });
    dispatchDragEvent(destinationRow, 'dragover', transfer);
    expect(transfer.dropEffect).toBe('move');
    Object.defineProperty(transfer, 'getData', {
      configurable: true,
      value: readData,
    });
    dispatchDragEvent(destinationRow, 'drop', transfer);
    expect(onMoveToUser).toHaveBeenCalledWith(sourceFolder, destinationFolder);
    act(() => root.unmount());
  });
});

describe('library editor UDO isolation (US5, T030)', () => {
  it('standalone library instrument orchestra fields receive no project UDOs', () => {
    const html = renderToStaticMarkup(
      <InstrumentLibraryEditor snapshot={instrumentDocument.snapshot as any} onPatch={vi.fn()} />,
    );
    // Every Csound orchestra field receives the asset-owned UDO and no project UDO.
    const scopes = [...html.matchAll(/data-udo-scope="([^"]+)"/g)].map((m) => m[1]);
    expect(scopes.filter((scope) => scope === '1:0')).toHaveLength(2);
    for (const scope of scopes) {
      expect(scope.endsWith(':0')).toBe(true);
    }
  });

  it('standalone library effect Code and UDO body receive only effect-owned UDOs', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() =>
      root.render(
        <EffectLibraryEditor snapshot={effectDocument.snapshot as any} onPatch={vi.fn()} />,
      ),
    );

    const codeTab = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'Code',
    );
    act(() => codeTab?.click());
    expect(
      container.querySelector('[data-udo-scope="1:0"][aria-label="Effect code editor"]'),
    ).toBeTruthy();

    const udoTab = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'UDO',
    );
    act(() => udoTab?.click());
    const udoRow = [...container.querySelectorAll('tr')].find((row) =>
      row.textContent?.includes('LibraryEffectUDO'),
    );
    act(() => udoRow?.click());
    expect(
      container.querySelector('[data-udo-scope="1:0"][aria-label="UDO code editor"]'),
    ).toBeTruthy();

    act(() => root.unmount());
  });

  it('standalone library UDO body offers only self, never project UDOs', () => {
    const html = renderToStaticMarkup(
      <UdoLibraryEditor snapshot={udoDocument.snapshot as any} onPatch={vi.fn()} />,
    );
    // The library UDO editor exposes itself (context:1) but no project UDOs (0).
    const scope = html.match(/data-udo-scope="([^"]+)"/)?.[1];
    expect(scope).toBe('1:0');
  });

  it('standalone library Sound Code and UDO body receive only Sound-owned UDOs', () => {
    const ownerUdo: UdoDefinitionSnapshot = {
      name: 'LibrarySoundUDO',
      style: 'CLASSIC',
      outTypes: 'a',
      inTypes: 'a',
      inputArguments: '',
      code: '',
      comments: '',
    };
    const bsbInstrument: BlueSynthBuilderInstrumentSnapshot = {
      assignmentId: 'library-sound-bsb',
      type: 'blueSynthBuilder',
      name: 'Library Sound',
      enabled: true,
      comment: '',
      instrumentText: 'aout oscili 0.2, 440',
      alwaysOnInstrumentText: '',
      globalOrc: '',
      globalSco: '',
      objectNames: [],
      widgets: [],
      editEnabled: true,
      gridSettings: { enabled: false, snapEnabled: false, width: 10, height: 10 },
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
        maximum: 0,
        editable: true,
        properties: {},
        children: [],
      },
      udolist: [ownerUdo],
    };
    const soundDocument = {
      target: {
        selectionId: 'library-sound',
        selectedObjectType: 'Sound',
        editorObjectType: 'Sound',
        ownerKind: 'library',
        displayContext: 'library',
        supportsTimeBehavior: false,
        supportsRepeatPoint: false,
        supportsNoteProcessorChain: true,
      },
      object: {
        id: 'library-sound',
        name: 'Library Sound',
        objectType: 'Sound',
        startTime: { unit: 'csoundBeats', value: 0 },
        subjectiveDuration: { unit: 'csoundBeats', value: 4 },
        endTime: { unit: 'csoundBeats', value: 4 },
        color: '#000000',
        timeBehavior: 'notSupported',
        repeatPointEnabled: false,
        repeatPoint: null,
        noteProcessorChainEnabled: false,
        librarySource: null,
      },
      owner: {
        kind: 'library',
        groupPath: [],
        layerId: '',
        laneLabel: 'Library',
        startLabel: '0.00',
        durationLabel: '4.00',
      },
      shared: {
        name: 'Library Sound',
        startTime: { unit: 'csoundBeats', value: 0, availableUnits: ['csoundBeats'] },
        subjectiveDuration: { unit: 'csoundBeats', value: 4, availableUnits: ['csoundBeats'] },
        endTimeLabel: '4.00',
        color: '#000000',
        timeBehavior: { value: 'notSupported', editable: false, options: [] },
        repeatPoint: {
          enabled: false,
          value: { unit: 'csoundBeats', value: 0, availableUnits: ['csoundBeats'] },
        },
        noteProcessorChain: { enabled: false, summary: 'None' },
      },
      editor: {
        kind: 'structured',
        editorFamily: 'Sound',
        payload: {
          comment: '',
          bsbInstrument,
          automationParameters: [],
          availableTabs: ['code', 'udo'],
          testAvailable: false,
          deferredCapabilities: [],
        },
      },
    } as unknown as ScoreObjectEditorDocumentSnapshot;

    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => root.render(<SoundObjectLibraryEditor snapshot={soundDocument} onPatch={vi.fn()} />));

    const codeScopes = [...container.querySelectorAll('[data-udo-scope]')].map((element) =>
      element.getAttribute('data-udo-scope'),
    );
    expect(codeScopes.filter((scope) => scope === '1:0')).toHaveLength(3);
    expect(codeScopes.every((scope) => scope?.endsWith(':0'))).toBe(true);

    const udoTab = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'UDO',
    );
    act(() => udoTab?.click());
    const udoRow = [...container.querySelectorAll('tr')].find((row) =>
      row.textContent?.includes('LibrarySoundUDO'),
    );
    act(() => udoRow?.click());
    expect(
      container.querySelector('[data-udo-scope="1:0"][aria-label="UDO code editor"]'),
    ).toBeTruthy();

    act(() => root.unmount());
  });

  it('renders and dispatches patches for BlueX7 library drafts', async () => {
    const onPatch = vi.fn();
    const voice = createDefaultBlueX7Voice();
    voice.common.algorithm = 11;
    const blueX7Snapshot: BlueX7InstrumentSnapshot = {
      assignmentId: 'library-item',
      type: 'blueX7',
      name: 'Library DX7',
      enabled: true,
      comment: 'Library FM voice',
      voice,
    };

    const blueX7Session: LibraryEditorSessionSnapshot = {
      sessionId: 'session-x7',
      key: { scope: 'user', libraryType: 'instrument', nodeId: 'node-x7' },
      displayName: 'Library DX7',
      objectType: 'BlueX7',
      breadcrumb: ['Instruments', 'FM', 'Library DX7'],
      baseRevision: 1,
      document: {
        kind: 'instrument',
        snapshot: blueX7Snapshot,
      },
      dirty: false,
      pinned: false,
      status: 'ready',
    };

    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () => {
      await import('../components/instruments/blue-x7-editor');
      root.render(<LibraryControlledEditor session={blueX7Session} onPatch={onPatch} />);
      for (
        let attempt = 0;
        attempt < 50 && container.querySelector('[data-instrument-editor-loading]');
        attempt += 1
      ) {
        await new Promise((resolve) => {
          setTimeout(resolve, 0);
        });
      }
    });

    expect(container.querySelector('[data-testid="blue-x7-editor"]')).toBeTruthy();
    expect(container.textContent).toContain('Common & Algorithms');

    // Edit algorithm
    const algSelect = container.querySelector('#bluex7-algorithm') as HTMLButtonElement;
    await chooseAppSelectOption(algSelect, 'Algorithm 7');

    expect(onPatch).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'instrument',
        patch: expect.objectContaining({
          patch: expect.objectContaining({
            blueX7: {
              type: 'setCommonField',
              field: 'algorithm',
              value: 7,
            },
          }),
        }),
      }),
    );

    act(() => root.unmount());
  });
});
