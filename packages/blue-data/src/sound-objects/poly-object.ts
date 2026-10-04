/**
 * PolyObject — a SoundObject that contains nested SoundLayers with SoundObjects.
 * Mirrors the Java PolyObject class.
 *
 * PolyObject is both a SoundObject (note generator) and a LayerGroup<SoundLayer>.
 * It was the default/only score type before 2.3.0. After 2.3.0, Score became
 * the top-level container, but PolyObject is still used as a nested container.
 */
import { SoundObject } from './sound-object';
import { SoundLayer } from './sound-layer';
import { LayerGroup } from '../score/layers/layer-group';
import { SOUND_LAYER_MAX_HEIGHT_INDEX } from '../score/layer-height-policy';
import type { CopyMode } from '../deep-copyable';
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
import { Layer } from '../score/layers/layer';
import { XmlLoadContext, requireXmlValue, type XmlDiagnosticSink } from '../serialization/xml-load';
import { checkRoot, checkShape, parseXmlNumber, parseXmlInteger, readInt } from '../utilities/xml';
import {
  BASIC_SOUND_OBJECT_CHILDREN,
  getBasicXML,
  initBasicFromXML,
} from './sound-object-utilities';
import { loadSoundObjectFromXML } from './sound-object-registry';
import { PythonObject } from './python-object';
import { ClojureObject } from './clojure-object';
import { JavaScriptObject } from './javascript-object';
import { Instance } from './instance';
import type { JavaScriptSession } from '../javascript-runtime';
import type { JavaRuntimeClientContract } from '../java-runtime';
import {
  normalizeScoreGenerationOptions,
  type ScoreGenerationOptions,
  type ScoreGenerationOptionsOrSolo,
} from '../score/score-generation-options';

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

export class PolyObject extends Array<SoundLayer> implements SoundObject, LayerGroup<SoundLayer> {
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

  // LayerGroup properties
  private _defaultHeightIndex = 0;

  getDefaultHeightIndex(): number {
    return this._defaultHeightIndex;
  }

  setDefaultHeightIndex(index: number): void {
    this._defaultHeightIndex = Math.max(0, Math.min(SOUND_LAYER_MAX_HEIGHT_INDEX, index));
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

  getName(): string {
    return this._name;
  }
  setName(value: string): void {
    this._name = value;
  }

  getStartTime(): TimePosition {
    return this._startTime;
  }
  setStartTime(value: TimePosition): void {
    this._startTime = value;
  }

  getSubjectiveDuration(): TimeDuration {
    return this._subjectiveDuration;
  }
  setSubjectiveDuration(value: TimeDuration): void {
    this._subjectiveDuration = value;
  }

  getBackgroundColor(): number {
    return this._backgroundColor;
  }
  setBackgroundColor(color: number): void {
    this._backgroundColor = color;
  }

  getResizeLeftLimits(_ctx: TimeContext): number[] {
    return [-Infinity, 0];
  }
  getResizeRightLimits(_ctx: TimeContext): number[] {
    return [0, Infinity];
  }
  resizeLeft(_ctx: TimeContext, _newStart: number): void {}
  resizeRight(_ctx: TimeContext, _newEnd: number): void {}

  getCloneSourceHashCode(): number {
    return this._cloneSourceHashCode;
  }

  // ─── SoundObject ───

  getNoteProcessorChain(): NoteProcessorChain {
    return this._npc;
  }
  setNoteProcessorChain(chain: NoteProcessorChain): void {
    this._npc = chain;
  }

  getTimeBehavior(): TimeBehavior {
    return this._timeBehavior;
  }
  setTimeBehavior(behavior: TimeBehavior): void {
    this._timeBehavior = behavior;
  }

  getRepeatPoint(): TimeDuration | null {
    return this._repeatPoint;
  }
  setRepeatPoint(rp: TimeDuration | null): void {
    this._repeatPoint = rp;
  }

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
    const generationOptions = normalizeScoreGenerationOptions(options);
    const processWithSolo = generationOptions.processWithSolo ?? this.hasSoloLayers();
    const shouldProcessWithSolo = processWithSolo ?? this.hasSoloLayers();
    const rangeOriginBeats =
      generationOptions.normalizationOrigin?.owner === this &&
      generationOptions.normalizationOrigin.allowRangeOrigin
        ? this.getLinkedRangeOriginBeats(context, shouldProcessWithSolo)
        : undefined;
    if (rangeOriginBeats !== undefined && generationOptions.normalizationOrigin) {
      generationOptions.normalizationOrigin.rangeOriginBeats = rangeOriginBeats;
      if (rangeOriginBeats !== null) {
        generationOptions.normalizationOrigin.originBeats =
          this._startTime.toBeats(context) + rangeOriginBeats;
      }
    }
    const sourceStartTime =
      typeof rangeOriginBeats === 'number' ? startTime + rangeOriginBeats : startTime;
    const sourceEndTime =
      typeof rangeOriginBeats === 'number'
        ? endTime > startTime
          ? endTime + rangeOriginBeats
          : sourceStartTime
        : endTime;
    const childOptions: ScoreGenerationOptions = {
      deferRenderStartRebase: true,
      normalizationOrigin:
        generationOptions.normalizationOrigin?.owner === this
          ? generationOptions.normalizationOrigin
          : undefined,
      beatOrigin: (generationOptions.beatOrigin ?? 0) + this._startTime.toBeats(context),
    };

    if (shouldProcessWithSolo) {
      for (const layer of this) {
        if (!layer.isSolo() || layer.isMuted()) {
          continue;
        }

        const nl = layer.generateForCSD(
          context,
          compileData,
          sourceStartTime,
          sourceEndTime,
          childOptions,
        );
        noteList.merge(nl);
      }
    } else {
      for (const layer of this) {
        if (layer.isMuted()) {
          continue;
        }

        const nl = layer.generateForCSD(
          context,
          compileData,
          sourceStartTime,
          sourceEndTime,
          childOptions,
        );
        noteList.merge(nl);
      }
    }

    return this.processGeneratedNotes(
      context,
      noteList,
      startTime,
      endTime,
      sourceStartTime,
      sourceEndTime,
      generationOptions,
    );
  }

