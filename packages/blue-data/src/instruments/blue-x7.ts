import { Element } from '../serialization/xml-reader';
import { Instrument } from './instrument';
import { Tables } from '../tables';
import type { CompileData } from '../compile-data';
import { Parameter } from '../automation/parameter';
import { ParameterList } from '../automation/parameter-list';
import { parseJavaDecimal } from '../automation/java-decimal';
import {
  BLUE_X7_PARAMETER_DESCRIPTORS,
  getBlueX7Descriptor,
  quantizeBlueX7DescriptorValue,
  readBlueX7VoiceValue,
  writeBlueX7VoiceValue,
} from './blue-x7/parameter-catalog';
import { buildBlueX7VoiceTransport } from './blue-x7/voice-transport';
import { BLUE_X7_MODERN_ORCHESTRA } from './blue-x7/modern-orchestra.generated';

/**
 * Render-scoped key marking that the shared modern synthesis module has been
 * emitted once into a generated performance (Spec 092).
 */
export const BLUEX7_MODERN_MODULE_KEY = 'blueX7.modernModuleEmitted';

export interface BlueX7PreviewResult {
  tables: string;
  body: string;
  bindings: {
    emitted: string[];
    notEmitted: string[];
  };
}

export interface EnvelopePoint {
  rate: number;
  level: number;
}

export interface BlueX7Common {
  keyTranspose: number;
  algorithm: number;
  feedback: number;
  operatorEnabled: [boolean, boolean, boolean, boolean, boolean, boolean];
}

export interface BlueX7Lfo {
  speed: number;
  delay: number;
  pitchModulationDepth: number;
  amplitudeModulationDepth: number;
  wave: number;
  sync: number;
}

export interface BlueX7Operator {
  mode: number;
  sync: number;
  freqCoarse: number;
  freqFine: number;
  detune: number;
  breakpoint: number;
  curveLeft: number;
  curveRight: number;
  depthLeft: number;
  depthRight: number;
  keyboardRateScaling: number;
  outputLevel: number;
  velocitySensitivity: number;
  modulationAmplitude: number;
  modulationPitch: number;
  envelope: [EnvelopePoint, EnvelopePoint, EnvelopePoint, EnvelopePoint];
}

export interface BlueX7Voice {
  common: BlueX7Common;
  lfo: BlueX7Lfo;
  operators: [
    BlueX7Operator,
    BlueX7Operator,
    BlueX7Operator,
    BlueX7Operator,
    BlueX7Operator,
    BlueX7Operator,
  ];
  pitchEnvelope: [
    EnvelopePoint,
    EnvelopePoint,
    EnvelopePoint,
    EnvelopePoint,
  ];
  csoundPostCode: string;
}

export function createDefaultBlueX7Voice(): BlueX7Voice {
  return {
    common: {
      algorithm: 19,
      keyTranspose: 24,
      feedback: 6,
      operatorEnabled: [true, true, true, true, true, true],
    },
    lfo: {
      speed: 35,
      delay: 0,
      pitchModulationDepth: 0,
      amplitudeModulationDepth: 0,
      wave: 0,
      sync: 0,
    },
    operators: [
      {
        mode: 0,
        sync: 1,
        freqCoarse: 0,
        freqFine: 1,
        detune: -3,
        breakpoint: 0,
        curveLeft: 0,
        curveRight: 3,
        depthLeft: 85,
        depthRight: 0,
        keyboardRateScaling: 4,
        outputLevel: 99,
        velocitySensitivity: 2,
        modulationAmplitude: 0,
        modulationPitch: 0,
        envelope: [
          { rate: 81, level: 99 },
          { rate: 25, level: 82 },
          { rate: 20, level: 0 },
          { rate: 48, level: 0 },
        ],
      },
      {
        mode: 0,
        sync: 1,
        freqCoarse: 1,
        freqFine: 0,
        detune: 1,
        breakpoint: 0,
        curveLeft: 0,
        curveRight: 0,
        depthLeft: 0,
        depthRight: 13,
        keyboardRateScaling: 5,
        outputLevel: 87,
        velocitySensitivity: 0,
        modulationAmplitude: 0,
        modulationPitch: 0,
        envelope: [
          { rate: 99, level: 99 },
          { rate: 0, level: 75 },
          { rate: 25, level: 0 },
          { rate: 0, level: 0 },
        ],
      },
      {
        mode: 0,
        sync: 1,
        freqCoarse: 3,
        freqFine: 0,
        detune: -1,
        breakpoint: 47,
        curveLeft: 0,
        curveRight: 3,
        depthLeft: 28,
        depthRight: 74,
        keyboardRateScaling: 5,
        outputLevel: 57,
        velocitySensitivity: 0,
        modulationAmplitude: 0,
        modulationPitch: 0,
        envelope: [
          { rate: 81, level: 99 },
          { rate: 25, level: 99 },
          { rate: 25, level: 99 },
          { rate: 14, level: 0 },
        ],
      },
      {
        mode: 0,
        sync: 1,
        freqCoarse: 1,
        freqFine: 0,
        detune: 1,
        breakpoint: 0,
        curveLeft: 0,
        curveRight: 0,
        depthLeft: 0,
        depthRight: 0,
        keyboardRateScaling: 5,
        outputLevel: 99,
        velocitySensitivity: 2,
        modulationAmplitude: 0,
        modulationPitch: 0,
        envelope: [
          { rate: 81, level: 99 },
          { rate: 23, level: 78 },
          { rate: 22, level: 0 },
          { rate: 45, level: 0 },
        ],
      },
      {
        mode: 0,
        sync: 1,
        freqCoarse: 1,
        freqFine: 58,
        detune: -1,
        breakpoint: 48,
        curveLeft: 0,
        curveRight: 0,
        depthLeft: 0,
        depthRight: 65,
        keyboardRateScaling: 5,
        outputLevel: 93,
        velocitySensitivity: 0,
        modulationAmplitude: 0,
        modulationPitch: 0,
        envelope: [
          { rate: 81, level: 99 },
          { rate: 58, level: 14 },
          { rate: 36, level: 0 },
          { rate: 39, level: 0 },
        ],
      },
      {
        mode: 0,
        sync: 1,
        freqCoarse: 1,
        freqFine: 0,
        detune: -1,
        breakpoint: 0,
        curveLeft: 0,
        curveRight: 0,
        depthLeft: 0,
        depthRight: 10,
        keyboardRateScaling: 5,
        outputLevel: 82,
        velocitySensitivity: 0,
        modulationAmplitude: 0,
        modulationPitch: 0,
        envelope: [
          { rate: 99, level: 99 },
          { rate: 67, level: 50 },
          { rate: 95, level: 50 },
          { rate: 60, level: 50 },
        ],
      },
    ],
    pitchEnvelope: [
      { rate: 50, level: 50 },
      { rate: 50, level: 50 },
      { rate: 50, level: 50 },
      { rate: 50, level: 50 },
    ],
    csoundPostCode: 'blueMixerOut aout, aout',
  };
}

