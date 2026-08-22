import { describe, expect, it } from 'vitest';
import { BlueData } from '../../blue-data';
import { BlueSynthBuilder } from '../../instruments/blue-synth-builder';
import { OpcodeDefinition } from '../../opcodes/opcode-definition';
import { OpcodeList } from '../../opcodes/opcode-list';
import { UDOStyle } from '../../opcodes/udo-style';
import { createTrackFixture } from './track-test-fixtures';

function createUdo(name: string, code: string): OpcodeDefinition {
  const udo = new OpcodeDefinition();
  udo.setName(name);
  udo.setStyle(UDOStyle.CLASSIC);
  udo.setOutTypes('a');
  udo.setInTypes('a');
  udo.setCode(code);
  return udo;
}

function createInstrumentWithDependentUdos(): BlueSynthBuilder {
  const instrument = new BlueSynthBuilder();
  instrument.setName('UDO Instrument');
  instrument.setInstrumentText('aout trackWrapper 1\nouts aout, aout');

  const udos = new OpcodeList();
  udos.addOpcode(createUdo('sharedOpcode', 'ain xin\nxout ain * 0.5'));
  udos.addOpcode(createUdo('trackWrapper', 'ain xin\naout sharedOpcode ain\nxout aout'));
  instrument.setOpcodeList(udos);
  return instrument;
}

function addCollidingProjectUdo(data: BlueData): void {
  data.getOpcodeList().addOpcode(createUdo('sharedOpcode', 'ain xin\nxout ain'));
}

function expectOrderedUdoGeneration(csd: string): void {
  const projectUdo = csd.indexOf('opcode sharedOpcode');
  const renamedTrackUdo = csd.indexOf('opcode uniqueUDO0');
  const dependentTrackUdo = csd.indexOf('opcode trackWrapper');
  const instrument = csd.indexOf(';UDO Instrument');

  expect(projectUdo).toBeGreaterThanOrEqual(0);
  expect(renamedTrackUdo).toBeGreaterThan(projectUdo);
  expect(dependentTrackUdo).toBeGreaterThan(renamedTrackUdo);
  expect(instrument).toBeGreaterThan(dependentTrackUdo);
  expect(csd).toContain('aout uniqueUDO0 ain');
  expect(csd).toContain('aout trackWrapper 1');
}

describe('Track instrument UDO CSD generation', () => {
  it('matches Arrangement UDO collection, collision rewriting, and generation order', async () => {
    const arrangementData = new BlueData();
    addCollidingProjectUdo(arrangementData);
    arrangementData.getArrangement().addInstrumentWithId(createInstrumentWithDependentUdos(), '1');

    const trackFixture = createTrackFixture({ includeClip: false });
    addCollidingProjectUdo(trackFixture.data);
    trackFixture.track.setInstrument(createInstrumentWithDependentUdos());

    expectOrderedUdoGeneration(arrangementData.toCSD());
    expectOrderedUdoGeneration(trackFixture.data.toCSD());
    expectOrderedUdoGeneration(await trackFixture.data.toCSDAsync());
  });
});
