/**
 * Java Blue Live trigger parity fixtures.
 *
 * Reusable Java-parity oracles shared by the pure data-layer trigger tests,
 * the shared contract tests, and the engine submission tests. Each builder
 * returns a deterministic `BlueData` with stable LiveObject identities plus
 * the expected column-major target set and p2/p3 scaling expectations.
 *
 * These fixtures intentionally live in a non-test source path so that both
 * `@blue/data` unit tests and `@blue/app` renderer/shared tests can import
 * them without crossing package boundaries.
 */
import { BlueData } from '../blue-data';
import { LiveData } from '../live-data';
import { LiveObject } from './live-object';
import { LiveObjectBins } from './live-object-bins';
import { LiveObjectSet } from './live-object-set';
import { LiveObjectSetList } from './live-object-set-list';
import { GenericScore } from '../sound-objects/generic-score';
import { ClojureObject } from '../sound-objects/clojure-object';
import { PythonObject } from '../sound-objects/python-object';
import { JavaScriptObject } from '../sound-objects/javascript-object';
import { ObjectBuilder } from '../sound-objects/object-builder';
import { SoundObjectLibrary } from '../sound-objects/sound-object-library';
import { Instance } from '../sound-objects/instance';
import { SoundObject } from '../sound-objects/sound-object';
import { TimeBehavior } from '../sound-objects/time-behavior';
import { TimePosition } from '../time/time-position';
import { TimeDuration } from '../time/time-duration';

export interface ExpectedLiveObjectTarget {
  uniqueId: string;
  displayName: string;
}

export interface ExpectedScalingCase {
  tempo: number;
  /** Exactly 60 / tempo, captured for deterministic comparison. */
  tempoScale: number;
  /** Base (tempo 60) p2/p3 values per generated note. */
  baseNote: { p2: number; p3: number };
  /** Expected p2/p3 after scaling. */
  scaledNote: { p2: number; p3: number };
}

/**
 * Column-major target order the Java implementation traverses: iterate each
 * column top-to-bottom before moving to the next column.
 */
export const COLUMN_MAJOR_TARGET_ORDER: ReadonlyArray<{ column: number; row: number }> = [
  { column: 0, row: 0 },
  { column: 0, row: 1 },
  { column: 1, row: 0 },
  { column: 1, row: 1 },
  { column: 1, row: 2 },
];

/**
 * Create a fresh GenericScore SoundObject with the supplied score text.
 * The copy's TimeBehavior is left as the authored default; the trigger
 * service overrides it to NONE on the isolated copy.
 */
export function createGenericScoreSoundObject(
  name: string,
  scoreText: string,
): GenericScore {
  const obj = new GenericScore();
  obj.setName(name);
  obj.setScoreText(scoreText);
  return obj;
}

/**
 * Build a modern multi-column Live Data grid with stable, known unique IDs.
 *
 * Layout (column-major):
 *   - (0,0) ID "lo-00" disabled, native score
 *   - (0,1) ID "lo-01" enabled, native score
 *   - (1,0) ID "lo-10" enabled, native score
 *   - (1,1) ID "lo-11" disabled, native score
 *   - (1,2) ID "lo-12" enabled, native score
 *
 * The enabled column-major traversal order is therefore:
 *   lo-01 -> lo-10 -> lo-12
 */
