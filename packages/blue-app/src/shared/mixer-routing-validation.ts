import type { MixerSnapshot, MixerChannelSnapshot, MixerSendEntrySnapshot } from './project-editor';

export interface MixerRoutingValidationResult {
  issues: MixerRoutingIssue[];
}

export interface MixerRoutingIssue {
  severity: 'warning' | 'error';
  code: 'self-output' | 'self-send' | 'feedback-risk' | 'missing-target' | 'invalid-paste-target';
  channelId: string;
  entryId?: string;
  targetName?: string;
  message: string;
}

function resolveChannelNameToId(mixer: MixerSnapshot, name: string): string {
  if (name === mixer.master.name) return mixer.master.id;
  const sub = mixer.subChannels.find((ch) => ch.name === name);
  if (sub) return sub.id;
  const inst = getSourceChannels(mixer).find((ch) => ch.name === name);
  if (inst) return inst.id;
  return name;
}

function resolveRoutingTarget(
  mixer: MixerSnapshot,
  target: string,
): { id: string; channel: MixerChannelSnapshot | null } {
  const byId = findChannelById(mixer, target);
  if (byId) return { id: target, channel: byId };
  const byName = findChannelByName(mixer, target);
  if (byName) return { id: byName.id, channel: byName };
  return { id: target, channel: null };
}

export function validateMixerRouting(mixer: MixerSnapshot): MixerRoutingValidationResult {
  const issues: MixerRoutingIssue[] = [];
  const allChannels = getAllChannels(mixer);

  for (const channel of allChannels) {
    validateChannelOutput(mixer, channel, issues);
    validateChannelSends(mixer, channel, issues);
  }

  validateFeedbackLoops(mixer, issues);

  return { issues };
}

export function validateSendTarget(
  mixer: MixerSnapshot,
  sourceChannelId: string,
  targetNameOrId: string,
): MixerRoutingIssue | null {
  const resolved = resolveRoutingTarget(mixer, targetNameOrId);

  if (sourceChannelId === resolved.id) {
    const channel = findChannelById(mixer, sourceChannelId);
    return {
      severity: 'error',
      code: 'self-send',
      channelId: sourceChannelId,
      targetName: targetNameOrId,
      message: `Cannot send from "${channel?.name ?? sourceChannelId}" to itself`,
    };
  }

  if (!resolved.channel) {
    return {
      severity: 'error',
      code: 'missing-target',
      channelId: sourceChannelId,
      targetName: targetNameOrId,
      message: `Target channel "${targetNameOrId}" does not exist`,
    };
  }

  if (resolved.channel.channelKind === 'instrument') {
    return {
      severity: 'error',
      code: 'invalid-paste-target',
      channelId: sourceChannelId,
      targetName: targetNameOrId,
      message: 'Cannot send to an instrument channel',
    };
  }

  return null;
}

export function validateOutputTarget(
  mixer: MixerSnapshot,
  channelId: string,
  outChannel: string,
): MixerRoutingIssue | null {
  const resolved = resolveRoutingTarget(mixer, outChannel);

  if (channelId === resolved.id) {
    return {
      severity: 'error',
      code: 'self-output',
      channelId,
      targetName: outChannel,
      message: 'A channel cannot output to itself',
    };
  }

  if (!resolved.channel) {
    return {
      severity: 'error',
      code: 'missing-target',
      channelId,
      targetName: outChannel,
      message: `Output target "${outChannel}" does not exist`,
    };
  }

  return null;
}

export function getValidOutputTargets(
  mixer: MixerSnapshot,
  channelId: string,
): MixerChannelSnapshot[] {
  const source = findChannelById(mixer, channelId);
  const sourceName = source?.name ?? channelId;

  return getAllChannels(mixer).filter((candidate) => {
    if (candidate.id === channelId) return false;
    if (candidate.channelKind === 'instrument') return false;
    return isPossibleOut(mixer, candidate, sourceName, new Set());
  });
}

export function getValidSendTargets(
  mixer: MixerSnapshot,
  sourceChannelId: string,
): MixerChannelSnapshot[] {
  const source = findChannelById(mixer, sourceChannelId);
  const sourceName = source?.name ?? sourceChannelId;

  return getAllChannels(mixer).filter((candidate) => {
    if (candidate.id === sourceChannelId) return false;
    if (candidate.channelKind === 'instrument') return false;
    return isPossibleOut(mixer, candidate, sourceName, new Set());
  });
}

