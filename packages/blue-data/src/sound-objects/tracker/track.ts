import { Note } from '../note';
import { NoteList } from '../note-list';
import { replaceAll } from '../../utilities/text';
import { Column, PitchColumn, AmpColumn } from './column';
import { TrackerNote } from './tracker-note';
import { Element } from '../../serialization/xml-reader';
import { XmlLoadContext } from '../../serialization/xml-load';
import {
  checkRoot,
  checkShape,
  readText,
  parseXmlNumber,
  parseXmlInteger,
} from '../../utilities/xml';

/** Tracker sequence with ordered columns, a note template, and an instrument assignment. */
export class Track {
  private _name = '';
  private _noteTemplate = 'i <INSTR_ID> <START> <DUR> <pch> <db>';
  private _instrumentId = '1';
  private _columns: Column[] = [];
  private _trackerNotes: TrackerNote[] = [];

  /** Creates a tracker track with pitch and amplitude columns by default. Pass false to start without columns. */
  constructor(init = true) {
    if (init) {
      this.addColumn(new PitchColumn());
      this.addColumn(new AmpColumn());
    }
  }

  /** Creates a copy of an existing tracker track and its columns and steps. */
  static fromOther(other: Track): Track {
    const track = new Track(false);
    track._name = other._name;
    track._noteTemplate = other._noteTemplate;
    track._instrumentId = other._instrumentId;
    for (const col of other._columns) {
      track._columns.push(new Column(col));
    }
    for (const note of other._trackerNotes) {
      track._trackerNotes.push(new TrackerNote(note));
    }
    return track;
  }

  /** Resizes the tracker sequence, adding blank steps or dropping excess steps. */
  resizeSteps(steps: number): void {
    if (steps < this._trackerNotes.length) {
      this._trackerNotes.splice(steps);
    } else {
      const numToAdd = steps - this._trackerNotes.length;
      for (let i = 0; i < numToAdd; i++) {
        this._trackerNotes.push(this.createNewNote());
      }
    }
  }

  private createNewNote(): TrackerNote {
    const note = new TrackerNote();
    for (let i = 0; i < this._columns.length; i++) {
      note.addColumn();
    }
    return note;
  }

  /** Returns the column definition at the supplied index. */
  getColumn(index: number): Column | null {
    if (index === 0) return null;
    return this._columns[index - 1] ?? null;
  }

  /** Returns the number of columns in the tracker track. */
  getNumColumns(): number {
    return 1 + this._columns.length;
  }

  /** Returns the number of steps in the tracker track. */
  getNumSteps(): number {
    return this._trackerNotes.length;
  }

  /** Returns the entry at the supplied index in the tracker track’s tracker notes. */
  getTrackerNote(rowIndex: number): TrackerNote {
    return this._trackerNotes[rowIndex];
  }

  /** Sets the name stored on the tracker track. */
  setName(name: string): void {
    this._name = name;
  }
  /** Returns the name stored on the tracker track. */
  getName(): string {
    return this._name;
  }

  /** Returns the Csound text template expanded for each generated note. */
  getNoteTemplate(): string {
    return this._noteTemplate;
  }
  /** Sets the Csound text template expanded for each generated note. */
  setNoteTemplate(template: string): void {
    this._noteTemplate = template;
  }

  /** Returns the instrument ID stored on the tracker track. */
  getInstrumentId(): string {
    return this._instrumentId;
  }
  /** Sets the instrument ID stored on the tracker track. */
  setInstrumentId(id: string): void {
    this._instrumentId = id;
  }

  /** Adds a column and expands the stored step values to match. */
  addColumn(col: Column): void {
    this._columns.push(col);
    for (const note of this._trackerNotes) {
      note.addColumn();
    }
  }

  /** Removes a column and its values from the tracker steps. */
  removeColumn(col: Column): void {
    const index = this._columns.indexOf(col);
    if (index < 0) return;

    for (const note of this._trackerNotes) {
      note.removeColumn(index);
    }
    this._columns.splice(index, 1);
  }