export function cloneBlueX7Voice(voice: BlueX7Voice): BlueX7Voice {
  return {
    common: {
      algorithm: voice.common.algorithm,
      keyTranspose: voice.common.keyTranspose,
      feedback: voice.common.feedback,
      operatorEnabled: [...voice.common.operatorEnabled],
    },
    lfo: {
      speed: voice.lfo.speed,
      delay: voice.lfo.delay,
      pitchModulationDepth: voice.lfo.pitchModulationDepth,
      amplitudeModulationDepth: voice.lfo.amplitudeModulationDepth,
      wave: voice.lfo.wave,
      sync: voice.lfo.sync,
    },
    operators: voice.operators.map((op) => ({
      mode: op.mode,
      sync: op.sync,
      freqCoarse: op.freqCoarse,
      freqFine: op.freqFine,
      detune: op.detune,
      breakpoint: op.breakpoint,
      curveLeft: op.curveLeft,
      curveRight: op.curveRight,
      depthLeft: op.depthLeft,
      depthRight: op.depthRight,
      keyboardRateScaling: op.keyboardRateScaling,
      outputLevel: op.outputLevel,
      velocitySensitivity: op.velocitySensitivity,
      modulationAmplitude: op.modulationAmplitude,
      modulationPitch: op.modulationPitch,
      envelope: op.envelope.map((pt) => ({ rate: pt.rate, level: pt.level })) as [
        EnvelopePoint,
        EnvelopePoint,
        EnvelopePoint,
        EnvelopePoint,
      ],
    })) as [
      BlueX7Operator,
      BlueX7Operator,
      BlueX7Operator,
      BlueX7Operator,
      BlueX7Operator,
      BlueX7Operator,
    ],
    pitchEnvelope: voice.pitchEnvelope.map((pt) => ({
      rate: pt.rate,
      level: pt.level,
    })) as [EnvelopePoint, EnvelopePoint, EnvelopePoint, EnvelopePoint],
    csoundPostCode: voice.csoundPostCode,
  };
}

// ---------------------------------------------------------------------------
// Parameter catalog reconciliation (Spec 092)
// ---------------------------------------------------------------------------

const BLUE_X7_INTEGER_RESOLUTION_PARSED = parseJavaDecimal('1');
if (!BLUE_X7_INTEGER_RESOLUTION_PARSED.ok) {
  throw new Error('BlueX7: failed to parse integer resolution');
}
const BLUE_X7_INTEGER_RESOLUTION = BLUE_X7_INTEGER_RESOLUTION_PARSED.value;

