import { describe, expect, it } from 'vitest';
import { AudioFile } from './audio-file';
import { BlueData } from '../blue-data';
import { PolyObject } from './poly-object';
import { TimePosition } from '../time/time-position';
import { TimeDuration } from '../time/time-duration';
import { TimeContext } from '../time/time-context';
import { CompileData } from '../compile-data';

describe('AudioFile CSD generation', () => {
  it('generates a GenericInstrument and single i-statement note', () => {
    const af = new AudioFile();
    af.setName('Snare Hit');
    af.setSoundFileName('samples/snare.wav');
    af.setCsoundPostCode('outs aChannel1, aChannel2');
    af.setStartTime(TimePosition.beats(2));
    af.setSubjectiveDuration(TimeDuration.beats(4));

    const compileData = CompileData.createEmptyCompileData();
    const context = new TimeContext();
    const notes = af.generateForCSD(context, compileData, 0, -1);

    expect(compileData.getArrangement().getArrangement()).toHaveLength(1);
    const instr = compileData.getArrangement().getArrangement()[0]?.instr as any;
    expect(instr.getName()).toBe('Snare Hit');
    expect(instr.getText()).toContain('aChannel1, aChannel2\tdiskin2\t"samples/snare.wav", 1, p4');
    expect(instr.getText()).toContain('outs aChannel1, aChannel2');

    expect(notes.length).toBe(1);
    const note = notes.getNote(0);
    expect(note.getPField(1)).toBe('1');
    expect(note.getStartTime()).toBe(2);
    expect(note.getSubjectiveDuration()).toBe(4);
    expect(note.getPField(4)).toBe('0');
  });

  it('compiles cleanly in BlueData.toCSD() without duplicate chnexport or globalOrc corruption', () => {
    const data = new BlueData();
    const af = new AudioFile();
    af.setName('Loop');
    af.setSoundFileName('audio/loop.wav');
    af.setCsoundPostCode('outs aChannel1, aChannel1');
    af.setStartTime(TimePosition.beats(0));
    af.setSubjectiveDuration(TimeDuration.beats(8));

    (data.getScore()[0] as PolyObject)[0].push(af);

    const csd = data.toCSD();

    // Check that diskin2 instrument is generated in the orchestra
    expect(csd).toContain('aChannel1\tdiskin2\t"audio/loop.wav", 1, p4');
    expect(csd).toContain('outs aChannel1, aChannel1');

    // Check that note is in the score
    expect(csd).toMatch(/i1\s+0\.0\s+8\s+0/);

    // Check that chnexport appears only once per parameter in instr 0
    const chnexportMatches = [...csd.matchAll(/gk_blue_auto0 chnexport "gk_blue_auto0", 3/g)];
    expect(chnexportMatches.length).toBe(1);

    // Ensure no invalid "FILE_INSTR" placeholder appears anywhere
    expect(csd).not.toContain('FILE_INSTR');
  });

  it('normalizes Windows paths at the Csound string boundary', () => {
    const af = new AudioFile();
    af.setSoundFileName(String.raw`C:\Users\artist\audio files\snare.wav`);
    af.setCsoundPostCode('outs aChannel1, aChannel1');

    const instrument = af.generateInstrument();

    expect(instrument?.getText()).toContain('"C:/Users/artist/audio files/snare.wav", 1, p4');
  });
});
