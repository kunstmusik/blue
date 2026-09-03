/**
 * PatternLayer — a layer that repeats a SoundObject at pattern positions.
 * Mirrors the Java PatternLayer class.
 *
 * PatternLayer holds a single SoundObject and a PatternData (boolean array).
 * During CSD generation, the sound object's notes are repeated at each position
 * where the pattern is active (true), offset by index * patternBeatsLength.
 */
import { Layer, LAYER_HEIGHT } from '../../score/layers/layer';
import { DEFAULT_LAYER_COLOR, normalizeLayerColor, normalizeXmlLayerColor } from '../../score/layers/layer-color';
import { ScoreObject } from '../../score/score-object';
import { PatternData } from './pattern-data';
import { TimeContext } from '../../time/time-context';
import { CompileData } from '../../compile-data';
import { NoteList } from '../../sound-objects/note-list';
import { SoundObject } from '../../sound-objects/sound-object';
import { SoundObjectException } from '../../sound-objects/sound-object-exception';
import { GenericScore } from '../../sound-objects/generic-score';
import { loadSoundObjectFromXML } from '../../sound-objects/sound-object-registry';
import { Element } from '../../serialization/xml-reader';
import { ObjRefSaveMap, ObjRefLoadMap } from '../../serialization/obj-ref-map';
import { setScoreStart } from '../../utilities/score';
import { TimeBehavior } from '../../sound-objects/time-behavior';
import { TimePosition } from '../../time/time-position';
import { TimeDuration } from '../../time/time-duration';

export class PatternLayer implements Layer {
  private _soundObject: SoundObject;
  private _name = '';
  private _muted = false;
  private _solo = false;
  private _backgroundColor = DEFAULT_LAYER_COLOR;
  private _patternData: PatternData;
  private _unknownAttributes = new Map<string, string>();
  private _unknownChildren: Element[] = [];
  private _unresolvedSoundObject: Element | null = null;

  constructor(other?: PatternLayer) {
    if (other) {
      this._name = other._name;
      this._muted = other._muted;
      this._solo = other._solo;
      this._backgroundColor = other._backgroundColor;
      this._soundObject = other._soundObject.deepCopy();
      this._patternData = new PatternData(other._patternData);

      for (const [k, v] of other._unknownAttributes) {
        this._unknownAttributes.set(k, v);
      }
      this._unknownChildren = other._unknownChildren.map((c) => c.clone());
      this._unresolvedSoundObject = other._unresolvedSoundObject?.clone() ?? null;
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

  getUnknownAttributes(): ReadonlyMap<string, string> {
    return this._unknownAttributes;
  }

  setUnknownAttribute(name: string, value: string): void {
    this._unknownAttributes.set(name, value);
  }

  getUnknownChildren(): readonly Element[] {
    return this._unknownChildren;
  }

  addUnknownChild(child: Element): void {
    this._unknownChildren.push(child);
  }

  // ─── Layer ───

  getName(): string { return this._name; }
  setName(name: string): void { this._name = name; }

  getLayerHeight(): number { return LAYER_HEIGHT; }

  getBackgroundColor(): number { return this._backgroundColor; }
  setBackgroundColor(color: number): void { this._backgroundColor = normalizeLayerColor(color); }

  accepts(_object: ScoreObject): boolean { return false; }
  contains(_object: ScoreObject): boolean { return false; }
  remove(_object: ScoreObject): boolean { return false; }
  clearScoreObjects(): void {}

  deepCopy(): PatternLayer {
    return new PatternLayer(this);
  }

  // ─── PatternLayer-specific ───

  getSoundObject(): SoundObject {
    return this._soundObject;
  }

  setSoundObject(sObj: SoundObject): void {
    this._soundObject = sObj;
    this._unresolvedSoundObject = null;
  }

  isMuted(): boolean { return this._muted; }
  setMuted(m: boolean): void { this._muted = m; }

  isSolo(): boolean { return this._solo; }
  setSolo(s: boolean): void { this._solo = s; }

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
    for (const [name, value] of this._unknownAttributes) {
      elem.setAttribute(name, value);
    }
    elem.setAttribute('name', this._name);
    elem.setAttribute('muted', this._muted.toString());
    elem.setAttribute('solo', this._solo.toString());

    elem.addElement('backgroundColor').setText(String(this._backgroundColor));
    if (this._unresolvedSoundObject) {
      elem.addElement(this._unresolvedSoundObject.clone());
    } else if (this._soundObject) {
      elem.addElement(this._soundObject.saveAsXML(_objRefMap));
    }
    elem.addElement(this._patternData.saveAsXML());

    for (const child of this._unknownChildren) {
      elem.addElement(child.clone());
    }

    return elem;
  }

  static loadFromXML(data: Element, objRefMap?: ObjRefLoadMap): PatternLayer {
    const layer = new PatternLayer();

    const knownAttrs = new Set(['name', 'muted', 'solo']);
    for (const name of data.getAttributeNames()) {
      if (!knownAttrs.has(name)) {
        layer.setUnknownAttribute(name, data.getAttribute(name) ?? '');
      }
    }

    layer._name = data.getAttributeValue('name') ?? '';
    layer._muted = data.getAttributeValue('muted') === 'true';
    layer._solo = data.getAttributeValue('solo') === 'true';

    const nodes = data.getElements();
    while (nodes.hasMoreElements()) {
      const node = nodes.next();
      const nodeName = node.getName();

      if (nodeName === 'backgroundColor') {
        layer._backgroundColor = normalizeXmlLayerColor(node.getTextString());
      } else if (nodeName === 'soundObject') {
        const loaded = loadSoundObjectFromXML(node, objRefMap);
        if (loaded) {
          layer._soundObject = loaded;
        } else {
          // Keep unsupported sources opaque while retaining the constructor's
          // GenericScore as the safe runtime fallback.
          layer._unresolvedSoundObject = node.clone();
        }
        // If loader returns null (unknown type), keep the default GenericScore
        // for runtime behavior. The original source is saved above instead of
        // emitting that fallback, so unsupported content survives round trips.
      } else if (nodeName === 'patternData') {
        layer._patternData = PatternData.loadFromXML(node);
      } else {
        layer.addUnknownChild(node.clone());
      }
    }

    return layer;
  }
}
