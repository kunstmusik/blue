/** Original counting arithmetic from SMPTE ST 12-1:2014 §§4.9, 5.2.1–5.2.2.
 * https://pub.smpte.org/latest/st12-1/st0012-1-2014.pdf
 * Independent derivation: specs/115-smpte-timecode/public-calculation-basis.md.
 * No third-party conversion source was adapted. Hours are elapsed, without wrap.
 */
export interface SmpteFormat {
  frameRate: number;
  dropFrame: boolean;
}

const rates: Readonly<
  Record<number, Readonly<{ numerator: number; denominator: number; nominal: number }>>
> = {
  23.976: { numerator: 24000, denominator: 1001, nominal: 24 },
  24: { numerator: 24, denominator: 1, nominal: 24 },
  25: { numerator: 25, denominator: 1, nominal: 25 },
  29.97: { numerator: 30000, denominator: 1001, nominal: 30 },
  30: { numerator: 30, denominator: 1, nominal: 30 },
  50: { numerator: 50, denominator: 1, nominal: 50 },
  59.94: { numerator: 60000, denominator: 1001, nominal: 60 },
  60: { numerator: 60, denominator: 1, nominal: 60 },
};
const MAX_FRAME = Math.floor(Number.MAX_SAFE_INTEGER / 1001);

export function resolveSmpteRate(rate: number) {
  return typeof rate === 'number' ? (rates[rate] ?? null) : null;
}
export function isValidSmpteFormat(rate: number, dropFrame: boolean): boolean {
  return (
    resolveSmpteRate(rate) !== null &&
    typeof dropFrame === 'boolean' &&
    (!dropFrame || rate === 29.97 || rate === 59.94)
  );
}
function validFrame(frame: number): boolean {
  return Number.isSafeInteger(frame) && frame >= 0 && frame <= MAX_FRAME;
}
export function secondsToSmpteFrame(
  seconds: number,
  rate: number,
  operation: 'floor' | 'nearest' = 'floor',
): number | null {
  const descriptor = resolveSmpteRate(rate);
  if (!descriptor || !Number.isFinite(seconds) || seconds < 0) return null;
  let coordinate = (seconds * descriptor.numerator) / descriptor.denominator;
  const nearest = Math.round(coordinate);
  if (Math.abs(coordinate - nearest) <= 8 * Number.EPSILON * Math.max(1, Math.abs(coordinate)))
    coordinate = nearest;
  const frame = operation === 'nearest' ? Math.round(coordinate) : Math.floor(coordinate);
  return validFrame(frame) ? frame : null;
}
export function smpteFrameToSeconds(frame: number, rate: number): number | null {
  const descriptor = resolveSmpteRate(rate);
  return descriptor && validFrame(frame)
    ? (frame * descriptor.denominator) / descriptor.numerator
    : null;
}
export function formatSmpte(seconds: number, format: SmpteFormat): string | null {
  if (!isValidSmpteFormat(format.frameRate, format.dropFrame)) return null;
  const frame = secondsToSmpteFrame(seconds, format.frameRate);
  if (frame === null) return null;
  const nominal = rates[format.frameRate].nominal;
  let label = frame;
  if (format.dropFrame) {
    const omitted = nominal / 15;
    const firstMinute = 60 * nominal;
    const shortMinute = firstMinute - omitted;
    const block = firstMinute + 9 * shortMinute;
    const remainder = frame % block;
    const minutes =
      remainder < firstMinute ? 0 : 1 + Math.floor((remainder - firstMinute) / shortMinute);
    label += Math.floor(frame / block) * 9 * omitted + minutes * omitted;
  }
  const fields = [
    Math.floor(label / (nominal * 3600)),
    Math.floor(label / (nominal * 60)) % 60,
    Math.floor(label / nominal) % 60,
    label % nominal,
  ].map((value) => String(value).padStart(2, '0'));
  return `${fields[0]}:${fields[1]}:${fields[2]}${format.dropFrame ? ';' : ':'}${fields[3]}`;
}
export function parseSmpte(text: string, format: SmpteFormat): number | null {
  if (!isValidSmpteFormat(format.frameRate, format.dropFrame)) return null;
  const match = /^(\d+):(\d{1,2}):(\d{1,2})([:;])(\d{1,2})$/.exec(text.trim());
  if (!match || match[4] !== (format.dropFrame ? ';' : ':')) return null;
  const [hours, minutes, seconds, frames] = [match[1], match[2], match[3], match[5]].map(Number);
  const nominal = rates[format.frameRate].nominal;
  if (!Number.isSafeInteger(hours) || minutes > 59 || seconds > 59 || frames >= nominal)
    return null;
  const totalMinutes = hours * 60 + minutes;
  let frame = (totalMinutes * 60 + seconds) * nominal + frames;
  if (!Number.isSafeInteger(frame)) return null;
  if (format.dropFrame) {
    const omitted = nominal / 15;
    if (minutes % 10 !== 0 && seconds === 0 && frames < omitted) return null;
    frame -= omitted * (totalMinutes - Math.floor(totalMinutes / 10));
  }
  return smpteFrameToSeconds(frame, format.frameRate);
}
