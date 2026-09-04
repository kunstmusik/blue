import { useState, useCallback } from 'react';
import type { RefObject } from 'react';
import type {
  ScoreTimeStateSnapshot,
  MarkerSnapshot,
  MeterSnapshot,
  MeterMapSnapshot,
  TempoMapSnapshot,
  TempoPointSnapshot,
  TempoMapPatch,
  MeterMapPatch,
} from '../../../../../shared/project-editor';
import { TimeBase, type SnapValueName } from '@blue/data';
import MeterRegionBar from './MeterRegionBar';
import MarkersBar from './MarkersBar';
import TempoRegionBar from './TempoRegionBar';
import TempoLineView from './TempoLineView';
import TempoPointDialog from './TempoPointDialog';
import MeterEntryDialog from './MeterEntryDialog';
import { cn } from '../../../../lib/cn';

interface Props {
  timeState: ScoreTimeStateSnapshot;
  markers: MarkerSnapshot[];
  meters: MeterSnapshot[];
  meterMap: MeterMapSnapshot;
  tempoMap: TempoMapSnapshot;
  totalBeats: number;
  pixelsPerBeat: number;
  sampleRate: number;
  renderStartTime: number;
  renderEndTime: number;
  snapEnabled: boolean;
  snapValue: SnapValueName;
  timePointerBeats: number | null;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  rootTimelineOnly: boolean;
  tempo: number;
  rulerMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  onTempoPatch: (patch: TempoMapPatch) => void;
  onMeterPatch: (patch: MeterMapPatch) => void;
}

export default function ColumnHeader({
  timeState,
  markers,
  meters,
  meterMap,
  tempoMap,
  totalBeats,
  pixelsPerBeat,
  sampleRate,
  renderStartTime,
  renderEndTime,
  snapEnabled,
  snapValue,
  timePointerBeats,
  scrollContainerRef,
  rootTimelineOnly,
  tempo,
  rulerMouseDown,
  onTempoPatch,
  onMeterPatch,
}: Props) {
  const [pointDialogIndex, setPointDialogIndex] = useState<number | null>(null);
  const [meterDialogIndex, setMeterDialogIndex] = useState<number | null>(null);
  const contentWidth = totalBeats * pixelsPerBeat;
  const smpteFrameRate = timeState.smpteFrameRate || 24;
  const hasRenderEnd = renderEndTime > 0 && renderEndTime > renderStartTime;

  const handleOpenPointDialog = useCallback((index: number) => {
    setPointDialogIndex(index);
  }, []);

  const handleClosePointDialog = useCallback(() => {
    setPointDialogIndex(null);
  }, []);

  const handleOpenMeterDialog = useCallback((entryIndex: number) => {
    setMeterDialogIndex(entryIndex);
  }, []);

  const handleCloseMeterDialog = useCallback(() => {
    setMeterDialogIndex(null);
  }, []);

  return (
    <div
      className="bg-blue-bg border-b border-blue-border/40 overflow-hidden"
      style={{ minWidth: contentWidth }}
    >
      {timeState.tempoRowVisible && (
        <TempoRegionBar
          tempoMap={tempoMap}
          meterMap={meterMap}
          totalBeats={totalBeats}
          pixelsPerBeat={pixelsPerBeat}
          snapEnabled={snapEnabled}
          snapValue={snapValue}
          rootTimelineOnly={rootTimelineOnly}
          onTempoPatch={onTempoPatch}
          onOpenPointDialog={handleOpenPointDialog}
        />
      )}
      {timeState.tempoRowVisible && tempoMap.visible && (
        <TempoLineView
          tempoMap={tempoMap}
          meterMap={meterMap}
          totalBeats={totalBeats}
          pixelsPerBeat={pixelsPerBeat}
          snapEnabled={snapEnabled}
          snapValue={snapValue}
          rootTimelineOnly={rootTimelineOnly}
          scrollContainerRef={scrollContainerRef}
          onTempoPatch={onTempoPatch}
        />
      )}

      <MeterRegionBar
        meterMap={meterMap}
        totalBeats={totalBeats}
        pixelsPerBeat={pixelsPerBeat}
        rowVisible={timeState.meterRowVisible}
        rootTimelineOnly={rootTimelineOnly}
        onMeterPatch={onMeterPatch}
        onOpenEntryDialog={handleOpenMeterDialog}
      />
      <MarkersBar
        markers={markers}
        totalBeats={totalBeats}
        pixelsPerBeat={pixelsPerBeat}
        rowVisible={timeState.markersRowVisible}
        snapEnabled={snapEnabled}
        snapValue={snapValue}
        meterMap={meterMap}
        scrollContainerRef={scrollContainerRef}
        rootTimelineOnly={rootTimelineOnly}
        tempo={tempo}
        smpteFrameRate={smpteFrameRate}
        sampleRate={sampleRate}
      />

      <TimeBar
        timeDisplay={timeState.primaryTimeDisplay}
        totalBeats={totalBeats}
        pixelsPerBeat={pixelsPerBeat}
        tempoMap={tempoMap}
        meters={meters}
        smpteFrameRate={smpteFrameRate}
        sampleRate={sampleRate}
        renderStartTime={renderStartTime}
        renderEndTime={renderEndTime}
        timePointerBeats={timePointerBeats}
        onMouseDown={rulerMouseDown}
      />

      {timeState.secondaryRulerEnabled && (
        <TimeBar
          timeDisplay={timeState.secondaryTimeDisplay}
          totalBeats={totalBeats}
          pixelsPerBeat={pixelsPerBeat}
          tempoMap={tempoMap}
          meters={meters}
          smpteFrameRate={smpteFrameRate}
          sampleRate={sampleRate}
          secondary
        />
      )}

      {pointDialogIndex !== null && (
        <TempoPointDialog
          pointIndex={pointDialogIndex}
          tempoMap={tempoMap}
          onTempoPatch={onTempoPatch}
          onClose={handleClosePointDialog}
        />
      )}

      {meterDialogIndex !== null && (
        <MeterEntryDialog
          entryIndex={meterDialogIndex}
          meterMap={meterMap}
          onMeterPatch={onMeterPatch}
          onClose={handleCloseMeterDialog}
        />
      )}
    </div>
  );
}

