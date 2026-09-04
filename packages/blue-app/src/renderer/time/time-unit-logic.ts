import type { TimeConversionContext, TimeConversionMeterEntry } from '../../shared/project-editor';

export type { TimeConversionContext };

export const DEFAULT_PPQ = 960;

export const TIME_BASE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'BEATS', label: 'Csound Beats' },
  { value: 'BBT', label: 'BBT (Bar.Beat.Ticks)' },
  { value: 'BBST', label: 'BBST (Bar.Beat.16th.Ticks)' },
  { value: 'BBF', label: 'BBF (Bar.Beat.Fraction, hundredths)' },
  { value: 'TIME', label: 'Time (HH:MM:SS.mmm)' },
  { value: 'SECONDS', label: 'Seconds (decimal)' },
  { value: 'SMPTE', label: 'SMPTE (HH:MM:SS:FF)' },
  { value: 'FRAME', label: 'Sample Frames' },
];

export function beatsToSeconds(beats: number, ctx: TimeConversionContext): number {
  if (!ctx.tempoEnabled) return beats;
  return (beats * 60.0) / ctx.initialTempo;
}

export function secondsToBeats(seconds: number, ctx: TimeConversionContext): number {
  if (!ctx.tempoEnabled) return seconds;
  return (seconds * ctx.initialTempo) / 60.0;
}

function beatsPerMeasure(entry: { numBeats: number; beatLength: number }): number {
  return entry.numBeats * (4.0 / entry.beatLength);
}

function beatScale(entry: { numBeats: number; beatLength: number }): number {
  return 4.0 / entry.beatLength;
}

interface MeterEntryInfo {
  entry: TimeConversionMeterEntry;
  startBeat: number;
}

function meterEntryInfoForBeats(beats: number, ctx: TimeConversionContext): MeterEntryInfo | null {
  if (ctx.meterEntries.length === 0 || beats < 0) return null;

  const starts = measureStartBeats(ctx);
  let idx = 0;
  for (let i = ctx.meterEntries.length - 1; i >= 0; i--) {
    if (beats >= starts[i]) {
      idx = i;
      break;
    }
  }

  return {
    entry: ctx.meterEntries[idx],
    startBeat: starts[idx],
  };
}

function meterEntryInfoForBar(bar: number, ctx: TimeConversionContext): MeterEntryInfo | null {
  if (ctx.meterEntries.length === 0 || bar < 1) return null;

  const starts = measureStartBeats(ctx);
  let idx = 0;
  for (let i = ctx.meterEntries.length - 1; i >= 0; i--) {
    if (bar >= ctx.meterEntries[i].measure) {
      idx = i;
      break;
    }
  }

  return {
    entry: ctx.meterEntries[idx],
    startBeat: starts[idx],
  };
}

export function measureStartBeats(ctx: TimeConversionContext): number[] {
  const starts: number[] = [];
  starts[0] = 0;
  for (let i = 1; i < ctx.meterEntries.length; i++) {
    const prev = ctx.meterEntries[i - 1];
    const next = ctx.meterEntries[i];
    starts[i] = starts[i - 1] + (next.measure - prev.measure) * beatsPerMeasure(prev);
  }
  return starts;
}

export function beatsToBBTInternal(
  beats: number,
  ctx: TimeConversionContext,
): { bar: number; beat: number; ticks: number } {
  const entries = ctx.meterEntries;
  if (entries.length === 0 || beats < 0) return { bar: 1, beat: 1, ticks: 0 };

  const starts = measureStartBeats(ctx);
  let idx = 0;
  for (let i = entries.length - 1; i >= 0; i--) {
    if (beats >= starts[i]) {
      idx = i;
      break;
    }
  }

  const entry = entries[idx];
  const bpm = beatsPerMeasure(entry);
  const bs = beatScale(entry);
  const beatsFromEntry = beats - starts[idx];
  const measuresFromEntry = Math.floor(beatsFromEntry / bpm);
  const remaining = beatsFromEntry - measuresFromEntry * bpm;
  const fullBeats = Math.floor(remaining / bs);
  const fractional = remaining - fullBeats * bs;
  let ticks = Math.round((fractional * DEFAULT_PPQ) / bs);
  let beat = fullBeats + 1;
  let bar = entry.measure + measuresFromEntry;

  if (ticks >= DEFAULT_PPQ) {
    ticks = 0;
    beat += 1;
    if (beat > entry.numBeats) {
      beat = 1;
      bar += 1;
    }
  }

  return {
    bar,
    beat,
    ticks,
  };
}

