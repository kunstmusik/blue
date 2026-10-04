/**
 * Instance — references a SoundObject from the SoundObjectLibrary.
 * Mirrors the Java Instance class.
 *
 * Delegates note generation to the referenced SoundObject, then applies
 * its own note processor chain and time behavior.
 */
import { AbstractSoundObject } from './abstract-sound-object';
import { NoteList } from './note-list';
import { TimeContext } from '../time/time-context';
import { CompileData } from '../compile-data';
import { Element } from '../serialization/xml-reader';
import { XmlLoadContext, requireXmlValue, type XmlDiagnosticSink } from '../serialization/xml-load';
import {
  checkShape,
  readText,
  readInt,
  readBoolean,
  readEnum,
  parseXmlBoolean,
} from '../utilities/xml';
import { BASIC_SOUND_OBJECT_CHILDREN } from './sound-object-utilities';
import { ObjRefSaveMap, ObjRefLoadMap } from '../serialization/obj-ref-map';
import { SoundObject } from './sound-object';
import { TimeBehavior } from './time-behavior';
import { initBasicFromXML, getBasicXML } from './sound-object-utilities';
import { applyTimeBehavior, normalizeNoteList, setScoreStart } from '../utilities/score';
import type {
  ScoreGenerationOptions,
  ScoreNormalizationOrigin,
} from '../score/score-generation-options';
import { markTrackInstrumentTargets } from '../score/score-generation-options';
import { getTrackPlacementForSoundObject } from './sound-object-registry';

export class Instance extends AbstractSoundObject {
  private _soundObject: SoundObject | null = null;
  private _libraryId = '';

  constructor(other?: Instance) {
    super();
    this.setName('Instance: ');
    if (other) {
      this.copyFrom(other);
      this._libraryId = other._libraryId;
      // Note: _soundObject reference is shared (same as Java copy constructor)
      this._soundObject = other._soundObject;
    }
  }

  getSoundObject(): SoundObject | null {
    return this._soundObject;
  }
  /** Rebinds the target without changing this Instance's authored presentation. */
  setSoundObject(sObj: SoundObject): void {
    this._soundObject = sObj;
  }

  getLibraryId(): string {
    return this._libraryId;
  }
  setLibraryId(id: string): void {
    this._libraryId = id;
  }

  override generateForCSD(
    context: TimeContext,
    compileData: CompileData,
    startTime: number,
    endTime: number,
    options?: ScoreGenerationOptions,
  ): NoteList {
    if (!this._soundObject) {
      return new NoteList();
    }

    const normalizationOrigin: ScoreNormalizationOrigin = {
      owner: this._soundObject,
      allowRangeOrigin:
        this.getTimeBehavior() === TimeBehavior.NONE &&
        this.getNoteProcessorChain().getProcessors().length === 0,
    };
    const sourceOptions: ScoreGenerationOptions = {
      ...options,
      normalizationOrigin,
      beatOrigin:
        (options?.beatOrigin ?? 0) +
        this._startTime.toBeats(context) -
        this._soundObject.getStartTime().toBeats(context),
    };
    const nl = this._soundObject.generateForCSD(
      context,
      compileData,
      startTime,
      endTime,
      sourceOptions,
    );
    const descriptor = getTrackPlacementForSoundObject(this._soundObject).descriptor;
    markTrackInstrumentTargets(
      nl,
      descriptor?.instrumentTargetBehavior ?? 'none',
      options?.instrumentTargetCollector,
    );

    if (normalizationOrigin.rangeOriginBeats === undefined) {
      normalizeNoteList(nl);
    }

    // Apply note processor chain
    const npc = this.getNoteProcessorChain();
    npc.apply(nl);

    // Apply time behavior
    const duration = this._subjectiveDuration.toBeats(context);
    const rpBeats = this._repeatPoint ? this._repeatPoint.toBeats(context) : -1;
    applyTimeBehavior(nl, this.getTimeBehavior(), duration, rpBeats);
    setScoreStart(nl, this._startTime.toBeats(context));

    return nl;
  }

