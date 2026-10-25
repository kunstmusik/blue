import { describe, expect, it } from 'vitest';
import { BlueData } from '../blue-data';
import { Channel } from '../mixer/channel';
import { Send } from '../mixer/send';
import { GenericInstrument } from '../instruments/generic-instrument';
import { Effect } from '../mixer/effect';
import { buildStandardCSD } from './csd-policy';

/**
 * Spec 118 US1 focused generation expectations: the send amount × live gate
 * product is computed once at k-rate at the send tap and shared across
 * channels, and the final accumulator resets are emitted as one ordered batched
 * clear at the original position. Authored before the emitter change; these
 * expectations fail against the pre-change two-sweep/zero-assignment forms.
 */

function createProject(
  options: {
    nchnls?: number;
    sendLevel?: number;
    preFader?: boolean;
    mutedChannel?: boolean;
    secondSend?: { level: number; pre: boolean };
  } = {},
): BlueData {
  const data = new BlueData();
  const mixer = data.getMixer();
  mixer.setEnabled(true);
  if (options.nchnls !== undefined) {
    data.getProjectProperties().channels = String(options.nchnls);
    data.getProjectProperties().diskChannels = String(options.nchnls);
  }

  const source = new Channel();
  source.setName('Track 1');
  source.setAssociation('track-1');
  source.setOutChannel('Master');
  const send = new Send();
  send.setSendChannel('Reverb');
  send.setLevel(options.sendLevel ?? 0.4);
  (options.preFader ? source.getPreEffects() : source.getPostEffects()).push(send);
  if (options.secondSend) {
    const second = new Send();
    second.setSendChannel('Delay');
    second.setLevel(options.secondSend.level);
    (options.secondSend.pre ? source.getPreEffects() : source.getPostEffects()).push(second);
  }
  if (options.mutedChannel) source.setMuted(true);
  mixer.getChannels().push(source);

  const reverb = new Channel();
  reverb.setName('Reverb');
  reverb.setOutChannel('Master');
  mixer.getSubChannels().push(reverb);
  if (options.secondSend) {
    const delay = new Channel();
    delay.setName('Delay');
    delay.setOutChannel('Master');
    mixer.getSubChannels().push(delay);
  }

  const instr = new GenericInstrument();
  instr.setName('Sine');
  instr.setText('a1 oscili 0.2, 440\n  blueMixerOut a1, a1');
  data.getArrangement().addInstrument(instr, '1');
  return data;
}

function mixerInstrumentOf(csdText: string): string {
  const match = csdText.match(/\tinstr BlueMixer[\s\S]*?\tendin/);
  expect(match).toBeTruthy();
  return match![0];
}