/** Model field names -> semantic catalog keys for the shared projections. */
const OPERATOR_FIELD_TO_KEY_SUFFIX: Record<string, string> = {
  mode: 'oscillatorMode',
  sync: '__shared_sync',
  freqCoarse: 'frequencyCoarse',
  freqFine: 'frequencyFine',
  detune: 'detune',
  breakpoint: 'breakpoint',
  curveLeft: 'curveLeft',
  curveRight: 'curveRight',
  depthLeft: 'depthLeft',
  depthRight: 'depthRight',
  keyboardRateScaling: 'keyboardRateScaling',
  outputLevel: 'outputLevel',
  velocitySensitivity: 'velocitySensitivity',
  modulationAmplitude: 'amplitudeModulationSensitivity',
  modulationPitch: '__shared_pms',
};

const COMMON_FIELD_TO_KEY: Record<string, string> = {
  algorithm: 'common.algorithm',
  feedback: 'common.feedback',
  keyTranspose: 'common.transpose',
};

const LFO_FIELD_TO_KEY: Record<string, string> = {
  speed: 'lfo.speed',
  delay: 'lfo.delay',
  pitchModulationDepth: 'lfo.pitchModulationDepth',
  amplitudeModulationDepth: 'lfo.amplitudeModulationDepth',
  wave: 'lfo.wave',
  sync: 'lfo.sync',
};

function quantizedVoiceValue(voice: BlueX7Voice, key: string): number {
  const descriptor = getBlueX7Descriptor(key);
  const raw = readBlueX7VoiceValue(voice, key);
  if (!descriptor || raw === undefined) {
    return 0;
  }
  return quantizeBlueX7DescriptorValue(descriptor, raw) ?? 0;
}

/**
 * Create the canonical 151-Parameter projection of one voice (fresh IDs).
 */
export function createBlueX7Parameters(voice: BlueX7Voice): ParameterList {
  return reconcileBlueX7Parameters(voice);
}

/**
 * Reconcile the persisted Parameter list against the immutable catalog for
 * one voice. Persisted Parameters are matched by semantic name in catalog
 * order; the first occurrence wins and later duplicates are dropped. Reused
 * Parameters keep their uniqueId, automation state, curve, points, and line
 * color while catalog-owned metadata and the canonical fixed value are
 * refreshed from the voice. Legacy lists without parameters get all 151
 * entries with fresh identities. The voice always wins: a malformed
 * persisted Parameter is repaired, never the canonical voice.
 */
export function reconcileBlueX7Parameters(
  voice: BlueX7Voice,
  persisted?: ParameterList,
): ParameterList {
  const byName = new Map<string, Parameter[]>();
  if (persisted) {
    for (const parameter of persisted) {
      const name = parameter.getName();
      if (!name) {
        continue; // malformed metadata cannot own a catalog identity
      }
      const list = byName.get(name);
      if (list) {
        list.push(parameter);
      } else {
        byName.set(name, [parameter]);
      }
    }
  }

  const result = new ParameterList();
  for (const descriptor of BLUE_X7_PARAMETER_DESCRIPTORS) {
    const candidates = byName.get(descriptor.key);
    const reused = candidates?.shift();
    if (candidates && candidates.length === 0) {
      byName.delete(descriptor.key);
    }
    const parameter = reused ?? new Parameter();
    parameter.setName(descriptor.key);
    parameter.setLabel(descriptor.label);
    // Catalog bounds never change across versions; truncate snaps any
    // malformed persisted points back into the domain without rescaling.
    parameter.setMinimum(descriptor.minimum, true);
    parameter.setMaximum(descriptor.maximum, true);
    parameter.setResolutionDecimal(BLUE_X7_INTEGER_RESOLUTION);
    parameter.setFixedValue(quantizedVoiceValue(voice, descriptor.key));
    result.push(parameter);
  }
  return result;
}

/**
 * One widget edit: write the voice field and the matching Parameter fixed
 * value together. Unknown keys and non-finite values fail without any
 * mutation. Returns whether the edit was applied.
 */
export function applyBlueX7FixedValue(
  voice: BlueX7Voice,
  parameters: ParameterList,
  key: string,
  value: number,
): boolean {
  if (!writeBlueX7VoiceValue(voice, key, value)) {
    return false;
  }
  const quantized = readBlueX7VoiceValue(voice, key);
  if (quantized === undefined) {
    return false;
  }
  for (const parameter of parameters) {
    if (parameter.getName() === key) {
      parameter.setFixedValue(quantized);
      return true;
    }
  }
  return false;
}

/**
 * Whole-voice replacement: adopt the complete replacement voice and refresh
 * every Parameter fixed value while retaining Parameter identities, curves,
 * points, enabled states, resolutions, and line colors.
 */
export function replaceBlueX7VoiceFixedValues(
  voice: BlueX7Voice,
  parameters: ParameterList,
  replacement: BlueX7Voice,
): void {
  const next = cloneBlueX7Voice(replacement);
  voice.common = next.common;
  voice.lfo = next.lfo;
  voice.operators = next.operators;
  voice.pitchEnvelope = next.pitchEnvelope;
  voice.csoundPostCode = next.csoundPostCode;
  for (const parameter of parameters) {
    const value = readBlueX7VoiceValue(voice, parameter.getName());
    if (value !== undefined) {
      parameter.setFixedValue(value);
    }
  }
}

