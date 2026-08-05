import { describe, expect, it } from 'vitest';
import {
  BlueData,
  Score,
  PolyObject,
  SoundLayer,
  GenericScore,
  TimeDuration,
  NoteProcessorChain,
  AddProcessor,
  MultiplyProcessor,
  RotateProcessor,
  TrackLayerGroup,
  AudioClip,
  TimePosition,
  PatternsLayerGroup,
  Element,
} from '@blue/data';
import {
  createScoreDocumentSnapshot,
  createProjectEditorSnapshot,
} from './project-editor';

function makePolyObjectWithChains(): BlueData {
  const data = new BlueData();
  const score = data.getScore();
  score.length = 0;

  const rootChain = new NoteProcessorChain();
  const add = new AddProcessor();
  add.setVal('10');
  rootChain.addProcessor(add);
  score.setNoteProcessorChain(rootChain);

  const poly = new PolyObject(true);
  poly.setName('Poly');

  const groupChain = new NoteProcessorChain();
  const rotate = new RotateProcessor();
  rotate.setNoteIndex('2');
  groupChain.addProcessor(rotate);
  poly.setNoteProcessorChain(groupChain);

  const layer0 = new SoundLayer();
  layer0.setName('Layer 0');
  const gs0 = new GenericScore();
  gs0.setSubjectiveDuration(TimeDuration.beats(2));
  gs0.setScoreText('i 1 0 1 440');
  layer0.push(gs0);

  const layer1 = new SoundLayer();
  layer1.setName('Layer 1');
  const gs1 = new GenericScore();
  gs1.setSubjectiveDuration(TimeDuration.beats(2));
  gs1.setScoreText('i 2 0 1 880');

  const layerChain = new NoteProcessorChain();
  const mul = new MultiplyProcessor();
  mul.setVal('2');
  layerChain.addProcessor(mul);
  layer1.setNoteProcessorChain(layerChain);
  layer1.push(gs1);

  poly.push(layer0);
  poly.push(layer1);
  score.push(poly);

  return data;
}

