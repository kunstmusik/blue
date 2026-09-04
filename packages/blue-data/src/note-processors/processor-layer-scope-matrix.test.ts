import { describe, expect, it } from 'vitest';
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

describe('Layer scope processor matrix', () => {
  const compileData = CompileData.createEmptyCompileData();
  const context = new TimeContext();

  function makeSoundObject(): GenericScore {
    const gs = new GenericScore();
    gs.setScoreText(createTestNoteList().toScoreText());
    gs.setTimeBehavior(TimeBehavior.NONE);
    gs.setSubjectiveDuration(TimeDuration.beats(4));
    return gs;
  }

  it.each(ALL_PROCESSOR_TYPES.map((type) => [type]))(
    'applies %s at layer scope without error',
    (type) => {
      const layer = new SoundLayer();
      layer.push(makeSoundObject());
      layer.setNoteProcessorChain(createConfiguredChainWithProcessor(type));

      const result = layer.generateForCSD(context, compileData, 0, -1);
      const expected = createConfiguredChainWithProcessor(type).apply(
        createTestNoteList().deepCopy(),
      );
      expect(result.toScoreText()).toBe(expected.toScoreText());
    },
  );

  it('proves chain is applied at layer scope via AddProcessor', () => {
    const layerNoNpc = new SoundLayer();
    const gsBase = new GenericScore();
    gsBase.setScoreText('i 1 0 1 100');
    gsBase.setTimeBehavior(TimeBehavior.NONE);
    gsBase.setSubjectiveDuration(TimeDuration.beats(4));
    layerNoNpc.push(gsBase);
    const baseline = layerNoNpc.generateForCSD(context, compileData, 0, -1);

    const layer = new SoundLayer();
    const gs = new GenericScore();
    gs.setScoreText('i 1 0 1 100');
    gs.setTimeBehavior(TimeBehavior.NONE);
    gs.setSubjectiveDuration(TimeDuration.beats(4));
    layer.push(gs);

    const chain = createConfiguredChainWithProcessor('AddProcessor');
    (chain.getProcessors()[0] as AddProcessor).setVal('7');
    layer.setNoteProcessorChain(chain);

    const result = layer.generateForCSD(context, compileData, 0, -1);
    expect(result.getNote(0).getPField(4)).toBe('107');
    expect(result.getNote(0).getPField(4)).not.toBe(baseline.getNote(0).getPField(4));
  });
});
