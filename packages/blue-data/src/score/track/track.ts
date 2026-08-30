import { Instrument } from '../../instruments/instrument';
import { loadInstrumentFromXML } from '../../instruments/instrument-registry';
import { ParameterIdList } from '../../automation/parameter-id-list';
import type { Parameter } from '../../automation/parameter';
import { CompileData } from '../../compile-data';
import { NoteList } from '../../sound-objects/note-list';
import type { SoundObject } from '../../sound-objects/sound-object';
import { AudioClip } from '../audio/audio-clip';
import { ScoreObject } from '../score-object';
import { ScoreObjectLayer } from '../layers/score-object-layer';
import { AutomatableLayer } from '../layers/automatable-layer';
import { LAYER_HEIGHT } from '../layers/layer';
import { NoteProcessorChain } from '../../note-processors/note-processor-chain';
import { TimeContext } from '../../time/time-context';
import { Element } from '../../serialization/xml-reader';
import { ObjRefSaveMap, ObjRefLoadMap } from '../../serialization/obj-ref-map';
import { getTrackPlacementForSoundObject } from '../../sound-objects/sound-object-registry';
import {
  applyTrackInstrumentOverride,
  markTrackInstrumentTargets,
  normalizeScoreGenerationOptions,
  type ScoreGenerationOptions,
  type ScoreGenerationOptionsOrSolo,
} from '../score-generation-options';
import { generateTrackAudioPlaybackNotes } from './track-audio-playback';
import { loadSoundObjectFromXML } from '../../sound-objects/sound-object-registry';
import { rebaseScoreToRenderStart } from '../../utilities/score';

export type TrackItem = AudioClip | SoundObject;

interface TrackGenerationEntry {
  readonly item: SoundObject;
  readonly adjustedStart: number;
  readonly adjustedEnd: number;
  readonly options: ScoreGenerationOptions;
}

interface TrackGenerationPlan {
  readonly generationOptions: ScoreGenerationOptions;
  readonly entries: TrackGenerationEntry[];
  readonly clips: AudioClip[];
}

function getInstrumentParameters(instrument: Instrument | null): Parameter[] {
  if (!instrument) return [];
  const candidate = instrument as Instrument & { getParameters?: () => Parameter[] };
  return typeof candidate.getParameters === 'function' ? candidate.getParameters() : [];
}

function remapCopiedInstrumentParameterIds(
  source: ParameterIdList,
  sourceInstrument: Instrument | null,
  copiedInstrument: Instrument | null,
): ParameterIdList {
  const sourceParameters = getInstrumentParameters(sourceInstrument);
  const copiedByName = new Map(
    getInstrumentParameters(copiedInstrument).map((parameter) => [parameter.getName(), parameter]),
  );
  const copiedIdBySourceId = new Map<string, string>();
  for (const parameter of sourceParameters) {
    const copied = copiedByName.get(parameter.getName());
    if (copied) copiedIdBySourceId.set(parameter.getUniqueId(), copied.getUniqueId());
  }

  const remapped = new ParameterIdList();
  for (const parameterId of source.getIds()) {
    remapped.addParameterId(copiedIdBySourceId.get(parameterId) ?? parameterId);
  }
  const selectedId = source.getSelectedId();
  if (selectedId) {
    remapped.setSelectedParameter(copiedIdBySourceId.get(selectedId) ?? selectedId);
  }
  return remapped;
}

export class Track extends Array<TrackItem> implements ScoreObjectLayer<TrackItem>, AutomatableLayer {
  static readonly HEIGHT_MAX_INDEX = 9;
  static get [Symbol.species](): ArrayConstructor { return Array; }

  private _name = '';
  private _muted = false;
  private _solo = false;
  private _uniqueId = generateUniqueId();
  private _heightIndex = 0;
  private _automationParameters = new ParameterIdList();
  private _npc = new NoteProcessorChain();
  private _instrument: Instrument | null = null;
  private _unknownAttributes = new Map<string, string>();
  private _unknownChildren: Element[] = [];

  constructor(other?: Track | number) {
    super(typeof other === 'number' ? other : 0);
    if (other instanceof Track) {
      this._name = other._name;
      this._muted = other._muted;
      this._solo = other._solo;
      this._uniqueId = other._uniqueId;
      this._heightIndex = other._heightIndex;
      this._npc = new NoteProcessorChain(other._npc);
      this._instrument = other._instrument?.deepCopy() ?? null;
      this._automationParameters = remapCopiedInstrumentParameterIds(
        other._automationParameters,
        other._instrument,
        this._instrument,
      );
      this._unknownAttributes = new Map(other._unknownAttributes);
      this._unknownChildren = other._unknownChildren.map((child) => child.clone());
      for (const item of other) {
        this.push(item instanceof AudioClip ? AudioClip.copyFrom(item) : item.deepCopy());
      }
    }
  }

