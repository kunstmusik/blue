import { describe, it, expect } from 'vitest';
import '../../src/sound-objects/register-sound-object-types';
import { PatternData } from '../../src/score/patterns/pattern-data';
import { PatternLayer } from '../../src/score/patterns/pattern-layer';
import { PatternsLayerGroup } from '../../src/score/patterns/patterns-layer-group';
import { GenericScore } from '../../src/sound-objects/generic-score';
import { PatternObject } from '../../src/sound-objects/pattern-object';
import { TrackerObject } from '../../src/sound-objects/tracker-object';
import { Pattern } from '../../src/sound-objects/pattern/pattern';
import { TrackList } from '../../src/sound-objects/tracker/track-list';
import { TimePosition } from '../../src/time/time-position';
import { TimeDuration } from '../../src/time/time-duration';
import { TimeContext } from '../../src/time/time-context';
import { CompileData } from '../../src/compile-data';
import { Element } from '../../src/serialization/xml-reader';

describe('PatternData', () => {
  it('creates with default size', () => {
    const pd = new PatternData();
    expect(pd.getSize()).toBe(16);
    expect(pd.getMaxSelected()).toBe(-1);
    expect(pd.isPatternSet(0)).toBe(false);
  });

  it('sets and gets pattern steps', () => {
    const pd = new PatternData();
    pd.setPattern(0, true);
    pd.setPattern(2, true);
    pd.setPattern(5, true);

    expect(pd.isPatternSet(0)).toBe(true);
    expect(pd.isPatternSet(1)).toBe(false);
    expect(pd.isPatternSet(2)).toBe(true);
    expect(pd.isPatternSet(5)).toBe(true);
    expect(pd.getMaxSelected()).toBe(5);
  });

  it('auto-resizes when needed', () => {
    const pd = new PatternData();
    pd.setPattern(20, true); // Beyond initial 16

    expect(pd.getSize()).toBe(32); // Resized to next block
    expect(pd.isPatternSet(20)).toBe(true);
    expect(pd.getMaxSelected()).toBe(20);
  });

  it('recalculates maxSelected when clearing', () => {
    const pd = new PatternData();
    pd.setPattern(0, true);
    pd.setPattern(5, true);
    pd.setPattern(10, true);
    expect(pd.getMaxSelected()).toBe(10);

    pd.setPattern(10, false);
    expect(pd.getMaxSelected()).toBe(5);

    pd.setPattern(5, false);
    expect(pd.getMaxSelected()).toBe(0);

    pd.setPattern(0, false);
    expect(pd.getMaxSelected()).toBe(-1);
  });

  it('round-trips through XML', () => {
    const pd = new PatternData();
    pd.setPattern(0, true);
    pd.setPattern(1, false);
    pd.setPattern(2, true);
    pd.setPattern(3, true);

    const xml = pd.saveAsXML();
    const text = xml.getTextString();
    expect(text).toMatch(/^[01]+$/);

    const reloaded = PatternData.loadFromXML(xml);
    expect(reloaded.isPatternSet(0)).toBe(true);
    expect(reloaded.isPatternSet(1)).toBe(false);
    expect(reloaded.isPatternSet(2)).toBe(true);
    expect(reloaded.isPatternSet(3)).toBe(true);
    expect(reloaded.getMaxSelected()).toBe(3);
  });

  it('copies from another PatternData', () => {
    const src = new PatternData();
    src.setPattern(3, true);
    src.setPattern(7, true);

    const copy = new PatternData(src);
    expect(copy.isPatternSet(3)).toBe(true);
    expect(copy.isPatternSet(7)).toBe(true);
    expect(copy.getSize()).toBe(src.getSize());
  });
});

