import { describe, expect, it } from 'vitest';
import { Element } from '../serialization/xml-reader';
import { BlueData } from '../blue-data';
import { CompileData } from '../compile-data';
import { TimeDuration } from '../time/time-duration';
import { TimePosition } from '../time/time-position';
import { TimeContext } from '../time/time-context';
import { PolyObject } from './poly-object';
import { SoundLayer } from './sound-layer';
import { Sound } from './sound';
import { BlueSynthBuilder } from '../instruments/blue-synth-builder';
import { collectBsbWidgetIds } from '../instruments/blue-synth-builder/bsb-identity';

const BSB_FOR_CSD = `<instrument type="blue.orchestra.BlueSynthBuilder" editEnabled="true">
  <name>TestSound</name>
  <comment></comment>
  <globalOrc></globalOrc>
  <globalSco></globalSco>
  <instrumentText>aout oscili 0.25, 440
outc aout, aout</instrumentText>
  <alwaysOnInstrumentText></alwaysOnInstrumentText>
  <graphicInterface/>
  <parameterList/>
  <opcodeList/>
</instrument>`;

const BSB_FOR_AUTOMATED_SCORE_SOUND = `<instrument type="blue.orchestra.BlueSynthBuilder" editEnabled="true">
  <name>AutomatedSound</name>
  <comment></comment>
  <globalOrc></globalOrc>
  <globalSco></globalSco>
  <instrumentText>aout oscili 0.25, &lt;freq&gt;
outc aout, aout</instrumentText>
  <alwaysOnInstrumentText></alwaysOnInstrumentText>
  <graphicInterface>
    <bsbObject type="blue.orchestra.blueSynthBuilder.BSBKnob" version="2">
      <objectName>freq</objectName>
      <x>0</x>
      <y>0</y>
      <label>Freq</label>
      <value>440</value>
      <minimum>100</minimum>
      <maximum>800</maximum>
    </bsbObject>
  </graphicInterface>
  <parameterList>
    <parameter uniqueId="freq-param" name="freq" label="Freq" min="100.0" max="800.0" bdresolution="-1" automationEnabled="true" value="440.0">
      <line name="freq" version="2" max="800.0" min="100.0" bdresolution="-1" color="-8355712" rightBound="true" endPointsLinked="false">
        <linePoint x="0.0" y="100.0"/>
        <linePoint x="0.5" y="300.0"/>
        <linePoint x="1.0" y="500.0"/>
      </line>
    </parameter>
  </parameterList>
  <opcodeList/>
</instrument>`;

const BSB_WITH_IDENTITIES = `<instrument type="blue.orchestra.BlueSynthBuilder" editEnabled="true">
  <name>IdentitySound</name>
  <comment></comment>
  <globalOrc></globalOrc>
  <globalSco></globalSco>
  <instrumentText>aout oscili 0.25, &lt;freq&gt;
outc aout, aout</instrumentText>
  <alwaysOnInstrumentText></alwaysOnInstrumentText>
  <graphicInterface>
    <bsbObject type="blue.orchestra.blueSynthBuilder.BSBKnob" version="2" uniqueId="sound-widget">
      <objectName>freq</objectName>
      <x>0</x>
      <y>0</y>
      <label>Freq</label>
      <value>440</value>
      <minimum>100</minimum>
      <maximum>800</maximum>
    </bsbObject>
  </graphicInterface>
  <parameterList>
    <parameter uniqueId="sound-param" name="freq" label="Freq" min="100.0" max="800.0" bdresolution="-1" automationEnabled="true" value="440.0">
      <line name="freq" version="2" max="800.0" min="100.0" bdresolution="-1" color="-8355712" rightBound="true" endPointsLinked="false">
        <linePoint x="0.0" y="100.0"/>
        <linePoint x="1.0" y="500.0"/>
      </line>
    </parameter>
  </parameterList>
  <opcodeList/>
</instrument>`;

