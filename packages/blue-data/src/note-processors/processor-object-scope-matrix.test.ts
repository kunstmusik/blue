import { describe, expect, it } from 'vitest';
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
import { NoteList } from '../sound-objects/note-list';
import { AddProcessor } from './add-processor';

describe('Object scope processor matrix', () => {
  const compileData = CompileData.createEmptyCompileData();
  const context = new TimeContext();

  it.each(ALL_PROCESSOR_TYPES.map((type) => [type]))(
    'applies %s at object scope without error',
    (type) => {
      const gs = new GenericScore();
      gs.setScoreText(createTestNoteList().toScoreText());
      gs.setTimeBehavior(TimeBehavior.NONE);
      gs.setSubjectiveDuration(TimeDuration.beats(4));
      gs.setNoteProcessorChain(createConfiguredChainWithProcessor(type));

      const result = gs.generateForCSD(context, compileData, 0, -1);
      const expected = createConfiguredChainWithProcessor(type).apply(
        createTestNoteList().deepCopy(),
      );
      expect(result).toBeInstanceOf(NoteList);
      expect(result.toScoreText()).toBe(expected.toScoreText());
    },
  );

  it('proves chain is applied at object scope via AddProcessor', () => {
    const gsNoNpc = new GenericScore();
    gsNoNpc.setScoreText('i 1 0 1 100');
    gsNoNpc.setTimeBehavior(TimeBehavior.NONE);
    gsNoNpc.setSubjectiveDuration(TimeDuration.beats(4));

    const baseline = gsNoNpc.generateForCSD(context, compileData, 0, -1);

    const gs = new GenericScore();
    gs.setScoreText('i 1 0 1 100');
    gs.setTimeBehavior(TimeBehavior.NONE);
    gs.setSubjectiveDuration(TimeDuration.beats(4));
    const chain = createConfiguredChainWithProcessor('AddProcessor');
    (chain.getProcessors()[0] as AddProcessor).setVal('5');
    gs.setNoteProcessorChain(chain);

    const result = gs.generateForCSD(context, compileData, 0, -1);
    expect(result.getNote(0).getPField(4)).toBe('105');
    expect(result.getNote(0).getPField(4)).not.toBe(baseline.getNote(0).getPField(4));
  });
});