describe('PatternLayer', () => {
  it('creates with default GenericScore', () => {
    const layer = new PatternLayer();
    expect(layer.getName()).toBe('');
    expect(layer.isMuted()).toBe(false);
    expect(layer.isSolo()).toBe(false);
    expect(layer.getPatternData().getSize()).toBe(16);
    expect(layer.getSoundObject()).toBeInstanceOf(GenericScore);
  });

  it('sets and gets properties', () => {
    const layer = new PatternLayer();
    layer.setName('My Pattern');
    layer.setMuted(true);
    layer.setSolo(true);

    expect(layer.getName()).toBe('My Pattern');
    expect(layer.isMuted()).toBe(true);
    expect(layer.isSolo()).toBe(true);
  });

  it('generates notes at active pattern positions', () => {
    const layer = new PatternLayer();

    const gs = new GenericScore();
    gs.setName('Pattern Score');
    gs.setScoreText('i1 0 2\n');
    gs.setStartTime(TimePosition.beats(0));
    gs.setSubjectiveDuration(TimeDuration.beats(1));
    layer.setSoundObject(gs);

    // Activate patterns 0, 2, 4
    layer.getPatternData().setPattern(0, true);
    layer.getPatternData().setPattern(2, true);
    layer.getPatternData().setPattern(4, true);

    const context = new TimeContext();
    const compileData = new CompileData();
    const patternBeatsLength = 4; // Each step = 4 beats
    const notes = layer.generateForCSD(context, compileData, 0, -1, patternBeatsLength);

    // 3 active patterns * 1 note each = 3 notes
    expect(notes.length).toBe(3);

    // Notes should be at times 0, 8, 16 (pattern index * 4 beats)
    const times = notes.map((n) => n.getStartTime()).sort((a, b) => a - b);
    expect(times[0]).toBe(0);
    expect(times[1]).toBe(8);
    expect(times[2]).toBe(16);
  });

  it('normalizes the embedded source start before repeating its generated notes', () => {
    const layer = new PatternLayer();
    const source = new GenericScore();
    source.setScoreText('i1 0 1\n');
    source.setStartTime(TimePosition.beats(6));
    source.setSubjectiveDuration(TimeDuration.beats(1));
    layer.setSoundObject(source);
    layer.getPatternData().setPattern(1, true);

    const notes = layer.generateForCSD(new TimeContext(), new CompileData(), 0, -1, 4);
    expect(notes.length).toBe(1);
    expect(notes.getNote(0).getStartTime()).toBe(4);
  });

  it('round-trips through XML', () => {
    const layer = new PatternLayer();
    layer.setName('Test Pattern');
    layer.setMuted(false);
    layer.setSolo(true);

    const gs = new GenericScore();
    gs.setName('Inner Score');
    gs.setScoreText('i1 0 2\ni1 3 1\n');
    layer.setSoundObject(gs);

    layer.getPatternData().setPattern(0, true);
    layer.getPatternData().setPattern(1, true);
    layer.getPatternData().setPattern(3, false);
    layer.getPatternData().setPattern(5, true);

    const xml = layer.saveAsXML();
    const reloaded = PatternLayer.loadFromXML(xml);

    expect(reloaded.getName()).toBe('Test Pattern');
    expect(reloaded.isMuted()).toBe(false);
    expect(reloaded.isSolo()).toBe(true);
    expect(reloaded.getPatternData().isPatternSet(0)).toBe(true);
    expect(reloaded.getPatternData().isPatternSet(1)).toBe(true);
    expect(reloaded.getPatternData().isPatternSet(3)).toBe(false);
    expect(reloaded.getPatternData().isPatternSet(5)).toBe(true);
    expect(reloaded.getSoundObject()).toBeInstanceOf(GenericScore);
  });

  it('deep copies correctly', () => {
    const layer = new PatternLayer();
    layer.setName('Original');
    layer.getPatternData().setPattern(2, true);

    const copy = layer.deepCopy();
    expect(copy.getName()).toBe('Original');
    expect(copy.getPatternData().isPatternSet(2)).toBe(true);

    // Modifying copy should not affect original
    copy.getPatternData().setPattern(2, false);
    expect(layer.getPatternData().isPatternSet(2)).toBe(true);
  });
});

