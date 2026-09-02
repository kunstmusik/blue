/**
 * PolyObject — a SoundObject that contains nested SoundLayers with SoundObjects.
 * Mirrors the Java PolyObject class.
 *
 * PolyObject is both a SoundObject (note generator) AND a ScoreObjectLayerGroup.
 * It was the default/only score type before 2.3.0. After 2.3.0, Score became
 * the top-level container, but PolyObject is still used as a nested container.
 */
import { SoundObject } from './sound-object';
import { SoundLayer } from './sound-layer';
import { ScoreObjectLayerGroup } from '../score/layers/score-object-layer-group';
import { AutomatableLayerGroup } from '../score/layers/automatable-layer-group';
import { NoteProcessorChain } from '../note-processors/note-processor-chain';
import { TimeBehavior } from './time-behavior';
import { TimePosition } from '../time/time-position';
import { TimeDuration } from '../time/time-duration';
import { TimeContext } from '../time/time-context';
import { CompileData } from '../compile-data';
import { NoteList } from './note-list';
import { Element } from '../serialization/xml-reader';
import {
  applyNoteProcessorChain,
  applyNoteProcessorChainAsync,
  applyTimeBehavior,
  rebaseScoreToRenderStart,
  setScoreStart,
} from '../utilities/score';
import { ObjRefSaveMap, ObjRefLoadMap } from '../serialization/obj-ref-map';
import { ScoreObjectListener, ScoreObjectEvent, ScoreEventType } from '../score/score-object-event';
import { Layer } from '../score/layers/layer';
import { getBasicXML, initBasicFromXML } from './sound-object-utilities';
import { loadSoundObjectFromXML } from './sound-object-registry';
import { PythonObject } from './python-object';
import { ClojureObject } from './clojure-object';
import { JavaScriptObject } from './javascript-object';
import { Instance } from './instance';
import type { JavaScriptSession } from '../javascript-runtime';
import type { JavaRuntimeClientContract } from '../java-runtime';
import { normalizeScoreGenerationOptions, type ScoreGenerationOptionsOrSolo } from '../score/score-generation-options';

type OnLoadTarget = PolyObject | JavaScriptObject | ClojureObject | PythonObject;

function resolveOnLoadTarget(sObj: SoundObject): OnLoadTarget | null {
  if (sObj instanceof Instance) {
    const target = sObj.getSoundObject();
    return target ? resolveOnLoadTarget(target) : null;
  }

  if (
    sObj instanceof PolyObject ||
    sObj instanceof JavaScriptObject ||
    sObj instanceof ClojureObject ||
    sObj instanceof PythonObject
  ) {
    return sObj;
  }

  return null;
}



