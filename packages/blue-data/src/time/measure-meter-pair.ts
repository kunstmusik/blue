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