  async generateForCSDAsync(
    context: TimeContext,
    compileData: CompileData,
    startTime: number,
    endTime: number,
    options?: ScoreGenerationOptionsOrSolo,
  ): Promise<NoteList> {
    const noteList = new NoteList();
    const generationOptions = normalizeScoreGenerationOptions(options);
    const processWithSolo = generationOptions.processWithSolo ?? this.hasSoloLayers();
    const shouldProcessWithSolo = processWithSolo ?? this.hasSoloLayers();
    const rangeOriginBeats =
      generationOptions.normalizationOrigin?.owner === this &&
      generationOptions.normalizationOrigin.allowRangeOrigin
        ? this.getLinkedRangeOriginBeats(context, shouldProcessWithSolo)
        : undefined;
    if (rangeOriginBeats !== undefined && generationOptions.normalizationOrigin) {
      generationOptions.normalizationOrigin.rangeOriginBeats = rangeOriginBeats;
      if (rangeOriginBeats !== null) {
        generationOptions.normalizationOrigin.originBeats =
          this._startTime.toBeats(context) + rangeOriginBeats;
      }
    }
    const sourceStartTime =
      typeof rangeOriginBeats === 'number' ? startTime + rangeOriginBeats : startTime;
    const sourceEndTime =
      typeof rangeOriginBeats === 'number'
        ? endTime > startTime
          ? endTime + rangeOriginBeats
          : sourceStartTime
        : endTime;
    const childOptions: ScoreGenerationOptions = {
      deferRenderStartRebase: true,
      normalizationOrigin:
        generationOptions.normalizationOrigin?.owner === this
          ? generationOptions.normalizationOrigin
          : undefined,
      beatOrigin: (generationOptions.beatOrigin ?? 0) + this._startTime.toBeats(context),
    };

    if (shouldProcessWithSolo) {
      for (const layer of this) {
        if (!layer.isSolo() || layer.isMuted()) {
          continue;
        }

        const nl = await layer.generateForCSDAsync(
          context,
          compileData,
          sourceStartTime,
          sourceEndTime,
          childOptions,
        );
        noteList.merge(nl);
      }
    } else {
      for (const layer of this) {
        if (layer.isMuted()) {
          continue;
        }

        const nl = await layer.generateForCSDAsync(
          context,
          compileData,
          sourceStartTime,
          sourceEndTime,
          childOptions,
        );
        noteList.merge(nl);
      }
    }

    return this.processGeneratedNotesAsync(
      context,
      noteList,
      startTime,
      endTime,
      sourceStartTime,
      sourceEndTime,
      compileData,
      generationOptions,
    );
  }

