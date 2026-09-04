import { describe, expect, it } from 'vitest';
import {
  BlueData,
  PolyObject,
  GenericScore,
  AddProcessor,
  MultiplyProcessor,
  NoteProcessorChain,
} from '@blue/data';
import {
  applyProjectDocumentPatch,
  createProjectEditorSnapshot,
  createScoreObjectEditorDocument,
} from './project-editor';
import type { ScoreObjectEditorRequest, NoteProcessorChainSnapshot } from './project-editor';

function createProjectWithChain(...processors: import('@blue/data').NoteProcessor[]): {
  data: BlueData;
  target: import('./project-editor').ScoreObjectEditorTargetSnapshot;
} {
  const data = new BlueData();
  const score = data.getScore();
  score.length = 0;
  const poly = new PolyObject(true);
  poly.newLayerAt(0);
  const layer = poly[0];
  const sObj = new GenericScore();
  sObj.setName('Chain Target');
  const chain = new NoteProcessorChain();
  for (const p of processors) {
    chain.addProcessor(p);
  }
  sObj.setNoteProcessorChain(chain);
  layer.push(sObj);
  score.push(poly);

  const snapshot = createProjectEditorSnapshot(data, null);
  const item = snapshot.score?.layerGroups[0]?.layers[0]?.items[0]!;
  return { data, target: item.editorTarget };
}

function makeChainSnapshot(
  processors: Array<{ processorType: string; val?: string }>,
): NoteProcessorChainSnapshot {
  return {
    processors: processors.map((p, i) => ({
      id: `np-${i}`,
      processorType: p.processorType,
      displayName: p.processorType,
      supported: true,
      deferred: false,
      summary: p.processorType,
      parameters: { pfield: '4', val: p.val ?? '0' },
      serializedXml: '',
    })),
    hasUnsupportedProcessors: false,
    hasDeferredProcessors: false,
  };
}

function getChainFromData(
  data: BlueData,
  target: import('./project-editor').ScoreObjectEditorTargetSnapshot,
): NoteProcessorChainSnapshot | null | undefined {
  const request: ScoreObjectEditorRequest = { target };
  const doc = createScoreObjectEditorDocument(data, request);
  return doc?.shared.noteProcessorChain;
}

describe('replaceNoteProcessorChain patch', () => {
  it('replaces existing chain with a new chain', () => {
    const add = new AddProcessor();
    add.setVal('5');
    const { data, target } = createProjectWithChain(add);

    const newChain = makeChainSnapshot([{ processorType: 'MultiplyProcessor', val: '3' }]);
    applyProjectDocumentPatch(data, {
      score: { type: 'replaceNoteProcessorChain', target, chain: newChain },
    });

    const chain = getChainFromData(data, target);
    expect(chain).toBeDefined();
    expect(chain!.processors).toHaveLength(1);
    expect(chain!.processors[0]!.processorType).toBe('MultiplyProcessor');
    expect(chain!.processors[0]!.parameters.val).toBe('3');
  });

  it('replaces empty chain with a non-empty chain', () => {
    const { data, target } = createProjectWithChain();

    expect(getChainFromData(data, target)!.processors).toHaveLength(0);

    const newChain = makeChainSnapshot([{ processorType: 'AddProcessor', val: '7' }]);
    applyProjectDocumentPatch(data, {
      score: { type: 'replaceNoteProcessorChain', target, chain: newChain },
    });

    const chain = getChainFromData(data, target);
    expect(chain!.processors).toHaveLength(1);
    expect(chain!.processors[0]!.processorType).toBe('AddProcessor');
    expect(chain!.processors[0]!.parameters.val).toBe('7');
  });

  it('replaces non-empty chain with null (empty chain)', () => {
    const add = new AddProcessor();
    add.setVal('10');
    const { data, target } = createProjectWithChain(add);

    expect(getChainFromData(data, target)!.processors).toHaveLength(1);

    applyProjectDocumentPatch(data, {
      score: { type: 'replaceNoteProcessorChain', target, chain: null },
    });

    const chain = getChainFromData(data, target);
    expect(chain!.processors).toHaveLength(0);
  });

  it('replaces chain with a multi-processor chain', () => {
    const add = new AddProcessor();
    const { data, target } = createProjectWithChain(add);

    const newChain = makeChainSnapshot([
      { processorType: 'AddProcessor', val: '1' },
      { processorType: 'MultiplyProcessor', val: '2' },
    ]);
    applyProjectDocumentPatch(data, {
      score: { type: 'replaceNoteProcessorChain', target, chain: newChain },
    });

    const chain = getChainFromData(data, target);
    expect(chain!.processors).toHaveLength(2);
    expect(chain!.processors[0]!.processorType).toBe('AddProcessor');
    expect(chain!.processors[1]!.processorType).toBe('MultiplyProcessor');
  });

  it('round-trips chain through replace and snapshot', () => {
    const { data, target } = createProjectWithChain();

    const newChain = makeChainSnapshot([{ processorType: 'AddProcessor', val: '42' }]);
    applyProjectDocumentPatch(data, {
      score: { type: 'replaceNoteProcessorChain', target, chain: newChain },
    });

    const snapshot = createProjectEditorSnapshot(data, null);
    const item = snapshot.score?.layerGroups[0]?.layers[0]?.items[0];
    expect(item).toBeDefined();

    const doc = createScoreObjectEditorDocument(data, { target });
    expect(doc!.shared.noteProcessorChain!.processors[0]!.parameters.val).toBe('42');
  });
});
