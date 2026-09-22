/**
 * Test-only reader for the canonical Java Blue automation parity corpus.
 *
 * Node APIs are allowed here because this file lives under test-support and
 * is never part of the production `@blue/data` bundle. All consumers read the
 * committed corpus at `fixtures/java-blue-automation-parity/v1/`; none may
 * maintain a separate expected-result table.
 */

import fs from 'node:fs';
import path from 'node:path';
import { BlueData } from '../blue-data';
import { PolyObject } from '../sound-objects/poly-object';
import { SoundLayer } from '../sound-objects/sound-layer';
import { GenericScore } from '../sound-objects/generic-score';
import { TimePosition } from '../time/time-position';
import { TimeDuration } from '../time/time-duration';
import { Channel } from '../mixer/channel';
import { GenericInstrument } from '../instruments/generic-instrument';
import { BlueSynthBuilder } from '../instruments/blue-synth-builder';
import { BSBKnob } from '../instruments/blue-synth-builder/bsb-knob';
import { BSBDropdown } from '../instruments/blue-synth-builder/bsb-dropdown';
import { PianoRoll } from '../sound-objects/piano-roll';
import { PianoNote } from '../sound-objects/piano-roll/piano-note';
import { FrozenSoundObject } from '../sound-objects/frozen-sound-object';
import { buildBlueX7PopSongProject } from '../instruments/blue-x7/pop-song-fixture';
import { Element } from '../serialization/xml-reader';

export interface JavaParityManifest {
  schemaVersion: number;
  generator: { id: string; version: string };
  java: { release: number };
  javaBlue: {
    repository: string;
    commit: string;
    sourceFiles: Array<{ path: string; sha256: string }>;
  };
  referenceMethods: string[];
  seed: { algorithm: string; value: string };
  generationCommand: string;
  counts: {
    total: number;
    bySection: Record<string, number>;
    byOrigin: Record<string, number>;
    byCategory: Record<string, number>;
  };
}

export type FixtureOrigin = 'curated' | 'seeded';

export type ExpectedKind = 'bits' | 'exception';

export interface RealtimeFixtureCase {
  caseId: string;
  origin: FixtureOrigin;
  category: string;
  resolutionText: string;
  curve: string;
  points: Array<{ time: number; value: number }>;
  evaluationTime: number;
  expectedKind: ExpectedKind;
  expectedBits: string;
  expectedCategory: string;
  sampleRate: number | null;
  sampleNumber: number | null;
}

export type ResolutionOperation = 'parse' | 'legacy-normalize' | 'parameter-load-save' | 'snap';

export interface ResolutionFixtureCase {
  caseId: string;
  origin: FixtureOrigin;
  category: string;
  operation: ResolutionOperation;
  parameterBdText: string;
  parameterLegacyText: string;
  lineBdText: string;
  lineLegacyText: string;
  snapValue: number | null;
  snapMin: number | null;
  snapMax: number | null;
  expectedCoefficient: string;
  expectedScale: number | null;
  expectedCanonicalText: string;
  expectedDouble: number | null;
  expectedActivation: boolean | null;
  expectedParameterSave: string | null;
  expectedLineSave: string | null;
  expectedSnap: number | null;
  expectedLinePoints: Array<{ time: number; value: number }> | null;
  expectedKind: ExpectedKind;
  expectedCategory: string;
}

export interface OfflineFixtureCase {
  caseId: string;
  origin: FixtureOrigin;
  category: string;
  resolutionText: string;
  points: Array<{ time: number; value: number }>;
  renderStart: number;
  renderEnd: number;
  instrumentId: number;
  expectedInitialBits: string;
  expectedInitialization: string;
  expectedScore: string;
  expectedKind: ExpectedKind;
  expectedCategory: string;
}

function resolveCorpusDirectory(): string {
  const relativeCorpusPath = path.join('fixtures', 'java-blue-automation-parity', 'v1');
  const candidates = [
    path.resolve(process.cwd(), relativeCorpusPath),
    path.resolve(process.cwd(), '..', '..', relativeCorpusPath),
    ...(typeof __dirname === 'string'
      ? [
          path.resolve(__dirname, '..', '..', '..', '..', relativeCorpusPath),
          path.resolve(__dirname, '..', '..', '..', '..', '..', relativeCorpusPath),
        ]
      : []),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'manifest.json'))) {
      return candidate;
    }
  }

  throw new Error(`Java automation parity corpus not found; searched: ${candidates.join(', ')}`);
}

