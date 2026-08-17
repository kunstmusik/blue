// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  serializeFileManagerDragPayload,
  type FileManagerDirectoryResult,
  type FileManagerRootSnapshot,
} from '../../shared/file-manager';
import FileManagerPanel from '../components/workbench/panels/tools/FileManagerPanel';
import FileManagerTree, {
  resetFileManagerTreeSessionState,
} from '../components/workbench/panels/tools/file-manager/FileManagerTree';
import { sessionTreeState } from '../components/workbench/panels/tools/file-manager/file-manager-tree-state';
import { subscribePendingAudioFile } from '../components/workbench/panels/audio-player/audio-player-bus';
import { subscribePendingSoundFontFile } from '../components/workbench/panels/tools/soundfont-viewer-bus';
import { useWorkbenchStore } from '../stores/workbench-store';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function makeRoots(): FileManagerRootSnapshot[] {
  return [
    { id: '/', path: '/', label: 'Root', kind: 'static', available: true, isDirectory: true },
    { id: '/Users/me', path: '/Users/me', label: 'Home', kind: 'static', available: true, isDirectory: true },
    { id: '/Volumes/media', path: '/Volumes/media', label: '/Volumes/media', kind: 'favorite', available: true, isDirectory: true },
  ];
}

function directoryResult(
  directoryPath: string,
  children: Array<{ name: string; kind: 'file' | 'directory' }>,
): Extract<FileManagerDirectoryResult, { status: 'ok' }> {
  return {
    status: 'ok',
    snapshot: {
      directoryPath,
      loadedAt: 1,
      children: children.map((child) => ({
        id: `${directoryPath}/${child.name}`,
        path: `${directoryPath}/${child.name}`,
        name: child.name,
        kind: child.kind,
        parentPath: directoryPath,
        isSymlink: false,
        canExpand: child.kind === 'directory',
      })),
    },
  };
}

function findRow(label: string): HTMLElement | null {
  return Array.from(document.querySelectorAll<HTMLElement>('div[class*="cursor-pointer"]')).find(
    (row) => row.textContent?.includes(label) ?? false,
  ) ?? null;
}

async function clickSingle(element: HTMLElement | null): Promise<void> {
  expect(element).not.toBeNull();
  await act(async () => {
    element!.click();
    await new Promise((resolve) => setTimeout(resolve, 300));
  });
}

async function openRootRenameDialog(row: HTMLElement | null): Promise<HTMLElement> {
  expect(row).not.toBeNull();
  await act(async () => {
    row!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
  });
  const renameItem = Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'))
    .find((item) => item.textContent === 'Rename Root');
  expect(renameItem).not.toBeUndefined();
  await act(async () => {
    renameItem!.click();
  });
  const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]');
  expect(dialog).not.toBeNull();
  return dialog!;
}