  /** Generates Csound notes from the track's active steps and note template. */
  generateNotes(stepsPerBeat: number): NoteList {
    const retVal = new NoteList();
    let instrId = this._instrumentId;

    if (isNaN(parseFloat(instrId))) {
      instrId = `"${instrId}"`;
    }

    let noteTemplate = replaceAll(this._noteTemplate, '<INSTR_ID>', instrId);
    noteTemplate = replaceAll(noteTemplate, '<INSTR_NAME>', this._instrumentId);

    for (let i = 0; i < this._trackerNotes.length; i++) {
      const trNote = this._trackerNotes[i];

      if (trNote.isActive() && !trNote.isOff()) {
        let noteStr = noteTemplate;
        let dur = 1;

        for (let j = i + 1; j < this._trackerNotes.length; j++) {
          const temp = this._trackerNotes[j];
          if (temp.isActive() || temp.isOff()) {
            break;
          }
          dur++;
        }

        const noteStart = i / stepsPerBeat;
        const noteDur = dur / stepsPerBeat;
        const durStr = trNote.isTied() ? `-${noteDur}` : noteDur.toString();

        noteStr = replaceAll(noteStr, '<START>', noteStart.toString());
        noteStr = replaceAll(noteStr, '<DUR>', durStr);

        for (let j = 1; j < this.getNumColumns(); j++) {
          const col = this.getColumn(j);
          if (!col) continue;

          const colPlaceholder = `<${col.getName()}>`;
          let newValue = trNote.getValue(j);

          if (newValue.trim().length === 0) {
            newValue = col.getDefaultValue();
          }

          if (col.getType() === Column.TYPE_BLUE_PCH && col.isOutputFrequency()) {
            const parts = newValue.split('.');
            if (parts.length === 2) {
              const octave = parseInt(parts[0], 10);
              const scaleDegree = parseInt(parts[1], 10);
              const freq = col.getScale().getFrequency(octave, scaleDegree);
              newValue = freq.toString();
            }
          }

          noteStr = replaceAll(noteStr, colPlaceholder, newValue);
        }

        const note = Note.createNoteFromText(noteStr);
        if (note) {
          retVal.add(note);
        }
      }
    }

    return retVal;
  }

  /** Serializes the tracker track and its persisted settings to a new Blue XML element. */
  saveAsXML(): Element {
    const retVal = new Element('track');
    retVal.addElement('name').setText(this._name);
    retVal.addElement('noteTemplate').setText(this._noteTemplate);
    retVal.addElement('instrumentId').setText(this._instrumentId);

    const colElement = retVal.addElement('columns');
    for (const col of this._columns) {
      colElement.addElement(col.saveAsXML());
    }

    const trNotesElement = retVal.addElement('trackerNotes');
    for (const note of this._trackerNotes) {
      trNotesElement.addElement(note.saveAsXML());
    }

    return retVal;
  }

