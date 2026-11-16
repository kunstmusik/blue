import { Effect, Element } from '@blue/data';
import {
  createMixerEffectEntrySnapshot,
  isValidMeterProfileKey,
  type MixerChainEntrySnapshot,
  type MixerChannelSnapshot,
  type MixerEffectEntrySnapshot,
  type MixerPatch,
  type MixerSnapshot,
  type OrchestraSnapshot,
  type ScoreDocumentSnapshot,
  type ScorePatch,
} from '../../../shared/project-editor';
import { updateScoreGroupLayers } from '../../lib/score-layer-snapshots';

function generateUniqueSubChannelName(existingNames: ReadonlySet<string>): string {
  let index = existingNames.size + 1;
  while (true) {
    const name = `SubChannel${index}`;
    if (!existingNames.has(name)) {
      return name;
    }
    index++;
  }
}

function getMixerSourceChannels(mixer: MixerSnapshot): MixerChannelSnapshot[] {
  const groupedChannels = mixer.channelListGroups.flatMap((group) => group.channels);
  return [...groupedChannels, ...mixer.channels];
}

function findMixerChannelSnapshotById(
  mixer: MixerSnapshot,
  channelId: string,
): MixerChannelSnapshot | null {
  if (channelId === 'master') {
    return mixer.master;
  }

  const source = getMixerSourceChannels(mixer).find((channel) => channel.id === channelId);
  if (source) {
    return source;
  }

  return mixer.subChannels.find((channel) => channel.id === channelId) ?? null;
}

function replaceSubChannelTargetInChain(
  entries: MixerChainEntrySnapshot[],
  fromName: string,
  toName: string,
): MixerChainEntrySnapshot[] {
  let nextEntries: MixerChainEntrySnapshot[] | null = null;
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    if (entry.kind === 'send' && entry.sendChannel === fromName) {
      if (!nextEntries) {
        nextEntries = [...entries];
      }
      nextEntries[i] = { ...entry, sendChannel: toName };
    }
  }
  return nextEntries ?? entries;
}

function replaceSubChannelTargetInChannel(
  channel: MixerChannelSnapshot,
  fromName: string,
  toName: string,
): MixerChannelSnapshot {
  const nextOutChannel = channel.outChannel === fromName ? toName : channel.outChannel;
  const nextPreChain = replaceSubChannelTargetInChain(channel.preChain, fromName, toName);
  const nextPostChain = replaceSubChannelTargetInChain(channel.postChain, fromName, toName);
  if (
    nextOutChannel === channel.outChannel &&
    nextPreChain === channel.preChain &&
    nextPostChain === channel.postChain
  ) {
    return channel;
  }
  return {
    ...channel,
    outChannel: nextOutChannel,
    preChain: nextPreChain,
    postChain: nextPostChain,
  };
}

function replaceSubChannelTargetInSnapshot(
  mixer: MixerSnapshot,
  fromName: string,
  toName: string,
): void {
  let groupsChanged = false;
  const nextGroups = mixer.channelListGroups.map((group) => {
    let channelsChanged = false;
    const nextChannels = group.channels.map((channel) => {
      const updated = replaceSubChannelTargetInChannel(channel, fromName, toName);
      if (updated !== channel) channelsChanged = true;
      return updated;
    });
    if (!channelsChanged) return group;
    groupsChanged = true;
    return { ...group, channels: nextChannels };
  });
  if (groupsChanged) {
    mixer.channelListGroups = nextGroups;
  }

  let channelsChanged = false;
  const nextChannels = mixer.channels.map((channel) => {
    const updated = replaceSubChannelTargetInChannel(channel, fromName, toName);
    if (updated !== channel) channelsChanged = true;
    return updated;
  });
  if (channelsChanged) {
    mixer.channels = nextChannels;
  }

  let subChannelsChanged = false;
  const nextSubChannels = mixer.subChannels.map((channel) => {
    const updated = replaceSubChannelTargetInChannel(channel, fromName, toName);
    if (updated !== channel) subChannelsChanged = true;
    return updated;
  });
  if (subChannelsChanged) {
    mixer.subChannels = nextSubChannels;
  }

  const nextMaster = replaceSubChannelTargetInChannel(mixer.master, fromName, toName);
  if (nextMaster !== mixer.master) {
    mixer.master = nextMaster;
  }
}

