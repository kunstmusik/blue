/**
 * Mixer audio mute/solo route policy (Spec 111).
 *
 * Pure, host-neutral, and detached: it reads explicit Channel flags and
 * routing topology and derives a deterministic per-route gate vector plus
 * per-channel indicators. It never mutates Channel objects, never writes
 * solo exclusion back into channel data, and never consults hosts or
 * renderers. Master solo is legacy compatibility data and never
 * participates in solo discovery.
 *
 * Mute convention: explicit mute blocks every outgoing route of a channel
 * (sends at their taps and the final output after local processing).
 *
 * Solo convention: additive and routing-aware. Each explicit non-master
 * solo selects the edges on paths leaving it and the edges on paths
 * reaching it, traversing only through unmuted intermediate nodes. Multiple
 * solos form the union of these edge sets. With no solos, every enabled
 * route is included. Mute always wins over solo inclusion.
 */
import { Channel } from './channel';
import { Send } from './send';
import { Mixer } from './mixer';

export type MixerRouteChannelKind = 'source' | 'sub' | 'master';

export interface MixerRouteNode {
  /** Compile ordinal: sources in mixer order, then render-ordered subs, then master. */
  readonly ordinal: number;
  readonly kind: MixerRouteChannelKind;
  readonly name: string;
  readonly muted: boolean;
  /** Raw stored flag. Master solo is retained data, never discovery input. */
  readonly solo: boolean;
}

export interface MixerRouteEdge {
  /** Deterministic gate ordinal across the whole graph. */
  readonly gateOrdinal: number;
  readonly sourceOrdinal: number;
  readonly kind: 'output' | 'send';
  readonly chainKind: 'pre' | 'post';
  /** Position of the send within its effects chain. */
  readonly chainIndex: number;
  /** Resolved target node ordinal, or null for the master terminal / unresolved name. */
  readonly targetOrdinal: number | null;
  /** Raw target name ('Master', a subchannel name, or an unresolved name). */
  readonly targetName: string;
  /** False for disabled sends, which contribute no route at all. */
  readonly enabled: boolean;
}

export interface MixerRouteGraph {
  readonly nodes: readonly MixerRouteNode[];
  readonly edges: readonly MixerRouteEdge[];
  readonly mixerEnabled: boolean;
  /** True when any send/output names a channel that does not exist. */
  readonly hasUnresolvedRoutes: boolean;
  /** False when output/send routing contains a cycle among named channels. */
  readonly acyclic: boolean;
}

export interface MixerChannelRouteIndicator {
  readonly ordinal: number;
  readonly kind: MixerRouteChannelKind;
  readonly name: string;
  readonly muted: boolean;
  /** Raw stored solo flag, including an ignored legacy master solo. */
  readonly solo: boolean;
  /** False on master: no solo control exists there. */
  readonly soloAvailable: boolean;
  /** This channel's own solo participates in solo discovery. */
  readonly soloEffective: boolean;
  /** Final-output route gate value. */
  readonly outputIncluded: boolean;
  /** Output is gated and the cause is solo exclusion, not this channel's own mute. */
  readonly outputExcludedBySolo: boolean;
  readonly hasIncludedSend: boolean;
  readonly hasAudibleRoute: boolean;
  /**
   * True when an included route from this channel still reaches the master
   * terminal output through other included edges. A channel that cannot
   * reach the output contributes nothing audible and is the sole pruning
   * candidate criterion for disk generation.
   */
  readonly reachesAudibleOutput: boolean;
}

export interface MixerGateState {
  readonly mixerEnabled: boolean;
  /** 0/1 target per gate ordinal; empty when the mixer is disabled. */
  readonly gates: ReadonlyArray<0 | 1>;
  readonly channels: readonly MixerChannelRouteIndicator[];
  readonly hasUnresolvedRoutes: boolean;
  readonly acyclic: boolean;
}

/**
 * Deterministic subchannel processing order used by both CSD emission and
 * policy ordinals: dependencies (feed targets) are processed after the
 * channels that feed them, ties broken by mixer list order.
 */
export function sortSubChannelsForRendering(subChannels: Channel[]): Channel[] {
  const byName = new Map(subChannels.map((channel) => [channel.getName(), channel]));
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const ordered: Channel[] = [];

  const visit = (channel: Channel) => {
    const name = channel.getName();
    if (visited.has(name) || visiting.has(name)) {
      return;
    }

    visiting.add(name);

    const targets = new Set<string>();
    const outChannel = channel.getOutChannel();
    if (outChannel && outChannel !== 'Master' && outChannel !== name && byName.has(outChannel)) {
      targets.add(outChannel);
    }

    for (const send of channel.getSends()) {
      const target = send.getSendChannel();
      if (target && target !== 'Master' && target !== name && byName.has(target)) {
        targets.add(target);
      }
    }

    for (const target of targets) {
      visit(byName.get(target)!);
    }

    visiting.delete(name);
    visited.add(name);
    ordered.push(channel);
  };

  for (const channel of subChannels) {
    visit(channel);
  }

  return ordered.reverse();
}

