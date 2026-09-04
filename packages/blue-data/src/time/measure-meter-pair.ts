/**
 * MeasureMeterPair — pairs a measure number with a Meter.
 * Mirrors the Java MeasureMeterPair class.
 *
 * Used by MeterMap to track time signature changes at specific measures.
 * Measure numbers are 1-based.
 */
import { Meter } from './meter';
import { Element } from '../serialization/xml-reader';

export class MeasureMeterPair {
  readonly measure: number;
  readonly meter: Meter;

  constructor(measure: number = 1, meter: Meter = new Meter()) {
    this.measure = measure;
    this.meter = meter;
  }

  getMeasureNumber(): number {
    return this.measure;
  }
  getMeter(): Meter {
    return this.meter;
  }

  withMeasureNumber(measure: number): MeasureMeterPair {
    return new MeasureMeterPair(measure, this.meter);
  }

  withMeter(meter: Meter): MeasureMeterPair {
    return new MeasureMeterPair(this.measure, meter);
  }

  equals(other: MeasureMeterPair): boolean {
    return this.measure === other.measure && this.meter.equals(other.meter);
  }

  // ─── XML Serialization ───

  saveAsXML(): Element {
    const elem = new Element('measureMeterPair');
    elem.addElement('measureNumber').setText(this.measure.toString());
    elem.addElement(this.meter.saveAsXML());
    return elem;
  }

  static loadFromXML(data: Element): MeasureMeterPair {
    const measureText = data.getTextString('measureNumber') ?? data.getTextString('measure') ?? '1';
    const measure = parseInt(measureText, 10);
    const meterElem = data.getElement('meter');
    const meter = meterElem ? Meter.loadFromXML(meterElem) : new Meter();
    return new MeasureMeterPair(measure || 1, meter);
  }
}
