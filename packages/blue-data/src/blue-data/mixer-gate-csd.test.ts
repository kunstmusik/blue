import { describe, expect, it } from 'vitest';
import { BlueData } from '../blue-data';
import { Channel } from '../mixer/channel';
import { Send } from '../mixer/send';
import { GenericInstrument } from '../instruments/generic-instrument';
import { buildStandardCSD } from './csd-policy';

/**
 * A track feeding the master directly and a Reverb return via a post-fader
 * send; the return outputs to Master. Mirrors the contract route fixture.
 */
function createProjectWithMixer(): BlueData {
  const data = new BlueData();
  const mixer = data.getMixer();
  mixer.setEnabled(true);

  const source = new Channel();
  source.setName('Track 1');
  source.setAssociation('track-1');
  source.setOutChannel('Master');
  const send = new Send();
  send.setSendChannel('Reverb');
  send.setEnabled(true);
  source.getPostEffects().push(send);
  mixer.getChannels().push(source);

  const reverb = new Channel();
  reverb.setName('Reverb');
  reverb.setOutChannel('Master');
  mixer.getSubChannels().push(reverb);

  const instr = new GenericInstrument();
  instr.setName('Sine');
  instr.setText('a1 oscili 0.2, 440\n  outc a1, a1');
  data.getArrangement().addInstrument(instr, '1');

  return data;
}