function beatsToBBFInternal(
  beats: number,
  ctx: TimeConversionContext,
): { bar: number; beat: number; fraction: number } {
  const info = meterEntryInfoForBeats(beats, ctx);
  if (!info) return { bar: 1, beat: 1, fraction: 0 };

  const entry = info.entry;
  const bpm = beatsPerMeasure(entry);
  const bs = beatScale(entry);
  const beatsFromEntry = beats - info.startBeat;
  const measuresFromEntry = Math.floor(beatsFromEntry / bpm);
  const remaining = beatsFromEntry - measuresFromEntry * bpm;
  const fullBeats = Math.floor(remaining / bs);
  const fractional = remaining - fullBeats * bs;
  let fraction = Math.round((fractional * 100) / bs);
  let beat = fullBeats + 1;
  let bar = entry.measure + measuresFromEntry;

  if (fraction >= 100) {
    fraction = 0;
    beat += 1;
    if (beat > entry.numBeats) {
      beat = 1;
      bar += 1;
    }
  }

  return { bar, beat, fraction };
}

function durationBeatsToBBF(
  beats: number,
  ctx: TimeConversionContext,
): { bar: number; beat: number; fraction: number } {
  const entry = ctx.meterEntries[0];
  if (!entry || beats < 0) return { bar: 0, beat: 0, fraction: 0 };

  const bpm = beatsPerMeasure(entry);
  const bs = beatScale(entry);
  const bar = Math.floor(beats / bpm);
  const remaining = beats - bar * bpm;
  const beat = Math.floor(remaining / bs);
  const fractional = remaining - beat * bs;
  let fraction = Math.round((fractional * 100) / bs);

  if (fraction >= 100) {
    fraction = 0;
    const nextBeat = beat + 1;
    if (nextBeat >= entry.numBeats) {
      return { bar: bar + 1, beat: 0, fraction };
    }
    return { bar, beat: nextBeat, fraction };
  }

  return { bar, beat, fraction };
}

export function bbtToBeats(
  bar: number,
  beat: number,
  ticks: number,
  ctx: TimeConversionContext,
): number {
  const entries = ctx.meterEntries;
  if (entries.length === 0) return 0;

  const starts = measureStartBeats(ctx);
  let idx = 0;
  for (let i = entries.length - 1; i >= 0; i--) {
    if (bar >= entries[i].measure) {
      idx = i;
      break;
    }
  }

  const entry = entries[idx];
  const bpm = beatsPerMeasure(entry);
  const bs = beatScale(entry);
  const measuresFrom = bar - entry.measure;

  return starts[idx] + measuresFrom * bpm + (beat - 1) * bs + (ticks / DEFAULT_PPQ) * bs;
}

export function formatBeatsValue(beats: number): string {
  const s = beats.toFixed(4);
  return s.replace(/\.?0+$/, '') || '0';
}

export function formatBBT(bar: number, beat: number, ticks: number): string {
  return `${bar}.${beat}.${ticks}`;
}

export function formatBBST(bar: number, beat: number, sixteenth: number, ticks: number): string {
  return `${bar}.${beat}.${sixteenth}.${ticks}`;
}

export function formatBBF(bar: number, beat: number, fraction: number): string {
  return `${bar}.${beat}.${String(fraction).padStart(2, '0')}`;
}