describe('PatternsLayerGroup', () => {
  it('creates with default values', () => {
    const group = new PatternsLayerGroup();
    expect(group.getName()).toBe('Patterns Layer Group');
    expect(group.getPatternBeatsLength()).toBe(4);
  });

  it('adds and manages layers', () => {
    const group = new PatternsLayerGroup();
    const layer = group.newLayerAt(0);
    layer.setName('Layer 1');

    expect(group.length).toBe(1);
    expect(group[0].getName()).toBe('Layer 1');
  });

  it('generates CSD from all pattern layers', () => {
    const group = new PatternsLayerGroup();
    group.setPatternBeatsLength(2);

    // Layer 1: score "i1 0 1" at patterns 0, 2
    const layer1 = group.newLayerAt(0);
    layer1.setName('Layer A');
    const gs1 = new GenericScore();
    gs1.setScoreText('i1 0 1\n');
    gs1.setStartTime(TimePosition.beats(0));
    gs1.setSubjectiveDuration(TimeDuration.beats(1));
    layer1.setSoundObject(gs1);
    layer1.getPatternData().setPattern(0, true);
    layer1.getPatternData().setPattern(2, true);

    // Layer 2: score "i2 0 1" at pattern 1
    const layer2 = group.newLayerAt(1);
    layer2.setName('Layer B');
    layer2.setMuted(false);
    const gs2 = new GenericScore();
    gs2.setScoreText('i2 0 1\n');
    gs2.setStartTime(TimePosition.beats(0));
    gs2.setSubjectiveDuration(TimeDuration.beats(1));
    layer2.setSoundObject(gs2);
    layer2.getPatternData().setPattern(1, true);

    const context = new TimeContext();
    const compileData = new CompileData();
    const notes = group.generateForCSD(context, compileData, 0, -1, false);

    // Layer 1: 2 patterns * 1 note = 2 notes (at 0, 4)
    // Layer 2: 1 pattern * 1 note = 1 note (at 2)
    expect(notes.length).toBe(3);
  });

  it('respects muted layers', () => {
    const group = new PatternsLayerGroup();
    group.setPatternBeatsLength(4);

    const layer1 = group.newLayerAt(0);
    const gs1 = new GenericScore();
    gs1.setScoreText('i1 0 1\n');
    gs1.setStartTime(TimePosition.beats(0));
    gs1.setSubjectiveDuration(TimeDuration.beats(1));
    layer1.setSoundObject(gs1);
    layer1.getPatternData().setPattern(0, true);

    const layer2 = group.newLayerAt(1);
    layer2.setMuted(true);
    const gs2 = new GenericScore();
    gs2.setScoreText('i2 0 1\n');
    gs2.setStartTime(TimePosition.beats(0));
    gs2.setSubjectiveDuration(TimeDuration.beats(1));
    layer2.setSoundObject(gs2);
    layer2.getPatternData().setPattern(0, true);

    const context = new TimeContext();
    const compileData = new CompileData();
    const notes = group.generateForCSD(context, compileData, 0, -1, false);

    // Only layer1 (non-muted) should contribute
    expect(notes.length).toBe(1);
  });

  it('round-trips through XML', () => {
    const group = new PatternsLayerGroup();
    group.setName('Test Patterns');
    group.setPatternBeatsLength(8);

    const layer = group.newLayerAt(0);
    layer.setName('Pattern Layer');
    const gs = new GenericScore();
    gs.setScoreText('i1 0 2\n');
    gs.setStartTime(TimePosition.beats(0));
    gs.setSubjectiveDuration(TimeDuration.beats(2));
    layer.setSoundObject(gs);
    layer.getPatternData().setPattern(0, true);
    layer.getPatternData().setPattern(3, true);

    const xml = group.saveAsXML();
    const reloaded = PatternsLayerGroup.loadFromXML(xml);

    expect(reloaded.getName()).toBe('Test Patterns');
    expect(reloaded.getPatternBeatsLength()).toBe(8);
    expect(reloaded.length).toBe(1);
    expect(reloaded[0].getName()).toBe('Pattern Layer');
    expect(reloaded[0].getPatternData().isPatternSet(0)).toBe(true);
    expect(reloaded[0].getPatternData().isPatternSet(3)).toBe(true);
  });

  it('deep copies correctly', () => {
    const group = new PatternsLayerGroup();
    group.setName('Original');
    group.setPatternBeatsLength(8);

    const layer = group.newLayerAt(0);
    layer.getPatternData().setPattern(1, true);

    const copy = group.deepCopy();
    expect(group.deepCopyLG().getName()).toBe('Original');
    expect(copy.getName()).toBe('Original');
    expect(copy.getPatternBeatsLength()).toBe(8);
    expect(copy.length).toBe(1);

    // Modifying copy should not affect original
    (copy as PatternsLayerGroup)[0].getPatternData().setPattern(1, false);
    expect(group[0].getPatternData().isPatternSet(1)).toBe(true);
  });
});