const CORPUS_DIR = resolveCorpusDirectory();

const bitsView = new DataView(new ArrayBuffer(8));

/** Decodes 16 lowercase hexadecimal raw IEEE 754 bits into a double. */
export function bitsToDouble(hex: string): number {
  if (!/^[0-9a-f]{16}$/.test(hex)) {
    throw new Error(`invalid raw binary64 bits: ${JSON.stringify(hex)}`);
  }
  bitsView.setBigUint64(0, BigInt(`0x${hex}`));
  return bitsView.getFloat64(0);
}

/** Encodes a double as 16 lowercase hexadecimal raw bits. */
export function doubleToBits(value: number): string {
  bitsView.setFloat64(0, value);
  return bitsView.getBigUint64(0).toString(16).padStart(16, '0');
}

export function parseTsvText(name: string, text: string): string[][] {
  if (text.charCodeAt(0) === 0xfeff) {
    throw new Error(`${name} must not contain a BOM`);
  }
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  if (lines[lines.length - 1] !== '') {
    throw new Error(`${name} must end with a newline`);
  }
  const header = lines[0].split('\t');
  const rows: string[][] = [];
  for (let i = 1; i < lines.length - 1; i++) {
    const fields = lines[i].split('\t');
    if (fields.length !== header.length) {
      throw new Error(
        `${name} line ${i + 1}: expected ${header.length} fields, found ${fields.length}`,
      );
    }
    rows.push(fields);
  }
  return rows;
}

function readTsv(name: string): string[][] {
  const filePath = path.join(CORPUS_DIR, name);
  const text = fs.readFileSync(filePath, 'utf8');
  return parseTsvText(name, text);
}

function indexMap(header: string[]): Map<string, number> {
  return new Map(header.map((name, index) => [name, index]));
}

function parsePointsBits(pointsBits: string): Array<{ time: number; value: number }> {
  if (pointsBits === '') return [];
  return pointsBits.split(';').map((entry) => {
    const [timeBits, valueBits] = entry.split(':');
    return { time: bitsToDouble(timeBits), value: bitsToDouble(valueBits) };
  });
}

function decodeBase64(text: string): string {
  return Buffer.from(text, 'base64').toString('utf8');
}

export function loadJavaParityManifest(): JavaParityManifest {
  const manifestPath = path.join(CORPUS_DIR, 'manifest.json');
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as JavaParityManifest;
}

export function loadRealtimeFixtureCases(): RealtimeFixtureCase[] {
  const rows = readTsv('realtime.tsv');
  const columns = indexMap(
    'caseId,origin,category,resolutionText,curve,pointsBits,evaluationTimeBits,expectedKind,expectedBits,expectedCategory,sampleRateBits,sampleNumberBits'.split(
      ',',
    ),
  );
  return rows.map((fields) => ({
    caseId: fields[columns.get('caseId')!],
    origin: fields[columns.get('origin')!] as FixtureOrigin,
    category: fields[columns.get('category')!],
    resolutionText: fields[columns.get('resolutionText')!],
    curve: fields[columns.get('curve')!],
    points: parsePointsBits(fields[columns.get('pointsBits')!]),
    evaluationTime: bitsToDouble(fields[columns.get('evaluationTimeBits')!]),
    expectedKind: fields[columns.get('expectedKind')!] as ExpectedKind,
    expectedBits: fields[columns.get('expectedBits')!],
    expectedCategory: fields[columns.get('expectedCategory')!],
    sampleRate:
      fields[columns.get('sampleRateBits')!] === ''
        ? null
        : bitsToDouble(fields[columns.get('sampleRateBits')!]),
    sampleNumber:
      fields[columns.get('sampleNumberBits')!] === ''
        ? null
        : bitsToDouble(fields[columns.get('sampleNumberBits')!]),
  }));
}