export function formatTime(hours: number, minutes: number, seconds: number, ms: number): string {
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

export function formatSeconds(secs: number): string {
  const s = secs.toFixed(6);
  return s.replace(/\.?0+$/, '') || '0';
}

export function formatSMPTE(secs: number, frameRate: number): string {
  const h = Math.floor(secs / 3600);
  const rem = secs - h * 3600;
  const m = Math.floor(rem / 60);
  const sec = rem - m * 60;
  const s = Math.floor(sec);
  const frames = Math.floor((sec - s) * frameRate);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
}

export function totalSecondsToTime(secs: number): {
  hours: number;
  minutes: number;
  seconds: number;
  ms: number;
} {
  const totalMs = Math.round(secs * 1000);
  const hours = Math.floor(totalMs / 3600000);
  const remaining = totalMs - hours * 3600000;
  const minutes = Math.floor(remaining / 60000);
  const secMs = remaining - minutes * 60000;
  const seconds = Math.floor(secMs / 1000);
  const ms = secMs - seconds * 1000;
  return { hours, minutes, seconds, ms };
}

export function formatForBase(
  beats: number,
  base: string,
  ctx: TimeConversionContext,
  durationMode: boolean,
): string {
  switch (base) {
    case 'BEATS':
      return formatBeatsValue(beats);

    case 'BBT': {
      const bbt = beatsToBBTInternal(beats, ctx);
      if (durationMode) {
        return formatBBT(bbt.bar - 1, bbt.beat - 1, bbt.ticks);
      }
      return formatBBT(bbt.bar, bbt.beat, bbt.ticks);
    }

    case 'BBST': {
      const bbt = beatsToBBTInternal(beats, ctx);
      const sixteenthTicks = DEFAULT_PPQ / 4;
      const sixteenth = Math.floor(bbt.ticks / sixteenthTicks) + 1;
      const ticks = bbt.ticks % sixteenthTicks;
      if (durationMode) {
        return formatBBST(bbt.bar - 1, bbt.beat - 1, Math.max(0, sixteenth - 1), ticks);
      }
      return formatBBST(bbt.bar, bbt.beat, Math.min(sixteenth, 4), ticks);
    }

    case 'BBF': {
      if (ctx.meterEntries.length === 0) {
        return durationMode ? '0.0.00' : '1.1.00';
      }

      if (durationMode) {
        const bbf = durationBeatsToBBF(beats, ctx);
        return formatBBF(bbf.bar, bbf.beat, bbf.fraction);
      }

      const bbf = beatsToBBFInternal(beats, ctx);
      return formatBBF(bbf.bar, bbf.beat, bbf.fraction);
    }

    case 'TIME': {
      const secs = beatsToSeconds(beats, ctx);
      const t = totalSecondsToTime(secs);
      return formatTime(t.hours, t.minutes, t.seconds, t.ms);
    }

    case 'SECONDS':
      return formatSeconds(beatsToSeconds(beats, ctx));

    case 'SMPTE': {
      const secs = beatsToSeconds(beats, ctx);
      return formatSMPTE(secs, 24);
    }

    case 'FRAME': {
      const secs = beatsToSeconds(beats, ctx);
      return String(Math.round(secs * ctx.sampleRate));
    }

    default:
      return formatBeatsValue(beats);
  }
}

export function parseForBase(
  text: string,
  base: string,
  ctx: TimeConversionContext,
  durationMode: boolean,
): number | null {
  try {
    switch (base) {
      case 'BEATS': {
        const v = parseFloat(text);
        if (!isFinite(v) || v < 0) return null;
        return v;
      }

      case 'BBT': {
        const parts = text.split('.');
        if (parts.length < 2 || parts.length > 3) return null;
        const bar = parseInt(parts[0], 10);
        const beat = parseInt(parts[1], 10);
        const ticks = parts.length > 2 ? parseInt(parts[2], 10) : 0;
        if (isNaN(bar) || isNaN(beat) || isNaN(ticks)) return null;
        if (durationMode) {
          return bbtToBeats(bar + 1, beat + 1, ticks, ctx);
        }
        return bbtToBeats(bar, beat, ticks, ctx);
      }

      case 'BBST': {
        const parts = text.split('.');
        if (parts.length < 3 || parts.length > 4) return null;
        const bar = parseInt(parts[0], 10);
        const beat = parseInt(parts[1], 10);
        const sixteenth = parseInt(parts[2], 10);
        const ticks = parts.length > 3 ? parseInt(parts[3], 10) : 0;
        if (isNaN(bar) || isNaN(beat) || isNaN(sixteenth) || isNaN(ticks)) return null;
        const totalTicks = (durationMode ? sixteenth : sixteenth - 1) * (DEFAULT_PPQ / 4) + ticks;
        if (durationMode) {
          return bbtToBeats(bar + 1, beat + 1, totalTicks, ctx);
        }
        return bbtToBeats(bar, beat, totalTicks, ctx);
      }

      case 'BBF': {
        const parts = text.split('.');
        if (parts.length < 2 || parts.length > 3) return null;
        const bar = parseInt(parts[0], 10);
        const beat = parseInt(parts[1], 10);
        const fractionText = parts.length > 2 ? parts[2] : '0';
        if (isNaN(bar) || isNaN(beat)) return null;
        const fraction = parseBbfFraction(fractionText);
        if (!Number.isFinite(fraction)) return null;
        if (durationMode) {
          const entry = ctx.meterEntries[0];
          if (!entry || bar < 0 || beat < 0) return null;
          const bs = beatScale(entry);
          return bar * beatsPerMeasure(entry) + beat * bs + (fraction / 100) * bs;
        }

        const info = meterEntryInfoForBar(bar, ctx);
        if (!info || beat < 1) return null;
        const bs = beatScale(info.entry);
        return (
          info.startBeat +
          (bar - info.entry.measure) * beatsPerMeasure(info.entry) +
          (beat - 1) * bs +
          (fraction / 100) * bs
        );
      }

      case 'TIME': {
        const colonParts = text.split(':');
        const lastPart = colonParts[colonParts.length - 1];
        const dotParts = lastPart.split('.');
        let hours = 0,
          minutes = 0,
          seconds = 0,
          ms = 0;

        if (colonParts.length === 3) {
          hours = parseInt(colonParts[0], 10);
          minutes = parseInt(colonParts[1], 10);
          seconds = parseInt(dotParts[0], 10);
          ms = dotParts.length > 1 ? parseInt(dotParts[1], 10) : 0;
        } else if (colonParts.length === 2) {
          minutes = parseInt(colonParts[0], 10);
          seconds = parseInt(dotParts[0], 10);
          ms = dotParts.length > 1 ? parseInt(dotParts[1], 10) : 0;
        } else {
          return null;
        }
        if (isNaN(hours) || isNaN(minutes) || isNaN(seconds) || isNaN(ms)) return null;
        const totalSecs = hours * 3600 + minutes * 60 + seconds + ms / 1000;
        return secondsToBeats(totalSecs, ctx);
      }

      case 'SECONDS': {
        const v = parseFloat(text);
        if (!isFinite(v) || v < 0) return null;
        return secondsToBeats(v, ctx);
      }

      case 'SMPTE': {
        const parts = text.split(':');
        if (parts.length !== 4) return null;
        const h = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const s = parseInt(parts[2], 10);
        const f = parseInt(parts[3], 10);
        if (isNaN(h) || isNaN(m) || isNaN(s) || isNaN(f)) return null;
        const totalSecs = h * 3600 + m * 60 + s + f / 24;
        return secondsToBeats(totalSecs, ctx);
      }

      case 'FRAME': {
        const v = parseInt(text, 10);
        if (isNaN(v) || v < 0) return null;
        return secondsToBeats(v / ctx.sampleRate, ctx);
      }

      default: {
        const v = parseFloat(text);
        if (!isFinite(v) || v < 0) return null;
        return v;
      }
    }
  } catch {
    return null;
  }
}

function parseBbfFraction(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return 0;
  }

  if (!/^[0-9]+$/.test(trimmed)) {
    return NaN;
  }

  // Java Blue 2.10.2 normalizes any digit string into canonical hundredths.
  // 5 and 50 both become 50, 349 becomes 35, etc.
  const numeric = Number(`0.${trimmed}`);
  if (!Number.isFinite(numeric)) {
    return NaN;
  }

  return Math.round(numeric * 100);
}
