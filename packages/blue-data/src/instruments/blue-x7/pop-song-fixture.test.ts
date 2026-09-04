import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { BlueData } from '../../blue-data';
import { PianoRoll } from '../../sound-objects/piano-roll';
import { TrackLayerGroup } from '../../score/track/track-layer-group';
import { TimeBase } from '../../time/time-base';
import { buildBlueX7PopSongProject } from './pop-song-fixture';

const repoRoot = path.resolve(__dirname, '../../../../..');
const bluePath = path.join(repoRoot, 'fixtures/blue-x7-pop-song.blue');
const csdPath = path.join(repoRoot, 'fixtures/blue-x7-pop-song.csd');
const regenEnabled = process.env.BLUE_X7_REGEN_FIXTURE === '1';

/**
 * The checked-in pop-song fixture is owned by the generator in
 * pop-song-fixture.ts. This suite regenerates it on demand and always proves
 * the checked-in .blue matches the builder byte-for-byte, so fixture edits
 * must go through the generator (frequency pitch generation, BBF score and
 * object time).
 */
describe('BlueX7 pop-song fixture generator', () => {
  it('builds the project with frequency pitch generation and BBF time', () => {
    const data = buildBlueX7PopSongProject();
    const score = data.getScore();
    expect(score.getTimeState().getTimeDisplay()).toBe(TimeBase.BBF);

    const rolls: PianoRoll[] = [];
    for (const layerGroup of score) {
      if (!(layerGroup instanceof TrackLayerGroup)) continue;
      for (const track of layerGroup) {
        for (const soundObject of track) {
          if (soundObject instanceof PianoRoll) rolls.push(soundObject);
        }
      }
    }
    expect(rolls.length).toBe(12);
    for (const roll of rolls) {
      expect(roll.getPchGenerationMethod(), roll.getName()).toBe(0);
      expect(roll.getNoteTemplate(), roll.getName()).toMatch(
        /^i <INSTR_ID> <START> <DUR> <FREQ> (88|104)$/,
      );
      // Object times are stored as BBF positions/durations, not raw beats.
      expect(roll.getStartTime().getTimeBase(), roll.getName()).toBe(TimeBase.BBF);
      expect(roll.getSubjectiveDuration().getTimeBase(), roll.getName()).toBe(TimeBase.BBF);
      expect(roll.getRepeatPoint()?.getTimeBase(), roll.getName()).toBe(TimeBase.BBF);
      // Frequency generation keeps pch-style octaves (8 = middle C).
      for (const note of roll.getNotes()) {
        expect(note.getOctave()).toBeGreaterThanOrEqual(0);
        expect(note.getOctave()).toBeLessThanOrEqual(10);
      }
    }
    // The Bass track carries its own amp in the template.
    expect(rolls.filter((roll) => roll.getName().startsWith('Bass')).length).toBe(6);
  }, 30_000);

  it('matches the checked-in fixture byte-for-byte (regenerate with BLUE_X7_REGEN_FIXTURE=1)', () => {
    const generated = buildBlueX7PopSongProject().saveToString();

    if (regenEnabled) {
      fs.writeFileSync(bluePath, generated);
      const originalCwd = process.cwd();
      process.chdir(repoRoot);
      try {
        fs.writeFileSync(csdPath, BlueData.loadFromString(generated).toCSD());
      } finally {
        process.chdir(originalCwd);
      }
    }

    const checkedIn = fs.readFileSync(bluePath, 'utf8');
    expect(generated).toBe(checkedIn);

    // The CSD must stay in lockstep with the checked-in .blue.
    const originalCwd = process.cwd();
    process.chdir(repoRoot);
    let csd: string;
    try {
      csd = BlueData.loadFromString(checkedIn).toCSD();
    } finally {
      process.chdir(originalCwd);
    }
    expect(csd).toBe(fs.readFileSync(csdPath, 'utf8'));
    // Frequency generation: p4 carries Hz (middle C = 261.625565), which the
    // BlueX7 target reads through its p4 >= 15 branch.
    expect(csd).toContain('i1\t0.0\t1.5\t261.625565\t88');
  }, 60_000);
});