  private processGeneratedNotes(
    context: TimeContext,
    noteList: NoteList,
    renderStart: number,
    renderEnd: number,
    sourceStart: number,
    sourceEnd: number,
    generationOptions: ScoreGenerationOptions,
  ): NoteList {
    let processed = applyNoteProcessorChain(noteList, this._npc);
    const duration = this._subjectiveDuration.toBeats(context);
    const repeatPointBeats = this._repeatPoint ? this._repeatPoint.toBeats(context) : -1;
    applyTimeBehavior(processed, this._timeBehavior, duration, repeatPointBeats);

    const normalizationOrigin = generationOptions.normalizationOrigin;
    if (
      normalizationOrigin?.owner === this &&
      typeof normalizationOrigin.rangeOriginBeats === 'number'
    ) {
      normalizationOrigin.originBeats =
        this._startTime.toBeats(context) + normalizationOrigin.rangeOriginBeats;
    }
    const canFinalizeFileSeeks =
      this._timeBehavior === TimeBehavior.NONE &&
      this._npc.getProcessors().length === 0 &&
      this.every((layer) => layer.getNoteProcessorChain().getProcessors().length === 0);
    if (canFinalizeFileSeeks) {
      this.applyFileSeekNormalization(
        context,
        processed,
        renderStart,
        renderEnd,
        generationOptions,
      );
    }

    if (sourceEnd > sourceStart) {
      const filtered = new NoteList();
      for (const note of processed) {
        if (note.getStartTime() <= sourceEnd) {
          filtered.add(note);
        }
      }
      processed = filtered;
    }

    setScoreStart(processed, this._startTime.toBeats(context));

    const hasStableRangeOrigin =
      normalizationOrigin?.owner === this && normalizationOrigin.rangeOriginBeats !== undefined;
    if (!generationOptions.deferRenderStartRebase) {
      rebaseScoreToRenderStart(
        processed,
        hasStableRangeOrigin ? this._startTime.toBeats(context) + sourceStart : renderStart,
      );
    }

    return processed;
  }

  private async processGeneratedNotesAsync(
    context: TimeContext,
    noteList: NoteList,
    renderStart: number,
    renderEnd: number,
    sourceStart: number,
    sourceEnd: number,
    compileData: CompileData,
    generationOptions: ScoreGenerationOptions,
  ): Promise<NoteList> {
    let processed = await applyNoteProcessorChainAsync(noteList, this._npc, compileData);
    const duration = this._subjectiveDuration.toBeats(context);
    const repeatPointBeats = this._repeatPoint ? this._repeatPoint.toBeats(context) : -1;
    applyTimeBehavior(processed, this._timeBehavior, duration, repeatPointBeats);

    const normalizationOrigin = generationOptions.normalizationOrigin;
    if (
      normalizationOrigin?.owner === this &&
      typeof normalizationOrigin.rangeOriginBeats === 'number'
    ) {
      normalizationOrigin.originBeats =
        this._startTime.toBeats(context) + normalizationOrigin.rangeOriginBeats;
    }
    const canFinalizeFileSeeks =
      this._timeBehavior === TimeBehavior.NONE &&
      this._npc.getProcessors().length === 0 &&
      this.every((layer) => layer.getNoteProcessorChain().getProcessors().length === 0);
    if (canFinalizeFileSeeks) {
      this.applyFileSeekNormalization(
        context,
        processed,
        renderStart,
        renderEnd,
        generationOptions,
      );
    }

    if (sourceEnd > sourceStart) {
      const filtered = new NoteList();
      for (const note of processed) {
        if (note.getStartTime() <= sourceEnd) {
          filtered.add(note);
        }
      }
      processed = filtered;
    }

    setScoreStart(processed, this._startTime.toBeats(context));

    const hasStableRangeOrigin =
      normalizationOrigin?.owner === this && normalizationOrigin.rangeOriginBeats !== undefined;
    if (!generationOptions.deferRenderStartRebase) {
      rebaseScoreToRenderStart(
        processed,
        hasStableRangeOrigin ? this._startTime.toBeats(context) + sourceStart : renderStart,
      );
    }

    return processed;
  }

