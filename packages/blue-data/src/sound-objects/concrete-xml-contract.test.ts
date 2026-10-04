import { describe, expect, it } from 'vitest';
import { Element } from '../serialization/xml-reader';
import { loadSoundObjectFromXML } from './sound-object-registry';
import './register-sound-object-types';
import { PianoRoll } from './piano-roll';
import { CSDSoundObject } from './csd-sound-object';
import { External } from './external';
import { TimePosition } from '../time/time-position';
import { TimeDuration } from '../time/time-duration';
import { Scale } from './piano-roll/scale';
import { XmlLoadContext, requireXmlValue } from '../serialization/xml-load';
import { readResourceXml } from '../resource-xml-policy';
import { readProjectXml } from '../blue-data/xml-policy';
import { BlueData } from '../blue-data';
import { PolyObject } from './poly-object';
import { SoundLayer } from './sound-layer';
import { FrozenSoundObject } from './frozen-sound-object';
import { GenericScore } from './generic-score';

const parse = (type: string, content: string, attributes = '') =>
  Element.parse(
    `<soundObject type="blue.soundObject.${type}" ${attributes}>${content}</soundObject>`,
  );
describe('concrete SoundObject XML acceptance', () => {
  it.each([CSDSoundObject, External])(
    'rejects unexpected direct owner roots and nested scalar members for %s',
    (Owner) => {
      const type = Owner === External ? 'External' : 'CSDSoundObject';
      expect(() => Owner.loadFromXML(Element.parse(`<wrong type="${type}"/>`))).toThrow();
      expect(() => Owner.loadFromXML(parse(type, '<unexpected/>'))).toThrow();
      const field = Owner === External ? 'syntaxType' : 'csdText';
      expect(() => Owner.loadFromXML(parse(type, `<${field}><nested/></${field}>`))).toThrow();
    },
  );
  it.each([
    '<polyObject/>',
    '<soundObject type="PolyObject"/>',
    '<soundObject type="blue.soundObject.PolyObject"/>',
  ])('retains the supported PolyObject owner and type aliases: %s', (xml) => {
    const poly = PolyObject.loadFromXML(Element.parse(xml));
    expect(poly.saveAsXML().getName()).toBe('soundObject');
  });
  it('keeps embedded CSD typed timing, repeat and processors in canonical output', () => {
    const object = new CSDSoundObject();
    object.setStartTime(TimePosition.frames(480));
    object.setSubjectiveDuration(TimeDuration.frames(960));
    object.setRepeatPoint(TimeDuration.frames(240));
    object.setCsdText('  <CsoundSynthesizer>\n\n</CsoundSynthesizer>  ');
    const restored = CSDSoundObject.loadFromXML(object.saveAsXML());
    expect(restored.getStartTime().equals(object.getStartTime())).toBe(true);
    expect(restored.getSubjectiveDuration().equals(object.getSubjectiveDuration())).toBe(true);
    expect(restored.getRepeatPoint()!.equals(object.getRepeatPoint()!)).toBe(true);
    expect(restored.getCsdText()).toBe(object.getCsdText());
  });
  it.each([
    'AudioFile',
    'FrozenSoundObject',
    'Comment',
    'PythonObject',
    'JavaScriptObject',
    'ObjectBuilder',
    'Sound',
    'Instance',
    'PatternObject',
    'TrackerObject',
    'PianoRoll',
  ])('rejects unknown members in %s', (type) => {
    expect(() => loadSoundObjectFromXML(parse(type, '<unknown/>'))).toThrow();
  });
  it.each([
    ['AudioFile', '<soundFileName><nested/></soundFileName>', ''],
    ['FrozenSoundObject', '<numChannels>0</numChannels>', ''],
    ['FrozenSoundObject', '<numChannels>-1</numChannels>', ''],
    ['PythonObject', '<pythonCode>pass</pythonCode>', 'onLoadProcessable="yes"'],
    ['JavaScriptObject', '<javaScriptCode/>', 'onLoadProcessable="yes"'],
    ['Comment', '<commentText/><commentText/>', ''],
    ['ObjectBuilder', '<languageType>OTHER</languageType>', ''],
    ['ObjectBuilder', '<isExternal>true</isExternal><languageType>PYTHON</languageType>', ''],
    ['ObjectBuilder', '<syntaxType>Java</syntaxType>', ''],
    ['Instance', '<soundObjectReference/>', ''],
    ['PatternObject', '<beats>2x</beats>', ''],
    ['PatternObject', '<patterns><pattern><values>10x</values></pattern></patterns>', ''],
    ['TrackerObject', '<stepsPerBeat>0</stepsPerBeat>', ''],
    ['PianoRoll', '<pchGenerationMethod>9</pchGenerationMethod>', ''],
    ['PianoRoll', '<fieldDef name="a"/><pianoNote><field name="b" val="0"/></pianoNote>', ''],
  ])('rejects invalid %s payload %s', (type, xml, attrs) => {
    expect(() => loadSoundObjectFromXML(parse(type, xml, attrs))).toThrow();
  });
  it('writes one scale and relinks copied field definitions', () => {
    const root = parse(
      'PianoRoll',
      '<pianoNote><field name="AMP" val="0.5"/></pianoNote><fieldDef name="AMP" min="0" max="1" default="1"/>',
    );
    const roll = loadSoundObjectFromXML(root) as PianoRoll;
    expect(roll.saveAsXML().getElements('scale').toArray()).toHaveLength(1);
    const copy = roll.deepCopy() as PianoRoll;
    expect(copy.getNotes()[0].getFields()[0].getFieldDef()).toBe(copy.getFieldDefinitions()[0]);
    expect(copy.getFieldDefinitions()[0]).not.toBe(roll.getFieldDefinitions()[0]);
  });
  it('diagnoses only the exact empty-first scale placeholder', () => {
    const root = parse('PianoRoll', '<scale/>' + new Scale().saveAsXML().toXml());
    const ctx = new XmlLoadContext(root);
    const roll = loadSoundObjectFromXML(root, undefined, ctx);
    expect(ctx.result(roll).diagnostics.some((d) => d.code === 'SL-H10')).toBe(true);
    expect(roll.saveAsXML().getElements('scale').toArray()).toHaveLength(1);
    expect(() => loadSoundObjectFromXML(parse('PianoRoll', '<scale/><scale/>'))).toThrow();
  });
  it('preserves historical ruler metadata through canonical output and copy', () => {
    const xml = parse(
      'PianoRoll',
      '<timeUnit>4</timeUnit><snapValue>0.25</snapValue><snapValueEnum>QUARTER</snapValueEnum><timeDisplay>0</timeDisplay><primaryTimeDisplay>TIME</primaryTimeDisplay>',
    );
    expect(() => loadSoundObjectFromXML(xml)).toThrow(/report handler/i);
    const warnings: string[] = [];
    const roll = loadSoundObjectFromXML(xml, undefined, undefined, (diagnostics) =>
      warnings.push(...diagnostics.map((diagnostic) => diagnostic.code)),
    ) as PianoRoll;
    expect(warnings).toEqual(['SL-H06']);
    expect(roll.getHistoricalRulerInterval()).toBe(4);
    expect((roll.deepCopy() as PianoRoll).getHistoricalRulerInterval()).toBe(4);
    expect(roll.saveAsXML().getTextString('timeUnit')).toBe('4');
    expect(roll.saveAsXML().getElement('snapValue')).toBeNull();
    expect(() => loadSoundObjectFromXML(parse('PianoRoll', '<timeUnit>0</timeUnit>'))).toThrow();
    expect(() =>
      loadSoundObjectFromXML(
        parse('PianoRoll', '<snapValue>1</snapValue><snapValueEnum>SIXTEENTH</snapValueEnum>'),
      ),
    ).toThrow();
  });
  it('keeps an omitted FrozenSoundObject channel count stable as a standalone resource', () => {
    const source = {
      kind: 'soundObject' as const,
      label: 'frozen.xml',
    };
    const xml =
      '<soundObject type="blue.soundObject.FrozenSoundObject"><frozenWaveFileName>freeze.wav</frozenWaveFileName><soundObject type="blue.soundObject.GenericScore"><scoreText>i1 0 1 440</scoreText></soundObject></soundObject>';
    const report = readResourceXml('soundObject', xml, source);
    expect(report.ok).toBe(true);
    if (!report.ok) throw new Error(JSON.stringify(report.diagnostics));
    const canonical = report.value.saveAsXML().toXml();
    expect(canonical).not.toContain('<numChannels>');
    const again = readResourceXml('soundObject', canonical, source);
    expect(again.ok).toBe(true);
    if (!again.ok) throw new Error(JSON.stringify(again.diagnostics));
    expect(again.value.saveAsXML().toXml()).toBe(canonical);
  });
  it('keeps omitted FrozenSoundObject channels and PianoRoll warnings in embedded projects', () => {
    const project = new BlueData();
    const root = project.getScore()[0] as PolyObject;
    const roll = loadSoundObjectFromXML(
      parse('PianoRoll', '<timeUnit>8</timeUnit>'),
      undefined,
      undefined,
      () => {},
    ) as PianoRoll;
    (root[0] as SoundLayer).push(roll);
    const frozen = new FrozenSoundObject();
    frozen.setFrozenSoundObject(new GenericScore());
    project.getSoundObjectLibrary().addObject(frozen);

    const source = { kind: 'project' as const, label: 'embedded.blue' };
    const report = readProjectXml(project.saveToString(), source);
    expect(report.ok).toBe(true);
    expect(report.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'SL-H06',
          severity: 'warning',
          source,
          path: expect.stringContaining('/timeUnit[1]'),
          value: '8',
        }),
      ]),
    );
    if (!report.ok) throw new Error(JSON.stringify(report.diagnostics));
    const canonical = report.value.saveToString();
    expect(canonical).not.toContain('<numChannels>');

    const history = report.value.historyCopy();
    const copiedRoll = ((history.getScore()[0] as PolyObject)[0] as SoundLayer)[0] as PianoRoll;
    expect(copiedRoll.getHistoricalRulerInterval()).toBe(8);
    expect(copiedRoll.saveAsXML().getTextString('timeUnit')).toBe('8');
    const reopened = readProjectXml(canonical, source);
    expect(reopened.ok).toBe(true);
    if (!reopened.ok) throw new Error(JSON.stringify(reopened.diagnostics));
    expect(reopened.value.saveToString()).toBe(canonical);
  });
  it.each([
    '<steps>1</steps><track><columns><column/></columns><trackerNotes><trackerNote/></trackerNotes></track>',
    '<steps>0</steps><track><trackerNotes><trackerNote/></trackerNotes></track>',
    '<steps>0</steps><track><columns><column><type>9</type></column></columns></track>',
    '<steps>1</steps><track><trackerNotes><trackerNote><field val="x" extra="1"/></trackerNote></trackerNotes></track>',
  ])('rejects inconsistent or malformed tracker structure %s', (xml) => {
    expect(() =>
      loadSoundObjectFromXML(parse('TrackerObject', '<trackList>' + xml + '</trackList>')),
    ).toThrow();
  });
  it.each([
    [2, '128'],
    [2, '60x'],
    [4, 'NaN'],
    [4, '1trailing'],
    [0, '8.12x'],
    [1, '8.bad'],
  ])('rejects invalid type %s tracker cell %s', (type, value) => {
    const payload = `<trackList><steps>1</steps><track><columns><column><type>${type}</type></column></columns><trackerNotes><trackerNote><field val="${value}"/></trackerNote></trackerNotes></track></trackList>`;
    expect(() => loadSoundObjectFromXML(parse('TrackerObject', payload))).toThrow();
  });
  it('retains ordered historical tracker cells and dormant column settings', () => {
    const root = parse(
      'TrackerObject',
      '<trackList><steps>1</steps><track><columns><column><name>pitch</name><type>3</type><rangeMin>-2</rangeMin><rangeMax>4</rangeMax><usingRange>false</usingRange></column><column/></columns><trackerNotes><trackerNote><pitch>  8.00 </pitch><otherField val="  code  "/></trackerNote></trackerNotes></track></trackList>',
    );
    const output = loadSoundObjectFromXML(root).saveAsXML();
    const track = output.getElement('trackList')!.getElement('track')!;
    expect(
      track
        .getElement('trackerNotes')!
        .getElement('trackerNote')!
        .getElements('field')
        .toArray()
        .map((field) => field.getAttribute('val')),
    ).toEqual(['  8.00 ', '  code  ']);
    expect(track.getElement('columns')!.getElement('column')!.getTextString('rangeMin')).toBe('-2');
  });
  it('normalizes the bounded obsolete Python editor setting with a warning', () => {
    const root = parse(
      'ObjectBuilder',
      '<isExternal>false</isExternal><syntaxType>Python</syntaxType><code>  pass\n</code>',
    );
    const ctx = new XmlLoadContext(root);
    const result = ctx.result(loadSoundObjectFromXML(root, undefined, ctx));
    expect(result.ok).toBe(true);
    expect(result.diagnostics.some((d) => d.severity === 'warning')).toBe(true);
    const obj = requireXmlValue(result, () => {});
    expect(obj.saveAsXML().getElement('syntaxType')).toBeNull();
    expect(obj.saveAsXML().getTextString('code')).toBe('  pass\n');
  });
});
