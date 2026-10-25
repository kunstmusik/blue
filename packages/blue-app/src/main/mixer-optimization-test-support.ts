/**
 * Spec 118 original deterministic mixer fixtures. Every fixture is built from
 * public @blue/data model APIs with fixed source texts and routing, so the same
 * fixture identity generates byte-identical inputs on the baseline and candidate
 * revisions. Fixtures are test-only: nothing here is imported by production code.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  AudioClip,
  BlueData,
  BlueSynthBuilder,
  Channel,
  CurveType,
  Effect,
  GenericInstrument,
  GenericScore,
  OpcodeDefinition,
  ParameterHelper,
  getProjectParameterCatalog,
  getArrangementOwnerParameters,
  getTrackOwnerParameters,
  getMixerOwnerParameters,
  type RenderCsdResult,
  UDOStyle,
  PAN_LAW_VALUES,
  type PanLawDb,
  type StereoPanMode,
  Send,
  TempoPoint,
  TimeBehavior,
  TimeDuration,
  TimePosition,
  TrackLayerGroup,
} from '@blue/data';

export type FixtureProfile = 'realtime' | 'disk' | 'blueLive';
export type ResidualClass = 'linear' | 'stateful';

export interface MixerFixtureOptions {
  readonly sampleRate: 44100 | 48000;
  readonly ksmps: 1 | 32 | 64 | 128;
  readonly durationSeconds: number;
  /** Mono output layout for the mono edge fixtures; stereo by default. */
  readonly channels?: 1 | 2 | 4;
  /** Fixed audio file path for AudioClip-based fixtures (disk pruning matrix). */
  readonly audioFile?: string;
  readonly renderEndSeconds?: number;
  readonly maximumAmplitude?: number;
}

export interface MixerFixture {
  readonly id: string;
  /** Stable fixture identity: sha256 of the canonical descriptor. */
  readonly identity: string;
  readonly profile: FixtureProfile;
  /** Which render-equivalence residual bound applies to this fixture. */
  readonly residualClass: ResidualClass;
  readonly options: MixerFixtureOptions;
  build(): BlueData;
}

/** Score seconds long enough for the benchmark window at this rate/block. */
export function benchmarkDurationSeconds(
  sampleRate: number,
  ksmps: number,
  warmupCycles = 1024,
  measuredCycles = 65536,
): number {
  return Math.ceil(((warmupCycles + measuredCycles + 256) * ksmps) / sampleRate) + 1;
}

const SUB_CHANNELS = 8;

/** Deterministic cheap stereo source instrument text for strip `index`. */
function sourceInstrumentText(index: number, panish = false): string {
  const left = 200 + index * 7;
  const right = 203.5 + index * 7;
  const body = [
    `aSrcL oscili 0.22, ${left.toFixed(1)}, -1`,
    `aSrcR oscili 0.22, ${right.toFixed(1)}, -1`,
    panish ? 'aSrcR = aSrcL' : '',
    'blueMixerOut aSrcL, aSrcR',
  ]
    .filter(Boolean)
    .join('\n');
  return body;
}

/** Controlled stateful one-pole effect code (deterministic, no random). */
const STATEFUL_EFFECT_CODE =
  'aState1 init 0\naState2 init 0\naState1 = aState1 + 0.15 * (ain1 - aState1)\naState2 = aState2 + 0.15 * (ain2 - aState2)\naout1 = aState1\naout2 = aState2';
/** Controlled memoryless nonlinear effect code. */
const NONLINEAR_EFFECT_CODE = 'aout1 = tanh(1.5 * ain1) / 1.5\naout2 = tanh(1.5 * ain2) / 1.5';

function makeEffect(name: string, code: string): Effect {
  const effect = new Effect();
  effect.setName(name);
  effect.setNumIns(2);
  effect.setNumOuts(2);
  effect.setCode(code);
  return effect;
}

class FixtureProject {
  readonly data = new BlueData();
  private readonly scoreText: string[] = [];
  preserveScoreTiming = false;
  private readonly scoreTrack: ReturnType<TrackLayerGroup['newLayerAt']>;

  constructor(
    readonly options: MixerFixtureOptions,
    readonly profile: FixtureProfile,
  ) {
    const mixer = this.data.getMixer();
    mixer.setEnabled(true);
    mixer.setPanningEnabled(false);
    const props = this.data.getProjectProperties();
    props.channels = String(options.channels ?? 2);
    props.diskChannels = String(options.channels ?? 2);
    if (profile === 'disk') {
      props.diskSampleRate = String(options.sampleRate);
      props.diskKsmps = String(options.ksmps);
    } else {
      props.sampleRate = String(options.sampleRate);
      props.ksmps = String(options.ksmps);
    }
    this.data.setRenderStartTime(0);
    this.data.setRenderEndTime(options.durationSeconds + 1);
    const group = new TrackLayerGroup();
    group.setUniqueId('fixture-group');
    this.scoreTrack = group.newLayerAt(0);
    this.scoreTrack.setName('Fixture Score');
    this.scoreTrack.setUniqueId('fixture-score');
    this.data.getScore().length = 0;
    this.data.getScore().push(group);
  }

  note(line: string): void {
    this.scoreText.push(line);
  }

  finish(): BlueData {
    const score = new GenericScore();
    if (this.preserveScoreTiming) score.setTimeBehavior(TimeBehavior.NONE);
    score.setStartTime(TimePosition.beats(0));
    score.setSubjectiveDuration(TimeDuration.beats(this.options.durationSeconds));
    score.setScoreText(this.scoreText.join('\n'));
    this.scoreTrack.push(score);
    // Deterministic constant tempo so beat positions map exactly to seconds.
    const tempoMap = this.data.getScore().getTimeContext().getTempoMap();
    tempoMap.setTempoPoint(0, 0, 60, CurveType.CONSTANT);
    tempoMap.addTempoPoint(
      new TempoPoint(this.options.durationSeconds + 2, 60, CurveType.CONSTANT),
    );
    tempoMap.setEnabled(true);
    // Fixture construction owns these ids; do not normalize them out of the
    // input hash, where changed associations must remain observable.
    const mixer = this.data.getMixer();
    let ordinal = 0;
    for (const channel of [
      ...mixer.getAllSourceChannels(),
      ...mixer.getSubChannels(),
      mixer.getMaster(),
    ]) {
      const parameters = [
        channel.getLevelParameter(),
        channel.getPanParameter(),
        channel.getPanWidthParameter(),
        channel.getDualPanLeftParameter(),
        channel.getDualPanRightParameter(),
        ...[...channel.getPreEffects(), ...channel.getPostEffects()].flatMap((entry) =>
          entry.getParameters(),
        ),
      ];
      for (const parameter of parameters) parameter.setUniqueId(`fixture-param-${ordinal++}`);
    }
    return this.data;
  }

