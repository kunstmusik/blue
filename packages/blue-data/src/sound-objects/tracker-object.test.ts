import { describe, it, expect } from 'vitest';
import { TrackerObject } from './tracker-object';
import { Track } from './tracker/track';
import { Column } from './tracker/column';
import { TimeContext } from '../time/time-context';
import { Element } from '../serialization/xml-reader';

describe('TrackerObject', () => {
  it('should initialize with default values', () => {
    const obj = new TrackerObject();
    expect(obj.getName()).toBe('Tracker');
    expect(obj.getStepsPerBeat()).toBe(4);
    expect(obj.getTracks().size()).toBe(0);
  });

  it('should generate notes correctly', () => {
    const obj = new TrackerObject();
    const track = new Track();
    track.setInstrumentId('1');
    track.resizeSteps(16);

    // Set a note at step 0
    track.getTrackerNote(0).setValue(1, '8.00'); // pch column
    track.getTrackerNote(0).setValue(2, '80'); // db column

    obj.getTracks().setSteps(16);
    obj.getTracks().addTrack(track);
    obj.setStepsPerBeat(4);

    const context = new TimeContext();
    const nl = obj.generateForCSD(context, {} as any, 0, -1);

    expect(nl.size).toBe(1);
    const note = nl.getNote(0);
    expect(note.getPField(1)).toBe('1');
    expect(note.getStartTime()).toBe(0);
    expect(note.getSubjectiveDuration()).toBe(4.0); // 16 steps / 4 steps per beat
    expect(note.getPField(4)).toBe('8.00');
    expect(note.getPField(5)).toBe('80');
  });

  it('should handle tied notes', () => {
    const obj = new TrackerObject();
    const track = new Track();
    track.setInstrumentId('1');
    track.resizeSteps(16);

    track.getTrackerNote(0).setTied(true);
    track.getTrackerNote(0).setValue(1, '8.00');
    track.getTrackerNote(0).setValue(2, '80');

    obj.getTracks().setSteps(16);
    obj.getTracks().addTrack(track);
    obj.setStepsPerBeat(4);

    const context = new TimeContext();
    const nl = obj.generateForCSD(context, {} as any, 0, -1);

    expect(nl.size).toBe(1);
    const note = nl.getNote(0);
    expect(note.isTiedNote()).toBe(true);
    expect(note.getPField(3)).toBe('-4');
  });

  it('should support legacy XML loading defaults for stepsPerBeat', () => {
    const xml = `<soundObject type="blue.soundObject.TrackerObject">
      <name>Tracker</name>
      <trackList>
        <steps>64</steps>
      </trackList>
    </soundObject>`;

    const doc = Element.parse(xml);
    const obj = TrackerObject.loadFromXML(doc);

    expect(obj.getStepsPerBeat()).toBe(1); // Default for legacy
  });

  it('retains retired objective duration separately from subjective duration', () => {
    const xml = Element.parse(
      '<soundObject type="blue.soundObject.TrackerObject"><duration>4.0</duration><subjectiveDuration>16.0</subjectiveDuration></soundObject>',
    );
    expect(() => TrackerObject.loadFromXML(xml)).toThrow(/report handler/i);

    const warnings: string[] = [];
    const object = TrackerObject.loadFromXML(xml, undefined, undefined, (diagnostics) => {
      warnings.push(...diagnostics.map((diagnostic) => diagnostic.code));
    });
    expect(warnings).toEqual(['SL-TRACKER-OBJECTIVE-DURATION']);
    expect(object.getHistoricalObjectiveDuration()).toBe(4);
    expect(object.getSubjectiveDuration().toBeats(new TimeContext())).toBe(16);
    expect(object.saveAsXML().getTextString('duration')).toBe('4.0');
    const copy = object.deepCopy() as TrackerObject;
    expect(copy.getHistoricalObjectiveDuration()).toBe(4);
    expect(copy.saveAsXML().getTextString('duration')).toBe('4.0');

    expect(() =>
      TrackerObject.loadFromXML(
        Element.parse(
          '<soundObject type="blue.soundObject.TrackerObject"><duration>not-a-number</duration></soundObject>',
        ),
        undefined,
        undefined,
        () => {},
      ),
    ).toThrow();
  });

  it('accepts Java Column records named track inside a columns container', () => {
    const xml = Element.parse(
      '<soundObject type="blue.soundObject.TrackerObject"><trackList><steps>1</steps><track><columns><track><name>pitch</name><type>0</type></track></columns><trackerNotes><trackerNote><field val="8.00"/></trackerNote></trackerNotes></track></trackList></soundObject>',
    );
    const object = TrackerObject.loadFromXML(xml);
    const saved = object.saveAsXML();
    expect(
      saved
        .getElement('trackList')
        ?.getElement('track')
        ?.getElement('columns')
        ?.getElement('column')
        ?.getTextString('name'),
    ).toBe('pitch');
    expect(
      saved
        .getElement('trackList')
        ?.getElement('track')
        ?.getElement('columns')
        ?.getElement('track'),
    ).toBeNull();
    expect(TrackerObject.loadFromXML(saved).saveAsXML().toXml()).toBe(saved.toXml());
  });

  it('warns and preserves tracker cells when their count differs from the columns', () => {
    const xml = Element.parse(
      '<soundObject type="blue.soundObject.TrackerObject"><trackList><steps>1</steps><track><columns><column><name>pitch</name><type>0</type></column></columns><trackerNotes><trackerNote><field val="8.00"/><field val="extra"/></trackerNote></trackerNotes></track></trackList></soundObject>',
    );
    const diagnostics: Array<{ code: string; severity: string }> = [];
    const object = TrackerObject.loadFromXML(xml, undefined, undefined, (items) =>
      diagnostics.push(...items),
    );
    const saved = object.saveAsXML();
    const cells = () =>
      saved
        .getElement('trackList')!
        .getElement('track')!
        .getElement('trackerNotes')!
        .getElement('trackerNote')!
        .getElements('field')
        .toArray()
        .map((field) => field.getAttribute('val'));

    expect(diagnostics).toMatchObject([
      {
        code: 'SL-TRACKER-CELL-COUNT',
        severity: 'warning',
        member: 'trackerNote',
        value: '2/1',
      },
    ]);
    expect(cells()).toEqual(['8.00', 'extra']);
    expect(
      TrackerObject.loadFromXML(saved, undefined, undefined, () => {})
        .saveAsXML()
        .toXml(),
    ).toBe(saved.toXml());
  });

  it('should load stepsPerBeat when present in XML', () => {
    const xml = `<soundObject type="blue.soundObject.TrackerObject">
      <name>Tracker</name>
      <stepsPerBeat>2</stepsPerBeat>
      <trackList>
        <steps>64</steps>
      </trackList>
    </soundObject>`;

    const doc = Element.parse(xml);
    const obj = TrackerObject.loadFromXML(doc);

    expect(obj.getStepsPerBeat()).toBe(2);
  });

  it('should round-trip XML correctly with custom steps', () => {
    const obj = new TrackerObject();
    obj.getTracks().setSteps(32);
    expect(obj.getTracks().getSteps()).toBe(32);

    const track = new Track();
    obj.getTracks().addTrack(track);
    expect(track.getNumSteps()).toBe(32);

    const xml = obj.saveAsXML();
    const obj2 = TrackerObject.loadFromXML(xml);

    expect(obj2.getTracks().getSteps()).toBe(32);
    expect(obj2.getTracks().getTrack(0)!.getNumSteps()).toBe(32);
  });

  it('should handle steps resizing correctly', () => {
    const obj = new TrackerObject();
    const track = new Track();
    obj.getTracks().addTrack(track);

    obj.getTracks().setSteps(16);
    expect(track.getNumSteps()).toBe(16);

    obj.getTracks().setSteps(32);
    expect(track.getNumSteps()).toBe(32);
    // Verify columns were added to new notes
    expect(track.getTrackerNote(31).getNumFields()).toBe(3); // tied/status + pch + amp
  });

  it('should use default values for empty cells in generateNotes', () => {
    const obj = new TrackerObject();
    const track = new Track();
    track.setInstrumentId('1');
    track.resizeSteps(4);

    // Set a note at step 0 but leave db (col 2) empty
    track.getTrackerNote(0).setValue(1, '9.00'); // pch column
    // Note: col 2 is empty

    obj.getTracks().addTrack(track);
    obj.setStepsPerBeat(1);

    const context = new TimeContext();
    const nl = obj.generateForCSD(context, {} as any, 0, -1);

    expect(nl.size).toBe(1);
    const note = nl.getNote(0);
    expect(note.getPField(4)).toBe('9.00');
    expect(note.getPField(5)).toBe('90'); // Default for AmpColumn
  });

  it('should preserve steps during deepCopy', () => {
    const obj = new TrackerObject();
    obj.getTracks().setSteps(12);

    const copy = obj.deepCopy() as TrackerObject;
    expect(copy.getTracks().getSteps()).toBe(12);

    const track = new Track();
    obj.getTracks().addTrack(track);
    expect(track.getNumSteps()).toBe(12);

    const copy2 = obj.deepCopy() as TrackerObject;
    expect(copy2.getTracks().size()).toBe(1);
    expect(copy2.getTracks().getTrack(0)!.getNumSteps()).toBe(12);
  });
});