interface Mark {
  x: number;
  label?: string;
  type: 'major' | 'minor';
}

interface TempoMapAdapter {
  beatsToSeconds: (beat: number) => number;
  secondsToBeats: (seconds: number) => number;
}

interface MeterTimelineEntry {
  measure: number;
  numBeats: number;
  beatLength: number;
  startBeat: number;
  beatsPerMeasure: number;
}

const tempoMapAdapterCache = new WeakMap<TempoMapSnapshot, TempoMapAdapter>();

function TimeBar({
  timeDisplay,
  totalBeats,
  pixelsPerBeat,
  tempoMap,
  meters,
  smpteFrameRate,
  sampleRate,
  secondary,
  renderStartTime,
  renderEndTime,
  timePointerBeats,
  onMouseDown,
}: {
  timeDisplay: string;
  totalBeats: number;
  pixelsPerBeat: number;
  tempoMap: TempoMapSnapshot;
  meters: MeterSnapshot[];
  smpteFrameRate: number;
  sampleRate: number;
  secondary?: boolean;
  renderStartTime?: number;
  renderEndTime?: number;
  timePointerBeats?: number | null;
  onMouseDown?: (e: React.MouseEvent<HTMLDivElement>) => void;
}) {
  const marks = computeMarks(
    timeDisplay,
    totalBeats,
    pixelsPerBeat,
    tempoMap,
    meters,
    smpteFrameRate,
    sampleRate,
  );
  const ROW_HEIGHT = 20;
  const hasRenderEnd =
    renderEndTime != null && renderEndTime > 0 && renderEndTime > (renderStartTime ?? 0);
  const startPixel = (renderStartTime ?? -1) >= 0 ? renderStartTime! * pixelsPerBeat : -1;
  const endPixel = hasRenderEnd ? renderEndTime! * pixelsPerBeat : -1;

  return (
    <div
      data-score-time-ruler={onMouseDown ? 'primary' : undefined}
      className={cn(
        'relative overflow-hidden border-b border-blue-border/20',
        secondary ? 'bg-blue-surface' : 'bg-blue-bg',
        onMouseDown && 'cursor-crosshair select-none',
      )}
      style={{ height: ROW_HEIGHT, minWidth: totalBeats * pixelsPerBeat }}
      onMouseDown={onMouseDown}
    >
      {startPixel >= 0 && hasRenderEnd && (
        <div
          className="absolute top-0 bottom-0 bg-green-500/10 border-t border-b border-green-500/20"
          style={{ left: startPixel, width: endPixel - startPixel }}
        />
      )}
      {marks.map((mark, i) => (
        <div
          key={i}
          className="absolute left-0 right-0"
          style={{
            position: 'absolute',
            left: mark.x,
            top: mark.type === 'major' ? 0 : ROW_HEIGHT * 0.5,
            height: mark.type === 'major' ? ROW_HEIGHT : ROW_HEIGHT * 0.5,
            borderLeft: `1px solid ${mark.type === 'major' ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)'}`,
          }}
        >
          {mark.label && (
            <span
              className="absolute left-1 text-role-subheadline text-blue-muted whitespace-nowrap select-none"
              style={{ top: mark.type === 'major' ? 1 : -9 }}
            >
              {mark.label}
            </span>
          )}
        </div>
      ))}
      {startPixel >= 0 && (
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-green-400 z-10"
          style={{ left: startPixel }}
        />
      )}
      {hasRenderEnd && endPixel >= 0 && (
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-yellow-400 z-10"
          style={{ left: endPixel }}
        />
      )}
      {timePointerBeats != null && timePointerBeats >= 0 && (
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-orange-500 z-20"
          style={{ left: timePointerBeats * pixelsPerBeat }}
        />
      )}
    </div>
  );
}

