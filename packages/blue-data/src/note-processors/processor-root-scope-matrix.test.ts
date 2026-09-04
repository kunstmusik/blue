import { describe, expect, it } from 'vitest';
import { Score } from '../score/score';
import { PolyObject } from '../sound-objects/poly-object';
import { SoundLayer } from '../sound-objects/sound-layer';
import { GenericScore } from '../sound-objects/generic-score';
import { TimeBehavior } from '../sound-objects/time-behavior';
import { TimeDuration } from '../time/time-duration';
import { CompileData } from '../compile-data';
import {
  ALL_PROCESSOR_TYPES,
  createConfiguredChainWithProcessor,
  createTestNoteList,
} from './processor-test-fixtures';
import { AddProcessor } from './add-processor';

describe('Root (Score) scope processor matrix', () => {
  const compileData = CompileData.createEmptyCompileData();

  function makeScore(npc?: ReturnType<typeof createConfiguredChainWithProcessor>): Score {
    const score = new Score();
    score.length = 0;

    const gs = new GenericScore();
    gs.setScoreText(createTestNoteList().toScoreText());
    gs.setTimeBehavior(TimeBehavior.NONE);
    gs.setSubjectiveDuration(TimeDuration.beats(4));

    const layer = new SoundLayer();
    layer.push(gs);

    const pObj = new PolyObject(true);
    pObj.setTimeBehavior(TimeBehavior.NONE);
    pObj.setSubjectiveDuration(TimeDuration.beats(4));
    pObj.push(layer);

    score.push(pObj);
    if (npc) score.setNoteProcessorChain(npc);
    return score;
  }

  it.each(ALL_PROCESSOR_TYPES.map((type) => [type]))(
    'applies %s at root scope without error',
    (type) => {
      const score = makeScore(createConfiguredChainWithProcessor(type));
      const result = score.generateForCSD(compileData, 0, -1);
      const expected = createConfiguredChainWithProcessor(type).apply(
        createTestNoteList().deepCopy(),
      );
      expect(result.toScoreText()).toBe(expected.toScoreText());
    },
  );

  it('proves chain is applied at root scope via AddProcessor', () => {
    const baseline = makeScore().generateForCSD(compileData, 0, -1);

    const chain = createConfiguredChainWithProcessor('AddProcessor');
    (chain.getProcessors()[0] as AddProcessor).setVal('13');
    const result = makeScore(chain).generateForCSD(compileData, 0, -1);

    expect(result.getNote(0).getPField(4)).toBe('21');
    expect(result.getNote(0).getPField(4)).not.toBe(baseline.getNote(0).getPField(4));
  });
});