interface GraphChannel {
  readonly channel: Channel;
  readonly kind: MixerRouteChannelKind;
  readonly ordinal: number;
}

function collectEnabledSendEdges(
  channel: Channel,
  sourceOrdinal: number,
  nameToOrdinal: Map<string, number>,
  nextGateOrdinal: () => number,
): MixerRouteEdge[] {
  const edges: MixerRouteEdge[] = [];
  for (const chainKind of ['pre', 'post'] as const) {
    const chain = chainKind === 'pre' ? channel.getPreEffects() : channel.getPostEffects();
    for (let index = 0; index < chain.length; index++) {
      const item = chain[index];
      if (!(item instanceof Send) || !item.isEnabled()) continue;
      const targetName = item.getSendChannel() || 'Master';
      edges.push({
        gateOrdinal: nextGateOrdinal(),
        sourceOrdinal,
        kind: 'send',
        chainKind,
        chainIndex: index,
        targetOrdinal: nameToOrdinal.get(targetName) ?? null,
        targetName,
        enabled: true,
      });
    }
  }
  return edges;
}

/**
 * Builds the detached route graph for a mixer. Nodes follow compile order
 * (sources, render-ordered subchannels, master); each enabled send and each
 * channel output consumes one gate ordinal. Channel objects are only read.
 */
export function buildMixerRouteGraph(mixer: Mixer): MixerRouteGraph {
  const sourceChannels = mixer.getAllSourceChannels();
  const subChannels = sortSubChannelsForRendering(Array.from(mixer.getSubChannels()));
  const master = mixer.getMaster();

  const channels: GraphChannel[] = [
    ...sourceChannels.map((channel, ordinal) => ({ channel, kind: 'source' as const, ordinal })),
    ...subChannels.map((channel, index) => ({
      channel,
      kind: 'sub' as const,
      ordinal: sourceChannels.length + index,
    })),
    {
      channel: master,
      kind: 'master' as const,
      ordinal: sourceChannels.length + subChannels.length,
    },
  ];

  const nameToOrdinal = new Map<string, number>();
  for (const { channel, ordinal } of channels) {
    nameToOrdinal.set(channel.getName(), ordinal);
  }

  let gateOrdinal = 0;
  const nextGateOrdinal = () => gateOrdinal++;
  const edges: MixerRouteEdge[] = [];

  let hasUnresolvedRoutes = false;
  for (const { channel, ordinal } of channels) {
    edges.push(...collectEnabledSendEdges(channel, ordinal, nameToOrdinal, nextGateOrdinal));

    const outChannel = channel.getOutChannel() || 'Master';
    const targetOrdinal = nameToOrdinal.get(outChannel) ?? null;
    if (targetOrdinal === null) hasUnresolvedRoutes = true;
    edges.push({
      gateOrdinal: nextGateOrdinal(),
      sourceOrdinal: ordinal,
      kind: 'output',
      chainKind: 'post',
      chainIndex: -1,
      targetOrdinal,
      targetName: outChannel,
      enabled: true,
    });
  }

  for (const edge of edges) {
    if (edge.kind === 'send' && edge.targetOrdinal === null) hasUnresolvedRoutes = true;
  }

  return {
    nodes: channels.map(({ channel, kind, ordinal }) => ({
      ordinal,
      kind,
      name: channel.getName(),
      muted: channel.isMuted(),
      solo: channel.isSolo(),
    })),
    edges,
    mixerEnabled: mixer.isEnabled(),
    hasUnresolvedRoutes,
    acyclic: isAcyclic(channels.length, edges),
  };
}

