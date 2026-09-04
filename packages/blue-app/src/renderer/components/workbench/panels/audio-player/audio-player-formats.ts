/**
 * Audio File Player supported source formats (SPEC 076 double-click open).
 *
 * Mirrors the browser-decodable extension list used by the main-process
 * open-audio-file dialog filter. This is intentionally broader than the
 * Csound diskin2 source allowlist used for Track audio-layer drops: the
 * player decodes with Chromium, not Csound.
 */
export const AUDIO_FILE_PLAYER_EXTENSIONS: readonly string[] = [
  'wav',
  'wave',
  'aif',
  'aiff',
  'mp3',
  'ogg',
  'oga',
  'flac',
  'au',
  'm4a',
  'w64',
  'opus',
  'weba',
];

/** Case-insensitive final-suffix check; dot-prefixed names never match. */
export function isAudioFilePlayerSourcePath(filePath: string): boolean {
  const dotIndex = filePath.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex === filePath.length - 1) return false;
  const suffix = filePath.slice(dotIndex + 1).toLowerCase();
  return AUDIO_FILE_PLAYER_EXTENSIONS.includes(suffix);
}