  /** Reconstructs the tracker track from its Blue XML element, using the supplied diagnostic context when provided. */
  static loadFromXML(data: Element, context = new XmlLoadContext(data)): Track {
    checkRoot(data, 'track', context);
    checkShape(
      data,
      [],
      ['name', 'noteTemplate', 'instrumentId', 'columns', 'trackerNotes'],
      context,
    );
    const retVal = new Track(false);
    const nodes = data.getElements();

    while (nodes.hasMoreElements()) {
      const node = nodes.next();
      const nodeName = node.getName();

      switch (nodeName) {
        case 'name':
          retVal._name = readText(node, context);
          break;
        case 'noteTemplate':
          retVal._noteTemplate = readText(node, context);
          break;
        case 'instrumentId':
          retVal._instrumentId = readText(node, context);
          break;
        case 'columns': {
          checkShape(node, [], ['column', 'track'], context, ['column', 'track']);
          const nodes2 = node.getElements();
          while (nodes2.hasMoreElements()) {
            retVal._columns.push(Column.loadFromXML(nodes2.next(), undefined, context));
          }
          break;
        }
        case 'trackerNotes': {
          checkShape(node, [], ['trackerNote'], context, ['trackerNote']);
          const nodes2 = node.getElements();
          while (nodes2.hasMoreElements()) {
            retVal._trackerNotes.push(TrackerNote.loadFromXML(nodes2.next(), context));
          }
          break;
        }
      }
    }
    const notesElement = data.getElement('trackerNotes');
    if (notesElement) {
      const noteElements = notesElement.getElements('trackerNote').toArray();
      for (let noteIndex = 0; noteIndex < retVal._trackerNotes.length; noteIndex++) {
        const note = retVal._trackerNotes[noteIndex]!;
        const noteElement = noteElements[noteIndex]!;
        const cellCount = note.getNumFields() - 1;
        const columnCount = retVal._columns.length;
        if (cellCount !== columnCount)
          context.at(noteElement).diagnostic({
            code: 'SL-TRACKER-CELL-COUNT',
            severity: 'warning',
            member: 'trackerNote',
            value: `${cellCount}/${columnCount}`,
            message: 'Tracker cell count differs from its declared columns.',
            recovery:
              'All ordered cells are retained; type-specific validation applies only to cells with a declared column.',
          });
        let columnIndex = 0;
        for (const cell of noteElement.getElements()) {
          if (!['field', 'otherField', 'pitch', 'amp'].includes(cell.getName())) continue;
          const column = retVal._columns[columnIndex++];
          if (!column) continue;
          const value =
            cell.getName() === 'field' || cell.getName() === 'otherField'
              ? cell.getAttribute('val')!
              : readText(cell, context);
          const token = value.trim();
          if (!token || column.getType() === Column.TYPE_STR) continue;
          const at = context.at(cell);
          if (column.getType() === Column.TYPE_MIDI) parseXmlInteger(token, at, 0, 127, '@val');
          if (column.getType() === Column.TYPE_NUM) {
            const number = column.isRestrictedToInteger()
              ? parseXmlInteger(token, at)
              : parseXmlNumber(token, at);
            if (
              column.isUsingRange() &&
              (number < column.getRangeMin() || number > column.getRangeMax())
            )
              throw at.error({
                code: 'value',
                value,
                message: 'Tracker numeric cell is outside its column range.',
                recovery: 'Supply a value within the declared column range.',
              });
          }
          if (column.getType() === Column.TYPE_PCH) {
            if (token.split('.').length !== 2)
              throw at.error({
                code: 'value',
                value,
                message: 'Tracker pitch must use decimal pitch notation.',
                recovery: 'Supply an octave.degree pitch.',
              });
            parseXmlNumber(token, at);
          }
          if (column.getType() === Column.TYPE_BLUE_PCH) {
            const match = /^([+-]?\d+)\.([+-]?\d+)$/.exec(token);
            if (!match)
              throw at.error({
                code: 'value',
                value,
                message: 'Blue pitch must contain integral octave and degree values.',
                recovery: 'Supply an octave.degree pitch.',
              });
            parseXmlInteger(match[1], at, -2147483648, 2147483647);
            parseXmlInteger(match[2], at, -2147483648, 2147483647);
            if (match[2].length > 1 && match[2].startsWith('0'))
              throw at.error({
                code: 'value',
                value,
                message: 'Blue pitch degrees use unpadded integers.',
                recovery: 'Remove redundant degree zero padding.',
              });
          }
        }
      }
    }
    return retVal;
  }

  /** Inserts a tracker step at the supplied position. */
  insertNote(start: number): void {
    this._trackerNotes.splice(start, 0, this.createNewNote());
    this._trackerNotes.pop();
  }

  /** Removes a tracker step at the supplied position. */
  removeNote(start: number): void {
    this._trackerNotes.splice(start, 1);
    this._trackerNotes.push(this.createNewNote());
  }

  /** Clears the contents of the tracker steps. */
  clearNotes(): void {
    for (const note of this._trackerNotes) {
      note.clear();
    }
  }
}
