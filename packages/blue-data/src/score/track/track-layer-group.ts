import { Track } from './track';
import { LayerGroup } from '../layers/layer-group';
import type { CopyMode } from '../../deep-copyable';
import { NoteProcessorChain } from '../../note-processors/note-processor-chain';
import { NoteList } from '../../sound-objects/note-list';
import { PythonObject } from '../../sound-objects/python-object';
import { AudioClip } from '../audio/audio-clip';
import { ClojureObject } from '../../sound-objects/clojure-object';
import { JavaScriptObject } from '../../sound-objects/javascript-object';
import { Instance } from '../../sound-objects/instance';
import type { JavaScriptSession } from '../../javascript-runtime';
import type { JavaRuntimeClientContract } from '../../java-runtime';
import { TimeContext } from '../../time/time-context';
import { CompileData } from '../../compile-data';
import { Element } from '../../serialization/xml-reader';
import { ObjRefSaveMap, ObjRefLoadMap } from '../../serialization/obj-ref-map';
import { writeInt } from '../../utilities/xml';
import { LAYER_HEIGHT } from '../layers/layer';
import {
  normalizeScoreGenerationOptions,
  type ScoreGenerationOptions,
  type ScoreGenerationOptionsOrSolo,
} from '../score-generation-options';
import { generateUuid } from '../../utilities/uuid';

export class TrackLayerGroup extends Array<Track> implements LayerGroup<Track> {
  static get [Symbol.species](): ArrayConstructor {
    return Array;
  }
  private _name = 'Track Layer Group';
  private _uniqueId = generateUuid();
  private _defaultHeightIndex = 0;
  private _unknownAttributes = new Map<string, string>();
  private _unknownChildren: Element[] = [];
  private _tracksAttributes = new Map<string, string>();
  private _unknownTracksChildren: Element[] = [];

  constructor(other?: TrackLayerGroup | number, mode: CopyMode = 'duplication') {
    super(typeof other === 'number' ? other : 0);
    if (other instanceof TrackLayerGroup) {
      this._name = other._name;
      this._uniqueId = other._uniqueId;
      this._defaultHeightIndex = other._defaultHeightIndex;
      this._unknownAttributes = new Map(other._unknownAttributes);
      this._unknownChildren = other._unknownChildren.map((child) => child.clone());
      this._tracksAttributes = new Map(other._tracksAttributes);
      this._unknownTracksChildren = other._unknownTracksChildren.map((child) => child.clone());
      for (const track of other) this.push(track.deepCopy(mode));
    }
  }

  getName(): string {
    return this._name;
  }
  setName(name: string): void {
    this._name = name;
  }
  getUniqueId(): string {
    return this._uniqueId;
  }
  setUniqueId(uniqueId: string): void {
    if (uniqueId.trim()) this._uniqueId = uniqueId.trim();
  }
  getDefaultHeightIndex(): number {
    return this._defaultHeightIndex;
  }
  setDefaultHeightIndex(index: number): void {
    this._defaultHeightIndex = Math.max(0, Math.min(Track.HEIGHT_MAX_INDEX, index));
  }
  getNoteProcessorChain(): NoteProcessorChain {
    return new NoteProcessorChain();
  }
  hasSoloLayers(): boolean {
    return this.some((track) => track.isSolo());
  }
  /** Spec 111: unknown preserved data makes conservative certification refuse. */
  hasUnknownContent(): boolean {
    return (
      this._unknownAttributes.size > 0 ||
      this._unknownChildren.length > 0 ||
      this._tracksAttributes.size > 0 ||
      this._unknownTracksChildren.length > 0
    );
  }

  /**
   * Runs on-load processing for script SoundObjects placed directly on a
   * Track, mirroring PolyObject.processOnLoad for layer-held objects.
   * AudioClips carry no on-load behavior and PolyObjects cannot be placed
   * on Tracks, so only the script object types are considered.
   */
  processOnLoad(context: TimeContext, session?: JavaScriptSession): void {
    for (const track of this) {
      for (const item of track) {
        const target = resolveTrackOnLoadTarget(item);
        if (target instanceof JavaScriptObject && target.isOnLoadProcessable()) {
          target.processOnLoad(context, session);
        } else if (target instanceof ClojureObject && target.isOnLoadProcessable()) {
          target.processOnLoad(context);
        } else if (target instanceof PythonObject && target.isOnLoadProcessable()) {
          target.processOnLoad(context);
        }
      }
    }
  }

