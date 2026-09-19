import { describe, expect, it } from 'vitest';
import { BlueData } from '../blue-data';
import { Channel } from '../mixer/channel';
import { Send } from '../mixer/send';
import { GenericInstrument } from '../instruments/generic-instrument';
import { AudioClip } from '../score/audio/audio-clip';
import { createAudioLayoutManifest } from '../score/audio/audio-layout';
import { TrackLayerGroup } from '../score/track/track-layer-group';
import { TimeDuration } from '../time/time-duration';
import { TimePosition } from '../time/time-position';
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

    const sourceOutput = bindings!.gates.find(
      (gate) => gate.locator.route === 'output' && gate.locator.association === 'track-1',
    );
    expect(sourceOutput?.locator).toMatchObject({
      channelIdentity: 'association:track-1',
      entryIdentity: JSON.stringify({ channel: 'association:track-1', route: 'output' }),
    });
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

describe('pan/balance stage interaction with gates (Spec 112 T072)', () => {
  function createGatedPanningProject(): {
    data: BlueData;
    manifest: ReturnType<typeof createAudioLayoutManifest>;
  } {
    const data = createProjectWithMixer();
    data.getMixer().setPanningEnabled(true);
    const manifest = createAudioLayoutManifest([
      ['/audio/mono.wav', { filePath: '/audio/mono.wav', channels: 1, status: 'verified' }],
    ]);

    const group = new TrackLayerGroup();
    const track = group.newLayerAt(0);
    track.setUniqueId('track-1');
    const clip = new AudioClip();
    clip.setAudioFile('/audio/mono.wav');
    clip.setStartTime(TimePosition.beats(0));
    clip.setSubjectiveDuration(TimeDuration.beats(1));
    track.push(clip);
    data.getScore().push(group);

    data.getMixer().getChannels()[0].setPan(0.25);
    return { data, manifest };
  }

  it('applies the pan stage between the send tap gate and the channel output gate', () => {
    const { data, manifest } = createGatedPanningProject();
    const result = data.toRealtimePlaybackCSD(undefined, false, manifest);

    // Send tap (gate 0) is tapped from the pre-pan bus, the position stage
    // follows, and only then is the channel output gated (gate 1).
    expect(result.csdText).toMatch(
      new RegExp(
        'ga_bluesub_Reverb_0\\t\\+=\\t\\(ga_bluemix_0_0 \\* gk_blue_auto\\d+\\) \\* kMixGateState_0' +
          '[\\s\\S]*k_pan_l = \\(' +
          '[\\s\\S]*ga_bluemix_0_0 \\*= 1\\.4142135623730951 \\* k_pan_l' +
          '[\\s\\S]*ga_bluemix_0_0 = ga_bluemix_0_0 \\* kMixGateState_1',
      ),
    );
    // The post-pan channel bus is what reaches the parent.
    expect(result.csdText).toContain('ga_bluesub_Master_0\t+=\tga_bluemix_0_0');
  });

  it('keeps gates and routing intact when Mixer panning is off', () => {
    const data = createProjectWithMixer();
    data.getMixer().setPanningEnabled(false);
    const result = data.toRealtimePlaybackCSD();
    expect(result.csdText).not.toContain('k_pan_l');
    expect(result.csdText).not.toContain('k_bal_');
    expect(result.csdText).toMatch(
      /ga_bluemix_0_0 = ga_bluemix_0_0 \* kMixGateState_1\n\s*ga_bluemix_0_1 = ga_bluemix_0_1 \* kMixGateState_1\n\s*ga_bluesub_Master_0\t\+=\tga_bluemix_0_0/,
    );
  });

  it('applies Stereo Pan and Dual Pan matrices between send taps and output gates on sources and subchannels (Spec 113 T020)', () => {
    const { data, manifest } = createGatedPanningProject();
    const source = data.getMixer().getChannels()[0]!;
    source.setPan(0.25);

    const sub = data.getMixer().getSubChannels()[0]!;
    sub.setStereoPanMode('dualPan');
    sub.setDualPanLeft(0.1);
    sub.setDualPanRight(0.9);

    const result = data.toRealtimePlaybackCSD(undefined, false, manifest);
    const csd = result.csdText;

    // Verified mono source uses Mono Pan: Send tap -> k_pan_l/r -> output gate
    expect(csd).toMatch(
      /ga_bluesub_Reverb_0\t\+=\t[\s\S]*k_pan_l = \([\s\S]*ga_bluemix_0_0 \*= 1\.4142135623730951 \* k_pan_l[\s\S]*ga_bluemix_0_0 = ga_bluemix_0_0 \* kMixGateState_1/,
    );

    // Subchannel uses Dual Pan 2x2 matrix: a_pan_in_l -> output gate
    expect(csd).toMatch(
      /a_pan_in_l = ga_bluesub_Reverb_0[\s\S]*ga_bluesub_Reverb_0 = ga_bluesub_Reverb_0 \* kMixGateState_2/,
    );
  });
});
