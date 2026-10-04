/**
 * TimeContext — provides context for time conversions.
 * Mirrors the Java TimeContext class.
 *
 * Contains TempoMap, MeterMap, sample rate, and SMPTE frame rate.
 */
import { TempoMap } from './tempo-map';
import { MeterMap } from './meter-map';
import { Element } from '../serialization/xml-reader';
import { XmlLoadContext, requireXmlValue } from '../serialization/xml-load';
import type { XmlDiagnosticSink } from '../serialization/xml-load';
import {
  checkRoot,
  checkShape,
  readDouble,
  readInt,
  readText,
  parseXmlNumber,
} from '../utilities/xml';
import { resolveSmpteRate } from './smpte-timecode';

/** Default sample rate. */
const DEFAULT_SAMPLE_RATE = 44100;

export class TimeContext {
  private tempoMap = new TempoMap();
  private meterMap = new MeterMap();
  private sampleRate = DEFAULT_SAMPLE_RATE;
  private smpteFrameRate = 30;

  constructor(other?: TimeContext) {
    if (other) {
      this.tempoMap = new TempoMap(other.tempoMap);
      this.meterMap = new MeterMap();
      this.meterMap.replaceAll(other.meterMap);
      this.sampleRate = other.sampleRate;
      this.smpteFrameRate = other.smpteFrameRate;
    }
  }

  // ─── Accessors ───

  getTempoMap(): TempoMap {
    return this.tempoMap;
  }

  setTempoMap(tempoMap: TempoMap): void {
    this.tempoMap = tempoMap;
  }

  getMeterMap(): MeterMap {
    return this.meterMap;
  }

  setMeterMap(meterMap: MeterMap): void {
    this.meterMap = meterMap;
  }

  getSampleRate(): number {
    return this.sampleRate;
  }

  setSampleRate(rate: number): void {
    this.sampleRate = rate;
  }

  getSmpteFrameRate(): number {
    return this.smpteFrameRate;
  }

  setSmpteFrameRate(rate: number): void {
    this.smpteFrameRate = rate;
  }

  /** Get SMPTE frames per second as a number. */
  getSmpteFramesPerSecond(): number {
    return this.smpteFrameRate;
  }

  /** Get beat duration in seconds (60 / BPM). */
  getBeatDuration(): number {
    return this.tempoMap.getBeatDuration();
  }

  /** Convert beats to seconds. */
  beatsToSeconds(beats: number): number {
    return this.tempoMap.beatsToSeconds(beats);
  }

  /** Convert seconds to beats. */
  secondsToBeats(seconds: number): number {
    return this.tempoMap.secondsToBeats(seconds);
  }

  /**
   * Check if this context has the same musical context as another
   * (same tempo map and meter map).
   */
  hasSameMusicalContext(other: TimeContext | null): boolean {
    if (!other) return false;
    if (this === other) return true;
    return this.tempoMap.equals(other.tempoMap) && this.meterMap.equals(other.meterMap);
  }

  // ─── XML Serialization ───

  saveAsXML(): Element {
    const elem = new Element('timeContext');
    elem.addElement(this.tempoMap.saveAsXML().setName('tempoMap'));
    elem.addElement(this.meterMap.saveAsXML().setName('meterMap'));
    elem.addElement('smpteFrameRate').setText(this.smpteFrameRate.toString());
    return elem;
  }

