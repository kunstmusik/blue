import { describe, expect, it } from 'vitest';
import { Element } from './serialization/xml-reader';
import { Arrangement } from './arrangement';
import { Channel } from './mixer/channel';
import { CompileData } from './compile-data';
import { Instrument } from './instruments/instrument';
import { Parameter } from './automation/parameter';
import { Tables } from './tables';

class CompileDataInstrument extends Instrument {
  private parameters: Parameter[] = [];
  private stringChannels: Array<{ objectName: string; value: string; channelName: string }> = [];

  constructor() {
    super();
    this.setName('CompileDataInstrument');
  }

  setParameters(parameters: Parameter[]): void {
    this.parameters = parameters;
  }

  setStringChannels(channels: Array<{ objectName: string; value: string; channelName: string }>): void {
    this.stringChannels = channels;
  }

  getParameters(): Parameter[] {
    return [...this.parameters];
  }

  getStringChannels(): Array<{ objectName: string; value: string; channelName: string }> {
    return [...this.stringChannels];
  }

  override generateInstrument(): string {
    return '';
  }

  override deepCopy(): Instrument {
    const copy = new CompileDataInstrument();
    copy.parameters = this.parameters.map((param) => param.deepCopy() as Parameter);
    copy.stringChannels = this.stringChannels.map((channel) => ({ ...channel }));
    return copy;
  }

  saveAsXML(): Element {
    return new Element('instrument');
  }
}

describe('CompileData', () => {
  it('tracks source ids, channels, and open ftable numbers', () => {
    const tables = new Tables();
    tables.setTables('f 1 0 1024 10 1\nf 3 0 512 10 1');

    const compileData = new CompileData(new Arrangement(), tables, true);
    expect(compileData.getOpenFTableNumber()).toBe(2);

    const instrument = new CompileDataInstrument();
    compileData.addInstrSourceId(instrument, 'Bus');
    expect(compileData.getInstrSourceId(instrument)).toBe('Bus');

    const channel = new Channel();
    compileData.getChannelIdAssignments().set(channel, 4);
    expect(compileData.getChannelIdAssignments().get(channel)).toBe(4);

    compileData.setCompilationVariable('key', 12);
    expect(compileData.getCompilationVariable('key')).toBe(12);
    compileData.clearCompilationVariable('key');
    expect(compileData.getCompilationVariable('key')).toBeUndefined();
  });

  it('collects original parameters and string channels when enabled', () => {
    const compileData = new CompileData(new Arrangement(), new Tables(), true);
    const instrument = new CompileDataInstrument();

    const parameter = new Parameter();
    parameter.setName('gain');
    instrument.setParameters([parameter]);
    instrument.setStringChannels([
      {
        objectName: 'path',
        value: '/tmp/sample.wav',
        channelName: 'gS_blue_str0',
      },
    ]);

    compileData.addInstrument(instrument);

    expect(compileData.getOriginalParameters()).toHaveLength(1);
    expect(parameter.getCompilationVarName()).toBe('gk_blue_auto0');
    expect(compileData.getStringChannels()).toHaveLength(1);
    expect(compileData.getStringChannels()[0].channelName).toBe('gS_blue_str0');
    expect(compileData.getStringChannels()[0].value).toBe('/tmp/sample.wav');
  });

  it('continues generated names after seeding arrangement automation state', () => {
    const compileData = new CompileData(new Arrangement(), new Tables(), true);

    const seededParameter = new Parameter();
    seededParameter.setName('seeded');
    seededParameter.setCompilationVarName('gk_blue_auto0');

    compileData.registerExistingAutomationState(
      [seededParameter],
      [{ objectName: 'seededPath', value: '/tmp/seed.wav', channelName: 'gS_blue_str0' }],
    );

    const instrument = new CompileDataInstrument();
    const parameter = new Parameter();
    parameter.setName('gain');
    instrument.setParameters([parameter]);
    instrument.setStringChannels([
      {
        objectName: 'path',
        value: '/tmp/sample.wav',
        channelName: 'ignored',
      },
    ]);

    compileData.addInstrument(instrument);

    expect(parameter.getCompilationVarName()).toBe('gk_blue_auto1');
    expect(compileData.getStringChannels()[1].channelName).toBe('gS_blue_str1');
  });

  it('resets transient compile state between render invocations', () => {
    const compileData = new CompileData(new Arrangement(), new Tables(), true);
    const instrument = new CompileDataInstrument();
    const channel = new Channel();

    compileData.getChannelIdAssignments().set(channel, 3);
    compileData.setCompilationVariable('key', 42);
    compileData.addInstrSourceId(instrument, 'Bus');
    compileData.getOriginalParameters().push(new Parameter());
    compileData.getStringChannels().push({
      objectName: 'path',
      value: '/tmp/sample.wav',
      channelName: 'gS_blue_str0',
    });
    compileData.setMixerEnabled(true);

    compileData.reset();

    expect(compileData.getArrangement().size()).toBe(0);
    expect(compileData.getTables().getTables()).toBe('');
    expect(compileData.getChannelIdAssignments().size).toBe(0);
    expect(compileData.getCompilationVariable('key')).toBeUndefined();
    expect(compileData.getInstrSourceId(instrument)).toBeUndefined();
    expect(compileData.getOriginalParameters()).toHaveLength(0);
    expect(compileData.getStringChannels()).toHaveLength(0);
    expect(compileData.isMixerEnabled()).toBe(false);
  });
});