  getName(): string { return this._name; }
  setName(name: string): void { this._name = name; }
  getLayerHeight(): number { return LAYER_HEIGHT * (this._heightIndex + 1); }
  getHeightIndex(): number { return this._heightIndex; }
  setHeightIndex(index: number): void { this._heightIndex = Math.max(0, Math.min(Track.HEIGHT_MAX_INDEX, index)); }
  getUniqueId(): string { return this._uniqueId; }
  setUniqueId(uniqueId: string): void {
    if (uniqueId.trim()) this._uniqueId = uniqueId.trim();
  }
  isMuted(): boolean { return this._muted; }
  setMuted(muted: boolean): void { this._muted = muted; }
  isSolo(): boolean { return this._solo; }
  setSolo(solo: boolean): void { this._solo = solo; }
  getAutomationParameters(): ParameterIdList { return this._automationParameters; }
  getNoteProcessorChain(): NoteProcessorChain { return this._npc; }
  setNoteProcessorChain(chain: NoteProcessorChain): void { this._npc = chain; }

  getInstrument(): Instrument | null { return this._instrument; }

  /** Assigns a deep copy so callers cannot accidentally share ownership. */
  setInstrument(instrument: Instrument | null): void {
    this._instrument = instrument?.deepCopy() ?? null;
  }

  /** Used only by XML reification and canonical patch code that already owns a copy. */
  setOwnedInstrument(instrument: Instrument | null): void {
    this._instrument = instrument;
  }

  clearInstrument(): Instrument | null {
    const previous = this._instrument;
    this._instrument = null;
    return previous;
  }

  accepts(object: ScoreObject): boolean {
    if (object instanceof AudioClip) return true;
    if (!isSoundObject(object)) return false;
    return getTrackPlacementForSoundObject(object).compatible;
  }

  contains(object: ScoreObject): boolean {
    return Array.prototype.includes.call(this, object);
  }

  remove(object: ScoreObject): boolean {
    const index = Array.prototype.indexOf.call(this, object);
    if (index < 0) return false;
    Array.prototype.splice.call(this, index, 1);
    return true;
  }

  clearScoreObjects(): void { this.length = 0; }
  deepCopy(): Track { return new Track(this); }

  generateForCSD(
    context: TimeContext,
    compileData: CompileData,
    startTime: number,
    endTime: number,
    options?: ScoreGenerationOptionsOrSolo,
  ): NoteList {
    const plan = this.createGenerationPlan(context, startTime, endTime, options);
    const notes = new NoteList();
    for (const entry of plan.entries) {
      const generated = entry.item.generateForCSD(
        context,
        compileData,
        entry.adjustedStart,
        entry.adjustedEnd,
        entry.options,
      );
      this.mergeGeneratedItem(notes, entry, generated);
    }
    return this._npc.apply(
      this.finalizeGeneratedNotes(notes, plan, context, compileData, startTime, endTime),
    );
  }

  async generateForCSDAsync(
    context: TimeContext,
    compileData: CompileData,
    startTime: number,
    endTime: number,
    options?: ScoreGenerationOptionsOrSolo,
  ): Promise<NoteList> {
    const plan = this.createGenerationPlan(context, startTime, endTime, options);
    const notes = new NoteList();
    for (const entry of plan.entries) {
      const generated = entry.item.generateForCSDAsync
        ? await entry.item.generateForCSDAsync(
            context,
            compileData,
            entry.adjustedStart,
            entry.adjustedEnd,
            entry.options,
          )
        : entry.item.generateForCSD(
            context,
            compileData,
            entry.adjustedStart,
            entry.adjustedEnd,
            entry.options,
          );
      this.mergeGeneratedItem(notes, entry, generated);
    }
    return this._npc.applyAsync(
      this.finalizeGeneratedNotes(notes, plan, context, compileData, startTime, endTime),
      compileData,
    );
  }

  private createGenerationPlan(
    context: TimeContext,
    startTime: number,
    endTime: number,
    options?: ScoreGenerationOptionsOrSolo,
  ): TrackGenerationPlan {
    const generationOptions = normalizeScoreGenerationOptions(options);
    const entries: TrackGenerationEntry[] = [];
    const clips: AudioClip[] = [];
    const itemOptions: ScoreGenerationOptions = {
      ...generationOptions,
      trackId: this._uniqueId,
    };

    for (const item of this) {
      if (item instanceof AudioClip) {
        clips.push(item);
        continue;
      }
      const itemStart = item.getStartTime().toBeats(context);
      const itemDuration = item.getSubjectiveDuration().toBeats(context);
      const itemEnd = itemStart + itemDuration;
      if (itemEnd <= startTime || (endTime > startTime && itemStart >= endTime)) continue;
      entries.push({
        item,
        adjustedStart: Math.max(0, startTime - itemStart),
        adjustedEnd: endTime > startTime ? Math.max(0, endTime - itemStart) : -1,
        options: itemOptions,
      });
    }
    return { generationOptions, entries, clips };
  }

  private mergeGeneratedItem(
    notes: NoteList,
    entry: TrackGenerationEntry,
    generated: NoteList,
  ): void {
    const descriptor = getTrackPlacementForSoundObject(entry.item).descriptor;
    markTrackInstrumentTargets(
      generated,
      descriptor?.instrumentTargetBehavior ?? 'none',
      entry.options.instrumentTargetCollector,
    );
    notes.merge(generated);
  }