export function createModernLiveData(): LiveData {
  const ld = new LiveData();
  ld.setTempo(60);
  ld.setRepeat(4);
  ld.setRepeatEnabled(false);
  ld.setCommandLine('csound -Wdo devaudio -L stdin');
  ld.setCommandLineEnabled(true);

  const bins = new LiveObjectBins(2, 8);

  const lo00 = new LiveObject();
  lo00.setUniqueId('lo-00');
  lo00.setEnabled(false);
  lo00.setSoundObject(createGenericScoreSoundObject('Cell A', 'i1 0 2 440 0.5'));
  bins.setLiveObject(0, 0, lo00);

  const lo01 = new LiveObject();
  lo01.setUniqueId('lo-01');
  lo01.setEnabled(true);
  lo01.setSoundObject(createGenericScoreSoundObject('Cell B', 'i1 0 1 220 0.3'));
  bins.setLiveObject(0, 1, lo01);

  const lo10 = new LiveObject();
  lo10.setUniqueId('lo-10');
  lo10.setEnabled(true);
  lo10.setSoundObject(createGenericScoreSoundObject('Cell C', 'i1 0 3 330 0.7'));
  bins.setLiveObject(1, 0, lo10);

  const lo11 = new LiveObject();
  lo11.setUniqueId('lo-11');
  lo11.setEnabled(false);
  lo11.setSoundObject(createGenericScoreSoundObject('Cell D', 'i1 0 0.5 110 0.1'));
  bins.setLiveObject(1, 1, lo11);

  const lo12 = new LiveObject();
  lo12.setUniqueId('lo-12');
  lo12.setEnabled(true);
  lo12.setSoundObject(createGenericScoreSoundObject('Cell E', 'i1 0 4 550 0.9'));
  bins.setLiveObject(1, 2, lo12);

  ld.setLiveObjectBins(bins);
  return ld;
}

export const MODERN_ENABLED_TARGET_ORDER: ReadonlyArray<ExpectedLiveObjectTarget> = [
  { uniqueId: 'lo-01', displayName: 'Cell B' },
  { uniqueId: 'lo-10', displayName: 'Cell C' },
  { uniqueId: 'lo-12', displayName: 'Cell E' },
];

export const MODERN_ALL_POPULATED_TARGET_ORDER: ReadonlyArray<ExpectedLiveObjectTarget> = [
  { uniqueId: 'lo-00', displayName: 'Cell A' },
  { uniqueId: 'lo-01', displayName: 'Cell B' },
  { uniqueId: 'lo-10', displayName: 'Cell C' },
  { uniqueId: 'lo-11', displayName: 'Cell D' },
  { uniqueId: 'lo-12', displayName: 'Cell E' },
];

/**
 * A BlueData wrapping {@link createModernLiveData} with a default tempo of 60.
 */
export function createModernProject(): BlueData {
  const data = new BlueData();
  data.setLiveData(createModernLiveData());
  return data;
}

/**
 * Build an old-format (pre-liveObjectBins) Live Data equivalent: a single
 * column grid with two populated rows, matching the legacy migration path.
 */
export function createOldFormatLiveData(): LiveData {
  const ld = new LiveData();
  ld.setTempo(90);
  ld.setCommandLineEnabled(false);

  const bins = new LiveObjectBins(1, 8);

  const lo0 = new LiveObject();
  lo0.setUniqueId('old-0');
  lo0.setEnabled(true);
  lo0.setSoundObject(createGenericScoreSoundObject('Legacy A', 'i1 0 2 440'));
  bins.setLiveObject(0, 0, lo0);

  const lo1 = new LiveObject();
  lo1.setUniqueId('old-1');
  lo1.setEnabled(true);
  lo1.setSoundObject(createGenericScoreSoundObject('Legacy B', 'i2 1 2 880'));
  bins.setLiveObject(0, 1, lo1);

  ld.setLiveObjectBins(bins);
  return ld;
}

export const OLD_FORMAT_ENABLED_TARGET_ORDER: ReadonlyArray<ExpectedLiveObjectTarget> = [
  { uniqueId: 'old-0', displayName: 'Legacy A' },
  { uniqueId: 'old-1', displayName: 'Legacy B' },
];

/**
 * A sparse grid with gaps (null cells) between populated ones to verify
 * column-major traversal skips nulls correctly.
 */
export function createSparseGridLiveData(): LiveData {
  const ld = new LiveData();
  ld.setTempo(60);

  const bins = new LiveObjectBins(3, 4);

  const loA = new LiveObject();
  loA.setUniqueId('sparse-a');
  loA.setEnabled(true);
  loA.setSoundObject(createGenericScoreSoundObject('Sparse A', 'i1 0 1 100'));
  bins.setLiveObject(0, 0, loA);

  // (0,1) intentionally null
  // (1,0) intentionally null

  const loC = new LiveObject();
  loC.setUniqueId('sparse-c');
  loC.setEnabled(true);
  loC.setSoundObject(createGenericScoreSoundObject('Sparse C', 'i1 0 1 200'));
  bins.setLiveObject(1, 1, loC);

  const loD = new LiveObject();
  loD.setUniqueId('sparse-d');
  loD.setEnabled(false);
  loD.setSoundObject(createGenericScoreSoundObject('Sparse D', 'i1 0 1 300'));
  bins.setLiveObject(2, 0, loD);

  ld.setLiveObjectBins(bins);
  return ld;
}