export function getBlueX7BindingReport(): { emitted: string[]; notEmitted: string[] } {
  const emitted = BLUE_X7_PARAMETER_DESCRIPTORS.map((descriptor) => {
    const updateClass =
      descriptor.updateClass === 'next-note' ? 'next-note' : 'active-note';
    const target =
      descriptor.transport.kind === 'voice'
        ? `transport slot ${descriptor.transport.slot}`
        : `operator mask bit ${descriptor.transport.operator - 1}`;
    return `${descriptor.key} (${descriptor.label}) -> ${target} [${updateClass}]`;
  });
  emitted.push('csoundPostCode (appended verbatim after the module aout)');
  return {
    emitted,
    notEmitted: [
      'voice-name bytes 145..154 (deterministic, nonsynthesized; not Parameters)',
    ],
  };
}

export function generateBlueX7Preview(
  voice: BlueX7Voice,
  name = 'BlueX7',
): BlueX7PreviewResult {
  const dummyTables = new Tables();
  const instr = new BlueX7();
  instr.setName(name);
  instr.setVoice(voice);
  instr.generateFTables(dummyTables);
  const body = instr.generateInstrument();
  const tables = dummyTables.getTables();

  return {
    tables,
    body,
    bindings: getBlueX7BindingReport(),
  };
}

function updateOrAddChildText(parent: Element, tag: string, text: string): Element {
  let child = parent.getElement(tag);
  if (!child) {
    child = parent.addElement(tag);
  }
  child.setText(text);
  return child;
}

export class BlueX7 extends Instrument {
  private _voice: BlueX7Voice;
  private _parameters: ParameterList;
  private _sourceXmlTemplate?: Element;
  public operatorTableNums: number[] | null = null;

  constructor(other?: BlueX7) {
    super();
    this.setName('BlueX7');
    if (other) {
      this._name = other._name;
      this._enabled = other._enabled;
      this._comment = other._comment;
      this._voice = cloneBlueX7Voice(other._voice);
      // A new ownership boundary regenerates all Parameter identities.
      this._parameters = reconcileBlueX7Parameters(
        this._voice,
        other._parameters.deepCopy(),
      );
      if (other._sourceXmlTemplate) {
        this._sourceXmlTemplate = Element.parse(other._sourceXmlTemplate.toXml());
      }
    } else {
      this._voice = createDefaultBlueX7Voice();
      this._parameters = createBlueX7Parameters(this._voice);
    }
  }

  getVoice(): BlueX7Voice {
    return this._voice;
  }

  getParameters(): Parameter[] {
    return [...this._parameters];
  }

  /**
   * One widget edit: update the voice field and the matching fixed Parameter
   * value together. Returns whether the edit was applied.
   */
  applyFixedValue(key: string, value: number): boolean {
    return applyBlueX7FixedValue(this._voice, this._parameters, key, value);
  }

  /** Refresh catalog Parameter fixed values from the current voice. */
  private syncFixedValues(keys: string[]): void {
    for (const key of keys) {
      const value = quantizedVoiceValue(this._voice, key);
      for (const parameter of this._parameters) {
        if (parameter.getName() === key) {
          parameter.setFixedValue(value);
        }
      }
    }
  }

  setVoice(voice: BlueX7Voice): void {
    replaceBlueX7VoiceFixedValues(this._voice, this._parameters, voice);
  }

  replaceVoice(voice: BlueX7Voice): void {
    replaceBlueX7VoiceFixedValues(this._voice, this._parameters, voice);
  }

  setCommonField<K extends keyof BlueX7Common>(field: K, value: BlueX7Common[K]): void {
    this._voice.common[field] = value;
    const key = COMMON_FIELD_TO_KEY[field as string];
    if (key) {
      this.syncFixedValues([key]);
    }
  }

  setOperatorEnabled(index: number, enabled: boolean): void {
    if (index >= 0 && index < 6) {
      this._voice.common.operatorEnabled[index] = enabled;
      this.syncFixedValues([`operator.${index + 1}.enabled`]);
    }
  }

  setLfoField<K extends keyof BlueX7Lfo>(field: K, value: BlueX7Lfo[K]): void {
    this._voice.lfo[field] = value;
    const key = LFO_FIELD_TO_KEY[field as string];
    if (key) {
      this.syncFixedValues([key]);
    }
  }

  setOperatorField<K extends keyof BlueX7Operator>(
    operatorIndex: number,
    field: K,
    value: BlueX7Operator[K],
  ): void {
    if (operatorIndex >= 0 && operatorIndex < 6) {
      this._voice.operators[operatorIndex][field] = value;
      const suffix = OPERATOR_FIELD_TO_KEY_SUFFIX[field as string];
      if (suffix === '__shared_sync') {
        this.syncFixedValues(['common.oscillatorKeySync']);
      } else if (suffix === '__shared_pms') {
        this.syncFixedValues(['lfo.pitchModulationSensitivity']);
      } else if (suffix) {
        this.syncFixedValues([`operator.${operatorIndex + 1}.${suffix}`]);
      }
    }
  }