  private applyFileSeekNormalization(
    context: TimeContext,
    notes: NoteList,
    renderStart: number,
    renderEnd: number,
    generationOptions: ScoreGenerationOptions,
  ): void {
    const normalizationOrigin = generationOptions.normalizationOrigin;
    const originBeats = normalizationOrigin?.originBeats;
    if (normalizationOrigin?.owner !== this || originBeats === undefined) return;

    const targetBeat = (generationOptions.beatOrigin ?? 0) + originBeats + renderStart;
    const targetEndBeat =
      renderEnd > renderStart
        ? (generationOptions.beatOrigin ?? 0) + originBeats + renderEnd
        : Infinity;
    notes.removeIf((note) => {
      const provenance = note.getFileSeekProvenance();
      if (!provenance || provenance.normalizationOrigin !== normalizationOrigin) return false;

      const fileEndBeat = provenance.absoluteObjectStartBeat + provenance.originalDurationBeats;
      const overlapStartBeat = Math.max(provenance.absoluteObjectStartBeat, targetBeat);
      const overlapEndBeat = Math.min(fileEndBeat, targetEndBeat);
      const overlapBeats = overlapEndBeat - overlapStartBeat;
      if (overlapBeats <= 0) {
        note.setFileSeekProvenance(undefined);
        return true;
      }

      note.setSubjectiveDuration(overlapBeats);
      return false;
    });

    for (const note of notes) {
      const provenance = note.getFileSeekProvenance();
      if (!provenance || provenance.normalizationOrigin !== normalizationOrigin) continue;

      const seekEndBeat = Math.max(provenance.absoluteObjectStartBeat, targetBeat);
      const normalizedOffsetSeconds =
        context.beatsToSeconds(seekEndBeat) -
        context.beatsToSeconds(provenance.absoluteObjectStartBeat);
      const currentOffsetSeconds = Number(note.getPField(provenance.pField));
      if (Number.isFinite(currentOffsetSeconds)) {
        note.setPField(
          String(
            currentOffsetSeconds + normalizedOffsetSeconds - provenance.generatedOffsetSeconds,
          ),
          provenance.pField,
        );
      }
      note.setFileSeekProvenance(undefined);
    }
  }

  private getLinkedRangeOriginBeats(
    context: TimeContext,
    processWithSolo: boolean,
  ): number | null | undefined {
    if (this._timeBehavior !== TimeBehavior.NONE || this._npc.getProcessors().length > 0) {
      return undefined;
    }

    let earliest = Infinity;
    let hasNotes = false;
    for (const layer of this) {
      if (layer.isMuted() || (processWithSolo && !layer.isSolo())) continue;
      if (layer.getNoteProcessorChain().getProcessors().length > 0) return undefined;

      for (const soundObject of layer) {
        // Nested containers need their own source/output range contract.
        if (soundObject instanceof PolyObject || soundObject instanceof Instance) {
          return undefined;
        }

        const origin = soundObject.getRangeOriginBeats?.(context);
        if (origin === undefined) return undefined;
        if (origin === null) continue;
        if (!Number.isFinite(origin)) return undefined;
        earliest = Math.min(earliest, origin);
        hasNotes = true;
      }
    }

    return hasNotes ? earliest : null;
  }

  // ─── LayerGroup ───

  hasSoloLayers(): boolean {
    return this.some((layer) => layer.isSolo());
  }