function computeMarks(
  timeDisplay: string,
  totalBeats: number,
  pixelsPerBeat: number,
  tempoMap: TempoMapSnapshot,
  meters: MeterSnapshot[],
  smpteFrameRate: number,
  sampleRate: number,
): Mark[] {
  switch (timeDisplay) {
    case TimeBase.TIME:
    case TimeBase.SECONDS:
      return computeTimeMarks(totalBeats, pixelsPerBeat, tempoMap, timeDisplay);
    case TimeBase.SMPTE:
      return computeSmpteMarks(totalBeats, pixelsPerBeat, tempoMap, smpteFrameRate);
    case TimeBase.FRAME:
      return computeSamplesMarks(totalBeats, pixelsPerBeat, tempoMap, sampleRate);
    case TimeBase.BBT:
    case TimeBase.BBST:
    case TimeBase.BBF:
      return computeMeasureMarks(totalBeats, pixelsPerBeat, meters);
    default:
      return computeBeatsMarks(totalBeats, pixelsPerBeat);
  }
}

function normalizeTempoPoints(snapshot: TempoMapSnapshot): TempoPointSnapshot[] {
  return [...snapshot.points].sort((a, b) => a.beat - b.beat);
}

function createTempoMapAdapter(snapshot: TempoMapSnapshot): TempoMapAdapter {
  const cached = tempoMapAdapterCache.get(snapshot);
  if (cached) {
    return cached;
  }

  if (!snapshot.enabled || snapshot.points.length === 0) {
    const identity = {
      beatsToSeconds: (beat: number) => beat,
      secondsToBeats: (seconds: number) => seconds,
    };
    tempoMapAdapterCache.set(snapshot, identity);
    return identity;
  }

  const points = normalizeTempoPoints(snapshot);
  const cumulativeSeconds: number[] = [0];
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1]!;
    const current = points[i]!;
    const previousSeconds = cumulativeSeconds[i - 1]!;
    const deltaBeats = current.beat - prev.beat;

    if (deltaBeats <= 0) {
      cumulativeSeconds.push(previousSeconds);
      continue;
    }

    if (prev.curveType === 'constant') {
      cumulativeSeconds.push(previousSeconds + deltaBeats * (60 / prev.tempo));
      continue;
    }

    const factor1 = 60 / prev.tempo;
    const acceleration = (60 / current.tempo - factor1) / deltaBeats;
    cumulativeSeconds.push(
      previousSeconds + factor1 * deltaBeats + 0.5 * acceleration * deltaBeats * deltaBeats,
    );
  }

  const beatsToSeconds = (beat: number): number => {
    let index = 0;
    for (let i = points.length - 1; i >= 0; i -= 1) {
      if (beat >= points[i]!.beat) {
        index = i;
        break;
      }
    }

    const current = points[index]!;
    const currentSeconds = cumulativeSeconds[index]!;

    if (index >= points.length - 1) {
      const deltaBeats = beat - current.beat;
      return currentSeconds + deltaBeats * (60 / current.tempo);
    }

    const next = points[index + 1]!;
    const deltaBeats = beat - current.beat;

    if (current.curveType === 'constant') {
      return currentSeconds + deltaBeats * (60 / current.tempo);
    }

    const t0 = current.tempo;
    const t1 = next.tempo;
    const segmentBeats = next.beat - current.beat;

    if (t0 === t1 || segmentBeats <= 0) {
      return currentSeconds + deltaBeats * (60 / t0);
    }

    const factor1 = 60 / t0;
    const acceleration = (60 / t1 - factor1) / segmentBeats;
    return currentSeconds + factor1 * deltaBeats + 0.5 * acceleration * deltaBeats * deltaBeats;
  };

  const secondsToBeats = (seconds: number): number => {
    let index = 0;
    for (let i = points.length - 1; i >= 0; i -= 1) {
      if (seconds >= cumulativeSeconds[i]!) {
        index = i;
        break;
      }
    }

    const current = points[index]!;
    const currentSeconds = cumulativeSeconds[index]!;
    const elapsed = seconds - currentSeconds;

    if (index >= points.length - 1) {
      return current.beat + elapsed * (current.tempo / 60);
    }

    const next = points[index + 1]!;
    if (current.curveType === 'constant') {
      return current.beat + elapsed * (current.tempo / 60);
    }

    const t0 = current.tempo;
    const t1 = next.tempo;
    const segmentBeats = next.beat - current.beat;
    if (t0 === t1 || segmentBeats <= 0) {
      return current.beat + elapsed * (t0 / 60);
    }

    const factor1 = 60 / t0;
    const acceleration = (60 / t1 - factor1) / segmentBeats;
    const discriminant = factor1 * factor1 + 2 * acceleration * elapsed;

    if (acceleration === 0) {
      return current.beat + elapsed / factor1;
    }

    return current.beat + (Math.sqrt(Math.max(0, discriminant)) - factor1) / acceleration;
  };

  const adapter = { beatsToSeconds, secondsToBeats };
  tempoMapAdapterCache.set(snapshot, adapter);
  return adapter;
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

