import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { Element } from '../serialization/xml-reader';
import { Tables } from '../tables';
import {
  BlueX7,
  createDefaultBlueX7Voice,
  generateBlueX7Preview,
  generateBlueX7InstrumentBody,
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
    const instr = BlueX7.loadFromXML(elem);

    expect(instr.getName()).toBe('untitled');
    expect(instr.getVoice().common.algorithm).toBe(19);
    expect(instr.getVoice().common.keyTranspose).toBe(24);
    expect(instr.getVoice().common.feedback).toBe(6);
    expect(instr.getVoice().lfo.speed).toBe(35);
    expect(instr.getVoice().operators[0].envelope[0]).toEqual({ rate: 81, level: 99 });

    const savedElem = instr.saveAsXML();
    const reloaded = BlueX7.loadFromXML(savedElem);
    expect(reloaded.getVoice()).toEqual(instr.getVoice());
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

  it('allocates 11 static tables once and 6 operator tables per BlueX7 instance', () => {
    const tables = new Tables();

    const instr1 = new BlueX7();
    instr1.setName('Lead');
    instr1.generateFTables(tables);

    const tablesText1 = tables.getTables();
    expect(tablesText1).toContain('; [BLUEX7] - START STATIC TABLES; sine wave');
    expect(tablesText1).toContain('; [BLUEX7] - END STATIC TABLES');
    expect(tablesText1).toContain('; FTABLES FOR BLUEX7 INSTRUMENT: Lead');
    expect(instr1.operatorTableNums).toEqual([12, 13, 14, 15, 16, 17]);

    const instr2 = new BlueX7();
    instr2.setName('Bass');
    instr2.generateFTables(tables);

    const tablesText2 = tables.getTables();
    // Static tables not duplicated
    const staticCount = (tablesText2.match(/; \[BLUEX7\] - START STATIC TABLES/g) || []).length;
    expect(staticCount).toBe(1);
    expect(tablesText2).toContain('; FTABLES FOR BLUEX7 INSTRUMENT: Bass');
    expect(instr2.operatorTableNums).toEqual([18, 19, 20, 21, 22, 23]);
  });

  it('generates Csound instrument body with p-field substitutions, out rewrite, and post-code for algorithm 1, 19, and 32', () => {
    for (const alg of [1, 19, 32]) {
      const voice = createDefaultBlueX7Voice();
      voice.common.algorithm = alg;
      voice.common.feedback = 5;
      voice.csoundPostCode = 'outs aout * 0.8, aout * 0.8';

      const preview = generateBlueX7Preview(voice, `Alg_${alg}`);
      expect(preview.tables).toContain('; [BLUEX7] - START STATIC TABLES');
      expect(preview.tables).toContain(`; FTABLES FOR BLUEX7 INSTRUMENT: Alg_${alg}`);
      expect(preview.body).toContain('idur \t= abs(p3) \np3 = p3 + 4');
      expect(preview.body).toContain('(p4 < 15 ? cpspch(p4) : p4)');
      expect(preview.body).toContain('aout =');
      expect(preview.body).toContain('outs aout * 0.8, aout * 0.8');
    }

    const report = getBlueX7BindingReport();
    expect(report.emitted).toContain('common.algorithm (selects ORC topology template)');
    expect(report.emitted).toContain('csoundPostCode (appended verbatim to instrument body)');
    expect(report.notEmitted).toContain('common.keyTranspose (stored in XML; not referenced in Pinkston ORC)');
    expect(report.notEmitted).toContain('lfo (speed, delay, PMD, AMD, wave, sync stored in XML; not in Pinkston ORC)');
  });

  it('renames the Java resource label that became reserved in Csound 7', () => {
    const voice = createDefaultBlueX7Voice();
    const body = generateBlueX7Preview(voice).body;

    expect(body).toContain('igoto continue_');
    expect(body).toContain('continue_:');
    expect(body).not.toContain('igoto continue\n');
    expect(body).not.toContain('\ncontinue:\n');
  });

  it('substitutes only the first occurrence of each token, matching Java TextUtilities.replace semantics', () => {
    // Java Blue's TextUtilities.replace performs a single indexOf-based
    // replacement. Tokens "p12" and "p25" each occur twice in the extracted
    // ORC body: once in code and once inside the identifier "imap128" or the
    // trailing comment ";0 <= p25 <= 7". Java replaces only the code
    // occurrence; the TS port must not rename identifiers or rewrite
    // comments.
    const voice = createDefaultBlueX7Voice();
    voice.common.algorithm = 19;
    voice.common.feedback = 5;

    const body = generateBlueX7InstrumentBody(
      voice,
      {
        sineTable: 1,
        outputAmpTable: 2,
        rateScaleTable: 3,
        egRateRiseLvlTable: 4,
        egRateRisePercentageTable: 5,
        egRateDecayLvlTable: 6,
        egRateDecayPercentageTable: 7,
        egLevelPeakTable: 8,
        velAmpTable: 9,
        velSensitivityTable: 10,
        feedbackScaleTable: 11,
      },
      [12, 13, 14, 15, 16, 17],
    );

    // "p12" inside the imap128 identifier must survive untouched
    expect(body).toContain('imap128');
    expect(body).not.toMatch(/ima1[0-9]+8\s*=/);
    // the feedback value must not be substituted into the trailing comment
    expect(body).toContain(';0 <= p25 <= 7 (feedbk)');
    expect(body).not.toContain(';0 <= 5 <= 7');
    // the code occurrence of p25 IS substituted with the feedback value
    expect(body).toMatch(/ifeed\s+table\s+5,ifeedfn/);
  });

  it('returns an empty instrument body for out-of-range algorithms, matching Java resource-load failure', () => {
    const voice = createDefaultBlueX7Voice();
    voice.common.algorithm = 40;

    const body = generateBlueX7InstrumentBody(
      voice,
      {
        sineTable: 1,
        outputAmpTable: 2,
        rateScaleTable: 3,
        egRateRiseLvlTable: 4,
        egRateRisePercentageTable: 5,
        egRateDecayLvlTable: 6,
        egRateDecayPercentageTable: 7,
        egLevelPeakTable: 8,
        velAmpTable: 9,
        velSensitivityTable: 10,
        feedbackScaleTable: 11,
      },
      [12, 13, 14, 15, 16, 17],
    );

    expect(body).toBe('');
  });
});
