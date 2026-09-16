export {
  extractInstrumentSequence,
  extractScoreEvents,
  normalizeWhitespace,
  extractCsdSection,
  compareRenderAudio,
  assertEquivalentRenderAudio,
  PRUNE_COMPARISON_PEAK_RESIDUAL_DBFS,
} from './csd-render-fixtures';
export type { RenderAudioComparison } from './csd-render-fixtures';
export { decodeWavBuffer, decodeWavFile, peakResidualDbfs } from './csd-render-fixtures';
export type { DecodedWav } from './csd-render-fixtures';