async function setTextInputValue(input: HTMLInputElement, value: string): Promise<void> {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function makeDataTransferLike(payloadByType: Record<string, string>) {
  return {
    types: Object.keys(payloadByType),
    files: [] as File[],
    dropEffect: 'none',
    effectAllowed: 'none',
    getData: (type: string) => payloadByType[type] ?? '',
    setData: () => {},
  };
}

describe('File Manager panel and tree', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  const getFileManagerRoots = vi.fn();
  const listFileManagerDirectory = vi.fn();
  const validateFileManagerDirectory = vi.fn();
  const getProgramSettings = vi.fn();
  const saveProgramSettings = vi.fn();
  const addFavorite = vi.fn();
  const removeFavorite = vi.fn();
  const authorizeAudioFile = vi.fn();
  const openPanel = vi.fn();
  const originalOpenPanel = useWorkbenchStore.getState().openPanel;

  beforeEach(() => {
    resetFileManagerTreeSessionState();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    getFileManagerRoots.mockResolvedValue(makeRoots());
    useWorkbenchStore.setState({ openPanel } as Partial<ReturnType<typeof useWorkbenchStore.getState>>);
    authorizeAudioFile.mockResolvedValue(true);
    (window as unknown as { blueAPI: Record<string, unknown> }).blueAPI = {
      getFileManagerRoots,
      listFileManagerDirectory,
      validateFileManagerDirectory,
      getProgramSettings,
      saveProgramSettings,
      authorizeAudioFile,
    };
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root!.unmount();
      });
    }
    container?.remove();
    container = null;
    root = null;
    useWorkbenchStore.setState({ openPanel: originalOpenPanel } as Partial<ReturnType<typeof useWorkbenchStore.getState>>);
    vi.clearAllMocks();
  });

  it('loads roots on mount and renders static roots before favorites', async () => {
    act(() => {
      root!.render(<FileManagerPanel />);
    });
    await act(async () => {});

    expect(getFileManagerRoots).toHaveBeenCalledOnce();
    const text = document.body.textContent ?? '';
    expect(text).toContain('/');
    expect(text).toContain('/Users/me');
    expect(text).toContain('/Volumes/media');
    expect(text).toContain('favorite');
  });

  it('shows a recoverable message when roots cannot be loaded', async () => {
    getFileManagerRoots.mockRejectedValue(new Error('bridge unavailable'));
    act(() => {
      root!.render(<FileManagerPanel />);
    });
    await act(async () => {});

    expect(document.body.textContent).toContain('Could not load roots: bridge unavailable');
  });

  it('shows the empty state when no roots are available', async () => {
    getFileManagerRoots.mockResolvedValue([]);
    act(() => {
      root!.render(<FileManagerPanel />);
    });
    await act(async () => {});

    expect(document.body.textContent).toContain('No filesystem roots available.');
  });

  it('expands lazily with one listing request per toggle and renders children in order', async () => {
    listFileManagerDirectory.mockResolvedValue(
      directoryResult('/Users/me', [
        { name: 'A-dir', kind: 'directory' },
        { name: 'b-file.wav', kind: 'file' },
        { name: 'c.aiff', kind: 'file' },
      ]),
    );

    act(() => {
      root!.render(<FileManagerTree roots={makeRoots()} onAddFavorite={addFavorite} onRemoveFavorite={removeFavorite} />);
    });
    await act(async () => {});

    const rootRow = findRow('/Users/me');
    expect(rootRow).not.toBeNull();
    await clickSingle(rootRow);

    expect(listFileManagerDirectory).toHaveBeenCalledExactlyOnceWith({ path: '/Users/me' });
    const text = document.body.textContent ?? '';
    expect(text).toContain('A-dir');
    expect(text).toContain('b-file.wav');
    expect(text).toContain('c.aiff');
    expect(text.indexOf('A-dir')).toBeLessThan(text.indexOf('b-file.wav'));

    // Collapsing and re-expanding an already-loaded directory must not issue
    // a second listing request.
    await clickSingle(rootRow);
    await clickSingle(rootRow);
    expect(listFileManagerDirectory).toHaveBeenCalledOnce();
  });

  it('does not request listings for regular files', async () => {
    listFileManagerDirectory.mockResolvedValue(
      directoryResult('/Users/me', [{ name: 'b-file.wav', kind: 'file' }]),
    );

    act(() => {
      root!.render(<FileManagerTree roots={makeRoots()} onAddFavorite={addFavorite} onRemoveFavorite={removeFavorite} />);
    });
    await act(async () => {});

    await clickSingle(findRow('/Users/me'));

    const fileRow = findRow('b-file.wav');
    expect(fileRow).not.toBeNull();
    await clickSingle(fileRow);
    expect(listFileManagerDirectory).toHaveBeenCalledExactlyOnceWith({ path: '/Users/me' });
  });

  it('shows an inline recoverable diagnostic when a directory cannot be read', async () => {
    listFileManagerDirectory.mockResolvedValue({
      status: 'error',
      directoryPath: '/Users/me',
      code: 'permission-denied',
      message: 'Permission denied.',
    });

    act(() => {
      root!.render(<FileManagerTree roots={makeRoots()} onAddFavorite={addFavorite} onRemoveFavorite={removeFavorite} />);
    });
    await act(async () => {});

    await clickSingle(findRow('/Users/me'));

    expect(document.body.textContent).toContain('Permission denied.');
  });

  it('keeps a partial-list diagnostic when the main service omits a child', async () => {
    listFileManagerDirectory.mockResolvedValue({
      status: 'ok',
      snapshot: {
        ...directoryResult('/Users/me', [{ name: 'visible.wav', kind: 'file' }]).snapshot,
        diagnostic: '1 entry was unreadable and omitted.',
      },
    });

    act(() => {
      root!.render(<FileManagerTree roots={makeRoots()} onAddFavorite={addFavorite} onRemoveFavorite={removeFavorite} />);
    });
    await act(async () => {});
    await clickSingle(findRow('/Users/me'));

    expect(document.body.textContent).toContain('1 entry was unreadable and omitted.');
  });

  it('does not recurse through a symlink child whose identity is already an ancestor', async () => {
    listFileManagerDirectory.mockResolvedValue({
      status: 'ok',
      snapshot: {
        directoryPath: '/',
        loadedAt: 1,
        children: [{
          id: '/',
          path: '/loop',
          name: 'loop',
          kind: 'directory',
          parentPath: '/',
          isSymlink: true,
          canExpand: true,
        }],
      },
    });

    act(() => {
      root!.render(<FileManagerTree roots={makeRoots()} onAddFavorite={addFavorite} onRemoveFavorite={removeFavorite} />);
    });
    await act(async () => {});
    await clickSingle(findRow('Root - /'));

    expect(document.body.textContent).not.toContain('loop');
  });

  it('keeps a 1,000-entry directory virtualized instead of rendering every row', async () => {
    const children = Array.from({ length: 1000 }, (_, i) => ({
      name: `file-${String(i).padStart(4, '0')}.wav`,
      kind: 'file' as const,
    }));
    listFileManagerDirectory.mockResolvedValue(directoryResult('/Users/me', children));

    act(() => {
      root!.render(<FileManagerTree roots={makeRoots()} onAddFavorite={addFavorite} onRemoveFavorite={removeFavorite} />);
    });
    await act(async () => {});

    await clickSingle(findRow('/Users/me'));
    await act(async () => {});

    expect(listFileManagerDirectory).toHaveBeenCalledOnce();
    const renderedRows = document.querySelectorAll('[class*="select-none"]');
    expect(renderedRows.length).toBeGreaterThan(0);
    expect(renderedRows.length).toBeLessThan(200);
  });

  it('shows the Java context-action matrix per node kind', async () => {
    listFileManagerDirectory.mockResolvedValue(
      directoryResult('/Users/me', [
        { name: 'Projects', kind: 'directory' },
        { name: 'b-file.wav', kind: 'file' },
      ]),
    );

    act(() => {
      root!.render(<FileManagerTree roots={makeRoots()} onAddFavorite={addFavorite} onRemoveFavorite={removeFavorite} />);
    });
    await act(async () => {});
    await clickSingle(findRow('/Users/me'));

    const menuItems = () =>
      Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'))
        .map((item) => item.textContent ?? '');
    const openMenu = async (label: string) => {
      const row = findRow(label);
      expect(row, `row for ${label}`).not.toBeNull();
      await act(async () => {
        row!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
      });
    };
    const closeMenu = async () => {
      await act(async () => {
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      });
    };

    await openMenu('/');
    expect(menuItems()).toEqual(['Refresh Folder', 'Rename Root']);
    await closeMenu();

    await openMenu('/Volumes/media');
    expect(menuItems()).toEqual(['Refresh Folder', 'Remove from Favorites', 'Rename Root']);
    await closeMenu();

    await openMenu('Projects');
    expect(menuItems()).toEqual(['Refresh Folder', 'Add to Favorites']);
    await closeMenu();

    // Regular files expose no File Manager actions at all.
    await openMenu('b-file.wav');
    expect(menuItems()).toEqual([]);
    await closeMenu();
  });

  it('adds a favorite through the settings bridge and reloads roots only on success', async () => {
    listFileManagerDirectory.mockResolvedValue(
      directoryResult('/Users/me', [{ name: 'Projects', kind: 'directory' }]),
    );
    getProgramSettings.mockResolvedValue({
      version: 3,
      appSpecific: { fileManagerFavorites: ['/Volumes/media'] },
    });
    saveProgramSettings.mockResolvedValue({ ok: true });
    validateFileManagerDirectory.mockResolvedValue({
      ok: true,
      normalizedPath: '/Users/me/Projects',
    });

    act(() => {
      root!.render(<FileManagerPanel />);
    });
    await act(async () => {});
    await clickSingle(findRow('/Users/me'));

    await act(async () => {
      findRow('Projects')!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    });
    const addItem = Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'))
      .find((item) => item.textContent === 'Add to Favorites')!;
    await act(async () => {
      addItem.click();
    });

    expect(validateFileManagerDirectory).toHaveBeenCalledWith({ path: '/Users/me/Projects' });
    expect(saveProgramSettings).toHaveBeenCalledOnce();
    const saved = saveProgramSettings.mock.calls[0]![0] as { appSpecific: { fileManagerFavorites: string[] } };
    expect(saved.appSpecific.fileManagerFavorites).toEqual(['/Volumes/media', '/Users/me/Projects']);
    expect(getFileManagerRoots).toHaveBeenCalledTimes(2);
  });

  it('keeps the previous root list when the settings save fails', async () => {
    listFileManagerDirectory.mockResolvedValue(
      directoryResult('/Users/me', [{ name: 'Projects', kind: 'directory' }]),
    );
    getProgramSettings.mockResolvedValue({
      version: 3,
      appSpecific: { fileManagerFavorites: [] },
    });
    saveProgramSettings.mockResolvedValue({ ok: false });
    validateFileManagerDirectory.mockResolvedValue({
      ok: true,
      normalizedPath: '/Users/me/Projects',
    });

    act(() => {
      root!.render(<FileManagerPanel />);
    });
    await act(async () => {});
    await clickSingle(findRow('/Users/me'));

    await act(async () => {
      findRow('Projects')!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    });
    const addItem = Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'))
      .find((item) => item.textContent === 'Add to Favorites')!;
    await act(async () => {
      addItem.click();
    });

    expect(saveProgramSettings).toHaveBeenCalledOnce();
    expect(getFileManagerRoots).toHaveBeenCalledOnce();
  });

  it('removes a favorite through the settings bridge without touching disk', async () => {
    getProgramSettings.mockResolvedValue({
      version: 3,
      appSpecific: { fileManagerFavorites: ['/Volumes/media'] },
    });
    saveProgramSettings.mockResolvedValue({ ok: true });

    act(() => {
      root!.render(<FileManagerPanel />);
    });
    await act(async () => {});

    await act(async () => {
      findRow('/Volumes/media')!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    });
    const removeItem = Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'))
      .find((item) => item.textContent === 'Remove from Favorites')!;
    expect(removeItem).toBeTruthy();
    await act(async () => {
      removeItem.click();
    });

    expect(saveProgramSettings).toHaveBeenCalledOnce();
    const saved = saveProgramSettings.mock.calls[0]![0] as { appSpecific: { fileManagerFavorites: string[] } };
    expect(saved.appSpecific.fileManagerFavorites).toEqual([]);
    expect(getFileManagerRoots).toHaveBeenCalledTimes(2);
  });

  it('Refresh Folder re-lists only the selected directory', async () => {
    let projectsCalls = 0;
    listFileManagerDirectory.mockImplementation(async ({ path }: { path: string }) => {
      if (path === '/Users/me') {
        return directoryResult('/Users/me', [{ name: 'Projects', kind: 'directory' }]);
      }
      projectsCalls += 1;
      return projectsCalls === 1
        ? directoryResult('/Users/me/Projects', [{ name: 'old.wav', kind: 'file' }])
        : directoryResult('/Users/me/Projects', [{ name: 'new.wav', kind: 'file' }]);
    });

    act(() => {
      root!.render(<FileManagerTree roots={makeRoots()} onAddFavorite={addFavorite} onRemoveFavorite={removeFavorite} />);
    });
    await act(async () => {});
    await clickSingle(findRow('/Users/me'));
    await clickSingle(findRow('Projects'));
    expect(document.body.textContent).toContain('old.wav');

    await act(async () => {
      findRow('Projects')!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    });
    const refreshItem = Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'))
      .find((item) => item.textContent === 'Refresh Folder')!;
    await act(async () => {
      refreshItem.click();
    });
    await act(async () => {});

    expect(document.body.textContent).toContain('new.wav');
    expect(document.body.textContent).not.toContain('old.wav');
    expect(listFileManagerDirectory).toHaveBeenCalledTimes(3);
  });

  it('writes the versioned copy payload on file-row drag start only', async () => {
    listFileManagerDirectory.mockResolvedValue(
      directoryResult('/Users/me', [
        { name: 'A-dir', kind: 'directory' },
        { name: 'b-file.wav', kind: 'file' },
      ]),
    );

    act(() => {
      root!.render(<FileManagerTree roots={makeRoots()} onAddFavorite={addFavorite} onRemoveFavorite={removeFavorite} />);
    });
    await act(async () => {});
    await clickSingle(findRow('/Users/me'));

    const dragStartWith = (row: HTMLElement | null) => {
      const payloadByType: Record<string, string> = {};
      const dataTransfer = {
        types: [] as string[],
        files: [] as File[],
        dropEffect: 'none',
        effectAllowed: 'none',
        getData: (type: string) => payloadByType[type] ?? '',
        setData: (type: string, value: string) => {
          payloadByType[type] = value;
        },
      };
      const event = new Event('dragstart', { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'dataTransfer', { value: dataTransfer });
      act(() => {
        row!.dispatchEvent(event);
      });
      return dataTransfer;
    };

    const fileDataTransfer = dragStartWith(findRow('b-file.wav'));
    const internal = JSON.parse(
      fileDataTransfer.getData('application/x-blue-file-manager-file'),
    ) as { version: number; kind: string; path: string; name: string };
    expect(internal).toEqual({
      version: 1,
      kind: 'file',
      path: '/Users/me/b-file.wav',
      name: 'b-file.wav',
    });
    expect(fileDataTransfer.effectAllowed).toBe('copy');
    expect(findRow('b-file.wav')?.draggable).toBe(true);
    expect(fileDataTransfer.getData('text/plain')).toBe('/Users/me/b-file.wav');

    const directoryDataTransfer = dragStartWith(findRow('A-dir'));
    expect(findRow('A-dir')?.draggable).toBe(false);
    expect(directoryDataTransfer.getData('application/x-blue-file-manager-file')).toBe('');
    expect(directoryDataTransfer.effectAllowed).toBe('none');
  });

  it('declares no drop-target surface of its own', async () => {
    listFileManagerDirectory.mockResolvedValue(
      directoryResult('/Users/me', [{ name: 'b-file.wav', kind: 'file' }]),
    );

    act(() => {
      root!.render(<FileManagerTree roots={makeRoots()} onAddFavorite={addFavorite} onRemoveFavorite={removeFavorite} />);
    });
    await act(async () => {});
    await clickSingle(findRow('/Users/me'));

    // Intentional drop surfaces in this codebase declare an explicit marker
    // (SoundFont Viewer: data-soundfont-drop-target; Track audio layers:
    // data-track-layer-group). The File Manager tree defines no file-operation
    // target contract: no marker, no drop handlers, tree drag/drop disabled.
    expect(container!.querySelector('[data-soundfont-drop-target]')).toBeNull();
    expect(document.querySelector('[data-track-layer-group]')).toBeNull();
    expect(listFileManagerDirectory).toHaveBeenCalledOnce();
    expect(document.body.textContent).toContain('b-file.wav');
  });

  it('keeps open state independent when a favorite is a subfolder of another root', async () => {
    const roots: FileManagerRootSnapshot[] = [
      { id: '/', path: '/', label: '/', kind: 'static', available: true, isDirectory: true },
      { id: '/Users/me', path: '/Users/me', label: '/Users/me', kind: 'static', available: true, isDirectory: true },
      { id: '/Users/me/projects', path: '/Users/me/projects', label: '/Users/me/projects', kind: 'favorite', available: true, isDirectory: true },
    ];
    listFileManagerDirectory.mockImplementation(async ({ path }: { path: string }) => {
      switch (path) {
        case '/Users/me':
          return directoryResult('/Users/me', [
            { name: 'x', kind: 'directory' },
          ]);
        case '/Users/me/projects':
          return directoryResult('/Users/me/projects', [
            { name: 'x', kind: 'directory' },
          ]);
        case '/Users/me/x':
          return directoryResult('/Users/me/x', [{ name: 'home-child.txt', kind: 'file' }]);
        default:
          return directoryResult('/Users/me/projects/x', [{ name: 'fav-child.txt', kind: 'file' }]);
      }
    });

    act(() => {
      root!.render(<FileManagerTree roots={roots} onAddFavorite={addFavorite} onRemoveFavorite={removeFavorite} />);
    });
    await act(async () => {});

    const rowsNamed = (label: string) =>
      Array.from(document.querySelectorAll<HTMLElement>('[class*="select-none"]'))
        .filter((row) => (row.textContent ?? '').trim() === label);

    // Expand the home branch's x and the favorite branch's x.
    await clickSingle(findRow('/Users/me'));
    await clickSingle(rowsNamed('x')[0] ?? null);
    await clickSingle(findRow('/Users/me/projects'));
    await clickSingle(rowsNamed('x')[1] ?? null);
    expect(document.body.textContent).toContain('home-child.txt');
    expect(document.body.textContent).toContain('fav-child.txt');

    // Collapsing the home-branch x must not close the same directory reached
    // through the favorite root.
    await clickSingle(rowsNamed('x')[0] ?? null);
    expect(document.body.textContent).not.toContain('home-child.txt');
    expect(document.body.textContent).toContain('fav-child.txt');
  });

  it('does not share open state between a favorite root and the same-named child under its parent root', async () => {
    const roots: FileManagerRootSnapshot[] = [
      { id: '/Users/me', path: '/Users/me', label: '/Users/me', kind: 'static', available: true, isDirectory: true },
      { id: '/Users/me/projects', path: '/Users/me/projects', label: '/Users/me/projects', kind: 'favorite', available: true, isDirectory: true },
    ];
    listFileManagerDirectory.mockImplementation(async ({ path }: { path: string }) => {
      if (path === '/Users/me') {
        return directoryResult('/Users/me', [{ name: 'projects', kind: 'directory' }]);
      }
      return directoryResult('/Users/me/projects', [{ name: 'fav-child.wav', kind: 'file' }]);
    });

    act(() => {
      root!.render(<FileManagerTree roots={roots} onAddFavorite={addFavorite} onRemoveFavorite={removeFavorite} />);
    });
    await act(async () => {});

    const expandedState = (label: string) =>
      Array.from(document.querySelectorAll<HTMLElement>('[class*="select-none"]'))
        .find((row) => (row.textContent ?? '').trim() === label)!
        .closest('[role="treeitem"]')!
        .getAttribute('aria-expanded');

    const projectsChildRow = () =>
      Array.from(document.querySelectorAll<HTMLElement>('[class*="select-none"]'))
        .find((row) => (row.textContent ?? '').trim() === 'projects')!;
    const favoriteRootRow = () => findRow('/Users/me/projects')!;

    await clickSingle(findRow('/Users/me'));
    expect(expandedState('projects')).toBe('false');

    // Expanding home's `projects` child loads its children but must leave the
    // favorite root `/Users/me/projects` closed.
    await clickSingle(projectsChildRow());
    expect(document.body.textContent).toContain('fav-child.wav');
    expect(favoriteRootRow().closest('[role="treeitem"]')!.getAttribute('aria-expanded')).toBe('false');
  });

  it('restores loaded children and open state after a remount (docked/slideout move)', async () => {
    listFileManagerDirectory.mockImplementation(async ({ path }: { path: string }) => {
      if (path === '/Users/me') {
        return directoryResult('/Users/me', [{ name: 'A-dir', kind: 'directory' }]);
      }
      return directoryResult('/Users/me/A-dir', [{ name: 'deep.wav', kind: 'file' }]);
    });

    const renderTree = (target: { root: ReturnType<typeof createRoot> }) => {
      act(() => {
        target.root.render(
          <FileManagerTree roots={makeRoots()} onAddFavorite={addFavorite} onRemoveFavorite={removeFavorite} />,
        );
      });
    };

    renderTree({ root: root! });
    await act(async () => {});
    await clickSingle(findRow('/Users/me'));
    await clickSingle(findRow('A-dir'));
    expect(document.body.textContent).toContain('deep.wav');
    expect(listFileManagerDirectory).toHaveBeenCalledTimes(2);

    // Simulate a docked -> slideout move: unmount, then remount elsewhere.
    act(() => { root!.unmount(); });
    container!.remove();
    const host = document.createElement('div');
    document.body.appendChild(host);
    const secondRoot = createRoot(host);
    renderTree({ root: secondRoot });
    await act(async () => {});

    expect(listFileManagerDirectory).toHaveBeenCalledTimes(2);
    expect(document.body.textContent).toContain('A-dir');
    expect(document.body.textContent).toContain('deep.wav');
    expect(
      findRow('/Users/me')!.closest('[role="treeitem"]')!.getAttribute('aria-expanded'),
    ).toBe('true');

    // Collapse bookkeeping still works against the restored open state.
    await clickSingle(findRow('/Users/me'));
    expect(document.body.textContent).not.toContain('deep.wav');

    act(() => { secondRoot.unmount(); });
    host.remove();
  });

  it('routes a double-clicked supported audio file to the Audio File Player', async () => {
    const received: string[] = [];
    const unsubscribe = subscribePendingAudioFile((path) => { received.push(path); });
    listFileManagerDirectory.mockResolvedValue(
      directoryResult('/Users/me', [
        { name: 'A-dir', kind: 'directory' },
        { name: 'song.wav', kind: 'file' },
        { name: 'notes.txt', kind: 'file' },
      ]),
    );

    act(() => {
      root!.render(<FileManagerPanel />);
    });
    await act(async () => {});
    await clickSingle(findRow('/Users/me'));

    const doubleClick = async (label: string) => {
      const row = findRow(label)!;
      await act(async () => {
        row.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
      });
    };

    await doubleClick('song.wav');
    expect(authorizeAudioFile).toHaveBeenCalledExactlyOnceWith('/Users/me/song.wav');
    expect(openPanel).toHaveBeenCalledExactlyOnceWith('AudioFilePlayerTopComponent');
    expect(received).toEqual(['/Users/me/song.wav']);

    // Unsupported files and directories do not open the player.
    openPanel.mockClear();
    await doubleClick('notes.txt');
    await doubleClick('A-dir');
    expect(openPanel).not.toHaveBeenCalled();
    expect(received).toEqual(['/Users/me/song.wav']);

    unsubscribe();
  });

  it('routes a double-clicked .sf2 file to the SoundFont Viewer', async () => {
    const soundFonts: string[] = [];
    const unsubscribeSoundFont = subscribePendingSoundFontFile((path) => { soundFonts.push(path); });
    listFileManagerDirectory.mockResolvedValue(
      directoryResult('/Users/me', [
        { name: 'piano.sf2', kind: 'file' },
        { name: 'song.wav', kind: 'file' },
      ]),
    );

    act(() => {
      root!.render(<FileManagerPanel />);
    });
    await act(async () => {});
    await clickSingle(findRow('/Users/me'));

    await act(async () => {
      findRow('piano.sf2')!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
    });
    expect(openPanel).toHaveBeenCalledExactlyOnceWith('SoundFontViewerTopComponent');
    expect(soundFonts).toEqual(['/Users/me/piano.sf2']);
    // The .sf2 path never touches the audio player authorization flow.
    expect(authorizeAudioFile).not.toHaveBeenCalled();

    unsubscribeSoundFont();
  });

  it('does not open the player when main refuses to authorize the file', async () => {
    authorizeAudioFile.mockResolvedValue(false);
    const received: string[] = [];
    const unsubscribe = subscribePendingAudioFile((path) => { received.push(path); });
    listFileManagerDirectory.mockResolvedValue(
      directoryResult('/Users/me', [{ name: 'song.wav', kind: 'file' }]),
    );

    act(() => {
      root!.render(<FileManagerPanel />);
    });
    await act(async () => {});
    await clickSingle(findRow('/Users/me'));

    await act(async () => {
      findRow('song.wav')!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
    });

    expect(authorizeAudioFile).toHaveBeenCalledOnce();
    expect(openPanel).not.toHaveBeenCalled();
    expect(received).toEqual([]);

    unsubscribe();
  });

  describe('root labels and context-menu rename modal (US5)', () => {
    it('renders roots in Label - /path format with an unnamed fallback and muted paths', async () => {
      getFileManagerRoots.mockResolvedValue([
        { id: '/', path: '/', label: 'Root', kind: 'static', available: true, isDirectory: true },
        { id: '/Users/me', path: '/Users/me', label: 'Home', kind: 'static', available: true, isDirectory: true },
        { id: '/Volumes/media', path: '/Volumes/media', label: '/Volumes/media', kind: 'favorite', available: true, isDirectory: true },
        { id: '/Volumes/samples', path: '/Volumes/samples', label: 'Samples', kind: 'favorite', available: true, isDirectory: true },
      ]);

      act(() => {
        root!.render(<FileManagerPanel />);
      });
      await act(async () => {});

      const text = document.body.textContent ?? '';
      expect(text).toContain('Root - /');
      expect(text).toContain('Home - /Users/me');
      expect(text).toContain('Unnamed Root - /Volumes/media');
      expect(text).toContain('Samples - /Volumes/samples');

      const homeRow = findRow('Home - /Users/me');
      expect(homeRow?.querySelector('.text-app-text-muted')?.textContent).toContain(' - /Users/me');
    });

    it('opens Rename Root from the context menu and saves the modal label', async () => {
      getProgramSettings.mockResolvedValue({
        version: 3,
        appSpecific: { fileManagerRootLabels: {} },
      });
      saveProgramSettings.mockResolvedValue({ ok: true });

      act(() => {
        root!.render(<FileManagerPanel />);
      });
      await act(async () => {});

      const homeRow = findRow('Home - /Users/me');
      expect(homeRow).not.toBeNull();

      const dialog = await openRootRenameDialog(homeRow);
      expect(dialog.textContent).toContain('Rename Root');
      expect(dialog.textContent).toContain('/Users/me');
      const input = dialog.querySelector<HTMLInputElement>('input[name="fileManagerRootLabel"]');
      expect(input?.value).toBe('Home');

      await setTextInputValue(input!, 'My Home Directory');
      await act(async () => {
        dialog.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
      });

      expect(saveProgramSettings).toHaveBeenCalledOnce();
      const saved = saveProgramSettings.mock.calls[0]![0] as {
        appSpecific: { fileManagerRootLabels: Record<string, string> };
      };
      expect(saved.appSpecific.fileManagerRootLabels['/Users/me']).toBe('My Home Directory');
      expect(getFileManagerRoots).toHaveBeenCalledTimes(2);
    });

    it('reverts to the unnamed label when an empty modal label is submitted', async () => {
      getProgramSettings.mockResolvedValue({
        version: 3,
        appSpecific: {
          fileManagerRootLabels: {
            '/Users/me': 'Custom Label',
          },
        },
      });
      saveProgramSettings.mockResolvedValue({ ok: true });

      act(() => {
        root!.render(<FileManagerPanel />);
      });
      await act(async () => {});

      const homeRow = findRow('Home - /Users/me');
      const dialog = await openRootRenameDialog(homeRow);
      const input = dialog.querySelector<HTMLInputElement>('input[name="fileManagerRootLabel"]');
      expect(input).not.toBeNull();

      await setTextInputValue(input!, '   ');
      await act(async () => {
        dialog.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
      });

      expect(saveProgramSettings).toHaveBeenCalledOnce();
      const saved = saveProgramSettings.mock.calls[0]![0] as {
        appSpecific: { fileManagerRootLabels: Record<string, string> };
      };
      expect(saved.appSpecific.fileManagerRootLabels['/Users/me']).toBeUndefined();
      expect(getFileManagerRoots).toHaveBeenCalledTimes(2);
    });

    it('cancels the root rename modal without saving', async () => {
      act(() => {
        root!.render(<FileManagerPanel />);
      });
      await act(async () => {});

      const homeRow = findRow('Home - /Users/me');
      const dialog = await openRootRenameDialog(homeRow);

      await act(async () => {
        dialog.querySelector<HTMLButtonElement>('button[type="button"]')!.click();
      });

      expect(saveProgramSettings).not.toHaveBeenCalled();
      expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    });

    it('keeps the previous label and root list when settings save fails', async () => {
      getProgramSettings.mockResolvedValue({
        version: 3,
        appSpecific: { fileManagerRootLabels: {} },
      });
      saveProgramSettings.mockResolvedValue({ ok: false });

      act(() => {
        root!.render(<FileManagerPanel />);
      });
      await act(async () => {});

      const homeRow = findRow('Home - /Users/me');
      const dialog = await openRootRenameDialog(homeRow);
      const input = dialog.querySelector<HTMLInputElement>('input[name="fileManagerRootLabel"]');
      await setTextInputValue(input!, 'Failed Name');
      await act(async () => {
        dialog.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
      });

      expect(saveProgramSettings).toHaveBeenCalledOnce();
      // Roots are NOT refreshed on save failure
      expect(getFileManagerRoots).toHaveBeenCalledOnce();
    });
  });

  describe('focus navigation and breadcrumb bar (US5)', () => {
    it('focuses a root on double-click without committing the single-click toggle first', async () => {
      listFileManagerDirectory.mockResolvedValue(
        directoryResult('/Users/me', [{ name: 'Projects', kind: 'directory' }]),
      );

      act(() => {
        root!.render(<FileManagerPanel />);
      });
      await act(async () => {});

      const homeRow = findRow('Home - /Users/me');
      expect(homeRow).not.toBeNull();

      await act(async () => {
        homeRow!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        await new Promise((resolve) => setTimeout(resolve, 50));
      });
      expect(listFileManagerDirectory).not.toHaveBeenCalled();

      await act(async () => {
        homeRow!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
      });
      await act(async () => {});

      expect(sessionTreeState.focusedNodeId).toBe('/Users/me');
      expect(sessionTreeState.openIds).toEqual(new Set(['/Users/me']));
      expect(document.body.querySelector('nav[aria-label="Breadcrumb"]')).not.toBeNull();
      expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    });

    it('focuses a nested folder on double-click, shows breadcrumb, and navigates back to roots', async () => {
      listFileManagerDirectory.mockImplementation(async ({ path }: { path: string }) => {
        if (path === '/Users/me') {
          return directoryResult('/Users/me', [{ name: 'Projects', kind: 'directory' }]);
        }
        if (path === '/Users/me/Projects') {
          return directoryResult('/Users/me/Projects', [
            { name: 'Audio', kind: 'directory' },
            { name: 'track.wav', kind: 'file' },
          ]);
        }
        if (path === '/Users/me/Projects/Audio') {
          return directoryResult('/Users/me/Projects/Audio', [{ name: 'take1.wav', kind: 'file' }]);
        }
        return { status: 'error', directoryPath: path, code: 'not-found', message: 'Not found' };
      });

      act(() => {
        root!.render(<FileManagerPanel />);
      });
      await act(async () => {});

      // Breadcrumb is NOT visible at root level
      expect(document.body.querySelector('nav[aria-label="Breadcrumb"]')).toBeNull();

      // Expand Home root
      await clickSingle(findRow('Home - /Users/me'));
      expect(document.body.textContent).toContain('Projects');

      // Double-click Projects to focus it
      const projectsRow = findRow('Projects');
      expect(projectsRow).not.toBeNull();
      await act(async () => {
        projectsRow!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
      });
      await act(async () => {});

      // Breadcrumb bar is now visible with Roots > Home > Projects
      const breadcrumb = document.body.querySelector('nav[aria-label="Breadcrumb"]');
      expect(breadcrumb).not.toBeNull();
      expect(breadcrumb?.textContent).toContain('Roots');
      expect(breadcrumb?.textContent).toContain('Home');
      expect(breadcrumb?.textContent).toContain('Projects');

      // Tree now focuses Projects as the top-level node and displays its children
      expect(document.body.textContent).toContain('Audio');
      expect(document.body.textContent).toContain('track.wav');

      // Double-click Audio to focus deeper
      const audioRow = findRow('Audio');
      expect(audioRow).not.toBeNull();
      await act(async () => {
        audioRow!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
      });
      await act(async () => {});

      expect(breadcrumb?.textContent).toContain('Audio');
      expect(document.body.textContent).toContain('take1.wav');

      // Click 'Projects' breadcrumb segment to navigate back to Projects
      const projectsButton = Array.from(breadcrumb!.querySelectorAll<HTMLElement>('button'))
        .find((btn) => btn.textContent?.includes('Projects'));
      expect(projectsButton).toBeTruthy();
      await act(async () => {
        projectsButton!.click();
      });
      await act(async () => {});

      expect(breadcrumb?.textContent).toContain('Projects');
      expect(breadcrumb?.textContent).not.toContain('take1.wav');
      expect(document.body.textContent).toContain('Audio');

      // Click 'Roots' breadcrumb segment to return to the full roots view
      const rootsButton = Array.from(breadcrumb!.querySelectorAll<HTMLElement>('button'))
        .find((btn) => btn.textContent?.includes('Roots'));
      expect(rootsButton).toBeTruthy();
      await act(async () => {
        rootsButton!.click();
      });
      await act(async () => {});

      // Breadcrumb bar disappears in roots view
      expect(document.body.querySelector('nav[aria-label="Breadcrumb"]')).toBeNull();
      expect(document.body.textContent).toContain('Root - /');
      expect(document.body.textContent).toContain('Home - /Users/me');
      expect(document.body.textContent).toContain('/Volumes/media');
    });

    it('preserves focused view state across remounts', async () => {
      listFileManagerDirectory.mockImplementation(async ({ path }: { path: string }) => {
        if (path === '/Users/me') {
          return directoryResult('/Users/me', [{ name: 'Projects', kind: 'directory' }]);
        }
        return directoryResult('/Users/me/Projects', [{ name: 'song.wav', kind: 'file' }]);
      });

      const renderTree = (target: { root: Root }) => {
        act(() => {
          target.root.render(<FileManagerPanel />);
        });
      };

      renderTree({ root: root! });
      await act(async () => {});

      await clickSingle(findRow('Home - /Users/me'));

      await act(async () => {
        findRow('Projects')!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
      });
      await act(async () => {});

      expect(document.body.querySelector('nav[aria-label="Breadcrumb"]')).not.toBeNull();
      expect(document.body.textContent).toContain('song.wav');

      // Unmount and remount (simulating panel tab change or docked/slideout move)
      act(() => { root!.unmount(); });
      container!.remove();
      const host = document.createElement('div');
      document.body.appendChild(host);
      const secondRoot = createRoot(host);
      renderTree({ root: secondRoot });
      await act(async () => {});

      // Focused view and breadcrumbs are restored from session memory
      expect(document.body.querySelector('nav[aria-label="Breadcrumb"]')).not.toBeNull();
      expect(document.body.textContent).toContain('Projects');
      expect(document.body.textContent).toContain('song.wav');

      act(() => { secondRoot.unmount(); });
      host.remove();
    });

    it('allows audio drag, context menu, and tool opening inside focused view', async () => {
      const receivedAudio: string[] = [];
      const unsub = subscribePendingAudioFile((path) => { receivedAudio.push(path); });
      listFileManagerDirectory.mockImplementation(async ({ path }: { path: string }) => {
        if (path === '/Users/me') {
          return directoryResult('/Users/me', [{ name: 'Projects', kind: 'directory' }]);
        }
        return directoryResult('/Users/me/Projects', [
          { name: 'SubDir', kind: 'directory' },
          { name: 'song.wav', kind: 'file' },
        ]);
      });

      act(() => {
        root!.render(<FileManagerPanel />);
      });
      await act(async () => {});

      await clickSingle(findRow('Home - /Users/me'));
      await act(async () => {
        findRow('Projects')!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
      });
      await act(async () => {});

      // 1. Context menu inside focused view
      await act(async () => {
        findRow('SubDir')!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
      });
      const menuItems = Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'))
        .map((item) => item.textContent ?? '');
      expect(menuItems).toEqual(['Refresh Folder', 'Add to Favorites']);
      await act(async () => {
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      });

      // 2. Drag regular file inside focused view
      const fileRow = findRow('song.wav');
      expect(fileRow).not.toBeNull();
      const payloadByType: Record<string, string> = {};
      const dataTransfer = {
        types: [] as string[],
        files: [] as File[],
        dropEffect: 'none',
        effectAllowed: 'none',
        getData: (type: string) => payloadByType[type] ?? '',
        setData: (type: string, value: string) => { payloadByType[type] = value; },
      };
      const dragEvent = new Event('dragstart', { bubbles: true, cancelable: true });
      Object.defineProperty(dragEvent, 'dataTransfer', { value: dataTransfer });
      act(() => {
        fileRow!.dispatchEvent(dragEvent);
      });
      expect(dataTransfer.effectAllowed).toBe('copy');
      expect(dataTransfer.getData('application/x-blue-file-manager-file')).toContain('song.wav');

      // 3. Double-click audio file routes to Audio File Player
      await act(async () => {
        fileRow!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
      });
      expect(openPanel).toHaveBeenCalledWith('AudioFilePlayerTopComponent');
      expect(receivedAudio).toEqual(['/Users/me/Projects/song.wav']);

      unsub();
    });

    it('records the scroll offset through the virtualized list and restores it on remount (T037)', async () => {
      const scrollableRoots: FileManagerRootSnapshot[] = Array.from({ length: 40 }, (_, index) => ({
        id: `/Volumes/root-${index}`,
        path: `/Volumes/root-${index}`,
        label: `/Volumes/root-${index}`,
        kind: 'favorite',
        available: true,
        isDirectory: true,
      }));
      getFileManagerRoots.mockResolvedValue(scrollableRoots);

      const renderTree = (target: { root: Root }) => {
        act(() => {
          target.root.render(<FileManagerPanel />);
        });
      };
      const scroller = () =>
        document.querySelector<HTMLElement>('div[style*="overflow: auto"]');
      const setListMetrics = (element: HTMLElement) => {
        Object.defineProperties(element, {
          clientHeight: { configurable: true, value: 400 },
          scrollHeight: { configurable: true, value: scrollableRoots.length * 24 },
        });
      };

      renderTree({ root: root! });
      await act(async () => {});
      const firstScroller = scroller();
      expect(firstScroller).not.toBeNull();

      // Scroll the virtualized list: react-window reads scrollTop from the
      // scroll event's currentTarget and reports it through the Tree's
      // onScroll prop into the session cache.
      await act(async () => {
        const el = firstScroller!;
        setListMetrics(el);
        el.scrollTop = 120;
        el.dispatchEvent(new Event('scroll', { bubbles: true }));
      });
      expect(sessionTreeState.scrollOffset).toBe(120);

      // Unmount and remount into a fresh container (panel move/remount).
      act(() => { root!.unmount(); });
      container!.remove();
      const host = document.createElement('div');
      document.body.appendChild(host);
      const secondRoot = createRoot(host);
      renderTree({ root: secondRoot });
      await act(async () => {});
      const secondScroller = scroller();
      expect(secondScroller).not.toBeNull();
      setListMetrics(secondScroller!);
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      // The restore effect scrolls the fresh list back to the cached offset.
      expect(sessionTreeState.scrollOffset).toBe(120);
      expect(scroller()?.scrollTop ?? 0).toBe(120);

      act(() => { secondRoot.unmount(); });
      host.remove();
    });

    it('restores the roots view state after navigating through the root breadcrumb segment', async () => {
      listFileManagerDirectory.mockImplementation(async ({ path }: { path: string }) => {
        if (path === '/Users/me') {
          return directoryResult('/Users/me', [{ name: 'Projects', kind: 'directory' }]);
        }
        return directoryResult('/Users/me/Projects', [{ name: 'song.wav', kind: 'file' }]);
      });

      act(() => {
        root!.render(<FileManagerPanel />);
      });
      await act(async () => {});

      // Expand Home in the roots view, then focus Projects directly: the Home
      // root itself was never focused, so it has no saved level state.
      await clickSingle(findRow('Home - /Users/me'));
      await act(async () => {
        findRow('Projects')!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
      });
      await act(async () => {});
      expect(document.body.querySelector('nav[aria-label="Breadcrumb"]')).not.toBeNull();

      // Click the ROOT segment (Home, index 0): a never-focused level gets a
      // fresh focused view and must not consume the roots-view snapshot.
      const breadcrumb = document.body.querySelector('nav[aria-label="Breadcrumb"]')!;
      const homeButton = Array.from(breadcrumb.querySelectorAll<HTMLElement>('button'))
        .find((btn) => btn.textContent === 'Home')!;
      expect(homeButton).toBeTruthy();
      await act(async () => { homeButton.click(); });
      await act(async () => {});
      expect(document.body.textContent).toContain('Projects');

      // Returning to Roots must restore the roots view exactly as left
      // (Home expanded, Projects visible).
      const rootsButton = Array.from(document.body.querySelectorAll<HTMLElement>('button'))
        .find((btn) => btn.textContent === 'Roots')!;
      expect(rootsButton).toBeTruthy();
      await act(async () => { rootsButton.click(); });
      await act(async () => {});

      expect(document.body.querySelector('nav[aria-label="Breadcrumb"]')).toBeNull();
      const text = document.body.textContent ?? '';
      expect(text).toContain('Home - /Users/me');
      expect(text).toContain('Projects');
    });
  });
});