function isPossibleOut(
  mixer: MixerSnapshot,
  candidate: MixerChannelSnapshot,
  sourceName: string,
  visited: Set<string>,
): boolean {
  if (candidate.name === sourceName) {
    return false;
  }

  if (visited.has(candidate.id)) {
    return true;
  }
  visited.add(candidate.id);

  const sends = [...candidate.preChain, ...candidate.postChain].filter(
    (entry): entry is MixerSendEntrySnapshot => entry.kind === 'send',
  );

  for (const send of sends) {
    if (send.sendChannel === sourceName) {
      return false;
    }

    const sendChannel = send.sendChannel;
    if (sendChannel && sendChannel !== mixer.master.name) {
      const next = findChannelByName(mixer, sendChannel);
      if (next && !isPossibleOut(mixer, next, sourceName, visited)) {
        return false;
      }
    }
  }

  const outChannel = candidate.outChannel;
  if (outChannel === sourceName) {
    return false;
  }

  if (!outChannel || outChannel === mixer.master.name) {
    return true;
  }

  const next = findChannelByName(mixer, outChannel);
  if (!next) {
    return true;
  }

  return isPossibleOut(mixer, next, sourceName, visited);
}

function getAllChannels(mixer: MixerSnapshot): MixerChannelSnapshot[] {
  return [...getSourceChannels(mixer), ...mixer.subChannels, mixer.master];
}

function getSourceChannels(mixer: MixerSnapshot): MixerChannelSnapshot[] {
  const groupedChannels = mixer.channelListGroups.flatMap((group) => group.channels);
  return [...groupedChannels, ...mixer.channels];
}

function findChannelById(mixer: MixerSnapshot, channelId: string): MixerChannelSnapshot | null {
  return getAllChannels(mixer).find((ch) => ch.id === channelId) ?? null;
}

function findChannelByName(mixer: MixerSnapshot, name: string): MixerChannelSnapshot | null {
  return getAllChannels(mixer).find((ch) => ch.name === name) ?? null;
}

function validateChannelOutput(
  mixer: MixerSnapshot,
  channel: MixerChannelSnapshot,
  issues: MixerRoutingIssue[],
): void {
  if (!channel.outChannel) return;

  const issue = validateOutputTarget(mixer, channel.id, channel.outChannel);
  if (issue) {
    issues.push(issue);
  }
}

function validateChannelSends(
  mixer: MixerSnapshot,
  channel: MixerChannelSnapshot,
  issues: MixerRoutingIssue[],
): void {
  const allSends = [...channel.preChain, ...channel.postChain].filter(
    (entry): entry is MixerSendEntrySnapshot => entry.kind === 'send',
  );

  for (const send of allSends) {
    if (!send.sendChannel) continue;

    const issue = validateSendTarget(mixer, channel.id, send.sendChannel);
    if (issue) {
      issues.push({ ...issue, entryId: send.entryId });
    }
  }
}

function validateFeedbackLoops(mixer: MixerSnapshot, issues: MixerRoutingIssue[]): void {
  const adjacency = buildSendAdjacency(mixer);

  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const allChannelIds = getAllChannels(mixer).map((ch) => ch.id);

  for (const channelId of allChannelIds) {
    if (detectCycle(channelId, adjacency, visited, recursionStack)) {
      const channel = findChannelById(mixer, channelId);
      issues.push({
        severity: 'warning',
        code: 'feedback-risk',
        channelId,
        targetName: channelId,
        message: `Channel "${channel?.name ?? channelId}" is part of a potential feedback loop`,
      });
    }
  }
}

function buildSendAdjacency(mixer: MixerSnapshot): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>();
  const allChannels = getAllChannels(mixer);

  for (const channel of allChannels) {
    if (!adjacency.has(channel.id)) {
      adjacency.set(channel.id, new Set());
    }

    if (channel.outChannel) {
      const outId = resolveChannelNameToId(mixer, channel.outChannel);
      adjacency.get(channel.id)!.add(outId);
    }

    const sends = [...channel.preChain, ...channel.postChain].filter(
      (entry): entry is MixerSendEntrySnapshot => entry.kind === 'send' && entry.enabled,
    );
    for (const send of sends) {
      if (send.sendChannel) {
        const sendId = resolveChannelNameToId(mixer, send.sendChannel);
        adjacency.get(channel.id)!.add(sendId);
      }
    }
  }

  return adjacency;
}

function detectCycle(
  nodeId: string,
  adjacency: Map<string, Set<string>>,
  visited: Set<string>,
  recursionStack: Set<string>,
): boolean {
  if (recursionStack.has(nodeId)) return true;
  if (visited.has(nodeId)) return false;

  visited.add(nodeId);
  recursionStack.add(nodeId);

  const neighbors = adjacency.get(nodeId);
  if (neighbors) {
    for (const neighbor of neighbors) {
      if (detectCycle(neighbor, adjacency, visited, recursionStack)) {
        return true;
      }
    }
  }

  recursionStack.delete(nodeId);
  return false;
}