  addSourceStrip(
    name: string,
    spec: {
      out?: string;
      level?: number;
      sends?: ReadonlyArray<{ target: string; level: number; pre?: boolean }>;
      effects?: Effect[];
      preEffects?: Effect[];
      muted?: boolean;
      solo?: boolean;
      instrumentText?: string;
      /** One oscillator feeding both channels (mixer-dominated benchmark strips). */
      monoSource?: boolean;
    } = {},
  ): Channel {
    const mixer = this.data.getMixer();
    const channel = new Channel();
    channel.setName(name);
    if (spec.out) channel.setOutChannel(spec.out);
    if (spec.level !== undefined) channel.setLevel(spec.level);
    if (spec.muted) channel.setMuted(true);
    if (spec.solo) channel.setSolo(true);
    for (const sendSpec of spec.sends ?? []) {
      const send = new Send();
      send.setSendChannel(sendSpec.target);
      send.setLevel(sendSpec.level);
      (sendSpec.pre ? channel.getPreEffects() : channel.getPostEffects()).push(send);
    }
    for (const effect of spec.preEffects ?? []) channel.getPreEffects().push(effect);
    for (const effect of spec.effects ?? []) channel.getPostEffects().push(effect);
    mixer.getChannels().push(channel);

    // Instrument ids are emitted into `instr <id>` without quoting; keep them
    // space-free while mixer channel display names may keep spaces.
    const instrumentId = name.replace(/\s+/g, '_');
    const instrument = new GenericInstrument();
    instrument.setName(name);
    const index = mixer.getChannels().length - 1;
    if (spec.instrumentText) {
      instrument.setText(spec.instrumentText);
    } else if (spec.monoSource) {
      instrument.setText(
        `aSrcL oscili 0.22, ${(200 + index * 7).toFixed(1)}, -1\nblueMixerOut aSrcL, aSrcL`,
      );
    } else {
      instrument.setText(sourceInstrumentText(index));
    }
    this.data.getArrangement().addInstrument(instrument, instrumentId);
    this.note(`i"${instrumentId}" 0 ${this.options.durationSeconds}`);
    return channel;
  }

  addSubChannel(
    name: string,
    spec: { out?: string; level?: number; effects?: Effect[]; preEffects?: Effect[] } = {},
  ): Channel {
    const mixer = this.data.getMixer();
    const channel = new Channel();
    channel.setName(name);
    if (spec.out) channel.setOutChannel(spec.out);
    if (spec.level !== undefined) channel.setLevel(spec.level);
    for (const effect of spec.preEffects ?? []) channel.getPreEffects().push(effect);
    for (const effect of spec.effects ?? []) channel.getPostEffects().push(effect);
    mixer.getSubChannels().push(channel);
    return channel;
  }
}

function fixture(
  id: string,
  profile: FixtureProfile,
  residualClass: ResidualClass,
  options: MixerFixtureOptions,
  buildProject: (project: FixtureProject) => void,
): MixerFixture {
  options = { ...options, maximumAmplitude: declaredFixtureAmplitude(id, options.sampleRate) };
  const build = (): BlueData => {
    const project = new FixtureProject(options, profile);
    buildProject(project);
    return project.finish();
  };
  return {
    id,
    identity: fixtureInputIdentity(build(), id, profile, options),
    profile,
    residualClass,
    options,
    build,
  };
}

/** Complete original input identity, before compilation. Only AudioClip artifact
 * locations are replaced on a history copy; each referenced file's exact bytes
 * are hashed in traversal order. Authored text/whitespace is never normalized.
 * Fixture-owned group/track ids are assigned deterministically by the builder.
 */
export function fixtureInputIdentity(
  data: BlueData,
  id: string,
  profile: FixtureProfile,
  options: MixerFixtureOptions,
): string {
  const copy = data.deepCopy('history');
  const audio: string[] = [];
  for (const group of copy.getScore()) {
    if (!(group instanceof TrackLayerGroup)) continue;
    for (const track of group)
      for (const item of track) {
        if (!(item instanceof AudioClip)) continue;
        const file = item.getAudioFile();
        const bytes =
          file === 'prune-source.wav' && !options.audioFile
            ? pruneSourceWavBuffer()
            : readFileSync(file);
        audio.push(createHash('sha256').update(bytes).digest('hex'));
        item.setAudioFile(`fixture-audio-${audio.length}`);
      }
  }
  return createHash('sha256')
    .update(
      JSON.stringify({
        identityVersion: 2,
        id,
        profile,
        options: { ...options, audioFile: undefined },
        projectXml: copy.saveToString(),
        audio,
      }),
    )
    .digest('hex');
}

// ─── Fixture set builders ───

function primarySendHeavy(options: MixerFixtureOptions, profile: FixtureProfile): MixerFixture {
  return fixture('primary-send-heavy', profile, 'linear', options, (project) => {
    for (let sub = 0; sub < SUB_CHANNELS; sub++) {
      project.addSubChannel(`Bus ${sub}`, { out: 'Master', level: 1 });
    }
    for (let i = 0; i < 128; i++) {
      const sends = [0, 1, 2, 3].map((s) => ({
        target: `Bus ${(i + s) % SUB_CHANNELS}`,
        level: 0.25 + ((i + s) % 4) * 0.25,
        pre: s % 2 === 0,
      }));
      project.addSourceStrip(`Strip ${i}`, {
        out: 'Master',
        level: i % 8 === 0 ? 1 : 0.5 + (i % 8) * 0.0625,
        sends,
        monoSource: true,
      });
    }
  });
}

function smallSingle(options: MixerFixtureOptions, profile: FixtureProfile): MixerFixture {
  return fixture('small-single', profile, 'linear', options, (project) => {
    project.addSourceStrip('Only Strip', { out: 'Master' });
  });
}

