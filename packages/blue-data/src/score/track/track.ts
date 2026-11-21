import {
  withSoundOccurrences,
  withSoundOccurrencesAsync,
} from '../../sound-objects/sound-occurrences';
import { Instrument } from '../../instruments/instrument';
import { loadInstrumentFromXML } from '../../instruments/instrument-registry';
import { ParameterIdList } from '../../automation/parameter-id-list';
import type { Parameter } from '../../automation/parameter';
import type { CopyMode } from '../../deep-copyable';
import { CompileData } from '../../compile-data';
import { NoteList } from '../../sound-objects/note-list';
import type { SoundObject } from '../../sound-objects/sound-object';
import { AudioClip } from '../audio/audio-clip';
import { ScoreObject } from '../score-object';
import { AutomatableLayer } from '../layers/automatable-layer';
import {
  parseCustomHeight,
  resolveEffectiveHeight,
  resolveExplicitHeight,
} from '../layer-height-policy';
import { DEFAULT_LAYER_COLOR, normalizeLayerColor } from '../layers/layer-color';
import { NoteProcessorChain } from '../../note-processors/note-processor-chain';
import { TimeContext } from '../../time/time-context';
import {
  XmlLoadContext,
  requireXmlValue,
  type XmlDiagnosticSink,
} from '../../serialization/xml-load';
import {
  checkRoot,
  checkShape,
  parseXmlBoolean,
  parseXmlInteger,
  readInt,
  readText,
} from '../../utilities/xml';
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
import { generateUuid } from '../../utilities/uuid';

/** An audio clip or a compatible sound object stored on a track. */
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

/** Ordered timeline items with track-level note processing, automation associations, and an optional owned instrument. */
export class Track extends Array<TrackItem> implements AutomatableLayer {
  /** Highest supported zero-based track height preset index. */
  static readonly HEIGHT_MAX_INDEX = 9;
  /** Makes array operations such as `slice` return plain arrays of items. */
  static get [Symbol.species](): ArrayConstructor {
    return Array;
  }

  private _name = '';
  private _muted = false;
  private _solo = false;
  private _uniqueId = generateUuid();
  private _heightIndex = 0;
  private _customHeight?: number;
  private _backgroundColor = DEFAULT_LAYER_COLOR;
  private _automationParameters = new ParameterIdList();
  private _npc = new NoteProcessorChain();
  private _instrument: Instrument | null = null;

  /** Creates an empty track, an array of the given length, or a copy of another track with the same track ID. */
  constructor(other?: Track | number, mode: CopyMode = 'duplication') {
    super(typeof other === 'number' ? other : 0);
    if (other instanceof Track) {
      this._name = other._name;
      this._muted = other._muted;
      this._solo = other._solo;
      this._uniqueId = other._uniqueId;
      this._heightIndex = other._heightIndex;
      this._customHeight = other._customHeight;
      this._backgroundColor = other._backgroundColor;
      this._npc = new NoteProcessorChain(other._npc);
      this._instrument = other._instrument?.deepCopy(mode) ?? null;
      this._automationParameters =
        mode === 'history'
          ? other._automationParameters.deepCopy()
          : remapCopiedInstrumentParameterIds(
              other._automationParameters,
              other._instrument,
              this._instrument,
            );
      for (const item of other) {
        this.push(item instanceof AudioClip ? AudioClip.copyFrom(item) : item.deepCopy(mode));
      }
    }
  }

