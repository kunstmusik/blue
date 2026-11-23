import { withSoundOccurrences, withSoundOccurrencesAsync } from './sound-occurrences';
/**
 * SoundLayer — a layer within a PolyObject that contains SoundObjects.
 * Mirrors the Java SoundLayer class.
 *
 * generateForCSD sorts sound objects by start time, computes adjusted
 * start/end times relative to each object's timeline, and merges notes
 * without applying an additional offset (sound objects handle their own
 * start time internally).
 */
import { Layer } from '../score/layers/layer';
import { AutomatableLayer } from '../score/layers/automatable-layer';
import { ParameterIdList } from '../automation/parameter-id-list';
import { ScoreObject } from '../score/score-object';
import { SoundObject } from '../sound-objects/sound-object';
import { TimeContext } from '../time/time-context';
import { CompileData } from '../compile-data';
import { NoteList } from './note-list';
import { NoteProcessorChain } from '../note-processors/note-processor-chain';
import { applyNoteProcessorChain, applyNoteProcessorChainAsync } from '../utilities/score';
import { DEFAULT_LAYER_COLOR, normalizeLayerColor } from '../score/layers/layer-color';
import { XmlLoadContext, requireXmlValue, type XmlDiagnosticSink } from '../serialization/xml-load';
import { ObjRefLoadMap } from '../serialization/obj-ref-map';
import {
  checkRoot,
  checkShape,
  parseXmlBoolean,
  parseXmlInteger,
  readInt,
  readText,
} from '../utilities/xml';
import { loadSoundObjectFromXML } from './sound-object-registry';
import { Element } from '../serialization/xml-reader';
import type { CopyMode } from '../deep-copyable';
import {
  parseCustomHeight,
  resolveEffectiveHeight,
  resolveExplicitHeight,
} from '../score/layer-height-policy';
import type { ScoreGenerationOptions } from '../score/score-generation-options';

export class SoundLayer extends Array<SoundObject> implements Layer, AutomatableLayer {
  private _name = '';
  private _muted = false;
  private _solo = false;
  private _heightIndex = 0;
  private _customHeight?: number;
  private _backgroundColor = DEFAULT_LAYER_COLOR;
  private _npc = new NoteProcessorChain();
  private _automationParameters = new ParameterIdList();

  /** Creates an empty sound layer, copies a source instance, or allocates the requested number of array slots. */
  constructor(other?: SoundLayer | number, mode: CopyMode = 'duplication') {
    if (typeof other === 'number') {
      super(other);
      return;
    }

    super();
    if (other) {
      this._name = other._name;
      this._muted = other._muted;
      this._solo = other._solo;
      this._heightIndex = other._heightIndex;
      this._customHeight = other._customHeight;
      this._backgroundColor = other._backgroundColor;
      this._npc = new NoteProcessorChain(other._npc);
      this._automationParameters = other._automationParameters.deepCopy();

      for (const sObj of other) {
        this.push(sObj.deepCopy(mode));
      }
    }
  }

