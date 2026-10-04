/**
 * TempoPoint — a single point in a TempoMap.
 * Mirrors the Java TempoPoint class.
 *
 * Has a position (TimePosition), tempo (BPM), and curve type (CONSTANT or LINEAR).
 * The position determines where in the timeline this tempo takes effect.
 * Cached beat and accumulatedTime fields are computed by TempoMap.
 */
import { CurveType } from './curve-type';
import { TimePosition } from './time-position';
import { Element } from '../serialization/xml-reader';
import { XmlLoadContext } from '../serialization/xml-load';
import { checkRoot, checkShape, parseXmlNumber } from '../utilities/xml';

export class TempoPoint {
  position: TimePosition;
  tempo: number;
  curveType: CurveType;
  enabled: boolean = true;
  visible: boolean = false;

  /** Cached beat position, computed by TempoMap.recalculateAccumulatedTimes(). */
  beat: number = 0;
  /** Cached accumulated time in seconds, computed by TempoMap. */
  accumulatedTime: number = 0;

  /**
   * Constructor.
   * - TempoPoint(position?: TimePosition, tempo?: number, curveType?: CurveType)
   * - TempoPoint(beat?: number, tempo?: number, curveType?: CurveType) — creates beats position
   */
  constructor(
    position?: TimePosition | number,
    tempo: number = 60,
    curveType: CurveType = CurveType.LINEAR,
  ) {
    if (typeof position === 'number') {
      this.position = TimePosition.beats(position);
      this.beat = position;
    } else {
      this.position = position ?? TimePosition.beats(0);
    }
    this.tempo = tempo;
    this.curveType = curveType;
  }

  // ─── XML Serialization ───

  saveAsXML(): Element {
    const elem = new Element('tempoPoint');
    elem.setAttribute('tempo', this.tempo.toString());
    elem.setAttribute('curve', this.curveType.toString());
    elem.addElement(this.position.saveAsXML().setName('timePosition'));
    return elem;
  }

  static loadFromXML(data: Element, context = new XmlLoadContext(data)): TempoPoint {
    checkRoot(data, 'tempoPoint', context);
    checkShape(data, ['tempo', 'curve', 'beat'], ['timePosition'], context);
    const tempoToken = data.getAttribute('tempo');
    const tempo = tempoToken === null ? 60 : parseXmlNumber(tempoToken, context.at(data), '@tempo');
    if (tempo <= 0)
      throw context.at(data).error({
        code: 'value',
        member: '@tempo',
        value: tempoToken ?? '',
        message: 'Tempo must be positive.',
        recovery: 'Supply a positive BPM value.',
      });
    const curveToken = data.getAttribute('curve') ?? 'LINEAR';
    if (curveToken !== 'LINEAR' && curveToken !== 'CONSTANT')
      throw context.at(data).error({
        code: 'value',
        member: '@curve',
        value: curveToken,
        message: 'Unknown tempo curve.',
        recovery: 'Use CONSTANT or LINEAR.',
      });
    const curve = curveToken as CurveType;

    // Try to load <timePosition> child element
    const posElem = data.getElement('timePosition');
    let position: TimePosition;
    if (posElem) {
      if (tempoToken === null)
        throw context.at(data).error({
          code: 'cardinality',
          member: '@tempo',
          message: 'Typed tempo point requires tempo.',
          recovery: 'Supply a tempo attribute.',
        });
      position = TimePosition.loadFromXML(posElem, context);
      const beat = data.getAttribute('beat');
      if (
        beat !== null &&
        (!position.isBeatTime() ||
          parseXmlNumber(beat, context.at(data), '@beat') !== position.getValue())
      )
        throw context.at(data).error({
          code: 'conflict',
          member: '@beat',
          value: beat,
          message: 'Legacy beat conflicts with typed position.',
          recovery: 'Keep one consistent position.',
        });
    } else {
      // Legacy format: beat as attribute
      const beatAttr = data.getAttribute('beat');
      if (beatAttr === null)
        throw context.at(data).error({
          code: 'cardinality',
          member: 'timePosition',
          message: 'Tempo point requires a position.',
          recovery: 'Supply timePosition or the historical beat attribute.',
        });
      position = TimePosition.beats(parseXmlNumber(beatAttr, context.at(data), '@beat'));
    }

    if (position.isBeatTime() && position.getValue() < 0)
      throw context.at(data).error({
        code: 'value',
        message: 'Tempo point position must be nonnegative.',
        recovery: 'Move the tempo point to a nonnegative position.',
      });
    const tp = new TempoPoint(position, tempo, curve);
    tp.beat = position.getTimeBase() === ('BEATS' as any) ? position.getValue() : 0;
    return tp;
  }
}
