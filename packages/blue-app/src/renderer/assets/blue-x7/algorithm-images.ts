import algo01 from './algo01.svg';
import algo02 from './algo02.svg';
import algo03 from './algo03.svg';
import algo04 from './algo04.svg';
import algo05 from './algo05.svg';
import algo06 from './algo06.svg';
import algo07 from './algo07.svg';
import algo08 from './algo08.svg';
import algo09 from './algo09.svg';
import algo10 from './algo10.svg';
import algo11 from './algo11.svg';
import algo12 from './algo12.svg';
import algo13 from './algo13.svg';
import algo14 from './algo14.svg';
import algo15 from './algo15.svg';
import algo16 from './algo16.svg';
import algo17 from './algo17.svg';
import algo18 from './algo18.svg';
import algo19 from './algo19.svg';
import algo20 from './algo20.svg';
import algo21 from './algo21.svg';
import algo22 from './algo22.svg';
import algo23 from './algo23.svg';
import algo24 from './algo24.svg';
import algo25 from './algo25.svg';
import algo26 from './algo26.svg';
import algo27 from './algo27.svg';
import algo28 from './algo28.svg';
import algo29 from './algo29.svg';
import algo30 from './algo30.svg';
import algo31 from './algo31.svg';
import algo32 from './algo32.svg';

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
