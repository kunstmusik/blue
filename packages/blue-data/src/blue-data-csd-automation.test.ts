import { describe, expect, it } from 'vitest';
import { BlueData } from './blue-data';
import { Arrangement } from './arrangement';
import { GenericInstrument } from './instruments/generic-instrument';
import { Parameter } from './automation/parameter';
import { Element } from './serialization/xml-reader';
import { Channel } from './mixer/channel';
import { ChannelList } from './mixer/channel-list';

class AutomationFixtureInstrument extends GenericInstrument {
  private readonly parameters: Parameter[];

  constructor(parameters: Parameter[]) {
    super();
    this.parameters = parameters;
  }

  getParameters(): Parameter[] {
    return [...this.parameters];
  }

  override deepCopy(): GenericInstrument {
    const copy = new AutomationFixtureInstrument(
      this.parameters.map((parameter) => parameter.deepCopy() as Parameter),
    );
    copy.setName(this.getName());
    copy.setText(this.getText());
    copy.setGlobalOrc(this.getGlobalOrc() ?? '');
    copy.setGlobalSco(this.getGlobalSco() ?? '');
    return copy;
  }

  override saveAsXML(): Element {
    return super.saveAsXML();
  }
}

describe('BlueData automation render parity', () => {
  it('initializes a grouped Track channel gain from its updated level', () => {
    const data = new BlueData();
    const trackChannels = new ChannelList();
    const trackChannel = new Channel();
    trackChannel.setAssociation('track-1');
    trackChannel.setLevel(-18);
    trackChannels.push(trackChannel);
    data.getMixer().getChannelListGroups().push(trackChannels);

    const csd = data.toCSD();

    expect(csd).toContain('gk_blue_auto0 init -18');
  });

  it('assigns deterministic compilation variables and render-start init values', () => {
    const data = new BlueData();
    data.setRenderStartTime(4);

    const automated = new Parameter();
    automated.setName('gain');
    automated.setAutomationEnabled(true);
    automated.addPoint(0, 0.2);
    automated.addPoint(8, 0.8);

    const fixed = new Parameter();
    fixed.setName('cutoff');
    fixed.setFixedValue(0.75);

    const instrument = new AutomationFixtureInstrument([automated, fixed]);
    instrument.setName('Auto');
    instrument.setText('aout oscili 0.1, 440\nblueMixerOut aout, aout');

    const arrangement = new Arrangement();
    arrangement.addInstrument(instrument, '1');
    data.setArrangement(arrangement);

    const csd = data.toCSD();

    expect(csd).toContain('gk_blue_auto0 init 0.5');
    expect(csd).toContain('gk_blue_auto0 chnexport "gk_blue_auto0", 3');
    expect(csd).toContain('gk_blue_auto1 init 0.75');
    expect(csd).toContain('gk_blue_auto1 chnexport "gk_blue_auto1", 3');
  });
});
