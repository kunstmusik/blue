import { Element } from '../serialization/xml-reader';
import { Instrument } from './instrument';
import { Tables } from '../tables';
import { ALGORITHM_ORCHESTRAS } from './blue-x7/algorithm-orchestra';

export const BLUEX7_HAS_BEEN_COMPILED = 'blueX7.hasStaticTablesBeenCompiled';
export const BLUEX7_STATIC_TABLES = 'blueX7.staticTables';

export interface BlueX7StaticTables {
  sineTable: number;
  outputAmpTable: number;
  rateScaleTable: number;
  egRateRiseLvlTable: number;
  egRateRisePercentageTable: number;
  egRateDecayLvlTable: number;
  egRateDecayPercentageTable: number;
  egLevelPeakTable: number;
  velAmpTable: number;
  velSensitivityTable: number;
  feedbackScaleTable: number;
}

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

export function generateFTableForOperator(op: BlueX7Operator, tableNum: number): string {
  const parts = [
    `f ${tableNum} 0 32 -2`,
    op.outputLevel,
    op.velocitySensitivity,
    op.envelope[0].rate,
    op.envelope[1].rate,
    op.envelope[2].rate,
    op.envelope[3].rate,
    op.envelope[0].level,
    op.envelope[1].level,
    op.envelope[2].level,
    op.envelope[3].level,
    op.modulationAmplitude,
    op.mode,
    1,
    op.detune,
    op.keyboardRateScaling,
    '0 \n',
  ];
  return parts.join(' ');
}

/**
 * Replace only the first occurrence of `search`, matching Java Blue's
 * `TextUtilities.replace` (single indexOf-based replacement). Java BlueX7
 * generation depends on this: tokens such as "p12" also occur inside later
 * identifiers (e.g. "imap128") and trailing comments, which Java leaves
 * untouched.
 */
function replaceFirst(text: string, search: string, replacement: string): string {
  const pos = text.indexOf(search);
  if (pos === -1) {
    return text;
  }
  return text.substring(0, pos) + replacement + text.substring(pos + search.length);
}

function makeCsound7Compatible(text: string): string {
  // The Java DX7 resources use `continue` as a label. Csound 7 reserves that
  // token, so rename only this label/reference pair at the generated-ORC
  // boundary while leaving the Java source resource unchanged.
  return text
    .replace(/\bigoto[ \t]+continue\b/g, 'igoto continue_')
    .replace(/^continue:[ \t]*$/gm, 'continue_:');
}

export function generateBlueX7InstrumentBody(
  voice: BlueX7Voice,
  staticTables: BlueX7StaticTables,
  operatorTableNums: number[],
): string {
  const rawOrc = ALGORITHM_ORCHESTRAS[voice.common.algorithm];
  if (rawOrc === undefined) {
    // Java Blue fails to load dx7<alg>.orc for out-of-range algorithms and
    // returns an empty instrument body; preserve that behavior.
    return '';
  }

  const credits = `; Instrument derived from Russell Pinkston's DX7 emulation patches
; Code from Jeff Harrington's DX72SCO consulted in building BlueX7
; as well as the JSynthLib project
`;

  let instrText = credits + rawOrc;
  const instrIdx = instrText.indexOf('instr');
  const newlineAfterInstr = instrText.indexOf('\n', instrIdx);
  const endinIdx = instrText.indexOf('endin');
  if (newlineAfterInstr !== -1 && endinIdx !== -1) {
    instrText = instrText.substring(newlineAfterInstr + 1, endinIdx - 1);
  }
  instrText = makeCsound7Compatible(instrText);

  // Java Blue uses TextUtilities.replace (first occurrence only) for every
  // substitution below; replaceFirst preserves that exact semantics.
  instrText = replaceFirst(instrText, 'abs(p3)', 'idur');
  instrText = replaceFirst(instrText, 'ihold', 'idur \t= abs(p3) \np3 = p3 + 4');
  instrText = replaceFirst(instrText, 'cpspch(p4)', '(p4 < 15 ? cpspch(p4) : p4)');
  instrText = replaceFirst(instrText, 'octpch(p4)', '(p4 < 15 ? octpch(p4) : p4)');

  /* Static FTable Swap */
  instrText = replaceFirst(instrText, 'p16', String(staticTables.outputAmpTable));
  instrText = replaceFirst(instrText, 'p17', '5000');
  instrText = replaceFirst(instrText, 'p18', String(staticTables.rateScaleTable));
  instrText = replaceFirst(instrText, 'p19', String(staticTables.egLevelPeakTable));
  instrText = replaceFirst(instrText, 'p20', String(staticTables.egRateRiseLvlTable));
  instrText = replaceFirst(instrText, 'p21', String(staticTables.egRateDecayLvlTable));
  instrText = replaceFirst(instrText, 'p22', String(staticTables.velSensitivityTable));
  instrText = replaceFirst(instrText, 'p23', String(staticTables.velAmpTable));
  instrText = replaceFirst(instrText, 'p24', String(staticTables.feedbackScaleTable));

  /* Swapping other values */
  instrText = replaceFirst(instrText, 'p25', String(voice.common.feedback));

  for (let i = 0; i < 6; i++) {
    instrText = replaceFirst(instrText, `p${i + 10}`, String(operatorTableNums[i] ?? (12 + i)));
  }

  const pos = instrText.lastIndexOf('out');
  if (pos !== -1) {
    instrText = instrText.substring(0, pos) + 'aout = ' + instrText.substring(pos + 7);
  }

  instrText += '\n' + (voice.csoundPostCode ?? '');
  return instrText;
}