  private finalizeGeneratedNotes(
    notes: NoteList,
    plan: TrackGenerationPlan,
    context: TimeContext,
    compileData: CompileData,
    startTime: number,
    endTime: number,
  ): NoteList {
    rebaseScoreToRenderStart(notes, startTime);

    notes.merge(generateTrackAudioPlaybackNotes(
      this._uniqueId,
      plan.clips,
      context,
      compileData,
      startTime,
      endTime,
    ));
    const trackInstrumentId = plan.generationOptions.instrumentOverrideId
      ?? getTrackInstrumentId(compileData, this._uniqueId);
    if (trackInstrumentId === undefined) return notes;
    for (const note of notes) {
      if (note.getTrackInstrumentTarget() === undefined) note.setTrackInstrumentTarget('preserve');
    }
    applyTrackInstrumentOverride(
      notes,
      trackInstrumentId,
      plan.generationOptions.instrumentTargetCollector,
    );
    return notes;
  }

  saveAsXML(objRefMap?: ObjRefSaveMap): Element {
    const root = new Element('track');
    for (const [name, value] of this._unknownAttributes) root.setAttribute(name, value);
    root.setAttribute('name', this._name);
    root.setAttribute('muted', String(this._muted));
    root.setAttribute('solo', String(this._solo));
    root.setAttribute('heightIndex', String(this._heightIndex));
    root.setAttribute('uniqueId', this._uniqueId);
    root.setAttribute('automationSelectedIndex', String(this._automationParameters.getSelectedIndex()));
    root.addElement(this._npc.saveAsXML().setName('noteProcessorChain'));
    if (this._instrument) root.addElement(this._instrument.saveAsXML());
    for (const item of this) root.addElement(item.saveAsXML(objRefMap));
    for (const id of this._automationParameters.getIds()) root.addElement('parameterId').setText(id);
    for (const child of this._unknownChildren) root.addElement(child.clone());
    return root;
  }

  static loadFromXML(data: Element, objRefMap?: ObjRefLoadMap): Track {
    const track = new Track();
    track._name = data.getAttributeValue('name') ?? '';
    track._muted = data.getAttributeValue('muted') === 'true';
    track._solo = data.getAttributeValue('solo') === 'true';
    const id = data.getAttributeValue('uniqueId');
    if (id) track._uniqueId = id;
    const height = Number.parseInt(data.getAttributeValue('heightIndex') ?? '0', 10);
    if (Number.isFinite(height)) track.setHeightIndex(height);
    const selected = Number.parseInt(data.getAttributeValue('automationSelectedIndex') ?? '0', 10);
    const knownAttributes = new Set([
      'name',
      'muted',
      'solo',
      'heightIndex',
      'uniqueId',
      'automationSelectedIndex',
    ]);
    for (const name of data.getAttributeNames()) {
      if (!knownAttributes.has(name)) {
        track._unknownAttributes.set(name, data.getAttributeValue(name) ?? '');
      }
    }

    const children = data.getElements();
    while (children.hasMoreElements()) {
      const child = children.next();
      switch (child.getName()) {
        case 'noteProcessorChain':
          track._npc = NoteProcessorChain.loadFromXML(child);
          break;
        case 'instrument': {
          if (track._instrument) {
            console.warn(`Track '${track._uniqueId}' contains multiple instruments; retaining the first`);
            break;
          }
          track._instrument = loadInstrumentFromXML(child);
          break;
        }
        case 'audioClip':
          track.push(AudioClip.loadFromXML(child));
          break;
        case 'soundObject': {
          const soundObject = loadSoundObject(child, objRefMap);
          if (soundObject && track.accepts(soundObject)) {
            track.push(soundObject);
          } else {
            track._unknownChildren.push(child.clone());
          }
          break;
        }
        case 'parameterId':
          track._automationParameters.addParameterId(child.getTextString());
          break;
        default:
          track._unknownChildren.push(child.clone());
          break;
      }
    }
    if (Number.isFinite(selected)) track._automationParameters.setSelectedIndex(selected);
    return track;
  }
}

function isSoundObject(value: ScoreObject): value is SoundObject {
  return typeof (value as unknown as { generateForCSD?: unknown }).generateForCSD === 'function';
}

function loadSoundObject(data: Element, objRefMap?: ObjRefLoadMap): SoundObject | null {
  // Static registration is intentionally kept in the package entrypoint, so
  // this file remains free of a dynamic import cycle.
  const type = data.getAttribute('type');
  if (!type) return null;
  const registry = getSoundObjectLoader();
  return registry(data, objRefMap);
}

function getSoundObjectLoader(): (data: Element, objRefMap?: ObjRefLoadMap) => SoundObject | null {
  return loadSoundObjectFromXML;
}

function getTrackInstrumentId(compileData: CompileData, trackId: string): string | undefined {
  const value = compileData.getCompilationVariable(`track-instrument:${trackId}`);
  return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;
}

function generateUniqueId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