export function loadResolutionFixtureCases(): ResolutionFixtureCase[] {
  const rows = readTsv('resolution.tsv');
  const header =
    'caseId,origin,category,operation,parameterBdText,parameterLegacyText,lineBdText,lineLegacyText,snapValueBits,snapMinBits,snapMaxBits,expectedCoefficient,expectedScale,expectedCanonicalText,expectedDoubleBits,expectedActivation,expectedParameterSaveBase64,expectedLineSaveBase64,expectedSnapBits,expectedLinePointsBits,expectedKind,expectedCategory'.split(
      ',',
    );
  const columns = indexMap(header);
  return rows.map((row) => {
    const get = (name: string): string => {
      const index = columns.get(name);
      if (index === undefined) throw new Error(`missing column ${name}`);
      return row[index];
    };
    const optBits = (name: string): number | null => {
      const text = get(name);
      return text === '' ? null : bitsToDouble(text);
    };
    return {
      caseId: get('caseId'),
      origin: get('origin') as FixtureOrigin,
      category: get('category'),
      operation: get('operation') as ResolutionOperation,
      parameterBdText: get('parameterBdText'),
      parameterLegacyText: get('parameterLegacyText'),
      lineBdText: get('lineBdText'),
      lineLegacyText: get('lineLegacyText'),
      snapValue: optBits('snapValueBits'),
      snapMin: optBits('snapMinBits'),
      snapMax: optBits('snapMaxBits'),
      expectedCoefficient: get('expectedCoefficient'),
      expectedScale: get('expectedScale') === '' ? null : Number(get('expectedScale')),
      expectedCanonicalText: get('expectedCanonicalText'),
      expectedDouble: optBits('expectedDoubleBits'),
      expectedActivation:
        get('expectedActivation') === '' ? null : get('expectedActivation') === '1',
      expectedParameterSave:
        get('expectedParameterSaveBase64') === ''
          ? null
          : decodeBase64(get('expectedParameterSaveBase64')),
      expectedLineSave:
        get('expectedLineSaveBase64') === '' ? null : decodeBase64(get('expectedLineSaveBase64')),
      expectedSnap: optBits('expectedSnapBits'),
      expectedLinePoints:
        get('expectedLinePointsBits') === ''
          ? null
          : parsePointsBits(get('expectedLinePointsBits')),
      expectedKind: get('expectedKind') as ExpectedKind,
      expectedCategory: get('expectedCategory'),
    };
  });
}

export function loadOfflineFixtureCases(): OfflineFixtureCase[] {
  const rows = readTsv('offline.tsv');
  const header =
    'caseId,origin,category,resolutionText,pointsBits,renderStartBits,renderEndBits,instrumentId,expectedInitialBits,expectedInitializationBase64,expectedScoreBase64,expectedKind,expectedCategory'.split(
      ',',
    );
  const columns = indexMap(header);
  return rows.map((row) => {
    const get = (name: string): string => {
      const index = columns.get(name);
      if (index === undefined) throw new Error(`missing column ${name}`);
      return row[index];
    };
    return {
      caseId: get('caseId'),
      origin: get('origin') as FixtureOrigin,
      category: get('category'),
      resolutionText: get('resolutionText'),
      points: parsePointsBits(get('pointsBits')),
      renderStart: bitsToDouble(get('renderStartBits')),
      renderEnd: bitsToDouble(get('renderEndBits')),
      instrumentId: Number(get('instrumentId')),
      expectedInitialBits: get('expectedInitialBits'),
      expectedInitialization: decodeBase64(get('expectedInitializationBase64')),
      expectedScore: decodeBase64(get('expectedScoreBase64')),
      expectedKind: get('expectedKind') as ExpectedKind,
      expectedCategory: get('expectedCategory'),
    };
  });
}

/**
 * Validates the manifest against the sections being loaded: schema version,
 * per-section counts, origin counts, and category counts. Every consumer must
 * run this before testing cases.
 */