export const SPARSE_GRID_ENABLED_TARGET_ORDER: ReadonlyArray<ExpectedLiveObjectTarget> = [
  { uniqueId: 'sparse-a', displayName: 'Sparse A' },
  { uniqueId: 'sparse-c', displayName: 'Sparse C' },
];

/**
 * Build Live Data where a saved set references a LiveObject ID that no
 * longer exists in the bins, plus one that does exist.
 */
export function createMissingSavedSetIdLiveData(): LiveData {
  const ld = createModernLiveData();
  const sets = new LiveObjectSetList();

  const mixed = new LiveObjectSet();
  mixed.setName('Mixed Set');
  mixed.setLiveObjectIds(['lo-01', 'lo-gone-missing']);
  sets.add(mixed);

  ld.getLiveObjectBins();
  ld.setLiveObjectSets(sets);
  return ld;
}

/**
 * A multi-enabled grid where more than one enabled cell shares a row and
 * more than one shares a column, verifying no row/column exclusivity is
 * imposed.
 */
export function createMultiEnabledLiveData(): LiveData {
  const ld = new LiveData();
  ld.setTempo(60);

  const bins = new LiveObjectBins(2, 3);

  const ids: Array<{ col: number; row: number; id: string; name: string; enabled: boolean }> = [
    { col: 0, row: 0, id: 'me-00', name: 'ME A', enabled: true },
    { col: 0, row: 1, id: 'me-01', name: 'ME B', enabled: true },
    { col: 1, row: 0, id: 'me-10', name: 'ME C', enabled: true },
    { col: 1, row: 1, id: 'me-11', name: 'ME D', enabled: false },
    { col: 1, row: 2, id: 'me-12', name: 'ME E', enabled: true },
  ];

  for (const entry of ids) {
    const obj = new LiveObject();
    obj.setUniqueId(entry.id);
    obj.setEnabled(entry.enabled);
    obj.setSoundObject(createGenericScoreSoundObject(entry.name, `i1 0 1 ${entry.id.length * 10}`));
    bins.setLiveObject(entry.col, entry.row, obj);
  }

  ld.setLiveObjectBins(bins);
  return ld;
}

export const MULTI_ENABLED_TARGET_ORDER: ReadonlyArray<ExpectedLiveObjectTarget> = [
  { uniqueId: 'me-00', displayName: 'ME A' },
  { uniqueId: 'me-01', displayName: 'ME B' },
  { uniqueId: 'me-10', displayName: 'ME C' },
  { uniqueId: 'me-12', displayName: 'ME E' },
];

/**
 * Build a LiveObject whose SoundObject is an Instance referencing a library
 * entry. The returned {@link LibraryInstanceFixture} exposes both the
 * library and the instance so deep-copy/reference-remap tests can verify
 * the copied Instance points at the copied library object.
 */
export interface LibraryInstanceFixture {
  data: BlueData;
  libraryObject: SoundObject;
  instance: Instance;
  liveObject: LiveObject;
}

export function createLibraryInstanceLiveData(): LibraryInstanceFixture {
  const data = new BlueData();
  const ld = data.getLiveData();
  ld.setTempo(60);

  const library = data.getSoundObjectLibrary();
  const libraryObject = createGenericScoreSoundObject('Library Source', 'i1 0 2 660 0.5');
  library.addObject(libraryObject);

  const instance = new Instance();
  instance.setName('Instance: Library Source');
  instance.setSoundObject(libraryObject);
  instance.setStartTime(TimePosition.beats(0));
  instance.setSubjectiveDuration(TimeDuration.beats(2));
  instance.setTimeBehavior(TimeBehavior.SCALE);

  const liveObject = new LiveObject();
  liveObject.setUniqueId('lib-inst-0');
  liveObject.setEnabled(true);
  liveObject.setSoundObject(instance);

  const bins = new LiveObjectBins(1, 4);
  bins.setLiveObject(0, 0, liveObject);
  ld.setLiveObjectBins(bins);

  return { data, libraryObject, instance, liveObject };
}