describe('PatternLayer with PatternObject', () => {
  /** Build a minimal patternLayer XML containing a Java-qualified PatternObject. */
  function makePatternObjectLayerXml(): Element {
    const patternLayer = new Element('patternLayer');
    patternLayer.setAttribute('name', 'Drum');
    patternLayer.setAttribute('muted', 'false');
    patternLayer.setAttribute('solo', 'false');

    // soundObject with Java qualified type
    const so = patternLayer.addElement('soundObject');
    so.setAttribute('type', 'blue.soundObject.PatternObject');
    so.addElement('name').setText('Kick Pattern');
    so.addElement('startTime').setText('0.0');
    so.addElement('subjectiveDuration').setText('4.0');
    so.addElement('timeBehavior').setText('2'); // REPEAT
    so.addElement('beats').setText('4');
    so.addElement('subDivisions').setText('4');

    const patterns = so.addElement('patterns');
    const p1 = patterns.addElement('pattern');
    p1.addElement('patternName').setText('kick');
    p1.addElement('patternScore').setText('i1 0 1 80');
    p1.addElement('muted').setText('false');
    p1.addElement('solo').setText('false');
    p1.addElement('values').setText('1000100010001000');

    const p2 = patterns.addElement('pattern');
    p2.addElement('patternName').setText('snare');
    p2.addElement('patternScore').setText('i2 0 1 70');
    p2.addElement('muted').setText('false');
    p2.addElement('solo').setText('false');
    p2.addElement('values').setText('0000100000001000');

    // patternData for the layer itself
    const pd = patternLayer.addElement('patternData');
    pd.setText('1100');

    return patternLayer;
  }

  it('loads PatternObject from Java-qualified type name', () => {
    const xml = makePatternObjectLayerXml();
    const layer = PatternLayer.loadFromXML(xml);

    expect(layer.getName()).toBe('Drum');
    expect(layer.getSoundObject()).toBeInstanceOf(PatternObject);
  });

  it('preserves PatternObject data fields', () => {
    const xml = makePatternObjectLayerXml();
    const layer = PatternLayer.loadFromXML(xml);
    const po = layer.getSoundObject() as PatternObject;

    expect(po.getName()).toBe('Kick Pattern');
    expect(po.getBeats()).toBe(4);
    expect(po.getSubDivisions()).toBe(4);
    expect(po.size()).toBe(2);
    expect(po.getPattern(0).patternName).toBe('kick');
    expect(po.getPattern(0).patternScore).toBe('i1 0 1 80');
    expect(po.getPattern(0).values[0]).toBe(true);
    expect(po.getPattern(0).values[1]).toBe(false);
    expect(po.getPattern(1).patternName).toBe('snare');
    expect(po.getPattern(1).patternScore).toBe('i2 0 1 70');
  });

  it('preserves layer-level patternData alongside PatternObject', () => {
    const xml = makePatternObjectLayerXml();
    const layer = PatternLayer.loadFromXML(xml);

    expect(layer.getPatternData().isPatternSet(0)).toBe(true);
    expect(layer.getPatternData().isPatternSet(1)).toBe(true);
    expect(layer.getPatternData().isPatternSet(2)).toBe(false);
    expect(layer.getPatternData().isPatternSet(3)).toBe(false);
  });

  it('round-trips PatternObject through save and reload', () => {
    const xml = makePatternObjectLayerXml();
    const layer = PatternLayer.loadFromXML(xml);
    const savedXml = layer.saveAsXML();
    const reloaded = PatternLayer.loadFromXML(savedXml);

    expect(reloaded.getName()).toBe('Drum');
    expect(reloaded.getSoundObject()).toBeInstanceOf(PatternObject);
    const po = reloaded.getSoundObject() as PatternObject;
    expect(po.getBeats()).toBe(4);
    expect(po.getSubDivisions()).toBe(4);
    expect(po.size()).toBe(2);
    expect(po.getPattern(0).patternName).toBe('kick');
    expect(po.getPattern(1).patternName).toBe('snare');
    expect(reloaded.getPatternData().isPatternSet(0)).toBe(true);
    expect(reloaded.getPatternData().isPatternSet(1)).toBe(true);
  });
});