export function assertManifestInvariants(
  manifest: JavaParityManifest,
  sections: {
    realtime?: RealtimeFixtureCase[];
    resolution?: ResolutionFixtureCase[];
    offline?: OfflineFixtureCase[];
  },
): void {
  if (manifest.schemaVersion !== 1) {
    throw new Error(`unsupported fixture schema version: ${manifest.schemaVersion}`);
  }
  if (manifest.seed.algorithm !== 'SplitMix64') {
    throw new Error(`unexpected seed algorithm: ${manifest.seed.algorithm}`);
  }
  const categoryCounts = new Map<string, number>();
  const originCounts = new Map<string, number>();
  let total = 0;
  const tally = (
    cases: Array<{ caseId: string; origin: string; category: string }>,
    section: string,
  ) => {
    if (manifest.counts.bySection[section] !== cases.length) {
      throw new Error(
        `section count mismatch for ${section}: manifest ${manifest.counts.bySection[section]}, actual ${cases.length}`,
      );
    }
    for (const fixtureCase of cases) {
      total += 1;
      categoryCounts.set(fixtureCase.category, (categoryCounts.get(fixtureCase.category) ?? 0) + 1);
      originCounts.set(fixtureCase.origin, (originCounts.get(fixtureCase.origin) ?? 0) + 1);
    }
  };
  if (sections.realtime) tally(sections.realtime, 'realtime');
  if (sections.resolution) tally(sections.resolution, 'resolution');
  if (sections.offline) tally(sections.offline, 'offline');
  if (total !== manifest.counts.total) {
    throw new Error(`total count mismatch: manifest ${manifest.counts.total}, actual ${total}`);
  }
  for (const [category, count] of Object.entries(manifest.counts.byCategory)) {
    if (categoryCounts.get(category) !== count) {
      throw new Error(
        `category count mismatch for ${category}: manifest ${count}, actual ${categoryCounts.get(category) ?? 0}`,
      );
    }
  }
  for (const [origin, count] of Object.entries(manifest.counts.byOrigin)) {
    if (originCounts.get(origin) !== count) {
      throw new Error(
        `origin count mismatch for ${origin}: manifest ${count}, actual ${originCounts.get(origin) ?? 0}`,
      );
    }
  }
}

export type HistoryFixtureKind =
  'score' | 'mixer' | 'instrument' | 'bsb' | 'blueX7' | 'pianoRoll' | 'freeze' | 'unknownData';

export function resolveRepoRoot(): string {
  const candidates = [
    process.cwd(),
    path.resolve(process.cwd(), '..'),
    path.resolve(process.cwd(), '..', '..'),
    path.resolve(__dirname, '..', '..', '..', '..'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'fixtures', 'smoke-test.blue'))) {
      return candidate;
    }
  }
  return process.cwd();
}

export function loadHistoryFixtureFile(relativePath: string): BlueData {
  const fullPath = path.join(resolveRepoRoot(), relativePath);
  const text = fs.readFileSync(fullPath, 'utf8');
  return BlueData.loadFromString(text);
}

export function createRepresentativeScoreProject(): BlueData {
  const data = new BlueData();
  data.getProjectProperties().title = 'Representative Score Project';
  const root = data.getScore()[0] as PolyObject;
  root.setName('Root');
  const layer = root[0];
  layer.setName('Sound Layer 1');
  const scoreObj1 = new GenericScore();
  scoreObj1.setName('Score Object 1');
  scoreObj1.setScoreText('i1 0 2 440 0.5');
  scoreObj1.setStartTime(TimePosition.beats(0));
  scoreObj1.setSubjectiveDuration(TimeDuration.beats(2));

  const scoreObj2 = new GenericScore();
  scoreObj2.setName('Score Object 2');
  scoreObj2.setScoreText('i1 2 2 880 0.5');
  scoreObj2.setStartTime(TimePosition.beats(2));
  scoreObj2.setSubjectiveDuration(TimeDuration.beats(2));

  layer.push(scoreObj1);
  layer.push(scoreObj2);
  return data;
}

export function createRepresentativeMixerProject(): BlueData {
  const data = new BlueData();
  data.getProjectProperties().title = 'Representative Mixer Project';
  const mixer = data.getMixer();
  mixer.setEnabled(true);
  const ch1 = new Channel();
  ch1.setName('Channel 1');
  ch1.setLevel(0.8);
  const ch2 = new Channel();
  ch2.setName('Channel 2');
  ch2.setLevel(0.6);
  mixer.getChannels().push(ch1);
  mixer.getChannels().push(ch2);
  mixer.getMaster().setLevel(0.9);
  return data;
}

export function createRepresentativeInstrumentProject(): BlueData {
  const data = new BlueData();
  data.getProjectProperties().title = 'Representative Instrument Project';
  const arrangement = data.getArrangement();
  const instr1 = new GenericInstrument();
  instr1.setName('SineSynth');
  instr1.setText('ain oscili 0.2, 440\nblueMixerOut ain, ain');
  arrangement.addInstrument(instr1);
  return data;
}