function reconcileSubChannelNameInSnapshot(
  mixer: MixerSnapshot,
  oldName: string,
  newName: string,
): void {
  replaceSubChannelTargetInSnapshot(mixer, oldName, newName);
}

function reconcileSubChannelRemovedInSnapshot(mixer: MixerSnapshot, removedName: string): void {
  replaceSubChannelTargetInSnapshot(mixer, removedName, 'Master');
}

function createEffectEntrySnapshotFromXml(
  effectXml: string,
  entryId: string,
  refs?: { projectRef?: { channelId: string; chain: 'pre' | 'post'; entryId: string } },
): MixerEffectEntrySnapshot {
  const effect = Effect.loadFromXML(Element.parse(effectXml));
  return createMixerEffectEntrySnapshot(effect, entryId, refs);
}

function applyChannelChainMutation(
  mixer: MixerSnapshot,
  channel: MixerChannelSnapshot,
  preChain: MixerChainEntrySnapshot[],
  postChain: MixerChainEntrySnapshot[],
): void {
  const updated = {
    ...channel,
    preChain,
    postChain,
  };

  if (channel.id === mixer.master.id) {
    (mixer as { master: MixerChannelSnapshot }).master = updated;
  } else {
    const groupIndex = mixer.channelListGroups.findIndex((group) =>
      group.channels.some((candidate) => candidate.id === channel.id),
    );
    if (groupIndex >= 0) {
      const group = mixer.channelListGroups[groupIndex]!;
      const nextGroup = {
        ...group,
        channels: group.channels.map((candidate) =>
          candidate.id === channel.id ? updated : candidate,
        ),
      };
      const nextGroups = [...mixer.channelListGroups];
      nextGroups[groupIndex] = nextGroup;
      mixer.channelListGroups = nextGroups;
      return;
    }

    const idx = mixer.channels.findIndex((c) => c.id === channel.id);
    if (idx >= 0) {
      const nextChannels = [...mixer.channels];
      nextChannels[idx] = updated;
      mixer.channels = nextChannels;
      return;
    }
    const subIdx = mixer.subChannels.findIndex((c) => c.id === channel.id);
    if (subIdx >= 0) {
      const nextSubChannels = [...mixer.subChannels];
      nextSubChannels[subIdx] = updated;
      mixer.subChannels = nextSubChannels;
    }
  }
}

export interface OptimisticReducerOptions {
  createId?: () => string;
}

