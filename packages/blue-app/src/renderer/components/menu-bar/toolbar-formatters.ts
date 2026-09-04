import type { PlaybackStatus } from '../../stores/playback-store';
import type { MeterMapSnapshot, TempoMapSnapshot } from '../../../shared/project-editor';
import { TimeBase } from '../../../shared/time-base';

interface TransportFormatAdapter {
  tempoMap: TempoMapSnapshot;
  meterMap: MeterMapSnapshot;
  smpteFrameRate: number;
  sampleRate: number;
}

export type ToolbarDisplaySource = 'idle-anchor' | 'engine-authority' | 'interpolated';
export type ToolbarDisplayMode = TimeBase | 'sync' | 'off';

export const DEFAULT_PLAYHEAD_PRIMARY_MODE: ToolbarDisplayMode = 'sync';
export const DEFAULT_PLAYHEAD_SECONDARY_MODE: ToolbarDisplayMode = 'sync';
const DEFAULT_PRIMARY_FORMAT = TimeBase.BEATS;
const DEFAULT_SECONDARY_FORMAT = TimeBase.TIME;
const DEFAULT_PPQ = 960;

export interface ToolbarPlayheadDisplayState {
  primaryText: string;
  secondaryText: string | null;
  displayBeat: number;
  displaySeconds: number;
  source: ToolbarDisplaySource;
}

export interface ToolbarSelectionDisplayState {
  startText: string;
  endText: string;
  durationText: string;
  hasSelection: boolean;
}

export interface ToolbarPlayheadTransportSnapshot {
  renderStartTime: number;
  tempoMap: TempoMapSnapshot;
  meterMap: MeterMapSnapshot;
  smpteFrameRate: number;
  sampleRate: number;
}

export interface ToolbarSelectionTransportSnapshot {
  renderStartTime: number;
  renderEndTime: number;
  tempoMap: TempoMapSnapshot;
  meterMap: MeterMapSnapshot;
  smpteFrameRate: number;
  sampleRate: number;
}

export interface ToolbarPlaybackSnapshot {
  status: PlaybackStatus;
  hasClock: boolean;
  elapsedSeconds: number;
  source: ToolbarDisplaySource;
}

export interface ToolbarPlayheadDisplayPreferences {
  primaryMode?: ToolbarDisplayMode;
  secondaryMode?: ToolbarDisplayMode;
}

interface TempoMapAdapter {
  beatsToSeconds: (beat: number) => number;
  secondsToBeats: (seconds: number) => number;
}

const tempoMapAdapterCache = new WeakMap<TempoMapSnapshot, TempoMapAdapter>();
const meterTimelineCache = new WeakMap<MeterMapSnapshot, MeterTimelineEntry[]>();

interface MeterTimelineEntry {
  measure: number;
  numBeats: number;
  beatLength: number;
  startBeat: number;
  beatsPerMeasure: number;
  beatScale: number;
}

function normalizeTempoPoints(snapshot: TempoMapSnapshot) {
  return [...snapshot.points].sort((a, b) => a.beat - b.beat);
}

function createTempoMapAdapter(snapshot: TempoMapSnapshot): TempoMapAdapter {
  const cachedAdapter = tempoMapAdapterCache.get(snapshot);
  if (cachedAdapter) {
    return cachedAdapter;
  }

  if (!snapshot.enabled) {
    const adapter = {
      beatsToSeconds: (beat: number) => beat,
      secondsToBeats: (seconds: number) => seconds,
    };
    tempoMapAdapterCache.set(snapshot, adapter);
    return adapter;
  }

  const points = normalizeTempoPoints(snapshot);
  if (points.length === 0) {
    const adapter = {
      beatsToSeconds: (beat: number) => beat,
      secondsToBeats: (seconds: number) => seconds,
    };
    tempoMapAdapterCache.set(snapshot, adapter);
    return adapter;
  }

  const cumulativeSeconds: number[] = [0];
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const current = points[i];
    const previousSeconds = cumulativeSeconds[i - 1];
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
      if (beat >= points[i].beat) {
        index = i;
        break;
      }
    }

    const current = points[index];
    const currentSeconds = cumulativeSeconds[index];

    if (index >= points.length - 1) {
      const deltaBeats = beat - current.beat;
      return currentSeconds + deltaBeats * (60 / current.tempo);
    }

    const next = points[index + 1];
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
      if (seconds >= cumulativeSeconds[i]) {
        index = i;
        break;
      }
    }

    const current = points[index];
    const currentSeconds = cumulativeSeconds[index];
    const elapsed = seconds - currentSeconds;

    if (index >= points.length - 1) {
      return current.beat + elapsed * (current.tempo / 60);
    }

    const next = points[index + 1];

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