describe('mixer optimization: local combined send gain (Spec 118 T013/T015)', () => {
  it('computes one tap-local k-rate product and shares it across channels', () => {
    const result = buildStandardCSD(createProject(), 'realtime');
    const csd = result.csdText;
    // One k-rate product at the tap, then immediate per-channel accumulation.
    expect(csd).toMatch(/kMixSendGain = gk_blue_auto\d+ \* kMixGateState_0\n/g);
    expect(csd).toMatch(/ga_bluesub_Reverb_0\t\+=\tga_bluemix_0_0 \* kMixSendGain\n/g);
    expect(csd).toMatch(/ga_bluesub_Reverb_1\t\+=\tga_bluemix_0_1 \* kMixSendGain\n/g);
    // The pre-change two audio-rate sweeps no longer appear.
    expect(csd).not.toMatch(
      /ga_bluesub_Reverb_0\t\+=\t\(ga_bluemix_0_0 \* gk_blue_auto\d+\) \* kMixGateState_0/,
    );
    // Exactly one k-rate product per gated non-unity send, shared across both
    // channel accumulations.
    const products = csd.match(/^kMixSendGain = /gm) ?? [];
    expect(products.length).toBe(1);
    expect((csd.match(/ \* kMixSendGain/g) ?? []).length).toBe(2);
  });

  it('emits the product immediately before its accumulations and expires it before the next send', () => {
    const result = buildStandardCSD(
      createProject({ secondSend: { level: 0.6, pre: false } }),
      'realtime',
    );
    const lines = result.csdText.split('\n').map((line) => line.trim());
    const productIndexes = lines
      .map((line, index) => (/^kMixSendGain = /.test(line) ? index : -1))
      .filter((index) => index >= 0);
    expect(productIndexes.length).toBe(2);
    for (const index of productIndexes) {
      // Each product is consumed by the two immediately following lines.
      expect(lines[index + 1]).toMatch(/^ga_bluesub_\S+\s\+=\sga_bluemix_0_0 \* kMixSendGain$/);
      expect(lines[index + 2]).toMatch(/^ga_bluesub_\S+\s\+=\sga_bluemix_0_1 \* kMixSendGain$/);
    }
  });

  it('shares the product for mono output', () => {
    const result = buildStandardCSD(createProject({ nchnls: 1 }), 'realtime');
    expect(result.csdText).toMatch(
      /kMixSendGain = gk_blue_auto\d+ \* kMixGateState_0\nga_bluesub_Reverb_0\t\+=\tga_bluemix_0_0 \* kMixSendGain\n/,
    );
    expect((result.csdText.match(/ \* kMixSendGain/g) ?? []).length).toBe(1);
  });

  it('combines an authored unity level exactly like any other gated send', () => {
    // Realtime renders assign gk_blue_autoN to every send amount, so level 1.0
    // is not statically known unity; the shared product covers it too.
    const result = buildStandardCSD(createProject({ sendLevel: 1 }), 'realtime');
    expect((result.csdText.match(/^kMixSendGain = /gm) ?? []).length).toBe(1);
    expect((result.csdText.match(/ \* kMixSendGain/g) ?? []).length).toBe(2);
    expect(result.csdText).not.toMatch(
      /ga_bluesub_Reverb_0\t\+=\t\(ga_bluemix_0_0 \* gk_blue_auto\d+\) \* kMixGateState_0/,
    );
  });

  it('keeps ungated disk routes on the existing single-multiply form', () => {
    const result = buildStandardCSD(createProject(), 'disk');
    expect(result.csdText).toMatch(
      /ga_bluesub_Reverb_0\t\+=\t\(ga_bluemix_0_0 \* gk_blue_auto\d+\)\n/,
    );
    expect(result.csdText).not.toContain('kMixSendGain');
  });

  it('keeps fixed-muted disk routes on the existing zeroed form', () => {
    const result = buildStandardCSD(createProject({ mutedChannel: true }), 'disk');
    expect(result.csdText).toMatch(/ga_bluesub_Reverb_0\t\+=\t.*\* 0/);
    expect(result.csdText).not.toContain('kMixSendGain');
  });

  it('uses a deterministic scratch symbol independent of parameter and gate ordinals', () => {
    const first = buildStandardCSD(createProject(), 'realtime').csdText;
    const second = buildStandardCSD(createProject(), 'realtime').csdText;
    expect((second.match(/^kMixSendGain = /gm) ?? []).length).toBe(
      (first.match(/^kMixSendGain = /gm) ?? []).length,
    );
    // The scratch symbol lives in the reserved mixer namespace, not derived
    // from gk_blue_auto ordinals or gate ordinals.
    expect(first).toMatch(/^kMixSendGain = gk_blue_auto\d+ \* kMixGateState_\d+$/m);
  });
});

