import { describe, it, expect } from 'vitest';
import { Element } from '../../src/serialization/xml-reader';
import { BlueData } from '../../src/blue-data';
import { ProjectProperties } from '../../src/project-properties';
import { Arrangement } from '../../src/arrangement';
import { GenericInstrument } from '../../src/instruments/generic-instrument';
import { Tables } from '../../src/tables';
import { GlobalOrcSco } from '../../src/global-orc-sco';
import { Score } from '../../src/score/score';
import { PolyObject } from '../../src/sound-objects/poly-object';
import { SoundLayer } from '../../src/sound-objects/sound-layer';
import { GenericScore } from '../../src/sound-objects/generic-score';
import { TimeBehavior } from '../../src/sound-objects/time-behavior';
import { TimePosition } from '../../src/time/time-position';
import { TimeDuration } from '../../src/time/time-duration';
import { MarkersList } from '../../src/markers-list';
import { MidiInputProcessor } from '../../src/midi/midi-input-processor';
import { ScratchPadData } from '../../src/scratch-pad-data';
import { LiveData } from '../../src/live-data';
import { NoteProcessorChainMap } from '../../src/note-processors/note-processor-chain-map';
import { SoundObjectLibrary } from '../../src/sound-objects/sound-object-library';

/**
 * Build a complete BlueData project for testing round-trip serialization.
 */
function buildTestProject(): BlueData {
  const data = new BlueData();
  data.setVersion('2.9.1');

  // Project properties
  const props = new ProjectProperties();
  props.title = 'Test Project';
  props.author = 'Test Author';
  props.notes = 'A test project for round-trip serialization';
  props.sampleRate = '44100';
  props.ksmps = '64';
  props.nchnls = '2';
  props.useZeroDbFS = true;
  props.zeroDbFS = '32768';
  data.setProjectProperties(props);

  // Instrument library
  const lib = data.getSoundObjectLibrary();
  // Stub for now — full instrument support in later phases

  // Global orc/sco
  const globalOrcSco = new GlobalOrcSco();
  globalOrcSco.setGlobalOrc('; Global orchestra\nsr = 44100\nkr = 4410\nnchnls = 2\n0dbfs = 1\n');
  globalOrcSco.setGlobalSco('; Global score\ne\n');
  data.setGlobalOrcSco(globalOrcSco);

  // Tables
  const tables = new Tables();
  tables.setTables('f 1 0 1024 10 1');
  data.setTableSet(tables);

  // Arrangement with an instrument
  const arr = new Arrangement();
  const instr = new GenericInstrument();
  instr.setName('TestInstrument');
  instr.setText(
    '; Test instrument\ninstr 1\n  aout oscils 0.5, 440, 0\n  outc aout, aout\nendin\n',
  );
  arr.addInstrument(instr, '1');
  data.setArrangement(arr);

  // Score with a PolyObject containing a layer with a GenericScore
  const score = new Score();
  const pObj = new PolyObject(false);
  pObj.setName('Test PolyObject');
  pObj.setTimeBehavior(TimeBehavior.NONE);

  const layer = new SoundLayer();
  layer.setName('Layer 1');

  const gs = new GenericScore();
  gs.setName('Test GenericScore');
  gs.setScoreText('i1 0 2\ni1 3 1\n');
  gs.setStartTime(TimePosition.beats(0));
  gs.setSubjectiveDuration(TimeDuration.beats(4));
  gs.setTimeBehavior(TimeBehavior.NONE);

  layer.push(gs);
  pObj.push(layer);

  // Push the PolyObject onto the Score as a layer group
  // Score expects LayerGroup<Layer> — PolyObject implements this
  score.push(pObj);
  data.setScore(score);

  // Supporting data
  data.setMarkersList(new MarkersList());
  data.setScratchPadData(new ScratchPadData());
  data.setLiveData(new LiveData());
  data.setNoteProcessorChainMap(new NoteProcessorChainMap());

  // Render settings
  data.setRenderStartTime(0);
  data.setRenderEndTime(-1);
  data.setLoopRendering(false);

  return data;
}

