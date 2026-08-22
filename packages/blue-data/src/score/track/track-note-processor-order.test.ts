import { describe, expect, it } from 'vitest';
import { BlueData } from '../../blue-data';
import { CompileData } from '../../compile-data';
import { AddProcessor } from '../../note-processors/add-processor';
import { NoteProcessorChain } from '../../note-processors/note-processor-chain';
import { NoteProcessor } from '../../note-processors/note-processor';
import { NoteList } from '../../sound-objects/note-list';
import { GenericScore } from '../../sound-objects/generic-score';
import { Element } from '../../serialization/xml-reader';
import { TimeDuration } from '../../time/time-duration';
import { Track } from './track';
import { TrackLayerGroup } from './track-layer-group';
import '../../sound-objects/register-sound-object-types';

function add(chain: NoteProcessorChain, value: number): void {
  const processor = new AddProcessor();
  processor.setVal(String(value));
  chain.addProcessor(processor);
}

class ThrowingProcessor extends NoteProcessor {
  process(_notes: NoteList): NoteList {
    throw new Error('Track failure');
  }

  getDisplayName(): string { return 'Throwing Processor'; }
  deepCopy(): NoteProcessor { return new ThrowingProcessor(); }
  saveAsXML(): Element { return new Element('noteProcessor'); }
}

function createTrackProject(): { data: BlueData; track: Track } {
  const data = new BlueData();
  data.getScore().length = 0;

  const group = new TrackLayerGroup();
  group.setUniqueId('processor-group');
  const track = group.newLayerAt(0);
  track.setUniqueId('processor-track');

  const score = new GenericScore();
  score.setScoreText('i 1 0 1 440');
  score.setSubjectiveDuration(TimeDuration.beats(1));
  const objectChain = new NoteProcessorChain();
  add(objectChain, 10);
  score.setNoteProcessorChain(objectChain);
  track.push(score);

  const trackChain = new NoteProcessorChain();
  add(trackChain, 100);
  track.setNoteProcessorChain(trackChain);
  data.getScore().push(group);

  const rootChain = new NoteProcessorChain();
  add(rootChain, 1000);
  data.getScore().setNoteProcessorChain(rootChain);
  return { data, track };
}

describe('Track note processor scope order', () => {
  it('applies object, eligible p1 override, Track, then root processing', () => {
    const { data, track } = createTrackProject();
    const compileData = new CompileData();
    compileData.setTrackInstrumentId(track.getUniqueId(), 9);

    const notes = data.getScore().generateForCSD(compileData, 0, -1);
    expect(notes.length).toBeGreaterThan(0);
    expect(notes.getNote(0).getPField(1)).toBe('9');
    expect(Number(notes.getNote(0).getPField(4))).toBeCloseTo(1550, 6);
  });

  it('keeps the same order for async generation and leaves empty chains neutral', async () => {
    const { data, track } = createTrackProject();
    const compileData = new CompileData();
    compileData.setTrackInstrumentId(track.getUniqueId(), 9);

    const notes = await data.getScore().generateForCSDAsync(compileData, 0, -1);
    expect(notes.getNote(0).getPField(1)).toBe('9');
    expect(Number(notes.getNote(0).getPField(4))).toBeCloseTo(1550, 6);

    track.setNoteProcessorChain(new NoteProcessorChain());
    data.getScore().setNoteProcessorChain(new NoteProcessorChain());
    const neutral = data.getScore().generateForCSD(new CompileData(), 0, -1);
    expect(Number(neutral.getNote(0).getPField(4))).toBeCloseTo(450, 6);
  });

  it('reports Track processor failures consistently in sync and async paths', async () => {
    const { data, track } = createTrackProject();
    const failing = new NoteProcessorChain();
    failing.addProcessor(new ThrowingProcessor());
    track.setNoteProcessorChain(failing);

    expect(() => data.getScore().generateForCSD(new CompileData(), 0, -1))
      .toThrow('Error in Throwing Processor: Track failure');
    await expect(data.getScore().generateForCSDAsync(new CompileData(), 0, -1))
      .rejects.toThrow('Error in Throwing Processor: Track failure');
  });
});
