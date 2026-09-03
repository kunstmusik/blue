/**
 * SoundLayer — a layer within a PolyObject that contains SoundObjects.
 * Mirrors the Java SoundLayer class.
 *
 * generateForCSD sorts sound objects by start time, computes adjusted
 * start/end times relative to each object's timeline, and merges notes
 * without applying an additional offset (sound objects handle their own
 * start time internally).
 */
import { Layer, LAYER_HEIGHT } from '../score/layers/layer';
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
import { Element } from '../serialization/xml-reader';

export class SoundLayer extends Array<SoundObject> implements Layer, AutomatableLayer {
  private _name = '';
  private _muted = false;
  private _solo = false;
  private _heightIndex = 0;
  private _backgroundColor = DEFAULT_LAYER_COLOR;
  private _npc = new NoteProcessorChain();
  private _automationParameters = new ParameterIdList();
  private _unknownAttributes = new Map<string, string>();
  private _unknownChildren: Element[] = [];

  constructor(other?: SoundLayer | number) {
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
      this._backgroundColor = other._backgroundColor;
      this._npc = new NoteProcessorChain(other._npc);
      this._automationParameters = other._automationParameters.deepCopy();

      for (const [k, v] of other._unknownAttributes) {
        this._unknownAttributes.set(k, v);
      }
      this._unknownChildren = other._unknownChildren.map((c) => c.clone());

      for (const sObj of other) {
        this.push(sObj.deepCopy());
      }
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
    return LAYER_HEIGHT * (this._heightIndex + 1);
  }

  isMuted(): boolean {
    return this._muted;
  }

  setMuted(muted: boolean): void {
    this._muted = muted;
  }

  isSolo(): boolean {
    return this._solo;
  }

  setSolo(solo: boolean): void {
    this._solo = solo;
  }

  getHeightIndex(): number {
    return this._heightIndex;
  }

  setHeightIndex(heightIndex: number): void {
    this._heightIndex = heightIndex;
  }

  getNoteProcessorChain(): NoteProcessorChain {
    return this._npc;
  }

  setNoteProcessorChain(chain: NoteProcessorChain): void {
    this._npc = chain;
  }

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
  ): NoteList {
    const noteList = new NoteList();

    // Sort sound objects by start time
    const sorted = [...this].sort((a, b) =>
      a.getStartTime().toBeats(context) - b.getStartTime().toBeats(context),
    );

    for (const sObj of sorted) {
      const sObjStart = sObj.getStartTime().toBeats(context);
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

      const nl = sObj.generateForCSD(context, compileData, adjustedStart, adjustedEnd);
      noteList.merge(nl);
    }

    return applyNoteProcessorChain(noteList, this._npc);
  }

  async generateForCSDAsync(
    context: TimeContext,
    compileData: CompileData,
    startTime: number,
    endTime: number,
  ): Promise<NoteList> {
    const noteList = new NoteList();

    const sorted = [...this].sort((a, b) =>
      a.getStartTime().toBeats(context) - b.getStartTime().toBeats(context),
    );

    for (const sObj of sorted) {
      const sObjStart = sObj.getStartTime().toBeats(context);
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
        ? await sObj.generateForCSDAsync(context, compileData, adjustedStart, adjustedEnd)
        : sObj.generateForCSD(context, compileData, adjustedStart, adjustedEnd);
      noteList.merge(nl);
    }

    return applyNoteProcessorChainAsync(noteList, this._npc, compileData);
  }

  deepCopy(): SoundLayer {
    return new SoundLayer(this);
  }
}