  newLayerAt(index: number): SoundLayer {
    const layer = new SoundLayer();
    const defaultHeightIndex =
      Number.isInteger(this._defaultHeightIndex) &&
      this._defaultHeightIndex >= 0 &&
      this._defaultHeightIndex <= SOUND_LAYER_MAX_HEIGHT_INDEX
        ? this._defaultHeightIndex
        : 0;
    layer.setHeightIndex(defaultHeightIndex);
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
      if (layer.getCustomHeight() !== undefined) {
        layerElem.setAttribute('customHeight', layer.getCustomHeight()!.toString());
      }
      layerElem.setAttribute(
        'automationSelectedIndex',
        layer.getAutomationParameters().getSelectedIndex().toString(),
      );
      layerElem.addElement('backgroundColor').setText(String(layer.getBackgroundColor()));
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

  static loadFromXML(
    data: Element,
    objRefMap?: ObjRefLoadMap,
    providedContext?: XmlLoadContext,
    sink?: XmlDiagnosticSink,
  ): PolyObject {
    const context = providedContext ?? new XmlLoadContext(data);
    checkRoot(data, ['polyObject', 'soundObject'], context);
    checkShape(
      data,
      [
        'type',
        'name',
        'startTime',
        'duration',
        'timeBehavior',
        'backgroundColor',
        'defaultHeightIndex',
      ],
      [...BASIC_SOUND_OBJECT_CHILDREN, 'defaultHeightIndex', 'soundLayer'],
      context,
      ['soundLayer'],
    );
    const type = data.getAttribute('type');
    if (type !== null && !['PolyObject', 'blue.soundObject.PolyObject'].includes(type))
      throw context.at(data).error({
        code: 'type',
        member: '@type',
        value: type,
        message: 'Unsupported PolyObject type.',
        recovery: 'Use the PolyObject type.',
      });
    if (type === null && data.getName() !== 'polyObject')
      throw context.at(data).error({
        code: 'type',
        member: '@type',
        message: 'Missing PolyObject type.',
        recovery: 'Supply the PolyObject type.',
      });
    const object = new PolyObject(false);
    initBasicFromXML(object, data, context);
    const normalized = getBasicXML(object, 'blue.soundObject.PolyObject');
    for (const field of [
      'name',
      'startTime',
      'duration',
      'timeBehavior',
      'backgroundColor',
      'defaultHeightIndex',
    ]) {
      const raw = data.getAttribute(field);
      if (raw === null) continue;
      let value: string | number = raw;
      if (field === 'startTime' || field === 'duration')
        value = parseXmlNumber(raw, context.at(data), '@' + field);
      if (field === 'backgroundColor' || field === 'defaultHeightIndex')
        value = parseXmlInteger(
          raw,
          context.at(data),
          field === 'backgroundColor' ? -2147483648 : 0,
          2147483647,
          '@' + field,
        );
      if (field === 'timeBehavior' && !Object.values(TimeBehavior).includes(raw as TimeBehavior))
        throw context.at(data).error({
          code: 'value',
          member: '@timeBehavior',
          value: raw,
          message: 'Unsupported time behavior.',
          recovery: 'Use a supported behavior.',
        });
      const current = data.getElement(field === 'duration' ? 'subjectiveDuration' : field);
      if (current) {
        const equal =
          field === 'startTime'
            ? object.getStartTime().equals(TimePosition.beats(value as number))
            : field === 'duration'
              ? object.getSubjectiveDuration().equals(TimeDuration.beats(value as number))
              : field === 'defaultHeightIndex'
                ? readInt(current, context, 0, 2147483647) === value
                : field === 'timeBehavior'
                  ? object.getTimeBehavior() === value
                  : normalized.getTextString(field) === String(value);
        if (!equal)
          throw context.at(current).error({
            code: 'conflict',
            member: field,
            message: 'PolyObject attribute and child aliases disagree.',
            recovery: 'Make both forms agree.',
          });
      }
      switch (field) {
        case 'name':
          object._name = raw;
          break;
        case 'startTime':
          object._startTime = TimePosition.beats(value as number);
          break;
        case 'duration':
          object._subjectiveDuration = TimeDuration.beats(value as number);
          break;
        case 'timeBehavior':
          object._timeBehavior = raw as TimeBehavior;
          break;
        case 'backgroundColor':
          object._backgroundColor = value as number;
          break;
        case 'defaultHeightIndex':
          object._defaultHeightIndex = value as number;
          break;
      }
    }
    const height = data.getElement('defaultHeightIndex');
    if (height) object._defaultHeightIndex = readInt(height, context, 0, 2147483647);
    for (const child of data.getElements('soundLayer'))
      object.push(SoundLayer.loadFromXML(child, objRefMap, context));
    return providedContext ? object : requireXmlValue(context.result(object), sink);
  }

  deepCopy(mode: CopyMode = 'duplication'): PolyObject {
    const copy = new PolyObject(false);
    copy._name = this._name;
    copy._startTime = this._startTime;
    copy._subjectiveDuration = this._subjectiveDuration;
    copy._backgroundColor = this._backgroundColor;
    copy._timeBehavior = this._timeBehavior;
    copy._npc = new NoteProcessorChain(this._npc);
    copy._defaultHeightIndex = this._defaultHeightIndex;
    // Deep copy layers
    for (const layer of this) {
      copy.push(layer.deepCopy(mode));
    }
    return copy;
  }
}
