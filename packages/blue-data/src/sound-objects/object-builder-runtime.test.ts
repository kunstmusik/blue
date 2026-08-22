import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { BSBKnob } from '../instruments/blue-synth-builder/bsb-knob';
import { BlueData } from '../blue-data';
import { CompileData } from '../compile-data';
import { setJavaRuntimeClient, type JavaRuntimeClientContract } from '../java-runtime';
import { initializeJavaScriptRuntime } from '../javascript-runtime';
import { TimeContext } from '../time/time-context';
import { PolyObject } from './poly-object';
import {
  getExternalCommandExecutor,
  setExternalCommandExecutor,
  type ExternalCommandExecutor,
} from './external';
import { ObjectBuilder } from './object-builder';

let previousExternalExecutor: ExternalCommandExecutor | null;

function createRuntimeClient(): JavaRuntimeClientContract {
  return {
    health: vi.fn(async () => ({ ok: true, result: { version: '0.0.1', methods: [] } })),
    initSession: vi.fn(async () => ({ ok: true, result: { projectSessionId: 1, clojureNamespace: 'user0', dependenciesLoaded: [] } })),
    reinitializeClojure: vi.fn(async () => ({ ok: true, result: { clojureNamespace: 'user1' } })),
    evaluateClojure: vi.fn(async () => ({ ok: true, result: { value: '', namespace: 'user0' } })),
    evaluateClojureScoreObject: vi.fn(async () => ({ ok: true, result: { scoreText: '', namespace: 'user0' } })),
    jythonImportCheck: vi.fn(async () => ({ ok: true, result: { importedModules: [], libraryPaths: [] } })),
    evaluateJythonScript: vi.fn(async () => ({ ok: true, result: { value: '' } })),
    evaluateJythonScoreObject: vi.fn(async () => ({ ok: true, result: { scoreText: '' } })),
    evaluateJythonObjectBuilder: vi.fn(async () => ({
      ok: true,
      result: {
        scoreText: 'i1 0 4 440',
      },
    })),
    evaluateJythonInstrument: vi.fn(async () => ({ ok: true, result: { instrumentText: '' } })),
    processJythonNoteList: vi.fn(async () => ({ ok: true, result: { notes: [] } })),
    reinitializeJython: vi.fn(async () => ({ ok: true, result: { libraryPaths: [] } })),
  };
}

describe('ObjectBuilder runtime bridge', () => {
  beforeAll(async () => {
    await initializeJavaScriptRuntime();
  });

  beforeEach(() => {
    previousExternalExecutor = getExternalCommandExecutor();
  });

  afterEach(() => {
    setExternalCommandExecutor(previousExternalExecutor);
  });

  it('replaces BSB values before evaluating Python code', async () => {
    const runtimeClient = createRuntimeClient();
    const compileData = CompileData.createEmptyCompileData();
    setJavaRuntimeClient(compileData, runtimeClient);

    const objectBuilder = new ObjectBuilder();
    objectBuilder.setCode('score = "i1 0 <amp> 440"');
    objectBuilder.setCommandLine('render --fast');

    const knob = new BSBKnob();
    knob.objectName = 'amp';
    knob.setValue(4);
    objectBuilder.getGraphicInterface().getRootGroup().addChild(knob);

    const noteList = await objectBuilder.generateForCSDAsync(new TimeContext(), compileData, 0, -1);

    expect(noteList.length).toBe(1);
    expect(noteList.getNote(0).getPField(1)).toBe('1');
    expect(noteList.getNote(0).getSubjectiveDuration()).toBe(4);
    expect(runtimeClient.evaluateJythonObjectBuilder).toHaveBeenCalledWith({
      code: 'score = "i1 0 4 440"',
      blueDuration: 4,
      commandline: 'render --fast',
    });
  });

  it('marks python ObjectBuilder content as requiring the Java runtime', () => {
    const objectBuilder = new ObjectBuilder();

    expect(objectBuilder.isPythonLanguage()).toBe(true);
    expect(objectBuilder.usesJavaRuntime()).toBe(true);
  });

  it('evaluates JavaScript code with BSB replacements without the Java runtime', () => {
    const objectBuilder = new ObjectBuilder();
    objectBuilder.setLanguageType('JAVASCRIPT');
    objectBuilder.setCode('score = "i1 0 1 <amp>";');

    const knob = new BSBKnob();
    knob.objectName = 'amp';
    knob.setValue(3);
    objectBuilder.getGraphicInterface().getRootGroup().addChild(knob);

    const noteList = objectBuilder.generateForCSD(
      new TimeContext(),
      CompileData.createEmptyCompileData(),
      0,
      -1,
    );

    expect(noteList).toHaveLength(1);
    expect(noteList.getNote(0).getPField(4)).toBe('3');
    expect(objectBuilder.usesJavaRuntime()).toBe(false);
  });

  it('evaluates External code through the registered executor', () => {
    const execute = vi.fn(() => 'i2 0 2 330');
    setExternalCommandExecutor({ execute });

    const objectBuilder = new ObjectBuilder();
    objectBuilder.setLanguageType('EXTERNAL');
    objectBuilder.setCommandLine('render --stdin');
    objectBuilder.setCode('external source');

    const noteList = objectBuilder.generateForCSD(
      new TimeContext(),
      CompileData.createEmptyCompileData(),
      0,
      -1,
    );

    expect(execute).toHaveBeenCalledWith('render --stdin', 'external source', null);
    expect(noteList).toHaveLength(1);
    expect(noteList.getNote(0).getPField(1)).toBe('2');
    expect(objectBuilder.usesJavaRuntime()).toBe(false);
  });

  it('evaluates Clojure with ObjectBuilder commandline bindings', async () => {
    const runtimeClient = createRuntimeClient();
    vi.mocked(runtimeClient.evaluateClojureScoreObject).mockResolvedValue({
      ok: true,
      result: { scoreText: 'i3 0 1 220', namespace: 'user0' },
    });
    const compileData = CompileData.createEmptyCompileData();
    setJavaRuntimeClient(compileData, runtimeClient);

    const objectBuilder = new ObjectBuilder();
    objectBuilder.setLanguageType('CLOJURE');
    objectBuilder.setCommandLine('clojure-option');
    objectBuilder.setCode('(def score "i3 0 1 220")');

    const noteList = await objectBuilder.generateForCSDAsync(
      new TimeContext(),
      compileData,
      0,
      -1,
    );

    expect(runtimeClient.evaluateClojureScoreObject).toHaveBeenCalledWith({
      code: '(def score "i3 0 1 220")',
      blueDuration: 4,
      commandline: 'clojure-option',
    });
    expect(noteList).toHaveLength(1);
    expect(noteList.getNote(0).getPField(1)).toBe('3');
    expect(objectBuilder.usesJavaRuntime()).toBe(true);
  });

  it('marks projects with Clojure ObjectBuilders as Java-runtime dependent', () => {
    const data = new BlueData();
    const objectBuilder = new ObjectBuilder();
    objectBuilder.setLanguageType('CLOJURE');
    const root = data.getScore()[0];
    if (!(root instanceof PolyObject)) throw new Error('Expected default PolyObject root');
    root[0]!.push(objectBuilder);

    expect(data.usesJavaRuntime()).toBe(true);
  });
});
