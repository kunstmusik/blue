/**
 * PatternLayer — a layer that repeats a SoundObject at pattern positions.
 * Mirrors the Java PatternLayer class.
 *
 * PatternLayer holds a single SoundObject and a PatternData (boolean array).
 * During CSD generation, the sound object's notes are repeated at each position
 * where the pattern is active (true), offset by index * patternBeatsLength.
 */
import { Layer, LAYER_HEIGHT } from '../../score/layers/layer';
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

export class PatternLayer implements Layer {
  private _soundObject: SoundObject;
  private _name = '';
  private _muted = false;
  private _solo = false;
  private _patternData: PatternData;

  constructor(other?: PatternLayer) {
    if (other) {
      this._name = other._name;
      this._muted = other._muted;
      this._solo = other._solo;
      this._soundObject = other._soundObject.deepCopy();
      this._patternData = new PatternData(other._patternData);
    } else {
      // Default: GenericScore with 4-beat duration
      this._soundObject = new GenericScore();
      this._soundObject.setStartTime({ toBeats: () => 0 } as any);
      (this._soundObject as any)._subjectiveDuration = { toBeats: () => 4 };
      (this._soundObject as any)._timeBehavior = 'NONE';
      this._patternData = new PatternData();
    }
  }

  // ─── Layer ───

  getName(): string { return this._name; }
  setName(name: string): void { this._name = name; }

  getLayerHeight(): number { return LAYER_HEIGHT; }

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

    if (this._soundObject) {
      elem.addElement(this._soundObject.saveAsXML(_objRefMap));
    }
    elem.addElement(this._patternData.saveAsXML());

    return elem;
  }

  static loadFromXML(data: Element, objRefMap?: ObjRefLoadMap): PatternLayer {
    const layer = new PatternLayer();

    layer._name = data.getAttributeValue('name') ?? '';
    layer._muted = data.getAttributeValue('muted') === 'true';
    layer._solo = data.getAttributeValue('solo') === 'true';

    const nodes = data.getElements();
    while (nodes.hasMoreElements()) {
      const node = nodes.next();
      const nodeName = node.getName();

      if (nodeName === 'soundObject') {
        const loaded = loadSoundObjectFromXML(node, objRefMap);
        if (loaded) {
          layer._soundObject = loaded;
        }
        // If loader returns null (unknown type), keep the default GenericScore.
        // This matches Java's fallback behavior where PatternLayer retains its
        // constructor-assigned SoundObject when ObjectUtilities.loadFromXML fails.
      } else if (nodeName === 'patternData') {
        layer._patternData = PatternData.loadFromXML(node);
      }
    }

    return layer;
  }
}
