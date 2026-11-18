// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BlueData, Channel, Effect, GenericInstrument } from '@blue/data';
import type { LibraryBrowseNode } from '../../shared/unified-library';
import { createProjectEditorSnapshot } from '../../shared/project-editor';
import { useProjectStore, acceptProjectDocumentRevision } from '../stores/project-store';
import type ChannelStripComponent from '../components/workbench/panels/mixer/ChannelStrip';

const { stripRenderCounts, latestEffectNodesByChannel } = vi.hoisted(() => ({
  stripRenderCounts: new Map<string, number>(),
  latestEffectNodesByChannel: new Map<string, readonly LibraryBrowseNode[]>(),
}));

vi.mock('../components/workbench/panels/mixer/ChannelStrip', async () => {
  const actual = await vi.importActual<{ default: typeof ChannelStripComponent }>(
    '../components/workbench/panels/mixer/ChannelStrip',
  );
  const ActualStrip = actual.default;
  const SpyStrip = React.memo(function SpyChannelStrip(
    props: React.ComponentProps<typeof ChannelStripComponent>,
  ) {
    const id = props.channel.id;
    stripRenderCounts.set(id, (stripRenderCounts.get(id) ?? 0) + 1);
    latestEffectNodesByChannel.set(id, props.projectEffectNodes ?? []);
    return <ActualStrip {...props} />;
  });
  return {
    ...actual,
    default: SpyStrip,
  };
});

import MixerPanel from '../components/workbench/panels/MixerPanel';


