import { describe, expect, it } from 'vitest';
import { BlueData } from '../blue-data';
import { Channel } from '../mixer/channel';
import {
  getMonoPanGains,
  getSourceLegGains,
  getStereoPanGains,
  getDualPanGains,
} from '../mixer/channel-pan';
import { Effect } from '../mixer/effect';
import { Send } from '../mixer/send';
import { GenericInstrument } from '../instruments/generic-instrument';
import { GenericScore } from '../sound-objects/generic-score';
import { AudioClip } from '../score/audio/audio-clip';
import { createAudioLayoutManifest, type AudioLayoutManifest } from '../score/audio/audio-layout';
import { TrackLayerGroup } from '../score/track/track-layer-group';
import { TimeDuration } from '../time/time-duration';
import { TimePosition } from '../time/time-position';

const MONO_CLIP = '/audio/mono.wav';
const STEREO_CLIP = '/audio/stereo.wav';

function monoObservationManifest(): AudioLayoutManifest {
  return createAudioLayoutManifest([
    [MONO_CLIP, { filePath: MONO_CLIP, channels: 1, status: 'verified' }],
  ]);
}

function stereoObservationManifest(): AudioLayoutManifest {
  return createAudioLayoutManifest([
    [MONO_CLIP, { filePath: MONO_CLIP, channels: 1, status: 'verified' }],
    [STEREO_CLIP, { filePath: STEREO_CLIP, channels: 2, status: 'verified' }],
  ]);
}

interface PanningProjectOptions {
  /** Clips placed on the associated track. */
  readonly clips?: ReadonlyArray<{ file: string }>;
  /** Whether the track also carries a non-clip item (unknown source). */
  readonly includeNonClipItem?: boolean;
  /** Fixed position of the source channel. */
  readonly sourcePan?: number;
  /** Fixed position of the Master channel. */
  readonly masterPan?: number;
}

/**
 * Panning-enabled project: one source channel associated with a track, a
 * post-fader send to a Reverb subchannel returning to Master. Mirrors the
 * contract route fixture.
 */
function createPanningProject(options: PanningProjectOptions = {}): BlueData {
  const data = new BlueData();
  data.getScore().panningEnabled = true;
  const mixer = data.getMixer();
  mixer.setEnabled(true);

  const source = new Channel();
  source.setName('Track 1');
  source.setAssociation('track-1');
  source.setOutChannel('Master');
  source.setPan(options.sourcePan ?? 0.25);
  const send = new Send();
  send.setSendChannel('Reverb');
  send.setEnabled(true);
  source.getPostEffects().push(send);
  mixer.getChannels().push(source);

  const reverb = new Channel();
  reverb.setName('Reverb');
  reverb.setOutChannel('Master');
  mixer.getSubChannels().push(reverb);

  mixer.getMaster().setPan(options.masterPan ?? 0.5);

  const group = new TrackLayerGroup();
  const track = group.newLayerAt(0);
  track.setUniqueId('track-1');
  track.setName('Track 1');
  for (const clipSpec of options.clips ?? [{ file: MONO_CLIP }]) {
    const clip = new AudioClip();
    clip.setAudioFile(clipSpec.file);
    clip.setStartTime(TimePosition.beats(0));
    clip.setSubjectiveDuration(TimeDuration.beats(1));
    track.push(clip);
  }
  if (options.includeNonClipItem) {
    const score = new GenericScore();
    score.setStartTime(TimePosition.beats(0));
    score.setSubjectiveDuration(TimeDuration.beats(1));
    track.push(score);
  }
  data.getScore().push(group);

  const instr = new GenericInstrument();
  instr.setName('Sine');
  instr.setText('a1 oscili 0.2, 440\n  outc a1, a1');
  data.getArrangement().addInstrument(instr, '1');

  return data;
}

/** Extracts the BlueMixer instrument body from a generated CSD. */
function extractBlueMixer(csdText: string): string {
  const start = csdText.indexOf('instr BlueMixer');
  expect(start).toBeGreaterThanOrEqual(0);
  const end = csdText.indexOf('\tendin', start);
  expect(end).toBeGreaterThan(start);
  return csdText.slice(start, end);
}

/** Resolves the compilation variable assigned to the first channel's pan. */
function findSourcePanVar(mixerText: string): string {
  const match = mixerText.match(
    /k_pan_l = 1\.4142135623730951 \* cos\(1\.5707963267948966 \* (\w+)\)/,
  );
  expect(match).not.toBeNull();
  return match![1]!;
}