describe('score-note-processor-targets', () => {
  it('populates rootNoteProcessorChain from score root chain', () => {
    const data = makePolyObjectWithChains();
    const snap = createScoreDocumentSnapshot(data);

    expect(snap.rootNoteProcessorChain).toBeDefined();
    expect(snap.rootNoteProcessorChain!.processors).toHaveLength(1);
    expect(snap.rootNoteProcessorChain!.processors[0].processorType).toBe('AddProcessor');
    expect(snap.rootNoteProcessorChain!.processors[0].parameters.val).toBe('10');
  });

  it('populates poly-object group noteProcessorChain', () => {
    const data = makePolyObjectWithChains();
    const snap = createScoreDocumentSnapshot(data);

    expect(snap.layerGroups).toHaveLength(1);
    const group = snap.layerGroups[0]!;
    expect(group.groupType).toBe('polyObject');
    expect(group.noteProcessorChain).toBeDefined();
    expect(group.noteProcessorChain!.processors).toHaveLength(1);
    expect(group.noteProcessorChain!.processors[0].processorType).toBe('RotateProcessor');
  });

  it('populates sound layer noteProcessorChain', () => {
    const data = makePolyObjectWithChains();
    const snap = createScoreDocumentSnapshot(data);

    const group = snap.layerGroups[0]!;
    expect(group.layers).toHaveLength(2);

    expect(group.layers[0]!.noteProcessorChain).toBeUndefined();

    expect(group.layers[1]!.noteProcessorChain).toBeDefined();
    expect(group.layers[1]!.noteProcessorChain!.processors).toHaveLength(1);
    expect(group.layers[1]!.noteProcessorChain!.processors[0].processorType).toBe('MultiplyProcessor');
  });

  it('omits rootNoteProcessorChain when root chain is empty', () => {
    const data = new BlueData();
    data.getScore().length = 0;
    const poly = new PolyObject(true);
    poly.push(new SoundLayer());
    data.getScore().push(poly);

    const snap = createScoreDocumentSnapshot(data);
    expect(snap.rootNoteProcessorChain).toBeUndefined();
  });

  it('omits group noteProcessorChain when poly-object chain is empty', () => {
    const data = new BlueData();
    data.getScore().length = 0;
    const poly = new PolyObject(true);
    poly.push(new SoundLayer());
    data.getScore().push(poly);

    const snap = createScoreDocumentSnapshot(data);
    expect(snap.layerGroups[0]!.noteProcessorChain).toBeUndefined();
  });

  it('omits layer noteProcessorChain when sound layer chain is empty', () => {
    const data = new BlueData();
    data.getScore().length = 0;
    const poly = new PolyObject(true);
    poly.push(new SoundLayer());
    data.getScore().push(poly);

    const snap = createScoreDocumentSnapshot(data);
    expect(snap.layerGroups[0]!.layers[0]!.noteProcessorChain).toBeUndefined();
  });

  it('handles TrackLayerGroup with an empty group chain in snapshot', () => {
    const data = new BlueData();
    data.getScore().length = 0;

    const alg = new TrackLayerGroup();
    alg.newLayerAt(0);

    const clip = new AudioClip();
    clip.setName('test clip');
    clip.setStartTime(TimePosition.beats(0));
    clip.setSubjectiveDuration(TimeDuration.beats(2));
    alg[0].push(clip);

    data.getScore().push(alg);

    const snap = createScoreDocumentSnapshot(data);
    expect(snap.layerGroups).toHaveLength(1);
    expect(snap.layerGroups[0]!.groupType).toBe('track');

    const audioGroup = snap.layerGroups[0]!;
    expect(audioGroup.noteProcessorChain).toBeUndefined();
    expect(audioGroup.layers[0]!.noteProcessorChain).toBeUndefined();
  });

  it('handles PatternsLayerGroup with group chain', () => {
    const data = new BlueData();
    data.getScore().length = 0;

    const plg = new PatternsLayerGroup();
    plg.newLayerAt(0);

    const groupChain = new NoteProcessorChain();
    const add = new AddProcessor();
    add.setVal('5');
    groupChain.addProcessor(add);
    plg.setNoteProcessorChain(groupChain);

    data.getScore().push(plg);

    const snap = createScoreDocumentSnapshot(data);
    expect(snap.layerGroups).toHaveLength(1);
    expect(snap.layerGroups[0]!.groupType).toBe('patterns');

    const patternsGroup = snap.layerGroups[0]!;
    expect(patternsGroup.noteProcessorChain).toBeDefined();
    expect(patternsGroup.noteProcessorChain!.processors).toHaveLength(1);
    expect(patternsGroup.noteProcessorChain!.processors[0].processorType).toBe('AddProcessor');
  });

  it('reflects chains at all three scopes simultaneously', () => {
    const data = makePolyObjectWithChains();
    const snap = createScoreDocumentSnapshot(data);

    expect(snap.rootNoteProcessorChain!.processors[0].processorType).toBe('AddProcessor');
    expect(snap.layerGroups[0]!.noteProcessorChain!.processors[0].processorType).toBe('RotateProcessor');
    expect(snap.layerGroups[0]!.layers[1]!.noteProcessorChain!.processors[0].processorType).toBe('MultiplyProcessor');
  });

  it('populates hasUnsupportedProcessors and hasDeferredProcessors flags', () => {
    const data = new BlueData();
    data.getScore().length = 0;

    const rootChain = new NoteProcessorChain();
    const add = new AddProcessor();
    rootChain.addProcessor(add);
    data.getScore().setNoteProcessorChain(rootChain);

    const poly = new PolyObject(true);
    poly.push(new SoundLayer());
    data.getScore().push(poly);

    const snap = createScoreDocumentSnapshot(data);

    expect(snap.rootNoteProcessorChain!.hasUnsupportedProcessors).toBe(false);
    expect(snap.rootNoteProcessorChain!.hasDeferredProcessors).toBe(false);
  });
});