  /** Returns the track's editable display name. */
  getName(): string {
    return this._name;
  }
  /** Sets the display name without changing the track ID. */
  setName(name: string): void {
    this._name = name;
  }
  /** Returns the effective editor height in pixels after applying any custom override. */
  getLayerHeight(): number {
    return resolveEffectiveHeight(this._heightIndex, this._customHeight);
  }
  /** Returns the custom pixel height, or `undefined` when the track uses a preset. */
  getCustomHeight(): number | undefined {
    return this._customHeight;
  }
  /** Applies a valid custom height in pixels. An absent or invalid height clears the override. */
  setCustomHeight(customHeight: number | undefined): void {
    if (customHeight !== undefined) {
      const parsed = parseCustomHeight(customHeight);
      if (parsed !== null) {
        this._customHeight = parsed;
        return;
      }
    }
    this._customHeight = undefined;
  }
  /** Selects a preset or custom height to match the requested pixels. Returns whether the effective height changed. */
  setExplicitHeight(height: number): boolean {
    const currentEffective = this.getLayerHeight();
    const parsed = parseCustomHeight(height);
    if (parsed === null) return false;
    if (currentEffective === parsed) return false;
    const { heightIndex, customHeight } = resolveExplicitHeight(parsed, 'track');
    this._heightIndex = heightIndex;
    this._customHeight = customHeight;
    return true;
  }
  /** Returns the stored track color as a packed RGB integer. */
  getBackgroundColor(): number {
    return this._backgroundColor;
  }
  /** Sets the track color after applying the shared layer color normalization. */
  setBackgroundColor(color: number): void {
    this._backgroundColor = normalizeLayerColor(color);
  }
  /** Returns the index of the selected layer-height preset. */
  getHeightIndex(): number {
    return this._heightIndex;
  }
  /** Selects a height preset, clamping the index to the supported range. */
  setHeightIndex(index: number): void {
    const oldEffective = this.getLayerHeight();
    const clamped = Math.max(0, Math.min(Track.HEIGHT_MAX_INDEX, index));
    this._heightIndex = clamped;
    const newEffective = resolveEffectiveHeight(clamped);
    if (oldEffective !== newEffective) {
      this._customHeight = undefined;
    }
  }
  /** Returns the stable track ID used to associate mixer and compilation state. */
  getUniqueId(): string {
    return this._uniqueId;
  }
  /** Replaces the track ID with a nonblank identifier after trimming surrounding whitespace. */
  setUniqueId(uniqueId: string): void {
    if (uniqueId.trim()) this._uniqueId = uniqueId.trim();
  }
  /** Reports the track's mute flag. The score's mode determines whether it affects events or audio. */
  isMuted(): boolean {
    return this._muted;
  }
  /** Sets the stored mute flag for the track. */
  setMuted(muted: boolean): void {
    this._muted = muted;
  }
  /** Reports the track's solo flag. The score's mode determines whether it affects events or audio. */
  isSolo(): boolean {
    return this._solo;
  }
  /** Sets the stored solo flag for the track. */
  setSolo(solo: boolean): void {
    this._solo = solo;
  }
  /** Returns the live collection of parameter IDs assigned to the track. */
  getAutomationParameters(): ParameterIdList {
    return this._automationParameters;
  }

  /** Returns the live chain applied to the track's collected notes. */
  getNoteProcessorChain(): NoteProcessorChain {
    return this._npc;
  }
  /** Replaces the track processor chain by reference. */
  setNoteProcessorChain(chain: NoteProcessorChain): void {
    this._npc = chain;
  }

  /** Returns the live track-owned instrument, or `null` when the track has none. */
  getInstrument(): Instrument | null {
    return this._instrument;
  }

  /** Assigns a deep copy so callers cannot accidentally share ownership. */
  setInstrument(instrument: Instrument | null): void {
    this._instrument = instrument?.deepCopy() ?? null;
  }

  /** Used only by XML reification and canonical patch code that already owns a copy. */
  setOwnedInstrument(instrument: Instrument | null): void {
    this._instrument = instrument;
  }

  /** Removes and returns the previous owned instrument, or `null` if there was none. */
  clearInstrument(): Instrument | null {
    const previous = this._instrument;
    this._instrument = null;
    return previous;
  }

  /** Checks whether the score object is an audio clip or a sound object that supports placement on tracks. */
  accepts(object: ScoreObject): boolean {
    if (object instanceof AudioClip) return true;
    if (!isSoundObject(object)) return false;
    return getTrackPlacementForSoundObject(object).compatible;
  }

  /** Checks whether this exact object instance is on the track. */
  contains(object: ScoreObject): boolean {
    return Array.prototype.includes.call(this, object);
  }

  /** Removes the first occurrence of the exact object instance and returns whether it was present. */
  remove(object: ScoreObject): boolean {
    const index = Array.prototype.indexOf.call(this, object);
    if (index < 0) return false;
    Array.prototype.splice.call(this, index, 1);
    return true;
  }

  /** Clears all timeline items while keeping track settings and the instrument. */
  clearScoreObjects(): void {
    this.length = 0;
  }
  /** Copies track content with the requested identity policy. The track ID itself is preserved. */
  deepCopy(mode: CopyMode = 'duplication'): Track {
    return new Track(this, mode);
  }

  /** Generates notes for the track window in Csound beats, rebases them to the render start, and runs track-level processors. */
  generateForCSD(
    context: TimeContext,
    compileData: CompileData,
    startTime: number,
    endTime: number,
    options?: ScoreGenerationOptionsOrSolo,
  ): NoteList {
    return withSoundOccurrences(compileData, startTime, startTime, endTime, () => {
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
    });
  }