export class PolyObject extends Array<SoundLayer>
  implements SoundObject, ScoreObjectLayerGroup<SoundLayer>, AutomatableLayerGroup {

  // ScoreObject properties
  protected _name = 'polyObject';
  protected _startTime = TimePosition.beats(0);
  protected _subjectiveDuration = TimeDuration.beats(4);
  protected _backgroundColor = 0x666699;
  protected _cloneSourceHashCode = 0;

  // SoundObject properties
  private _timeBehavior = TimeBehavior.SCALE;
  private _repeatPoint: TimeDuration | null = null;
  private _npc = new NoteProcessorChain();
  private _listeners: ScoreObjectListener[] = [];

  // LayerGroup properties
  private _defaultHeightIndex = 0;

  getDefaultHeightIndex(): number {
    return this._defaultHeightIndex;
  }

  setDefaultHeightIndex(index: number): void {
    this._defaultHeightIndex = index;
  }

  constructor(isRoot = false) {
    super();
    this._backgroundColor = 0x666699;
    if (isRoot) {
      this._name = 'SoundObject Layer Group';
      this._timeBehavior = TimeBehavior.NONE;
    } else {
      this._name = 'polyObject';
      this._timeBehavior = TimeBehavior.SCALE;
    }
  }

  // ─── ScoreObject ───

  getName(): string { return this._name; }
  setName(value: string): void { this._name = value; }

  getStartTime(): TimePosition { return this._startTime; }
  setStartTime(value: TimePosition): void { this._startTime = value; }

  getSubjectiveDuration(): TimeDuration { return this._subjectiveDuration; }
  setSubjectiveDuration(value: TimeDuration): void { this._subjectiveDuration = value; }

  getBackgroundColor(): number { return this._backgroundColor; }
  setBackgroundColor(color: number): void { this._backgroundColor = color; }

  getResizeLeftLimits(_ctx: TimeContext): number[] { return [-Infinity, 0]; }
  getResizeRightLimits(_ctx: TimeContext): number[] { return [0, Infinity]; }
  resizeLeft(_ctx: TimeContext, _newStart: number): void {}
  resizeRight(_ctx: TimeContext, _newEnd: number): void {}

  addScoreObjectListener(listener: ScoreObjectListener): void {
    if (!this._listeners.includes(listener)) this._listeners.push(listener);
  }
  removeScoreObjectListener(listener: ScoreObjectListener): void {
    const i = this._listeners.indexOf(listener);
    if (i !== -1) this._listeners.splice(i, 1);
  }
  getCloneSourceHashCode(): number { return this._cloneSourceHashCode; }

  // ─── SoundObject ───

  getNoteProcessorChain(): NoteProcessorChain { return this._npc; }
  setNoteProcessorChain(chain: NoteProcessorChain): void { this._npc = chain; }

  getTimeBehavior(): TimeBehavior { return this._timeBehavior; }
  setTimeBehavior(behavior: TimeBehavior): void { this._timeBehavior = behavior; }

  getRepeatPoint(): TimeDuration | null { return this._repeatPoint; }
  setRepeatPoint(rp: TimeDuration | null): void { this._repeatPoint = rp; }

  getSoundObjects(grabMutedSoundObjects = false): SoundObject[] {
    const sObjects: SoundObject[] = [];
    for (const layer of this) {
      if (!grabMutedSoundObjects && layer.isMuted()) {
        continue;
      }
      sObjects.push(...layer);
    }
    return sObjects;
  }

  addSoundObject(layerIndex: number, sObj: SoundObject): void {
    if (layerIndex >= 0 && layerIndex < this.length) {
      this[layerIndex].push(sObj);
    }
  }

  removeSoundObject(sObj: SoundObject): number {
    for (let i = 0; i < this.length; i += 1) {
      const layer = this[i];
      if (layer.contains(sObj)) {
        layer.remove(sObj);
        return i;
      }
    }
    return -1;
  }

  normalizeSoundObjects(context: TimeContext): void {
    const sObjects = this.getSoundObjects(false);
    if (sObjects.length === 0) {
      return;
    }

    let min = sObjects[0].getStartTime().toBeats(context);
    for (let i = 1; i < sObjects.length; i += 1) {
      const start = sObjects[i].getStartTime().toBeats(context);
      if (start < min) {
        min = start;
      }
    }

    for (const sObj of sObjects) {
      const currentStart = sObj.getStartTime().toBeats(context);
      sObj.setStartTime(TimePosition.beats(currentStart - min));
    }

    let maxTime = 0;
    for (const sObj of sObjects) {
      const start = sObj.getStartTime().toBeats(context);
      const duration = sObj.getSubjectiveDuration().toBeats(context);
      if (start + duration > maxTime) {
        maxTime = start + duration;
      }
    }

    this.setSubjectiveDuration(TimeDuration.beats(maxTime));
  }

  generateForCSD(
    context: TimeContext,
    compileData: CompileData,
    startTime: number,
    endTime: number,
    options?: ScoreGenerationOptionsOrSolo,
  ): NoteList {
    const noteList = new NoteList();
    const processWithSolo = normalizeScoreGenerationOptions(options).processWithSolo ?? this.hasSoloLayers();
    const shouldProcessWithSolo = processWithSolo ?? this.hasSoloLayers();

    if (shouldProcessWithSolo) {
      for (const layer of this) {
        if (!layer.isSolo() || layer.isMuted()) {
          continue;
        }

        const nl = layer.generateForCSD(context, compileData, startTime, endTime);
        noteList.merge(nl);
      }
    } else {
      for (const layer of this) {
        if (layer.isMuted()) {
          continue;
        }

        const nl = layer.generateForCSD(context, compileData, startTime, endTime);
        noteList.merge(nl);
      }
    }

    return this.processGeneratedNotes(context, noteList, startTime, endTime);
  }

  async generateForCSDAsync(
    context: TimeContext,
    compileData: CompileData,
    startTime: number,
    endTime: number,
    options?: ScoreGenerationOptionsOrSolo,
  ): Promise<NoteList> {
    const noteList = new NoteList();
    const processWithSolo = normalizeScoreGenerationOptions(options).processWithSolo ?? this.hasSoloLayers();
    const shouldProcessWithSolo = processWithSolo ?? this.hasSoloLayers();

    if (shouldProcessWithSolo) {
      for (const layer of this) {
        if (!layer.isSolo() || layer.isMuted()) {
          continue;
        }

        const nl = await layer.generateForCSDAsync(context, compileData, startTime, endTime);
        noteList.merge(nl);
      }
    } else {
      for (const layer of this) {
        if (layer.isMuted()) {
          continue;
        }

        const nl = await layer.generateForCSDAsync(context, compileData, startTime, endTime);
        noteList.merge(nl);
      }
    }

    return this.processGeneratedNotesAsync(context, noteList, startTime, endTime, compileData);
  }

  private processGeneratedNotes(
    context: TimeContext,
    noteList: NoteList,
    startTime: number,
    endTime: number,
  ): NoteList {
    const processed = applyNoteProcessorChain(noteList, this._npc);
    const duration = this._subjectiveDuration.toBeats(context);
    const repeatPointBeats = this._repeatPoint ? this._repeatPoint.toBeats(context) : -1;

    applyTimeBehavior(
      processed,
      this._timeBehavior,
      duration,
      repeatPointBeats,
    );

    setScoreStart(processed, this._startTime.toBeats(context));

    rebaseScoreToRenderStart(processed, startTime);

    if (endTime > startTime) {
      const filtered = new NoteList();
      for (const note of processed) {
        if (note.getStartTime() <= endTime) {
          filtered.add(note);
        }
      }
      return filtered;
    }

    return processed;
  }

  private async processGeneratedNotesAsync(
    context: TimeContext,
    noteList: NoteList,
    startTime: number,
    endTime: number,
    compileData: CompileData,
  ): Promise<NoteList> {
    const processed = await applyNoteProcessorChainAsync(noteList, this._npc, compileData);
    const duration = this._subjectiveDuration.toBeats(context);
    const repeatPointBeats = this._repeatPoint ? this._repeatPoint.toBeats(context) : -1;

    applyTimeBehavior(
      processed,
      this._timeBehavior,
      duration,
      repeatPointBeats,
    );

    setScoreStart(processed, this._startTime.toBeats(context));

    rebaseScoreToRenderStart(processed, startTime);

    if (endTime > startTime) {
      const filtered = new NoteList();
      for (const note of processed) {
        if (note.getStartTime() <= endTime) {
          filtered.add(note);
        }
      }
      return filtered;
    }

    return processed;
  }

  // ─── LayerGroup ───

  hasSoloLayers(): boolean {
    return this.some((layer) => layer.isSolo());
  }

  newLayerAt(index: number): SoundLayer {
    const layer = new SoundLayer();
    layer.setHeightIndex(this._defaultHeightIndex);
    const insertIdx = index < 0 ? this.length : Math.min(index, this.length);
    this.splice(insertIdx, 0, layer);
    return layer;
  }

  removeLayers(startIdx: number, endIdx: number): void {
    this.splice(startIdx, endIdx - startIdx + 1);
  }

  pushUpLayers(startIdx: number, endIdx: number): void {
    if (startIdx <= 0) return;
    const item = this.splice(startIdx - 1, 1)[0];
    this.splice(endIdx, 0, item);
  }

  pushDownLayers(startIdx: number, endIdx: number): void {
    if (endIdx >= this.length - 1) return;
    const item = this.splice(endIdx + 1, 1)[0];
    this.splice(startIdx, 0, item);
  }

  onLoadComplete(_context: TimeContext): void {
    // No-op — use processOnLoad() for OnLoadProcessable support
  }

  processOnLoad(context: TimeContext, session?: JavaScriptSession): void {
    for (const layer of this) {
      for (const sObj of layer) {
        const target = resolveOnLoadTarget(sObj);
        if (target instanceof PolyObject) {
          target.processOnLoad(context, session);
        } else if (target instanceof JavaScriptObject) {
          if (target.isOnLoadProcessable()) {
            target.processOnLoad(context, session);
          }
        } else if (target instanceof ClojureObject) {
          if (target.isOnLoadProcessable()) {
            target.processOnLoad(context);
          }
        } else if (target instanceof PythonObject) {
          if (target.isOnLoadProcessable()) {
            target.processOnLoad(context);
          }
        }
      }
    }
  }

  async processOnLoadAsync(
    context: TimeContext,
    session?: JavaScriptSession,
    runtimeClient?: JavaRuntimeClientContract | null,
  ): Promise<void> {
    for (const layer of this) {
      for (const sObj of layer) {
        const target = resolveOnLoadTarget(sObj);
        if (target instanceof PolyObject) {
          await target.processOnLoadAsync(context, session, runtimeClient);
        } else if (target instanceof JavaScriptObject) {
          if (target.isOnLoadProcessable()) {
            target.processOnLoad(context, session);
          }
        } else if (target instanceof ClojureObject) {
          if (target.isOnLoadProcessable()) {
            await target.processOnLoadAsync(context, runtimeClient);
          }
        } else if (target instanceof PythonObject) {
          if (target.isOnLoadProcessable()) {
            await target.processOnLoadAsync(context, runtimeClient);
          }
        }
      }
    }
  }

  // ─── XML Serialization ───

  saveAsXML(objRefMap?: ObjRefSaveMap): Element {
    const elem = getBasicXML(this, 'blue.soundObject.PolyObject');
    elem.addElement('defaultHeightIndex').setText(this._defaultHeightIndex.toString());

    for (const layer of this) {
      const layerElem = new Element('soundLayer');
      layerElem.setAttribute('name', layer.getName());
      layerElem.setAttribute('muted', layer.isMuted().toString());
      layerElem.setAttribute('solo', layer.isSolo().toString());
      layerElem.setAttribute('heightIndex', layer.getHeightIndex().toString());
      layerElem.setAttribute('automationSelectedIndex', layer.getAutomationParameters().getSelectedIndex().toString());
      layerElem.addElement(layer.getNoteProcessorChain().saveAsXML());

      for (const sObj of layer) {
        layerElem.addElement(sObj.saveAsXML(objRefMap));
      }

      for (const id of layer.getAutomationParameters().getIds()) {
        layerElem.addElement('parameterId').setText(id);
      }

      elem.addElement(layerElem);
    }

    return elem;
  }

  static loadFromXML(data: Element, _objRefMap?: ObjRefLoadMap): PolyObject {
    const pObj = new PolyObject(false);

    const startAttr = data.getAttribute('startTime');
    if (startAttr) {
      const nameAttr = data.getAttribute('name');
      if (nameAttr) pObj._name = nameAttr;

      const tbAttr = data.getAttribute('timeBehavior');
      if (tbAttr && Object.values(TimeBehavior).includes(tbAttr as TimeBehavior)) {
        pObj._timeBehavior = tbAttr as TimeBehavior;
      }

      pObj._startTime = TimePosition.beats(parseFloat(startAttr));

      const durAttr = data.getAttribute('duration');
      if (durAttr) pObj._subjectiveDuration = TimeDuration.beats(parseFloat(durAttr));

      const colorAttr = data.getAttribute('backgroundColor');
      if (colorAttr) pObj._backgroundColor = parseInt(colorAttr, 10);

      const dhiAttr = data.getAttribute('defaultHeightIndex');
      if (dhiAttr) pObj._defaultHeightIndex = parseInt(dhiAttr, 10);
    } else {
      initBasicFromXML(pObj, data);

      const dhiText = data.getTextString('defaultHeightIndex');
      if (dhiText) pObj._defaultHeightIndex = parseInt(dhiText, 10);
    }

    const nodes = data.getElements();
    while (nodes.hasMoreElements()) {
      const node = nodes.next();
      const nodeName = node.getName();

      if (nodeName === 'soundLayer') {
        const layer = new SoundLayer();
        const layerName = node.getAttribute('name');
        if (layerName) layer.setName(layerName);

        layer.setMuted(node.getAttribute('muted') === 'true');
        layer.setSolo(node.getAttribute('solo') === 'true');

        const heightIndex = node.getAttribute('heightIndex');
        if (heightIndex) {
          layer.setHeightIndex(parseInt(heightIndex, 10));
        }
        const automationSelectedIndex = node.getAttribute('automationSelectedIndex');

        const sObjNodes = node.getElements();
        while (sObjNodes.hasMoreElements()) {
          const sObjNode = sObjNodes.next();
          if (sObjNode.getName() === 'soundObject') {
            const sObj = loadSoundObjectFromXML(sObjNode, _objRefMap);
            if (sObj) layer.push(sObj);
          } else if (sObjNode.getName() === 'noteProcessorChain') {
            layer.setNoteProcessorChain(NoteProcessorChain.loadFromXML(sObjNode));
          } else if (sObjNode.getName() === 'parameterId') {
            layer.getAutomationParameters().addParameterId(sObjNode.getTextString());
          }
        }
        if (automationSelectedIndex) {
          const parsed = parseInt(automationSelectedIndex, 10);
          if (!Number.isNaN(parsed)) {
            layer.getAutomationParameters().setSelectedIndex(parsed);
          }
        }

        pObj.push(layer);
      } else if (nodeName === 'noteProcessorChain') {
        pObj._npc = NoteProcessorChain.loadFromXML(node);
      }
    }

    return pObj;
  }

  deepCopy(): SoundObject {
    const copy = new PolyObject(false);
    copy._name = this._name;
    copy._startTime = this._startTime;
    copy._subjectiveDuration = this._subjectiveDuration;
    copy._backgroundColor = this._backgroundColor;
    copy._timeBehavior = this._timeBehavior;
    copy._npc = new NoteProcessorChain(this._npc);
    // Deep copy layers
    for (const layer of this) {
      copy.push(layer.deepCopy());
    }
    return copy;
  }

  deepCopyLG(): PolyObject {
    return this.deepCopy() as PolyObject;
  }
}