  async generateForCSDAsync(
    context: TimeContext,
    compileData: CompileData,
    startTime: number,
    endTime: number,
    options?: ScoreGenerationOptions,
  ): Promise<NoteList> {
    if (!this._soundObject) {
      return new NoteList();
    }

    const normalizationOrigin: ScoreNormalizationOrigin = {
      owner: this._soundObject,
      allowRangeOrigin:
        this.getTimeBehavior() === TimeBehavior.NONE &&
        this.getNoteProcessorChain().getProcessors().length === 0,
    };
    const sourceOptions: ScoreGenerationOptions = {
      ...options,
      normalizationOrigin,
      beatOrigin:
        (options?.beatOrigin ?? 0) +
        this._startTime.toBeats(context) -
        this._soundObject.getStartTime().toBeats(context),
    };
    const nl = this._soundObject.generateForCSDAsync
      ? await this._soundObject.generateForCSDAsync(
          context,
          compileData,
          startTime,
          endTime,
          sourceOptions,
        )
      : this._soundObject.generateForCSD(context, compileData, startTime, endTime, sourceOptions);
    const descriptor = getTrackPlacementForSoundObject(this._soundObject).descriptor;
    markTrackInstrumentTargets(
      nl,
      descriptor?.instrumentTargetBehavior ?? 'none',
      options?.instrumentTargetCollector,
    );

    if (normalizationOrigin.rangeOriginBeats === undefined) {
      normalizeNoteList(nl);
    }
    const npc = this.getNoteProcessorChain();
    await npc.applyAsync(nl, compileData);
    const duration = this._subjectiveDuration.toBeats(context);
    const rpBeats = this._repeatPoint ? this._repeatPoint.toBeats(context) : -1;
    applyTimeBehavior(nl, this.getTimeBehavior(), duration, rpBeats);
    setScoreStart(nl, this._startTime.toBeats(context));

    return nl;
  }

  override saveAsXML(objRefMap?: ObjRefSaveMap): Element {
    const elem = getBasicXML(this, 'blue.soundObject.Instance');

    const refElem = elem.addElement('soundObjectReference');
    if (this._soundObject && objRefMap) {
      refElem.setAttribute('soundObjectLibraryID', objRefMap.getId(this._soundObject));
    } else {
      refElem.setAttribute('soundObjectLibraryID', this._libraryId || 'null');
    }

    return elem;
  }

  static loadFromXML(
    data: Element,
    objRefMap?: ObjRefLoadMap,
    context?: XmlLoadContext,
    sink?: XmlDiagnosticSink,
  ): Instance {
    const ctx = context ?? new XmlLoadContext(data);
    const type = data.getAttribute('type');
    if (
      data.getName() !== 'soundObject' ||
      type === null ||
      !['Instance', 'blue.soundObject.Instance'].includes(type)
    )
      throw ctx.at(data).error({
        code: 'type',
        member: '@type',
        value: type ?? '',
        message: 'Unsupported Instance type.',
        recovery: 'Supply a supported concrete SoundObject type.',
      });
    checkShape(data, ['type'], [...BASIC_SOUND_OBJECT_CHILDREN, ...['soundObjectReference']], ctx);
    const obj = new Instance();
    initBasicFromXML(obj, data, ctx);

    const refNode = data.getElement('soundObjectReference');
    if (!refNode)
      throw ctx.error({
        code: 'cardinality',
        member: 'soundObjectReference',
        message: 'Instance requires a reference declaration.',
        recovery: 'Supply an explicit library reference or null sentinel.',
      });
    checkShape(refNode, ['soundObjectLibraryID'], [], ctx);
    const id = refNode.getAttribute('soundObjectLibraryID');
    if (id === null || id.length === 0)
      throw ctx.at(refNode).error({
        code: 'value',
        member: '@soundObjectLibraryID',
        value: id ?? '',
        message: 'Missing instance library reference ID.',
        recovery: 'Supply a nonempty reference ID or null sentinel.',
      });
    if (id !== 'null') {
      obj._libraryId = id;
      if (objRefMap?.has(id)) obj._soundObject = objRefMap.get(id) as SoundObject;
      else
        throw ctx.at(refNode).error({
          code: 'reference',
          value: id,
          message: 'Instance dependency is unresolved.',
          recovery: 'Load this resource with an accepted library reference map before insertion.',
        });
    }

    return context ? obj : requireXmlValue(ctx.result(obj), sink);
  }

  override deepCopy(): SoundObject {
    const copy = new Instance(this);
    return copy;
  }
}
