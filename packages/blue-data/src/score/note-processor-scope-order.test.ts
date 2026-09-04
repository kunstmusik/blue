import { describe, expect, it } from 'vitest';
import { Score } from './score';
import { PolyObject } from '../sound-objects/poly-object';
import { SoundLayer } from '../sound-objects/sound-layer';
import { GenericScore } from '../sound-objects/generic-score';
import { CompileData } from '../compile-data';
import { TimeDuration } from '../time/time-duration';
import { NoteProcessorChain } from '../note-processors/note-processor-chain';
import { AddProcessor } from '../note-processors/add-processor';

function makeScoreWithNote(
  objectChain?: NoteProcessorChain,
  rootChain?: NoteProcessorChain,
): Score {
  const score = new Score();
  score.length = 0;

  if (rootChain) {
    score.setNoteProcessorChain(rootChain);
  }

  const poly = new PolyObject(true);
  const layer = new SoundLayer();
  const gs = new GenericScore();
  gs.setSubjectiveDuration(TimeDuration.beats(2));
  gs.setScoreText('i 1 0 1 440');

  if (objectChain) {
    gs.setNoteProcessorChain(objectChain);
  }

  layer.push(gs);
  poly.push(layer);
  score.push(poly);

  return score;
}

describe('Note processor scope order', () => {
  it('applies object chain before root chain', () => {
    const objectChain = new NoteProcessorChain();
    const addObj = new AddProcessor();
    addObj.setVal('10');
    objectChain.addProcessor(addObj);

    const rootChain = new NoteProcessorChain();
    const addRoot = new AddProcessor();
    addRoot.setVal('100');
    rootChain.addProcessor(addRoot);

    const score = makeScoreWithNote(objectChain, rootChain);
    const result = score.generateForCSD(new CompileData(), 0, -1);

    expect(result.length).toBeGreaterThan(0);
    expect(parseFloat(result.getNote(0).getPField(4)!)).toBeCloseTo(550, 1);
  });

  it('applies only root chain when object chain is empty', () => {
    const rootChain = new NoteProcessorChain();
    const addRoot = new AddProcessor();
    addRoot.setVal('50');
    rootChain.addProcessor(addRoot);

    const score = makeScoreWithNote(undefined, rootChain);
    const result = score.generateForCSD(new CompileData(), 0, -1);

    expect(parseFloat(result.getNote(0).getPField(4)!)).toBeCloseTo(490, 1);
  });

  it('applies only object chain when root chain is empty', () => {
    const objectChain = new NoteProcessorChain();
    const addObj = new AddProcessor();
    addObj.setVal('25');
    objectChain.addProcessor(addObj);

    const score = makeScoreWithNote(objectChain);
    const result = score.generateForCSD(new CompileData(), 0, -1);

    expect(parseFloat(result.getNote(0).getPField(4)!)).toBeCloseTo(465, 1);
  });

  it('returns original notes when both chains are empty', () => {
    const score = makeScoreWithNote();
    const result = score.generateForCSD(new CompileData(), 0, -1);

    expect(parseFloat(result.getNote(0).getPField(4)!)).toBeCloseTo(440, 1);
  });
});
