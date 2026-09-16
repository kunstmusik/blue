import { describe, it, expect } from 'vitest';
import { Mixer } from './mixer';
import { Channel } from './channel';
import { Send } from './send';
import {
  buildMixerRouteGraph,
  computeMixerGateState,
  computeMixerGateStateForMixer,
} from './mute-solo-policy';

/**
 * Fixture matching the contract route matrix: sources A and B feed the
 * master directly and a return R via post-fader sends; R outputs to Master.
 */
function createContractFixture(): { mixer: Mixer; a: Channel; b: Channel; r: Channel } {
  const mixer = new Mixer();
  const a = new Channel();
  a.setName('A');
  const b = new Channel();
  b.setName('B');
  const r = new Channel();
  r.setName('R');
  for (const channel of [a, b]) {
    const send = new Send();
    send.setSendChannel('R');
    send.setEnabled(true);
    channel.getPostEffects().push(send);
    mixer.getChannels().push(channel);
  }
  r.setOutChannel('Master');
  mixer.getSubChannels().push(r);
  return { mixer, a, b, r };
}

function gateByName(state: ReturnType<typeof computeMixerGateState>) {
  const byName = new Map(state.channels.map((channel) => [channel.name, channel]));
  return {
    state,
    outputIncluded: (name: string) => byName.get(name)?.outputIncluded ?? false,
    hasIncludedSend: (name: string) => byName.get(name)?.hasIncludedSend ?? false,
  };
}