function normalizeMeterEntries(snapshot: MeterMapSnapshot): Array<MeterTimelineEntry> {
  const cachedTimeline = meterTimelineCache.get(snapshot);
  if (cachedTimeline) {
    return cachedTimeline;
  }

  const entries =
    snapshot.entries.length > 0
      ? snapshot.entries
      : [
          {
            measure: 1,
            numBeats: 4,
            beatLength: 4,
          },
        ];

  const sortedEntries = [...entries].sort((a, b) => a.measure - b.measure);
  const timeline: MeterTimelineEntry[] = [];

  sortedEntries.forEach((entry, index) => {
    const beatsPerMeasure = entry.numBeats * (4 / entry.beatLength);
    const beatScale = 4 / entry.beatLength;
    const startBeat =
      index === 0
        ? 0
        : timeline[index - 1].startBeat +
          (entry.measure - sortedEntries[index - 1].measure) * timeline[index - 1].beatsPerMeasure;

    timeline.push({
      measure: entry.measure,
      numBeats: entry.numBeats,
      beatLength: entry.beatLength,
      startBeat,
      beatsPerMeasure,
      beatScale,
    });
  });

  meterTimelineCache.set(snapshot, timeline);
  return timeline;
}

interface MeterPosition {
  bar: number;
  beat: number;
  ticks: number;
  sixteenth: number;
  fraction: number;
}

function beatsToMeterPosition(beat: number, snapshot: MeterMapSnapshot): MeterPosition {
  const timeline = normalizeMeterEntries(snapshot);
  const safeBeat = Math.max(0, beat);
  let entryIndex = 0;

  for (let i = timeline.length - 1; i >= 0; i -= 1) {
    if (safeBeat >= timeline[i].startBeat) {
      entryIndex = i;
      break;
    }
  }

  const entry = timeline[entryIndex];
  const beatsFromEntry = safeBeat - entry.startBeat;
  const measuresFromEntry = Math.floor(beatsFromEntry / entry.beatsPerMeasure);
  const remainingBeats = beatsFromEntry - measuresFromEntry * entry.beatsPerMeasure;
  const fullBeats = Math.floor(remainingBeats / entry.beatScale);
  const fractionalBeat = remainingBeats - fullBeats * entry.beatScale;
  let ticks = Math.round((fractionalBeat * DEFAULT_PPQ) / entry.beatScale);
  let bar = entry.measure + measuresFromEntry;
  let beatNumber = fullBeats + 1;

  if (ticks >= DEFAULT_PPQ) {
    ticks = 0;
    beatNumber += 1;
    if (beatNumber > entry.numBeats) {
      beatNumber = 1;
      bar += 1;
    }
  }

  const sixteenthTicks = DEFAULT_PPQ / 4;
  const sixteenth = Math.floor(ticks / sixteenthTicks) + 1;
  const fraction = Math.round((ticks * 100) / DEFAULT_PPQ);

  return {
    bar,
    beat: beatNumber,
    ticks,
    sixteenth: Math.min(sixteenth, 4),
    fraction: Math.min(fraction, 99),
  };
}

function resolveDisplayMode(
  mode: ToolbarDisplayMode | undefined,
  fallback: TimeBase,
): TimeBase | null {
  if (mode === 'off') {
    return null;
  }

  if (mode === 'sync' || mode === undefined) {
    return fallback;
  }

  return mode;
}

