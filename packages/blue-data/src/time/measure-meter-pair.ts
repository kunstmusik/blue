/**
 * MeasureMeterPair — pairs a measure number with a Meter.
 * Mirrors the Java MeasureMeterPair class.
 *
 * Used by MeterMap to track time signature changes at specific measures.
 * Measure numbers are 1-based.
 */
import { Meter } from './meter';
import { Element } from '../serialization/xml-reader';
import { XmlLoadContext } from '../serialization/xml-load';
import { checkRoot, checkShape, readInt } from '../utilities/xml';

/** Immutable meter change that begins at a specified measure. */
export class MeasureMeterPair {
  /** One-based measure at which the meter takes effect. */
  readonly measure: number;
  /** Time signature in effect from this measure until the next change. */
  readonly meter: Meter;

  /** Creates a meter change, defaulting to 4/4 at measure 1. */
  constructor(measure: number = 1, meter: Meter = new Meter()) {
    this.measure = measure;
    this.meter = meter;
  }

  /** Returns the one-based measure number. */
  getMeasureNumber(): number {
    return this.measure;
  }
  /** Returns the time signature effective at this entry. */
  getMeter(): Meter {
    return this.meter;
  }

  /** Returns a new entry with the given measure number and the existing time signature. */
  withMeasureNumber(measure: number): MeasureMeterPair {
    return new MeasureMeterPair(measure, this.meter);
  }

  /** Returns a new entry with the existing measure number and the given time signature. */
  withMeter(meter: Meter): MeasureMeterPair {
    return new MeasureMeterPair(this.measure, meter);
  }

  /** Tests whether the measure number and time signature match. */
  equals(other: MeasureMeterPair): boolean {
    return this.measure === other.measure && this.meter.equals(other.meter);
  }

  // ─── XML Serialization ───

  /** Writes the measure number and meter to a new XML element. */
  saveAsXML(): Element {
    const elem = new Element('measureMeterPair');
    elem.addElement('measureNumber').setText(this.measure.toString());
    elem.addElement(this.meter.saveAsXML());
    return elem;
  }

  /** Reads the measure and meter, accepting the legacy measure name when it agrees with the canonical field. */
  static loadFromXML(data: Element, context = new XmlLoadContext(data)): MeasureMeterPair {
    checkRoot(data, 'measureMeterPair', context);
    checkShape(data, [], ['measureNumber', 'measure', 'meter'], context);
    const current = data.getElement('measureNumber');
    const legacy = data.getElement('measure');
    const measure = current
      ? readInt(current, context, 1)
      : legacy
        ? readInt(legacy, context, 1)
        : 1;
    if (current && legacy && readInt(legacy, context, 1) !== measure)
      throw context.at(legacy).error({
        code: 'conflict',
        message: 'Conflicting measure aliases.',
        recovery: 'Keep one measure number.',
      });
    const meterElem = data.getElement('meter');
    const meter = meterElem ? Meter.loadFromXML(meterElem, context) : new Meter();
    return new MeasureMeterPair(measure, meter);
  }
}
