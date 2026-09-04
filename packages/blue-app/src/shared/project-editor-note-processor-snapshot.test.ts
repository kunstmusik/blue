import { describe, expect, it } from 'vitest';
import {
  BlueData,
  PolyObject,
  GenericScore,
  AddProcessor,
  MultiplyProcessor,
  NoteProcessorChain,
} from '@blue/data';
import { createProjectEditorSnapshot, createScoreObjectEditorDocument } from './project-editor';
import type { ScoreObjectEditorRequest } from './project-editor';

function createProjectWithChain(...processors: import('@blue/data').NoteProcessor[]): BlueData {
  const data = new BlueData();
  const score = data.getScore();
  score.length = 0;
  const poly = new PolyObject(true);
  poly.newLayerAt(0);
  const layer = poly[0];
  const sObj = new GenericScore();
  sObj.setName('Test Object');
  const chain = new NoteProcessorChain();
  for (const p of processors) {
    chain.addProcessor(p);
  }
  sObj.setNoteProcessorChain(chain);
  layer.push(sObj);
  score.push(poly);
  return data;
}

describe('note processor chain snapshot in project editor', () => {
  it('populates noteProcessorChain for a sound object with AddProcessor', () => {
    const add = new AddProcessor();
    add.setVal('5');
    add.setPfield('4');
    const data = createProjectWithChain(add);
    const snapshot = createProjectEditorSnapshot(data, null);

    const item = snapshot.score?.layerGroups[0]?.layers[0]?.items[0];
    expect(item).toBeDefined();
    expect(item!.editorTarget.supportsNoteProcessorChain).toBe(true);

    const request: ScoreObjectEditorRequest = { target: item!.editorTarget };
    const doc = createScoreObjectEditorDocument(data, request);
    expect(doc).not.toBeNull();
    expect(doc!.shared.noteProcessorChain).toBeDefined();
    expect(doc!.shared.noteProcessorChain!.processors).toHaveLength(1);
    expect(doc!.shared.noteProcessorChain!.processors[0]!.processorType).toBe('AddProcessor');
    expect(doc!.shared.noteProcessorChain!.processors[0]!.parameters.val).toBe('5');
    expect(doc!.shared.noteProcessorChain!.processors[0]!.supported).toBe(true);
    expect(doc!.shared.noteProcessorChain!.processors[0]!.deferred).toBe(false);
  });

  it('populates empty chain snapshot when no processors are present', () => {
    const data = createProjectWithChain();
    const snapshot = createProjectEditorSnapshot(data, null);
    const item = snapshot.score?.layerGroups[0]?.layers[0]?.items[0];
    expect(item).toBeDefined();

    const request: ScoreObjectEditorRequest = { target: item!.editorTarget };
    const doc = createScoreObjectEditorDocument(data, request);
    expect(doc).not.toBeNull();
    expect(doc!.shared.noteProcessorChain).toBeDefined();
    expect(doc!.shared.noteProcessorChain!.processors).toHaveLength(0);
    expect(doc!.shared.noteProcessorChain!.hasUnsupportedProcessors).toBe(false);
  });

  it('populates chain with multiple processors preserving order', () => {
    const add = new AddProcessor();
    add.setVal('10');
    const mul = new MultiplyProcessor();
    mul.setVal('2');
    const data = createProjectWithChain(add, mul);

    const snapshot = createProjectEditorSnapshot(data, null);
    const item = snapshot.score?.layerGroups[0]?.layers[0]?.items[0];

    const request: ScoreObjectEditorRequest = { target: item!.editorTarget };
    const doc = createScoreObjectEditorDocument(data, request);
    expect(doc!.shared.noteProcessorChain!.processors).toHaveLength(2);
    expect(doc!.shared.noteProcessorChain!.processors[0]!.processorType).toBe('AddProcessor');
    expect(doc!.shared.noteProcessorChain!.processors[0]!.parameters.val).toBe('10');
    expect(doc!.shared.noteProcessorChain!.processors[1]!.processorType).toBe('MultiplyProcessor');
    expect(doc!.shared.noteProcessorChain!.processors[1]!.parameters.val).toBe('2');
  });

  it('sets hasUnsupportedProcessors to false for all supported processors', () => {
    const add = new AddProcessor();
    const data = createProjectWithChain(add);
    const snapshot = createProjectEditorSnapshot(data, null);
    const item = snapshot.score?.layerGroups[0]?.layers[0]?.items[0];

    const request: ScoreObjectEditorRequest = { target: item!.editorTarget };
    const doc = createScoreObjectEditorDocument(data, request);
    expect(doc!.shared.noteProcessorChain!.hasUnsupportedProcessors).toBe(false);
    expect(doc!.shared.noteProcessorChain!.hasDeferredProcessors).toBe(false);
  });
});