function computeBeatsMarks(totalBeats: number, pixelsPerBeat: number): Mark[] {
  const majorBeatUnit = calcMajorBeatUnit(pixelsPerBeat);
  const marks: Mark[] = [];

  for (let beat = 0; beat <= totalBeats + majorBeatUnit * 0.5; beat += majorBeatUnit) {
    marks.push({
      x: beat * pixelsPerBeat,
      label: formatBeat(beat),
      type: 'major',
    });
  }
  return marks;
}

function calcMajorBeatUnit(pixelTime: number): number {
  const minMajorWidth = 100;
  const v = Math.log(pixelTime / minMajorWidth) / Math.log(2);
  return 1.0 / Math.pow(2, Math.floor(v));
}

function formatBeat(beats: number): string {
  if (beats === Math.floor(beats)) return String(Math.round(beats));
  return beats.toFixed(1);
}

function computeTimeMarks(
  totalBeats: number,
  pixelsPerBeat: number,
  tempoMap: TempoMapSnapshot,
  format: string,
): Mark[] {
  const tempoAdapter = createTempoMapAdapter(tempoMap);
  const approxWidth = totalBeats * pixelsPerBeat;
  const startBeat = 0;
  const endBeat = totalBeats;
  const startSeconds = tempoAdapter.beatsToSeconds(startBeat);
  const endSeconds = tempoAdapter.beatsToSeconds(endBeat);

  const nticks = Math.max(approxWidth / 80, 2);
  const range = niceNum(endSeconds - startSeconds, false);
  if (range === 0) return [];
  const d = niceNum(range / (nticks - 1), true);
  if (d === 0) return [];
  const graphMin = Math.floor(startSeconds / d) * d;
  const graphMax = Math.ceil(endSeconds / d) * d;
  const nfrac = Math.max(-Math.floor(Math.log10(d)), 0);

  const marks: Mark[] = [];

  for (let seconds = graphMin; seconds < graphMax + 0.5 * d; seconds += d) {
    if (seconds < 0) continue;
    const beatPos = tempoAdapter.secondsToBeats(seconds);
    const x = totalBeats > 0 ? ((beatPos - startBeat) / totalBeats) * approxWidth : 0;
    if (x >= 0 && x <= approxWidth) {
      marks.push({
        x,
        label:
          format === TimeBase.SECONDS
            ? formatSecondsWithPrecision(seconds, nfrac)
            : formatTimeWithPrecision(seconds, nfrac),
        type: 'major',
      });
    }
  }
  return marks;
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

function computeSmpteMarks(
  totalBeats: number,
  pixelsPerBeat: number,
  tempoMap: TempoMapSnapshot,
  frameRate: number,
): Mark[] {
  const tempoAdapter = createTempoMapAdapter(tempoMap);
  const approxWidth = totalBeats * pixelsPerBeat;
  const startSeconds = 0;
  const endSeconds = tempoAdapter.beatsToSeconds(totalBeats);
  const frameDuration = 1.0 / frameRate;

  const pixelsPerSecond = endSeconds > 0 ? approxWidth / endSeconds : 1;
  const minSecPerLabel = 80 / pixelsPerSecond;

  const increments = [
    frameDuration,
    2 * frameDuration,
    5 * frameDuration,
    10 * frameDuration,
    0.5,
    1,
    2,
    5,
    10,
    30,
    60,
    120,
    300,
    600,
  ];
  let increment = increments[increments.length - 1];
  for (const inc of increments) {
    if (minSecPerLabel <= inc) {
      increment = inc;
      break;
    }
  }
  const alignedStart = Math.floor(startSeconds / increment) * increment;
  const marks: Mark[] = [];

  for (let sec = alignedStart; sec <= endSeconds + increment * 0.5; sec += increment) {
    if (sec < 0) continue;
    const beatPos = tempoAdapter.secondsToBeats(sec);
    const x = totalBeats > 0 ? (beatPos / totalBeats) * approxWidth : 0;
    if (x >= 0 && x <= approxWidth) {
      marks.push({
        x,
        label: formatSmpteLabel(sec, frameRate),
        type: 'major',
      });
    }
  }
  return marks;
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

function computeSamplesMarks(
  totalBeats: number,
  pixelsPerBeat: number,
  tempoMap: TempoMapSnapshot,
  sampleRate: number,
): Mark[] {
  const tempoAdapter = createTempoMapAdapter(tempoMap);
  const safeSampleRate = sampleRate > 0 ? sampleRate : 44100;
  const approxWidth = totalBeats * pixelsPerBeat;
  const startSeconds = 0;
  const endSeconds = tempoAdapter.beatsToSeconds(totalBeats);
  const startSample = startSeconds * safeSampleRate;
  const endSample = endSeconds * safeSampleRate;

  const nticks = Math.max(approxWidth / 80, 2);
  const range = niceNum(endSample - startSample, false);
  if (range === 0) return [];
  const d = niceNum(range / (nticks - 1), true);
  if (d === 0) return [];
  const graphMin = Math.floor(startSample / d) * d;
  const graphMax = Math.ceil(endSample / d) * d;
  const nfrac = Math.max(-Math.floor(Math.log10(d)), 0);

  const marks: Mark[] = [];

  for (let sample = graphMin; sample < graphMax + 0.5 * d; sample += d) {
    if (sample < 0) continue;
    const seconds = sample / safeSampleRate;
    const beatPos = tempoAdapter.secondsToBeats(seconds);
    const x = totalBeats > 0 ? (beatPos / totalBeats) * approxWidth : 0;
    if (x >= 0 && x <= approxWidth) {
      marks.push({
        x,
        label: formatSampleCount(sample, nfrac),
        type: 'major',
      });
    }
  }
  return marks;
}

function formatSampleCount(samples: number, nfrac: number): string {
  if (Math.abs(samples) >= 1_000_000) {
    const val = samples / 1_000_000.0;
    const mfrac = Math.max(0, nfrac - 6);
    if (mfrac === 0 && val === Math.floor(val)) {
      return `${Math.trunc(val)}M`;
    }
    const displayFrac = Math.max(1, Math.min(3, nfrac > 0 ? nfrac - 5 : 1));
    return `${val.toFixed(displayFrac)}M`;
  }

  if (Math.abs(samples) >= 1_000) {
    const val = samples / 1_000.0;
    const kfrac = Math.max(0, nfrac - 3);
    if (kfrac === 0 && val === Math.floor(val)) {
      return `${Math.trunc(val)}k`;
    }
    const displayFrac = Math.max(1, Math.min(3, nfrac > 0 ? nfrac - 2 : 1));
    return `${val.toFixed(displayFrac)}k`;
  }

  if (nfrac === 0 || samples === Math.floor(samples)) {
    return String(Math.round(samples));
  }

  return samples.toFixed(nfrac);
}

function computeMeasureMarks(
  totalBeats: number,
  pixelsPerBeat: number,
  meters: MeterSnapshot[],
): Mark[] {
  const meterTimeline = normalizeMeterEntries(meters);
  const firstMeter = meterTimeline[0]!;
  const beatsPerMeasure = firstMeter.numBeats * (4.0 / firstMeter.beatLength);
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

      if (showBeats && measureGrouping === 1) {
        const meter = getMeterAtMeasure(meterTimeline, currentMeasure);
        const beatDur = 4.0 / meter.beatLength;
        for (let beat = 2; beat <= meter.numBeats; beat++) {
          const beatPos = measureStartBeat + (beat - 1) * beatDur;
          if (beatPos > totalBeats) break;
          const beatX = beatPos * pixelsPerBeat;
          marks.push({ x: beatX, label: `${currentMeasure}|${beat}`, type: 'minor' });
        }
      } else if (!showBeats && measureGrouping === 1) {
        const meter = getMeterAtMeasure(meterTimeline, currentMeasure);
        const beatDur = 4.0 / meter.beatLength;
        for (let beat = 2; beat <= meter.numBeats; beat++) {
          const beatPos = measureStartBeat + (beat - 1) * beatDur;
          if (beatPos > totalBeats) break;
          marks.push({ x: beatPos * pixelsPerBeat, type: 'minor' });
        }
      }
    }

    currentMeasure += measureGrouping;
  }

  return marks;
}

