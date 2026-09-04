// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Effect, UDOStyle, Element } from '@blue/data';

import ChannelStrip from '../components/workbench/panels/mixer/ChannelStrip';
import type {
  EffectEditablePatch,
  EffectEditorSnapshot,
  MixerChannelSnapshot,
  MixerEffectEntrySnapshot,
  MixerSnapshot,
} from '../../shared/project-editor';

declare global {
  interface Window {
    blueAPI: {
      sendMixerRealtimeLevelUpdate: (payload: {
        channelId: string;
        level: number;
      }) => Promise<void>;
      focusEffectEditor: (request: unknown) => Promise<boolean>;
      openEffectInterface: (request: unknown) => Promise<void>;
    };
  }
}

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../components/workbench/panels/mixer/EffectsChainContextMenu', () => ({
  default: ({
    children,
    chain,
    entries,
    onAddNewEffect,
    onOpenEditEffectDialog,
  }: {
    children: React.ReactNode;
    chain: 'pre' | 'post';
    entries: Array<{ kind: 'effect' | 'send' }>;
    onAddNewEffect: () => void;
    onOpenEditEffectDialog: (entry: MixerEffectEntrySnapshot, chain: 'pre' | 'post') => void;
  }) => (
    <div>
      {children}
      <button type="button" onClick={onAddNewEffect}>
        Add New Effect {chain}
      </button>
      {entries[0]?.kind === 'effect' ? (
        <button
          type="button"
          onClick={() => onOpenEditEffectDialog(entries[0] as MixerEffectEntrySnapshot, chain)}
        >
          Edit Effect Definition {chain}
        </button>
      ) : null}
    </div>
  ),
}));

vi.mock('../components/effect-editor/EffectEditorPanel', () => ({
  default: ({
    snapshot,
    onPatch,
  }: {
    snapshot: EffectEditorSnapshot;
    onPatch: (patch: EffectEditablePatch) => void;
  }) => (
    <div data-testid="effect-editor-panel">
      <div>{snapshot.name}</div>
      <button type="button" onClick={() => onPatch({ name: 'Edited Effect' })}>
        Rename Draft
      </button>
      <button
        type="button"
        onClick={() => onPatch({ style: snapshot.style === 'MODERN' ? 'CLASSIC' : 'MODERN' })}
      >
        Toggle Style
      </button>
    </div>
  ),
}));

vi.mock('../utils/program-settings-defaults', () => ({
  createDefaultEffectXml: vi.fn(async () => {
    const effect = new Effect();
    effect.setName('New Effect');
    effect.setStyle(UDOStyle.MODERN);
    return effect.saveAsXML().toXml();
  }),
}));

function createEffectEntry(channelId: string, chain: 'pre' | 'post'): MixerEffectEntrySnapshot {
  const effect = new Effect();
  effect.setName('Warmth');
  effect.setStyle(UDOStyle.CLASSIC);
  return {
    effectXml: effect.saveAsXML().toXml(),
    name: effect.getName(),
    enabled: effect.isEnabled(),
    numIns: effect.getNumIns(),
    numOuts: effect.getNumOuts(),
    style: 'CLASSIC',
    code: effect.getCode(),
    comments: effect.getComments(),
    editEnabled: effect.getGraphicInterface().isEditEnabled(),
    gridSettings: {
      enabled: false,
      snapEnabled: false,
      width: 10,
      height: 10,
      gridStyle: 'dots',
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
    udos: [],
    entryId: 'fx-1',
    kind: 'effect',
    projectRef: { channelId, chain, entryId: 'fx-1' },
  };
}

function createMixerSnapshot(channel: MixerChannelSnapshot): MixerSnapshot {
  return {
    enabled: true,
    extraRenderTime: 0,
    channelListGroups: [],
    channels: [],
    subChannels: [channel],
    master: {
      id: 'master',
      name: 'Master',
      channelKind: 'master',
      outChannel: '',
      muted: false,
      solo: false,
      level: 0,
      volume: 1,
      pan: 0.5,
      preChain: [],
      postChain: [],
    },
  };
}

function renderStrip(
  channel: MixerChannelSnapshot,
  onPatch: ReturnType<typeof vi.fn>,
): { container: HTMLDivElement; root: Root } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <ChannelStrip
        mixer={createMixerSnapshot(channel)}
        channel={channel}
        isMaster={false}
        isSubChannel
        onPatch={onPatch}
        projectSessionId={1}
        projectRevision={1}
        onOpenEffectInterface={vi.fn()}
        onRemoveSubChannel={vi.fn()}
      />,
    );
  });

  return { container, root };
}

beforeEach(() => {
  window.blueAPI = {
    sendMixerRealtimeLevelUpdate: vi.fn().mockResolvedValue(undefined),
    focusEffectEditor: vi.fn().mockResolvedValue(false),
    openEffectInterface: vi.fn().mockResolvedValue(undefined),
  };
});

