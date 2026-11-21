/**
 * Meter — an immutable time signature value object.
 * Mirrors the Java Meter class.
 *
 * For example, 4/4 time has numBeats=4, beatLength=4.
 * 6/8 time has numBeats=6, beatLength=8.
 */
import { Element } from '../serialization/xml-reader';
import { XmlLoadContext } from '../serialization/xml-load';
import { checkRoot, checkShape, readInt } from '../utilities/xml';

/** Immutable time signature expressed as the number of beats per measure and the denominator of the beat unit. */
export class Meter {
  /** Time signature numerator, or number of beats per measure in this meter. */
  readonly numBeats: number;
  /** Time signature denominator. For example, 8 indicates eighth-note beats. */
  readonly beatLength: number;

  /** Creates a time signature. Omitting both arguments yields 4/4. */
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

  /** Formats the time signature as numerator/denominator. */
  toString(): string {
    return `${this.numBeats}/${this.beatLength}`;
  }

  /** Computes a hash from the numerator and denominator. */
  hashCode(): number {
    return (((this.numBeats * 31 + this.beatLength) >>> 0) * 2654435761) | 0;
  }

  /** Tests whether both components of the time signature match. */
  equals(other: Meter): boolean {
    return this.numBeats === other.numBeats && this.beatLength === other.beatLength;
  }

  // ─── XML Serialization ───

  /** Writes the time signature components to a new meter element. */
  saveAsXML(): Element {
    const elem = new Element('meter');
    elem.addElement('numBeats').setText(this.numBeats.toString());
    elem.addElement('beatLength').setText(this.beatLength.toString());
    return elem;
  }

  /** Loads a meter from XML. Omitted components default to 4. */
  static loadFromXML(data: Element, context = new XmlLoadContext(data)): Meter {
    checkRoot(data, 'meter', context);
    checkShape(data, [], ['numBeats', 'beatLength'], context);
    const numBeats = data.getElement('numBeats');
    const beatLength = data.getElement('beatLength');
    return new Meter(
      numBeats ? readInt(numBeats, context, 1) : 4,
      beatLength ? readInt(beatLength, context, 1) : 4,
    );
  }
}
