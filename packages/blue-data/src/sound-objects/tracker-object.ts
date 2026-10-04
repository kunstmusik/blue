/**
 * TrackerObject — generates notes from a tracker-style step sequencer.
 * Mirrors the Java TrackerObject class.
 *
 * Phase 11: Data preservation (load/save XML). Full tracker generation
 * requires the TrackList sub-system.
 */
import { AbstractSoundObject } from './abstract-sound-object';
import { NoteList } from './note-list';
import { TimeBehavior } from './time-behavior';
import { TimeContext } from '../time/time-context';
import { TimeDuration } from '../time/time-duration';
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
import { initBasicFromXML, getBasicXML } from './sound-object-utilities';
import { TrackList } from './tracker/track-list';
import { NoteProcessorChain } from '../note-processors/note-processor-chain';
import {
  applyNoteProcessorChain,
  applyNoteProcessorChainAsync,
  applyTimeBehavior,
  setScoreStart,
} from '../utilities/score';

export class TrackerObject extends AbstractSoundObject {
  private _stepsPerBeat = 4;
  private _tracks = new TrackList();
  // Java keeps these in TrackerEditor. The Electron editor document needs the
  // canonical object to retain them across asynchronous panel refreshes.
  private _keyboardNotesEnabled = false;
  private _keyboardOctave = 0;

  constructor(other?: TrackerObject) {
    super();
    this.setName('Tracker');
    this._timeBehavior = TimeBehavior.REPEAT;
    this._repeatPoint = TimeDuration.beats(16);
    if (other) {
      this.copyFrom(other);
      this._stepsPerBeat = other._stepsPerBeat;
      this._tracks = new TrackList(other._tracks);
      this._keyboardNotesEnabled = other._keyboardNotesEnabled;
      this._keyboardOctave = other._keyboardOctave;
    }
  }

  getStepsPerBeat(): number {
    return this._stepsPerBeat;
  }
  setStepsPerBeat(s: number): void {
    this._stepsPerBeat = s;
  }

  getTracks(): TrackList {
    return this._tracks;
  }
  setTracks(tracks: TrackList): void {
    this._tracks = tracks;
  }

  isKeyboardNotesEnabled(): boolean {
    return this._keyboardNotesEnabled;
  }
  setKeyboardNotesEnabled(enabled: boolean): void {
    this._keyboardNotesEnabled = enabled;
  }

  getKeyboardOctave(): number {
    return this._keyboardOctave;
  }
  setKeyboardOctave(octave: number): void {
    if (!Number.isFinite(octave)) return;
    this._keyboardOctave = Math.max(-8, Math.min(8, Math.trunc(octave)));
  }

  override getNoteProcessorChain(): NoteProcessorChain {
    return this._npc;
  }

  override generateForCSD(
    context: TimeContext,
    _compileData: CompileData,
    _startTime: number,
    _endTime: number,
  ): NoteList {
    let nl = this._tracks.generateNotes(this._stepsPerBeat);

    nl = applyNoteProcessorChain(nl, this._npc);

    const duration = this.getSubjectiveDuration().toBeats(context);
    const startTime = this.getStartTime().toBeats(context);
    const rpBeats = this.getRepeatPoint() ? this.getRepeatPoint()!.toBeats(context) : -1.0;

    applyTimeBehavior(nl, this._timeBehavior, duration, rpBeats, this._tracks.getSteps());
    setScoreStart(nl, startTime);

    return nl;
  }

  async generateForCSDAsync(
    context: TimeContext,
    compileData: CompileData,
    _startTime: number,
    _endTime: number,
  ): Promise<NoteList> {
    let nl = this._tracks.generateNotes(this._stepsPerBeat);

    nl = await applyNoteProcessorChainAsync(nl, this._npc, compileData);

    const duration = this.getSubjectiveDuration().toBeats(context);
    const startTime = this.getStartTime().toBeats(context);
    const rpBeats = this.getRepeatPoint() ? this.getRepeatPoint()!.toBeats(context) : -1.0;

    applyTimeBehavior(nl, this._timeBehavior, duration, rpBeats, this._tracks.getSteps());
    setScoreStart(nl, startTime);

    return nl;
  }

  override saveAsXML(_objRefMap?: ObjRefSaveMap): Element {
    const elem = getBasicXML(this, 'blue.soundObject.TrackerObject');
    elem.addElement('stepsPerBeat').setText(this._stepsPerBeat.toString());
    elem.addElement(this._tracks.saveAsXML());

    return elem;
  }

  static loadFromXML(
    data: Element,
    _objRefMap?: ObjRefLoadMap,
    context?: XmlLoadContext,
    sink?: XmlDiagnosticSink,
  ): TrackerObject {
    const ctx = context ?? new XmlLoadContext(data);
    const type = data.getAttribute('type');
    if (
      data.getName() !== 'soundObject' ||
      type === null ||
      !['TrackerObject', 'blue.soundObject.TrackerObject'].includes(type)
    )
      throw ctx.at(data).error({
        code: 'type',
        member: '@type',
        value: type ?? '',
        message: 'Unsupported TrackerObject type.',
        recovery: 'Supply a supported concrete SoundObject type.',
      });
    checkShape(
      data,
      ['type'],
      [...BASIC_SOUND_OBJECT_CHILDREN, ...['stepsPerBeat', 'trackList', 'tracks']],
      ctx,
    );
    const obj = new TrackerObject();
    const stepsPerBeatElement = data.getElement('stepsPerBeat');
    if (stepsPerBeatElement) readText(stepsPerBeatElement, ctx);
    initBasicFromXML(obj, data, ctx);

    const steps = data.getElement('stepsPerBeat');
    obj._stepsPerBeat = steps ? readInt(steps, ctx, 1, 2147483647) : 1;
    const current = data.getElement('trackList');
    const old = data.getElement('tracks');
    const currentTracks = current ? TrackList.loadFromXML(current, ctx) : undefined;
    const historicalTracks = old ? TrackList.loadFromXML(old, ctx) : undefined;
    if (
      currentTracks &&
      historicalTracks &&
      currentTracks.saveAsXML().toXml() !== historicalTracks.saveAsXML().toXml()
    )
      throw ctx.at(old!).error({
        code: 'conflict',
        message: 'Competing tracker list representations.',
        recovery: 'Keep one equivalent tracker list.',
      });
    obj._tracks = currentTracks ?? historicalTracks ?? obj._tracks;

    return context ? obj : requireXmlValue(ctx.result(obj), sink);
  }

  override deepCopy(): SoundObject {
    return new TrackerObject(this);
  }
}