describe('mono clip panning mixer stage CSD (Spec 112 T072)', () => {
  it('emits the equal-power Mono Pan law for a verified all-mono channel', () => {
    const data = createPanningProject({ clips: [{ file: MONO_CLIP }], sourcePan: 0.25 });
    const { csdText } = data.toRealtimePlaybackCSD(undefined, false, monoObservationManifest());
    const mixerText = extractBlueMixer(csdText);

    const panVar = findSourcePanVar(mixerText);
    expect(mixerText).toContain(
      `k_pan_l = 1.4142135623730951 * cos(1.5707963267948966 * ${panVar})`,
    );
    expect(mixerText).toContain(
      `k_pan_r = 1.4142135623730951 * sin(1.5707963267948966 * ${panVar})`,
    );
    expect(mixerText).toContain('ga_bluemix_0_0 *= k_pan_l');
    expect(mixerText).toContain('ga_bluemix_0_1 *= k_pan_r');
    // The fixed pan value reaches the runtime through the parameter init.
    expect(csdText).toContain(`${panVar} init 0.25`);
  });

  it('emits no-crossfeed Balance for stereo, mixed, and unknown channels', () => {
    const stereoData = createPanningProject({ clips: [{ file: STEREO_CLIP }] });
    const stereoResult = stereoData.toRealtimePlaybackCSD(
      undefined,
      false,
      stereoObservationManifest(),
    );
    const stereoMixer = extractBlueMixer(stereoResult.csdText);
    expect(stereoMixer).toMatch(/k_bal_l = min\(1, 2 \* \(1 - gk_blue_auto\d+\)\)/);
    expect(stereoMixer).toMatch(/k_bal_r = min\(1, 2 \* gk_blue_auto\d+\)/);
    expect(stereoMixer).toContain('ga_bluemix_0_0 *= k_bal_l');
    expect(stereoMixer).toContain('ga_bluemix_0_1 *= k_bal_r');
    expect(stereoMixer).not.toContain('k_pan_l');

    const mixedData = createPanningProject({
      clips: [{ file: MONO_CLIP }, { file: STEREO_CLIP }],
    });
    const mixedResult = mixedData.toRealtimePlaybackCSD(
      undefined,
      false,
      stereoObservationManifest(),
    );
    const mixedMixer = extractBlueMixer(mixedResult.csdText);
    expect(mixedMixer).toMatch(/k_bal_l = min\(1, 2 \* \(1 - gk_blue_auto\d+\)\)/);
    expect(mixedMixer).not.toContain('k_pan_l');

    const unknownData = createPanningProject({
      clips: [{ file: MONO_CLIP }],
      includeNonClipItem: true,
    });
    const unknownResult = unknownData.toRealtimePlaybackCSD(
      undefined,
      false,
      monoObservationManifest(),
    );
    const unknownMixer = extractBlueMixer(unknownResult.csdText);
    expect(unknownMixer).toMatch(/k_bal_l = min\(1, 2 \* \(1 - gk_blue_auto\d+\)\)/);
    expect(unknownMixer).not.toContain('k_pan_l');
  });

  it('places the position stage after send taps but before gate, meter, and parent routing', () => {
    const data = createPanningProject({ clips: [{ file: MONO_CLIP }] });
    const { csdText } = data.toRealtimePlaybackCSD(undefined, true, monoObservationManifest());
    const mixerText = extractBlueMixer(csdText);

    const sendTap = mixerText.search(/ga_bluesub_Reverb_0\t\+=\t/g);
    const panStage = mixerText.indexOf('k_pan_l = ');
    const panApply = mixerText.indexOf('ga_bluemix_0_0 *= k_pan_l');
    const outputGate = mixerText.indexOf('ga_bluemix_0_0 = ga_bluemix_0_0 * kMixGateState_1');
    const meterTap = mixerText.indexOf('kMeter_rms_0 rms ga_bluemix_0_0');
    const parentRouting = mixerText.indexOf('ga_bluesub_Master_0\t+=\tga_bluemix_0_0');

    expect(sendTap).toBeGreaterThanOrEqual(0);
    expect(panStage).toBeGreaterThan(sendTap);
    expect(panApply).toBeGreaterThan(panStage);
    expect(outputGate).toBeGreaterThan(panApply);
    expect(meterTap).toBeGreaterThan(outputGate);
    expect(parentRouting).toBeGreaterThan(meterTap);
  });

  it('taps sends before the pan stage so no send signal is panned twice', () => {
    const data = createPanningProject({ clips: [{ file: MONO_CLIP }] });
    const { csdText } = data.toRealtimePlaybackCSD(undefined, false, monoObservationManifest());
    const mixerText = extractBlueMixer(csdText);

    // The send tap scales the raw channel bus with the send amount and its
    // route gate only — no k_pan_/k_bal_ gain appears in the tap expression.
    expect(mixerText).toMatch(
      /ga_bluesub_Reverb_0\t\+=\t\(ga_bluemix_0_0 \* gk_blue_auto\d+\) \* kMixGateState_0/,
    );
    expect(mixerText).toMatch(
      /ga_bluesub_Reverb_1\t\+=\t\(ga_bluemix_0_1 \* gk_blue_auto\d+\) \* kMixGateState_0/,
    );

    // The return is positioned exactly once, by the Reverb stage itself, and
    // the panned return is what reaches Master.
    const reverbBalance = mixerText.indexOf('ga_bluesub_Reverb_0 *= k_bal_l');
    const reverbRouting = mixerText.indexOf('ga_bluesub_Master_0\t+=\tga_bluesub_Reverb_0');
    expect(reverbBalance).toBeGreaterThan(0);
    expect(reverbRouting).toBeGreaterThan(reverbBalance);
  });

  it('matches the snapshot classifier for disabled effects and enabled sends', () => {
    const data = createPanningProject({ clips: [{ file: MONO_CLIP }] });
    const source = data.getMixer().getChannels()[0]!;
    const disabledEffect = new Effect();
    disabledEffect.setEnabled(false);
    source.getPostEffects().push(disabledEffect);

    const disabledEffectResult = data.toRealtimePlaybackCSD(
      undefined,
      false,
      monoObservationManifest(),
    );
    expect(extractBlueMixer(disabledEffectResult.csdText)).toContain('k_pan_l');

    disabledEffect.setEnabled(true);
    const enabledEffectResult = data.toRealtimePlaybackCSD(
      undefined,
      false,
      monoObservationManifest(),
    );
    expect(extractBlueMixer(enabledEffectResult.csdText)).toContain('k_bal_l');
    expect(extractBlueMixer(enabledEffectResult.csdText)).not.toContain('k_pan_l');
  });

  it('uses conservative Balance for subchannels and Master even with mono sources', () => {
    const data = createPanningProject({
      clips: [{ file: MONO_CLIP }],
      sourcePan: 0.25,
      masterPan: 1,
    });
    const { csdText } = data.toRealtimePlaybackCSD(undefined, false, monoObservationManifest());
    const mixerText = extractBlueMixer(csdText);

    // Exactly one Mono Pan stage exists (the verified all-mono source channel);
    // the Reverb subchannel and Master stages use the Balance law.
    const monoPanStages = mixerText.match(/k_pan_l = /g) ?? [];
    expect(monoPanStages).toHaveLength(1);
    expect(mixerText.match(/k_bal_l = min\(1, 2 \* \(1 - gk_blue_auto\d+\)\)/g)).toHaveLength(2);

    // Master fixed position 1 is delivered through its parameter init: the
    // second Balance assignment pair in the instrument belongs to Master.
    const balanceVars = Array.from(
      mixerText.matchAll(/k_bal_l = min\(1, 2 \* \(1 - (gk_blue_auto\d+)\)\)/g),
    ).map((match) => match[1]!);
    expect(balanceVars).toHaveLength(2);
    expect(csdText).toContain(`${balanceVars[1]} init 1`);
  });

  it('omits every position stage when score panning is disabled', () => {
    const data = createPanningProject({ clips: [{ file: MONO_CLIP }] });
    data.getScore().panningEnabled = false;

    const { csdText } = data.toRealtimePlaybackCSD();
    expect(csdText).not.toContain('k_pan_l');
    expect(csdText).not.toContain('k_pan_r');
    expect(csdText).not.toContain('k_bal_l');
    expect(csdText).not.toContain('k_bal_r');
    // Routing stays intact without the stage.
    expect(csdText).toContain('ga_bluesub_Master_0\t+=\tga_bluemix_0_0');
    expect(csdText).toContain('outc ga_bluesub_Master_0, ga_bluesub_Master_1');
  });

  it('emits correct pan law curves for all 4 laws in automated Mono Pan (T011, US1)', () => {
    // 0 dB law
    const data0 = createPanningProject({ clips: [{ file: MONO_CLIP }] });
    data0.getScore().panLawDb = 0;
    const { csdText: csd0 } = data0.toRealtimePlaybackCSD(
      undefined,
      false,
      monoObservationManifest(),
    );
    const mixer0 = extractBlueMixer(csd0);
    expect(mixer0).toContain('k_pan_l = 1.4142135623730951 * (min(1, 2 * (1 - gk_blue_auto');
    expect(mixer0).toContain('k_pan_r = 1.4142135623730951 * (min(1, 2 * gk_blue_auto');

    // -3 dB law (default Spec 112 parity)
    const data3 = createPanningProject({ clips: [{ file: MONO_CLIP }] });
    data3.getScore().panLawDb = -3;
    const { csdText: csd3 } = data3.toRealtimePlaybackCSD(
      undefined,
      false,
      monoObservationManifest(),
    );
    const mixer3 = extractBlueMixer(csd3);
    expect(mixer3).toContain(
      'k_pan_l = 1.4142135623730951 * cos(1.5707963267948966 * gk_blue_auto',
    );
    expect(mixer3).toContain(
      'k_pan_r = 1.4142135623730951 * sin(1.5707963267948966 * gk_blue_auto',
    );

    // -4.5 dB law
    const data45 = createPanningProject({ clips: [{ file: MONO_CLIP }] });
    data45.getScore().panLawDb = -4.5;
    const { csdText: csd45 } = data45.toRealtimePlaybackCSD(
      undefined,
      false,
      monoObservationManifest(),
    );
    const mixer45 = extractBlueMixer(csd45);
    expect(mixer45).toContain('k_pan_l = 1.4142135623730951 * ((0.5393149814421111 * cos(');
    expect(mixer45).toContain('k_pan_r = 1.4142135623730951 * ((0.5393149814421111 * sin(');

    // -6 dB law
    const data6 = createPanningProject({ clips: [{ file: MONO_CLIP }] });
    data6.getScore().panLawDb = -6;
    const { csdText: csd6 } = data6.toRealtimePlaybackCSD(
      undefined,
      false,
      monoObservationManifest(),
    );
    const mixer6 = extractBlueMixer(csd6);
    expect(mixer6).toContain('k_pan_l = 1.4142135623730951 * ((1 - gk_blue_auto');
    expect(mixer6).toContain('k_pan_r = 1.4142135623730951 * (gk_blue_auto');
  });

  it('emits off-center boost calculation in automated Mono Pan when enabled (T011, US1)', () => {
    const data = createPanningProject({ clips: [{ file: MONO_CLIP }] });
    data.getScore().panLawDb = -3;
    data.getScore().panOffCenterBoost = true;
    const { csdText } = data.toRealtimePlaybackCSD(undefined, false, monoObservationManifest());
    const mixer = extractBlueMixer(csdText);
    expect(mixer).toContain('abs(gk_blue_auto');
    expect(mixer).toContain('k_pan_l = 1.4142135623730951 *');
  });

  it('leaves Balance channels completely invariant across all pan laws and boost states (T011, US1)', () => {
    for (const law of [0, -3, -4.5, -6] as const) {
      for (const boost of [false, true]) {
        const data = createPanningProject({ clips: [{ file: STEREO_CLIP }] });
        data.getScore().panLawDb = law;
        data.getScore().panOffCenterBoost = boost;
        const { csdText } = data.toRealtimePlaybackCSD(
          undefined,
          false,
          stereoObservationManifest(),
        );
        const mixer = extractBlueMixer(csdText);
        expect(mixer).toContain('k_bal_l = min(1, 2 * (1 - gk_blue_auto');
        expect(mixer).toContain('k_bal_r = min(1, 2 * gk_blue_auto');
        expect(mixer).not.toContain('k_pan_l');
      }
    }
  });

  it('emits Stereo Pan and Dual Pan matrix operations for stereo channels (T020, US2)', () => {
    // Stereo Pan mode
    const dataStereo = createPanningProject({ clips: [{ file: STEREO_CLIP }] });
    const stereoChan = dataStereo.getMixer().getChannels()[0]!;
    stereoChan.setStereoPanMode('stereoPan');
    stereoChan.setPan(0.25);
    stereoChan.setPanWidth(0.8);
    const { csdText: csdStereo } = dataStereo.toRealtimePlaybackCSD(
      undefined,
      false,
      stereoObservationManifest(),
    );
    const mixerStereo = extractBlueMixer(csdStereo);
    expect(mixerStereo).toContain('k_pan_pl = k_pan_c - k_pan_d');
    expect(mixerStereo).toContain('k_pan_pr = k_pan_c + k_pan_d');
    expect(mixerStereo).toContain('a_pan_in_l = ga_bluemix_0_0');
    expect(mixerStereo).toContain('a_pan_in_r = ga_bluemix_0_1');

    // Dual Pan mode
    const dataDual = createPanningProject({ clips: [{ file: STEREO_CLIP }] });
    const dualChan = dataDual.getMixer().getChannels()[0]!;
    dualChan.setStereoPanMode('dualPan');
    dualChan.setDualPanLeft(0.2);
    dualChan.setDualPanRight(0.8);
    const { csdText: csdDual } = dataDual.toRealtimePlaybackCSD(
      undefined,
      false,
      stereoObservationManifest(),
    );
    const mixerDual = extractBlueMixer(csdDual);
    expect(mixerDual).toContain('k_pan_pl = gk_blue_auto');
    expect(mixerDual).toContain('k_pan_pr = gk_blue_auto');
    expect(mixerDual).toContain('a_pan_in_l = ga_bluemix_0_0');
    expect(mixerDual).toContain('a_pan_in_r = ga_bluemix_0_1');
  });

  it('exercises true-stereo matrix calculations for signal paths, endpoint narrowing, and crossing (T020, US2)', () => {
    // 1. Endpoint narrowing: at pan = 0, effective spread d = width * min(0, 1) = 0
    // so both left and right source channels are placed at 0 (hard left)
    const [aL0, bL0, aR0, bR0] = getStereoPanGains(0.0, 1.0, -3, false);
    // Both source legs feed Left speaker with 1.0 and Right speaker with 0.0
    expect(aL0).toBeCloseTo(1.0, 5); // leftIn -> leftOut
    expect(aR0).toBeCloseTo(1.0, 5); // rightIn -> leftOut
    expect(bL0).toBeCloseTo(0.0, 5); // leftIn -> rightOut
    expect(bR0).toBeCloseTo(0.0, 5); // rightIn -> rightOut

    // Endpoint narrowing at pan = 1: both placed hard right
    const [aL1, bL1, aR1, bR1] = getStereoPanGains(1.0, 1.0, -3, false);
    expect(aL1).toBeCloseTo(0.0, 5); // leftIn -> leftOut
    expect(aR1).toBeCloseTo(0.0, 5); // rightIn -> leftOut
    expect(bL1).toBeCloseTo(1.0, 5); // leftIn -> rightOut
    expect(bR1).toBeCloseTo(1.0, 5); // rightIn -> rightOut

    // 2. Dual Pan crossing: left input placed at 0.8 (mostly right), right input placed at 0.2 (mostly left)
    const [crossAL, crossBL, crossAR, crossBR] = getDualPanGains(0.8, 0.2, -3, false);
    // left leg panned to 0.8: feeds leftOut (crossAL) and rightOut (crossBL)
    const [expLL, expLR] = getSourceLegGains(0.8, -3, false);
    expect(crossAL).toBeCloseTo(expLL, 5);
    expect(crossBL).toBeCloseTo(expLR, 5);
    // right leg panned to 0.2: feeds leftOut (crossAR) and rightOut (crossBR)
    const [expRL, expRR] = getSourceLegGains(0.2, -3, false);
    expect(crossAR).toBeCloseTo(expRL, 5);
    expect(crossBR).toBeCloseTo(expRR, 5);

    // 3. Dual Pan coincidence: both placed at center 0.5 without artificial normalization
    const [coinAL, coinBL, coinAR, coinBR] = getDualPanGains(0.5, 0.5, 0, false);
    // Under 0 dB law, center gain is 1.0 on both sides
    expect(coinAL).toBeCloseTo(1.0, 5);
    expect(coinAR).toBeCloseTo(1.0, 5);
    expect(coinBL).toBeCloseTo(1.0, 5);
    expect(coinBR).toBeCloseTo(1.0, 5);
    // Correlated input [1, 1] sums to [2.0, 2.0] without silent limiter / normalization
    const outL = 1.0 * coinAL + 1.0 * coinBL;
    const outR = 1.0 * coinAR + 1.0 * coinBR;
    expect(outL).toBeCloseTo(2.0, 5);
    expect(outR).toBeCloseTo(2.0, 5);

    // 4. Subchannel and Master with Stereo Pan and Dual Pan
    const data = createPanningProject({ clips: [{ file: STEREO_CLIP }] });
    const sub = data.getMixer().getSubChannels()[0]!;
    sub.setStereoPanMode('stereoPan');
    sub.setPan(0.3);
    sub.setPanWidth(0.7);

    const master = data.getMixer().getMaster();
    master.setStereoPanMode('dualPan');
    master.setDualPanLeft(0.1);
    master.setDualPanRight(0.9);

    const { csdText } = data.toRealtimePlaybackCSD(undefined, false, stereoObservationManifest());
    expect(csdText).toContain('a_pan_in_l = ga_bluesub_Reverb_0');
    expect(csdText).toContain('a_pan_in_l = ga_bluesub_Master_0');
  });
});