  /** Reconstructs the sound layer from its Blue XML element, using the supplied diagnostic context when provided. */
  static loadFromXML(
    data: Element,
    objRefMap?: ObjRefLoadMap,
    providedContext?: XmlLoadContext,
    sink?: XmlDiagnosticSink,
  ): SoundLayer {
    const context = providedContext ?? new XmlLoadContext(data);
    checkRoot(data, 'soundLayer', context);
    checkShape(
      data,
      ['name', 'muted', 'solo', 'heightIndex', 'customHeight', 'automationSelectedIndex'],
      ['backgroundColor', 'noteProcessorChain', 'soundObject', 'parameterId'],
      context,
      ['soundObject', 'parameterId'],
    );
    const layer = new SoundLayer();
    layer._name = data.getAttribute('name') ?? '';
    for (const field of ['muted', 'solo'] as const) {
      const value = data.getAttribute(field);
      if (value !== null)
        layer[field === 'muted' ? '_muted' : '_solo'] = parseXmlBoolean(
          value,
          context.at(data),
          '@' + field,
        );
    }
    const height = data.getAttribute('heightIndex');
    if (height !== null)
      layer._heightIndex = parseXmlInteger(height, context.at(data), 0, 2147483647, '@heightIndex');
    const custom = data.getAttribute('customHeight');
    if (custom !== null)
      layer._customHeight = parseXmlInteger(custom, context.at(data), 22, 660, '@customHeight');
    const pendingParameterIds: string[] = [];
    const seenParameterIds = new Set<string>();
    for (const child of data.getElements()) {
      switch (child.getName()) {
        case 'backgroundColor':
          layer._backgroundColor = readInt(child, context, -2147483648, 2147483647);
          break;
        case 'noteProcessorChain':
          layer._npc = NoteProcessorChain.loadFromXML(child, context);
          break;
        case 'soundObject':
          layer.push(loadSoundObjectFromXML(child, objRefMap, context));
          break;
        case 'parameterId': {
          const id = readText(child, context);
          if (!id.trim() || seenParameterIds.has(id))
            throw context.at(child).error({
              code: 'reference',
              value: id,
              message: 'Automation IDs must be nonempty and unique.',
              recovery: 'Supply distinct parameter IDs.',
            });
          seenParameterIds.add(id);
          pendingParameterIds.push(id);
          break;
        }
      }
    }
    if (pendingParameterIds.length > 0) {
      layer._automationParameters.addParameterIds(pendingParameterIds);
    }
    const selected = data.getAttribute('automationSelectedIndex');
    if (selected !== null)
      layer._automationParameters.setSelectedIndex(
        parseXmlInteger(
          selected,
          context.at(data),
          -1,
          Number.MAX_SAFE_INTEGER,
          '@automationSelectedIndex',
        ),
      );
    return providedContext ? layer : requireXmlValue(context.result(layer), sink);
  }

  // ─── Layer implementation ───

  getBackgroundColor(): number {
    return this._backgroundColor;
  }

  setBackgroundColor(color: number): void {
    this._backgroundColor = normalizeLayerColor(color);
  }

  getName(): string {
    return this._name;
  }

  setName(name: string): void {
    this._name = name;
  }

  getLayerHeight(): number {
    return resolveEffectiveHeight(this._heightIndex, this._customHeight);
  }

  /** Returns the custom height stored on the sound layer. */
  getCustomHeight(): number | undefined {
    return this._customHeight;
  }

  /** Sets the custom height stored on the sound layer. */
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

  /** Chooses a preset or custom pixel height and reports whether the effective height changed. */
  setExplicitHeight(height: number): boolean {
    const currentEffective = this.getLayerHeight();
    const parsed = parseCustomHeight(height);
    if (parsed === null) return false;
    if (currentEffective === parsed) return false;
    const { heightIndex, customHeight } = resolveExplicitHeight(parsed, 'soundLayer');
    this._heightIndex = heightIndex;
    this._customHeight = customHeight;
    return true;
  }

  /** Reports whether the sound layer is muted. */
  isMuted(): boolean {
    return this._muted;
  }

  /** Sets the muted stored on the sound layer. */
  setMuted(muted: boolean): void {
    this._muted = muted;
  }

  /** Reports whether the sound layer is marked for solo playback. */
  isSolo(): boolean {
    return this._solo;
  }

  /** Sets the solo stored on the sound layer. */
  setSolo(solo: boolean): void {
    this._solo = solo;
  }

  /** Returns the height index stored on the sound layer. */
  getHeightIndex(): number {
    return this._heightIndex;
  }

  /** Sets the height index stored on the sound layer. */
  setHeightIndex(heightIndex: number): void {
    const oldEffective = this.getLayerHeight();
    this._heightIndex = heightIndex;
    const newEffective = resolveEffectiveHeight(heightIndex);
    if (oldEffective !== newEffective) {
      this._customHeight = undefined;
    }
  }

  /** Returns the editable chain that runs over notes collected from this layer. */
  getNoteProcessorChain(): NoteProcessorChain {
    return this._npc;
  }

  /** Replaces the layer's processor chain with the supplied instance. */
  setNoteProcessorChain(chain: NoteProcessorChain): void {
    this._npc = chain;
  }

  /** Returns the collection of associated automation parameter IDs. */
  getAutomationParameters(): ParameterIdList {
    return this._automationParameters;
  }

  accepts(object: ScoreObject): boolean {
    // SoundLayer accepts any SoundObject
    return 'generateForCSD' in object;
  }

  contains(object: ScoreObject): boolean {
    return (this as SoundObject[]).includes(object as SoundObject);
  }