/**
 * Build Live Data populated with runtime-backed SoundObjects (Clojure,
 * Python, JavaScript, ObjectBuilder). Each object is seeded with code that
 * the test fake runtimes can evaluate.
 */
export interface RuntimeBackedFixture {
  data: BlueData;
  clojureObject: ClojureObject;
  pythonObject: PythonObject;
  javaScriptObject: JavaScriptObject;
  objectBuilder: ObjectBuilder;
}

export function createRuntimeBackedLiveData(): RuntimeBackedFixture {
  const data = new BlueData();
  const ld = data.getLiveData();
  ld.setTempo(60);

  const bins = new LiveObjectBins(2, 4);

  const clojureObject = new ClojureObject();
  clojureObject.setName('Clojure Live');
  clojureObject.setClojureCode('(blue/eval-score "i1 0 2 440")');

  const pythonObject = new PythonObject();
  pythonObject.setName('Python Live');
  pythonObject.setPythonCode('score = "i1 0 1 880"');

  const javaScriptObject = new JavaScriptObject();
  javaScriptObject.setName('JS Live');
  javaScriptObject.setJavaScriptCode('score = "i1 0 1 220";');

  const objectBuilder = new ObjectBuilder();
  objectBuilder.setName('OB Python');
  objectBuilder.setLanguageType('python');
  objectBuilder.setCode('return "i1 0 1 330";');

  const clojureLo = new LiveObject();
  clojureLo.setUniqueId('rt-clj');
  clojureLo.setEnabled(true);
  clojureLo.setSoundObject(clojureObject);
  bins.setLiveObject(0, 0, clojureLo);

  const pythonLo = new LiveObject();
  pythonLo.setUniqueId('rt-py');
  pythonLo.setEnabled(true);
  pythonLo.setSoundObject(pythonObject);
  bins.setLiveObject(0, 1, pythonLo);

  const jsLo = new LiveObject();
  jsLo.setUniqueId('rt-js');
  jsLo.setEnabled(true);
  jsLo.setSoundObject(javaScriptObject);
  bins.setLiveObject(1, 0, jsLo);

  const obLo = new LiveObject();
  obLo.setUniqueId('rt-ob');
  obLo.setEnabled(true);
  obLo.setSoundObject(objectBuilder);
  bins.setLiveObject(1, 1, obLo);

  ld.setLiveObjectBins(bins);
  return { data, clojureObject, pythonObject, javaScriptObject, objectBuilder };
}

/**
 * Expected p2/p3 scaling cases for the `60 / tempo` rule.
 *
 * p2 is start time, p3 is duration in a Csound score statement.
 */
export const TEMPO_SCALING_CASES: ReadonlyArray<ExpectedScalingCase> = [
  {
    tempo: 60,
    tempoScale: 1,
    baseNote: { p2: 4, p3: 2 },
    scaledNote: { p2: 4, p3: 2 },
  },
  {
    tempo: 120,
    tempoScale: 0.5,
    baseNote: { p2: 4, p3: 2 },
    scaledNote: { p2: 2, p3: 1 },
  },
  {
    tempo: 30,
    tempoScale: 2,
    baseNote: { p2: 4, p3: 2 },
    scaledNote: { p2: 8, p3: 4 },
  },
  {
    tempo: 90,
    tempoScale: 60 / 90,
    baseNote: { p2: 3, p3: 1.5 },
    scaledNote: { p2: 2, p3: 1 },
  },
];

/**
 * Invalid tempo values the trigger service must reject without engine
 * submission.
 */
export const INVALID_TEMPO_VALUES: ReadonlyArray<number> = [
  0,
  -60,
  NaN,
  Infinity,
  -Infinity,
];

/**
 * Convenience helper: attach a saved enabled set to an existing Live Data
 * instance without rebuilding the grid.
 */
export function attachSavedSet(ld: LiveData, name: string, ids: string[]): void {
  const set = new LiveObjectSet();
  set.setName(name);
  set.setLiveObjectIds(ids);
  const list = new LiveObjectSetList();
  list.add(set);
  ld.setLiveObjectSets(list);
}