function formatSeconds(seconds: number): string {
  const safeSeconds = Math.max(0, clampDisplayValue(seconds));
  const totalMilliseconds = Math.round(safeSeconds * 1000);
  const minutes = Math.floor(totalMilliseconds / 60000);
  const remainingMilliseconds = totalMilliseconds % 60000;
  const secs = Math.floor(remainingMilliseconds / 1000);
  const millis = remainingMilliseconds % 1000;

  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}:${String(remainingMinutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
  }

  return `${minutes}:${String(secs).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

function formatSmpte(seconds: number, frameRate: number): string {
  const safeFrameRate = frameRate > 0 ? frameRate : 30;
  const totalSeconds = Math.max(0, seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = Math.floor(totalSeconds % 60);
  const frames = Math.min(
    Math.max(0, Math.floor((totalSeconds - Math.floor(totalSeconds)) * safeFrameRate)),
    Math.max(0, Math.floor(safeFrameRate) - 1),
  );

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
}

function formatToolbarPosition(
  beat: number,
  format: TimeBase,
  transport: TransportFormatAdapter,
): string {
  const tempoAdapter = createTempoMapAdapter(transport.tempoMap);

  if (format === TimeBase.SMPTE) {
    return formatSmpte(tempoAdapter.beatsToSeconds(beat), transport.smpteFrameRate);
  }

  switch (format) {
    case TimeBase.BEATS:
      return formatBeatText(beat);
    case TimeBase.BBT: {
      const bbt = beatsToMeterPosition(beat, transport.meterMap);
      return `${bbt.bar}.${bbt.beat}.${bbt.ticks}`;
    }
    case TimeBase.BBST: {
      const bbst = beatsToMeterPosition(beat, transport.meterMap);
      return `${bbst.bar}.${bbst.beat}.${bbst.sixteenth}.${bbst.ticks}`;
    }
    case TimeBase.BBF: {
      const bbf = beatsToMeterPosition(beat, transport.meterMap);
      return `${bbf.bar}.${bbf.beat}.${String(bbf.fraction).padStart(2, '0')}`;
    }
    case TimeBase.TIME:
      return formatSeconds(tempoAdapter.beatsToSeconds(beat));
    case TimeBase.SECONDS:
      return tempoAdapter.beatsToSeconds(beat).toFixed(1);
    case TimeBase.FRAME:
      return String(Math.round(tempoAdapter.beatsToSeconds(beat) * transport.sampleRate));
    default:
      return formatBeatText(beat);
  }
}

export const TOOLBAR_TIME_DISPLAY_FORMATS: TimeBase[] = [
  TimeBase.BEATS,
  TimeBase.BBT,
  TimeBase.BBST,
  TimeBase.BBF,
  TimeBase.TIME,
  TimeBase.SMPTE,
  TimeBase.SECONDS,
  TimeBase.FRAME,
];

export function getTimeDisplayFormatMenuLabel(format: TimeBase): string {
  switch (format) {
    case TimeBase.BEATS:
      return 'Beats (0.0, 4.0, 8.0)';
    case TimeBase.BBT:
      return 'BBT (1.1.0, 2.1.0)';
    case TimeBase.BBST:
      return 'BBST (1.1.1.0, 2.1.1.0)';
    case TimeBase.BBF:
      return 'BBF (1.1.00, 2.1.50)';
    case TimeBase.TIME:
      return 'Time (0:00.000)';
    case TimeBase.SMPTE:
      return 'SMPTE (00:00:00:00)';
    case TimeBase.SECONDS:
      return 'Seconds (0.0, 1.5)';
    case TimeBase.FRAME:
      return 'Samples (0, 44100)';
    default:
      return format;
  }
}

function clampDisplayValue(value: number): number {
  if (Number.isNaN(value) || !Number.isFinite(value)) {
    return 0;
  }

  return value;
}

export function formatBeatText(beat: number): string {
  return clampDisplayValue(beat).toFixed(2);
}

export function formatClockText(seconds: number): string {
  const safeSeconds = Math.max(0, clampDisplayValue(seconds));
  const totalMilliseconds = Math.round(safeSeconds * 1000);
  const minutes = Math.floor(totalMilliseconds / 60000);
  const remainingMilliseconds = totalMilliseconds % 60000;
  const secs = Math.floor(remainingMilliseconds / 1000);
  const millis = remainingMilliseconds % 1000;

  return `${minutes}:${String(secs).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

export function buildPlayheadDisplayState(
  transport: ToolbarPlayheadTransportSnapshot,
  playback: ToolbarPlaybackSnapshot,
  preferences: ToolbarPlayheadDisplayPreferences = {},
): ToolbarPlayheadDisplayState {
  const tempoMap = createTempoMapAdapter(transport.tempoMap);
  const primaryFormat =
    resolveDisplayMode(preferences.primaryMode, DEFAULT_PRIMARY_FORMAT) ?? DEFAULT_PRIMARY_FORMAT;
  const secondaryFormat = resolveDisplayMode(preferences.secondaryMode, DEFAULT_SECONDARY_FORMAT);
  const anchorBeat = transport.renderStartTime;
  const anchorSeconds = tempoMap.beatsToSeconds(anchorBeat);
  const hasLiveClock =
    (playback.status === 'playing' || playback.status === 'stopping') && playback.hasClock;

  if (!hasLiveClock) {
    return {
      primaryText: formatToolbarPosition(anchorBeat, primaryFormat, transport),
      secondaryText: secondaryFormat
        ? formatToolbarPosition(anchorBeat, secondaryFormat, transport)
        : null,
      displayBeat: anchorBeat,
      displaySeconds: anchorSeconds,
      source: 'idle-anchor',
    };
  }

  const displaySeconds = anchorSeconds + playback.elapsedSeconds;
  const displayBeat = tempoMap.secondsToBeats(displaySeconds);

  return {
    primaryText: formatToolbarPosition(displayBeat, primaryFormat, transport),
    secondaryText: secondaryFormat
      ? formatToolbarPosition(displayBeat, secondaryFormat, transport)
      : null,
    displayBeat,
    displaySeconds,
    source: playback.source,
  };
}

export const DEFAULT_SELECTION_FORMAT: TimeBase = TimeBase.BBF;

export function buildSelectionDisplayState(
  transport: ToolbarSelectionTransportSnapshot,
  format: TimeBase = DEFAULT_SELECTION_FORMAT,
): ToolbarSelectionDisplayState {
  if (transport.renderEndTime <= transport.renderStartTime) {
    return {
      startText: '—',
      endText: '—',
      durationText: '—',
      hasSelection: false,
    };
  }

  const hasDuration = transport.renderEndTime > transport.renderStartTime;
  const durationBeats = hasDuration ? transport.renderEndTime - transport.renderStartTime : 0;

  return {
    startText: formatToolbarPosition(transport.renderStartTime, format, transport),
    endText: formatToolbarPosition(transport.renderEndTime, format, transport),
    durationText: hasDuration ? formatToolbarPosition(durationBeats, format, transport) : '—',
    hasSelection: true,
  };
}
