import React, { useMemo } from 'react';
import { TimeBase } from '@blue/data';

export const PIANO_ROLL_RULER_ROW_HEIGHT = 20;

export function getPianoRollRulerHeight(secondaryRulerEnabled: boolean): number {
  return secondaryRulerEnabled ? PIANO_ROLL_RULER_ROW_HEIGHT * 2 : PIANO_ROLL_RULER_ROW_HEIGHT;
}

interface MeterEntry {
  measure: number;
  numBeats: number;
  beatLength: number;
}

interface TimeBarProps {
  canvasWidth: number;
  pixelSecond: number;
  primaryTimeDisplay: string;
  secondaryTimeDisplay: string;
  secondaryRulerEnabled: boolean;
  meters: MeterEntry[];
  initialTempo: number;
  sampleRate: number;
}

interface Mark {
  x: number;
  label?: string;
  type: 'major' | 'minor';
}

interface MeterTimelineEntry extends MeterEntry {
  startBeat: number;
  beatsPerMeasure: number;
}

export default function TimeBar({
  canvasWidth,
  pixelSecond,
  primaryTimeDisplay,
  secondaryTimeDisplay,
  secondaryRulerEnabled,
  meters,
  initialTempo,
  sampleRate,
}: TimeBarProps): React.ReactElement {
  const totalBeats = canvasWidth / pixelSecond;
  const safeTempo = initialTempo > 0 ? initialTempo : 60;

  return (
    <div
      className="relative overflow-hidden bg-app-surface-strong"
      style={{ width: canvasWidth, height: getPianoRollRulerHeight(secondaryRulerEnabled) }}
    >
      <RulerRow
        timeDisplay={primaryTimeDisplay}
        totalBeats={totalBeats}
        pixelSecond={pixelSecond}
        meters={meters}
        tempo={safeTempo}
        sampleRate={sampleRate}
      />
      {secondaryRulerEnabled && (
        <RulerRow
          timeDisplay={secondaryTimeDisplay}
          totalBeats={totalBeats}
          pixelSecond={pixelSecond}
          meters={meters}
          tempo={safeTempo}
          sampleRate={sampleRate}
          secondary
        />
      )}
    </div>
  );
}

