import { describe, expect, it, vi } from 'vitest';
import {
  BlueData,
  ClojureObject,
  GenericScore,
  ObjectBuilder,
  PolyObject,
  PythonObject,
  SoundLayer,
  TimePosition,
} from '@blue/data';
import { testScoreObject } from './score-object-test';
import type { ScoreObjectEditorTargetSnapshot } from '../shared/project-editor';

function makeTarget(
  objectType: string,
  location: ScoreObjectEditorTargetSnapshot['location'],
): ScoreObjectEditorTargetSnapshot {
  return {
    selectionId: 'sobj-test',
    selectedObjectType: objectType,
    editorObjectType: objectType,
    ownerKind: 'timeline',
    displayContext: 'timeline',
    location,
    supportsTimeBehavior: true,
    supportsRepeatPoint: true,
    supportsNoteProcessorChain: true,
  };
}

describe('testScoreObject', () => {
  it('uses the canonical generateForCSD path for GenericScore', async () => {
    const data = new BlueData();
    const root = data.getScore()[0] as PolyObject;
    const layer = root[0];
    const score = new GenericScore();
    score.setScoreText('i1 0 1 440');
    score.setStartTime(TimePosition.beats(2));
    layer.push(score);

    const result = await testScoreObject(data, {
      target: makeTarget('GenericScore', {
        rootGroupIndex: 0,
        containerPath: [],
        layerIndex: 0,
        objectIndex: layer.length - 1,
      }),
    });

    expect(result.ok).toBe(true);
    expect(result.output).toContain('i1\t2.0\t4\t440');
  });

  it('resolves nested score object targets before testing', async () => {
    const data = new BlueData();
    const root = data.getScore()[0] as PolyObject;
    const rootLayer = root[0];
    const nested = new PolyObject();
    const nestedLayer = new SoundLayer();
    const score = new GenericScore();
    score.setScoreText('i2 0 1 880');

    nestedLayer.push(score);
    nested.push(nestedLayer);
    rootLayer.push(nested);

    const result = await testScoreObject(data, {
      target: makeTarget('GenericScore', {
        rootGroupIndex: 0,
        containerPath: [{ layerIndex: 0, objectIndex: rootLayer.length - 1 }],
        layerIndex: 0,
        objectIndex: 0,
      }),
    });

    expect(result.ok).toBe(true);
    expect(result.output).toContain('i2\t0.0\t4\t880');
  });

  it('delegates ClojureObject testing through the async Java runtime path', async () => {
    const data = new BlueData();
    const root = data.getScore()[0] as PolyObject;
    const layer = root[0];
    const clojure = new ClojureObject();
    clojure.setClojureCode('(def score "i3 0 4 330")');
    layer.push(clojure);

    const evaluateClojureScoreObject = vi.fn(async () => ({
      ok: true,
      result: {
        scoreText: 'i3 0 4 330',
        namespace: 'user0',
      },
    }));

    const result = await testScoreObject(data, {
      target: makeTarget('ClojureObject', {
        rootGroupIndex: 0,
        containerPath: [],
        layerIndex: 0,
        objectIndex: layer.length - 1,
      }),
    }, {
      javaRuntimeClient: {
        evaluateClojureScoreObject,
      } as any,
    });

    expect(result.ok).toBe(true);
    expect(result.output).toContain('i3');
    expect(evaluateClojureScoreObject).toHaveBeenCalledWith({
      code: '(def score "i3 0 4 330")',
      blueDuration: 4,
    });
  });

  it('returns a friendly error when a ClojureObject is tested without a Java runtime', async () => {
    const data = new BlueData();
    const root = data.getScore()[0] as PolyObject;
    const layer = root[0];
    const clojure = new ClojureObject();
    layer.push(clojure);

    const result = await testScoreObject(data, {
      target: makeTarget('ClojureObject', {
        rootGroupIndex: 0,
        containerPath: [],
        layerIndex: 0,
        objectIndex: layer.length - 1,
      }),
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe(
      'Java runtime is unavailable. Install Java 17 or newer to test Clojure objects.',
    );
  });

  it('delegates PythonObject testing through the async Java runtime path', async () => {
    const data = new BlueData();
    const root = data.getScore()[0] as PolyObject;
    const layer = root[0];
    const pythonObject = new PythonObject();
    pythonObject.setPythonCode('score = "i4 0 4 220"');
    layer.push(pythonObject);

    const evaluateJythonScoreObject = vi.fn(async () => ({
      ok: true,
      result: {
        scoreText: 'i4 0 4 220',
      },
    }));

    const result = await testScoreObject(data, {
      target: makeTarget('PythonObject', {
        rootGroupIndex: 0,
        containerPath: [],
        layerIndex: 0,
        objectIndex: layer.length - 1,
      }),
    }, {
      javaRuntimeClient: {
        evaluateJythonScoreObject,
      } as any,
    });

    expect(result.ok).toBe(true);
    expect(result.output).toContain('i4');
    expect(evaluateJythonScoreObject).toHaveBeenCalledWith({
      code: 'score = "i4 0 4 220"',
      blueDuration: 4,
    });
  });

  it('returns a friendly error when a PythonObject is tested without a Java runtime', async () => {
    const data = new BlueData();
    const root = data.getScore()[0] as PolyObject;
    const layer = root[0];
    const pythonObject = new PythonObject();
    layer.push(pythonObject);

    const result = await testScoreObject(data, {
      target: makeTarget('PythonObject', {
        rootGroupIndex: 0,
        containerPath: [],
        layerIndex: 0,
        objectIndex: layer.length - 1,
      }),
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe(
      'Java runtime is unavailable. Install Java 17 or newer to test Python objects.',
    );
  });

  it('delegates Python ObjectBuilder testing through the async Java runtime path', async () => {
    const data = new BlueData();
    const root = data.getScore()[0] as PolyObject;
    const layer = root[0];
    const objectBuilder = new ObjectBuilder();
    objectBuilder.setCode('score = "i5 0 4 110"');
    layer.push(objectBuilder);

    const evaluateJythonObjectBuilder = vi.fn(async () => ({
      ok: true,
      result: {
        scoreText: 'i5 0 4 110',
      },
    }));

    const result = await testScoreObject(data, {
      target: makeTarget('ObjectBuilder', {
        rootGroupIndex: 0,
        containerPath: [],
        layerIndex: 0,
        objectIndex: layer.length - 1,
      }),
    }, {
      javaRuntimeClient: {
        evaluateJythonObjectBuilder,
      } as any,
    });

    expect(result.ok).toBe(true);
    expect(result.output).toContain('i5');
    expect(evaluateJythonObjectBuilder).toHaveBeenCalledWith({
      code: 'score = "i5 0 4 110"',
      blueDuration: 4,
      commandline: '',
    });
  });

  it('returns a friendly error when a Python ObjectBuilder is tested without a Java runtime', async () => {
    const data = new BlueData();
    const root = data.getScore()[0] as PolyObject;
    const layer = root[0];
    const objectBuilder = new ObjectBuilder();
    layer.push(objectBuilder);

    const result = await testScoreObject(data, {
      target: makeTarget('ObjectBuilder', {
        rootGroupIndex: 0,
        containerPath: [],
        layerIndex: 0,
        objectIndex: layer.length - 1,
      }),
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe(
      'Java runtime is unavailable. Install Java 17 or newer to test Python ObjectBuilder objects.',
    );
  });
});