  setSharedOscillatorSync(value: number): void {
    for (let i = 0; i < 6; i++) {
      this._voice.operators[i].sync = value;
    }
    this.syncFixedValues(['common.oscillatorKeySync']);
  }

  setSharedPitchModulationSensitivity(value: number): void {
    for (let i = 0; i < 6; i++) {
      this._voice.operators[i].modulationPitch = value;
    }
    this.syncFixedValues(['lfo.pitchModulationSensitivity']);
  }

  setOperatorEnvelopePoint(
    operatorIndex: number,
    stageIndex: number,
    point: EnvelopePoint,
  ): void {
    if (operatorIndex >= 0 && operatorIndex < 6 && stageIndex >= 0 && stageIndex < 4) {
      this._voice.operators[operatorIndex].envelope[stageIndex] = { ...point };
      this.syncFixedValues([
        `operator.${operatorIndex + 1}.envelope.${stageIndex + 1}.rate`,
        `operator.${operatorIndex + 1}.envelope.${stageIndex + 1}.level`,
      ]);
    }
  }

  setPitchEnvelopePoint(stageIndex: number, point: EnvelopePoint): void {
    if (stageIndex >= 0 && stageIndex < 4) {
      this._voice.pitchEnvelope[stageIndex] = { ...point };
      this.syncFixedValues([
        `pitchEnvelope.${stageIndex + 1}.rate`,
        `pitchEnvelope.${stageIndex + 1}.level`,
      ]);
    }
  }

  getCsoundPostCode(): string {
    return this._voice.csoundPostCode;
  }

  setCsoundPostCode(code: string): void {
    this._voice.csoundPostCode = code;
  }

  hasFTable(): boolean {
    return true;
  }

  /**
   * Allocate this instance's independent transport tables: the main table
   * read by the synthesis module and its staging pair (used for atomic
   * whole-voice publication). Numbers come from the shared render Tables, so
   * every arrangement/Track owner is collision-free.
   */
  override generateFTables(tables: Tables): void {
    const transport = buildBlueX7VoiceTransport(
      this._voice,
      this._voice.common.operatorEnabled,
    );
    this._operatorMask = transport.operatorMask;
    const mainTable = tables.getOpenFTableNumber();
    const stagingTable = tables.getOpenFTableNumber();
    this._transportTableIds = [mainTable, stagingTable];

    const buffer: string[] = [];
    buffer.push(`; FTABLES FOR BLUEX7 MODERN TRANSPORT: ${this.getName()}`);
    for (const tableNum of [mainTable, stagingTable]) {
      buffer.push(`f ${tableNum} 0 256 -2 ${transport.voice.join(' ')}`);
    }
    buffer.push('');

    const currentTables = tables.getTables();
    const joined = buffer.join('\n');
    tables.setTables(currentTables ? `${currentTables}\n${joined}` : joined);
  }

  private _transportTableIds: readonly [number, number] | null = null;
  private _operatorMask = 63;

  /** Render-scoped transport table pair; null until generateFTables runs. */
  getBlueX7TransportTableIds(): readonly [number, number] | null {
    return this._transportTableIds;
  }

  /**
   * Emit the shared modern synthesis module once per render. Distinct BlueX7
   * objects share the immutable module text through the CompileData registry;
   * a fresh render emits it again.
   */
  override generateGlobalOrc(compileData?: CompileData): string | null {
    if (!compileData) {
      return null;
    }
    if (compileData.getCompilationVariable(BLUEX7_MODERN_MODULE_KEY)) {
      return null;
    }
    compileData.setCompilationVariable(BLUEX7_MODERN_MODULE_KEY, true);
    return BLUE_X7_MODERN_ORCHESTRA;
  }

  /**
   * Hold channel for staged whole-voice publication. Derived from this
   * instance's main transport table number, which is unique per render, so
   * the name is collision-free and within the engine channel-name limit.
   */
  getBlueX7HoldChannel(): string {
    return `bx7h${this._transportTableIds?.[0] ?? 100}`;
  }

  /** Commit-generation channel paired with the hold channel. */
  getBlueX7CommitChannel(): string {
    return `bx7c${this._transportTableIds?.[0] ?? 100}`;
  }