  remove(object: ScoreObject): boolean {
    const idx = this.indexOf(object as SoundObject);
    if (idx !== -1) {
      this.splice(idx, 1);
      return true;
    }
    return false;
  }

  clearScoreObjects(): void {
    this.length = 0;
  }

  private sortByStartBeat(context: TimeContext): Array<{ sObj: SoundObject; sObjStart: number }> {
    return [...this]
      .map((sObj) => ({ sObj, sObjStart: sObj.getStartTime().toBeats(context) }))
      .sort((a, b) => a.sObjStart - b.sObjStart);
  }

  /**
   * Generate notes for all sound objects in this layer.
   * Mirrors Java SoundLayer.generateForCSD exactly:
   * - Sort sound objects by start time
   * - Compute adjustedStart/adjustedEnd relative to each object's timeline
   * - Skip objects that don't overlap with the render range
   * - Each sound object handles its own start time offset internally
   * - Do NOT apply an additional offset here
   */
  generateForCSD(
    context: TimeContext,
    compileData: CompileData,
    startTime: number,
    endTime: number,
    options?: ScoreGenerationOptions,
  ): NoteList {
    return withSoundOccurrences(compileData, 0, startTime, endTime, () => {
      const noteList = new NoteList();

      // Sort sound objects by start time
      const sorted = this.sortByStartBeat(context);

      for (const { sObj, sObjStart } of sorted) {
        const sObjDur = sObj.getSubjectiveDuration().toBeats(context);
        const sObjEnd = sObjStart + sObjDur;

        // Skip objects that end before the render start
        if (sObjEnd <= startTime) continue;

        let adjustedStart: number;
        let adjustedEnd: number;

        if (endTime <= startTime) {
          // No end time constraint: render from adjustedStart to end
          adjustedStart = startTime - sObjStart;
          if (adjustedStart < 0) adjustedStart = 0;
          adjustedEnd = -1;
        } else if (sObjStart < endTime) {
          // Both start and end constraints
          adjustedStart = startTime - sObjStart;
          adjustedEnd = endTime - sObjStart;
          if (adjustedStart < 0) adjustedStart = 0;
          if (adjustedEnd >= sObjDur) adjustedEnd = -1;
        } else {
          // Object starts after render end — skip
          continue;
        }

        const nl = sObj.generateForCSD(context, compileData, adjustedStart, adjustedEnd, options);
        noteList.merge(nl);
      }

      return applyNoteProcessorChain(noteList, this._npc);
    });
  }

  /** Generates the sound layer’s Csound notes, awaiting asynchronous generators or processors through the compile context. */
  async generateForCSDAsync(
    context: TimeContext,
    compileData: CompileData,
    startTime: number,
    endTime: number,
    options?: ScoreGenerationOptions,
  ): Promise<NoteList> {
    return withSoundOccurrencesAsync(compileData, 0, startTime, endTime, async () => {
      const noteList = new NoteList();

      const sorted = this.sortByStartBeat(context);

      for (const { sObj, sObjStart } of sorted) {
        const sObjDur = sObj.getSubjectiveDuration().toBeats(context);
        const sObjEnd = sObjStart + sObjDur;

        if (sObjEnd <= startTime) continue;

        let adjustedStart: number;
        let adjustedEnd: number;

        if (endTime <= startTime) {
          adjustedStart = startTime - sObjStart;
          if (adjustedStart < 0) adjustedStart = 0;
          adjustedEnd = -1;
        } else if (sObjStart < endTime) {
          adjustedStart = startTime - sObjStart;
          adjustedEnd = endTime - sObjStart;
          if (adjustedStart < 0) adjustedStart = 0;
          if (adjustedEnd >= sObjDur) adjustedEnd = -1;
        } else {
          continue;
        }

        const nl = sObj.generateForCSDAsync
          ? await sObj.generateForCSDAsync(
              context,
              compileData,
              adjustedStart,
              adjustedEnd,
              options,
            )
          : sObj.generateForCSD(context, compileData, adjustedStart, adjustedEnd, options);
        noteList.merge(nl);
      }

      return applyNoteProcessorChainAsync(noteList, this._npc, compileData);
    });
  }

  deepCopy(mode: CopyMode = 'duplication'): SoundLayer {
    return new SoundLayer(this, mode);
  }
}
