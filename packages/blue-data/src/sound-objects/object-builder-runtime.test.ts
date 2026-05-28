import { describe, expect, it, vi } from 'vitest';
import { BSBKnob } from '../instruments/blue-synth-builder/bsb-knob';
import { CompileData } from '../compile-data';
import { setJavaRuntimeClient, type JavaRuntimeClientContract } from '../java-runtime';
import { TimeContext } from '../time/time-context';
import { ObjectBuilder } from './object-builder';

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
  });
});