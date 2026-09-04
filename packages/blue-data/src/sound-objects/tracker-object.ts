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

  static loadFromXML(data: Element, _objRefMap?: ObjRefLoadMap): TrackerObject {
    const obj = new TrackerObject();
    initBasicFromXML(obj, data);

    // For legacy projects prior to 2.8.1, default to 1 step
    let stepsPerBeat = 1;
    let stepsPerBeatFound = false;

    const nodes = data.getElements();
    while (nodes.hasMoreElements()) {
      const node = nodes.next();
      const nodeName = node.getName();
      switch (nodeName) {
        case 'stepsPerBeat':
          stepsPerBeat = parseInt(node.getTextString() ?? '1', 10);
          stepsPerBeatFound = true;
          break;
        case 'trackList':
          obj._tracks = TrackList.loadFromXML(node);
          break;
        // Legacy 'tracks' support
        case 'tracks': {
          const tNodes = node.getElements('track');
          while (tNodes.hasMoreElements()) {
            // This is old blue-electron specific string[][] format,
            // we should probably keep it for a while but it's not Java-compatible.
            // Java Blue doesn't have 'tracks' element at root of TrackerObject, it has 'trackList'.
          }
          break;
        }
      }
    }

    if (stepsPerBeatFound) {
      obj._stepsPerBeat = stepsPerBeat;
    } else {
      // If we didn't find stepsPerBeat, we default to 1 for legacy.
      // But the constructor already set it to 4.
      obj._stepsPerBeat = 1;
    }

    return obj;
  }

  override deepCopy(): SoundObject {
    return new TrackerObject(this);
  }
}