describe('Sound XML parity', () => {
  it('migrates legacy Sound instrumentText-only payloads into BlueSynthBuilder XML', () => {
    const xml = Element.parse(`<soundObject type="blue.soundObject.Sound">
      <startTime type="BEATS"><csoundBeats>0.0</csoundBeats></startTime>
      <subjectiveDuration type="BEATS"><csoundBeats>4.0</csoundBeats></subjectiveDuration>
      <name>Sound</name>
      <instrumentText>instr 1\n  out(0)\nendin</instrumentText>
      <comment>legacy</comment>
    </soundObject>`);

    const sound = Sound.loadFromXML(xml);
    expect(sound.getComment()).toBe('legacy');
    expect(sound.getBSBInstrumentText()).toContain(
      '<instrument type="blue.orchestra.BlueSynthBuilder"',
    );
    expect(sound.getBSBInstrumentText()).toContain('<instrumentText>instr 1');
  });

  it('loads Java-style embedded BlueSynthBuilder instrument XML', () => {
    const xml = Element.parse(`<soundObject type="blue.soundObject.Sound">
      <startTime type="BEATS"><csoundBeats>0.0</csoundBeats></startTime>
      <subjectiveDuration type="BEATS"><csoundBeats>4.0</csoundBeats></subjectiveDuration>
      <name>Sound</name>
      <backgroundColor>-12566464</backgroundColor>
      <instrument type="blue.orchestra.BlueSynthBuilder" editEnabled="true">
        <name>UnitTest</name>
        <comment></comment>
        <globalOrc></globalOrc>
        <globalSco></globalSco>
        <instrumentText>instr 1\nendin</instrumentText>
        <alwaysOnInstrumentText></alwaysOnInstrumentText>
        <graphicInterface/>
        <parameterList/>
        <opcodeList/>
      </instrument>
      <comment>hello</comment>
    </soundObject>`);

    const sound = Sound.loadFromXML(xml);
    expect(sound.getComment()).toBe('hello');
    expect(sound.getBSBInstrumentText()).toContain(
      '<instrument type="blue.orchestra.BlueSynthBuilder"',
    );
    expect(sound.getBSBInstrumentText()).toContain('<name>UnitTest</name>');
  });

  it('saves an empty Sound with a default Java-style instrument element', () => {
    const sound = new Sound();
    const saved = sound.saveAsXML().toXml();

    expect(saved).toContain('<instrument type="blue.orchestra.BlueSynthBuilder"');
    expect(saved).toContain('<parameterList/>');
    expect(saved).toContain('<opcodeList/>');
  });

  it('preserves invalid legacy instrument text payloads', () => {
    const sound = new Sound();
    sound.setBSBInstrumentText('legacy<&invalid');

    const saved = sound.saveAsXML().toXml();
    expect(saved).toContain('<instrumentText>legacy&lt;&amp;invalid</instrumentText>');
  });

  it('generates score notes and adds a BSB instrument to compile data', () => {
    const sound = new Sound();
    sound.setStartTime(TimePosition.beats(2));
    sound.setSubjectiveDuration(TimeDuration.beats(8));
    sound.setBSBInstrumentText(BSB_FOR_CSD);

    const compileData = new CompileData();
    const notes = sound.generateForCSD(new TimeContext(), compileData, 1.5, 5.0);

    expect(notes.length).toBe(1);
    const note = notes.getNote(0);
    expect(note.getPField(1)).toBe('1');
    expect(note.getStartTime()).toBeCloseTo(3.5, 6);
    expect(note.getSubjectiveDuration()).toBeCloseTo(3.5, 6);

    expect(compileData.getArrangement().size()).toBe(1);
    const orc = compileData.getArrangement().generateOrchestra(compileData);
    expect(orc).toContain('instr 1\t;TestSound');
    expect(orc).toContain('aout oscili 0.25, 440');
  });

  it('includes Sound object orchestra and score events in project CSD output', () => {
    const data = new BlueData();
    data.getScore().length = 0;

    const poly = new PolyObject(true);
    const layer = new SoundLayer();
    const sound = new Sound();
    sound.setStartTime(TimePosition.beats(1.25));
    sound.setSubjectiveDuration(TimeDuration.beats(4));
    sound.setBSBInstrumentText(BSB_FOR_CSD);
    layer.push(sound);
    poly.push(layer);
    data.getScore().push(poly);

    const csd = data.toCSD();
    expect(csd).toContain('instr 1\t;TestSound');
    expect(csd).toContain('aout oscili 0.25, 440');
    expect(csd).toContain('i1\t1.25\t4');
  });

  it('routes score Sound automation through compile-time gk vars and absolute-time parameter notes', () => {
    const data = new BlueData();
    data.getScore().length = 0;

    const poly = new PolyObject(true);
    const layer = new SoundLayer();
    const sound = new Sound();
    sound.setStartTime(TimePosition.beats(2));
    sound.setSubjectiveDuration(TimeDuration.beats(8));
    sound.setBSBInstrumentText(BSB_FOR_AUTOMATED_SCORE_SOUND);
    layer.push(sound);
    poly.push(layer);
    data.getScore().push(poly);

    const csd = data.toDiskCSD();

    expect(csd).toContain('gk_blue_auto1 init 100');
    expect(csd).toContain('aout oscili 0.25, gk_blue_auto1');
    expect(csd).toContain('instr 2\t;Param: freq');
    expect(csd).toContain('gk_blue_auto1 line p4, p3, p5');
    expect(csd).toMatch(/i2\s+2(?:\.0)?\s+4(?:\.0)?\s+100(?:\.0)?\s+300(?:\.0)?/);
    expect(csd).toMatch(/i2\s+6(?:\.0)?\s+4(?:\.0)?\s+300(?:\.0)?\s+500(?:\.0)?/);
    expect(csd).toMatch(/i2\s+10(?:\.0)?\s+0\.0001\s+500(?:\.0)?\s+500(?:\.0)?/);
  });

  it('includes score Sound automation in realtime playback metadata with absolute beat points', () => {
    const data = new BlueData();
    data.getScore().length = 0;

    const poly = new PolyObject(true);
    const layer = new SoundLayer();
    const sound = new Sound();
    sound.setStartTime(TimePosition.beats(2));
    sound.setSubjectiveDuration(TimeDuration.beats(8));
    sound.setBSBInstrumentText(BSB_FOR_AUTOMATED_SCORE_SOUND);
    layer.push(sound);
    poly.push(layer);
    data.getScore().push(poly);

    const render = data.toRealtimePlaybackCSD();
    const parameters = render.parameters ?? [];
    const freq = parameters.find((parameter) => parameter.getName() === 'freq');

    expect(render.csdText).toContain('aout oscili 0.25, gk_blue_auto1');
    expect(freq).toBeDefined();
    expect(freq?.getCompilationVarName()).toBe('gk_blue_auto1');
    expect(freq?.getPoints()).toEqual([
      { time: 2, value: 100 },
      { time: 6, value: 300 },
      { time: 10, value: 500 },
    ]);
  });

  it('preserves embedded BSB identities during ordinary save and reload', () => {
    const sound = new Sound();
    sound.setBSBInstrumentText(BSB_WITH_IDENTITIES);

    const savedXml = sound.saveAsXML().toXml();
    const reloaded = Sound.loadFromXML(Element.parse(savedXml));
    const reloadedBuilder = BlueSynthBuilder.loadFromXML(
      Element.parse(reloaded.getBSBInstrumentText()),
    );

    expect(savedXml).toContain('uniqueId="sound-widget"');
    expect(savedXml).toContain('uniqueId="sound-param"');
    expect(collectBsbWidgetIds(reloadedBuilder.getGraphicInterface().getRootGroup())).toEqual([
      'sound-widget',
    ]);
    expect(reloadedBuilder.getParameters().map((parameter) => parameter.getUniqueId())).toEqual([
      'sound-param',
    ]);
  });

  it('deep-copies embedded BSB data with fresh widget and parameter identities', () => {
    const sound = new Sound();
    sound.setBSBInstrumentText(BSB_WITH_IDENTITIES);

    const duplicate = sound.deepCopy() as Sound;
    const originalBuilder = BlueSynthBuilder.loadFromXML(
      Element.parse(sound.getBSBInstrumentText()),
    );
    const duplicateBuilder = BlueSynthBuilder.loadFromXML(
      Element.parse(duplicate.getBSBInstrumentText()),
    );

    expect(collectBsbWidgetIds(duplicateBuilder.getGraphicInterface().getRootGroup())).not.toEqual(
      collectBsbWidgetIds(originalBuilder.getGraphicInterface().getRootGroup()),
    );
    expect(
      duplicateBuilder.getParameters().map((parameter) => parameter.getUniqueId()),
    ).not.toEqual(originalBuilder.getParameters().map((parameter) => parameter.getUniqueId()));
    expect(duplicateBuilder.getParameters().map((parameter) => parameter.getName())).toEqual(
      originalBuilder.getParameters().map((parameter) => parameter.getName()),
    );
  });
});