  static loadFromXML(
    data: Element,
    context?: XmlLoadContext,
    sink?: XmlDiagnosticSink,
  ): TimeContext {
    const operation = context ?? new XmlLoadContext(data);
    checkRoot(data, 'timeContext', operation);
    checkShape(
      data,
      [],
      ['tempoMap', 'meterMap', 'tempo', 'sampleRate', 'ppq', 'smpteFrameRate'],
      operation,
    );
    const ctx = new TimeContext();
    const rate = data.getElement('sampleRate');
    if (rate) {
      readInt(rate, operation, 1);
      throw operation.at(rate).error({
        code: 'reference',
        member: 'sampleRate',
        value: rate.getTextString(),
        message: 'Historical sample rate needs enclosing project reconciliation.',
        recovery:
          'Load the complete project to transfer or reconcile its authoritative sample rate.',
      });
    }
    const ppq = data.getElement('ppq');
    if (ppq) {
      if (readInt(ppq, operation, 1) !== 960)
        throw operation.at(ppq).error({
          code: 'value',
          value: ppq.getTextString(),
          message: 'Custom historical PPQ is unsupported.',
          recovery: 'Convert all project tick positions using a compatible historical editor.',
        });
      operation.at(ppq).diagnostic({
        code: 'P-PPQ',
        severity: 'warning',
        value: ppq.getTextString(),
        message: 'Historical PPQ 960 is redundant with the fixed tick resolution.',
        recovery: 'Canonical save safely omits this redundant field.',
      });
    }
    const meter = data.getElement('meterMap');
    const direct = data.getElement('tempoMap');
    const nested = meter?.getElement('tempoMap');
    if (direct) ctx.tempoMap = TempoMap.loadFromXML(direct, operation);
    if (nested) {
      const nestedMap = TempoMap.loadFromXML(nested, operation);
      if (direct && nestedMap.saveAsXML().toXml() !== ctx.tempoMap.saveAsXML().toXml())
        throw operation.at(nested).error({
          code: 'conflict',
          message: 'Direct and nested tempo maps disagree.',
          recovery: 'Keep one consistent tempo map.',
        });
      ctx.tempoMap = nestedMap;
    }
    const tempo = data.getElement('tempo');
    if (tempo) {
      const value = readDouble(tempo, operation);
      if (value <= 0)
        throw operation.at(tempo).error({
          code: 'value',
          value: tempo.getTextString(),
          message: 'Tempo must be positive.',
          recovery: 'Supply a positive BPM value.',
        });
      if (direct || nested)
        throw operation.at(tempo).error({
          code: 'conflict',
          message: 'Scalar tempo competes with an explicit tempo map.',
          recovery: 'Keep one tempo representation.',
        });
      ctx.tempoMap.setTempo(value);
      ctx.tempoMap.setEnabled(true);
    }
    if (meter) {
      if (nested) {
        const copy = meter.clone();
        operation.anchor(copy, meter);
        copy.removeElement('tempoMap');
        ctx.meterMap = MeterMap.loadFromXML(copy, operation);
      } else ctx.meterMap = MeterMap.loadFromXML(meter, operation);
    }
    const fps = data.getElement('smpteFrameRate');
    if (fps) {
      const token = readText(fps, operation).trim();
      const value = parseXmlNumber(
        token === '29.97df' ? '29.97' : token === '30df' ? '30' : token,
        operation.at(fps),
      );
      if (!resolveSmpteRate(value))
        throw operation.at(fps).error({
          code: 'value',
          value: token,
          message: 'Unsupported SMPTE frame rate.',
          recovery: 'Choose a supported SMPTE frame rate.',
        });
      ctx.smpteFrameRate = value;
    }
    let previous = -Infinity;
    for (const [index, point] of ctx.tempoMap.getTempoPoints().entries()) {
      const beat = point.position.toBeats(ctx);
      if (!Number.isFinite(beat) || beat < 0 || beat <= previous)
        throw operation
          .at((direct ?? nested)?.getElements('tempoPoint').toArray()[index] ?? data)
          .error({
            code: 'conflict',
            message: 'Tempo points must have distinct ascending resolved positions.',
            recovery: 'Correct tempo positions using the declared meter and time context.',
          });
      previous = beat;
    }
    ctx.tempoMap.recalculateBeatPositions(ctx);
    return context ? ctx : requireXmlValue(operation.result(ctx), sink);
  }
}
