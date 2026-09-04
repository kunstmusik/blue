// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Effect } from '@blue/data';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChannelStrip from '../components/workbench/panels/mixer/ChannelStrip';
import { useLibraryStore } from '../stores/library-store';
import type { MixerChannelSnapshot, MixerSnapshot } from '../../shared/project-editor';
import { BLUE_LIBRARY_DRAG_MIME } from '../components/libraries/library-drag-drop';
import { createTestDataTransfer, dispatchDragEvent } from './library-interaction-test-helpers';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const effect = new Effect();
effect.setName('Existing');
const existingEffect = {
  kind: 'effect' as const,
  entryId: 'pre-1',
  name: 'Existing',
  enabled: true,
  numIns: 2,
  numOuts: 2,
  style: 'CLASSIC' as const,
  code: '',
  comments: '',
  effectXml: effect.saveAsXML().toXml(),
  editEnabled: false,
  gridSettings: {
    enabled: false,
    snapEnabled: false,
    width: 10,
    height: 10,
    gridStyle: 'dots' as const,
  },
  objectNames: [],
  widgets: [],
  widgetTree: {
    id: 'root',
    type: 'BSBGroup',
    objectName: 'root',
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    visible: true,
    comment: '',
    children: [],
  },
};
const channel: MixerChannelSnapshot = {
  id: 'channel-1',
  name: 'Lead',
  channelKind: 'instrument',
  association: '1',
  outChannel: 'Master',
  muted: false,
  solo: false,
  level: 0,
  volume: 1,
  pan: 0.5,
  preChain: [existingEffect],
  postChain: [],
};
const mixer: MixerSnapshot = {
  enabled: true,
  extraRenderTime: 0,
  channelListGroups: [],
  channels: [channel],
  subChannels: [],
  master: {
    ...channel,
    id: 'master',
    name: 'Master',
    channelKind: 'master',
    association: undefined,
    preChain: [],
    postChain: [],
  },
};

const previewLibraryTransfer = vi.fn(async (request) => ({
  ok: true as const,
  value: {
    previewToken: 'effect-preview',
    item: {
      key: { scope: 'user' as const, libraryType: 'effect' as const, nodeId: 'effect-1' },
      displayName: 'Delay',
      libraryType: 'effect' as const,
      scope: 'user' as const,
      objectType: 'Effect',
      supportStatus: 'supported' as const,
      supportMessage: null,
      fields: {},
      dependencies: { itemOwned: [], unresolvedExternal: [] },
    },
    target: request.target,
    requestedMode: 'independent' as const,
    allowedModes: ['independent'] as const,
    canApply: true,
    blockingReasons: [],
  },
}));
const applyLibraryTransfer = vi.fn(async () => ({
  ok: true as const,
  value: {
    projectSessionId: 4,
    projectRevision: 10,
    libraryType: 'effect' as const,
    insertedIdentity: 'entry-2',
    message: 'Effect added.',
  },
}));
const onPatch = vi.fn();
const projectEffectNode = {
  key: {
    scope: 'projectOwned' as const,
    libraryType: 'effect' as const,
    projectSessionId: 4,
    locator: {
      kind: 'effect' as const,
      channelId: 'channel-1',
      chain: 'pre' as const,
      entryId: 'pre-1',
    },
  },
  nodeId: 'project-effect-pre-1',
  parentId: 'project-effects',
  libraryType: 'effect' as const,
  scope: 'projectOwned' as const,
  nodeKind: 'item' as const,
  displayName: 'Existing',
  breadcrumb: ['Lead', 'Pre Effects'],
  supportStatus: 'supported' as const,
  objectType: 'Effect',
  revision: 'effect-hash',
  hasChildren: false,
};

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  previewLibraryTransfer.mockClear();
  applyLibraryTransfer.mockClear();
  onPatch.mockClear();
  window.blueAPI = {
    ...window.blueAPI,
    beginLibraryDrag: vi.fn(async () => ({
      ok: true as const,
      value: { expiresAt: Date.now() + 30_000 },
    })),
    cancelLibraryDrag: vi.fn(async () => ({ ok: true as const, value: undefined })),
    previewLibraryTransfer,
    applyLibraryTransfer,
    previewProjectLibraryDelete: vi.fn(async () => ({
      ok: true as const,
      value: {
        confirmationToken: 'cut-project-effect',
        linkedInstanceCount: 0,
        locations: [],
        requiresConfirmation: true,
      },
    })),
    cutLibraryToClipboard: vi.fn(async () => ({
      ok: true as const,
      value: {
        clipboard: {
          operation: 'cut' as const,
          source: {
            kind: 'buffer' as const,
            clipboardId: 'effect-buffer',
            libraryType: 'effect' as const,
          },
          capturedAt: 100,
        },
        closedEditorSessionIds: [],
      },
    })),
    browseLibraries: vi.fn(async (request) => ({
      ok: true as const,
      value: {
        contentRevision: 1,
        parent: {
          key: null,
          nodeId: `root-${request.parent.libraryType}`,
          parentId: null,
          libraryType: request.parent.libraryType,
          scope: 'user' as const,
          nodeKind: 'root' as const,
          displayName: 'Root',
          breadcrumb: ['Root'],
          revision: 1,
          hasChildren: false,
        },
        children: [],
        nextCursor: null,
      },
    })),
    sendMixerRealtimeLevelUpdate: vi.fn(async () => undefined),
    focusEffectEditor: vi.fn(async () => false),
    openEffectInterface: vi.fn(async () => undefined),
  };
  useLibraryStore.setState({
    clipboard: {
      operation: 'copy',
      source: { kind: 'userNode', libraryType: 'effect', nodeId: 'effect-1', revision: 1 },
      capturedAt: 1,
    },
    transferPreview: null,
    transferSource: null,
    error: null,
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(
      <ChannelStrip
        mixer={mixer}
        channel={channel}
        isMaster={false}
        isSubChannel={false}
        onPatch={onPatch}
        projectSessionId={4}
        projectRevision={9}
        onOpenEffectInterface={vi.fn()}
        projectEffectNodes={[projectEffectNode]}
      />,
    );
  });
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  document.body.replaceChildren();
});

