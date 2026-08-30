import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { Element } from '../serialization/xml-reader';
import { Track } from '../score/track/track';
import {
  BlueX7,
  createDefaultBlueX7Voice,
  generateBlueX7Preview,
  getBlueX7BindingReport,
} from './blue-x7';

describe('BlueX7', () => {
  it('instantiates with Java-default values', () => {
    const instr = new BlueX7();
    expect(instr.getName()).toBe('BlueX7');
    expect(instr.getComment()).toBe('');
    expect(instr.isEnabled()).toBe(true);

    const voice = instr.getVoice();
    expect(voice.common.algorithm).toBe(19);
    expect(voice.common.keyTranspose).toBe(24);
    expect(voice.common.feedback).toBe(6);
    expect(voice.common.operatorEnabled).toEqual([true, true, true, true, true, true]);

    expect(voice.lfo.speed).toBe(35);
    expect(voice.lfo.delay).toBe(0);
    expect(voice.lfo.pitchModulationDepth).toBe(0);
    expect(voice.lfo.amplitudeModulationDepth).toBe(0);
    expect(voice.lfo.wave).toBe(0);
    expect(voice.lfo.sync).toBe(0);

    expect(voice.operators).toHaveLength(6);
    expect(voice.operators[0].mode).toBe(0);
    expect(voice.operators[0].sync).toBe(1);
    expect(voice.operators[0].freqCoarse).toBe(0);
    expect(voice.operators[0].freqFine).toBe(1);
    expect(voice.operators[0].detune).toBe(-3);
    expect(voice.operators[0].outputLevel).toBe(99);
    expect(voice.operators[0].velocitySensitivity).toBe(2);
    expect(voice.operators[0].envelope).toEqual([
      { rate: 81, level: 99 },
      { rate: 25, level: 82 },
      { rate: 20, level: 0 },
      { rate: 48, level: 0 },
    ]);

    expect(voice.pitchEnvelope).toEqual([
      { rate: 50, level: 50 },
      { rate: 50, level: 50 },
      { rate: 50, level: 50 },
      { rate: 50, level: 50 },
    ]);
    expect(voice.csoundPostCode).toBe('blueMixerOut aout, aout');
  });

  it('keeps all operator-enable fixed Parameters synchronized for a full-mask edit', () => {
    const instr = new BlueX7();
    const enabled = [false, true, false, true, false, true] as const;

    instr.setCommonField('operatorEnabled', [...enabled]);

    expect(instr.getVoice().common.operatorEnabled).toEqual(enabled);
    for (const [index, expected] of enabled.entries()) {
      const parameter = instr
        .getParameters()
        .find((candidate) => candidate.getName() === `operator.${index + 1}.enabled`);
      expect(parameter?.getFixedValue()).toBe(expected ? 1 : 0);
    }
  });

  it('creates an independent deep copy', () => {
    const instr = new BlueX7();
    const copy = instr.deepCopy();

    copy.setName('New Name');
    copy.setCommonField('algorithm', 5);
    copy.setOperatorField(0, 'freqCoarse', 12);
    copy.setOperatorEnvelopePoint(0, 0, { rate: 99, level: 10 });
    copy.setPitchEnvelopePoint(0, { rate: 77, level: 33 });
    copy.setCsoundPostCode('customCode');

    expect(instr.getName()).toBe('BlueX7');
    expect(instr.getVoice().common.algorithm).toBe(19);
    expect(instr.getVoice().operators[0].freqCoarse).toBe(0);
    expect(instr.getVoice().operators[0].envelope[0]).toEqual({ rate: 81, level: 99 });
    expect(instr.getVoice().pitchEnvelope[0]).toEqual({ rate: 50, level: 50 });
    expect(instr.getVoice().csoundPostCode).toBe('blueMixerOut aout, aout');
  });

  it('loads and saves Java default XML fixture identically', () => {
    const fixturePath = path.join(__dirname, 'blue-x7/test-fixtures/java-default.blue.xml');
    const xmlText = fs.readFileSync(fixturePath, 'utf-8');
    const elem = Element.parse(xmlText);
    expect(elem.getElement('parameterList')).toBeNull();
    const instr = BlueX7.loadFromXML(elem);

    expect(instr.getName()).toBe('untitled');
    expect(instr.getVoice().common.algorithm).toBe(19);
    expect(instr.getVoice().common.keyTranspose).toBe(24);
    expect(instr.getVoice().common.feedback).toBe(6);
    expect(instr.getVoice().lfo.speed).toBe(35);
    expect(instr.getVoice().operators[0].envelope[0]).toEqual({ rate: 81, level: 99 });

    const savedElem = instr.saveAsXML();
    const firstSaveIds = instr.getParameters().map((parameter) => parameter.getUniqueId());
    expect(new Set(firstSaveIds).size).toBe(151);
    expect(savedElem.getElement('parameterList')).not.toBeNull();
    const reloaded = BlueX7.loadFromXML(savedElem);
    expect(reloaded.getVoice()).toEqual(instr.getVoice());
    expect(reloaded.getParameters().map((parameter) => parameter.getUniqueId())).toEqual(firstSaveIds);
  });

  it('preserves unknown root/nested attributes and extra elements in boundary fixture', () => {
    const fixturePath = path.join(__dirname, 'blue-x7/test-fixtures/boundary-and-unknown.blue.xml');
    const xmlText = fs.readFileSync(fixturePath, 'utf-8');
    const elem = Element.parse(xmlText);
    const instr = BlueX7.loadFromXML(elem);

    expect(instr.getName()).toBe('Boundary and Unknown');
    expect(instr.getVoice().common.algorithm).toBe(32);
    expect(instr.getVoice().common.keyTranspose).toBe(48);
    expect(instr.getVoice().common.feedback).toBe(7);
    expect(instr.getVoice().common.operatorEnabled).toEqual([true, false, true, false, true, false]);
    expect(instr.getVoice().lfo.wave).toBe(5);
    expect(instr.getVoice().lfo.sync).toBe(1);
    expect(instr.getVoice().operators[0].detune).toBe(7);
    expect(instr.getVoice().operators.map((operator) => operator.sync)).toEqual([0, 1, 0, 1, 0, 1]);
    expect(instr.getVoice().operators.map((operator) => operator.modulationPitch)).toEqual([7, 0, 3, 0, 0, 0]);

    // Modify a known field and save
    instr.setCommonField('algorithm', 10);
    instr.setOperatorField(0, 'outputLevel', 88);

    const savedXml = instr.saveAsXML().toXml();
    // Root unknown attributes & elements preserved
    expect(savedXml).toContain('customRootAttr="root-123"');
    expect(savedXml).toContain('<unknownRootNode>');
    expect(savedXml).toContain('<child foo="bar">preserved content</child>');
    expect(savedXml).toContain('<extraRootPoint x="10" y="20"/>');
    // Nested unknown attributes & elements preserved
    expect(savedXml).toContain('customAttr="common-meta"');
    expect(savedXml).toContain('<unknownCommonData>nested common</unknownCommonData>');
    expect(savedXml).toContain('<unknownLfoChild value="lfo-custom"/>');
    expect(savedXml).toContain('customOpAttr="op0"');
    expect(savedXml).toContain('customPointAttr="p0"');
    expect(savedXml).toContain('<extraEnvelopePoint x="12" y="34"/>');
    expect(savedXml).toContain('<unknownOperatorNode>custom op data</unknownOperatorNode>');
    // Updated fields reflect new values
    expect(savedXml).toContain('<algorithm>10</algorithm>');
    expect(savedXml).toContain('<outputLevel>88</outputLevel>');

    const firstSaveIds = instr.getParameters().map((parameter) => parameter.getUniqueId());
    const reopened = BlueX7.loadFromXML(Element.parse(savedXml));
    expect(reopened.getParameters().map((parameter) => parameter.getUniqueId())).toEqual(firstSaveIds);
    expect(reopened.getVoice().operators.map((operator) => operator.sync)).toEqual([0, 1, 0, 1, 0, 1]);
    expect(reopened.saveAsXML().toXml()).toContain('<unknownOperatorNode>custom op data</unknownOperatorNode>');
  });

  it('supports shared sync and PMS propagation across all 6 operators', () => {
    const instr = new BlueX7();
    instr.setSharedOscillatorSync(0);
    for (let i = 0; i < 6; i++) {
      expect(instr.getVoice().operators[i].sync).toBe(0);
    }

    instr.setSharedPitchModulationSensitivity(6);
    for (let i = 0; i < 6; i++) {
      expect(instr.getVoice().operators[i].modulationPitch).toBe(6);
    }
  });

  it('replaces entire voice while preserving metadata and unknown XML template', () => {
    const fixturePath = path.join(__dirname, 'blue-x7/test-fixtures/boundary-and-unknown.blue.xml');
    const elem = Element.parse(fs.readFileSync(fixturePath, 'utf-8'));
    const instr = BlueX7.loadFromXML(elem);

    const newVoice = createDefaultBlueX7Voice();
    newVoice.common.algorithm = 7;
    newVoice.csoundPostCode = 'customMixer aout';

    instr.replaceVoice(newVoice);

    expect(instr.getName()).toBe('Boundary and Unknown');
    expect(instr.getVoice().common.algorithm).toBe(7);
    expect(instr.getVoice().csoundPostCode).toBe('customMixer aout');

    const savedXml = instr.saveAsXML().toXml();
    expect(savedXml).toContain('customRootAttr="root-123"');
    expect(savedXml).toContain('<unknownRootNode>');
    expect(savedXml).toContain('<algorithm>7</algorithm>');
  });

  it('does not allocate a live transport table', () => {
    const instr = new BlueX7();
    expect(instr.hasFTable()).toBe(false);
  });

  it('writes the complete 155-value snapshot directly into the generated target', () => {
    const instr = new BlueX7();
    instr.getVoice().common.algorithm = 19;
    instr.getVoice().common.operatorEnabled = [true, true, false, true, true, true];
    const body = instr.generateInstrument();
    // algorithm 19 -> slot 134 = 18; mask bit 2 cleared
    expect(body).toContain('iBlueX7Voice[134] = 18');
    // detune -3 of logical operator 1 -> slot 105+20 = 125 holds -3 + 7 = 4
    expect(body).toContain('iBlueX7Voice[125] = 4');
    // name bytes zero
    for (let slot = 145; slot < 155; slot += 1) {
      expect(body).toContain(`iBlueX7Voice[${slot}] = 0`);
    }
    expect(body).toContain('iBlueX7OperatorMask = 59');
    expect(body).not.toContain('tabw');
    expect(body).not.toContain('chnget');
  });

  it('generates the modern host wrapper with Blue pitch, velocity, gate, and post code', () => {
    for (const alg of [1, 19, 32]) {
      const voice = createDefaultBlueX7Voice();
      voice.common.algorithm = alg;
      voice.csoundPostCode = 'blueMixerOut aout, aout';

      const preview = generateBlueX7Preview(voice, `Alg_${alg}`);
      expect(preview.tables).toBe('');
      expect(preview.body).toContain(
        'iBlueX7MidiNote = (p4 < 15 ? ftom:i(cpspch:i(p4)) : ftom:i(p4))',
      );
      expect(preview.body).toContain('iBlueX7GateSeconds = abs(p3)');
      expect(preview.body).toContain('iBlueX7OperatorMask = 63');
      expect(preview.body).toMatch(
        /aout = bluex7_voice\(iBlueX7MidiNote, i\(p5\), iBlueX7Voice, iBlueX7OperatorMask, iBlueX7GateSeconds, kBlueX7LiveVoice, kBlueX7LiveMask, kBlueX7Dirty\)/,
      );
      expect(preview.body).not.toContain('tabw');
      expect(preview.body).not.toContain('chnget');
      // post code arrives after the module output at the same user-visible stage
      const aoutIndex = preview.body.indexOf('aout = bluex7_voice');
      const postIndex = preview.body.indexOf('blueMixerOut aout, aout');
      expect(postIndex).toBeGreaterThan(aoutIndex);
    }
  });

  it('reports every catalog field as emitted with its update class and no dormant-field claims', () => {
    const report = getBlueX7BindingReport();
    expect(report.emitted).toHaveLength(152); // 151 parameters + post code
    expect(report.emitted.join('\n')).toContain('common.algorithm');
    expect(report.emitted.join('\n')).toContain('[next-note]');
    expect(report.emitted.join('\n')).toContain('[active-note]');
    expect(report.emitted).toContain('csoundPostCode (appended verbatim after the module aout)');
    expect(report.notEmitted).toHaveLength(1); // only the nonsynthesized name bytes
    expect(report.notEmitted[0]).toContain('voice-name bytes');
  });

  it('bakes out-of-range algorithms safely at the transport boundary', () => {
    const instr = new BlueX7();
    instr.getVoice().common.algorithm = 40; // corrupt algorithm clamps to 32 at transport
    const body = instr.generateInstrument();
    expect(body).toContain('iBlueX7Voice[134] = 31'); // clamped to algorithm 32, 0-based
    // the wrapper still renders (the module owns all 32 topologies)
    expect(instr.generateInstrument()).toContain('bluex7_voice');
  });

  it('owns exactly 151 catalog parameters with voice-derived fixed values', () => {
    const instr = new BlueX7();
    const params = instr.getParameters();
    expect(params).toHaveLength(151);
    const names = new Set(params.map((p) => p.getName()));
    expect(names.size).toBe(151);
    expect(names).toContain('common.algorithm');
    expect(names).toContain('operator.1.outputLevel');

    const algorithm = params.find((p) => p.getName() === 'common.algorithm')!;
    expect(algorithm.getMinimum()).toBe(1);
    expect(algorithm.getMaximum()).toBe(32);
    expect(algorithm.getResolution()).toBe(1);
    expect(algorithm.getFixedValue()).toBe(19);
    expect(algorithm.getLabel()).toBe('Algorithm');

    const outputLevel = params.find((p) => p.getName() === 'operator.1.outputLevel')!;
    expect(outputLevel.getFixedValue()).toBe(99);
  });

  it('migrates legacy XML without parameterList without changing the voice', () => {
    const original = new BlueX7();
    original.setName('Legacy');
    original.getVoice().common.algorithm = 7;
    original.getVoice().operators[2].outputLevel = 42;
    const legacyElement = Element.parse(original.saveAsXML().toXml());
    legacyElement.removeElements('parameterList');

    const loaded = BlueX7.loadFromXML(legacyElement);
    expect(loaded.getParameters()).toHaveLength(151);
    expect(loaded.getVoice().common.algorithm).toBe(7);
    expect(loaded.getVoice().operators[2].outputLevel).toBe(42);
    expect(
      loaded.getParameters().find((p) => p.getName() === 'operator.3.outputLevel')!.getFixedValue(),
    ).toBe(42);
  });

  it('retains identities and automation content across same-owner save/reopen', () => {
    const instr = new BlueX7();
    const param = instr.getParameters().find((p) => p.getName() === 'common.feedback')!;
    param.setAutomationEnabled(true);
    param.setPoints([{ time: 0, value: 2 }, { time: 4, value: 5 }]);
    param.setLineColor(-12345);

    const reloaded = BlueX7.loadFromXML(Element.parse(instr.saveAsXML().toXml()));
    const retained = reloaded.getParameters().find((p) => p.getName() === 'common.feedback')!;
    expect(retained.getUniqueId()).toBe(param.getUniqueId());
    expect(retained.isAutomationEnabled()).toBe(true);
    expect(retained.getPoints()).toEqual([{ time: 0, value: 2 }, { time: 4, value: 5 }]);
    expect(retained.getLineColor()).toBe(-12345);
    // identities are stable for every parameter on reopen
    const before = new Map(instr.getParameters().map((p) => [p.getName(), p.getUniqueId()]));
    for (const p of reloaded.getParameters()) {
      expect(before.get(p.getName())).toBe(p.getUniqueId());
    }
  });

  it('repairs malformed and duplicate persisted metadata deterministically', () => {
    const instr = new BlueX7();
    const xml = instr.saveAsXML().toXml();
    const elem = Element.parse(xml);
    const list = elem.getElement('parameterList')!;
    // duplicate: two parameters named common.feedback; the first wins
    const duplicate = Element.parse(list.getElements('parameter').next().toXml());
    list.addElement(duplicate);
    // malformed: a parameter without a name
    const malformed = Element.parse(list.getElements('parameter').next().toXml());
    malformed.setAttribute('name', '');
    list.addElement(malformed);

    const loaded = BlueX7.loadFromXML(elem);
    const params = loaded.getParameters();
    expect(params).toHaveLength(151);
    const feedbacks = params.filter((p) => p.getName() === 'common.feedback');
    expect(feedbacks).toHaveLength(1);
    expect(feedbacks[0].getUniqueId()).toBe(
      instr.getParameters().find((p) => p.getName() === 'common.feedback')!.getUniqueId(),
    );
  });

  it('regenerates all parameter identities at a new ownership boundary', () => {
    const instr = new BlueX7();
    const param = instr.getParameters().find((p) => p.getName() === 'lfo.speed')!;
    param.setAutomationEnabled(true);
    param.setPoints([{ time: 1, value: 10 }]);

    const copy = instr.deepCopy();
    const beforeIds = instr.getParameters().map((p) => p.getUniqueId());
    const afterIds = copy.getParameters().map((p) => p.getUniqueId());
    expect(afterIds).toHaveLength(151);
    expect(new Set(afterIds).size).toBe(151);
    for (const id of afterIds) {
      expect(beforeIds).not.toContain(id);
    }
    // content is preserved across the copy
    const copiedParam = copy.getParameters().find((p) => p.getName() === 'lfo.speed')!;
    expect(copiedParam.isAutomationEnabled()).toBe(true);
    expect(copiedParam.getPoints()).toEqual([{ time: 1, value: 10 }]);
    expect(copiedParam.getFixedValue()).toBe(param.getFixedValue());
  });

  it('keeps reopen ids stable while paste and Track assignment create disjoint owners', () => {
    const source = new BlueX7();
    const sourceIds = source.getParameters().map((parameter) => parameter.getUniqueId());
    const reopened = BlueX7.loadFromXML(Element.parse(source.saveAsXML().toXml()));
    expect(reopened.getParameters().map((parameter) => parameter.getUniqueId())).toEqual(sourceIds);

    const pasted = source.deepCopy();
    const track = new Track();
    track.setInstrument(source);
    const assigned = track.getInstrument() as BlueX7;
    const ownerIdSets = [source, pasted, assigned].map(
      (instrument) => new Set(instrument.getParameters().map((parameter) => parameter.getUniqueId())),
    );
    expect(ownerIdSets.every((ids) => ids.size === 151)).toBe(true);
    for (let left = 0; left < ownerIdSets.length; left += 1) {
      for (let right = left + 1; right < ownerIdSets.length; right += 1) {
        expect([...ownerIdSets[left]!].some((id) => ownerIdSets[right]!.has(id))).toBe(false);
      }
    }
  });

  it('reads shared values from logical operator 1 while preserving mixed XML', () => {
    const instr = new BlueX7();
    instr.getVoice().operators[0].sync = 1;
    instr.getVoice().operators[1].sync = 0;
    instr.getVoice().operators[0].modulationPitch = 5;
    instr.getVoice().operators[3].modulationPitch = 2;

    const reloaded = BlueX7.loadFromXML(Element.parse(instr.saveAsXML().toXml()));
    expect(
      reloaded.getParameters().find((p) => p.getName() === 'common.oscillatorKeySync')!.getFixedValue(),
    ).toBe(1);
    expect(
      reloaded.getParameters().find((p) => p.getName() === 'lfo.pitchModulationSensitivity')!.getFixedValue(),
    ).toBe(5);
    // legacy mixed voice values remain unnormalized in XML
    const saved = Element.parse(reloaded.saveAsXML().toXml());
    const ops = saved.getElements('operator').toArray();
    expect(ops[0].getTextString('sync')).toBe('1');
    expect(ops[1].getTextString('sync')).toBe('0');
    expect(ops[0].getTextString('modulationPitch')).toBe('5');
    expect(ops[3].getTextString('modulationPitch')).toBe('2');
  });

  it('replaces fixed values whole-voice while retaining identities and curves', () => {
    const instr = new BlueX7();
    const feedbackParam = instr.getParameters().find((p) => p.getName() === 'common.feedback')!;
    const speedParam = instr.getParameters().find((p) => p.getName() === 'lfo.speed')!;
    feedbackParam.setAutomationEnabled(true);
    feedbackParam.setPoints([{ time: 0, value: 1 }, { time: 2, value: 7 }]);
    const beforeIds = instr.getParameters().map((p) => p.getUniqueId());

    const replacement = createDefaultBlueX7Voice();
    replacement.common.feedback = 3;
    replacement.lfo.speed = 77;
    replacement.common.algorithm = 5;
    instr.replaceVoice(replacement);

    expect(instr.getVoice().common.feedback).toBe(3);
    expect(instr.getVoice().lfo.speed).toBe(77);
    expect(feedbackParam.getFixedValue()).toBe(3);
    expect(speedParam.getFixedValue()).toBe(77);
    expect(
      instr.getParameters().find((p) => p.getName() === 'common.algorithm')!.getFixedValue(),
    ).toBe(5);
    // identities and automation content retained
    expect(instr.getParameters().map((p) => p.getUniqueId())).toEqual(beforeIds);
    expect(feedbackParam.isAutomationEnabled()).toBe(true);
    expect(feedbackParam.getPoints()).toEqual([{ time: 0, value: 1 }, { time: 2, value: 7 }]);
  });

  it('updates voice and fixed value together on widget edits', () => {
    const instr = new BlueX7();
    instr.setOperatorField(2, 'outputLevel', 55);
    expect(
      instr.getParameters().find((p) => p.getName() === 'operator.3.outputLevel')!.getFixedValue(),
    ).toBe(55);
    instr.setCommonField('algorithm', 9);
    expect(
      instr.getParameters().find((p) => p.getName() === 'common.algorithm')!.getFixedValue(),
    ).toBe(9);
    instr.setSharedOscillatorSync(0);
    expect(
      instr.getParameters().find((p) => p.getName() === 'common.oscillatorKeySync')!.getFixedValue(),
    ).toBe(0);
    expect(instr.getVoice().operators.every((op) => op.sync === 0)).toBe(true);
    instr.setOperatorEnvelopePoint(4, 1, { rate: 33, level: 44 });
    expect(
      instr.getParameters().find((p) => p.getName() === 'operator.5.envelope.2.rate')!.getFixedValue(),
    ).toBe(33);
    expect(
      instr.getParameters().find((p) => p.getName() === 'operator.5.envelope.2.level')!.getFixedValue(),
    ).toBe(44);
    instr.setOperatorEnabled(0, false);
    expect(
      instr.getParameters().find((p) => p.getName() === 'operator.1.enabled')!.getFixedValue(),
    ).toBe(0);
  });

  it('preserves unknown XML content across load/save', () => {
    const instr = new BlueX7();
    const elem = Element.parse(instr.saveAsXML().toXml());
    elem.addElement('legacyEditorBookmark').setText('keep-me');

    const reloaded = BlueX7.loadFromXML(elem);
    const saved = Element.parse(reloaded.saveAsXML().toXml());
    const bookmark = saved.getElements('legacyEditorBookmark').next();
    expect(bookmark.getTextString()).toBe('keep-me');
  });
});
