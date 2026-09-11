import type { MeterBindingMapPayload, MeterFramePayload } from '../../shared/meter-types';

export interface MeterDisplayState {
  readonly barLevels: readonly number[]; // in dBFS (-Infinity to +6 dBFS)
  readonly peakHoldLevels: readonly number[]; // in dBFS
  readonly clipFlags: readonly boolean[];
  readonly nchnls: number;
}

export const DECAY_RATE_DB_PER_SEC = 20.0;
export const PEAK_HOLD_DURATION_SEC = 1.0;
export const CLIP_LATCH_DURATION_SEC = 2.0;
export const MIN_DB = -60.0;
export const MAX_DB = 6.0;
export const CLIP_THRESHOLD_DB = 0.0;
export const LINEAR_AMP_FLOOR = 1e-5;

export function ampToDb(amp: number): number {
  if (!Number.isFinite(amp) || amp <= LINEAR_AMP_FLOOR) {
    return -Infinity;
  }
  return 20 * Math.log10(amp);
}

interface StripInternalState {
  stripId: string;
  nchnls: number;
  barLevels: number[];
  peakHoldLevels: number[];
  clipFlags: boolean[];
  targetRms: number[];
  targetPeak: number[];
  peakHoldTimers: number[];
  clipTimers: number[];
}

export class MeterStore {
  private csdKeyToStripId = new Map<string, string>();
  private strips = new Map<string, StripInternalState>();
  private uniqueStrips: StripInternalState[] = [];
  private lastSequence = 0;
  private lastUpdateTime = 0;
  private unsubs: Array<() => void> = [];
  private bindingListeners: Array<() => void> = [];

  constructor() {
    this.reset();
  }

  onBindingMapChange(cb: () => void): () => void {
    this.bindingListeners.push(cb);
    return () => {
      this.bindingListeners = this.bindingListeners.filter((l) => l !== cb);
    };
  }

  init(): () => void {
    const win =
      typeof window !== 'undefined'
        ? (window as unknown as {
            blueAPI?: {
              onMeterBindingMap?: (cb: (map: MeterBindingMapPayload) => void) => () => void;
              onMeterFrame?: (cb: (frame: MeterFramePayload) => void) => () => void;
              onMeterReset?: (cb: () => void) => () => void;
            };
          })
        : undefined;

    if (win?.blueAPI) {
      if (win.blueAPI.onMeterBindingMap) {
        this.unsubs.push(
          win.blueAPI.onMeterBindingMap((map: MeterBindingMapPayload) => {
            this.setBindingMap(map);
          }),
        );
      }
      if (win.blueAPI.onMeterFrame) {
        this.unsubs.push(
          win.blueAPI.onMeterFrame((frame: MeterFramePayload) => {
            this.processMeterFrame(frame);
          }),
        );
      }
      if (win.blueAPI.onMeterReset) {
        this.unsubs.push(
          win.blueAPI.onMeterReset(() => {
            this.reset();
          }),
        );
      }
    }

    return () => {
      this.dispose();
    };
  }

  dispose(): void {
    for (const unsub of this.unsubs) {
      try {
        unsub();
      } catch {
        // Safe disposal
      }
    }
    this.unsubs = [];
    this.reset();
  }

  setBindingMap(payload: MeterBindingMapPayload): void {
    this.csdKeyToStripId.clear();
    this.strips.clear();
    this.uniqueStrips = [];
    this.lastSequence = 0;
    this.lastUpdateTime = 0;

    const nchnls = payload.nchnls > 0 ? payload.nchnls : 2;

    for (const entry of payload.entries) {
      this.csdKeyToStripId.set(entry.csdKey, entry.stripId);

      const stripState: StripInternalState = {
        stripId: entry.stripId,
        nchnls,
        barLevels: new Array(nchnls).fill(-Infinity),
        peakHoldLevels: new Array(nchnls).fill(-Infinity),
        clipFlags: new Array(nchnls).fill(false),
        targetRms: new Array(nchnls).fill(0),
        targetPeak: new Array(nchnls).fill(0),
        peakHoldTimers: new Array(nchnls).fill(0),
        clipTimers: new Array(nchnls).fill(0),
      };

      this.uniqueStrips.push(stripState);
      this.strips.set(entry.stripId, stripState);
    }

    for (const listener of this.bindingListeners) {
      try {
        listener();
      } catch {
        // Safe listener dispatch
      }
    }
  }