describe('PatternLayer with TrackerObject', () => {
  /** Build a minimal patternLayer XML containing a Java-qualified TrackerObject. */
  function makeTrackerObjectLayerXml(opts?: { includeStepsPerBeat?: boolean }): Element {
    const patternLayer = new Element('patternLayer');
    patternLayer.setAttribute('name', 'Bass b64');
    patternLayer.setAttribute('muted', 'false');
    patternLayer.setAttribute('solo', 'false');

    const so = patternLayer.addElement('soundObject');
    so.setAttribute('type', 'blue.soundObject.TrackerObject');
    so.addElement('name').setText('Bass Tracker');
    so.addElement('startTime').setText('0.0');
    so.addElement('subjectiveDuration').setText('16.0');
    so.addElement('timeBehavior').setText('2'); // REPEAT
    so.addElement('repeatPoint').setText('16.0');

    if (opts?.includeStepsPerBeat !== false) {
      so.addElement('stepsPerBeat').setText('2');
    }

    const trackList = so.addElement('trackList');
    trackList.addElement('steps').setText('8');
    const track = trackList.addElement('track');
    track.addElement('name').setText('instr 1');
    track.addElement('noteTemplate').setText('i <INSTR_ID> <START> <DUR> <pch> <db>');
    track.addElement('instrumentId').setText('4');

    const columns = track.addElement('columns');
    const pitchColumn = columns.addElement('track');
    pitchColumn.addElement('name').setText('pch');
    pitchColumn.addElement('rangeMin').setText('0.0');
    pitchColumn.addElement('rangeMax').setText('0.0');
    pitchColumn.addElement('type').setText('0');
    pitchColumn.addElement('restrictedToInteger').setText('false');
    pitchColumn.addElement('usingRange').setText('false');
    pitchColumn.addElement('outputFrequency').setText('true');

    const amplitudeColumn = columns.addElement('track');
    amplitudeColumn.addElement('name').setText('db');
    amplitudeColumn.addElement('rangeMin').setText('0.0');
    amplitudeColumn.addElement('rangeMax').setText('90.0');
    amplitudeColumn.addElement('type').setText('4');
    amplitudeColumn.addElement('restrictedToInteger').setText('false');
    amplitudeColumn.addElement('usingRange').setText('false');
    amplitudeColumn.addElement('outputFrequency').setText('true');

    const trackerNotes = track.addElement('trackerNotes');
    const activeNote = trackerNotes.addElement('trackerNote');
    activeNote.addElement('tied').setText('false');
    activeNote.addElement('off').setText('false');
    activeNote.addElement('field').setAttribute('val', '5.04');
    activeNote.addElement('field').setAttribute('val', '-12');

    const offNote = trackerNotes.addElement('trackerNote');
    offNote.addElement('tied').setText('false');
    offNote.addElement('off').setText('true');
    offNote.addElement('field').setAttribute('val', '');
    offNote.addElement('field').setAttribute('val', '');

    const tiedNote = trackerNotes.addElement('trackerNote');
    tiedNote.addElement('tied').setText('true');
    tiedNote.addElement('off').setText('false');
    tiedNote.addElement('field').setAttribute('val', '6.04');
    tiedNote.addElement('field').setAttribute('val', '-12');

    // patternData for the layer itself
    const pd = patternLayer.addElement('patternData');
    pd.setText('10100000');

    return patternLayer;
  }

  it('loads TrackerObject from Java-qualified type name', () => {
    const xml = makeTrackerObjectLayerXml();
    const layer = PatternLayer.loadFromXML(xml);

    expect(layer.getName()).toBe('Bass b64');
    expect(layer.getSoundObject()).toBeInstanceOf(TrackerObject);
  });

  it('preserves TrackerObject data fields', () => {
    const xml = makeTrackerObjectLayerXml();
    const layer = PatternLayer.loadFromXML(xml);
    const to = layer.getSoundObject() as TrackerObject;

    expect(to.getName()).toBe('Bass Tracker');
    expect(to.getStepsPerBeat()).toBe(2);
    const tracks = to.getTracks();
    expect(tracks.size()).toBe(1);
    expect(tracks.getSteps()).toBe(8);
    const track = tracks.getTrack(0)!;
    expect(track.getName()).toBe('instr 1');
    expect(track.getNoteTemplate()).toBe('i <INSTR_ID> <START> <DUR> <pch> <db>');
    expect(track.getInstrumentId()).toBe('4');
    expect(track.getNumColumns()).toBe(3);
    const pitchColumn = track.getColumn(1)!;
    expect(pitchColumn.getName()).toBe('pch');
    expect(pitchColumn.getType()).toBe(0);
    expect(pitchColumn.getRangeMin()).toBe(0);
    expect(pitchColumn.getRangeMax()).toBe(0);
    expect(pitchColumn.isOutputFrequency()).toBe(true);
    const amplitudeColumn = track.getColumn(2)!;
    expect(amplitudeColumn.getName()).toBe('db');
    expect(amplitudeColumn.getType()).toBe(4);
    expect(amplitudeColumn.getRangeMax()).toBe(90);
    expect(amplitudeColumn.isOutputFrequency()).toBe(true);
    expect(track.getTrackerNote(0).getValue(1)).toBe('5.04');
    expect(track.getTrackerNote(0).getValue(2)).toBe('-12');
    expect(track.getTrackerNote(0).isTied()).toBe(false);
    expect(track.getTrackerNote(1).isOff()).toBe(true);
    expect(track.getTrackerNote(2).isTied()).toBe(true);
  });

  it('defaults stepsPerBeat to 1 for legacy projects without the element', () => {
    const xml = makeTrackerObjectLayerXml({ includeStepsPerBeat: false });
    const layer = PatternLayer.loadFromXML(xml);
    const to = layer.getSoundObject() as TrackerObject;

    // Legacy fallback per Java TrackerObject.loadFromXML
    expect(to.getStepsPerBeat()).toBe(1);
  });

  it('round-trips TrackerObject through save and reload', () => {
    const xml = makeTrackerObjectLayerXml();
    const layer = PatternLayer.loadFromXML(xml);
    const savedXml = layer.saveAsXML();
    const reloaded = PatternLayer.loadFromXML(savedXml);

    expect(reloaded.getName()).toBe('Bass b64');
    expect(reloaded.getSoundObject()).toBeInstanceOf(TrackerObject);
    const to = reloaded.getSoundObject() as TrackerObject;
    expect(to.getStepsPerBeat()).toBe(2);
    expect(to.getTracks().size()).toBe(1);
    const track = to.getTracks().getTrack(0)!;
    expect(track.getNoteTemplate()).toBe('i <INSTR_ID> <START> <DUR> <pch> <db>');
    expect(track.getInstrumentId()).toBe('4');
    expect(track.getColumn(1)?.getName()).toBe('pch');
    expect(track.getColumn(1)?.getType()).toBe(0);
    expect(track.getColumn(1)?.getRangeMax()).toBe(0);
    expect(track.getColumn(1)?.isOutputFrequency()).toBe(true);
    expect(track.getColumn(2)?.getName()).toBe('db');
    expect(track.getColumn(2)?.getType()).toBe(4);
    expect(track.getColumn(2)?.getRangeMax()).toBe(90);
    expect(track.getColumn(2)?.isOutputFrequency()).toBe(true);
    expect(track.getTrackerNote(0).getValue(1)).toBe('5.04');
    expect(track.getTrackerNote(0).getValue(2)).toBe('-12');
    expect(track.getTrackerNote(0).isTied()).toBe(false);
    expect(track.getTrackerNote(1).isOff()).toBe(true);
    expect(track.getTrackerNote(2).isTied()).toBe(true);
    expect(reloaded.getPatternData().isPatternSet(0)).toBe(true);
    expect(reloaded.getPatternData().isPatternSet(2)).toBe(true);
    expect(reloaded.getPatternData().isPatternSet(1)).toBe(false);
  });
});

