import * as fs from 'fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { BlueData } from './blue-data';
import { Arrangement } from './arrangement';
import { GenericInstrument } from './instruments/generic-instrument';
import { BlueSynthBuilder } from './instruments/blue-synth-builder';
import { OpcodeDefinition } from './opcodes/opcode-definition';
import { OpcodeList } from './opcodes/opcode-list';
import { UDOStyle } from './opcodes/udo-style';
import { Tables } from './tables';
import { CurveType } from './time/curve-type';
import { TempoMap } from './time/tempo-map';
import {
  getTempoScore,
  preprocessSco,
  processCommandBlocks,
} from './utilities/csd-render';
import {
  DEMO2026_BLUE_PATH,
  DEMO2026_CSD_PATH,
  hasDemo2026Fixture,
} from './test-support/csd-render-fixtures';
import {
  extractInstrumentSequence,
  extractScoreEvents,
  normalizeWhitespace,
} from './test-support/csd-comparison';
import { initializeJavaScriptRuntime } from './javascript-runtime';

beforeAll(async () => {
  await initializeJavaScriptRuntime();
});

class FtgenAllocationInstrument extends GenericInstrument {
  override generateFTables(tables: unknown): void {
    if (!(tables instanceof Tables)) {
      return;
    }

    const tableNum = tables.getOpenFTableNumber();
    const current = tables.getTables();
    const nextLine = `f ${tableNum} 0 64 10 1`;
    tables.setTables(current ? `${current}\n${nextLine}` : nextLine);
  }

  override deepCopy(): GenericInstrument {
    const copy = new FtgenAllocationInstrument();
    copy.setName(this.getName());
    copy.setText(this.getText());
    copy.setGlobalOrc(this.getGlobalOrc());
    copy.setGlobalSco(this.getGlobalSco());
    return copy;
  }
}

function createBsbInstrumentWithUdo(
  name: string,
  gain: number,
): BlueSynthBuilder {
  const instrument = new BlueSynthBuilder();
  instrument.setName(name);
  instrument.setInstrumentText(
    `ain oscili 0.1, 440\n` +
      `aout fx ain\n` +
      `blueMixerOut aout, aout`,
  );

  const opcode = new OpcodeDefinition();
  opcode.setName('fx');
  opcode.setStyle(UDOStyle.CLASSIC);
  opcode.setOutTypes('a');
  opcode.setInTypes('a');
  opcode.setCode(`ain xin\nxout ain * ${gain}`);

  const opcodes = new OpcodeList();
  opcodes.addOpcode(opcode);
  instrument.setOpcodeList(opcodes);

  return instrument;
}

function createGenericInstrumentWithUdo(name: string): GenericInstrument {
  const instrument = new GenericInstrument();
  instrument.setName(name);
  instrument.setText(
    'ain oscili 0.1, 440\n'
      + 'aout declick ain\n'
      + 'blueMixerOut aout, aout',
  );

  const opcode = new OpcodeDefinition();
  opcode.setName('declick');
  opcode.setStyle(UDOStyle.CLASSIC);
  opcode.setOutTypes('a');
  opcode.setInTypes('a');
  opcode.setCode('ain xin\nxout ain * 0.5');

  const opcodes = new OpcodeList();
  opcodes.addOpcode(opcode);
  instrument.setOpcodeList(opcodes);

  return instrument;
}