  processMeterFrame(payload: MeterFramePayload, nowMs = performance.now()): void {
    if (payload.sequence <= this.lastSequence) {
      // Drop stale frames
      return;
    }
    this.lastSequence = payload.sequence;

    for (const channelReading of payload.channels) {
      const stripId = this.csdKeyToStripId.get(channelReading.csdKey);
      if (!stripId) continue;

      const strip = this.strips.get(stripId);
      if (!strip) continue;

      const nchnls = strip.nchnls;
      for (let ch = 0; ch < nchnls; ch++) {
        let rawRms = channelReading.rms[ch] ?? 0;
        let rawPeak = channelReading.peak[ch] ?? 0;

        // Sanitize non-finite values
        if (!Number.isFinite(rawRms) || rawRms < 0) rawRms = 0;
        if (!Number.isFinite(rawPeak) || rawPeak < 0) rawPeak = 0;

        strip.targetRms[ch] = rawRms;
        strip.targetPeak[ch] = rawPeak;

        // Instantaneous attack
        const rmsDb = ampToDb(rawRms);
        if (rmsDb > strip.barLevels[ch]!) {
          strip.barLevels[ch] = rmsDb;
        }

        const peakDb = ampToDb(rawPeak);
        if (peakDb >= strip.peakHoldLevels[ch]!) {
          strip.peakHoldLevels[ch] = peakDb;
          strip.peakHoldTimers[ch] = PEAK_HOLD_DURATION_SEC;
        }

        if (rawPeak >= 1.0 || peakDb >= CLIP_THRESHOLD_DB) {
          strip.clipFlags[ch] = true;
          strip.clipTimers[ch] = CLIP_LATCH_DURATION_SEC;
        }
      }
    }
  }

  update(nowMs = performance.now()): void {
    if (this.lastUpdateTime > 0 && nowMs <= this.lastUpdateTime) {
      return;
    }
    const dt = this.lastUpdateTime > 0 ? Math.max(0, (nowMs - this.lastUpdateTime) / 1000) : 0;
    this.lastUpdateTime = nowMs;

    if (dt <= 0) return;

    for (const strip of this.uniqueStrips) {
      for (let ch = 0; ch < strip.nchnls; ch++) {
        const targetRmsDb = ampToDb(strip.targetRms[ch] ?? 0);

        // Decay bar level towards target RMS or -Infinity
        if (strip.barLevels[ch]! > targetRmsDb) {
          strip.barLevels[ch] = Math.max(
            targetRmsDb,
            strip.barLevels[ch]! - DECAY_RATE_DB_PER_SEC * dt,
          );
        } else if (strip.barLevels[ch]! < targetRmsDb) {
          strip.barLevels[ch] = targetRmsDb;
        }

        // Peak hold: consume hold timer first, then decay with any remaining delta time
        let remainingDt = dt;
        if (strip.peakHoldTimers[ch]! > 0) {
          const holdConsumed = Math.min(strip.peakHoldTimers[ch]!, remainingDt);
          strip.peakHoldTimers[ch]! -= holdConsumed;
          remainingDt -= holdConsumed;
        }

        if (remainingDt > 0 && strip.peakHoldLevels[ch]! > targetRmsDb) {
          strip.peakHoldLevels[ch] = Math.max(
            targetRmsDb,
            strip.peakHoldLevels[ch]! - DECAY_RATE_DB_PER_SEC * remainingDt,
          );
        }

        // Clip latch timer
        if (strip.clipTimers[ch]! > 0) {
          strip.clipTimers[ch]! -= dt;
          if (strip.clipTimers[ch]! <= 0) {
            strip.clipFlags[ch] = false;
            strip.clipTimers[ch] = 0;
          }
        }
      }
    }
  }

  getStripState(stripId: string): MeterDisplayState | undefined {
    const strip = this.strips.get(stripId);
    if (!strip) return undefined;

    return {
      barLevels: [...strip.barLevels],
      peakHoldLevels: [...strip.peakHoldLevels],
      clipFlags: [...strip.clipFlags],
      nchnls: strip.nchnls,
    };
  }

  clearClip(stripId: string, channelIndex?: number): void {
    const strip = this.strips.get(stripId);
    if (!strip) return;

    if (channelIndex !== undefined && channelIndex >= 0 && channelIndex < strip.nchnls) {
      strip.clipFlags[channelIndex] = false;
      strip.clipTimers[channelIndex] = 0;
    } else {
      for (let ch = 0; ch < strip.nchnls; ch++) {
        strip.clipFlags[ch] = false;
        strip.clipTimers[ch] = 0;
      }
    }
  }

  getLastUpdateTime(): number {
    return this.lastUpdateTime;
  }

  reset(): void {
    this.lastSequence = 0;
    this.lastUpdateTime = 0;
    for (const strip of this.uniqueStrips) {
      for (let ch = 0; ch < strip.nchnls; ch++) {
        strip.barLevels[ch] = -Infinity;
        strip.peakHoldLevels[ch] = -Infinity;
        strip.clipFlags[ch] = false;
        strip.targetRms[ch] = 0;
        strip.targetPeak[ch] = 0;
        strip.peakHoldTimers[ch] = 0;
        strip.clipTimers[ch] = 0;
      }
    }
  }
}

export const meterStore = new MeterStore();