describe('Round-trip: simple project', () => {
  it('load preserves all data', async () => {
    const original = buildTestProject();
    const xml1 = original.saveToString();

    // Parse and reload
    const reloaded = await BlueData.loadFromString(xml1);

    // Save again
    const xml2 = reloaded.saveToString();

    // Parse both XMLs and compare structure
    const elem1 = Element.parse(xml1);
    const elem2 = Element.parse(xml2);

    // Version should match
    expect(elem1.getAttribute('version')).toBe(elem2.getAttribute('version'));

    // Project properties should match
    const pp1 = elem1.getElement('projectProperties');
    const pp2 = elem2.getElement('projectProperties');
    expect(pp1!.getTextString('title')).toBe(pp2!.getTextString('title'));
    expect(pp1!.getTextString('author')).toBe(pp2!.getTextString('author'));

    // Global orc/sco should match
    const gos1 = elem1.getElement('globalOrcSco');
    const gos2 = elem2.getElement('globalOrcSco');
    expect(gos1!.getTextString('globalOrc')).toBe(gos2!.getTextString('globalOrc'));

    // Tables should match
    const t1 = elem1.getElement('tables');
    const t2 = elem2.getElement('tables');
    expect(t1!.getTextString()).toBe(t2!.getTextString());

    // Arrangement should match
    const a1 = elem1.getElement('arrangement');
    const a2 = elem2.getElement('arrangement');
    expect(a1!.getElements('instrumentAssignment').size).toBe(
      a2!.getElements('instrumentAssignment').size,
    );
  });
});

describe('Round-trip: individual types', () => {
  it('ProjectProperties round-trips', () => {
    const props = new ProjectProperties();
    props.title = 'My Project';
    props.author = 'Me';
    props.sampleRate = '48000';
    props.ksmps = '32';
    props.nchnls = '2';
    props.useZeroDbFS = true;
    props.zeroDbFS = '65536';
    props.commandLine = '-odac -d';
    props.completeOverride = true;

    const xml = props.saveAsXML();
    const reloaded = ProjectProperties.loadFromXML(xml);

    expect(reloaded.title).toBe(props.title);
    expect(reloaded.author).toBe(props.author);
    expect(reloaded.sampleRate).toBe(props.sampleRate);
    expect(reloaded.ksmps).toBe(props.ksmps);
    expect(reloaded.nchnls).toBe(props.nchnls);
    expect(reloaded.useZeroDbFS).toBe(props.useZeroDbFS);
    expect(reloaded.zeroDbFS).toBe(props.zeroDbFS);
    expect(reloaded.commandLine).toBe(props.commandLine);
    expect(reloaded.completeOverride).toBe(props.completeOverride);
  });

  it('Tables round-trips', () => {
    const tables = new Tables();
    tables.setTables('f 1 0 1024 10 1\nf 2 0 2048 10 1 0.5 0.25\nf 3 0 512 -7 0 256 1 256 0');

    const xml = tables.saveAsXML();
    const reloaded = Tables.loadFromXML(xml);

    expect(reloaded.getTables()).toBe(
      'f 1 0 1024 10 1\nf 2 0 2048 10 1 0.5 0.25\nf 3 0 512 -7 0 256 1 256 0',
    );
  });

  it('GlobalOrcSco round-trips', () => {
    const gos = new GlobalOrcSco();
    gos.setGlobalOrc('; Global ORC\nsr = 44100\n');
    gos.setGlobalSco('; Global SCO\ni1 0 1\n');

    const xml = gos.saveAsXML();
    const reloaded = GlobalOrcSco.loadFromXML(xml);

    expect(reloaded.getGlobalOrc()).toBe(gos.getGlobalOrc());
    expect(reloaded.getGlobalSco()).toBe(gos.getGlobalSco());
  });

  it('GenericInstrument round-trips', () => {
    const instr = new GenericInstrument();
    instr.setName('MyInstr');
    instr.setEnabled(true);
    instr.setText('instr 1\n  aout oscils 0.5, 440, 0\n  outc aout, aout\nendin\n');

    const xml = instr.saveAsXML();
    const reloaded = GenericInstrument.loadFromXML(xml);

    expect(reloaded.getName()).toBe('MyInstr');
    expect(reloaded.isEnabled()).toBe(true);
    expect(reloaded.getText()).toBe(instr.getText());
  });

  it('Arrangement round-trips', async () => {
    const arr = new Arrangement();
    const instr = new GenericInstrument();
    instr.setName('Test');
    arr.addInstrument(instr, '1');

    const xml = arr.saveAsXML();
    const reloaded = await Arrangement.loadFromXML(xml);

    expect(reloaded.size()).toBe(1);
    expect(reloaded.getInstrumentId(0)).toBe('1');
  });

  it('GenericScore round-trips', () => {
    const gs = new GenericScore();
    gs.setName('My Score');
    gs.setScoreText('i1 0 2 440 0.5\ni2 3 1 880 0.3\n');
    gs.setStartTime(TimePosition.beats(0));
    gs.setSubjectiveDuration(TimeDuration.beats(4));
    gs.setTimeBehavior(TimeBehavior.NONE);
    gs.setBackgroundColor(0x666699);

    const xml = gs.saveAsXML();
    const reloaded = GenericScore.loadFromXML(xml);

    expect(reloaded.getName()).toBe('My Score');
    expect(reloaded.getScoreText()).toBe(gs.getScoreText());
    expect(reloaded.getTimeBehavior()).toBe(TimeBehavior.NONE);
    expect(reloaded.getBackgroundColor()).toBe(0x666699);
  });

  it('PolyObject round-trips', () => {
    const pObj = new PolyObject(false);
    pObj.setName('Test Poly');
    pObj.setTimeBehavior(TimeBehavior.SCALE);

    const layer = new SoundLayer();
    layer.setName('Layer 1');
    layer.setMuted(true);
    layer.setSolo(true);
    layer.setHeightIndex(2);

    const gs = new GenericScore();
    gs.setName('Score 1');
    gs.setScoreText('i1 0 2\n');
    layer.push(gs);

    pObj.push(layer);

    const xml = pObj.saveAsXML();
    const reloaded = PolyObject.loadFromXML(xml);

    expect(reloaded.getName()).toBe('Test Poly');
    expect(reloaded.getTimeBehavior()).toBe(TimeBehavior.SCALE);
    expect(reloaded.length).toBe(1);
    expect(reloaded[0].getName()).toBe('Layer 1');
    expect(reloaded[0].isMuted()).toBe(true);
    expect(reloaded[0].isSolo()).toBe(true);
    expect(reloaded[0].getHeightIndex()).toBe(2);
  });

  it('CSD generation works', () => {
    const data = buildTestProject();
    const csd = data.toCSD();

    expect(csd).toContain('<CsoundSynthesizer>');
    // toCSD() generates realtime output without CsOptions section
    expect(csd).toContain('sr=44100');
    expect(csd).toContain('ksmps=64');
    // nchnls is in orchestra header, not CsOptions (Csound 7 rejects -n as "no sound")
    expect(csd).toContain('nchnls = 2');
    // 0dbfs is in orchestra header, not CsOptions (Csound 7 rejects -0 as unknown flag)
    expect(csd).toContain('0dbfs = 1');
    expect(csd).toContain('<CsInstruments>');
    expect(csd).toContain('instr 1');
    expect(csd).toContain('endin');
    expect(csd).toContain('</CsInstruments>');
    expect(csd).toContain('<CsScore>');
    expect(csd).toContain('</CsScore>');
    expect(csd).toContain('</CsoundSynthesizer>');
  });
});