  /**
   * Emit the Blue host wrapper. With the instrument's 151 Parameters
   * (catalog order, compilation variable names assigned), the wrapper is
   * live-capable: per control cycle it publishes the parameter channels
   * into kLiveVoice and the transport table while the hold channel is 0,
   * freezes observation while held, and fully republishes plus advances its
   * commit generation at the control boundary where a hold releases. The
   * static fallback (preview, no parameters) freezes the hold at 1.
   */
  override generateInstrument(parameters?: Parameter[]): string {
    // The CSD build always allocates transport tables via generateFTables;
    // a bare generateInstrument (no prior allocation) falls back to a
    // conventional table number so the wrapper text stays renderable.
    const tableNum = this._transportTableIds?.[0] ?? 100;
    const header = [
      `; BlueX7 modern renderer host wrapper: ${this.getName()}`,
      `; Blue pitch convention: p4 < 15 is a pch value, otherwise Hz.`,
      'iBlueX7MidiNote = (p4 < 15 ? ftom:i(cpspch:i(p4)) : ftom:i(p4))',
      `iBlueX7OperatorMask = ${this._operatorMask}`,
      'iBlueX7GateSeconds = abs(p3)',
    ];

    const liveParameters =
      Array.isArray(parameters) &&
      parameters.length === BLUE_X7_PARAMETER_DESCRIPTORS.length &&
      parameters.every(
        (parameter) =>
          typeof parameter.getCompilationVarName === 'function' &&
          parameter.getCompilationVarName(),
      );

    if (!liveParameters) {
      return [
        ...header,
        'kBlueX7StaticVoice[] init 155',
        `kBlueX7StaticMask init ${this._operatorMask}`,
        'kBlueX7StaticHold init 1',
        `aout = bluex7_voice(iBlueX7MidiNote, p5, ${tableNum}, iBlueX7OperatorMask, iBlueX7GateSeconds, kBlueX7StaticVoice, kBlueX7StaticMask, kBlueX7StaticHold)`,
        this._voice.csoundPostCode ?? '',
        '',
      ].join('\n');
    }

    const voiceSlotLines = BLUE_X7_PARAMETER_DESCRIPTORS.map((descriptor, index) => {
      if (descriptor.transport.kind !== 'voice') {
        return null;
      }
      return `kLiveVoice[${descriptor.transport.slot}] = ${parameters![index].getCompilationVarName()!}`;
    }).filter((line): line is string => line !== null);

    const enableMaskExpression = BLUE_X7_PARAMETER_DESCRIPTORS.map((descriptor, index) => {
      if (descriptor.transport.kind !== 'operator-enable') {
        return null;
      }
      return { bit: descriptor.transport.operator - 1, varName: parameters![index].getCompilationVarName()! };
    })
      .filter((entry): entry is { bit: number; varName: string } => entry !== null)
      .sort((a, b) => a.bit - b.bit)
      .map((entry) => (entry.bit === 0 ? entry.varName : `${2 ** entry.bit} * ${entry.varName}`))
      .join(' + ');

    return [
      ...header,
      `; live transport: hold channel ${this.getBlueX7HoldChannel()}, commit ${this.getBlueX7CommitChannel()}`,
      `kBlueX7Hold chnget "${this.getBlueX7HoldChannel()}"`,
      'kLiveVoice[] init 155',
      `kLiveMask init ${this._operatorMask}`,
      'kBlueX7HoldPrev init 0',
      'kBlueX7Gen init 0',
      'if (kBlueX7Hold == 0) then',
      ...voiceSlotLines,
      `kLiveMask = ${enableMaskExpression}`,
      'kBlueX7Idx = 0',
      `while kBlueX7Idx < 145 do`,
      `  tabw kLiveVoice[kBlueX7Idx], kBlueX7Idx, ${tableNum}`,
      '  kBlueX7Idx += 1',
      'od',
      'endif',
      'if (kBlueX7HoldPrev == 1 && kBlueX7Hold == 0) then',
      '  ; one complete republication at a single control boundary',
      '  kBlueX7Full = 0',
      `  while kBlueX7Full < 155 do`,
      `    tabw kLiveVoice[kBlueX7Full], kBlueX7Full, ${tableNum}`,
      '    kBlueX7Full += 1',
      '  od',
      '  kBlueX7Gen = kBlueX7Gen + 1',
      `  chnset kBlueX7Gen, "${this.getBlueX7CommitChannel()}"`,
      'endif',
      'kBlueX7HoldPrev = kBlueX7Hold',
      `aout = bluex7_voice(iBlueX7MidiNote, p5, ${tableNum}, iBlueX7OperatorMask, iBlueX7GateSeconds, kLiveVoice, kLiveMask, kBlueX7Hold)`,
      this._voice.csoundPostCode ?? '',
      '',
    ].join('\n');
  }

