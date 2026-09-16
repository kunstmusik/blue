// Type shim: the app's classic module resolution cannot read the
// `./test-support` subpath export of @blue/data (the runtime and Vitest can).
// Keep in sync with packages/blue-data/src/test-support/csd-render-fixtures.ts.
declare module '@blue/data/test-support' {
  export interface DecodedWav {
    readonly sampleRate: number;
    readonly channels: number;
    readonly bitsPerSample: number;
    readonly isFloat: boolean;
    readonly samples: Float64Array;
  }
  export function decodeWavBuffer(buffer: Uint8Array): DecodedWav;
  export function decodeWavFile(filePath: string): DecodedWav;
  export function peakResidualDbfs(a: Float64Array, b: Float64Array): number;
  export function compareRenderAudio(
    expected: ReadonlyArray<number> | Float32Array,
    actual: ReadonlyArray<number> | Float32Array,
    thresholdDbfs?: number,
  ): {
    sampleCountsMatch: boolean;
    expectedSampleCount: number;
    actualSampleCount: number;
    peakResidualDbfs: number;
    withinThreshold: boolean;
  };
  export function assertEquivalentRenderAudio(
    expected: ReadonlyArray<number> | Float32Array,
    actual: ReadonlyArray<number> | Float32Array,
    thresholdDbfs?: number,
  ): {
    sampleCountsMatch: boolean;
    expectedSampleCount: number;
    actualSampleCount: number;
    peakResidualDbfs: number;
    withinThreshold: boolean;
  };
}
