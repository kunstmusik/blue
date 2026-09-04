import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildSoundFontProbeCsd, inspectSoundFont, parseSoundFontOutput } from './soundfont-viewer';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('SoundFont Viewer Csound utility', () => {
  it('builds a probe CSD with a normalized and quoted SoundFont path', () => {
    const csd = buildSoundFontProbeCsd('C:\\Sound Fonts\\"Grand Piano".sf2');

    expect(csd).toContain('gi_sf sfload "C:/Sound Fonts/\\"Grand Piano\\".sf2"');
    expect(csd).toContain('sfilist gi_sf');
    expect(csd).toContain('sfplist gi_sf');
    expect(csd).toContain('<CsScore>\ne\n</CsScore>');
  });

  it('parses Csound instrument and preset sections', () => {
    const parsed = parseSoundFontOutput(`
Instrument list of "piano.sf2"
  0) Piano 1
 12) Warm Pad
Preset list of "piano.sf2"
  0) Piano 1             prog:0   bank:0
  1) Warm Pad            prog:89  bank:3
`);

    expect(parsed).toEqual({
      instruments: [
        { number: 0, name: 'Piano 1' },
        { number: 12, name: 'Warm Pad' },
      ],
      presets: [
        { number: 0, name: 'Piano 1', presetNumber: 0, bank: 0 },
        { number: 1, name: 'Warm Pad', presetNumber: 89, bank: 3 },
      ],
    });
  });

  it('runs through the injected Csound seam and removes the temporary probe', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blue-soundfont-probe-test-'));
    temporaryDirectories.push(root);
    const filePath = path.join(root, 'test.sf2');
    fs.writeFileSync(filePath, 'not a real soundfont');
    const runCsound = vi.fn(async (args: string[], cwd: string) => {
      expect(args[0]).toBe('-n');
      expect(cwd).toMatch(/blue-soundfont-/u);
      const csd = fs.readFileSync(args[1]!, 'utf-8');
      // buildSoundFontProbeCsd normalizes backslashes to forward slashes so the
      // sfload path is valid for Csound on every platform; mirror that here.
      const normalizedFilePath = filePath.replaceAll('\\', '/');
      expect(csd).toContain(`sfload "${normalizedFilePath}"`);
      return {
        exitCode: 0,
        stdout:
          'Instrument list of "test.sf2"\n  0) Piano\nPreset list of "test.sf2"\n  0) Piano prog:0 bank:0\n',
        stderr: '',
      };
    });

    await expect(inspectSoundFont(filePath, { runCsound }, root)).resolves.toEqual({
      filePath,
      instruments: [{ number: 0, name: 'Piano' }],
      presets: [{ number: 0, name: 'Piano', presetNumber: 0, bank: 0 }],
    });
    expect(runCsound).toHaveBeenCalledWith(
      expect.any(Array),
      expect.stringContaining('blue-soundfont-'),
    );
    expect(fs.readdirSync(root)).toEqual(['test.sf2']);
  });
});
