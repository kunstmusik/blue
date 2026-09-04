/**
 * MeterMap — manages time signature changes across the timeline.
 * Mirrors the Java MeterMap class.
 *
 * Maps measure numbers to Meter objects, providing conversion between
 * bar/beat positions and absolute beat positions.
 */
import { Meter } from './meter';
import { MeasureMeterPair } from './measure-meter-pair';
import { Element } from '../serialization/xml-reader';

/** Default PPQ (pulses per quarter note), matching Java. */
export const DEFAULT_PPQ = 960;

export class MeterMap {
  private entries: MeasureMeterPair[] = [new MeasureMeterPair(1, new Meter(4, 4))];
  private measureStartBeats: number[] = [0.0];
  private listeners: Array<() => void> = [];

  size(): number {
    return this.entries.length;
  }

  get(index: number): MeasureMeterPair {
    return this.entries[index];
  }

  getEntries(): ReadonlyArray<MeasureMeterPair> {
    return this.entries;
  }

  /** Get the meter in effect at the given measure (1-based). */
  getMeterForMeasure(measure: number): Meter {
    for (let i = this.entries.length - 1; i >= 0; i--) {
      if (measure >= this.entries[i].measure) {
        return this.entries[i].meter;
      }
    }
    return this.entries[0].meter;
  }

  /** Get the meter in effect at the given beat position. */
  getMeterAtBeat(beat: number): Meter {
    for (let i = this.entries.length - 1; i >= 0; i--) {
      if (beat >= this.measureStartBeats[i]) {
        return this.entries[i].meter;
      }
    }
    return this.entries[0].meter;
  }

  /** Add a new meter entry at the given measure. */
  add(entry: MeasureMeterPair): void {
    // Remove existing entry at same measure
    this.entries = this.entries.filter((e) => e.measure !== entry.measure);
    this.entries.push(entry);
    this.entries.sort((a, b) => a.measure - b.measure);
    this.updateMeasureStartBeats();
    this.fireListeners();
  }

  /** Replace the entry at the given index. */
  set(index: number, entry: MeasureMeterPair): void {
    this.entries[index] = entry;
    this.entries.sort((a, b) => a.measure - b.measure);
    this.updateMeasureStartBeats();
    this.fireListeners();
  }

  /** Remove all entries. */
  clear(): void {
    this.entries = [];
    this.measureStartBeats = [];
  }

  /** Replace all entries from a source MeterMap. */
  replaceAll(source: MeterMap): void {
    this.entries = source.entries.map(
      (e) => new MeasureMeterPair(e.measure, new Meter(e.meter.numBeats, e.meter.beatLength)),
    );
    this.updateMeasureStartBeats();
    this.fireListeners();
  }

  addListener(listener: () => void): void {
    this.listeners.push(listener);
  }

