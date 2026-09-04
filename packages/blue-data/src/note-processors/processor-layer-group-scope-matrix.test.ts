import { describe, expect, it } from 'vitest';
import { PolyObject } from '../sound-objects/poly-object';
import { SoundLayer } from '../sound-objects/sound-layer';
import { GenericScore } from '../sound-objects/generic-score';
import { TimeBehavior } from '../sound-objects/time-behavior';
import { TimeDuration } from '../time/time-duration';
import { CompileData } from '../compile-data';
import { TimeContext } from '../time/time-context';
import {
  ALL_PROCESSOR_TYPES,
  createConfiguredChainWithProcessor,
  createTestNoteList,
} from './processor-test-fixtures';
import { AddProcessor } from './add-processor';

describe('Layer group (PolyObject) scope processor matrix', () => {
  const compileData = CompileData.createEmptyCompileData();
  const context = new TimeContext();

  function makePolyObject(npc?: ReturnType<typeof createConfiguredChainWithProcessor>): PolyObject {
    const gs = new GenericScore();
    gs.setScoreText(createTestNoteList().toScoreText());
    gs.setTimeBehavior(TimeBehavior.NONE);
    gs.setSubjectiveDuration(TimeDuration.beats(4));

    const layer = new SoundLayer();
    layer.push(gs);

    const pObj = new PolyObject(false);
    pObj.setTimeBehavior(TimeBehavior.NONE);
    pObj.setSubjectiveDuration(TimeDuration.beats(4));
    pObj.push(layer);
    if (npc) pObj.setNoteProcessorChain(npc);
    return pObj;
  }

  it.each(ALL_PROCESSOR_TYPES.map((type) => [type]))(
    'applies %s at group scope without error',
    (type) => {
      const pObj = makePolyObject(createConfiguredChainWithProcessor(type));
      const result = pObj.generateForCSD(context, compileData, 0, -1);
      const expected = createConfiguredChainWithProcessor(type).apply(
        createTestNoteList().deepCopy(),
      );
      expect(result.toScoreText()).toBe(expected.toScoreText());
    },
  );

  it('proves chain is applied at group scope via AddProcessor', () => {
    const baseline = makePolyObject().generateForCSD(context, compileData, 0, -1);

    const chain = createConfiguredChainWithProcessor('AddProcessor');
    (chain.getProcessors()[0] as AddProcessor).setVal('11');
    const result = makePolyObject(chain).generateForCSD(context, compileData, 0, -1);

    expect(result.getNote(0).getPField(4)).toBe('19');
    expect(result.getNote(0).getPField(4)).not.toBe(baseline.getNote(0).getPField(4));
  });
});
