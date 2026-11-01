import { describe, expect, it } from 'vitest';
import { BlueX7 } from './instruments/blue-x7';
import { OpcodeDefinition } from './opcodes/opcode-definition';
import { createTrackFixture } from './score/track/track-test-fixtures';
import { LineObject } from './sound-objects/line-object';
import { Sound } from './sound-objects/sound';
import { TimeDuration } from './time/time-duration';

describe('score-generated CSD resources', () => {
  it('includes Sound UDOs and LineObject tables beside BlueX7 instruments', async () => {
    const { data, track } = createTrackFixture({ includeClip: false, includeSoundObject: false });
    data.getMixer().setPanningEnabled(false);
    data.getArrangement().addInstrument(new BlueX7(), '1');
    data.getGlobalOrcSco().setGlobalOrc('gi_reserved ftgen 1, 0, 1024, 10, 1');
    const sound = new Sound();
    sound.setSubjectiveDuration(TimeDuration.beats(1));
    const bsb = sound.getBlueSynthBuilder();
    bsb.setInstrumentText('aout embeddedTone\nblueMixerOut aout, aout');
    const opcode = new OpcodeDefinition();
    opcode.setName('embeddedTone');
    opcode.setOutTypes('a');
    opcode.setInTypes('0');
    opcode.setCode('aout oscili 0.1, 440\nxout aout');
    bsb.getOpcodeList().addOpcode(opcode);
    track.push(sound);
    const line = new LineObject();
    line.setSubjectiveDuration(TimeDuration.beats(1));
    line.addLine({
      varName: 'line',
      color: -8355712,
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
    });
    track.push(line);
    const sourceXml = data.saveToString();

    for (const [sync, asyncRender] of [
      [data.toCSD(), await data.toCSDAsync()],
      [data.toDiskCSD(), await data.toDiskCSDAsync()],
    ]) {
      expect(asyncRender).toBe(sync);
      expect(sync).toMatch(/opcode embeddedTone,\s*a,\s*0/);
      expect(sync.match(/opcode embeddedTone,/g)).toHaveLength(1);
      const table = sync.match(/^f(\d+) 0 16384 -7 0 16384 1$/m);
      expect(table).not.toBeNull();
      expect(sync).toMatch(new RegExp(`^i3\\s+0\\.0\\s+1\\s+0\\s+1\\s+${table![1]}$`, 'm'));
      expect(Number(table![1])).toBeGreaterThan(1);
    }
    expect(data.saveToString()).toBe(sourceXml);
  });
});