describe('mute-solo-policy', () => {
  it('builds a graph with output and send edges and deterministic ordinals', () => {
    const { mixer } = createContractFixture();
    const graph = buildMixerRouteGraph(mixer);
    expect(graph.mixerEnabled).toBe(true);
    expect(graph.acyclic).toBe(true);
    expect(graph.hasUnresolvedRoutes).toBe(false);
    // A: send + output, B: send + output, R: output, Master: output.
    expect(graph.edges).toHaveLength(6);
    const kinds = graph.edges.map((edge) => edge.kind);
    expect(kinds.filter((kind) => kind === 'send')).toHaveLength(2);
    expect(kinds.filter((kind) => kind === 'output')).toHaveLength(4);
    for (let i = 0; i < graph.edges.length; i++) {
      expect(graph.edges[i].gateOrdinal).toBe(i);
    }
  });

  it('includes every enabled route when no solos are set', () => {
    const { mixer } = createContractFixture();
    const { state } = gateByName(computeMixerGateStateForMixer(mixer));
    expect(state.gates.every((gate) => gate === 1)).toBe(true);
  });

  it('solo A keeps its dry and wet routes and excludes B (contract row Solo A)', () => {
    const { mixer, a, b } = createContractFixture();
    a.setSolo(true);
    const { outputIncluded, hasIncludedSend } = gateByName(computeMixerGateStateForMixer(mixer));
    expect(outputIncluded('A')).toBe(true);
    expect(hasIncludedSend('A')).toBe(true);
    expect(outputIncluded('R')).toBe(true);
    expect(outputIncluded('B')).toBe(false);
    expect(hasIncludedSend('B')).toBe(false);
    expect(outputIncluded('Master')).toBe(true);
    expect(b.isSolo()).toBe(false);
  });

  it('solo R keeps feeder sends and its own output but excludes dry bypasses (row Solo R)', () => {
    const { mixer, a, b, r } = createContractFixture();
    r.setSolo(true);
    const { outputIncluded, hasIncludedSend } = gateByName(computeMixerGateStateForMixer(mixer));
    expect(hasIncludedSend('A')).toBe(true);
    expect(hasIncludedSend('B')).toBe(true);
    expect(outputIncluded('A')).toBe(false);
    expect(outputIncluded('B')).toBe(false);
    expect(outputIncluded('R')).toBe(true);
  });

  it('multiple solos select the union of their paths (row Solo A and R)', () => {
    const { mixer, a, r } = createContractFixture();
    a.setSolo(true);
    r.setSolo(true);
    const { outputIncluded, hasIncludedSend } = gateByName(computeMixerGateStateForMixer(mixer));
    expect(outputIncluded('A')).toBe(true);
    expect(hasIncludedSend('A')).toBe(true);
    expect(outputIncluded('R')).toBe(true);
    expect(hasIncludedSend('B')).toBe(true); // feeds soloed R
    expect(outputIncluded('B')).toBe(false);
  });

  it('explicit mute wins over solo and solo selection persists (row Solo A, mute A)', () => {
    const { mixer, a } = createContractFixture();
    a.setSolo(true);
    a.setMuted(true);
    const { state, outputIncluded, hasIncludedSend } = gateByName(
      computeMixerGateStateForMixer(mixer),
    );
    const byName = new Map(state.channels.map((channel) => [channel.name, channel]));
    expect(byName.get('A')?.soloEffective).toBe(true);
    expect(byName.get('A')?.muted).toBe(true);
    expect(outputIncluded('A')).toBe(false);
    expect(hasIncludedSend('A')).toBe(false);
    expect(outputIncluded('B')).toBe(false);
    expect(outputIncluded('R')).toBe(false);
  });

  it('muted master silences the final output and master-owned sends (row Solo A, mute M)', () => {
    const { mixer, a } = createContractFixture();
    a.setSolo(true);
    mixer.getMaster().setMuted(true);
    const { outputIncluded } = gateByName(computeMixerGateStateForMixer(mixer));
    expect(outputIncluded('Master')).toBe(false);
    expect(outputIncluded('A')).toBe(true);
    expect(outputIncluded('R')).toBe(true);
  });

  it('ignores a legacy master solo exactly like no solo (row Legacy solo M only)', () => {
    const { mixer } = createContractFixture();
    mixer.getMaster().setSolo(true);
    const { state } = gateByName(computeMixerGateStateForMixer(mixer));
    expect(state.gates.every((gate) => gate === 1)).toBe(true);
    const master = state.channels.find((channel) => channel.kind === 'master');
    expect(master?.soloAvailable).toBe(false);
    expect(master?.soloEffective).toBe(false);
    expect(master?.solo).toBe(true);
  });

  it('disconnected channels are excluded while the soloed branch stays audible', () => {
    const { mixer, a } = createContractFixture();
    const lonely = new Channel();
    lonely.setName('Lonely');
    mixer.getChannels().push(lonely);
    a.setSolo(true);
    const { outputIncluded } = gateByName(computeMixerGateStateForMixer(mixer));
    expect(outputIncluded('Lonely')).toBe(false);
    expect(outputIncluded('A')).toBe(true);
  });

  it('shared summed buses keep combined signal on permitted outputs without reopening inputs', () => {
    const mixer = new Mixer();
    const a = new Channel();
    a.setName('A');
    const bus = new Channel();
    bus.setName('X');
    bus.setOutChannel('Master');
    const c = new Channel();
    c.setName('C');
    mixer.getChannels().push(a, c);
    mixer.getSubChannels().push(bus);
    const aToX = new Send();
    aToX.setSendChannel('X');
    a.getPostEffects().push(aToX);
    const cToX = new Send();
    cToX.setSendChannel('X');
    c.getPostEffects().push(cToX);

    a.setSolo(true);
    const { outputIncluded, hasIncludedSend } = gateByName(computeMixerGateStateForMixer(mixer));
    // X is retained (path from A), so its combined output passes onward...
    expect(outputIncluded('X')).toBe(true);
    expect(hasIncludedSend('A')).toBe(true);
    // ...but C's own contributions are not admitted by X's retention.
    expect(hasIncludedSend('C')).toBe(false);
    expect(outputIncluded('C')).toBe(false);
  });

  it('zero-amount enabled sends stay structural; disabled sends contribute nothing', () => {
    const { mixer, a, b } = createContractFixture();
    const r = mixer.getSubChannels()[0];
    const zeroSend = a.getPostEffects()[0] as Send;
    zeroSend.setLevel(0);
    const disabledSend = b.getPostEffects()[0] as Send;
    disabledSend.setEnabled(false);

    r.setSolo(true);
    const { hasIncludedSend } = gateByName(computeMixerGateStateForMixer(mixer));
    expect(hasIncludedSend('A')).toBe(true);
    expect(hasIncludedSend('B')).toBe(false);
    const graph = buildMixerRouteGraph(mixer);
    expect(graph.edges.filter((edge) => edge.kind === 'send')).toHaveLength(1);
  });

  it('reports unresolved routes and cycles without throwing', () => {
    const { mixer } = createContractFixture();
    const ghostSend = new Send();
    ghostSend.setSendChannel('Ghost');
    mixer.getChannels()[0].getPostEffects().push(ghostSend);
    const graph = buildMixerRouteGraph(mixer);
    expect(graph.hasUnresolvedRoutes).toBe(true);
    expect(graph.acyclic).toBe(true);
    const state = computeMixerGateState(graph);
    expect(state.hasUnresolvedRoutes).toBe(true);
    expect(() => state.gates.every((gate) => gate === 0 || gate === 1)).not.toThrow();
  });

  it('detects cyclic subchannel routing as non-acyclic but still derives gates', () => {
    const mixer = new Mixer();
    const x = new Channel();
    x.setName('X');
    const y = new Channel();
    y.setName('Y');
    x.setOutChannel('Y');
    y.setOutChannel('X');
    mixer.getSubChannels().push(x, y);
    const graph = buildMixerRouteGraph(mixer);
    expect(graph.acyclic).toBe(false);
    expect(() => computeMixerGateState(graph)).not.toThrow();
  });

  it('returns an empty gate state for a disabled mixer without touching channels', () => {
    const { mixer, a } = createContractFixture();
    a.setSolo(true);
    mixer.setEnabled(false);
    const state = computeMixerGateStateForMixer(mixer);
    expect(state.mixerEnabled).toBe(false);
    expect(state.gates).toHaveLength(0);
    expect(a.isSolo()).toBe(true);
    expect(a.isMuted()).toBe(false);
  });
});
