import { describe, expect, it } from 'vitest';
import { Element } from './serialization/xml-reader';
import { Arrangement } from './arrangement';
import { Channel } from './mixer/channel';
import { BLUE_X7_BINDINGS_KEY, CompileData } from './compile-data';
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

describe('CompiledBlueX7Binding registry (Spec 092)', () => {
  function makeBinding(ownerIdentity: string, runtimeInstrumentId: string | number) {
    return {
      ownerIdentity,
      runtimeInstrumentId,
      parameterChannels: new Map([
        [`param-${ownerIdentity}-a`, 'gk_blue_auto0'],
        [`param-${ownerIdentity}-b`, 'gk_blue_auto1'],
      ]),
      holdChannel: `gk_blue_x7_hold_${ownerIdentity}`,
      commitChannel: `gk_blue_x7_commit_${ownerIdentity}`,
      transportTableIds: [100, 101] as const,
    };
  }

  it('registers and resolves bindings by stable owner identity', () => {
    const cd = new CompileData();
    cd.registerBlueX7Binding(makeBinding('arrangement:1', '1'));
    cd.registerBlueX7Binding(makeBinding('track:g1:t1', 2));

    expect(cd.getBlueX7Binding('arrangement:1')?.runtimeInstrumentId).toBe('1');
    expect(cd.getBlueX7Binding('track:g1:t1')?.runtimeInstrumentId).toBe(2);
    expect(cd.getBlueX7Binding('missing')).toBeUndefined();
  });

  it('resolves Parameter-ID channel lookups per owner', () => {
    const cd = new CompileData();
    cd.registerBlueX7Binding(makeBinding('arrangement:1', '1'));
    cd.registerBlueX7Binding(makeBinding('arrangement:2', '2'));

    const first = cd.getBlueX7Binding('arrangement:1')!;
    expect(first.parameterChannels.get('param-arrangement:1-a')).toBe('gk_blue_auto0');
    expect(first.parameterChannels.get('param-arrangement:2-a')).toBeUndefined();
    const second = cd.getBlueX7Binding('arrangement:2')!;
    expect(second.parameterChannels.get('param-arrangement:2-a')).toBe('gk_blue_auto0');
  });

  it('gives each owner distinct hold/commit controls and replaces only its own binding', () => {
    const cd = new CompileData();
    cd.registerBlueX7Binding(makeBinding('arrangement:1', '1'));
    cd.registerBlueX7Binding(makeBinding('arrangement:2', '2'));

    const first = cd.getBlueX7Binding('arrangement:1')!;
    const second = cd.getBlueX7Binding('arrangement:2')!;
    expect(first.holdChannel).not.toBe(second.holdChannel);
    expect(first.commitChannel).not.toBe(second.commitChannel);
    expect(first.holdChannel).not.toBe(first.commitChannel);

    const rebuilt = makeBinding('arrangement:1', '9');
    cd.registerBlueX7Binding(rebuilt);
    expect(cd.getBlueX7Binding('arrangement:1')?.runtimeInstrumentId).toBe('9');
    expect(cd.getBlueX7Binding('arrangement:2')?.runtimeInstrumentId).toBe('2');
    expect(cd.getBlueX7Bindings()).toHaveLength(2);
  });

  it('keeps bindings render-scoped: fresh CompileData and reset() invalidate them', () => {
    const cd = new CompileData();
    cd.registerBlueX7Binding(makeBinding('arrangement:1', '1'));
    expect(cd.getBlueX7Binding('arrangement:1')).toBeDefined();

    cd.reset();
    expect(cd.getBlueX7Binding('arrangement:1')).toBeUndefined();
    expect(cd.getBlueX7Bindings()).toHaveLength(0);

    const fresh = new CompileData();
    expect(fresh.getBlueX7Binding('arrangement:1')).toBeUndefined();
  });

  it('does not leak bindings into persisted XML or runtime-global state', () => {
    const cd = new CompileData();
    cd.registerBlueX7Binding(makeBinding('arrangement:1', '1'));
    expect(cd.getCompilationVariable(BLUE_X7_BINDINGS_KEY)).toBeInstanceOf(Map);
    // a second CompileData never observes another render's registry
    const other = new CompileData();
    other.registerBlueX7Binding(makeBinding('arrangement:1', '2'));
    expect(cd.getBlueX7Binding('arrangement:1')?.runtimeInstrumentId).toBe('1');
    expect(other.getBlueX7Binding('arrangement:1')?.runtimeInstrumentId).toBe('2');
  });
});