  saveAsXML(): Element {
    let elem: Element;
    if (this._sourceXmlTemplate) {
      elem = Element.parse(this._sourceXmlTemplate.toXml());
    } else {
      elem = new Element('instrument');
    }

    elem.setAttribute('type', 'blue.orchestra.BlueX7');
    elem.setAttribute('enabled', this._enabled.toString());

    updateOrAddChildText(elem, 'name', this._name);
    updateOrAddChildText(elem, 'comment', this._comment);

    // algorithmCommonData
    let commonElem = elem.getElement('algorithmCommonData');
    if (!commonElem) {
      commonElem = elem.addElement('algorithmCommonData');
    }
    updateOrAddChildText(commonElem, 'keyTranspose', this._voice.common.keyTranspose.toString());
    updateOrAddChildText(commonElem, 'algorithm', this._voice.common.algorithm.toString());
    updateOrAddChildText(commonElem, 'feedback', this._voice.common.feedback.toString());

    const existingOpBools = commonElem.getElements('operator').toArray();
    for (let i = 0; i < 6; i++) {
      const val = this._voice.common.operatorEnabled[i].toString();
      if (i < existingOpBools.length) {
        existingOpBools[i].setText(val);
      } else {
        commonElem.addElement('operator').setText(val);
      }
    }

    // lfoData
    let lfoElem = elem.getElement('lfoData');
    if (!lfoElem) {
      lfoElem = elem.addElement('lfoData');
    }
    updateOrAddChildText(lfoElem, 'speed', this._voice.lfo.speed.toString());
    updateOrAddChildText(lfoElem, 'delay', this._voice.lfo.delay.toString());
    updateOrAddChildText(lfoElem, 'PMD', this._voice.lfo.pitchModulationDepth.toString());
    updateOrAddChildText(lfoElem, 'AMD', this._voice.lfo.amplitudeModulationDepth.toString());
    updateOrAddChildText(lfoElem, 'wave', this._voice.lfo.wave.toString());
    updateOrAddChildText(lfoElem, 'sync', this._voice.lfo.sync.toString());

    // operator elements
    const existingOps = elem.getElements('operator').toArray();
    for (let i = 0; i < 6; i++) {
      const op = this._voice.operators[i];
      let opElem: Element;
      if (i < existingOps.length) {
        opElem = existingOps[i];
      } else {
        opElem = elem.addElement('operator');
      }

      updateOrAddChildText(opElem, 'mode', op.mode.toString());
      updateOrAddChildText(opElem, 'sync', op.sync.toString());
      updateOrAddChildText(opElem, 'freqCoarse', op.freqCoarse.toString());
      updateOrAddChildText(opElem, 'freqFine', op.freqFine.toString());
      updateOrAddChildText(opElem, 'detune', op.detune.toString());
      updateOrAddChildText(opElem, 'breakpoint', op.breakpoint.toString());
      updateOrAddChildText(opElem, 'curveLeft', op.curveLeft.toString());
      updateOrAddChildText(opElem, 'curveRight', op.curveRight.toString());
      updateOrAddChildText(opElem, 'depthLeft', op.depthLeft.toString());
      updateOrAddChildText(opElem, 'depthRight', op.depthRight.toString());
      updateOrAddChildText(opElem, 'keyboardRateScaling', op.keyboardRateScaling.toString());
      updateOrAddChildText(opElem, 'outputLevel', op.outputLevel.toString());
      updateOrAddChildText(opElem, 'velocitySensitivity', op.velocitySensitivity.toString());
      updateOrAddChildText(opElem, 'modulationAmplitude', op.modulationAmplitude.toString());
      updateOrAddChildText(opElem, 'modulationPitch', op.modulationPitch.toString());

      const existingPts = opElem.getElements('envelopePoint').toArray();
      for (let p = 0; p < 4; p++) {
        let ptElem: Element;
        if (p < existingPts.length) {
          ptElem = existingPts[p];
        } else {
          ptElem = opElem.addElement('envelopePoint');
        }
        ptElem.setAttribute('x', op.envelope[p].rate.toString());
        ptElem.setAttribute('y', op.envelope[p].level.toString());
      }
    }

    // root envelopePoint elements (PEG)
    const existingPegs = elem.getElements('envelopePoint').toArray();
    for (let p = 0; p < 4; p++) {
      let pegElem: Element;
      if (p < existingPegs.length) {
        pegElem = existingPegs[p];
      } else {
        pegElem = elem.addElement('envelopePoint');
      }
      pegElem.setAttribute('x', this._voice.pitchEnvelope[p].rate.toString());
      pegElem.setAttribute('y', this._voice.pitchEnvelope[p].level.toString());
    }

    // csoundPostCode
    updateOrAddChildText(elem, 'csoundPostCode', this._voice.csoundPostCode);

    // Additive TypeScript extension: the owning parameterList. Java Blue does
    // not model BlueX7 Parameters and may discard this child on save; the
    // compatible voice data remains readable (documented limitation).
    elem.removeElements('parameterList');
    elem.addElement(this._parameters.saveAsXML());

    return elem;
  }

