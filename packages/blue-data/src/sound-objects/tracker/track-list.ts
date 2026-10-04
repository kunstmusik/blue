import { Track } from './track';
import { NoteList } from '../note-list';
import { Element } from '../../serialization/xml-reader';
import { XmlLoadContext } from '../../serialization/xml-load';
import { checkRoot, checkShape, readInt } from '../../utilities/xml';

export class TrackList {
  private _tracks: Track[] = [];
  private _steps = 64;

  constructor(other?: TrackList) {
    if (other) {
      this._steps = other._steps;
      for (const track of other._tracks) {
        this.addTrack(Track.fromOther(track));
      }
    }
  }

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

  removeTrack(index: number): void {
    if (index >= 0 && index < this._tracks.length) {
      this._tracks.splice(index, 1);
    }
  }

  getTrack(index: number): Track | null {
    return this._tracks[index] ?? null;
  }

  size(): number {
    return this._tracks.length;
  }

  getSteps(): number {
    return this._steps;
  }

  setSteps(steps: number): void {
    this._steps = steps;
    for (const track of this._tracks) {
      track.resizeSteps(steps);
    }
  }

  generateNotes(stepsPerBeat: number): NoteList {
    const retVal = new NoteList();
    for (const track of this._tracks) {
      retVal.merge(track.generateNotes(stepsPerBeat));
    }
    return retVal;
  }

  saveAsXML(): Element {
    const retVal = new Element('trackList');
    retVal.addElement('steps').setText(this._steps.toString());
    for (const track of this._tracks) {
      retVal.addElement(track.saveAsXML());
    }
    return retVal;
  }

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