export function applyMixerPatchToSnapshot(
  mixer: MixerSnapshot,
  _orchestra: OrchestraSnapshot,
  patch: MixerPatch,
  options?: OptimisticReducerOptions,
): MixerSnapshot {
  const createId = options?.createId ?? (() => crypto.randomUUID());
  const next: MixerSnapshot = { ...mixer };

  switch (patch.type) {
    case 'setMixerEnabled':
      next.enabled = patch.value;
      break;
    case 'setMeterEnabled':
      next.enableMeters = patch.value;
      break;
    case 'setMeterProfile':
      if (isValidMeterProfileKey(patch.value)) {
        next.meterProfileKey = patch.value;
      }
      break;
    case 'updateMixerPanning':
      next.panningEnabled = patch.panningEnabled;
      break;
    case 'updateMixerPanLaw':
      next.panLawDb = patch.panLawDb;
      break;
    case 'updateMixerPanBoost':
      next.panOffCenterBoost = patch.panOffCenterBoost;
      break;
    case 'updateExtraRenderTime':
      next.extraRenderTime = patch.value;
      break;
    case 'renameChannelListGroup': {
      const targetAssociation = patch.association.trim();
      const nextName = patch.name.trim();
      if (targetAssociation.length === 0 || nextName.length === 0) {
        break;
      }

      next.channelListGroups = next.channelListGroups.map((group) =>
        (group.association?.trim() ?? '') === targetAssociation
          ? { ...group, listName: nextName }
          : group,
      );
      break;
    }
    case 'updateChannel': {
      const channel =
        getMixerSourceChannels(next).find((candidate) => candidate.id === patch.channelId) ??
        next.subChannels.find((candidate) => candidate.id === patch.channelId) ??
        (next.master.id === patch.channelId ? next.master : null);
      if (!channel) {
        break;
      }

      // Master solo has no active control (Spec 111); reject the whole patch
      // so the optimistic view matches the canonical rejection.
      if (patch.patch.solo !== undefined && next.master.id === channel.id) {
        break;
      }

      const isSubChannel = next.subChannels.some((sc) => sc.id === channel.id);
      if (isSubChannel && patch.patch.name !== undefined && patch.patch.name !== channel.name) {
        reconcileSubChannelNameInSnapshot(next, channel.name, patch.patch.name);
      }

      let groupsChanged = false;
      const nextGroups = next.channelListGroups.map((group) => {
        let channelsChanged = false;
        const nextGroupChannels = group.channels.map((candidate) => {
          if (candidate.id !== channel.id) return candidate;
          channelsChanged = true;
          return { ...candidate, ...patch.patch };
        });
        if (!channelsChanged) return group;
        groupsChanged = true;
        return { ...group, channels: nextGroupChannels };
      });
      if (groupsChanged) {
        next.channelListGroups = nextGroups;
      }

      let channelsChanged = false;
      const nextChannels = next.channels.map((candidate) => {
        if (candidate.id !== channel.id) return candidate;
        channelsChanged = true;
        return { ...candidate, ...patch.patch };
      });
      if (channelsChanged) {
        next.channels = nextChannels;
      }

      if (isSubChannel) {
        next.subChannels = next.subChannels.map((candidate) =>
          candidate.id === channel.id ? { ...candidate, ...patch.patch } : candidate,
        );
      }

      if (next.master.id === channel.id) {
        next.master = { ...next.master, ...patch.patch };
      }
      break;
    }
    case 'addSubChannel': {
      const newId = patch.channelId ?? createId();
      const insertIndex = patch.insertIndex ?? next.subChannels.length;
      const existingNames = new Set(next.subChannels.map((ch) => ch.name));
      const defaultName = generateUniqueSubChannelName(existingNames);
      const nextSubChannel: MixerChannelSnapshot = {
        id: newId,
        name: patch.name ?? defaultName,
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
      const subChannels = [...next.subChannels];
      subChannels.splice(Math.min(Math.max(insertIndex, 0), subChannels.length), 0, nextSubChannel);
      next.subChannels = subChannels;
      break;
    }
    case 'removeSubChannel': {
      const removed = next.subChannels.find((sc) => sc.id === patch.channelId);
      if (removed) {
        reconcileSubChannelRemovedInSnapshot(next, removed.name);
      }
      next.subChannels = next.subChannels.filter((channel) => channel.id !== patch.channelId);
      break;
    }
    case 'addEffectFromLibrary':
    case 'addSend':
    case 'updateSend':
    case 'updateEffect':
    case 'removeChainEntry':
    case 'reorderChainEntry':
    case 'duplicateChainEntry':
    case 'copyChainEntry':
    case 'pasteChainEntries': {
      const channel = findMixerChannelSnapshotById(next, patch.channelId);
      if (!channel) {
        break;
      }

      const updateChain = (
        entries: MixerChainEntrySnapshot[],
        chainKind: 'pre' | 'post',
      ): MixerChainEntrySnapshot[] => {
        if (chainKind !== patch.chain) {
          return entries;
        }

        switch (patch.type) {
          case 'addEffectFromLibrary': {
            const entryId = patch.entryId ?? createId();
            const nextEntries = [...entries];
            const effectXml = patch.effectXml ?? new Effect().saveAsXML().toXml();
            nextEntries.splice(
              Math.min(Math.max(patch.insertIndex ?? nextEntries.length, 0), nextEntries.length),
              0,
              createEffectEntrySnapshotFromXml(effectXml, entryId, {
                projectRef: {
                  channelId: patch.channelId,
                  chain: patch.chain,
                  entryId,
                },
              }),
            );
            return nextEntries;
          }
          case 'addSend': {
            const entryId = patch.entryId ?? createId();
            const nextEntries = [...entries];
            nextEntries.splice(
              Math.min(Math.max(patch.insertIndex ?? nextEntries.length, 0), nextEntries.length),
              0,
              {
                entryId,
                kind: 'send',
                sendChannel: patch.sendChannel ?? 'Master',
                level: patch.level ?? 1,
                enabled: true,
              },
            );
            return nextEntries;
          }
          case 'updateSend':
            return entries.map((entry) =>
              entry.entryId === patch.entryId && entry.kind === 'send'
                ? {
                    ...entry,
                    ...(patch.patch.sendChannel !== undefined
                      ? { sendChannel: patch.patch.sendChannel }
                      : null),
                    ...(patch.patch.level !== undefined ? { level: patch.patch.level } : null),
                    ...(patch.patch.enabled !== undefined
                      ? { enabled: patch.patch.enabled }
                      : null),
                  }
                : entry,
            );
          case 'updateEffect':
            return entries.map((entry) => {
              if (entry.entryId !== patch.entryId || entry.kind !== 'effect') {
                return entry;
              }

              if (patch.patch.effectXml !== undefined) {
                return createEffectEntrySnapshotFromXml(patch.patch.effectXml, patch.entryId, {
                  projectRef: {
                    channelId: patch.channelId,
                    chain: patch.chain,
                    entryId: patch.entryId,
                  },
                });
              }

              const nextEntry = { ...entry };
              if (patch.patch.name !== undefined) nextEntry.name = patch.patch.name;
              if (patch.patch.enabled !== undefined) nextEntry.enabled = patch.patch.enabled;
              if (patch.patch.numIns !== undefined) nextEntry.numIns = patch.patch.numIns;
              if (patch.patch.numOuts !== undefined) nextEntry.numOuts = patch.patch.numOuts;
              if (patch.patch.style !== undefined) nextEntry.style = patch.patch.style;
              if (patch.patch.code !== undefined) nextEntry.code = patch.patch.code;
              if (patch.patch.comments !== undefined) nextEntry.comments = patch.patch.comments;
              return nextEntry;
            });
          case 'removeChainEntry':
            return entries.filter((entry) => entry.entryId !== patch.entryId);
          case 'reorderChainEntry': {
            const nextEntries = [...entries];
            if (
              patch.from < 0 ||
              patch.to < 0 ||
              patch.from >= nextEntries.length ||
              patch.to >= nextEntries.length ||
              patch.from === patch.to
            ) {
              return nextEntries;
            }
            const [moved] = nextEntries.splice(patch.from, 1);
            nextEntries.splice(patch.to, 0, moved);
            return nextEntries;
          }
          case 'duplicateChainEntry': {
            const dupIndex = entries.findIndex((e) => e.entryId === patch.entryId);
            if (dupIndex < 0) return entries;
            const original = entries[dupIndex];
            const nextEntries = [...entries];
            const newEntryId = patch.newEntryId ?? createId();
            const clone: MixerChainEntrySnapshot =
              original.kind === 'effect'
                ? original.effectXml !== undefined
                  ? createEffectEntrySnapshotFromXml(original.effectXml, newEntryId, {
                      projectRef: {
                        channelId: patch.channelId,
                        chain: patch.chain,
                        entryId: newEntryId,
                      },
                    })
                  : {
                      ...original,
                      entryId: newEntryId,
                      projectRef: {
                        channelId: patch.channelId,
                        chain: patch.chain,
                        entryId: newEntryId,
                      },
                    }
                : {
                    ...original,
                    entryId: newEntryId,
                  };
            nextEntries.splice(dupIndex + 1, 0, clone);
            return nextEntries;
          }
          case 'copyChainEntry':
            return entries;
          case 'pasteChainEntries': {
            const nextEntries = [...entries];
            const insertIndex = patch.index ?? nextEntries.length;
            for (let i = 0; i < patch.payload.entries.length; i++) {
              const entry = patch.payload.entries[i];
              const newEntryId = patch.newEntryIds?.[i] ?? createId();
              const pasted: MixerChainEntrySnapshot =
                entry.kind === 'effect'
                  ? entry.effectXml !== undefined
                    ? createEffectEntrySnapshotFromXml(entry.effectXml, newEntryId, {
                        projectRef: {
                          channelId: patch.channelId,
                          chain: patch.chain,
                          entryId: newEntryId,
                        },
                      })
                    : {
                        ...entry,
                        entryId: newEntryId,
                        projectRef: {
                          channelId: patch.channelId,
                          chain: patch.chain,
                          entryId: newEntryId,
                        },
                      }
                  : { ...entry, entryId: newEntryId };
              nextEntries.splice(Math.min(insertIndex + i, nextEntries.length), 0, pasted);
            }
            return nextEntries;
          }
          default:
            return entries;
        }
      };

      if (channel.id === next.master.id) {
        next.master = {
          ...next.master,
          preChain: updateChain(next.master.preChain, 'pre'),
          postChain: updateChain(next.master.postChain, 'post'),
        };
      } else {
        const nextPreChain = updateChain(channel.preChain, 'pre');
        const nextPostChain = updateChain(channel.postChain, 'post');
        applyChannelChainMutation(next, channel, nextPreChain, nextPostChain);
      }
      break;
    }
    case 'moveChainEntryAcrossChains': {
      const fromChannel = findMixerChannelSnapshotById(next, patch.fromChannelId);
      const toChannel = findMixerChannelSnapshotById(next, patch.toChannelId);
      if (!fromChannel || !toChannel) break;

      const fromEntries = patch.fromChain === 'pre' ? fromChannel.preChain : fromChannel.postChain;
      const fromIndex = fromEntries.findIndex((e) => e.entryId === patch.entryId);
      if (fromIndex < 0) break;

      const nextFromEntries = [...fromEntries];
      const [removed] = nextFromEntries.splice(fromIndex, 1);

      if (fromChannel.id === toChannel.id && patch.fromChain === patch.toChain) {
        const insertIndex = patch.index ?? nextFromEntries.length;
        nextFromEntries.splice(Math.min(insertIndex, nextFromEntries.length), 0, removed);
        applyChannelChainMutation(
          next,
          fromChannel,
          patch.fromChain === 'pre' ? nextFromEntries : fromChannel.preChain,
          patch.fromChain === 'post' ? nextFromEntries : fromChannel.postChain,
        );
        break;
      }

      const toEntries = patch.toChain === 'pre' ? toChannel.preChain : toChannel.postChain;
      const nextToEntries = [...toEntries];
      const insertIndex = patch.index ?? nextToEntries.length;
      nextToEntries.splice(Math.min(insertIndex, nextToEntries.length), 0, removed);

      if (fromChannel.id === toChannel.id) {
        applyChannelChainMutation(
          next,
          fromChannel,
          patch.fromChain === 'pre' ? nextFromEntries : nextToEntries,
          patch.fromChain === 'post' ? nextFromEntries : nextToEntries,
        );
      } else {
        applyChannelChainMutation(
          next,
          fromChannel,
          patch.fromChain === 'pre' ? nextFromEntries : fromChannel.preChain,
          patch.fromChain === 'post' ? nextFromEntries : fromChannel.postChain,
        );
        applyChannelChainMutation(
          next,
          toChannel,
          patch.toChain === 'pre' ? nextToEntries : toChannel.preChain,
          patch.toChain === 'post' ? nextToEntries : toChannel.postChain,
        );
      }
      break;
    }
  }

  return next;
}

interface TrackSnapshotLocation {
  groupId: string;
  layerIndex: number;
  layerId: string;
}

function collectTrackSnapshotLocations(score: ScoreDocumentSnapshot): TrackSnapshotLocation[] {
  const result: TrackSnapshotLocation[] = [];

  for (const group of score.layerGroups) {
    if (group.groupType !== 'track') {
      continue;
    }

    group.layers.forEach((layer, layerIndex) => {
      result.push({
        groupId: group.groupId,
        layerIndex,
        layerId: layer.layerId,
      });
    });
  }

  return result;
}

export function applyTrackRenameToMixerSnapshot(
  mixer: MixerSnapshot,
  score: ScoreDocumentSnapshot,
  patch: Extract<ScorePatch, { type: 'renameLayer' }>,
): MixerSnapshot {
  const tracks = collectTrackSnapshotLocations(score);
  const targetLayer = tracks.find(
    (layer) => layer.groupId === patch.groupId && layer.layerIndex === patch.layerIndex,
  );
  if (!targetLayer) {
    return mixer;
  }

  let changed = false;
  const nextChannelListGroups = mixer.channelListGroups.map((group) => {
    const nextGroupChannels = group.channels.map((channel) => {
      if (channel.association !== targetLayer.layerId || channel.name === patch.name) {
        return channel;
      }
      changed = true;
      return { ...channel, name: patch.name };
    });
    return nextGroupChannels === group.channels ? group : { ...group, channels: nextGroupChannels };
  });
  const nextChannels = mixer.channels.map((channel) => {
    if (channel.association !== targetLayer.layerId || channel.name === patch.name) {
      return channel;
    }
    changed = true;
    return { ...channel, name: patch.name };
  });

  return changed
    ? { ...mixer, channelListGroups: nextChannelListGroups, channels: nextChannels }
    : mixer;
}

export function applyMixerChannelRenameToTrackSnapshot(
  score: ScoreDocumentSnapshot,
  mixer: MixerSnapshot,
  patch: Extract<MixerPatch, { type: 'updateChannel' }>,
): ScoreDocumentSnapshot {
  if (patch.patch.name === undefined) {
    return score;
  }

  const trackLocations = collectTrackSnapshotLocations(score);
  const trackIds = new Set(trackLocations.map((layer) => layer.layerId));
  const targetChannel = getMixerSourceChannels(mixer).find(
    (channel) => channel.id === patch.channelId,
  );
  const targetAssociation = targetChannel?.association;
  if (!targetAssociation || !trackIds.has(targetAssociation)) {
    return score;
  }

  const targetLayer = trackLocations.find((layer) => layer.layerId === targetAssociation);
  if (!targetLayer) {
    return score;
  }

  let changed = false;
  const nextLayerGroups = score.layerGroups.map((group) => {
    if (group.groupId !== targetLayer.groupId) {
      return group;
    }

    const nextLayers = updateScoreGroupLayers(group, (sourceLayers) =>
      sourceLayers.map((layer, layerIndex) => {
        if (layerIndex !== targetLayer.layerIndex || layer.name === patch.patch.name) {
          return layer;
        }

        changed = true;
        return { ...layer, name: patch.patch.name! };
      }),
    );

    return changed ? nextLayers : group;
  });

  return changed ? { ...score, layerGroups: nextLayerGroups } : score;
}