function isAcyclic(nodeCount: number, edges: readonly MixerRouteEdge[]): boolean {
  const adjacency: number[][] = Array.from({ length: nodeCount }, () => []);
  for (const edge of edges) {
    if (!edge.enabled) continue;
    // Only routing between named channels can form cycles.
    if (edge.targetOrdinal !== null && edge.targetOrdinal !== edge.sourceOrdinal) {
      adjacency[edge.sourceOrdinal].push(edge.targetOrdinal);
    }
  }

  // Iterative three-color DFS; bounds traversal on cyclic graphs.
  const state = new Int8Array(nodeCount);
  const visit = (start: number): boolean => {
    const stack: Array<{ node: number; childIndex: number }> = [{ node: start, childIndex: 0 }];
    state[start] = 1;
    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const children = adjacency[frame.node];
      if (frame.childIndex >= children.length) {
        state[frame.node] = 2;
        stack.pop();
        continue;
      }
      const child = children[frame.childIndex++];
      if (state[child] === 1) return false;
      if (state[child] === 0) {
        state[child] = 1;
        stack.push({ node: child, childIndex: 0 });
      }
    }
    return true;
  };

  for (let node = 0; node < nodeCount; node++) {
    if (state[node] === 0 && !visit(node)) return false;
  }
  return true;
}

/**
 * Derives the complete gate vector and per-channel indicators for the graph.
 * Deterministic; discovers explicit non-master solos before removing muted
 * paths so a muted solo never falls back to the full mix.
 */
export function computeMixerGateState(graph: MixerRouteGraph): MixerGateState {
  const nodeCount = graph.nodes.length;
  const muted = new Set<number>();
  for (const node of graph.nodes) {
    if (node.muted) muted.add(node.ordinal);
  }

  const enabledEdges = graph.edges.filter((edge) => edge.enabled);
  // Base rule: a muted channel blocks every outgoing route, even its own
  // soloed paths. Master mute therefore also blocks master-owned sends.
  const routableEdges = enabledEdges.filter((edge) => !muted.has(edge.sourceOrdinal));

  const outgoing = new Map<number, MixerRouteEdge[]>();
  const incoming = new Map<number, MixerRouteEdge[]>();
  for (const edge of routableEdges) {
    pushToMap(outgoing, edge.sourceOrdinal, edge);
    if (edge.targetOrdinal !== null) {
      pushToMap(incoming, edge.targetOrdinal, edge);
    }
  }

  const included = new Set<number>();
  const soloOrdinals = graph.nodes
    .filter((node) => node.solo && node.kind !== 'master')
    .map((node) => node.ordinal);

  if (soloOrdinals.length === 0) {
    for (const edge of routableEdges) included.add(edge.gateOrdinal);
  } else {
    for (const solo of soloOrdinals) {
      selectForward(graph, outgoing, muted, solo, included);
      selectReverse(graph, incoming, muted, solo, included);
    }
  }

  const gates: (0 | 1)[] = [];
  for (const edge of graph.edges) {
    gates[edge.gateOrdinal] = edge.enabled && included.has(edge.gateOrdinal) ? 1 : 0;
  }

  // Reachability to the master terminal output over included edges. The
  // terminal is the master channel's own output edge; when it is gated, no
  // route reaches the audible output at all.
  const masterNode = graph.nodes.find((node) => node.kind === 'master');
  const terminalEdge =
    masterNode !== undefined
      ? graph.edges.find(
          (edge) => edge.kind === 'output' && edge.sourceOrdinal === masterNode.ordinal,
        )
      : undefined;
  const incomingIncluded = new Map<number, number[]>();
  const outgoingIncluded = new Map<number, Array<{ target: number | null; gate: number }>>();
  for (const edge of graph.edges) {
    if (!edge.enabled || gates[edge.gateOrdinal] !== 1) continue;
    const list = outgoingIncluded.get(edge.sourceOrdinal) ?? [];
    list.push({ target: edge.targetOrdinal, gate: gates[edge.gateOrdinal] });
    outgoingIncluded.set(edge.sourceOrdinal, list);
    if (edge.targetOrdinal !== null) {
      const inc = incomingIncluded.get(edge.targetOrdinal) ?? [];
      inc.push(edge.sourceOrdinal);
      incomingIncluded.set(edge.targetOrdinal, inc);
    }
  }
  const reaches = new Set<number>();
  if (terminalEdge !== undefined && gates[terminalEdge.gateOrdinal] === 1) {
    // Reverse BFS over included edges from the master node.
    const queue = [terminalEdge.sourceOrdinal];
    reaches.add(terminalEdge.sourceOrdinal);
    while (queue.length > 0) {
      const node = queue.shift()!;
      for (const source of incomingIncluded.get(node) ?? []) {
        if (reaches.has(source)) continue;
        reaches.add(source);
        queue.push(source);
      }
    }
  }

  const indicators = graph.nodes.map((node) => {
    const nodeEdges = graph.edges.filter((edge) => edge.sourceOrdinal === node.ordinal);
    const outputEdge = nodeEdges.find((edge) => edge.kind === 'output');
    const outputIncluded = outputEdge !== undefined && gates[outputEdge.gateOrdinal] === 1;
    const hasIncludedSend = nodeEdges.some(
      (edge) => edge.kind === 'send' && edge.enabled && gates[edge.gateOrdinal] === 1,
    );
    return {
      ordinal: node.ordinal,
      kind: node.kind,
      name: node.name,
      muted: node.muted,
      solo: node.solo,
      soloAvailable: node.kind !== 'master',
      soloEffective: node.solo && node.kind !== 'master',
      outputIncluded,
      outputExcludedBySolo: !outputIncluded && !node.muted,
      hasIncludedSend,
      hasAudibleRoute: nodeEdges.some((edge) => edge.enabled && gates[edge.gateOrdinal] === 1),
      reachesAudibleOutput: reaches.has(node.ordinal),
    };
  });

  return {
    mixerEnabled: graph.mixerEnabled,
    gates,
    channels: indicators,
    hasUnresolvedRoutes: graph.hasUnresolvedRoutes,
    acyclic: graph.acyclic,
  };
}