  static loadFromXML(data: Element): BlueX7 {
    const instr = new BlueX7();
    instr.setEnabled(data.getAttribute('enabled') !== 'false');
    const name = data.getTextString('name');
    if (name != null) {
      instr.setName(name);
    }
    const comment = data.getTextString('comment');
    if (comment != null) {
      instr.setComment(comment);
    }
    instr._sourceXmlTemplate = Element.parse(data.toXml());

    const voice = instr._voice;

    const commonElem = data.getElement('algorithmCommonData');
    if (commonElem) {
      const kt = commonElem.getTextString('keyTranspose');
      if (kt != null) voice.common.keyTranspose = parseInt(kt, 10);
      const alg = commonElem.getTextString('algorithm');
      if (alg != null) voice.common.algorithm = parseInt(alg, 10);
      const fb = commonElem.getTextString('feedback');
      if (fb != null) voice.common.feedback = parseInt(fb, 10);
      const opElems = commonElem.getElements('operator').toArray();
      for (let i = 0; i < 6; i++) {
        if (i < opElems.length) {
          voice.common.operatorEnabled[i] = opElems[i].getTextString() !== 'false';
        }
      }
    }

    const lfoElem = data.getElement('lfoData');
    if (lfoElem) {
      const speed = lfoElem.getTextString('speed');
      if (speed != null) voice.lfo.speed = parseInt(speed, 10);
      const delay = lfoElem.getTextString('delay');
      if (delay != null) voice.lfo.delay = parseInt(delay, 10);
      const pmd = lfoElem.getTextString('PMD');
      if (pmd != null) voice.lfo.pitchModulationDepth = parseInt(pmd, 10);
      const amd = lfoElem.getTextString('AMD');
      if (amd != null) voice.lfo.amplitudeModulationDepth = parseInt(amd, 10);
      const wave = lfoElem.getTextString('wave');
      if (wave != null) voice.lfo.wave = parseInt(wave, 10);
      const sync = lfoElem.getTextString('sync');
      if (sync != null) voice.lfo.sync = parseInt(sync, 10);
    }

    const opElems = data.getElements('operator').toArray();
    for (let i = 0; i < 6 && i < opElems.length; i++) {
      const opElem = opElems[i];
      const op = voice.operators[i];
      const mode = opElem.getTextString('mode');
      if (mode != null) op.mode = parseInt(mode, 10);
      const sync = opElem.getTextString('sync');
      if (sync != null) op.sync = parseInt(sync, 10);
      const freqCoarse = opElem.getTextString('freqCoarse');
      if (freqCoarse != null) op.freqCoarse = parseInt(freqCoarse, 10);
      const freqFine = opElem.getTextString('freqFine');
      if (freqFine != null) op.freqFine = parseInt(freqFine, 10);
      const detune = opElem.getTextString('detune');
      if (detune != null) op.detune = parseInt(detune, 10);
      const breakpoint = opElem.getTextString('breakpoint');
      if (breakpoint != null) op.breakpoint = parseInt(breakpoint, 10);
      const curveLeft = opElem.getTextString('curveLeft');
      if (curveLeft != null) op.curveLeft = parseInt(curveLeft, 10);
      const curveRight = opElem.getTextString('curveRight');
      if (curveRight != null) op.curveRight = parseInt(curveRight, 10);
      const depthLeft = opElem.getTextString('depthLeft');
      if (depthLeft != null) op.depthLeft = parseInt(depthLeft, 10);
      const depthRight = opElem.getTextString('depthRight');
      if (depthRight != null) op.depthRight = parseInt(depthRight, 10);
      const krs = opElem.getTextString('keyboardRateScaling');
      if (krs != null) op.keyboardRateScaling = parseInt(krs, 10);
      const outputLevel = opElem.getTextString('outputLevel');
      if (outputLevel != null) op.outputLevel = parseInt(outputLevel, 10);
      const velSens = opElem.getTextString('velocitySensitivity');
      if (velSens != null) op.velocitySensitivity = parseInt(velSens, 10);
      const modAmp = opElem.getTextString('modulationAmplitude');
      if (modAmp != null) op.modulationAmplitude = parseInt(modAmp, 10);
      const modPitch = opElem.getTextString('modulationPitch');
      if (modPitch != null) op.modulationPitch = parseInt(modPitch, 10);

      const envPointElems = opElem.getElements('envelopePoint').toArray();
      for (let p = 0; p < 4 && p < envPointElems.length; p++) {
        const ptElem = envPointElems[p];
        const x = ptElem.getAttribute('x');
        const y = ptElem.getAttribute('y');
        if (x != null && y != null) {
          op.envelope[p] = { rate: parseInt(x, 10), level: parseInt(y, 10) };
        }
      }
    }

    const pegElems = data.getElements('envelopePoint').toArray();
    for (let p = 0; p < 4 && p < pegElems.length; p++) {
      const ptElem = pegElems[p];
      const x = ptElem.getAttribute('x');
      const y = ptElem.getAttribute('y');
      if (x != null && y != null) {
        voice.pitchEnvelope[p] = { rate: parseInt(x, 10), level: parseInt(y, 10) };
      }
    }

    const postCode = data.getTextString('csoundPostCode');
    if (postCode != null) {
      voice.csoundPostCode = postCode;
    }

    // Reconcile the owning Parameter list: legacy XML without parameterList
    // receives the complete 151-Parameter projection; a persisted list keeps
    // its identities and automation content.
    const persistedElement = data.getElement('parameterList');
    instr._parameters = persistedElement
      ? reconcileBlueX7Parameters(voice, ParameterList.loadFromXML(persistedElement))
      : createBlueX7Parameters(voice);

    return instr;
  }

  deepCopy(): BlueX7 {
    return new BlueX7(this);
  }
}
