import { Scale } from '../sound-objects/piano-roll/scale';

/**
 * Original implementation of the Scala interval format.
 * https://www.huygens-fokker.org/scala/scl_format.html
 */
export function parseScalaScale(text: string): Scale {
  const records = text
    .replace(/^\uFEFF/, '')
    .split(/\r\n?|\n/)
    .filter((line) => !line.trimStart().startsWith('!'));
  const description = records.shift() ?? '';
  const size = records.shift()?.trim() ?? '';
  const count = Number(size);
  if (!/^\d+$/.test(size) || !Number.isSafeInteger(count) || count > records.length) {
    throw new Error('Invalid Scala interval count.');
  }
  const intervals = records.slice(0, count).map((record) => {
    const token = record.trim().split(/\s+/)[0]!;
    let ratio: number;
    if (token.includes('.')) {
      if (!/^[+-]?(?:\d+\.\d*|\.\d+)$/.test(token)) throw new Error('Invalid Scala cents.');
      ratio = 2 ** (Number(token) / 1200);
    } else {
      const parts = /^(\d+)(?:\/(\d+))?$/.exec(token);
      if (!parts) throw new Error('Invalid Scala ratio.');
      const numerator = Number(parts[1]);
      const denominator = Number(parts[2] ?? 1);
      if (
        !Number.isSafeInteger(numerator) ||
        !Number.isSafeInteger(denominator) ||
        numerator <= 0 ||
        denominator <= 0
      ) {
        throw new Error('Invalid Scala ratio.');
      }
      ratio = numerator / denominator;
    }
    if (!Number.isFinite(ratio) || ratio <= 0) throw new Error('Invalid Scala interval.');
    return ratio;
  });
  const scale = new Scale();
  scale.scaleName = description;
  scale.octave = intervals.pop() ?? 1;
  scale.ratios = [1, ...intervals];
  return Scale.loadFromXML(scale.saveAsXML());
}