function normalizeMeterEntries(meters: MeterSnapshot[]): MeterTimelineEntry[] {
  const entries =
    meters.length > 0 ? meters : [{ measure: 1, numBeats: 4, beatLength: 4, startBeat: 0 }];

  const sortedEntries = [...entries].sort((a, b) => a.measure - b.measure);
  const timeline: MeterTimelineEntry[] = [];

  sortedEntries.forEach((entry, index) => {
    const beatsPerMeasure = entry.numBeats * (4 / entry.beatLength);
    const startBeat =
      index === 0
        ? 0
        : timeline[index - 1]!.startBeat +
          (entry.measure - sortedEntries[index - 1]!.measure) *
            timeline[index - 1]!.beatsPerMeasure;

    timeline.push({
      measure: entry.measure,
      numBeats: entry.numBeats,
      beatLength: entry.beatLength,
      startBeat,
      beatsPerMeasure,
    });
  });

  return timeline;
}

function getMeasureStartBeat(meterTimeline: MeterTimelineEntry[], measureNumber: number): number {
  if (measureNumber <= 1) return 0;

  let beats = 0;
  let processedUpToMeasure = 1;

  for (let i = 0; i < meterTimeline.length; i += 1) {
    const entry = meterTimeline[i]!;
    const entryStartMeasure = entry.measure;
    const beatsPerMeasure = entry.beatsPerMeasure;

    const meterEndMeasure =
      i + 1 < meterTimeline.length ? meterTimeline[i + 1]!.measure : Number.POSITIVE_INFINITY;

    if (measureNumber <= entryStartMeasure) {
      break;
    }

    const sectionStart = Math.max(entryStartMeasure, processedUpToMeasure);
    const sectionEnd = Math.min(measureNumber, meterEndMeasure);
    const measuresInSection = sectionEnd - sectionStart;

    if (measuresInSection > 0) {
      beats += measuresInSection * beatsPerMeasure;
      processedUpToMeasure = sectionEnd;
    }

    if (processedUpToMeasure >= measureNumber) {
      break;
    }
  }

  return beats;
}

function getMeterAtMeasure(
  meterTimeline: MeterTimelineEntry[],
  measureNumber: number,
): MeterTimelineEntry {
  let meter = meterTimeline[0]!;
  for (let i = 0; i < meterTimeline.length; i += 1) {
    const entry = meterTimeline[i]!;
    if (entry.measure <= measureNumber) {
      meter = entry;
    } else {
      break;
    }
  }
  return meter;
}

export const __testOnly = {
  computeMarks,
  formatTimeWithPrecision,
};