function smallSixteen(options: MixerFixtureOptions, profile: FixtureProfile): MixerFixture {
  return fixture('small-sixteen', profile, 'linear', options, (project) => {
    project.addSubChannel('Send Bus', { out: 'Master' });
    for (let i = 0; i < 16; i++) {
      project.addSourceStrip(`Strip ${i}`, {
        out: 'Master',
        sends: i % 3 === 0 ? [] : [{ target: 'Send Bus', level: i % 3 === 1 ? 1 : 0.4 }],
      });
    }
  });
}

function fanIn(
  groupSize: number,
  weighted: boolean,
  withDirect: boolean,
  options: MixerFixtureOptions,
  profile: FixtureProfile,
): MixerFixture {
  const id = `fan-in-${groupSize}${weighted ? '-weighted' : ''}${withDirect ? '-direct' : ''}`;
  return fixture(id, profile, 'linear', options, (project) => {
    const buses = 128 / groupSize;
    for (let b = 0; b < buses; b++) {
      project.addSubChannel(`Bus ${b}`, { out: 'Master' });
    }
    if (withDirect) {
      // Direct subchannel content contributed by an authored instrument.
      const direct = new GenericInstrument();
      direct.setName('DirectBusWriter');
      direct.setText(
        'aL oscili 0.2, 110, -1\naR oscili 0.2, 112.5, -1\nblueMixerOut "Bus 0", aL, aR',
      );
      project.data.getArrangement().addInstrument(direct, 'DirectBusWriter');
      project.note(`i"DirectBusWriter" 0 ${options.durationSeconds}`);
    }
    for (let i = 0; i < 128; i++) {
      const bus = `Bus ${Math.floor(i / groupSize)}`;
      project.addSourceStrip(`Strip ${i}`, {
        out: bus,
        sends: weighted ? [{ target: bus, level: 0.3 + (i % 5) * 0.1 }] : [],
        monoSource: true,
      });
    }
  });
}

function barrierRich(options: MixerFixtureOptions, profile: FixtureProfile): MixerFixture {
  return fixture('barrier-rich', profile, 'stateful', options, (project) => {
    const stateful = makeEffect('One Pole', STATEFUL_EFFECT_CODE);
    const nonlinear = makeEffect('Soft Clip', NONLINEAR_EFFECT_CODE);
    const observer = makeEffect(
      'Bus Observer',
      'aout1 = ain1 + 0.25 * ga_bluesub_Observed_0\naout2 = ain2 + 0.25 * ga_bluesub_Observed_1',
    );
    project.addSubChannel('Observed', { out: 'Master' });
    project.addSubChannel('Return', { out: 'Master', effects: [stateful] });
    project.addSourceStrip('Feed Observed', {
      out: 'Master',
      sends: [{ target: 'Observed', level: 0.5 }],
    });
    project.addSourceStrip('Barrier Strip', {
      out: 'Master',
      preEffects: [nonlinear],
      sends: [
        { target: 'Return', level: 0.35, pre: true },
        { target: 'Observed', level: 0.2 },
      ],
    });
    project.addSubChannel('Master Bus', { out: 'Master', preEffects: [observer] });
    project.addSourceStrip('After Send Change', {
      out: 'Master Bus',
      level: 0.8,
      sends: [{ target: 'Return', level: 0.45, pre: true }],
    });
  });
}

function panningMatrix(options: MixerFixtureOptions, profile: FixtureProfile): MixerFixture {
  return fixture('panning-matrix', profile, 'linear', options, (project) => {
    const data = project.data;
    data.getMixer().setPanningEnabled(true);
    const balance = project.addSourceStrip('Balance Strip', { out: 'Master' });
    balance.setStereoPanMode('balance');
    balance.setPan(0.3);
    const stereoPan = project.addSourceStrip('Stereo Pan Strip', { out: 'Master' });
    stereoPan.setStereoPanMode('stereoPan');
    stereoPan.setPan(0.6);
    stereoPan.setPanWidth(0.5);
    const dualPan = project.addSourceStrip('Dual Pan Strip', { out: 'Master' });
    dualPan.setStereoPanMode('dualPan');
    dualPan.setDualPanLeft(0.2);
    dualPan.setDualPanRight(0.8);
    const monoStrip = project.addSourceStrip('Mono Source Strip', {
      out: 'Master',
      instrumentText: 'aSrcL oscili 0.22, 137.0, -1\nblueMixerOut aSrcL, aSrcL',
    });
    monoStrip.setPan(0.25);
  });
}

function metering(options: MixerFixtureOptions, profile: FixtureProfile): MixerFixture {
  return fixture('metering', profile, 'linear', options, (project) => {
    project.addSourceStrip('Metered A', {
      out: 'Master',
      sends: [{ target: 'Master', level: 0.5 }],
    });
    project.addSourceStrip('Metered B', { out: 'Master' });
  });
}

function disabledMixer(options: MixerFixtureOptions, profile: FixtureProfile): MixerFixture {
  return fixture('disabled-mixer', profile, 'linear', options, (project) => {
    project.data.getMixer().setEnabled(false);
    const instrument = new GenericInstrument();
    instrument.setName('Bypass');
    instrument.setText('aL oscili 0.2, 220, -1\naR oscili 0.2, 221, -1\noutc aL, aR');
    project.data.getArrangement().addInstrument(instrument, 'Bypass');
    project.note(`i"Bypass" 0 ${options.durationSeconds}`);
  });
}

function mutedDiskPruned(options: MixerFixtureOptions): MixerFixture {
  return fixture('muted-disk-pruned', 'disk', 'linear', options, (project) => {
    const data = project.data;
    const group = data.getScore()[0] as TrackLayerGroup;
    const mutedTrack = group.newLayerAt(1);
    mutedTrack.setName('Muted Track');
    mutedTrack.setUniqueId('muted-track');
    const mutedClip = new AudioClip();
    mutedClip.setStartTime(TimePosition.beats(0));
    mutedClip.setSubjectiveDuration(TimeDuration.beats(options.durationSeconds));
    mutedClip.setAudioFile(options.audioFile ?? 'prune-source.wav');
    mutedTrack.push(mutedClip);
    const audibleTrack = group.newLayerAt(2);
    audibleTrack.setName('Audible Track');
    audibleTrack.setUniqueId('audible-track');
    const audibleClip = new AudioClip();
    audibleClip.setStartTime(TimePosition.beats(0));
    audibleClip.setSubjectiveDuration(TimeDuration.beats(options.durationSeconds));
    audibleClip.setAudioFile(options.audioFile ?? 'prune-source.wav');
    audibleTrack.push(audibleClip);
    const mutedChannel = new Channel();
    mutedChannel.setName('Muted');
    mutedChannel.setAssociation('muted-track');
    mutedChannel.setMuted(true);
    data.getMixer().getChannels().push(mutedChannel);
    const audibleChannel = new Channel();
    audibleChannel.setName('Audible');
    audibleChannel.setAssociation('audible-track');
    data.getMixer().getChannels().push(audibleChannel);
  });
}

