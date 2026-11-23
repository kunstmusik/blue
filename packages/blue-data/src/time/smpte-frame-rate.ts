/**
 * SmpteFrameRate — SMPTE frame rates.
 * Mirrors the Java SmpteFrameRate enum.
 */
export enum SmpteFrameRate {
  /** 24 frames per second with sequential labels. */
  FPS_24 = 24,
  /** 25 frames per second with sequential labels. */
  FPS_25 = 25,
  /** 30000/1001 frames per second with non-drop numbering. */
  FPS_29_97 = 29.97,
  /** 30 frames per second with non-drop numbering. */
  FPS_30 = 30,
  /** 30000/1001 frames per second with drop-frame numbering. */
  FPS_29_97_DF = '29.97df',
  /** Legacy token. Loading normalizes it to the 30 fps rate. */
  FPS_30_DF = '30df',
}