afterEach(() => {
  delete window.blueAPI;
});

describe('ChannelStrip mixer effect dialog', () => {
  it('does not add a new effect when the dialog is cancelled', async () => {
    const channel: MixerChannelSnapshot = {
      id: 'sub-1',
      name: 'SubChannel1',
      channelKind: 'subChannel',
      outChannel: 'Master',
      muted: false,
      solo: false,
      level: 0,
      volume: 1,
      pan: 0.5,
      preChain: [],
      postChain: [],
    };
    const onPatch = vi.fn();
    const { container, root } = renderStrip(channel, onPatch);

    await act(async () => {
      const button = Array.from(container.querySelectorAll('button')).find(
        (candidate) => candidate.textContent === 'Add New Effect pre',
      ) as HTMLButtonElement | undefined;
      button?.click();
      await Promise.resolve();
    });

    await act(async () => {
      const rename = Array.from(container.querySelectorAll('button')).find(
        (candidate) => candidate.textContent === 'Rename Draft',
      ) as HTMLButtonElement | undefined;
      rename?.click();
      await Promise.resolve();
    });

    await act(async () => {
      const cancel = Array.from(container.querySelectorAll('button')).find(
        (candidate) => candidate.textContent === 'Cancel',
      ) as HTMLButtonElement | undefined;
      cancel?.click();
      await Promise.resolve();
    });

    expect(onPatch).not.toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('adds a new effect only after OK and preserves edited draft values', async () => {
    const channel: MixerChannelSnapshot = {
      id: 'sub-1',
      name: 'SubChannel1',
      channelKind: 'subChannel',
      outChannel: 'Master',
      muted: false,
      solo: false,
      level: 0,
      volume: 1,
      pan: 0.5,
      preChain: [],
      postChain: [],
    };
    const onPatch = vi.fn();
    const { container, root } = renderStrip(channel, onPatch);

    await act(async () => {
      const button = Array.from(container.querySelectorAll('button')).find(
        (candidate) => candidate.textContent === 'Add New Effect pre',
      ) as HTMLButtonElement | undefined;
      button?.click();
      await Promise.resolve();
    });

    await act(async () => {
      const rename = Array.from(container.querySelectorAll('button')).find(
        (candidate) => candidate.textContent === 'Rename Draft',
      ) as HTMLButtonElement | undefined;
      rename?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Edited Effect');

    await act(async () => {
      const ok = Array.from(container.querySelectorAll('button')).find(
        (candidate) => candidate.textContent === 'OK',
      ) as HTMLButtonElement | undefined;
      ok?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onPatch).toHaveBeenCalledOnce();
    const patch = onPatch.mock.calls[0][0] as {
      type: string;
      channelId: string;
      chain: string;
      effectXml: string;
    };
    const created = Effect.loadFromXML(Element.parse(patch.effectXml));

    expect(patch.type).toBe('addEffectFromLibrary');
    expect(patch.channelId).toBe('sub-1');
    expect(patch.chain).toBe('pre');
    expect(created.getName()).toBe('Edited Effect');

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('edits an existing subchannel effect locally and commits the XML on OK', async () => {
    const channel: MixerChannelSnapshot = {
      id: 'sub-1',
      name: 'SubChannel1',
      channelKind: 'subChannel',
      outChannel: 'Master',
      muted: false,
      solo: false,
      level: 0,
      volume: 1,
      pan: 0.5,
      preChain: [createEffectEntry('sub-1', 'pre')],
      postChain: [],
    };
    const onPatch = vi.fn();
    const { container, root } = renderStrip(channel, onPatch);

    await act(async () => {
      const button = Array.from(container.querySelectorAll('button')).find(
        (candidate) => candidate.textContent === 'Edit Effect Definition pre',
      ) as HTMLButtonElement | undefined;
      button?.click();
      await Promise.resolve();
    });

    await act(async () => {
      const rename = Array.from(container.querySelectorAll('button')).find(
        (candidate) => candidate.textContent === 'Rename Draft',
      ) as HTMLButtonElement | undefined;
      rename?.click();
      await Promise.resolve();
    });

    await act(async () => {
      const ok = Array.from(container.querySelectorAll('button')).find(
        (candidate) => candidate.textContent === 'OK',
      ) as HTMLButtonElement | undefined;
      ok?.click();
      await Promise.resolve();
    });

    expect(onPatch).toHaveBeenCalledOnce();
    const patch = onPatch.mock.calls[0][0] as {
      type: string;
      channelId: string;
      chain: string;
      entryId: string;
      patch: { effectXml: string };
    };
    const updated = Effect.loadFromXML(Element.parse(patch.patch.effectXml));

    expect(patch.type).toBe('updateEffect');
    expect(patch.channelId).toBe('sub-1');
    expect(patch.chain).toBe('pre');
    expect(patch.entryId).toBe('fx-1');
    expect(updated.getName()).toBe('Edited Effect');

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
