// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Effect } from '@blue/data';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChannelStrip from '../components/workbench/panels/mixer/ChannelStrip';
import { useLibraryStore } from '../stores/library-store';
import type { MixerChannelSnapshot, MixerSnapshot } from '../../shared/project-editor';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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
  gridSettings: { enabled: false, snapEnabled: false, width: 10, height: 10, gridStyle: 'dots' as const },
  objectNames: [],
  widgets: [],
  widgetTree: { id: 'root', type: 'BSBGroup', objectName: 'root', x: 0, y: 0, width: 0, height: 0, visible: true, comment: '', children: [] },
};
const channel: MixerChannelSnapshot = {
  id: 'channel-1', name: 'Lead', channelKind: 'instrument', association: '1', outChannel: 'Master',
  muted: false, solo: false, level: 0, volume: 1, pan: 0.5,
  preChain: [existingEffect], postChain: [],
};
const mixer: MixerSnapshot = {
  enabled: true, extraRenderTime: 0, channelListGroups: [], channels: [channel], subChannels: [],
  master: { ...channel, id: 'master', name: 'Master', channelKind: 'master', association: undefined, preChain: [], postChain: [] },
};

const previewLibraryTransfer = vi.fn(async (request) => ({
  ok: true as const,
  value: {
    previewToken: 'effect-preview',
    item: {
      key: { scope: 'user' as const, libraryType: 'effect' as const, nodeId: 'effect-1' },
      displayName: 'Delay', libraryType: 'effect' as const, scope: 'user' as const,
      objectType: 'Effect', supportStatus: 'supported' as const, supportMessage: null,
      fields: {}, dependencies: { itemOwned: [], unresolvedExternal: [] },
    },
    target: request.target, requestedMode: 'independent' as const,
    allowedModes: ['independent'] as const, canApply: true, blockingReasons: [],
  },
}));
const applyLibraryTransfer = vi.fn(async () => ({
  ok: true as const,
  value: { projectSessionId: 4, projectRevision: 10, libraryType: 'effect' as const, insertedIdentity: 'entry-2', message: 'Effect added.' },
}));

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  previewLibraryTransfer.mockClear();
  applyLibraryTransfer.mockClear();
  window.blueAPI = {
    ...window.blueAPI,
    previewLibraryTransfer,
    applyLibraryTransfer,
    sendMixerRealtimeLevelUpdate: vi.fn(async () => undefined),
    focusEffectEditor: vi.fn(async () => false),
    openEffectInterface: vi.fn(async () => undefined),
  };
  useLibraryStore.setState({
    clipboard: { operation: 'copy', source: { kind: 'userNode', libraryType: 'effect', nodeId: 'effect-1', revision: 1 }, capturedAt: 1 },
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
        onPatch={vi.fn()}
        projectSessionId={4}
        projectRevision={9}
        onOpenEffectInterface={vi.fn()}
      />,
    );
  });
});

afterEach(() => {
  act(() => { root.unmount(); });
  document.body.replaceChildren();
});

describe('mixer Library drop targets', () => {
  it('offers every pre/post gap and pastes against the exact chain revision', async () => {
    expect(container.querySelectorAll('[aria-label*="Insert Effect"]')).toHaveLength(3);
    const preEnd = container.querySelector('[aria-label="Insert Effect at end of Pre chain; paste a Library item here"]') as HTMLElement;
    await act(async () => {
      preEnd.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'v', ctrlKey: true }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(previewLibraryTransfer).toHaveBeenCalledWith(expect.objectContaining({
      target: {
        kind: 'effectChain', projectSessionId: 4, projectRevision: 9,
        channelId: 'channel-1', chain: 'pre', insertIndex: 1, chainRevision: 'pre-1',
      },
    }));
    expect(applyLibraryTransfer).toHaveBeenCalledWith('effect-preview');
  });

  it('does not apply when the service rejects a stale chain', async () => {
    previewLibraryTransfer.mockResolvedValueOnce({
      ok: false,
      error: { code: 'stale-target', message: 'The Effect chain changed.', retryable: false },
    });
    const postEnd = container.querySelector('[aria-label="Insert Effect at end of Post chain; paste a Library item here"]') as HTMLElement;
    await act(async () => {
      postEnd.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'v', ctrlKey: true }));
      await Promise.resolve();
    });
    expect(applyLibraryTransfer).not.toHaveBeenCalled();
    expect(useLibraryStore.getState().error).toMatch(/chain changed/i);
  });
});