function soundThenSilence(options: MixerFixtureOptions, profile: FixtureProfile): MixerFixture {
  return fixture('sound-then-silence', profile, 'linear', options, (project) => {
    project.preserveScoreTiming = true;
    const instrument = new GenericInstrument();
    instrument.setName('ShortSource');
    instrument.setText(
      'aEnv linen 0.25, 0.05, p3, 0.1\naL oscili aEnv, 300, -1\naR oscili aEnv, 302, -1\nblueMixerOut aL, aR',
    );
    project.data.getArrangement().addInstrument(instrument, 'ShortSource');
    // Sound for the first third; silence (performance continues) afterwards.
    project.note(`i"ShortSource" 0 ${Math.max(0.25, options.durationSeconds / 3)}`);
  });
}

function zeroAndUnitySends(options: MixerFixtureOptions, profile: FixtureProfile): MixerFixture {
  return fixture('send-level-matrix', profile, 'linear', options, (project) => {
    project.addSubChannel('Matrix Bus', { out: 'Master' });
    project.addSourceStrip('Zero Send', {
      out: 'Master',
      sends: [{ target: 'Matrix Bus', level: 0 }],
    });
    project.addSourceStrip('Unity Send', {
      out: 'Master',
      sends: [{ target: 'Matrix Bus', level: 1 }],
    });
    project.addSourceStrip('NonUnity Send', {
      out: 'Master',
      sends: [{ target: 'Matrix Bus', level: 0.6, pre: true }],
    });
    project.addSourceStrip('Muted Send Strip', {
      out: 'Master',
      muted: true,
      sends: [{ target: 'Matrix Bus', level: 0.4 }],
    });
  });
}

function representative(options: MixerFixtureOptions, profile: FixtureProfile): MixerFixture {
  return fixture('representative', profile, 'stateful', options, (project) => {
    const lowpass = makeEffect('Bus Pole', STATEFUL_EFFECT_CODE);
    project.addSubChannel('Sub Mix', { out: 'Master', effects: [lowpass], level: 0.9 });
    for (let i = 0; i < 8; i++) {
      const instrument = new GenericInstrument();
      instrument.setName(`Voice ${i}`);
      const f0 = (140 + i * 23).toFixed(1);
      instrument.setText(
        [
          'aEnv expon 0.3, p3, 0.001',
          `a1 oscili aEnv, ${f0}, -1`,
          `a2 oscili aEnv * 0.5, ${(Number(f0) * 2.01).toFixed(1)}, -1`,
          `a3 oscili aEnv * 0.25, ${(Number(f0) * 3.02).toFixed(1)}, -1`,
          'aL = a1 + a2 + a3',
          'aR = a1 - a2 + a3 * 0.5',
          'blueMixerOut aL, aR',
        ].join('\n'),
      );
      const instrumentId = `Voice${i}`;
      project.data.getArrangement().addInstrument(instrument, instrumentId);
      project.note(`i"${instrumentId}" 0 ${options.durationSeconds}`);
      const channel = new Channel();
      channel.setName(`Voice ${i}`);
      channel.setOutChannel(i % 3 === 0 ? 'Sub Mix' : 'Master');
      const send = new Send();
      send.setSendChannel('Sub Mix');
      send.setLevel(0.3 + (i % 3) * 0.15);
      channel.getPostEffects().push(send);
      project.data.getMixer().getChannels().push(channel);
    }
  });
}

export interface FixtureSetOptions {
  /** Comparison fixtures use short scores; benchmark fixtures cover the window. */
  readonly mode: 'comparison' | 'benchmark';
  readonly sampleRate: 44100 | 48000;
  readonly ksmps: 1 | 32 | 64 | 128;
  readonly channels?: 1 | 2 | 4;
  readonly audioFile?: string;
}

const COMPARISON_DURATION_SECONDS = 2;

/** The full deterministic fixture set for a mode/rate/block combination. */
export function buildFixtureSet(setOptions: FixtureSetOptions): MixerFixture[] {
  const options: MixerFixtureOptions = {
    sampleRate: setOptions.sampleRate,
    ksmps: setOptions.ksmps,
    channels: setOptions.channels,
    audioFile: setOptions.audioFile,
    durationSeconds:
      setOptions.mode === 'benchmark'
        ? benchmarkDurationSeconds(setOptions.sampleRate, setOptions.ksmps)
        : COMPARISON_DURATION_SECONDS,
  };
  return [
    ...(setOptions.mode === 'comparison' &&
    setOptions.sampleRate === 44100 &&
    setOptions.ksmps === 64
      ? buildLiveTraceFixtures()
      : []),
    primarySendHeavy(options, 'realtime'),
    smallSingle(options, 'realtime'),
    smallSixteen(options, 'realtime'),
    fanIn(2, false, false, options, 'realtime'),
    fanIn(2, true, false, options, 'realtime'),
    fanIn(4, false, false, options, 'realtime'),
    fanIn(8, true, false, options, 'realtime'),
    fanIn(16, false, true, options, 'realtime'),
    fanIn(32, true, false, options, 'realtime'),
    fanIn(32, false, false, options, 'realtime'),
    barrierRich(options, 'realtime'),
    panningMatrix(options, 'realtime'),
    metering(options, 'realtime'),
    disabledMixer(options, 'realtime'),
    mutedDiskPruned(options),
    soundThenSilence(options, 'realtime'),
    ...(setOptions.mode === 'comparison' ? lifecycleEdgeFixtures(options) : []),
    zeroAndUnitySends(options, 'realtime'),
    representative(options, 'realtime'),
    smallSingle(options, 'disk'),
    zeroAndUnitySends(options, 'disk'),
    primarySendHeavy(options, 'disk'),
  ];
}