  async processOnLoadAsync(
    context: TimeContext,
    session?: JavaScriptSession,
    runtimeClient?: JavaRuntimeClientContract | null,
  ): Promise<void> {
    for (const track of this) {
      for (const item of track) {
        const target = resolveTrackOnLoadTarget(item);
        if (target instanceof JavaScriptObject && target.isOnLoadProcessable()) {
          target.processOnLoad(context, session);
        } else if (target instanceof ClojureObject && target.isOnLoadProcessable()) {
          await target.processOnLoadAsync(context, runtimeClient);
        } else if (target instanceof PythonObject && target.isOnLoadProcessable()) {
          await target.processOnLoadAsync(context, runtimeClient);
        }
      }
    }
  }

  generateForCSD(
    context: TimeContext,
    compileData: CompileData,
    startTime: number,
    endTime: number,
    options?: ScoreGenerationOptionsOrSolo,
  ): NoteList {
    const generationOptions = normalizeScoreGenerationOptions(options);
    const notes = new NoteList();
    // Audio header authority (Spec 111): track event flags and event solo do
    // not filter Track groups; mixer audio mute/solo handles audibility.
    const audioMode = generationOptions.trackLayerMuteSoloMode === 'audio';
    for (const track of this) {
      if (!audioMode) {
        if (track.isMuted()) continue;
        if (generationOptions.processWithSolo && !track.isSolo()) continue;
      }
      if (generationOptions.pruneInaudibleTracks?.has(track.getUniqueId())) {
        reportPrunedTrackDurationBound(track, generationOptions, context, startTime, endTime);
        continue;
      }
      const trackId = getTrackInstrumentId(compileData, track.getUniqueId());
      notes.merge(
        track.generateForCSD(context, compileData, startTime, endTime, {
          ...generationOptions,
          trackId: track.getUniqueId(),
          instrumentOverrideId: trackId,
        }),
      );
    }
    return notes;
  }

  async generateForCSDAsync(
    context: TimeContext,
    compileData: CompileData,
    startTime: number,
    endTime: number,
    options?: ScoreGenerationOptionsOrSolo,
  ): Promise<NoteList> {
    const generationOptions = normalizeScoreGenerationOptions(options);
    const notes = new NoteList();
    const audioMode = generationOptions.trackLayerMuteSoloMode === 'audio';
    for (const track of this) {
      if (!audioMode) {
        if (track.isMuted()) continue;
        if (generationOptions.processWithSolo && !track.isSolo()) continue;
      }
      if (generationOptions.pruneInaudibleTracks?.has(track.getUniqueId())) {
        reportPrunedTrackDurationBound(track, generationOptions, context, startTime, endTime);
        continue;
      }
      const trackId = getTrackInstrumentId(compileData, track.getUniqueId());
      notes.merge(
        await track.generateForCSDAsync(context, compileData, startTime, endTime, {
          ...generationOptions,
          trackId: track.getUniqueId(),
          instrumentOverrideId: trackId,
        }),
      );
    }
    return notes;
  }

  saveAsXML(objRefMap?: ObjRefSaveMap): Element {
    const root = new Element('trackLayerGroup');
    for (const [name, value] of this._unknownAttributes) root.setAttribute(name, value);
    root.setAttribute('name', this._name);
    root.setAttribute('uniqueId', this._uniqueId);
    root.addElement(writeInt('defaultHeightIndex', this._defaultHeightIndex));
    for (const child of this._unknownChildren) root.addElement(child.clone());
    const tracks = root.addElement('tracks');
    for (const [name, value] of this._tracksAttributes) tracks.setAttribute(name, value);
    for (const track of this) tracks.addElement(track.saveAsXML(objRefMap));
    for (const child of this._unknownTracksChildren) tracks.addElement(child.clone());
    return root;
  }

  static loadFromXML(data: Element, objRefMap?: ObjRefLoadMap): TrackLayerGroup {
    const group = new TrackLayerGroup();
    group._name = data.getAttributeValue('name') ?? group._name;
    group._uniqueId = data.getAttributeValue('uniqueId') ?? group._uniqueId;
    for (const name of data.getAttributeNames()) {
      if (name !== 'name' && name !== 'uniqueId') {
        group._unknownAttributes.set(name, data.getAttributeValue(name) ?? '');
      }
    }
    const nodes = data.getElements();
    while (nodes.hasMoreElements()) {
      const node = nodes.next();
      if (node.getName() === 'defaultHeightIndex') {
        const value = Number.parseInt(node.getTextString(), 10);
        // Preserve imported values verbatim. Rendering/new layers fall back to
        // 22px for an invalid value, but the original XML must not be rewritten
        // until the user explicitly edits the default.
        if (Number.isFinite(value)) group._defaultHeightIndex = value;
      } else if (node.getName() === 'tracks') {
        for (const name of node.getAttributeNames()) {
          group._tracksAttributes.set(name, node.getAttributeValue(name) ?? '');
        }
        const tracks = node.getElements();
        while (tracks.hasMoreElements()) {
          const child = tracks.next();
          if (child.getName() === 'track') {
            group.push(Track.loadFromXML(child, objRefMap));
          } else {
            group._unknownTracksChildren.push(child.clone());
          }
        }
      } else {
        group._unknownChildren.push(node.clone());
      }
    }
    return group;
  }