describe('mixer Library drop targets', () => {
  it('offers every pre/post gap and pastes against the exact chain revision', async () => {
    expect(container.querySelectorAll('[aria-label*="Insert Effect"]')).toHaveLength(3);
    const preEnd = container.querySelector(
      '[aria-label="Insert Effect at end of Pre chain; paste a Library item here"]',
    ) as HTMLElement;
    await act(async () => {
      preEnd.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'v', ctrlKey: true }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(previewLibraryTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        target: {
          kind: 'effectChain',
          projectSessionId: 4,
          projectRevision: 9,
          channelId: 'channel-1',
          chain: 'pre',
          insertIndex: 1,
          chainRevision: 'pre-1',
        },
      }),
    );
    expect(applyLibraryTransfer).toHaveBeenCalledWith('effect-preview');
  });

  it('does not apply when the service rejects a stale chain', async () => {
    previewLibraryTransfer.mockResolvedValueOnce({
      ok: false,
      error: { code: 'stale-target', message: 'The Effect chain changed.', retryable: false },
    });
    const postEnd = container.querySelector(
      '[aria-label="Insert Effect at end of Post chain; paste a Library item here"]',
    ) as HTMLElement;
    await act(async () => {
      postEnd.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'v', ctrlKey: true }),
      );
      await Promise.resolve();
    });
    expect(applyLibraryTransfer).not.toHaveBeenCalled();
    expect(useLibraryStore.getState().error).toMatch(/chain changed/i);
  });

  it('accepts direct effect drop and Library paste from the chain menu', async () => {
    const row = container.querySelector('[data-library-drop-target="effect-row"]') as HTMLElement;
    const transfer = createTestDataTransfer();
    transfer.setData(
      BLUE_LIBRARY_DRAG_MIME,
      JSON.stringify({
        dragSessionId: 'drag-effect',
        libraryType: 'effect',
      }),
    );
    dispatchDragEvent(row, 'dragover', transfer);
    dispatchDragEvent(row, 'drop', transfer);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(previewLibraryTransfer).toHaveBeenLastCalledWith(
      expect.objectContaining({
        source: { kind: 'drag', dragSessionId: 'drag-effect' },
        target: {
          kind: 'effectChain',
          projectSessionId: 4,
          projectRevision: 9,
          channelId: 'channel-1',
          chain: 'pre',
          insertIndex: 1,
          chainRevision: 'pre-1',
        },
      }),
    );

    previewLibraryTransfer.mockClear();
    act(() => row.click());
    act(() =>
      row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })),
    );
    await act(async () => {
      await Promise.resolve();
    });
    const paste = [...document.body.querySelectorAll('[role="menuitem"]')].find(
      (item) => item.textContent === 'Paste',
    ) as HTMLElement;
    expect(paste?.getAttribute('aria-disabled')).not.toBe('true');
    expect(document.body.textContent).not.toContain('Paste Library Effect');
    act(() => paste.click());
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(previewLibraryTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        source: expect.objectContaining({ kind: 'clipboard' }),
        target: expect.objectContaining({ kind: 'effectChain', insertIndex: 1 }),
      }),
    );
  });

  it('accepts a direct effect drop into an empty effects chain', async () => {
    const postEnd = container.querySelector(
      '[aria-label="Insert Effect at end of Post chain; paste a Library item here"]',
    ) as HTMLElement;
    expect(postEnd.closest('[data-library-list-end-drop-target]')).not.toBeNull();
    expect(postEnd.className).toContain('flex-1');
    expect(postEnd.closest('[data-mixer-insert-index]')?.className).toContain('flex-1');
    const transfer = createTestDataTransfer();
    transfer.setData(
      BLUE_LIBRARY_DRAG_MIME,
      JSON.stringify({
        dragSessionId: 'drag-empty-effect',
        libraryType: 'effect',
      }),
    );
    dispatchDragEvent(postEnd, 'dragover', transfer);
    expect(postEnd.className).toContain('ring-app-accent');
    dispatchDragEvent(postEnd, 'drop', transfer);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(previewLibraryTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        source: { kind: 'drag', dragSessionId: 'drag-empty-effect' },
        target: {
          kind: 'effectChain',
          projectSessionId: 4,
          projectRevision: 9,
          channelId: 'channel-1',
          chain: 'post',
          insertIndex: 0,
          chainRevision: '',
        },
      }),
    );
  });

  it('shows the full chain menu when right-clicking unused Effect-bin space', async () => {
    const postEnd = container.querySelector(
      '[aria-label="Insert Effect at end of Post chain; paste a Library item here"]',
    ) as HTMLElement;
    act(() =>
      postEnd.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })),
    );
    await act(async () => {
      await Promise.resolve();
    });

    expect(document.body.textContent).toContain('Add New Effect');
    expect(document.body.textContent).toContain('Add Send');
    expect(document.body.textContent).toContain('Paste');
    expect(document.body.textContent).toContain('Remove');
  });

  it('captures Mixer Effect Copy and Cut in the shared Library buffer', async () => {
    const row = container.querySelector('[data-library-drop-target="effect-row"]') as HTMLElement;
    act(() => row.click());
    act(() =>
      row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })),
    );
    await act(async () => {
      await Promise.resolve();
    });
    const copy = [...document.body.querySelectorAll('[role="menuitem"]')].find(
      (item) => item.textContent === 'Copy',
    ) as HTMLElement;
    act(() => copy.click());
    expect(useLibraryStore.getState().clipboard).toMatchObject({
      operation: 'copy',
      source: { kind: 'library', key: projectEffectNode.key },
    });

    act(() =>
      row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })),
    );
    await act(async () => {
      await Promise.resolve();
    });
    const cut = [...document.body.querySelectorAll('[role="menuitem"]')].find(
      (item) => item.textContent === 'Cut',
    ) as HTMLElement;
    await act(async () => {
      cut.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(useLibraryStore.getState().clipboard).toMatchObject({
      operation: 'cut',
      source: { kind: 'buffer', clipboardId: 'effect-buffer', libraryType: 'effect' },
    });
    expect(onPatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'removeChainEntry' }));
  });

  it('moves a project Effect between chains without copying it', async () => {
    act(() => {
      root.render(
        <ChannelStrip
          mixer={mixer}
          channel={channel}
          isMaster={false}
          isSubChannel={false}
          onPatch={onPatch}
          projectSessionId={4}
          projectRevision={9}
          onOpenEffectInterface={vi.fn()}
          projectEffectNodes={[]}
        />,
      );
    });
    const row = container.querySelector('[data-library-drop-target="effect-row"]') as HTMLElement;
    act(() => row.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })));
    const transfer = createTestDataTransfer();
    dispatchDragEvent(row, 'dragstart', transfer);
    const postEnd = container.querySelector(
      '[aria-label="Insert Effect at end of Post chain; paste a Library item here"]',
    ) as HTMLElement;
    dispatchDragEvent(postEnd, 'dragover', transfer);
    dispatchDragEvent(postEnd, 'drop', transfer);
    expect(onPatch).toHaveBeenCalledWith({
      type: 'moveChainEntryAcrossChains',
      fromChannelId: 'channel-1',
      fromChain: 'pre',
      toChannelId: 'channel-1',
      toChain: 'post',
      entryId: 'pre-1',
      index: 0,
    });
    expect(previewLibraryTransfer).not.toHaveBeenCalled();
  });

  it('clears Library insertion highlights after an internal Effect move consumes the drop', () => {
    const postEnd = container.querySelector(
      '[aria-label="Insert Effect at end of Post chain; paste a Library item here"]',
    ) as HTMLElement;
    const transfer = createTestDataTransfer();
    transfer.setData(
      BLUE_LIBRARY_DRAG_MIME,
      JSON.stringify({
        dragSessionId: 'drag-effect',
        libraryType: 'effect',
      }),
    );
    dispatchDragEvent(postEnd, 'dragover', transfer);
    expect(postEnd.classList.contains('ring-app-accent')).toBe(true);

    transfer.setData(
      'application/x-blue-mixer-effect',
      JSON.stringify({
        channelId: 'channel-1',
        chain: 'pre',
        entryId: 'pre-1',
      }),
    );
    dispatchDragEvent(postEnd, 'drop', transfer);
    expect(postEnd.classList.contains('ring-app-accent')).toBe(false);
  });

  it('does not move an Effect when it is dropped back at its current boundary', () => {
    const row = container.querySelector('[data-library-drop-target="effect-row"]') as HTMLElement;
    act(() => row.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })));
    const transfer = createTestDataTransfer();
    dispatchDragEvent(row, 'dragstart', transfer);
    dispatchDragEvent(row, 'dragover', transfer);
    dispatchDragEvent(row, 'drop', transfer);
    expect(onPatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'moveChainEntryAcrossChains' }),
    );
  });
});
