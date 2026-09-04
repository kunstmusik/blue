/**
 * TempoPoint — a single point in a TempoMap.
 * Mirrors the Java TempoPoint class.
 *
 * Has a position (TimePosition), tempo (BPM), and curve type (CONSTANT or LINEAR).
 * The position determines where in the timeline this tempo takes effect.
 * Cached beat and accumulatedTime fields are computed by TempoMap.
 */
import { CurveType, parseCurveType } from './curve-type';
import { TimePosition } from './time-position';
import { Element } from '../serialization/xml-reader';

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

  static loadFromXML(data: Element): TempoPoint {
    const tempo = parseFloat(data.getAttribute('tempo') ?? '60');
    const curve = parseCurveType(data.getAttribute('curve'));

    // Try to load <timePosition> child element
    const posElem = data.getElement('timePosition');
    let position: TimePosition;
    if (posElem) {
      position = TimePosition.loadFromXML(posElem);
    } else {
      // Legacy format: beat as attribute
      const beatAttr = data.getAttribute('beat');
      position = TimePosition.beats(beatAttr ? parseFloat(beatAttr) : 0);
    }

    const tp = new TempoPoint(position, tempo, curve);
    tp.beat = position.getTimeBase() === ('BEATS' as any) ? position.getValue() : 0;
    return tp;
  }
}