  private fireListeners(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  /**
   * Recompute cached measure start beats.
   * After calling this, measureStartBeats[i] = the absolute beat position
   * where entries[i].measure begins.
   */
  updateMeasureStartBeats(): void {
    this.measureStartBeats = new Array(this.entries.length);
    this.measureStartBeats[0] = 0.0;

    for (let i = 1; i < this.entries.length; i++) {
      const prevEntry = this.entries[i - 1];
      const curEntry = this.entries[i];
      const measuresBetween = curEntry.measure - prevEntry.measure;
      const beatsPerMeasure = prevEntry.meter.getBeatsPerMeasure();
      this.measureStartBeats[i] = this.measureStartBeats[i - 1] + measuresBetween * beatsPerMeasure;
    }
  }

  /**
   * Convert a bar/beat position to absolute Csound beats.
   * Bar and beat are 1-based (matching musical convention).
   *
   * @throws Error if bar < 1, beat < 1, or beat exceeds meter's numBeats
   */
  barBeatToBeats(bar: number, beat: number): number {
    if (this.entries.length === 0) {
      throw new Error('MeterMap is empty');
    }
    if (bar < 1) {
      throw new Error(`Invalid bar number: ${bar} (must be >= 1)`);
    }
    if (beat < 1) {
      throw new Error(`Invalid beat number: ${beat} (must be >= 1)`);
    }

    // Find the meter entry for this bar
    let entryIndex = 0;
    for (let i = this.entries.length - 1; i >= 0; i--) {
      if (bar >= this.entries[i].measure) {
        entryIndex = i;
        break;
      }
    }

    const entry = this.entries[entryIndex];
    const meter = entry.meter;

    // Validate beat doesn't exceed meter's numBeats
    if (beat > meter.numBeats) {
      throw new Error(`Beat ${beat} exceeds meter's numBeats ${meter.numBeats} in bar ${bar}`);
    }

    const measuresFromEntry = bar - entry.measure;
    const startBeat = this.measureStartBeats[entryIndex];
    const beatScale = meter.getBeatScale();

    return startBeat + measuresFromEntry * meter.getBeatsPerMeasure() + (beat - 1) * beatScale;
  }

  /**
   * Convert absolute beats to a BBT position {bar, beat, ticks}.
   * Ticks are in the range [0, ppq).
   */
  beatsToBBT(
    beats: number,
    ppq: number = DEFAULT_PPQ,
  ): { bar: number; beat: number; ticks: number } {
    if (this.entries.length === 0) {
      throw new Error('MeterMap is empty');
    }
    if (beats < 0) {
      throw new Error(`Invalid beats: ${beats} (must be >= 0)`);
    }

    // Find the entry whose measureStartBeats <= beats
    let entryIndex = 0;
    for (let i = this.entries.length - 1; i >= 0; i--) {
      if (beats >= this.measureStartBeats[i]) {
        entryIndex = i;
        break;
      }
    }

    const entry = this.entries[entryIndex];
    const meter = entry.meter;
    const startBeat = this.measureStartBeats[entryIndex];
    const beatsPerMeasure = meter.getBeatsPerMeasure();
    const beatScale = meter.getBeatScale();

    const beatsFromEntry = beats - startBeat;
    const measuresFromEntry = Math.floor(beatsFromEntry / beatsPerMeasure);
    const remainingBeats = beatsFromEntry - measuresFromEntry * beatsPerMeasure;

    // beat is 1-based, compute fractional part as ticks
    const fullBeats = Math.floor(remainingBeats / beatScale);
    const fractionalBeat = remainingBeats - fullBeats * beatScale;
    let ticks = Math.round((fractionalBeat * ppq) / beatScale);

    let bar = entry.measure + measuresFromEntry;
    let beat = fullBeats + 1;

    if (ticks >= ppq) {
      ticks = 0;
      beat += 1;
      if (beat > meter.numBeats) {
        beat = 1;
        bar += 1;
      }
    }

    return { bar, beat, ticks };
  }

  /**
   * Convert absolute beats to a BBST position.
   * Returns {bar, beat, sixteenth, ticks} where beat is 1-based, sixteenth is 1-4.
   */
  beatsToBBST(
    beats: number,
    ppq: number = DEFAULT_PPQ,
  ): { bar: number; beat: number; sixteenth: number; ticks: number } {
    const bbt = this.beatsToBBT(beats, ppq);
    const sixteenthTicks = ppq / 4;
    const sixteenth = Math.floor(bbt.ticks / sixteenthTicks) + 1;
    const ticks = bbt.ticks % sixteenthTicks;
    return { bar: bbt.bar, beat: bbt.beat, sixteenth: Math.min(sixteenth, 4), ticks };
  }

  /**
   * Convert absolute beats to a BBF position.
   * Returns {bar, beat, fraction} where fraction is canonical hundredths.
   * Rounding overflow carries to the next beat, matching Java Blue 2.10.2.
   */
  beatsToBBF(beats: number): { bar: number; beat: number; fraction: number } {
    if (this.entries.length === 0) {
      throw new Error('MeterMap is empty');
    }
    if (beats < 0) {
      throw new Error(`Invalid beats: ${beats} (must be >= 0)`);
    }

    let entryIndex = 0;
    for (let i = this.entries.length - 1; i >= 0; i--) {
      if (beats >= this.measureStartBeats[i]) {
        entryIndex = i;
        break;
      }
    }

    const entry = this.entries[entryIndex];
    const meter = entry.meter;
    const startBeat = this.measureStartBeats[entryIndex];
    const beatsPerMeasure = meter.getBeatsPerMeasure();
    const beatScale = meter.getBeatScale();

    const beatsFromEntry = beats - startBeat;
    const measuresFromEntry = Math.floor(beatsFromEntry / beatsPerMeasure);
    const remainingBeats = beatsFromEntry - measuresFromEntry * beatsPerMeasure;

    const beatWithFraction = 1 + remainingBeats / beatScale;
    let beat = Math.floor(beatWithFraction);
    let fraction = Math.round((beatWithFraction - beat) * 100);
    let bar = entry.measure + measuresFromEntry;

    if (fraction >= 100) {
      fraction = 0;
      beat += 1;
      if (beat > meter.numBeats) {
        beat = 1;
        bar += 1;
      }
    }

    return { bar, beat, fraction };
  }

  equals(other: MeterMap): boolean {
    if (this.entries.length !== other.entries.length) return false;
    for (let i = 0; i < this.entries.length; i++) {
      if (!this.entries[i].equals(other.entries[i])) return false;
    }
    return true;
  }

  hashCode(): number {
    let h = 0;
    for (const entry of this.entries) {
      h = ((h * 31 + entry.measure) >>> 0) | 0;
    }
    return h;
  }

  // ─── XML Serialization ───

  saveAsXML(): Element {
    const elem = new Element('meterMap');
    for (const entry of this.entries) {
      elem.addElement(entry.saveAsXML());
    }
    return elem;
  }

  static loadFromXML(data: Element): MeterMap {
    const map = new MeterMap();
    map.entries = [];

    const entries = data.getElements('measureMeterPair');
    while (entries.hasMoreElements()) {
      const entry = MeasureMeterPair.loadFromXML(entries.next());
      map.entries.push(entry);
    }

    // Default to 4/4 if no entries found
    if (map.entries.length === 0) {
      map.entries.push(new MeasureMeterPair(1, new Meter(4, 4)));
    }

    map.updateMeasureStartBeats();
    return map;
  }
}