describe('Migration', () => {
  it('upgrades old version format', async () => {
    // Simulate an old .blue file (pre-2.3.0) with tempo node at root level
    const oldXml = `<?xml version="1.0" encoding="UTF-8"?>
<blueData version="2.2.0">
  <projectProperties>
    <title>Old Project</title>
    <sampleRate>44100</sampleRate>
  </projectProperties>
  <tempo>
    <bpm>120</bpm>
  </tempo>
  <soundObject>
    <soundLayer name="Layer 1">
    </soundLayer>
  </soundObject>
</blueData>`;

    // Should not throw — migration handles the old format
    const data = await BlueData.loadFromString(oldXml);
    expect(data.getVersion()).toBe('2.2.0');
    // After migration, tempo should be moved into score
  });

  it('upgrades 0dbfs from global orc (2.1.10 upgrade)', async () => {
    const oldXml = `<?xml version="1.0" encoding="UTF-8"?>
<blueData version="2.1.9">
  <globalOrcSco>
    <globalOrc>sr = 44100
kr = 4410
0dbfs = 32768 ; comment
nchnls = 2</globalOrc>
  </globalOrcSco>
  <projectProperties>
    <title>Test</title>
  </projectProperties>
</blueData>`;

    const data = await BlueData.loadFromString(oldXml);
    const props = data.getProjectProperties();
    expect(props.useZeroDbFS).toBe(true);
    expect(props.zeroDbFS).toBe('32768');
    expect(props.diskUseZeroDbFS).toBe(true);
    expect(props.diskZeroDbFS).toBe('32768');
  });
});
