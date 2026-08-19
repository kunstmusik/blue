import algo01 from './algo01.gif';
import algo02 from './algo02.gif';
import algo03 from './algo03.gif';
import algo04 from './algo04.gif';
import algo05 from './algo05.gif';
import algo06 from './algo06.gif';
import algo07 from './algo07.gif';
import algo08 from './algo08.gif';
import algo09 from './algo09.gif';
import algo10 from './algo10.gif';
import algo11 from './algo11.gif';
import algo12 from './algo12.gif';
import algo13 from './algo13.gif';
import algo14 from './algo14.gif';
import algo15 from './algo15.gif';
import algo16 from './algo16.gif';
import algo17 from './algo17.gif';
import algo18 from './algo18.gif';
import algo19 from './algo19.gif';
import algo20 from './algo20.gif';
import algo21 from './algo21.gif';
import algo22 from './algo22.gif';
import algo23 from './algo23.gif';
import algo24 from './algo24.gif';
import algo25 from './algo25.gif';
import algo26 from './algo26.gif';
import algo27 from './algo27.gif';
import algo28 from './algo28.gif';
import algo29 from './algo29.gif';
import algo30 from './algo30.gif';
import algo31 from './algo31.gif';
import algo32 from './algo32.gif';

export const ALGORITHM_IMAGES: Record<number, string> = {
  1: algo01,
  2: algo02,
  3: algo03,
  4: algo04,
  5: algo05,
  6: algo06,
  7: algo07,
  8: algo08,
  9: algo09,
  10: algo10,
  11: algo11,
  12: algo12,
  13: algo13,
  14: algo14,
  15: algo15,
  16: algo16,
  17: algo17,
  18: algo18,
  19: algo19,
  20: algo20,
  21: algo21,
  22: algo22,
  23: algo23,
  24: algo24,
  25: algo25,
  26: algo26,
  27: algo27,
  28: algo28,
  29: algo29,
  30: algo30,
  31: algo31,
  32: algo32,
};

export function getAlgorithmImage(algorithm: number): string | undefined {
  return ALGORITHM_IMAGES[algorithm];
}