/** BlueLive generation fixture (generation-compatibility only). */
export function buildBlueLiveFixture(sampleRate: 44100 | 48000 = 44100, ksmps: 64 = 64): BlueData {
  const project = new FixtureProject({ sampleRate, ksmps, durationSeconds: 2 }, 'realtime');
  project.addSubChannel('Live Bus', { out: 'Master' });
  project.addSourceStrip('Live Strip', {
    out: 'Master',
    sends: [
      { target: 'Live Bus', level: 0.5, pre: true },
      { target: 'Live Bus', level: 0.25 },
    ],
  });
  return project.finish();
}

/** Original deterministic 16-bit mono PCM source used by clip fixtures. */
export function pruneSourceWavBuffer(): Buffer {
  const sampleRate = 44100;
  const frames = sampleRate; // 1 second
  const data = Buffer.alloc(frames * 2);
  for (let i = 0; i < frames; i++) {
    const sample = Math.round(Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 12000);
    data.writeInt16LE(sample, i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

/** Constant separated channels expose each send's exact 5ms ramp independently. */
export function buildLiveTraceFixtures(): MixerFixture[] {
  return (['realtime', 'blueLive'] as const).map((profile) =>
    fixture(
      'live-control-trace',
      profile,
      'linear',
      { sampleRate: 44100, ksmps: 64, durationSeconds: 2 },
      (project) => {
        project.data.getProjectProperties().useZeroDbFS = true;
        project.addSubChannel('Return', { out: 'Master' });
        project.addSubChannel('Sink', { out: 'Sink' });
        for (const [name, value, closed] of [
          ['TraceA', 0.1, false],
          ['TraceB', 0.2, true],
        ] as const) {
          const instrument = new BlueSynthBuilder();
          instrument.setAlwaysOnInstrumentText(
            `aL init ${name === 'TraceA' ? value : 0}\naR init ${name === 'TraceB' ? value : 0}\nblueMixerOut aL, aR`,
          );
          project.data.getArrangement().addInstrument(instrument, name);
          const channel = new Channel();
          channel.setName(name);
          channel.setOutChannel('Sink');
          channel.setMuted(closed);
          const send = new Send();
          send.setSendChannel('Return');
          send.setLevel(0.5);
          (name === 'TraceA' ? channel.getPreEffects() : channel.getPostEffects()).push(send);
          project.data.getMixer().getChannels().push(channel);
        }
        project.note('f0 2');
      },
    ),
  );
}

/** Shared pinned capture read for live/pan tests. Each caller supplies the exact
 * fixture; identity and CSD hash are checked before managed-engine execution. */
export function pinnedFixtureCsd(fixture: MixerFixture, directory: string): string {
  const manifest = JSON.parse(readFileSync(join(directory, 'baseline-manifest.json'), 'utf8'));
  const entry = manifest.fixtures.find(
    (entry: { id: string; profile: string; identity: string }) =>
      entry.id === fixture.id &&
      entry.profile === fixture.profile &&
      entry.identity === fixture.identity,
  );
  if (manifest.schemaVersion !== 2 || !entry || !/^[0-9a-f]{40}$/.test(manifest.blueRevision)) {
    throw new Error(
      `pinned baseline missing or incompatible fixture ${fixture.id}/${fixture.profile}`,
    );
  }
  const csd = readFileSync(join(directory, entry.csdFile), 'utf8');
  if (createHash('sha256').update(csd).digest('hex') !== entry.csdSha256)
    throw new Error('pinned CSD hash mismatch');
  return csd;
}

export const PANNING_INPUTS = {
  mono: [0.25],
  left: [0.25, 0],
  right: [0, 0.25],
  correlated: [0.25, 0.25],
  antiphase: [0.25, -0.25],
} as const;
export type PanningInput = keyof typeof PANNING_INPUTS;
export interface PanningCase {
  law: PanLawDb;
  boost: boolean;
  input: PanningInput;
  mode: StereoPanMode;
  pan: number;
  width: number;
  left: number;
  right: number;
}

/** Original exact PCM amplitudes, shared across pre-change/candidate captures. */
export function writePanningSources(directory: string): void {
  for (const [name, values] of Object.entries(PANNING_INPUTS)) {
    const frames = 44100 * 2,
      channels = values.length;
    const wav = Buffer.alloc(44 + frames * channels * 2);
    wav.write('RIFF');
    wav.writeUInt32LE(wav.length - 8, 4);
    wav.write('WAVEfmt ', 8);
    wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20);
    wav.writeUInt16LE(channels, 22);
    wav.writeUInt32LE(44100, 24);
    wav.writeUInt32LE(44100 * channels * 2, 28);
    wav.writeUInt16LE(channels * 2, 32);
    wav.writeUInt16LE(16, 34);
    wav.write('data', 36);
    wav.writeUInt32LE(wav.length - 44, 40);
    for (let frame = 0; frame < frames; frame++)
      for (let channel = 0; channel < channels; channel++) {
        wav.writeInt16LE(
          Math.round(values[channel]! * 32768),
          44 + (frame * channels + channel) * 2,
        );
      }
    writeFileSync(join(directory, `pan-${name}.wav`), wav);
  }
}

export function buildPanningFixtures(
  directory: string,
): Array<MixerFixture & { panCase: PanningCase }> {
  const shapes: Array<Partial<PanningCase>> = [
    { input: 'mono', pan: 0.5 },
    { mode: 'balance', input: 'left', pan: 0 },
    { mode: 'stereoPan', input: 'antiphase', pan: 0.5, width: 0 },
    { mode: 'dualPan', input: 'correlated', left: 1, right: 0 },
  ];
  const variants: PanningCase[] = [];
  for (const law of PAN_LAW_VALUES)
    for (const boost of [false, true])
      for (const shape of shapes) {
        variants.push({
          law,
          boost,
          input: 'left',
          mode: 'balance',
          pan: 0.5,
          width: 1,
          left: 0,
          right: 1,
          ...shape,
        });
      }
  variants.push(
    { law: -3, boost: false, input: 'mono', mode: 'balance', pan: 0, width: 1, left: 0, right: 1 },
    { law: -3, boost: false, input: 'right', mode: 'balance', pan: 1, width: 1, left: 0, right: 1 },
    {
      law: -3,
      boost: false,
      input: 'right',
      mode: 'stereoPan',
      pan: 0.5,
      width: 1,
      left: 0,
      right: 1,
    },
    {
      law: -3,
      boost: false,
      input: 'left',
      mode: 'stereoPan',
      pan: 1,
      width: 1,
      left: 0,
      right: 1,
    },
    {
      law: -3,
      boost: false,
      input: 'antiphase',
      mode: 'dualPan',
      pan: 0.5,
      width: 1,
      left: 0.5,
      right: 0.5,
    },
  );
  return variants.map((panCase, index) => {
    const options: MixerFixtureOptions = {
      sampleRate: 44100,
      ksmps: 64,
      durationSeconds: 2,
      audioFile: join(directory, `pan-${panCase.input}.wav`),
    };
    return {
      ...fixture(
        `pan-contract-${index}-${panCase.mode}-${panCase.input}`,
        'realtime',
        'linear',
        options,
        (project) => {
          const mixer = project.data.getMixer();
          mixer.setPanningEnabled(true);
          mixer.setPanLawDb(panCase.law);
          mixer.setPanOffCenterBoost(panCase.boost);
          project.data.getProjectProperties().useZeroDbFS = true;
          const group = project.data.getScore()[0] as TrackLayerGroup;
          const track = group.newLayerAt(1);
          track.setUniqueId('panning-track');
          const clip = new AudioClip();
          clip.setAudioFile(options.audioFile!);
          clip.setStartTime(TimePosition.beats(0));
          clip.setSubjectiveDuration(TimeDuration.beats(2));
          track.push(clip);
          const channel = new Channel();
          channel.setName('Pan Source');
          channel.setAssociation('panning-track');
          channel.setStereoPanMode(panCase.mode);
          channel.setPan(panCase.pan);
          channel.setPanWidth(panCase.width);
          channel.setDualPanLeft(panCase.left);
          channel.setDualPanRight(panCase.right);
          const send = new Send();
          send.setSendChannel('Master');
          send.setLevel(0.4);
          channel.getPostEffects().push(send);
          mixer.getChannels().push(channel);
          project.note('f0 2');
        },
      ),
      panCase,
    };
  });
}

function lifecycleEdgeFixtures(options: MixerFixtureOptions): MixerFixture[] {
  return ['partial-first-final', 'impulse-effect-tail', 'effect-from-silence'].map((kind) =>
    fixture(kind, 'realtime', 'linear', options, (project) => {
      project.preserveScoreTiming = true;
      project.data.getProjectProperties().useZeroDbFS = true;
      project.data.getProjectProperties().advancedSettings = '--sample-accurate';
      const source = new Channel();
      source.setName('LifecycleSource');
      source.setOutChannel('LifecycleBus');
      if (kind === 'impulse-effect-tail')
        source
          .getPostEffects()
          .push(makeEffect('Exact Delay', 'aout1 delay ain1, 0.01\naout2 delay ain2, 0.01'));
      if (kind === 'effect-from-silence')
        source
          .getPostEffects()
          .push(makeEffect('Sound From Silence', 'aout1 = ain1 + 0.125\naout2 = ain2 - 0.125'));
      project.data.getMixer().getChannels().push(source);
      project.addSubChannel('LifecycleBus', { out: 'Master' });
      if (kind !== 'effect-from-silence') {
        const instrument = new GenericInstrument();
        instrument.setText('aL init 0.125\naR init -0.125\nblueMixerOut aL, aR');
        project.data.getArrangement().addInstrument(instrument, 'LifecycleSource');
        project.note(
          `i"LifecycleSource" ${3 / options.sampleRate} ${(kind === 'partial-first-final' ? 11.25 : 1.25) / options.sampleRate}`,
        );
      }
      project.note(`f0 ${options.durationSeconds}`);
    }),
  );
}

export function buildRoutingFixtures(
  options: MixerFixtureOptions = { sampleRate: 44100, ksmps: 64, durationSeconds: 2 },
): MixerFixture[] {
  const layouts = ([1, 2, 4] as const).map((channels) =>
    fixture(
      `routing-direct-chain-${channels}`,
      'realtime',
      'linear',
      { ...options, channels },
      (project) => {
        project.data.getProjectProperties().useZeroDbFS = true;
        project.addSubChannel('FirstBus', { out: 'Receiver' });
        project.addSubChannel('Receiver', { out: 'Master' });
        const vars = Array.from({ length: channels }, (_, index) => `a${index}`);
        const text = vars.map((name, index) => `${name} init ${(index + 1) / 32}`).join('\n');
        const direct = new GenericInstrument();
        direct.setText(
          `${text}\nblueMixerOut "Receiver", ${vars.join(', ')}\nblueMixerOut ${vars.join(', ')}`,
        );
        project.data.getArrangement().addInstrument(direct, 'DirectWriter');
        project.note(`i"DirectWriter" 0 ${options.durationSeconds}`);
        project.addSourceStrip('RouteSource', {
          out: 'FirstBus',
          sends: [{ target: 'Receiver', level: 0.5 }],
          instrumentText: `${text}\nblueMixerOut ${vars.join(', ')}`,
        });
      },
    ),
  );
  const empty = fixture('routing-no-source', 'realtime', 'linear', options, (project) => {
    project.note('f0 2');
  });
  const input = fixture('routing-mixer-in', 'realtime', 'linear', options, (project) => {
    project.data.getProjectProperties().useZeroDbFS = true;
    for (const [id, text] of [
      ['1', 'aL init 0.0625\naR init -0.0625\nblueMixerOut aL, aR'],
      ['2', 'aL, aR blueMixerIn\naL = aL * 2\naR = aR * 2\nblueMixerOut aL, aR'],
    ]) {
      const instrument = new GenericInstrument();
      instrument.setText(text!);
      project.data.getArrangement().addInstrument(instrument, id);
      project.note(`i${id} 0 2`);
    }
  });
  const nested = fixture(
    'routing-nested-observer-writer',
    'realtime',
    'linear',
    options,
    (project) => {
      project.data.getProjectProperties().useZeroDbFS = true;
      project.addSubChannel('ObservedBus', { out: 'Master' });
      project.addSubChannel('Sink', { out: 'Sink' });
      project.addSourceStrip('Early', {
        out: 'Sink',
        sends: [{ target: 'ObservedBus', level: 0.5 }],
        instrumentText: 'aL init 0.125\naR init 0.125\nblueMixerOut aL, aR',
      });
      const observer = makeEffect('Nested Reader Writer', 'aout1, aout2 T118Outer ain1, ain2');
      const inner = new OpcodeDefinition();
      inner.setName('T118Inner');
      inner.setStyle(UDOStyle.CLASSIC);
      inner.setOutTypes('aa');
      inner.setInTypes('aa');
      inner.setCode(
        'aL, aR xin\n#define T118BUSADD #ga_bluesub_ObservedBus_0 += 0.015625\nga_bluesub_ObservedBus_1 += 0.015625#\n$T118BUSADD\nxout ga_bluesub_ObservedBus_0, ga_bluesub_ObservedBus_1',
      );
      const outer = new OpcodeDefinition();
      outer.setName('T118Outer');
      outer.setStyle(UDOStyle.CLASSIC);
      outer.setOutTypes('aa');
      outer.setInTypes('aa');
      outer.setCode('aL, aR xin\naL, aR T118Inner aL, aR\nxout aL, aR');
      observer.getOpcodeList().addOpcode(inner);
      observer.getOpcodeList().addOpcode(outer);
      const channel = new Channel();
      channel.setName('Observer');
      channel.setOutChannel('Master');
      channel.getPreEffects().push(observer);
      project.data.getMixer().getChannels().push(channel);
      project.addSourceStrip('Late', {
        out: 'Sink',
        sends: [{ target: 'ObservedBus', level: 0.5 }],
        instrumentText: 'aL init 0.25\naR init 0.25\nblueMixerOut aL, aR',
      });
    },
  );
  return [...layouts, empty, input, nested];
}

/** Existing supported Java-format input plus the checked-in TypeScript BlueX7
 * project. Crop only the render window; preserve authored DSP and source files.
 * Historical loader-created default ids are assigned deterministically at
 * fixture construction, while ids present in the original XML are retained.
 */
export function buildProjectCorpusFixtures(root: string): MixerFixture[] {
  const javaXml =
    '<blueData version="2.8.0"><projectProperties><title>Java format mixer contract</title><sampleRate>44100</sampleRate><ksmps>64</ksmps><channels>2</channels><useZeroDbFS>true</useZeroDbFS><zeroDbFS>1</zeroDbFS></projectProperties><arrangement><instrumentAssignment arrangementId="1" isEnabled="true"><instrument type="blue.orchestra.GenericInstrument"><name>Java direct source</name><instrumentText>aL init 0.125\naR init -0.125\nblueMixerOut aL, aR</instrumentText></instrument></instrumentAssignment></arrangement><globalOrcSco><globalOrc></globalOrc><globalSco>i1 0 2</globalSco></globalOrcSco><mixer><enabled>true</enabled><channelList list="channels"/><channelList list="subChannels"/><channel><name>Master</name><level>0.0</level></channel></mixer><score><soundObject type="blue.soundObject.PolyObject"><soundLayer/></soundObject></score></blueData>';
  return [
    ['java-project-corpus', javaXml],
    [
      'typescript-project-corpus',
      readFileSync(join(root, 'fixtures/blue-x7-pop-song.blue'), 'utf8'),
    ],
  ].map(([id, xml]) => {
    const build = () => {
      const data = BlueData.loadFromString(xml!);
      data.setRenderStartTime(0);
      data.setRenderEndTime(3);
      const props = data.getProjectProperties();
      props.sampleRate = '44100';
      props.ksmps = '64';
      props.diskSampleRate = '44100';
      props.diskKsmps = id === 'typescript-project-corpus' ? '1' : '64';
      const existingIds = new Set(
        [...xml!.matchAll(/uniqueId="([^"]+)"/g)].map((match) => match[1]),
      );
      let groupOrdinal = 0;
      for (const group of data.getScore())
        if (group instanceof TrackLayerGroup) {
          if (!existingIds.has(group.getUniqueId()))
            group.setUniqueId(`corpus-group-${groupOrdinal}`);
          for (const [index, track] of group.entries())
            if (!existingIds.has(track.getUniqueId())) {
              const old = track.getUniqueId(),
                replacement = `corpus-track-${groupOrdinal}-${index}`;
              track.setUniqueId(replacement);
              for (const channel of data.getMixer().getAllSourceChannels())
                if (channel.getAssociation() === old) channel.setAssociation(replacement);
            }
          groupOrdinal++;
        }
      const channels = [
        ...data.getMixer().getAllSourceChannels(),
        ...data.getMixer().getSubChannels(),
        data.getMixer().getMaster(),
      ];
      const parameters = new Set([
        ...ParameterHelper.getAllParameters(data.getArrangement(), data.getMixer(), true),
        ...channels.flatMap((channel) => [
          channel.getLevelParameter(),
          channel.getPanParameter(),
          channel.getPanWidthParameter(),
          channel.getDualPanLeftParameter(),
          channel.getDualPanRightParameter(),
        ]),
      ]);
      let index = 0;
      for (const parameter of parameters) {
        if (!existingIds.has(parameter.getUniqueId()))
          parameter.setUniqueId(`corpus-default-parameter-${index}`);
        index++;
      }
      return data;
    };
    const profile: FixtureProfile = id === 'typescript-project-corpus' ? 'disk' : 'realtime';
    const original = build();
    const options: MixerFixtureOptions = {
      sampleRate: 44100,
      ksmps: id === 'typescript-project-corpus' ? 1 : 64,
      durationSeconds: 2,
      maximumAmplitude: 1,
      renderEndSeconds: original.getScore().getTimeContext().beatsToSeconds(3),
    };
    const identity = createHash('sha256')
      .update(xml!)
      .update(fixtureInputIdentity(original, id!, profile, options))
      .digest('hex');
    return { id: id!, profile, residualClass: 'stateful' as const, identity, options, build };
  });
}

/** Capture complete mixer/control bindings. Only process-local channel/send
 * identity tokens and documented render-copy Parameter UUIDs are mapped to their catalog locations. Persistent parameter
 * ids, names, mappings, associations and every other field remain observable.
 * Unknown identities are retained rather than dropped by a key-name regex.
 */
export function serializeMixerBindings(result: RenderCsdResult, data?: BlueData) {
  const identities = new Map<string, string>();
  for (const gate of result.mixerGateBindings?.gates ?? []) {
    const locator = gate.locator;
    const label = `${locator.channelKind}:${locator.channelOrdinal}`;
    identities.set(locator.channelIdentity, label);
    const prefix = `channel:${locator.channelKind}:`;
    if (locator.channelIdentity.startsWith(prefix))
      identities.set(locator.channelIdentity.slice(prefix.length), label);
    identities.set(
      locator.entryIdentity,
      locator.route === 'send'
        ? `send:${locator.channelOrdinal}:${locator.chainKind}:${locator.chainIndex}`
        : `output:${locator.channelOrdinal}`,
    );
  }
  for (const channel of result.pannerBindings?.channels ?? []) {
    identities.set(channel.channelIdentity, `${channel.channelKind}:${channel.channelOrdinal}`);
  }
  const normalize = (value: unknown, key = ''): unknown => {
    if (typeof value === 'string') {
      if (identities.has(value)) return identities.get(value);
      if (key === 'signature' && value.startsWith('{')) return normalize(JSON.parse(value));
      return value;
    }
    if (Array.isArray(value)) return value.map((entry) => normalize(entry));
    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.entries(value).map(([key, entry]) => [key, normalize(entry, key)]),
      );
    return value;
  };
  const canonicalParameters = data
    ? [
        ...getArrangementOwnerParameters(data.getArrangement()).map((entry) => entry.parameter),
        ...getTrackOwnerParameters(data.getScore()).map((entry) => entry.parameter),
        ...getMixerOwnerParameters(data.getMixer(), data.getMixer().isPanningEnabled()),
      ]
    : [];
  const inits = new Map(
    [...result.csdText.matchAll(/^(\w+)\s+init\s+(.+)$/gm)].map((match) => [
      match[1],
      match[2]!.trim(),
    ]),
  );
  const exports = [...result.csdText.matchAll(/^(\w+)\s+chnexport\s+"([^"]+)"\s*,\s*(\d+)/gm)].map(
    (match) => ({
      variable: match[1],
      channel: match[2],
      access: Number(match[3]),
      initial: inits.get(match[1]) ?? null,
    }),
  );
  return {
    gates: normalize(result.mixerGateBindings ?? null),
    panners: normalize(result.pannerBindings ?? null),
    parameters: (result.parameters ?? []).map((parameter, ordinal) => ({
      ordinal,
      snapshotIdentity: `parameter:${ordinal}`,
      canonicalUniqueId: canonicalParameters[ordinal]?.getUniqueId() ?? null,
      name: parameter.getName(),
      channel: parameter.getCompilationVarName(),
      fixedValue: parameter.getFixedValue(),
      initialValue: parameter.getValue(0),
      minimum: parameter.getMinimum(),
      maximum: parameter.getMaximum(),
      resolution: parameter.getResolutionText(),
    })),
    parameterOwners: data
      ? getProjectParameterCatalog(data).map((entry) => ({
          uniqueId: entry.parameter.getUniqueId(),
          ownerKind: entry.ownerKind,
          ownerIdentity: entry.ownerIdentity,
          path: entry.path,
        }))
      : [],
    channelParameters: data
      ? [
          ...data.getMixer().getAllSourceChannels(),
          ...data.getMixer().getSubChannels(),
          data.getMixer().getMaster(),
        ].map((channel, index) => ({
          index,
          name: channel.getName(),
          association: channel.getAssociation(),
          volume: channel.getLevelParameter().getUniqueId(),
          pan: channel.getPanParameter().getUniqueId(),
          width: channel.getPanWidthParameter().getUniqueId(),
          dualLeft: channel.getDualPanLeftParameter().getUniqueId(),
          dualRight: channel.getDualPanRightParameter().getUniqueId(),
        }))
      : [],
    blueX7Bindings: result.blueX7Bindings.map((binding) => ({
      ...binding,
      parameterChannels: [...binding.parameterChannels],
      directGlobalChannels: [...binding.directGlobalChannels],
    })),
    exports,
    stringChannels: result.stringChannels ?? [],
    meters: result.meterBindingMap
      ? {
          nchnls: result.meterBindingMap.nchnls,
          entries: result.meterBindingMap.entries.map(({ channel, ...entry }) => ({
            ...entry,
            channelIdentity:
              identities.get(channel.getRuntimeIdentity()) ?? channel.getRuntimeIdentity(),
          })),
        }
      : null,
  };
}