describe('PatternLayer with unknown type', () => {
  it('falls back to default GenericScore for unregistered types', () => {
    const patternLayer = new Element('patternLayer');
    patternLayer.setAttribute('name', 'Unknown');
    const so = patternLayer.addElement('soundObject');
    so.setAttribute('type', 'blue.soundObject.SomeUnknownFutureObject');
    so.addElement('name').setText('Unknown');

    const pd = patternLayer.addElement('patternData');
    pd.setText('1000');

    const layer = PatternLayer.loadFromXML(patternLayer);
    // Should retain the default GenericScore instead of crashing
    expect(layer.getSoundObject()).toBeInstanceOf(GenericScore);
    expect(layer.getPatternData().isPatternSet(0)).toBe(true);
  });
});


function attachSerializableSource(group: PatternsLayerGroup): void {
  for (const layer of group) {
    const gs = new GenericScore();
    gs.setName('Source');
    gs.setScoreText('i1 0 1\n');
    gs.setStartTime(TimePosition.beats(0));
    gs.setSubjectiveDuration(TimeDuration.beats(1));
    layer.setSoundObject(gs);
  }
}

describe('PatternsLayerGroup canvas-contract round trips', () => {
  it('retains a malformed raw step length through save and reload', () => {
    const group = new PatternsLayerGroup();
    group.setPatternBeatsLength(Number.NaN);
    const layer = group.newLayerAt(0);
    attachSerializableSource(group);
    layer.getPatternData().setPattern(0, true);

    const reloaded = PatternsLayerGroup.loadFromXML(group.saveAsXML());
    // NaN serializes as "NaN"; parseInt yields NaN again, preserving the
    // malformed raw value rather than silently rewriting it.
    expect(Number.isNaN(reloaded.getPatternBeatsLength())).toBe(true);
    expect(reloaded[0]!.getPatternData().isPatternSet(0)).toBe(true);
  });

  it('grows active cells beyond the current capacity but not inactive clears', () => {
    const group = new PatternsLayerGroup();
    const layer = group.newLayerAt(0);
    attachSerializableSource(group);
    layer.getPatternData().setPattern(20, true);
    expect(layer.getPatternData().getSize()).toBe(32);
    layer.getPatternData().setPattern(31, false);
    expect(layer.getPatternData().getSize()).toBe(32);
    expect(layer.getPatternData().getMaxSelected()).toBe(20);

    const reloaded = PatternsLayerGroup.loadFromXML(group.saveAsXML());
    expect(reloaded[0]!.getPatternData().isPatternSet(20)).toBe(true);
    expect(reloaded[0]!.getPatternData().isPatternSet(19)).toBe(false);
  });

  it('does not serialize trailing inactive capacity as pattern content', () => {
    const group = new PatternsLayerGroup();
    const layer = group.newLayerAt(0);
    attachSerializableSource(group);
    layer.getPatternData().setPattern(20, true);
    layer.getPatternData().setPattern(20, false);
    layer.getPatternData().setPattern(3, true);
    expect(layer.getPatternData().getSize()).toBe(32);
    const xmlText = group.saveAsXML().toXml();
    const patternDataMatch = xmlText.match(/<patternData>([01]*)<\/patternData>/);
    expect(patternDataMatch).not.toBeNull();
    // Capacity trims to the 16-cell block holding the highest active cell
    // (index 3 → block of 16), never to the grown 32-cell array.
    expect(patternDataMatch![1]).toBe('0001000000000000');
  });

  it('tolerates unknown elements and attributes without corrupting known data', () => {
    const elem = new Element('patternsLayerGroup');
    elem.setAttribute('name', 'Future Group');
    elem.setAttribute('futureAttr', 'keep');
    elem.addElement('futureElement').setText('unknown');
    elem.addElement('patternBeatsLength').setText('5');
    const layers = elem.addElement('patternLayers');
    const layerEl = layers.addElement('patternLayer');
    layerEl.setAttribute('name', 'Row');
    layerEl.setAttribute('muted', 'true');
    layerEl.setAttribute('solo', 'false');
    const so = layerEl.addElement('soundObject');
    so.setAttribute('type', 'blue.soundObject.GenericScore');
    so.addElement('name').setText('Source');
    layerEl.addElement('patternData').setText('1001');
    elem.addElement('noteProcessorChain');

    const group = PatternsLayerGroup.loadFromXML(elem);
    expect(group.getName()).toBe('Future Group');
    expect(group.getPatternBeatsLength()).toBe(5);
    expect(group[0]!.getName()).toBe('Row');
    expect(group[0]!.isMuted()).toBe(true);
    expect(group[0]!.getPatternData().isPatternSet(0)).toBe(true);
    expect(group[0]!.getPatternData().isPatternSet(3)).toBe(true);
    expect(group[0]!.getSoundObject().getName()).toBe('Source');
  });

  it('supports layer removal and reordering (Array species safety)', () => {
    const group = new PatternsLayerGroup();
    group.newLayerAt(0).setName('A');
    group.newLayerAt(1).setName('B');
    group.newLayerAt(2).setName('C');

    group.removeLayers(1, 1);
    expect(group.map((layer) => layer.getName())).toEqual(['A', 'C']);

    // splice-based move as used by the shared moveLayer patch
    const [moved] = group.splice(0, 1);
    group.splice(1, 0, moved!);
    expect(group.map((layer) => layer.getName())).toEqual(['C', 'A']);
  });
});
