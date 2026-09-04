/**
 * Meter — an immutable time signature value object.
 * Mirrors the Java Meter class.
 *
 * For example, 4/4 time has numBeats=4, beatLength=4.
 * 6/8 time has numBeats=6, beatLength=8.
 */
import { Element } from '../serialization/xml-reader';

export class Meter {
  readonly numBeats: number;
  readonly beatLength: number;

  constructor(numBeats: number = 4, beatLength: number = 4) {
    this.numBeats = numBeats;
    this.beatLength = beatLength;
  }

  /**
   * Get the duration of one measure in Csound beats (quarter notes).
   * For 4/4: 4 * (4/4) = 4 beats.
   * For 3/4: 3 * (4/4) = 3 beats.
   * For 6/8: 6 * (4/8) = 3 beats.
   */
  getBeatsPerMeasure(): number {
    return this.numBeats * (4.0 / this.beatLength);
  }

  /**
   * Get the beat scale factor — how many Csound beats per one beat of this meter.
   * For /4: 4/4 = 1.0 (quarter note = 1 beat).
   * For /8: 4/8 = 0.5 (eighth note = 0.5 beats).
   */
  getBeatScale(): number {
    return 4.0 / this.beatLength;
  }

  /** Alias for getBeatsPerMeasure — matches Java getMeasureBeatDuration(). */
  getMeasureBeatDuration(): number {
    return this.getBeatsPerMeasure();
  }

  toString(): string {
    return `${this.numBeats}/${this.beatLength}`;
  }

  hashCode(): number {
    return (((this.numBeats * 31 + this.beatLength) >>> 0) * 2654435761) | 0;
  }

  equals(other: Meter): boolean {
    return this.numBeats === other.numBeats && this.beatLength === other.beatLength;
  }

  // ─── XML Serialization ───

  saveAsXML(): Element {
    const elem = new Element('meter');
    elem.addElement('numBeats').setText(this.numBeats.toString());
    elem.addElement('beatLength').setText(this.beatLength.toString());
    return elem;
  }

  static loadFromXML(data: Element): Meter {
    const numBeats = parseInt(data.getTextString('numBeats') ?? '4', 10);
    const beatLength = parseInt(data.getTextString('beatLength') ?? '4', 10);
    return new Meter(numBeats || 4, beatLength || 4);
  }
}
