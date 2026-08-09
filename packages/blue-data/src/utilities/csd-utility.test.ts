import { describe, test, expect } from 'vitest';
import {
  getTextBetweenTags,
  convertCSDtoBlue,
  convertOrcScoToBlue,
  parseCsOrc,
  parseCsScore,
  CSDImportMode,
} from './csd-utility';
import { BlueData } from '../blue-data';
import { GenericInstrument } from '../instruments/generic-instrument';
import { PolyObject } from '../sound-objects/poly-object';
import { GenericScore } from '../sound-objects/generic-score';

describe('CSDUtility', () => {
  describe('getTextBetweenTags', () => {
    test('extracts content between matching tags', () => {
      const input = '<CsInstruments>\n  instr 1\n  endin\n</CsInstruments>';
      expect(getTextBetweenTags('CsInstruments', input)).toBe(
        '\n  instr 1\n  endin\n',
      );
    });

    test('returns null if start tag is missing', () => {
      expect(getTextBetweenTags('CsInstruments', 'instr 1\nendin')).toBeNull();
    });

    test('returns null if end tag is missing', () => {
      expect(
        getTextBetweenTags('CsInstruments', '<CsInstruments>instr 1'),
      ).toBeNull();
    });
  });

  describe('parseCsOrc', () => {
    test('parses header settings sr, kr, ksmps, nchnls', () => {
      const data = new BlueData();
      const orc = `
sr = 48000
kr = 4800
nchnls = 2
ksmps = 10
`;
      parseCsOrc(data, orc);
      expect(data.getProjectProperties().sampleRate).toBe('48000');
      expect(data.getScore().getTimeContext().getSampleRate()).toBe(48000);
      expect(data.getProjectProperties().channels).toBe('2');
      expect(data.getProjectProperties().ksmps).toBe('10');
    });

    test('calculates ksmps from sr and kr if ksmps is omitted', () => {
      const data = new BlueData();
      const orc = `
sr = 44100
kr = 4410
`;
      parseCsOrc(data, orc);
      expect(data.getProjectProperties().sampleRate).toBe('44100');
      expect(data.getProjectProperties().ksmps).toBe('10');
    });

    test('parses single instrument with comment name', () => {
      const data = new BlueData();
      const orc = `
instr 1 ; Sine Synth
  aOut oscili 0.5, 440
endin
`;
      parseCsOrc(data, orc);
      const arr = data.getArrangement();
      expect(arr.size()).toBe(1);

      const instr = arr.getInstrumentById('1') as GenericInstrument;
      expect(instr).toBeDefined();
      expect(instr.getName()).toBe('Sine Synth');
      expect(instr.getText()).toBe('  aOut oscili 0.5, 440\n');
    });

    test('parses multiple instrument IDs comma-separated', () => {
      const data = new BlueData();
      const orc = `
instr 1, 2, 3
  aOut oscili 0.1, 440
endin
`;
      parseCsOrc(data, orc);
      const arr = data.getArrangement();
      expect(arr.size()).toBe(3);
      expect(arr.getInstrumentById('1')).toBeDefined();
      expect(arr.getInstrumentById('2')).toBeDefined();
      expect(arr.getInstrumentById('3')).toBeDefined();
    });

    test('parses classic and modern UDOs into OpcodeList', () => {
      const data = new BlueData();
      const orc = `
opcode myAdd, i, ii
  i1, i2 xin
  xout i1 + i2
endop

opcode mySub(i1, i2) : i
  xout i1 - i2
endop
`;
      parseCsOrc(data, orc);
      const opcodes = data.getOpcodeList();
      expect(opcodes.size()).toBe(2);

      const udo1 = opcodes.getOpcode(0);
      expect(udo1?.getName()).toBe('myAdd');

      const udo2 = opcodes.getOpcode(1);
      expect(udo2?.getName()).toBe('mySub');
    });

    test('recovers from broken modern UDO header boundary', () => {
      const data = new BlueData();
      const orc = `
opcode broken(aSig)
instr 1
  aOut oscili 0.1, 440
endin
`;
      parseCsOrc(data, orc);
      expect(data.getOpcodeList().size()).toBe(0);
      const arr = data.getArrangement();
      expect(arr.size()).toBe(1);
      const instr = arr.getInstrumentById('1') as GenericInstrument;
      expect(instr).toBeDefined();
      expect(instr.getText()).toBe('  aOut oscili 0.1, 440\n');
    });

    test('accumulates global orchestra code', () => {
      const data = new BlueData();
      const orc = `
giGlobal = 100
gaBus init 0
`;
      parseCsOrc(data, orc);
      expect(data.getGlobalOrcSco().getGlobalOrc()).toContain('giGlobal = 100');
      expect(data.getGlobalOrcSco().getGlobalOrc()).toContain('gaBus init 0');
    });
  });

  describe('parseCsScore', () => {
    test('parses f-tables including continuation lines', () => {
      const data = new BlueData();
      const sco = `
f1 0 10 1
 f2 0 10 .5 .3 .1
i1 0 2 3 4 5
`;
      parseCsScore(data, sco, CSDImportMode.IMPORT_GLOBAL);
      expect(data.getTableSet().getTables()).toBe(
        'f1 0 10 1\n f2 0 10 .5 .3 .1\n',
      );
    });

    test('parses multiline score i-statements and continuation lines', () => {
      const data = new BlueData();
      const score1 =
        'i1 0 2 3 4 5\n6 7 8 9\n8.8 8\ni1 2 3 4 5\ni1 2 3 4 5\n"test" 1 2 3 4 5\n';
      const score2 = 'f1 0 3 4\n   5 6 7\n';
      const score = score1 + score2;

      parseCsScore(data, score, CSDImportMode.IMPORT_GLOBAL);

      expect(data.getGlobalOrcSco().getGlobalSco()).toBe(score1);
      expect(data.getTableSet().getTables()).toBe(score2);
    });

    test('parses tempo t statements into TempoMap', () => {
      const data = new BlueData();
      const sco = 't 0 60 4 120\ni1 0 2';

      parseCsScore(data, sco, CSDImportMode.IMPORT_GLOBAL);

      const tempoMap = data.getScore().getTimeContext().getTempoMap();
      expect(tempoMap.size()).toBe(2);
      expect(tempoMap.getTempoPoint(0).tempo).toBe(60);
      expect(tempoMap.getTempoPoint(1).tempo).toBe(120);
      expect(tempoMap.getTempoPoint(1).beat).toBe(4);
    });

    test('rejects invalid tempo values', () => {
      const data = new BlueData();

      expect(() =>
        parseCsScore(
          data,
          't bad 120\ni1 0 2',
          CSDImportMode.IMPORT_GLOBAL,
        ),
      ).toThrow('Invalid tempo statement found');
    });

    test('importMode: IMPORT_GLOBAL', () => {
      const data = new BlueData();
      const sco = 'i1 0 2 100\ni2 2 4 200';

      parseCsScore(data, sco, CSDImportMode.IMPORT_GLOBAL);

      expect(data.getGlobalOrcSco().getGlobalSco()).toBe(
        'i1 0 2 100\ni2 2 4 200\n',
      );
    });

    test('importMode: IMPORT_SINGLE_SOUNDOBJECT per section', () => {
      const data = new BlueData();
      const sco = 'i1 0 2 100\ns\ni2 0 4 200';

      parseCsScore(data, sco, CSDImportMode.IMPORT_SINGLE_SOUNDOBJECT);

      const rootPoly = data.getScore()[0] as PolyObject;
      expect(rootPoly.length).toBe(2);

      const layer1 = rootPoly[0];
      expect(layer1.length).toBe(1);
      const sObj1 = layer1[0] as GenericScore;
      expect(sObj1.getScoreText()).toContain('i1 0 2 100');

      const layer2 = rootPoly[1];
      expect(layer2.length).toBe(1);
      const sObj2 = layer2[0] as GenericScore;
      expect(sObj2.getScoreText()).toContain('i2 0 4 200');
    });

    test('importMode: IMPORT_SOUNDOBJECT_PER_INSTRUMENT', () => {
      const data = new BlueData();
      const sco = 'i1 0 2 100\ni2 0 4 200\ni1 2 2 105';

      parseCsScore(data, sco, CSDImportMode.IMPORT_SOUNDOBJECT_PER_INSTRUMENT);

      const rootPoly = data.getScore()[0] as PolyObject;
      expect(rootPoly.length).toBe(2);

      const layer1 = rootPoly[0];
      const sObj1 = layer1[0] as GenericScore;
      expect(sObj1.getName()).toBe('Instrument 1');

      const layer2 = rootPoly[1];
      const sObj2 = layer2[0] as GenericScore;
      expect(sObj2.getName()).toBe('Instrument 2');
    });
  });

  describe('convertCSDtoBlue', () => {
    test('converts full CSD string to BlueData', () => {
      const csd = `
<CsoundSynthesizer>
<CsInstruments>
sr = 44100
kr = 4410
nchnls = 2

instr 1 ; Simple Sine
  aOut oscili 0.2, 440
  outc aOut, aOut
endin
</CsInstruments>
<CsScore>
f1 0 1024 10 1
i1 0 5
</CsScore>
</CsoundSynthesizer>
`;
      const data = convertCSDtoBlue(csd, CSDImportMode.IMPORT_GLOBAL);

      expect(data.getProjectProperties().sampleRate).toBe('44100');
      expect(data.getArrangement().size()).toBe(1);
      expect(data.getTableSet().getTables()).toBe('f1 0 1024 10 1\n');
      expect(data.getGlobalOrcSco().getGlobalSco()).toBe('i1 0 5\n');
    });
  });

  describe('convertOrcScoToBlue', () => {
    test('converts ORC and SCO files to BlueData', () => {
      const orc = `
instr 1
  aOut oscili 0.1, 880
endin
`;
      const sco = 'i1 0 4';

      const data = convertOrcScoToBlue(
        orc,
        sco,
        CSDImportMode.IMPORT_SINGLE_SOUNDOBJECT,
      );

      expect(data.getArrangement().size()).toBe(1);
      const rootPoly = data.getScore()[0] as PolyObject;
      expect(rootPoly.length).toBe(1);
      const sObj = rootPoly[0][0] as GenericScore;
      expect(sObj.getScoreText()).toContain('i1 0 4');
    });
  });
});