export function createRepresentativeBsbProject(): BlueData {
  const data = new BlueData();
  data.getProjectProperties().title = 'Representative BSB Project';
  const arrangement = data.getArrangement();
  const bsb = new BlueSynthBuilder();
  bsb.setName('BSB Instrument');
  bsb.setInstrumentText('aout oscili <gain>, <freq>\nblueMixerOut aout, aout');

  const knob = new BSBKnob();
  knob.objectName = 'gain';
  knob.setValue(0.5);
  knob.minimum = 0;
  knob.maximum = 1;
  bsb.getGraphicInterface().getRootGroup().addChild(knob);

  const dropdown = new BSBDropdown();
  dropdown.objectName = 'freq';
  dropdown.dropdownItems = [
    { name: '440', value: '440', uniqueId: 'freq-440' },
    { name: '880', value: '880', uniqueId: 'freq-880' },
  ];
  dropdown.selectedIndex = 0;
  bsb.getGraphicInterface().getRootGroup().addChild(dropdown);

  arrangement.addInstrument(bsb);
  return data;
}

export function createRepresentativeBlueX7Project(): BlueData {
  const candidatePath = path.join(resolveRepoRoot(), 'fixtures', 'blue-x7-pop-song.blue');
  if (fs.existsSync(candidatePath)) {
    return loadHistoryFixtureFile('fixtures/blue-x7-pop-song.blue');
  }
  return buildBlueX7PopSongProject();
}

export function createRepresentativePianoRollProject(): BlueData {
  const data = new BlueData();
  data.getProjectProperties().title = 'Representative PianoRoll Project';
  const root = data.getScore()[0] as PolyObject;
  root.setName('Root');
  const layer = root[0];
  layer.setName('PianoRoll Layer');

  const roll = new PianoRoll();
  roll.setName('Lead Roll');
  roll.setStartTime(TimePosition.beats(0));
  roll.setSubjectiveDuration(TimeDuration.beats(8));

  const note1 = new PianoNote();
  note1.setOctave(8);
  note1.setScaleDegree(0);
  note1.setStart(0);
  note1.setDuration(1);

  const note2 = new PianoNote();
  note2.setOctave(8);
  note2.setScaleDegree(4);
  note2.setStart(1);
  note2.setDuration(1);

  roll.addNote(note1);
  roll.addNote(note2);

  layer.push(roll);
  return data;
}

export function createRepresentativeFreezeProject(): BlueData {
  const data = new BlueData();
  data.getProjectProperties().title = 'Representative Freeze Project';
  const root = data.getScore()[0] as PolyObject;
  root.setName('Root');
  const layer = root[0];
  layer.setName('Freeze Layer');

  const fso = new FrozenSoundObject();
  fso.setName('Frozen Audio');
  fso.setStartTime(TimePosition.beats(0));
  fso.setSubjectiveDuration(TimeDuration.beats(4));
  fso.setNumChannels(2);
  fso.setFrozenWaveFileName('freeze_01.wav');

  const source = new GenericScore();
  source.setName('Original Source');
  source.setScoreText('i1 0 4 440 0.5');
  fso.setFrozenSoundObject(source);

  layer.push(fso);
  return data;
}

export function createRepresentativeUnknownDataProject(): BlueData {
  const data = new BlueData();
  data.getProjectProperties().title = 'Representative Unknown Data Project';

  const pluginElement = new Element('legacyPlugin');
  pluginElement.setAttribute('id', 'custom-plugin-123');
  pluginElement.setText('custom-plugin-data-value');
  data.getPluginDataXml().push(pluginElement);

  const root = data.getScore()[0] as PolyObject;
  root.setName('Root');
  const layer = root[0];
  layer.setName('Unknown XML Layer');
  layer.setUnknownAttribute('customAuthoredAttr', 'testValue');
  const unknownChild = new Element('customElement');
  unknownChild.setText('unknownText');
  layer.addUnknownChild(unknownChild);

  return data;
}

export function createHistoryFixtureProject(kind: HistoryFixtureKind): BlueData {
  switch (kind) {
    case 'score':
      return createRepresentativeScoreProject();
    case 'mixer':
      return createRepresentativeMixerProject();
    case 'instrument':
      return createRepresentativeInstrumentProject();
    case 'bsb':
      return createRepresentativeBsbProject();
    case 'blueX7':
      return createRepresentativeBlueX7Project();
    case 'pianoRoll':
      return createRepresentativePianoRollProject();
    case 'freeze':
      return createRepresentativeFreezeProject();
    case 'unknownData':
      return createRepresentativeUnknownDataProject();
  }
}