function pushToMap(map: Map<number, MixerRouteEdge[]>, key: number, edge: MixerRouteEdge): void {
  const list = map.get(key);
  if (list) {
    list.push(edge);
  } else {
    map.set(key, [edge]);
  }
}

/** Edges on paths leaving `start`, traversing only through unmuted nodes. */
function selectForward(
  graph: MixerRouteGraph,
  outgoing: Map<number, MixerRouteEdge[]>,
  muted: Set<number>,
  start: number,
  included: Set<number>,
): void {
  const visited = new Set<number>([start]);
  const queue = [start];
  while (queue.length > 0) {
    const node = queue.shift()!;
    for (const edge of outgoing.get(node) ?? []) {
      included.add(edge.gateOrdinal);
      if (edge.targetOrdinal === null || visited.has(edge.targetOrdinal)) continue;
      // A muted intermediate blocks onward traversal (its outgoing edges are
      // blocked anyway); the visited set bounds cyclic graphs.
      if (muted.has(edge.targetOrdinal)) continue;
      visited.add(edge.targetOrdinal);
      queue.push(edge.targetOrdinal);
    }
  }
}

/** Edges on paths reaching `start`, traversing only through unmuted nodes. */
function selectReverse(
  graph: MixerRouteGraph,
  incoming: Map<number, MixerRouteEdge[]>,
  muted: Set<number>,
  start: number,
  included: Set<number>,
): void {
  const visited = new Set<number>([start]);
  const queue = [start];
  while (queue.length > 0) {
    const node = queue.shift()!;
    for (const edge of incoming.get(node) ?? []) {
      included.add(edge.gateOrdinal);
      if (visited.has(edge.sourceOrdinal)) continue;
      if (muted.has(edge.sourceOrdinal)) continue;
      visited.add(edge.sourceOrdinal);
      queue.push(edge.sourceOrdinal);
    }
  }
}

/**
 * Deterministic topology signature for a route graph: node kinds and the
 * ordered edge shape, without flags or amounts. Live gate publications whose
 * canonical signature differs from the compiled signature are stale and must
 * not be staged.
 */
export function getMixerRouteSignature(graph: MixerRouteGraph): string {
  const nodes = graph.nodes.map((node) => `${node.ordinal}:${node.kind}`).join(',');
  const edges = graph.edges
    .map(
      (edge) =>
        `${edge.gateOrdinal}:${edge.sourceOrdinal}:${edge.kind}:${edge.chainKind}` +
        `:${edge.chainIndex}:${edge.targetName}`,
    )
    .join(';');
  return `${nodes}|${edges}`;
}

/**
 * Convenience for hosts: graph + gate state in one call. Returns an empty
 * gate state when the mixer is disabled.
 */
export function computeMixerGateStateForMixer(mixer: Mixer): MixerGateState {
  const graph = buildMixerRouteGraph(mixer);
  if (!mixer.isEnabled()) {
    return {
      mixerEnabled: false,
      gates: [],
      channels: [],
      hasUnresolvedRoutes: graph.hasUnresolvedRoutes,
      acyclic: graph.acyclic,
    };
  }
  return computeMixerGateState(graph);
}

/**
 * Canonical live-edit intent for the runtime: the topology signature and
 * complete gate vector derived from current channel flags, or null when the
 * mixer is disabled (no gate publication applies).
 */
export function resolveMixerGateIntent(
  mixer: Mixer,
): { signature: string; values: ReadonlyArray<0 | 1> } | null {
  if (!mixer.isEnabled()) return null;
  const graph = buildMixerRouteGraph(mixer);
  const state = computeMixerGateState(graph);
  return { signature: getMixerRouteSignature(graph), values: state.gates };
}