describe('mixer optimization: batched final clearing (Spec 118 T013/T016)', () => {
  it('emits one ordered clear of the exact old reset set after outc and applied echo', () => {
    const result = buildStandardCSD(createProject(), 'realtime');
    const mixerInstrument = mixerInstrumentOf(result.csdText);
    const lines = mixerInstrument.split('\n').map((line) => line.trim());
    const outcIndex = lines.findIndex((line) => line.startsWith('outc '));
    const echoIndex = lines.indexOf('gk_blue_mixgate_applied = kMixGateCommit');
    const clearIndex = lines.findIndex((line) => line.startsWith('clear '));
    expect(outcIndex).toBeGreaterThanOrEqual(0);
    expect(echoIndex).toBeGreaterThan(outcIndex);
    expect(clearIndex).toBeGreaterThan(echoIndex);
    // Exact ordered set: source vars, subchannel vars, master vars.
    expect(lines[clearIndex]).toBe(
      'clear ga_bluemix_0_0, ga_bluemix_0_1, ga_bluesub_Reverb_0, ga_bluesub_Reverb_1, ga_bluesub_Master_0, ga_bluesub_Master_1',
    );
    // No per-variable zero assignments remain.
    expect(mixerInstrument).not.toMatch(/^ga_(bluemix|bluesub)_\S+ = 0$/m);
  });

  it('covers a mono layout with one variable per channel', () => {
    const result = buildStandardCSD(createProject({ nchnls: 1 }), 'realtime');
    expect(mixerInstrumentOf(result.csdText)).toMatch(
      /^clear ga_bluemix_0_0, ga_bluesub_Reverb_0, ga_bluesub_Master_0$/m,
    );
  });

  it('retains disk-pruned sources in the clear set', () => {
    const data = new BlueData();
    data.getMixer().setEnabled(true);
    data
      .getMixer()
      .getChannels()
      .push(
        (() => {
          const muted = new Channel();
          muted.setName('Muted');
          muted.setAssociation('muted-track');
          muted.setMuted(true);
          return muted;
        })(),
      );
    const audible = new Channel();
    audible.setName('Audible');
    audible.setAssociation('audible-track');
    data.getMixer().getChannels().push(audible);
    // Certification requires AudioClip-only tracks; only the clear set is
    // asserted here, so a minimal score suffices.
    const result = buildStandardCSD(data, 'disk');
    const clearLine = mixerInstrumentOf(result.csdText)
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.startsWith('clear '));
    expect(clearLine).toContain('ga_bluemix_0_0');
    expect(clearLine).toContain('ga_bluemix_0_1');
  });

  it('does not produce an invalid opcode call for an empty collection', () => {
    // "An empty collection does not produce an invalid opcode call." Every
    // generated clear must carry at least one argument; a mixer with no source
    // channels still clears its master accumulators.
    const data = new BlueData();
    data.getMixer().setEnabled(true);
    const result = buildStandardCSD(data, 'realtime');
    const clearLines = mixerInstrumentOf(result.csdText)
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('clear'));
    expect(clearLines.length).toBe(1);
    expect(clearLines[0]!.length).toBeGreaterThan('clear '.length);
  });

  it('splits deterministically at the supported-runtime argument bound', () => {
    // 1,010 stereo sources exceed the verified 1,999-input clear limit
    // (2,020 source vars alone), forcing deterministic bounded groups.
    const data = new BlueData();
    data.getMixer().setEnabled(true);
    for (let i = 0; i < 1010; i++) {
      const channel = new Channel();
      channel.setName(`Strip${i}`);
      data.getMixer().getChannels().push(channel);
    }
    const result = buildStandardCSD(data, 'realtime');
    const clearLines = mixerInstrumentOf(result.csdText)
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('clear '));
    expect(clearLines.length).toBeGreaterThan(1);
    const allArgs = clearLines.flatMap((line) =>
      line
        .slice('clear '.length)
        .split(',')
        .map((value) => value.trim()),
    );
    for (const line of clearLines) {
      expect(line.split(',').length).toBeLessThanOrEqual(1999);
    }
    // Complete coverage exactly once, in the original traversal order.
    expect(allArgs.length).toBe(new Set(allArgs).size);
    expect(allArgs[0]).toBe('ga_bluemix_0_0');
    expect(allArgs[allArgs.length - 1]).toBe('ga_bluesub_Master_1');
  });
});

// ─── Spec 118 T028 (US2): deferred-accumulation eligibility barriers ───
//
// Pending-contribution constraints (optimization-eligibility contract):
// - "Existing bus accumulator; may already hold direct instrument/effect
//   content" — a replacement-output opcode must count prior content once.
// - "Stable audio signal at the original tap; never a reused scratch
//   reference" — ga_bluemix_* sources are written once per cycle, but...
// - "Unity or a stable current k-rate value; an expression name is not a
//   value snapshot" — kMixSendGain/ktempdb scratch is reused by every
//   subsequent send/fader, so deferred weighted contributions would read
//   clobbered gains.
// - "Original emission order, independent of runtime parameter/gate/panner
//   ordinals".
// - "Source/gain/destination aliases needed to detect overwrite or
//   observation barriers" — enabled effects are opaque observers/writers of
//   all global audio.
//
// Decision (T030-T033): sum/mac/vincr are DEFERRED; these tests pin the
// immediate accumulation path that must remain where batching is ineligible.