  /** Generates track notes while awaiting asynchronous item generators and note processors. */
  async generateForCSDAsync(
    context: TimeContext,
    compileData: CompileData,
    startTime: number,
    endTime: number,
    options?: ScoreGenerationOptionsOrSolo,
  ): Promise<NoteList> {
    return withSoundOccurrencesAsync(compileData, startTime, startTime, endTime, async () => {
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
    });
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

    notes.merge(
      generateTrackAudioPlaybackNotes(
        this._uniqueId,
        plan.clips,
        context,
        compileData,
        startTime,
        endTime,
      ),
    );
    const trackInstrumentId =
      plan.generationOptions.instrumentOverrideId ??
      getTrackInstrumentId(compileData, this._uniqueId);
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

  /** Writes track settings, its owned instrument, and ordered timeline items to XML. */
  saveAsXML(objRefMap?: ObjRefSaveMap): Element {
    const root = new Element('track');
    root.setAttribute('name', this._name);
    root.setAttribute('muted', String(this._muted));
    root.setAttribute('solo', String(this._solo));
    root.setAttribute('heightIndex', String(this._heightIndex));
    if (this._customHeight !== undefined) {
      root.setAttribute('customHeight', String(this._customHeight));
    }
    root.setAttribute('uniqueId', this._uniqueId);
    root.setAttribute(
      'automationSelectedIndex',
      String(this._automationParameters.getSelectedIndex()),
    );
    root.addElement('backgroundColor').setText(String(this._backgroundColor));
    root.addElement(this._npc.saveAsXML().setName('noteProcessorChain'));
    if (this._instrument) root.addElement(this._instrument.saveAsXML());
    for (const item of this) root.addElement(item.saveAsXML(objRefMap));
    for (const id of this._automationParameters.getIds())
      root.addElement('parameterId').setText(id);
    return root;
  }

  /** Loads a track and its items using the supplied XML context and sound object references. */
  static loadFromXML(
    data: Element,
    objRefMap?: ObjRefLoadMap,
    providedContext?: XmlLoadContext,
    sink?: XmlDiagnosticSink,
  ): Track {
    const context = providedContext ?? new XmlLoadContext(data);
    checkRoot(data, 'track', context);
    checkShape(
      data,
      [
        'name',
        'muted',
        'solo',
        'heightIndex',
        'customHeight',
        'uniqueId',
        'automationSelectedIndex',
      ],
      [
        'backgroundColor',
        'noteProcessorChain',
        'instrument',
        'audioClip',
        'soundObject',
        'parameterId',
      ],
      context,
      ['audioClip', 'soundObject', 'parameterId'],
    );
    const track = new Track();
    track._name = data.getAttribute('name') ?? '';
    const id = data.getAttribute('uniqueId');
    if (id !== null) {
      if (!id.trim())
        throw context.at(data).error({
          code: 'value',
          member: '@uniqueId',
          value: id,
          message: 'Track identity must be nonempty.',
          recovery: 'Supply a unique track identity.',
        });
      track._uniqueId = id;
    }
    for (const field of ['muted', 'solo'] as const) {
      const raw = data.getAttribute(field);
      if (raw !== null)
        track[field === 'muted' ? '_muted' : '_solo'] = parseXmlBoolean(
          raw,
          context.at(data),
          '@' + field,
        );
    }
    const height = data.getAttribute('heightIndex');
    if (height !== null)
      track.setHeightIndex(
        parseXmlInteger(height, context.at(data), 0, 2147483647, '@heightIndex'),
      );
    const custom = data.getAttribute('customHeight');
    if (custom !== null)
      track._customHeight = parseXmlInteger(custom, context.at(data), 22, 660, '@customHeight');
    for (const child of data.getElements()) {
      switch (child.getName()) {
        case 'backgroundColor':
          track._backgroundColor = readInt(child, context, -2147483648, 2147483647);
          break;
        case 'noteProcessorChain':
          track._npc = NoteProcessorChain.loadFromXML(child, context);
          break;
        case 'instrument':
          track._instrument = loadInstrumentFromXML(child, context);
          break;
        case 'audioClip':
          track.push(AudioClip.loadFromXML(child, context));
          break;
        case 'soundObject': {
          const object = loadSoundObjectFromXML(child, objRefMap, context);
          if (!track.accepts(object))
            throw context.at(child).error({
              code: 'type',
              member: '@type',
              value: child.getAttribute('type') ?? '',
              message: 'SoundObject cannot be placed in a Track.',
              recovery: 'Place it in a compatible layer.',
            });
          track.push(object);
          break;
        }
        case 'parameterId': {
          const id = readText(child, context);
          if (!id.trim() || track._automationParameters.getIds().includes(id))
            throw context.at(child).error({
              code: 'reference',
              value: id,
              message: 'Automation IDs must be nonempty and unique.',
              recovery: 'Supply distinct parameter IDs.',
            });
          track._automationParameters.addParameterId(id);
          break;
        }
      }
    }
    const selected = data.getAttribute('automationSelectedIndex');
    if (selected !== null)
      track._automationParameters.setSelectedIndex(
        parseXmlInteger(
          selected,
          context.at(data),
          -1,
          Number.MAX_SAFE_INTEGER,
          '@automationSelectedIndex',
        ),
      );
    return providedContext ? track : requireXmlValue(context.result(track), sink);
  }
}

function isSoundObject(value: ScoreObject): value is SoundObject {
  return typeof (value as unknown as { generateForCSD?: unknown }).generateForCSD === 'function';
}

function getTrackInstrumentId(compileData: CompileData, trackId: string): string | undefined {
  const value = compileData.getCompilationVariable(`track-instrument:${trackId}`);
  return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;
}
