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

// ─── Optimized vs pruning-disabled render comparison ───

/**
 * Spec 111: optimized and unoptimized disk renders of the same project must
 * differ by no more than this peak residual. Pruning must be inaudible.
 */
export const PRUNE_COMPARISON_PEAK_RESIDUAL_DBFS = -120;

export interface RenderAudioComparison {
  readonly sampleCountsMatch: boolean;
  readonly expectedSampleCount: number;
  readonly actualSampleCount: number;
  /** Peak |a-b| in dBFS; -Infinity for identical buffers. */
  readonly peakResidualDbfs: number;
  readonly withinThreshold: boolean;
}

function toFloat32(samples: ReadonlyArray<number> | Float32Array): Float32Array {
  return samples instanceof Float32Array ? samples : Float32Array.from(samples);
}

export function compareRenderAudio(
  expected: ReadonlyArray<number> | Float32Array,
  actual: ReadonlyArray<number> | Float32Array,
  thresholdDbfs: number = PRUNE_COMPARISON_PEAK_RESIDUAL_DBFS,
): RenderAudioComparison {
  const a = toFloat32(expected);
  const b = toFloat32(actual);
  let peak = 0;
  const min = Math.min(a.length, b.length);
  for (let i = 0; i < min; i++) {
    const delta = Math.abs(a[i] - b[i]);
    if (delta > peak) peak = delta;
  }
  // Length mismatches are reported, not folded into the residual.
  if (a.length !== b.length) peak = Math.max(peak, 1);
  const peakResidualDbfs = peak === 0 ? Number.NEGATIVE_INFINITY : 20 * Math.log10(peak);
  return {
    sampleCountsMatch: a.length === b.length,
    expectedSampleCount: a.length,
    actualSampleCount: b.length,
    peakResidualDbfs,
    withinThreshold: peakResidualDbfs <= thresholdDbfs,
  };
}

/**
 * Asserts the optimized render is audibly identical to the unoptimized
 * reference: identical sample counts (duration preserved) and residual at or
 * below `thresholdDbfs`.
 */
export function assertEquivalentRenderAudio(
  expected: ReadonlyArray<number> | Float32Array,
  actual: ReadonlyArray<number> | Float32Array,
  thresholdDbfs: number = PRUNE_COMPARISON_PEAK_RESIDUAL_DBFS,
): RenderAudioComparison {
  const comparison = compareRenderAudio(expected, actual, thresholdDbfs);
  if (!comparison.sampleCountsMatch) {
    throw new Error(
      `Render sample counts differ: expected ${comparison.expectedSampleCount}, ` +
        `actual ${comparison.actualSampleCount}`,
    );
  }
  if (!comparison.withinThreshold) {
    throw new Error(
      `Render peak residual ${comparison.peakResidualDbfs.toFixed(2)} dBFS exceeds ` +
        `${thresholdDbfs} dBFS threshold`,
    );
  }
  return comparison;
}