describe('mixer optimization deferred-accumulation eligibility (Spec 118 T028)', () => {
  it('emits no batching opcodes: every contribution stays an immediate ordered accumulation', () => {
    const result = buildStandardCSD(createProject(), 'realtime');
    expect(result.csdText).not.toMatch(/\b(sum|mac|maca|vincr)\b/);
    expect(result.csdText).toMatch(/ga_bluesub_Reverb_0\s\+=\sga_bluemix_0_0 \* kMixSendGain/);
  });

  it('shares one gain scratch across sends, so deferred weighted gains would alias', () => {
    const result = buildStandardCSD(
      createProject({ secondSend: { level: 0.6, pre: false } }),
      'realtime',
    );
    // Two sends, one symbol: the second product overwrites the first's value
    // after the first's accumulations consume it. A pending contribution
    // holding `kMixSendGain` by name is not holding a value snapshot.
    const products = result.csdText.match(/^kMixSendGain = /gm) ?? [];
    expect(products.length).toBe(2);
    expect(result.csdText).not.toMatch(/kMixSendGain\d/);
  });

  it('keeps an effect between contributors as an opaque full flush barrier', () => {
    const data = new BlueData();
    const mixer = data.getMixer();
    mixer.setEnabled(true);
    const bus = new Channel();
    bus.setName('Bus');
    bus.setOutChannel('Master');
    mixer.getSubChannels().push(bus);
    const first = new Channel();
    first.setName('First');
    first.setOutChannel('Master');
    const sendA = new Send();
    sendA.setSendChannel('Bus');
    sendA.setLevel(0.4);
    first.getPostEffects().push(sendA);
    mixer.getChannels().push(first);
    const observer = new Channel();
    observer.setName('Obs');
    observer.setOutChannel('Master');
    const effect = new Effect();
    effect.setName('Observer');
    effect.setNumIns(2);
    effect.setNumOuts(2);
    // Reads the destination bus: any deferral past this point changes the
    // observed contribution set.
    effect.setCode(
      'aout1 = ain1 + 0.25 * ga_bluesub_Bus_0\naout2 = ain2 + 0.25 * ga_bluesub_Bus_1',
    );
    observer.getPreEffects().push(effect);
    mixer.getChannels().push(observer);
    const second = new Channel();
    second.setName('Second');
    second.setOutChannel('Master');
    const sendB = new Send();
    sendB.setSendChannel('Bus');
    sendB.setLevel(0.5);
    second.getPostEffects().push(sendB);
    mixer.getChannels().push(second);

    const result = buildStandardCSD(data, 'realtime');
    const lines = result.csdText.split('\n').map((line) => line.trim());
    const firstSendIdx = lines.findIndex((line) =>
      /^ga_bluesub_Bus_0\s\+=\sga_bluemix_0_0 \* kMixSendGain$/.test(line),
    );
    // The effect CALL (not the early opcode definition) must sit between the
    // two send accumulations.
    const observerIdx = lines.findIndex((line) => /= blueEffect0\(/.test(line));
    const secondSendIdx = lines.findIndex((line) =>
      /^ga_bluesub_Bus_0\s\+=\sga_bluemix_2_0 \* kMixSendGain$/.test(line),
    );
    expect(firstSendIdx).toBeGreaterThan(-1);
    expect(observerIdx).toBeGreaterThan(firstSendIdx);
    expect(secondSendIdx).toBeGreaterThan(observerIdx);
  });

  it('counts prior direct destination content exactly once through ordered accumulation', () => {
    const data = new BlueData();
    data.getMixer().setEnabled(true);
    const bus = new Channel();
    bus.setName('Bus');
    bus.setOutChannel('Master');
    data.getMixer().getSubChannels().push(bus);
    const instrument = new GenericInstrument();
    instrument.setName('Direct');
    instrument.setText(
      'aL oscili 0.2, 110, -1\naR oscili 0.2, 111, -1\nblueMixerOut "Bus", aL, aR',
    );
    data.getArrangement().addInstrument(instrument, 'Direct');
    const source = new Channel();
    source.setName('Src');
    source.setOutChannel('Master');
    const send = new Send();
    send.setSendChannel('Bus');
    send.setLevel(0.5);
    source.getPostEffects().push(send);
    data.getMixer().getChannels().push(source);
    const result = buildStandardCSD(data, 'realtime');
    // The direct write precedes BlueMixer; the send's accumulation adds to it
    // (+=), so prior content survives exactly once without seeding logic.
    expect(result.csdText).toMatch(/ga_bluesub_Bus_0 \+=  aL/);
    expect(result.csdText).toMatch(/ga_bluesub_Bus_0\s\+=\sga_bluemix_0_0 \* kMixSendGain/);
  });
});