export function getBlueX7BindingReport(): { emitted: string[]; notEmitted: string[] } {
  return {
    emitted: [
      'common.algorithm (selects ORC topology template)',
      'common.feedback (p25 index in feedback table)',
      'operators[1..6].outputLevel (table index 0)',
      'operators[1..6].velocitySensitivity (table index 1)',
      'operators[1..6].envelope R1..R4 / L1..L4 (table indices 2..9)',
      'operators[1..6].modulationAmplitude (table index 10)',
      'operators[1..6].mode (table index 11)',
      'operators[1..6].detune (table index 13)',
      'operators[1..6].keyboardRateScaling (table index 14)',
      'csoundPostCode (appended verbatim to instrument body)',
    ],
    notEmitted: [
      'common.keyTranspose (stored in XML; not referenced in Pinkston ORC)',
      'common.operatorEnabled (stored in XML; ORC topology does not branch on enables)',
      'operators[1..6].sync (stored in XML; not referenced in Pinkston ORC)',
      'operators[1..6].freqCoarse / freqFine (handled via score p4; table value is fixed to 1)',
      'operators[1..6].breakpoint / depthLeft / depthRight / curveLeft / curveRight (stored in XML; not in ORC)',
      'operators[1..6].modulationPitch (stored in XML; not in ORC)',
      'lfo (speed, delay, PMD, AMD, wave, sync stored in XML; not in Pinkston ORC)',
      'pitchEnvelope (stored in XML; PEG not in Pinkston ORC)',
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
      if (other._sourceXmlTemplate) {
        this._sourceXmlTemplate = Element.parse(other._sourceXmlTemplate.toXml());
      }
    } else {
      this._voice = createDefaultBlueX7Voice();
    }
  }

  getVoice(): BlueX7Voice {
    return this._voice;
  }

  setVoice(voice: BlueX7Voice): void {
    this._voice = cloneBlueX7Voice(voice);
  }

  replaceVoice(voice: BlueX7Voice): void {
    this._voice = cloneBlueX7Voice(voice);
  }

  setCommonField<K extends keyof BlueX7Common>(field: K, value: BlueX7Common[K]): void {
    this._voice.common[field] = value;
  }

  setOperatorEnabled(index: number, enabled: boolean): void {
    if (index >= 0 && index < 6) {
      this._voice.common.operatorEnabled[index] = enabled;
    }
  }

  setLfoField<K extends keyof BlueX7Lfo>(field: K, value: BlueX7Lfo[K]): void {
    this._voice.lfo[field] = value;
  }

  setOperatorField<K extends keyof BlueX7Operator>(
    operatorIndex: number,
    field: K,
    value: BlueX7Operator[K],
  ): void {
    if (operatorIndex >= 0 && operatorIndex < 6) {
      this._voice.operators[operatorIndex][field] = value;
    }
  }

  setSharedOscillatorSync(value: number): void {
    for (let i = 0; i < 6; i++) {
      this._voice.operators[i].sync = value;
    }
  }

  setSharedPitchModulationSensitivity(value: number): void {
    for (let i = 0; i < 6; i++) {
      this._voice.operators[i].modulationPitch = value;
    }
  }

  setOperatorEnvelopePoint(
    operatorIndex: number,
    stageIndex: number,
    point: EnvelopePoint,
  ): void {
    if (operatorIndex >= 0 && operatorIndex < 6 && stageIndex >= 0 && stageIndex < 4) {
      this._voice.operators[operatorIndex].envelope[stageIndex] = { ...point };
    }
  }

  setPitchEnvelopePoint(stageIndex: number, point: EnvelopePoint): void {
    if (stageIndex >= 0 && stageIndex < 4) {
      this._voice.pitchEnvelope[stageIndex] = { ...point };
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

  override generateFTables(tables: Tables): void {
    const buffer: string[] = [];
    let staticTables = tables.getCompilationVariable(BLUEX7_STATIC_TABLES) as BlueX7StaticTables | undefined;

    if (!staticTables) {
      tables.setCompilationVariable(BLUEX7_HAS_BEEN_COMPILED, true);

      staticTables = {
        sineTable: tables.getOpenFTableNumber(),
        outputAmpTable: tables.getOpenFTableNumber(),
        rateScaleTable: tables.getOpenFTableNumber(),
        egRateRiseLvlTable: tables.getOpenFTableNumber(),
        egRateRisePercentageTable: tables.getOpenFTableNumber(),
        egRateDecayLvlTable: tables.getOpenFTableNumber(),
        egRateDecayPercentageTable: tables.getOpenFTableNumber(),
        egLevelPeakTable: tables.getOpenFTableNumber(),
        velAmpTable: tables.getOpenFTableNumber(),
        velSensitivityTable: tables.getOpenFTableNumber(),
        feedbackScaleTable: tables.getOpenFTableNumber(),
      };
      tables.setCompilationVariable(BLUEX7_STATIC_TABLES, staticTables);

      buffer.push('; [BLUEX7] - START STATIC TABLES; sine wave');
      buffer.push(`f${staticTables.sineTable}     0       512     10      1`);
      buffer.push('; operator output level to amp scale function (data from Chowning/Bristow)');
      buffer.push(`f${staticTables.outputAmpTable}     0       128     7       0       10      .003    10      .013       10      .031    10      .079    10      .188    10      .446       5       .690    5       1.068   5       1.639   5       2.512       5       3.894   5       6.029   5       9.263   4       13.119       29      13.119`);
      buffer.push('; rate scaling function');
      buffer.push(`f${staticTables.rateScaleTable}     0       128     7       0       128     1`);
      buffer.push('; eg rate rise function for lvl change between 0 and 99 (data from Opcode)');
      buffer.push(`f${staticTables.egRateRiseLvlTable}     0       128     -7      38      5       22.8    5       12      5       7.5     5       4.8     5       2.7     5       1.8     5       1.3       8       .737    3       .615    3       .505    3       .409    3       .321    6       .080    6       .055    2       .032    3       .024       3       .018    3       .014    3       .011    3       .008    3       .008    3       .007    3       .005    3       .003    32      .003`);
      buffer.push('; eg rate rise percentage function');
      buffer.push(`f${staticTables.egRateRisePercentageTable}     0       128     -7      .00001  31      .00001  4       .02     5       .06     10      .14     10      .24     10      .35     10      .50       10      .70     5       .86     4       1.0     29      1.0`);
      buffer.push('; eg rate decay function for lvl change between 0 and 99');
      buffer.push(`f${staticTables.egRateDecayLvlTable}     0       128     -7      318     4       181     5       115     5       63      5       39.7    5       20      5       11.2    5       7       8       5.66    3       3.98    6       1.99    3       1.34    3       .99     3       .71     5       .41     3       .15     3       .081       3       .068    3       .047    3       .037    3       .025    3       .02     3       .013    3       .008    36      .008`);
      buffer.push('; eg rate decay percentage function');
      buffer.push(`f${staticTables.egRateDecayPercentageTable}     0       128     -7      .00001  10      .25     10      .35     10     .43     10      .52     10      .59     10      .70     10      .77     10      .84     10      .92     9       1.0     29      1.0`);
      buffer.push('; eg level to peak deviation mapping function (index in radians = Index / 2PI)');
      buffer.push(`f${staticTables.egLevelPeakTable}     0       128     -7      0       10      .000477 10      .002     10      .00493  10      .01257  10      .02992  10      .07098     5       .10981  5       .16997  5       .260855 5       .39979     5       .61974  5       .95954  5       1.47425 4       2.08795     29      2.08795`);
      buffer.push('; velocity to amp factor mapping function (rough guess)');
      buffer.push(`f${staticTables.velAmpTable}     0       129     9       .25     1       0`);
      buffer.push('; velocity sensitivity scaling function');
      buffer.push(`f${staticTables.velSensitivityTable}     0       8       -7      0       8       1`);
      buffer.push('; feedback scaling function');
      buffer.push(`f${staticTables.feedbackScaleTable}     0       8       -7      0       8       7`);
      buffer.push('; [BLUEX7] - END STATIC TABLES\n');
    }

    this._staticTables = staticTables;
    buffer.push(`; FTABLES FOR BLUEX7 INSTRUMENT: ${this.getName()}`);

    this.operatorTableNums = [];
    for (let i = 0; i < 6; i++) {
      const tableNum = tables.getOpenFTableNumber();
      this.operatorTableNums.push(tableNum);
      buffer.push(generateFTableForOperator(this._voice.operators[i], tableNum));
    }
    buffer.push('');

    const currentTables = tables.getTables();
    const joined = buffer.join('\n');
    tables.setTables(currentTables ? `${currentTables}\n${joined}` : joined);
  }

  private _staticTables: BlueX7StaticTables | null = null;

  override generateInstrument(): string {
    const staticTables = this._staticTables ?? {
      sineTable: 1,
      outputAmpTable: 2,
      rateScaleTable: 3,
      egRateRiseLvlTable: 4,
      egRateRisePercentageTable: 5,
      egRateDecayLvlTable: 6,
      egRateDecayPercentageTable: 7,
      egLevelPeakTable: 8,
      velAmpTable: 9,
      velSensitivityTable: 10,
      feedbackScaleTable: 11,
    };
    return generateBlueX7InstrumentBody(
      this._voice,
      staticTables,
      this.operatorTableNums ?? [12, 13, 14, 15, 16, 17],
    );
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

    return instr;
  }

  deepCopy(): BlueX7 {
    return new BlueX7(this);
  }
}
