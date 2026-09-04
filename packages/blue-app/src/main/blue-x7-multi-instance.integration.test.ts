import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createBlueX7MultiInstanceFixture } from '../shared/blue-x7-multi-instance-test-utils';

const hasCsound = (() => {
  try {
    execFileSync('csound', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

function wavDataOffset(buffer: Buffer): number {
  let position = 12;
  while (position + 8 <= buffer.length) {
    const id = buffer.toString('ascii', position, position + 4);
    const size = buffer.readUInt32LE(position + 4);
    if (id === 'data') return position + 8;
    position += 8 + size + (size % 2);
  }
  throw new Error('Rendered WAV has no data chunk');
}

describe.skipIf(!hasCsound)('BlueX7 four-owner stress integration', () => {
  it('renders 32 notes over 60 seconds with 600 isolated edits and finite bounded output', () => {
    const fixture = createBlueX7MultiInstanceFixture();
    expect(fixture.owners).toHaveLength(4);
    expect(
      fixture.owners.reduce((count, owner) => count + owner.noteText.split('\n').length, 0),
    ).toBe(32);

    const initialOtherValues = fixture.owners.map((owner) =>
      owner.instrument
        .getParameters()
        .find((parameter) => parameter.getName() === 'lfo.speed')!
        .getFixedValue(),
    );
    const latencies: number[] = [];
    for (let index = 0; index < 600; index += 1) {
      const ownerIndex = index % fixture.owners.length;
      const started = performance.now();
      expect(fixture.owners[ownerIndex]!.instrument.applyFixedValue('lfo.speed', index % 100)).toBe(
        true,
      );
      latencies.push(performance.now() - started);
      fixture.owners.forEach((owner, candidateIndex) => {
        if (candidateIndex === ownerIndex) return;
        const value = owner.instrument
          .getParameters()
          .find((parameter) => parameter.getName() === 'lfo.speed')!
          .getFixedValue();
        const candidateLastEdit = [...Array(index + 1).keys()]
          .reverse()
          .find((editIndex) => editIndex % fixture.owners.length === candidateIndex);
        const expected =
          candidateLastEdit === undefined
            ? initialOtherValues[candidateIndex]
            : candidateLastEdit % 100;
        expect(value).toBe(expected);
      });
    }
    latencies.sort((left, right) => left - right);
    expect(latencies[Math.floor(latencies.length * 0.95)]!).toBeLessThan(100);

    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'blue-x7-four-owner-'));
    const csdPath = path.join(scratch, 'four-owner.csd');
    const wavPath = path.join(scratch, 'four-owner.wav');
    // Keep ten seconds after the 60-second scenario so the module's bounded
    // release tail must finish before the final-second stuck-note check.
    fixture.data.setRenderEndTime(70);
    fs.writeFileSync(csdPath, fixture.data.toCSD(), 'utf8');
    expect(() =>
      execFileSync(
        'csound',
        ['-nd', '-W', '--0dbfs=1', '--format=double', '-o', wavPath, csdPath],
        { cwd: scratch, stdio: ['ignore', 'pipe', 'pipe'] },
      ),
    ).not.toThrow();

    const wav = fs.readFileSync(wavPath);
    const dataOffset = wavDataOffset(wav);
    let peak = 0;
    let finalSecondPeak = 0;
    const sampleFrames = Math.floor((wav.length - dataOffset) / 16);
    for (let frame = 0; frame < sampleFrames; frame += 1) {
      for (let channel = 0; channel < 2; channel += 1) {
        const sample = wav.readDoubleLE(dataOffset + frame * 16 + channel * 8);
        expect(Number.isFinite(sample)).toBe(true);
        peak = Math.max(peak, Math.abs(sample));
        if (frame >= sampleFrames - 44100) {
          finalSecondPeak = Math.max(finalSecondPeak, Math.abs(sample));
        }
      }
    }
    expect(peak).toBeGreaterThan(0.001);
    expect(peak).toBeLessThanOrEqual(1);
    expect(finalSecondPeak).toBeLessThan(1e-6);
  }, 180_000);
});