describe('MixerPanel ChannelStrip subscription isolation', () => {
  const originalBlueAPI = window.blueAPI;

  beforeEach(() => {
    stripRenderCounts.clear();
    latestEffectNodesByChannel.clear();
  });

  afterEach(() => {
    window.blueAPI = originalBlueAPI;
    useProjectStore.getState().clearProject();
  });

  it('skips unaffected ChannelStrip renders and browseLibraries calls when one channel level changes or unrelated project state updates', async () => {
    const browseLibraries = vi.fn().mockResolvedValue({
      libraryId: 'proj',
      entries: [],
      folders: [],
      rootNodes: [],
    });
    window.blueAPI = {
      browseLibraries,
    } as unknown as typeof window.blueAPI;

    const data = new BlueData();
    for (let i = 1; i <= 2; i += 1) {
      const inst = new GenericInstrument();
      inst.setName(`Inst ${i}`);
      data.getArrangement().addInstrument(inst, String(i));
      const ch = new Channel();
      ch.setName(`Channel ${i}`);
      ch.setAssociation(String(i));
      data.getMixer().getChannels().push(ch);
    }

    const initialSnapshot = createProjectEditorSnapshot(data, '/test.blue', 1, 'doc-1');
    act(() => {
      useProjectStore.getState().setProjectInfo({
        ...initialSnapshot,
        loaded: true,
      });
    });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    try {
      await act(async () => {
        root.render(<MixerPanel />);
      });
      await act(async () => {
        await Promise.resolve();
      });

      const channels = useProjectStore.getState().mixer.channels;
      const ch1 = channels[0]!;
      const ch2 = channels[1]!;
      const masterId = useProjectStore.getState().mixer.master.id;

      const initialCh1Renders = stripRenderCounts.get(ch1.id) ?? 0;
      const initialCh2Renders = stripRenderCounts.get(ch2.id) ?? 0;
      const initialMasterRenders = stripRenderCounts.get(masterId) ?? 0;
      const initialBrowseCalls = browseLibraries.mock.calls.length;

      expect(initialCh1Renders).toBeGreaterThan(0);
      expect(initialCh2Renders).toBeGreaterThan(0);
      expect(initialMasterRenders).toBeGreaterThan(0);

      // Simulate an unrelated channel level edit + revision bump + projectUdos edit.
      act(() => {
        acceptProjectDocumentRevision(1, 2);
        const currentMixer = useProjectStore.getState().mixer;
        const nextCh1 = { ...currentMixer.channels[0]!, level: -6 };
        useProjectStore.setState({
          mixer: {
            ...currentMixer,
            channels: [nextCh1, currentMixer.channels[1]!],
          },
          projectUdos: [
            {
              id: 'udo-1',
              opcodeName: 'NewUdo',
              inTypes: 'a',
              outTypes: 'a',
              codeBody: 'xout ain',
              comments: '',
            },
          ],
        });
      });

      expect(stripRenderCounts.get(ch1.id)).toBe(initialCh1Renders + 1);
      expect(stripRenderCounts.get(ch2.id)).toBe(initialCh2Renders);
      expect(stripRenderCounts.get(masterId)).toBe(initialMasterRenders);
      expect(browseLibraries.mock.calls.length).toBe(initialBrowseCalls);
    } finally {
      act(() => {
        root.unmount();
      });
      container.remove();
    }
  });

  it('refreshes cached ChannelStrip effect nodes when revision or source identity changes on a same-name effect', async () => {
    const data = new BlueData();
    for (let i = 1; i <= 2; i += 1) {
      const inst = new GenericInstrument();
      inst.setName(`Inst ${i}`);
      data.getArrangement().addInstrument(inst, String(i));
      const ch = new Channel();
      ch.setName(`Channel ${i}`);
      ch.setAssociation(String(i));
      if (i === 1) {
        const eff = new Effect();
        eff.setName('Reverb');
        eff.setCode('a1 = a1');
        ch.getPreEffects().push(eff);
      }
      data.getMixer().getChannels().push(ch);
    }

    const initialSnapshot = createProjectEditorSnapshot(data, '/test.blue', 1, 'doc-1');
    const ch1 = initialSnapshot.mixer.channels[0]!;
    const ch2 = initialSnapshot.mixer.channels[1]!;
    const effectEntryId = ch1.preChain[0]!.entryId;

    const makeEffectNode = (revision: string, entryId = effectEntryId): LibraryBrowseNode => ({
      nodeId: 'proj-effect-node-1',
      parentId: 'proj-mixer-ch1',
      libraryType: 'project',
      scope: 'projectOwned',
      nodeKind: 'item',
      displayName: 'Reverb',
      supportStatus: 'supported',
      objectType: 'effect',
      revision,
      hasChildren: false,
      key: {
        scope: 'projectOwned',
        locator: {
          kind: 'effect',
          channelId: ch1.id,
          chain: 'pre',
          entryId,
        },
      },
    });

    let currentNode = makeEffectNode('rev-1');
    let contentRevision = 1;
    let libraryChangedCallback: (() => void) | undefined;
    const browseLibraries = vi.fn().mockImplementation(async () => ({
      ok: true,
      value: {
        children: [currentNode],
        contentRevision,
        nextCursor: null,
      },
    }));

    window.blueAPI = {
      browseLibraries,
      onLibraryChanged: vi.fn((cb: () => void) => {
        libraryChangedCallback = cb;
        return () => {
          libraryChangedCallback = undefined;
        };
      }),
    } as unknown as typeof window.blueAPI;

    act(() => {
      useProjectStore.getState().setProjectInfo({
        ...initialSnapshot,
        loaded: true,
      });
    });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    try {
      await act(async () => {
        root.render(<MixerPanel />);
      });
      await act(async () => {
        await Promise.resolve();
      });

      expect(latestEffectNodesByChannel.get(ch1.id)?.[0]?.revision).toBe('rev-1');
      const ch2RendersAfterInit = stripRenderCounts.get(ch2.id) ?? 0;

      // Same nodeId & displayName ('Reverb'), updated revision ('rev-2') on library refresh.
      currentNode = makeEffectNode('rev-2');
      contentRevision += 1;
      await act(async () => {
        libraryChangedCallback?.();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(latestEffectNodesByChannel.get(ch1.id)?.[0]?.revision).toBe('rev-2');
      expect(stripRenderCounts.get(ch2.id)).toBe(ch2RendersAfterInit);

      // Same nodeId & displayName & revision, changed source identity (key.locator.entryId).
      currentNode = makeEffectNode('rev-2', `${effectEntryId}-moved`);
      contentRevision += 1;
      await act(async () => {
        libraryChangedCallback?.();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(latestEffectNodesByChannel.get(ch1.id)?.[0]?.key).toEqual(currentNode.key);
      expect(stripRenderCounts.get(ch2.id)).toBe(ch2RendersAfterInit);
    } finally {
      act(() => {
        root.unmount();
      });
      container.remove();
    }
  });
});
