import { describe, expect, it } from 'vitest';
import { BlueData } from './blue-data';
import { LiveObject } from './live/live-object';
import { PythonInstrument } from './instruments/python-instrument';
import { PythonProcessor } from './note-processors/python-processor';
import { ObjectBuilder } from './sound-objects/object-builder';
import { PolyObject } from './sound-objects/poly-object';
import { PythonObject } from './sound-objects/python-object';
import { ClojureObject } from './sound-objects/clojure-object';
import { GenericScore } from './sound-objects/generic-score';

describe('BlueData Java runtime usage', () => {
  it('treats PythonObject score content as requiring the Java runtime', () => {
    const data = new BlueData();
    const root = data.getScore()[0] as PolyObject;
    root[0].push(new PythonObject());

    expect(data.usesJavaRuntime()).toBe(true);
  });

  it('treats Python ObjectBuilder score content as requiring the Java runtime', () => {
    const data = new BlueData();
    const root = data.getScore()[0] as PolyObject;
    const objectBuilder = new ObjectBuilder();
    objectBuilder.setLanguageType('PYTHON');
    root[0].push(objectBuilder);

    expect(data.usesJavaRuntime()).toBe(true);
  });

  it('treats PythonInstrument arrangement content as requiring the Java runtime', () => {
    const data = new BlueData();
    data.getArrangement().addInstrument(new PythonInstrument(), '1');

    expect(data.usesJavaRuntime()).toBe(true);
  });

  it('treats PythonProcessor note-processor chains as requiring the Java runtime', () => {
    const data = new BlueData();
    const processor = new PythonProcessor();
    processor.setCode('pass');
    data.getScore().getNoteProcessorChain().addProcessor(processor);

    expect(data.usesJavaRuntime()).toBe(true);
  });

  it('treats a Python Live Space object as requiring the Java runtime', () => {
    const data = new BlueData();
    const liveObject = new LiveObject();
    liveObject.setSoundObject(new PythonObject());
    data.getLiveData().getLiveObjectBins().setLiveObject(0, 0, liveObject);

    expect(data.usesJavaRuntime()).toBe(true);
  });

  it('treats a Clojure Live Space object as requiring the Java runtime', () => {
    const data = new BlueData();
    const liveObject = new LiveObject();
    liveObject.setSoundObject(new ClojureObject());
    data.getLiveData().getLiveObjectBins().setLiveObject(0, 0, liveObject);

    expect(data.usesJavaRuntime()).toBe(true);
  });

  it('does not require the Java runtime for native-only Live Space objects', () => {
    const data = new BlueData();
    const liveObject = new LiveObject();
    liveObject.setSoundObject(new GenericScore());
    data.getLiveData().getLiveObjectBins().setLiveObject(0, 0, liveObject);

    expect(data.usesJavaRuntime()).toBe(false);
  });
});