describe('mixer mute/solo CSD gates (Spec 111)', () => {
  it('emits two-bank gate channels, tokens, and chnexport bindings for realtime renders', () => {
    const data = createProjectWithMixer();
    const result = data.toRealtimePlaybackCSD();

    const bindings = result.mixerGateBindings;
    expect(bindings).toBeDefined();
    // send -> Reverb, Track 1 output, Reverb output, Master output
    expect(bindings!.gates).toHaveLength(4);
    expect(bindings!.commitChannel).toBe('gk_blue_mixgate_commit');
    expect(bindings!.appliedChannel).toBe('gk_blue_mixgate_applied');
    expect(bindings!.signature.length).toBeGreaterThan(0);

    for (const gate of bindings!.gates) {
      expect(gate.initial).toBe(1);
      expect(result.csdText).toContain(`${gate.bankSymbols[0]} init 1`);
      expect(result.csdText).toContain(
        `${gate.bankSymbols[0]} chnexport "${gate.bankSymbols[0]}", 3`,
      );
      expect(result.csdText).toContain(`${gate.bankSymbols[1]} init 1`);
    }
    expect(result.csdText).toContain('gk_blue_mixgate_commit init 0');
    expect(result.csdText).toContain('gk_blue_mixgate_applied init 0');
  });

  it('gates send taps, final outputs after effects, meters after gates, and echoes applied tokens', () => {
    const data = createProjectWithMixer();
    const result = data.toRealtimePlaybackCSD();

    // Send tap is gated (gate ordinal 0 = first edge of the walk).
    expect(result.csdText).toMatch(/ga_bluesub_Reverb_0\t\+=\t.*kMixGateState_0/);
    // Source final output gate comes after effects and before routing.
    expect(result.csdText).toMatch(
      /ga_bluemix_0_0 = ga_bluemix_0_0 \* kMixGateState_1\n\s*ga_bluemix_0_1 = ga_bluemix_0_1 \* kMixGateState_1\n\s*ga_bluesub_Master_0\t\+=\tga_bluemix_0_0/,
    );
    // Master output gate precedes outc.
    expect(result.csdText).toMatch(
      /ga_bluesub_Master_0 = ga_bluesub_Master_0 \* kMixGateState_3\n\s*ga_bluesub_Master_1 = ga_bluesub_Master_1 \* kMixGateState_3\n\s*outc ga_bluesub_Master_0/,
    );
    // Applied echo after bank selection.
    expect(result.csdText).toContain('gk_blue_mixgate_applied = kMixGateCommit');
    // Shared ramp setup.
    expect(result.csdText).toContain('kMixGateStep init ksmps / (0.005 * sr)');
    expect(result.csdText).toContain('kMixGateBank = (kMixGateCommit % 2)');
  });

  it('initializes muted routes to zero in both banks and settles outputs at exact targets', () => {
    const data = createProjectWithMixer();
    data.getMixer().getChannels()[0].setMuted(true);

    const result = data.toRealtimePlaybackCSD();
    const bindings = result.mixerGateBindings!;
    const sendGate = bindings.gates[0];
    const outputGate = bindings.gates[1];
    expect(sendGate.initial).toBe(0);
    expect(outputGate.initial).toBe(0);
    expect(result.csdText).toContain(`${sendGate.bankSymbols[0]} init 0`);
    expect(result.csdText).toContain(`${sendGate.bankSymbols[1]} init 0`);
    // The muted contribution's tap remains gate-controlled.
    expect(result.csdText).toMatch(/ga_bluesub_Reverb_0\t\+=\t.*kMixGateState_0/);
  });

  it('keeps solo routing-aware initial targets: soloed source keeps its return audible', () => {
    const data = createProjectWithMixer();
    data.getMixer().getChannels()[0].setSolo(true);

    const result = data.toRealtimePlaybackCSD();
    const initialByLocator = new Map(
      result.mixerGateBindings!.gates.map((gate) => [gate.locator.route, gate.initial]),
    );
    expect(initialByLocator.get('send')).toBe(1);
    expect(initialByLocator.get('output')).toBe(1);
  });

  it('emits gate machinery for BlueLive renders', () => {
    const data = createProjectWithMixer();
    const result = data.toBlueLiveCSD();
    expect(result.mixerGateBindings).toBeDefined();
    expect(result.mixerGateBindings!.gates).toHaveLength(4);
    expect(result.csdText).toContain('gk_blue_mixgate_commit init 0');
    expect(result.csdText).toContain('gk_blue_mixgate_applied = kMixGateCommit');
  });

  it('omits gates entirely when the mixer is disabled', () => {
    const data = createProjectWithMixer();
    data.getMixer().setEnabled(false);

    const result = data.toRealtimePlaybackCSD();
    expect(result.mixerGateBindings).toBeUndefined();
    expect(result.csdText).not.toContain('gk_blue_mixgate_');
    expect(result.csdText).not.toContain('kMixGateState_');
  });

  it('bakes fixed constants for disk renders only when a route is excluded', () => {
    const ungated = buildStandardCSD(createProjectWithMixer(), 'disk');
    expect(ungated.mixerGateBindings).toBeUndefined();
    expect(ungated.csdText).not.toContain('gk_blue_mixgate_');
    expect(ungated.csdText).not.toContain('kMixGateState_');

    const muted = createProjectWithMixer();
    muted.getMixer().getChannels()[0].setMuted(true);
    const result = buildStandardCSD(muted, 'disk');
    expect(result.mixerGateBindings).toBeUndefined();
    // Excluded routes become literal silence; included routes stay untouched.
    expect(result.csdText).toMatch(/ga_bluesub_Reverb_0\t\+=\t.*\* 0/);
    expect(result.csdText).toMatch(
      /ga_bluemix_0_0 = ga_bluemix_0_0 \* 0\n\s*ga_bluemix_0_1 = ga_bluemix_0_1 \* 0\n\s*ga_bluesub_Master_0/,
    );
    expect(result.csdText).not.toContain('kMixGateState_');
  });

  it('never gates disabled sends and keeps effect processing lines intact', () => {
    const data = createProjectWithMixer();
    const send = data.getMixer().getChannels()[0].getPostEffects()[0] as Send;
    send.setEnabled(false);
    data.getMixer().getChannels()[0].setSolo(true);

    const result = data.toRealtimePlaybackCSD();
    // Disabled send contributes no edge and no gate.
    expect(result.mixerGateBindings!.gates).toHaveLength(3);
    expect(result.csdText).not.toContain('ga_bluesub_Reverb_0\t+=');
  });
});