describe('CSD render helpers', () => {
  it('processes pre and once command blocks like Java', () => {
    const output = processCommandBlocks([
      'alpha',
      ';[pre]{',
      'beta',
      ';}',
      'gamma',
      ';[once]{',
      'delta',
      ';}',
      ';[once]{',
      'delta',
      ';}',
    ].join('\n'));

    expect(output).toBe(['beta', 'alpha', 'gamma', 'delta', ''].join('\n'));
  });

  it('substitutes render macros and absolute render start time', () => {
    const tempoMap = new TempoMap();
    tempoMap.setEnabled(true);
    tempoMap.setTempoPoint(0, 0, 120, CurveType.CONSTANT);

    expect(
      preprocessSco(
        '<TOTAL_DUR>|<PROCESSING_START>|<RENDER_START>|<RENDER_START_ABSOLUTE>',
        12.5,
        3,
        4,
        tempoMap,
      ),
    ).toBe('12.5|4.0|3.0|1.5');
  });

  it('renders tempo score boundaries the same way as Java', () => {
    const tempoMap = new TempoMap();
    tempoMap.setEnabled(true);
    tempoMap.setTempoPoint(0, 0, 120, CurveType.CONSTANT);
    tempoMap.setTempoPoint(1, 4, 90, CurveType.CONSTANT);

    expect(getTempoScore(tempoMap, 0, 6)).toBe('t 0 120.0 4.0 120.0 4.0 90.0 6.0 90.0\n');
  });
});

describe('BlueData UDO/table parity', () => {
  it('includes generic instrument UDOs in generated csd', () => {
    const data = new BlueData();
    const arrangement = new Arrangement();

    arrangement.addInstrument(createGenericInstrumentWithUdo('Generic'), '1');
    data.setArrangement(arrangement);

    const csd = data.toCSD();

    expect(csd).toContain('opcode declick,a,a');
    expect(csd).toContain('aout declick ain');
    expect(csd).toContain('xout ain * 0.5');
  });

  it('renames colliding UDOs and rewrites instrument references', () => {
    const data = new BlueData();
    const arrangement = new Arrangement();

    arrangement.addInstrument(createBsbInstrumentWithUdo('A', 0.5), '1');
    arrangement.addInstrument(createBsbInstrumentWithUdo('B', 0.25), '2');
    data.setArrangement(arrangement);

    const csd = data.toCSD();

    const uniqueMatch = csd.match(/opcode\s+(uniqueUDO\d+),a,a/);
    expect(uniqueMatch).not.toBeNull();

    const renamedOpcode = uniqueMatch![1];
    expect(csd).toContain('opcode fx,a,a');
    expect(csd).toContain(`aout ${renamedOpcode} ain`);
    expect(csd).toContain('xout ain * 0.5');
    expect(csd).toContain('xout ain * 0.25');
  });

  it('reserves ftgen numbers from global orc before allocating table ids', () => {
    const data = new BlueData();
    data.getGlobalOrcSco().setGlobalOrc('gi_reserved ftgen 1, 0, 1024, 10, 1');

    const arrangement = new Arrangement();
    const tableInstrument = new FtgenAllocationInstrument();
    tableInstrument.setName('Table Builder');
    tableInstrument.setText('aout oscili 0.1, 440\nblueMixerOut aout, aout');
    arrangement.addInstrument(tableInstrument, '1');
    data.setArrangement(arrangement);

    const csd = data.toCSD();
    const scoreSection = csd.match(/<CsScore>([\s\S]*?)<\/CsScore>/)?.[1] ?? '';

    expect(scoreSection).toContain('f 2 0 64 10 1');
    expect(scoreSection).not.toContain('f 1 0 64 10 1');
  });
});

describe.skipIf(!hasDemo2026Fixture())('Demo2026 CSD parity', () => {
  let generatedScoreEvents: string[] = [];
  let referenceScoreEvents: string[] = [];

  beforeAll(async () => {
    const xml = fs.readFileSync(DEMO2026_BLUE_PATH, 'utf-8');
    const data = await BlueData.loadFromString(xml);
    const generatedCsd = data.toCSD();
    const referenceCsd = fs.readFileSync(DEMO2026_CSD_PATH, 'utf-8');

    generatedScoreEvents = extractScoreEvents(generatedCsd);
    referenceScoreEvents = extractScoreEvents(referenceCsd);
  });

  it('matches the Java score event instrument ordering', () => {
    expect(extractInstrumentSequence(generatedScoreEvents)).toEqual(
      extractInstrumentSequence(referenceScoreEvents),
    );
  });

  it('matches the Java always-on event durations', () => {
    expect(generatedScoreEvents.slice(-6).map(normalizeWhitespace)).toEqual(
      referenceScoreEvents.slice(-6).map(normalizeWhitespace),
    );
  });
});
