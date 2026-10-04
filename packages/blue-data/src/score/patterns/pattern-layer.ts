/**
 * PatternLayer — a layer that repeats a SoundObject at pattern positions.
 * Mirrors the Java PatternLayer class.
 *
 * PatternLayer holds a single SoundObject and a PatternData (boolean array).
 * During CSD generation, the sound object's notes are repeated at each position
 * where the pattern is active (true), offset by index * patternBeatsLength.
 */
import { Layer, LAYER_HEIGHT } from '../../score/layers/layer';
import { DEFAULT_LAYER_COLOR, normalizeLayerColor } from '../../score/layers/layer-color';
import { ScoreObject } from '../../score/score-object';
import { PatternData } from './pattern-data';
import { TimeContext } from '../../time/time-context';
import { CompileData } from '../../compile-data';
import { NoteList } from '../../sound-objects/note-list';
import { SoundObject } from '../../sound-objects/sound-object';
import { SoundObjectException } from '../../sound-objects/sound-object-exception';
import { GenericScore } from '../../sound-objects/generic-score';
import { loadSoundObjectFromXML } from '../../sound-objects/sound-object-registry';
import {
  XmlLoadContext,
  requireXmlValue,
  type XmlDiagnosticSink,
} from '../../serialization/xml-load';
import { checkRoot, checkShape, parseXmlBoolean, readInt } from '../../utilities/xml';
import { Element } from '../../serialization/xml-reader';
import { ObjRefSaveMap, ObjRefLoadMap } from '../../serialization/obj-ref-map';
import { setScoreStart } from '../../utilities/score';
import { TimeBehavior } from '../../sound-objects/time-behavior';
import { TimePosition } from '../../time/time-position';
import { TimeDuration } from '../../time/time-duration';
import type { CopyMode } from '../../deep-copyable';

export class PatternLayer implements Layer {
  private _soundObject: SoundObject;
  private _name = '';
  private _muted = false;
  private _solo = false;
  private _backgroundColor = DEFAULT_LAYER_COLOR;
  private _patternData: PatternData;

  constructor(other?: PatternLayer, mode: CopyMode = 'duplication') {
    if (other) {
      this._name = other._name;
      this._muted = other._muted;
      this._solo = other._solo;
      this._backgroundColor = other._backgroundColor;
      this._soundObject = other._soundObject.deepCopy(mode);
      this._patternData = new PatternData(other._patternData);
    } else {
      // Mirrors the Java PatternLayer constructor: a GenericScore with a real
      // beat-based start/duration (serializable) and no time behavior.
      this._soundObject = new GenericScore();
      this._soundObject.setBackgroundColor(this._backgroundColor);
      this._soundObject.setStartTime(TimePosition.beats(0));
      this._soundObject.setSubjectiveDuration(TimeDuration.beats(4));
      this._soundObject.setTimeBehavior(TimeBehavior.NONE);
      this._patternData = new PatternData();
    }
  }

  // ─── Layer ───

  getName(): string {
    return this._name;
  }
  setName(name: string): void {
    this._name = name;
  }

  getLayerHeight(): number {
    return LAYER_HEIGHT;
  }

  getBackgroundColor(): number {
    return this._backgroundColor;
  }
  setBackgroundColor(color: number): void {
    this._backgroundColor = normalizeLayerColor(color);
  }

  accepts(_object: ScoreObject): boolean {
    return false;
  }
  contains(_object: ScoreObject): boolean {
    return false;
  }
  remove(_object: ScoreObject): boolean {
    return false;
  }
  clearScoreObjects(): void {}

  deepCopy(mode: CopyMode = 'duplication'): PatternLayer {
    return new PatternLayer(this, mode);
  }

  // ─── PatternLayer-specific ───

  getSoundObject(): SoundObject {
    return this._soundObject;
  }

  setSoundObject(sObj: SoundObject): void {
    this._soundObject = sObj;
  }

  isMuted(): boolean {
    return this._muted;
  }
  setMuted(m: boolean): void {
    this._muted = m;
  }

  isSolo(): boolean {
    return this._solo;
  }
  setSolo(s: boolean): void {
    this._solo = s;
  }

  getPatternData(): PatternData {
    return this._patternData;
  }

  generateForCSD(
    context: TimeContext,
    compileData: CompileData,
    startTime: number,
    endTime: number,
    patternBeatsLength: number,
  ): NoteList {
    const notes = new NoteList();

    // Java Blue treats the row's embedded source object as a pattern template:
    // its own score start must not offset every generated cell.
    this._soundObject.setStartTime(TimePosition.beats(0));
    const baseNotes = this._soundObject.generateForCSD(context, compileData, -1, -1);

    let currentIndex = Math.floor(startTime / patternBeatsLength);
    while (currentIndex < this._patternData.getSize()) {
      if (this._patternData.isPatternSet(currentIndex)) {
        const time = currentIndex * patternBeatsLength;
        const copy = baseNotes.deepCopy();
        setScoreStart(copy, time);
        notes.merge(copy);
      }
      currentIndex++;
    }

    return notes;
  }

  // ─── XML Serialization ───

  saveAsXML(_objRefMap?: ObjRefSaveMap): Element {
    const elem = new Element('patternLayer');
    elem.setAttribute('name', this._name);
    elem.setAttribute('muted', this._muted.toString());
    elem.setAttribute('solo', this._solo.toString());

    elem.addElement('backgroundColor').setText(String(this._backgroundColor));
    if (this._soundObject) {
      elem.addElement(this._soundObject.saveAsXML(_objRefMap));
    }
    elem.addElement(this._patternData.saveAsXML());

    return elem;
  }

  static loadFromXML(
    data: Element,
    objRefMap?: ObjRefLoadMap,
    providedContext?: XmlLoadContext,
    sink?: XmlDiagnosticSink,
  ): PatternLayer {
    const context = providedContext ?? new XmlLoadContext(data);
    checkRoot(data, 'patternLayer', context);
    checkShape(
      data,
      ['name', 'muted', 'solo'],
      ['backgroundColor', 'soundObject', 'patternData'],
      context,
    );
    const layer = new PatternLayer();
    layer._name = data.getAttribute('name') ?? '';
    for (const field of ['muted', 'solo'] as const) {
      const raw = data.getAttribute(field);
      if (raw !== null)
        layer[field === 'muted' ? '_muted' : '_solo'] = parseXmlBoolean(
          raw,
          context.at(data),
          '@' + field,
        );
    }
    const color = data.getElement('backgroundColor');
    if (color) layer._backgroundColor = readInt(color, context, -2147483648, 2147483647);
    const object = data.getElement('soundObject');
    if (object) layer._soundObject = loadSoundObjectFromXML(object, objRefMap, context);
    const pattern = data.getElement('patternData');
    if (pattern) layer._patternData = PatternData.loadFromXML(pattern, context);
    return providedContext ? layer : requireXmlValue(context.result(layer), sink);
  }
}
