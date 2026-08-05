import { describe, expect, it } from 'vitest';
import { AddProcessor } from '../../note-processors/add-processor';
import { NoteProcessorChain } from '../../note-processors/note-processor-chain';
import { Element } from '../../serialization/xml-reader';
import { GenericInstrument } from '../../instruments/generic-instrument';
import { GenericScore } from '../../sound-objects/generic-score';
import { AudioFile } from '../../sound-objects/audio-file';
import { AudioClip } from '../audio/audio-clip';
import { TimeDuration } from '../../time/time-duration';
import { TimePosition } from '../../time/time-position';
import { Track } from './track';
import '../../sound-objects/register-sound-object-types';

function createScore(name: string, start: number): GenericScore {
  const score = new GenericScore();
  score.setName(name);
  score.setScoreText('i1 0 1 60');
  score.setStartTime(TimePosition.beats(start));
  score.setSubjectiveDuration(TimeDuration.beats(1));
  return score;
}

describe('Track', () => {
  it('preserves mixed item order and owns deep copies', () => {
    const track = new Track();
    track.setUniqueId('track-a');
    track.setName('Mixed');
    track.setInstrument(new GenericInstrument());
    track.getAutomationParameters().addParameterId('gain');
    const chain = new NoteProcessorChain();
    chain.addProcessor(new AddProcessor());
    track.setNoteProcessorChain(chain);

    const clip = new AudioClip();
    clip.setAudioFile('/tmp/a.wav');
    clip.setStartTime(TimePosition.beats(0));
    clip.setSubjectiveDuration(TimeDuration.beats(1));
    const score = createScore('Score', 1);
    track.push(clip, score);

    const copy = track.deepCopy();
    expect(copy.getUniqueId()).toBe('track-a');
    expect(copy.map((item) => item.constructor.name)).toEqual(['AudioClip', 'GenericScore']);
    expect(copy[0]).not.toBe(clip);
    expect(copy[1]).not.toBe(score);
    expect(copy.getInstrument()).not.toBe(track.getInstrument());
    expect(copy.getNoteProcessorChain()).not.toBe(track.getNoteProcessorChain());
    expect(copy.getAutomationParameters().getIds()).toEqual(['gain']);
  });

  it('round-trips canonical XML with a single optional instrument and mixed children', () => {
    const track = new Track();
    track.setUniqueId('track-roundtrip');
    track.setName('Round Trip');
    track.setMuted(true);
    track.setSolo(true);
    track.setHeightIndex(3);
    track.setInstrument(new GenericInstrument());
    track.getAutomationParameters().addParameterId('cutoff');
    track.push(createScore('Nested', 0));

    const xml = track.saveAsXML().toXml();
    const loaded = Track.loadFromXML(Element.parse(xml));
    expect(loaded.getUniqueId()).toBe('track-roundtrip');
    expect(loaded.getName()).toBe('Round Trip');
    expect(loaded.isMuted()).toBe(true);
    expect(loaded.isSolo()).toBe(true);
    expect(loaded.getHeightIndex()).toBe(3);
    expect(loaded.getInstrument()).not.toBeNull();
    expect(loaded.getAutomationParameters().getIds()).toEqual(['cutoff']);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].constructor.name).toBe('GenericScore');
    expect(xml).toContain('<track ');
    expect(xml).not.toContain('audioLayer');
  });

  it('rejects incompatible sound objects while accepting AudioClip', () => {
    const track = new Track();
    expect(track.accepts(new AudioFile())).toBe(false);
    expect(track.accepts(new AudioClip())).toBe(true);
  });
});
