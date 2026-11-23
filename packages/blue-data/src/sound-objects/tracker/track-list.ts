import { Track } from './track';
import { NoteList } from '../note-list';
import { Element } from '../../serialization/xml-reader';
import { XmlLoadContext } from '../../serialization/xml-load';
import { checkRoot, checkShape, readInt } from '../../utilities/xml';

/** Ordered tracker tracks sharing a step count. */
export class TrackList {
  private _tracks: Track[] = [];
  private _steps = 64;

  /** Creates a default track list or copies a supplied instance. */
  constructor(other?: TrackList) {
    if (other) {
      this._steps = other._steps;
      for (const track of other._tracks) {
        this.addTrack(Track.fromOther(track));
      }
    }
  }

  /** Adds a tracker track and synchronizes it with the shared number of steps. */
  addTrack(track: Track, index?: number): void {
    if (index !== undefined) {
      this._tracks.splice(index, 0, track);
    } else {
      this._tracks.push(track);
    }
    if (track.getNumSteps() !== this._steps) {
      track.resizeSteps(this._steps);
    }
  }

  /** Removes the tracker track at the supplied index. */
  removeTrack(index: number): void {
    if (index >= 0 && index < this._tracks.length) {
      this._tracks.splice(index, 1);
    }
  }

  /** Returns the entry at the supplied index in the track list’s tracks. */
  getTrack(index: number): Track | null {
    return this._tracks[index] ?? null;
  }

  /** Returns the number of entries stored in the track list. */
  size(): number {
    return this._tracks.length;
  }

  /** Returns the steps stored on the track list. */
  getSteps(): number {
    return this._steps;
  }

  /** Sets the steps stored on the track list. */
  setSteps(steps: number): void {
    this._steps = steps;
    for (const track of this._tracks) {
      track.resizeSteps(steps);
    }
  }

  /** Generates note events for the configured tracker tracks. */
  generateNotes(stepsPerBeat: number): NoteList {
    const retVal = new NoteList();
    for (const track of this._tracks) {
      retVal.merge(track.generateNotes(stepsPerBeat));
    }
    return retVal;
  }

  /** Serializes the track list and its persisted settings to a new Blue XML element. */
  saveAsXML(): Element {
    const retVal = new Element('trackList');
    retVal.addElement('steps').setText(this._steps.toString());
    for (const track of this._tracks) {
      retVal.addElement(track.saveAsXML());
    }
    return retVal;
  }

  /** Reconstructs the track list from its Blue XML element, using the supplied diagnostic context when provided. */
  static loadFromXML(data: Element, context = new XmlLoadContext(data)): TrackList {
    checkRoot(data, ['trackList', 'tracks'], context);
    checkShape(data, [], ['steps', 'track'], context, ['track']);
    const list = new TrackList();
    const steps = data.getElement('steps');
    if (steps) list._steps = readInt(steps, context, 0, 2147483647);
    for (const child of data.getElements('track')) {
      const track = Track.loadFromXML(child, context);
      if (track.getNumSteps() !== list._steps)
        throw context.at(child).error({
          code: 'value',
          message: 'Tracker note count differs from declared grid steps.',
          recovery: 'Provide exactly one tracker note per grid step.',
        });
      list._tracks.push(track);
    }
    return list;
  }
}
