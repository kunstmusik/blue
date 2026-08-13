import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type {
  SoundFontInfo,
  SoundFontInstrumentInfo,
  SoundFontPresetInfo,
} from '../shared/soundfont-viewer';

// SoundFont metadata comes from Csound's text-emitting sfilist/sfplist opcodes.
// SoundFont inspection runs through the main-owned Blue Engine performance seam;
// no caller-selected Csound executable crosses this module boundary.

export interface SoundFontExecutionResult {
  exitCode: number;
  stderr: string;
  stdout?: string;
}

export interface SoundFontExecutionSeam {
  runCsound(
    args: string[],
    cwd: string,
  ): Promise<SoundFontExecutionResult & { cancelled?: boolean }>;
}

const SOUND_FONT_PROBE_CSD = `<CsoundSynthesizer>
<CsInstruments>
sr = 44100
kr = 441
ksmps = 100
nchnls = 2
gi_sf sfload "$filename"
sfilist gi_sf
sfplist gi_sf
instr 1
endin
</CsInstruments>
<CsScore>
e
</CsScore>
</CsoundSynthesizer>`;

function normalizeSoundFontPath(filePath: string): string {
  return filePath.replaceAll('\\', '/').replaceAll('"', '\\"');
}

function isSoundFontFile(filePath: string): boolean {
  return path.extname(filePath).toLowerCase() === '.sf2';
}

export function buildSoundFontProbeCsd(filePath: string): string {
  return SOUND_FONT_PROBE_CSD.replace('$filename', normalizeSoundFontPath(filePath));
}

export function parseSoundFontOutput(output: string): Pick<SoundFontInfo, 'instruments' | 'presets'> {
  const instruments: SoundFontInstrumentInfo[] = [];
  const presets: SoundFontPresetInfo[] = [];
  let section: 'instrument' | 'preset' | null = null;

  for (const line of output.replaceAll('\r', '').split('\n')) {
    if (/^\s*Instrument list\b/u.test(line)) {
      section = 'instrument';
      continue;
    }
    if (/^\s*Preset list\b/u.test(line)) {
      section = 'preset';
      continue;
    }

    if (section === 'instrument') {
      const match = /^\s*(\d+)\)\s*(.*?)\s*$/u.exec(line);
      if (match) {
        instruments.push({ number: Number(match[1]), name: match[2] ?? '' });
      }
      continue;
    }

    if (section === 'preset') {
      const match = /^\s*(\d+)\)\s*(.*?)\s+prog\s*:\s*(\d+)\s+bank\s*:\s*(\d+)\s*$/u.exec(line);
      if (match) {
        presets.push({
          number: Number(match[1]),
          name: match[2] ?? '',
          presetNumber: Number(match[3]),
          bank: Number(match[4]),
        });
      }
    }
  }

  return { instruments, presets };
}

function formatExecutionError(result: SoundFontExecutionResult): string {
  const detail = [result.stderr, result.stdout ?? '']
    .map((text) => text.trim())
    .filter((text) => text.length > 0)
    .join('\n')
    .slice(0, 4000);
  return `Csound exited with code ${result.exitCode}.${detail ? ` ${detail}` : ''}`;
}

export async function inspectSoundFont(
  filePath: string,
  executionSeam: SoundFontExecutionSeam,
  temporaryDirectory: string = os.tmpdir(),
): Promise<SoundFontInfo> {
  const resolvedFilePath = path.resolve(filePath);
  if (!isSoundFontFile(resolvedFilePath)) {
    throw new Error('SoundFont Viewer accepts .sf2 files only.');
  }

  const fileStat = await fs.promises.stat(resolvedFilePath);
  if (!fileStat.isFile()) {
    throw new Error('The selected SoundFont is not a file.');
  }

  const tempDirectory = await fs.promises.mkdtemp(
    path.join(temporaryDirectory, 'blue-soundfont-'),
  );
  const csdPath = path.join(tempDirectory, 'probe.csd');

  try {
    await fs.promises.writeFile(csdPath, buildSoundFontProbeCsd(resolvedFilePath), 'utf-8');
    const result = await executionSeam.runCsound(['-n', csdPath], tempDirectory);
    if (result.cancelled) {
      throw new Error('SoundFont inspection cancelled.');
    }
    if (result.exitCode !== 0) {
      throw new Error(formatExecutionError(result));
    }

    return {
      filePath: resolvedFilePath,
      ...parseSoundFontOutput(`${result.stdout ?? ''}\n${result.stderr}`),
    };
  } finally {
    await fs.promises.rm(tempDirectory, { recursive: true, force: true });
  }
}