  newLayerAt(index: number): Track {
    const track = new Track();
    const defaultHeightIndex =
      Number.isInteger(this._defaultHeightIndex) &&
      this._defaultHeightIndex >= 0 &&
      this._defaultHeightIndex <= Track.HEIGHT_MAX_INDEX
        ? this._defaultHeightIndex
        : 0;
    track.setHeightIndex(defaultHeightIndex);
    const insertIndex = Math.min(Math.max(index, 0), this.length);
    this.splice(insertIndex, 0, track);
    return track;
  }

  removeLayers(startIndex: number, endIndex: number): void {
    const safeStart = Math.max(0, startIndex);
    const safeEnd = Math.min(this.length - 1, endIndex);
    if (safeEnd < safeStart) return;
    for (let i = safeEnd; i >= safeStart; i--) this.splice(i, 1);
  }

  pushUpLayers(startIndex: number, endIndex: number): void {
    if (startIndex <= 0 || startIndex > endIndex) return;
    const moved = this.splice(startIndex - 1, 1)[0];
    if (moved) this.splice(Math.min(endIndex, this.length), 0, moved);
  }

  pushDownLayers(startIndex: number, endIndex: number): void {
    if (endIndex >= this.length - 1 || startIndex > endIndex) return;
    const moved = this.splice(endIndex + 1, 1)[0];
    if (moved) this.splice(startIndex, 0, moved);
  }

  onLoadComplete(_context: TimeContext): void {}

  deepCopy(mode: CopyMode = 'duplication'): TrackLayerGroup {
    return new TrackLayerGroup(this, mode);
  }
  getTotalHeight(): number {
    return this.reduce((height, track) => height + track.getLayerHeight(), 0);
  }
  getLayerNumForY(y: number): number {
    let running = 0;
    for (let i = 0; i < this.length; i++) {
      running += this[i].getLayerHeight();
      if (running > y) return i;
    }
    return this.length - 1;
  }
}

/**
 * Spec 111 disk pruning: reports the duration the pruned track's clips would
 * have contributed, using the exact scheduling/window math of
 * generateTrackAudioPlaybackNotes so the export length never shrinks when the
 * longest clip is pruned. No notes are generated.
 */
function reportPrunedTrackDurationBound(
  track: Track,
  options: ScoreGenerationOptions,
  context: TimeContext,
  startTime: number,
  endTime: number,
): void {
  const sink = options.prunedDurationSink;
  if (!sink) return;
  const usesEndTime = endTime > startTime;
  const adjustedEndTime = endTime - startTime;
  for (const item of track) {
    if (!(item instanceof AudioClip)) continue;
    const clipStart = item.getStartTime().toBeats(context);
    const clipDur = item.getSubjectiveDuration().toBeats(context);
    const clipEnd = clipStart + clipDur;
    if (clipEnd <= startTime || (usesEndTime && clipStart >= endTime)) continue;

    const newStart = Math.max(clipStart - startTime, 0);
    const newEnd = clipEnd - startTime;
    const newDuration =
      usesEndTime && newEnd > adjustedEndTime ? adjustedEndTime - newStart : newEnd - newStart;
    const bound = newStart + newDuration;
    if (bound > sink.value) sink.value = bound;
  }
}

type TrackOnLoadTarget = JavaScriptObject | ClojureObject | PythonObject;

function resolveTrackOnLoadTarget(item: unknown): TrackOnLoadTarget | null {
  if (!(item instanceof Instance)) {
    return item instanceof JavaScriptObject ||
      item instanceof ClojureObject ||
      item instanceof PythonObject
      ? item
      : null;
  }
  const target = item.getSoundObject();
  if (target instanceof Instance) return resolveTrackOnLoadTarget(target);
  return target instanceof JavaScriptObject ||
    target instanceof ClojureObject ||
    target instanceof PythonObject
    ? target
    : null;
}

function getTrackInstrumentId(compileData: CompileData, trackId: string): string | undefined {
  const value = compileData.getCompilationVariable(`track-instrument:${trackId}`);
  return typeof value === 'number' || typeof value === 'string' ? String(value) : undefined;
}
