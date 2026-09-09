import * as fs from 'fs';

export const DEMO2026_BLUE_PATH = '/Users/stevenyi/work/blue/demo2026/01.blue';
export const DEMO2026_CSD_PATH = '/Users/stevenyi/work/blue/demo2026/01.csd';
export const RHYTHMIC_BLUE_PATH = '/Users/stevenyi/work/blue/rhythmic/01.blue';
export const RHYTHMIC_DISK_CSD_PATH = '/Users/stevenyi/work/blue/rhythmic/01_disk.csd';

export function hasDemo2026Fixture(): boolean {
  return fs.existsSync(DEMO2026_BLUE_PATH) && fs.existsSync(DEMO2026_CSD_PATH);
}

export function hasRhythmicFixture(): boolean {
  return fs.existsSync(RHYTHMIC_BLUE_PATH) && fs.existsSync(RHYTHMIC_DISK_CSD_PATH);
}

export function extractScoreEvents(csd: string): string[] {
  const match = csd.match(/<CsScore>([\s\S]*?)<\/CsScore>/);
  if (!match) {
    throw new Error('CSD is missing a <CsScore> section');
  }

  return match[1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('i'));
}

export function extractInstrumentSequence(scoreEvents: string[]): string[] {
  return scoreEvents.map((line) => {
    const match = line.match(/^i\s*"?([^"\s]+)"?/);
    if (!match) {
      throw new Error(`Unable to parse score event: ${line}`);
    }
    return match[1];
  });
}

export function normalizeWhitespace(line: string): string {
  return line
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((token) => {
      if (/^-?\d+\.0+$/.test(token)) {
        return String(Number.parseInt(token, 10));
      }
      return token;
    })
    .join(' ');
}

export function extractCsdSection(
  csd: string,
  tag: 'CsOptions' | 'CsInstruments' | 'CsScore',
): string {
  const match = csd.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  if (!match) {
    throw new Error(`CSD is missing a <${tag}> section`);
  }
  return match[1];
}