/** Conservative sums of the original authored source bounds and route gains;
 * these declarations do not attenuate, normalize or alter the fixed workload. */
function declaredFixtureAmplitude(id: string, sampleRate: number): number {
  if (id === 'primary-send-heavy') return 128 * 0.22 * 5;
  if (id.startsWith('fan-in-')) return 128 * 0.22 * 2 + 0.2;
  if (id === 'small-single') return 0.22;
  if (id === 'small-sixteen') return 16 * 0.22 * 2;
  if (id === 'representative') return 8 * 0.525 * 2;
  if (id === 'barrier-rich' || id === 'panning-matrix') return 4;
  if (id === 'metering') return 0.6;
  if (id === 'disabled-mixer') return 0.2;
  // The original 44.1 kHz PCM is resampled by diskin2 at 48 kHz. Four-point
  // cubic Lagrange weights have sum(abs(weights)) = 1 + t(1-t) <= 1.25.
  // This bounds any input samples, independently of the measured output.
  if (id === 'muted-disk-pruned') return (12000 / 32768) * (sampleRate === 44100 ? 1 : 1.25);
  if (id === 'sound-then-silence') return 0.25;
  if (id === 'send-level-matrix') return 4 * 0.22 * 2;
  if (id === 'live-control-trace') return 0.1;
  if (id === 'routing-no-source') return 0;
  if (id.startsWith('routing-')) return 0.5;
  if (id.startsWith('pan-contract-')) return 1;
  if (['partial-first-final', 'impulse-effect-tail', 'effect-from-silence'].includes(id))
    return 0.125;
  throw new Error(`fixture ${id} needs an explicit amplitude declaration`);
}

export function expectedFixtureRender(fixture: MixerFixture) {
  if (fixture.profile === 'blueLive')
    throw new Error('BlueLive needs a bounded managed-trace duration contract');
  const { sampleRate, ksmps } = fixture.options;
  const end = fixture.options.renderEndSeconds ?? fixture.options.durationSeconds + 1;
  // The generated end event is sampled in the block containing end. This
  // includes one final block when end is exactly on a block boundary.
  return {
    sampleRate,
    channels: fixture.options.channels ?? 2,
    format: 'float64' as const,
    frames: (Math.floor((end * sampleRate) / ksmps) + 1) * ksmps,
    maximumAmplitude: fixture.options.maximumAmplitude!,
  };
}