function RulerRow({
  timeDisplay,
  totalBeats,
  pixelSecond,
  meters,
  tempo,
  sampleRate,
  secondary,
}: {
  timeDisplay: string;
  totalBeats: number;
  pixelSecond: number;
  meters: MeterEntry[];
  tempo: number;
  sampleRate: number;
  secondary?: boolean;
}): React.ReactElement {
  const marks = useMemo(
    () => computeMarks(timeDisplay, totalBeats, pixelSecond, meters, tempo, sampleRate),
    [timeDisplay, totalBeats, pixelSecond, meters, tempo, sampleRate],
  );

  return (
    <div
      className={`relative overflow-hidden border-b border-blue-border/20 ${secondary ? 'bg-app-input' : 'bg-app-surface-strong'}`}
      style={{ width: totalBeats * pixelSecond, height: PIANO_ROLL_RULER_ROW_HEIGHT }}
    >
      {marks.map((mark, i) => (
        <div
          key={`${mark.x}-${i}`}
          className="absolute"
          style={{
            left: mark.x,
            top: mark.type === 'major' ? 0 : PIANO_ROLL_RULER_ROW_HEIGHT * 0.5,
            height: mark.type === 'major' ? PIANO_ROLL_RULER_ROW_HEIGHT : PIANO_ROLL_RULER_ROW_HEIGHT * 0.5,
            borderLeft: `1px solid ${mark.type === 'major' ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.09)'}`,
          }}
        >
          {mark.label && (
            <span
              className="absolute left-1 text-[10px] leading-none text-blue-muted whitespace-nowrap select-none"
              style={{ top: mark.type === 'major' ? 2 : -8 }}
            >
              {mark.label}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function computeMarks(
  timeDisplay: string,
  totalBeats: number,
  pixelsPerBeat: number,
  meters: MeterEntry[],
  tempo: number,
  sampleRate: number,
): Mark[] {
  switch (timeDisplay) {
    case TimeBase.TIME:
    case TimeBase.SECONDS:
      return computeTimeMarks(totalBeats, pixelsPerBeat, tempo, timeDisplay);
    case TimeBase.SMPTE:
      return computeSmpteMarks(totalBeats, pixelsPerBeat, tempo, 24);
    case TimeBase.FRAME:
      return computeSamplesMarks(totalBeats, pixelsPerBeat, tempo, sampleRate);
    case TimeBase.BBT:
    case TimeBase.BBST:
    case TimeBase.BBF:
      return computeMeasureMarks(totalBeats, pixelsPerBeat, meters);
    default:
      return computeBeatsMarks(totalBeats, pixelsPerBeat);
  }
}

function computeBeatsMarks(totalBeats: number, pixelsPerBeat: number): Mark[] {
  const majorBeatUnit = calcMajorBeatUnit(pixelsPerBeat);
  const marks: Mark[] = [];

  for (let beat = 0; beat <= totalBeats + majorBeatUnit * 0.5; beat += majorBeatUnit) {
    marks.push({ x: beat * pixelsPerBeat, label: formatBeat(beat), type: 'major' });
  }
  return marks;
}

function calcMajorBeatUnit(pixelTime: number): number {
  const minMajorWidth = 100;
  const v = Math.log(pixelTime / minMajorWidth) / Math.log(2);
  return 1.0 / Math.pow(2, Math.floor(v));
}

function formatBeat(beats: number): string {
  return beats === Math.floor(beats) ? String(Math.round(beats)) : beats.toFixed(1);
}

function computeTimeMarks(totalBeats: number, pixelsPerBeat: number, tempo: number, format: string): Mark[] {
  const secondsPerBeat = 60 / tempo;
  const totalSeconds = totalBeats * secondsPerBeat;
  const nticks = Math.max((totalBeats * pixelsPerBeat) / 80, 2);
  const range = niceNum(totalSeconds, false);
  if (range === 0) return [];
  const d = niceNum(range / (nticks - 1), true);
  if (d === 0) return [];
  const graphMax = Math.ceil(totalSeconds / d) * d;
  const nfrac = Math.max(-Math.floor(Math.log10(d)), 0);
  const marks: Mark[] = [];

  for (let seconds = 0; seconds < graphMax + 0.5 * d; seconds += d) {
    const beatPos = seconds / secondsPerBeat;
    const x = beatPos * pixelsPerBeat;
    if (x >= 0 && x <= totalBeats * pixelsPerBeat) {
      marks.push({
        x,
        label: format === TimeBase.SECONDS
          ? formatSecondsWithPrecision(seconds, nfrac)
          : formatTimeWithPrecision(seconds, nfrac),
        type: 'major',
      });
    }
  }
  return marks;
}

function computeSmpteMarks(totalBeats: number, pixelsPerBeat: number, tempo: number, frameRate: number): Mark[] {
  const secondsPerBeat = 60 / tempo;
  const totalSeconds = totalBeats * secondsPerBeat;
  const pixelsPerSecond = pixelsPerBeat / secondsPerBeat;
  const minSecPerLabel = 80 / pixelsPerSecond;
  const increments = [
    1 / frameRate, 2 / frameRate, 5 / frameRate, 10 / frameRate,
    0.5, 1, 2, 5, 10, 30, 60, 120, 300, 600,
  ];
  let increment = increments[increments.length - 1]!;
  for (const inc of increments) {
    if (minSecPerLabel <= inc) {
      increment = inc;
      break;
    }
  }

  const marks: Mark[] = [];
  for (let seconds = 0; seconds <= totalSeconds + increment * 0.5; seconds += increment) {
    const x = (seconds / secondsPerBeat) * pixelsPerBeat;
    if (x >= 0 && x <= totalBeats * pixelsPerBeat) {
      marks.push({ x, label: formatSmpteLabel(seconds, frameRate), type: 'major' });
    }
  }
  return marks;
}

function computeSamplesMarks(totalBeats: number, pixelsPerBeat: number, tempo: number, sampleRate: number): Mark[] {
  const safeSampleRate = sampleRate > 0 ? sampleRate : 44100;
  const secondsPerBeat = 60 / tempo;
  const totalSamples = totalBeats * secondsPerBeat * safeSampleRate;
  const nticks = Math.max((totalBeats * pixelsPerBeat) / 80, 2);
  const range = niceNum(totalSamples, false);
  if (range === 0) return [];
  const d = niceNum(range / (nticks - 1), true);
  if (d === 0) return [];
  const graphMax = Math.ceil(totalSamples / d) * d;
  const nfrac = Math.max(-Math.floor(Math.log10(d)), 0);
  const marks: Mark[] = [];

  for (let sample = 0; sample < graphMax + 0.5 * d; sample += d) {
    const seconds = sample / safeSampleRate;
    const x = (seconds / secondsPerBeat) * pixelsPerBeat;
    if (x >= 0 && x <= totalBeats * pixelsPerBeat) {
      marks.push({ x, label: formatSampleCount(sample, nfrac), type: 'major' });
    }
  }
  return marks;
}

function computeMeasureMarks(totalBeats: number, pixelsPerBeat: number, meters: MeterEntry[]): Mark[] {
  const meterTimeline = normalizeMeterEntries(meters);
  const firstMeter = meterTimeline[0]!;
  const beatsPerMeasure = firstMeter.beatsPerMeasure;
  const approxPixelsPerMeasure = beatsPerMeasure * pixelsPerBeat;
  const minLabelSpacing = 60;
  let measureGrouping = 1;
  let showBeats = false;

  if (approxPixelsPerMeasure < minLabelSpacing) {
    while (measureGrouping * approxPixelsPerMeasure < minLabelSpacing) {
      measureGrouping *= 2;
      if (measureGrouping > 256) break;
    }
  } else if (pixelsPerBeat >= minLabelSpacing) {
    showBeats = true;
  }

  const marks: Mark[] = [];
  let currentMeasure = 1;

  while (true) {
    const measureStartBeat = getMeasureStartBeat(meterTimeline, currentMeasure);
    if (measureStartBeat > totalBeats + beatsPerMeasure) break;

    const x = measureStartBeat * pixelsPerBeat;
    if (x >= -50 && x <= totalBeats * pixelsPerBeat + 50) {
      marks.push({ x, label: String(currentMeasure), type: 'major' });
      const meter = getMeterAtMeasure(meterTimeline, currentMeasure);
      const beatDuration = 4.0 / meter.beatLength;
      for (let beat = 2; beat <= meter.numBeats; beat += 1) {
        const beatPos = measureStartBeat + (beat - 1) * beatDuration;
        if (beatPos > totalBeats) break;
        marks.push({
          x: beatPos * pixelsPerBeat,
          label: showBeats && measureGrouping === 1 ? `${currentMeasure}|${beat}` : undefined,
          type: 'minor',
        });
      }
    }
    currentMeasure += measureGrouping;
  }

  return marks;
}

function normalizeMeterEntries(meters: MeterEntry[]): MeterTimelineEntry[] {
  const entries = meters.length > 0
    ? meters
    : [{ measure: 1, numBeats: 4, beatLength: 4 }];
  const sortedEntries = [...entries].sort((a, b) => a.measure - b.measure);
  const timeline: MeterTimelineEntry[] = [];

  sortedEntries.forEach((entry, index) => {
    const beatsPerMeasure = entry.numBeats * (4 / entry.beatLength);
    const startBeat = index === 0
      ? 0
      : timeline[index - 1]!.startBeat
        + (entry.measure - sortedEntries[index - 1]!.measure) * timeline[index - 1]!.beatsPerMeasure;

    timeline.push({ ...entry, startBeat, beatsPerMeasure });
  });

  return timeline;
}

function getMeasureStartBeat(meterTimeline: MeterTimelineEntry[], measureNumber: number): number {
  if (measureNumber <= 1) return 0;

  let beats = 0;
  let processedUpToMeasure = 1;

  for (let i = 0; i < meterTimeline.length; i += 1) {
    const entry = meterTimeline[i]!;
    const meterEndMeasure = i + 1 < meterTimeline.length
      ? meterTimeline[i + 1]!.measure
      : Number.POSITIVE_INFINITY;

    if (measureNumber <= entry.measure) break;

    const sectionStart = Math.max(entry.measure, processedUpToMeasure);
    const sectionEnd = Math.min(measureNumber, meterEndMeasure);
    const measuresInSection = sectionEnd - sectionStart;

    if (measuresInSection > 0) {
      beats += measuresInSection * entry.beatsPerMeasure;
      processedUpToMeasure = sectionEnd;
    }
    if (processedUpToMeasure >= measureNumber) break;
  }

  return beats;
}

function getMeterAtMeasure(meterTimeline: MeterTimelineEntry[], measureNumber: number): MeterTimelineEntry {
  let meter = meterTimeline[0]!;
  for (const entry of meterTimeline) {
    if (entry.measure <= measureNumber) {
      meter = entry;
    } else {
      break;
    }
  }
  return meter;
}

function niceNum(x: number, round: boolean): number {
  if (x === 0) return 0;
  const exp = Math.floor(Math.log10(Math.abs(x)));
  const f = x / Math.pow(10, exp);
  let nf: number;
  if (round) {
    nf = f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10;
  } else {
    nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  }
  return nf * Math.pow(10, exp);
}

function formatTimeWithPrecision(seconds: number, nfrac: number): string {
  const totalSecs = Math.floor(seconds);
  const minutes = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;

  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remMinutes = minutes % 60;
    if (nfrac > 0) {
      const frac = Math.round((seconds - totalSecs) * Math.pow(10, nfrac));
      return `${hours}:${String(remMinutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(frac).padStart(nfrac, '0')}`;
    }
    return `${hours}:${String(remMinutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  if (nfrac > 0) {
    const frac = Math.round((seconds - totalSecs) * Math.pow(10, nfrac));
    return `${minutes}:${String(secs).padStart(2, '0')}.${String(frac).padStart(nfrac, '0')}`;
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

function formatSecondsWithPrecision(seconds: number, nfrac: number): string {
  const scale = Math.max(1, Math.min(nfrac, 6));
  const text = seconds.toFixed(scale);
  return text.includes('.') ? text : text + '.0';
}

function formatSmpteLabel(seconds: number, frameRate: number): string {
  const totalSecs = Math.floor(seconds);
  const hours = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  let frames = Math.floor((seconds - totalSecs) * frameRate);
  const maxFrames = Math.floor(frameRate) - 1;
  if (frames > maxFrames) frames = maxFrames;
  if (frames < 0) frames = 0;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
}

function formatSampleCount(samples: number, nfrac: number): string {
  if (Math.abs(samples) >= 1_000_000) {
    const val = samples / 1_000_000.0;
    const displayFrac = Math.max(1, Math.min(3, nfrac > 0 ? nfrac - 5 : 1));
    return `${val.toFixed(displayFrac)}M`;
  }

  if (Math.abs(samples) >= 1_000) {
    const val = samples / 1_000.0;
    const displayFrac = Math.max(1, Math.min(3, nfrac > 0 ? nfrac - 2 : 1));
    return `${val.toFixed(displayFrac)}k`;
  }

  return nfrac === 0 || samples === Math.floor(samples)
    ? String(Math.round(samples))
    : samples.toFixed(nfrac);
}
