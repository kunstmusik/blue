import { describe, expect, it } from 'vitest';
import { BlueData } from './blue-data';
import { Arrangement } from './arrangement';
import { GenericInstrument } from './instruments/generic-instrument';
import { Parameter } from './automation/parameter';
import { Element } from './serialization/xml-reader';
import { Channel } from './mixer/channel';
import { ChannelList } from './mixer/channel-list';
import { BlueX7 } from './instruments/blue-x7';
import { TrackLayerGroup } from './score/track/track-layer-group';
import {
  appendParameterScoreJava,
  getParameterInstrumentTextJava,
} from './automation/csd-parameter-automation';

function blueX7Parameter(instrument: BlueX7, semanticKey: string): Parameter {
  const parameter = instrument
    .getParameters()
    .find((candidate) => candidate.getName() === semanticKey);
  if (!parameter) throw new Error(`Missing BlueX7 parameter: ${semanticKey}`);
  return parameter;
}

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

  it('renders integer BlueX7 automation from a nonzero start with a fixed fallback', () => {
    const data = new BlueData();
    data.setRenderStartTime(4);
    const instrument = new BlueX7();
    data.getArrangement().addInstrument(instrument, '7');

    const algorithm = blueX7Parameter(instrument, 'common.algorithm');
    algorithm.setAutomationEnabled(true);
    algorithm.setPoints([
      { time: 0, value: 1 },
      { time: 8, value: 9 },
    ]);
    const feedback = blueX7Parameter(instrument, 'common.feedback');
    feedback.setFixedValue(6);

    const render = data.toRealtimePlaybackCSD();
    const binding = render.blueX7Bindings.find(
      (candidate) => candidate.ownerIdentity === 'arrangement:7',
    );
    expect(binding).toBeDefined();
    const algorithmChannel = binding!.parameterChannels.get('common.algorithm');
    const feedbackChannel = binding!.parameterChannels.get('common.feedback');
    expect(algorithmChannel).toBeDefined();
    expect(feedbackChannel).toBeDefined();
    expect(render.csdText).toContain(`${algorithmChannel} init 5`);
    expect(render.csdText).toContain(`${feedbackChannel} init 6`);
    expect(getParameterInstrumentTextJava(algorithmChannel!, algorithm.getResolution())).toBe(
      `${algorithmChannel} init p4\nturnoff`,
    );
    const score = appendParameterScoreJava({
      parameter: algorithm,
      instrumentId: 99,
      renderStart: 4,
      renderEnd: -1,
    });
    const automatedValues = [...score.matchAll(/i\d+\s+[\d.]+\s+\.0001\s+([\d.-]+)/g)].map(
      (match) => Number(match[1]),
    );
    expect(automatedValues.length).toBeGreaterThan(0);
    expect(automatedValues.every(Number.isInteger)).toBe(true);
    expect(score).toContain('i99\t1\t.0001\t6');
  });

  it('compiles Track-owned BlueX7 automation under the stable Track owner identity', () => {
    const data = new BlueData();
    data.getScore().length = 0;
    const group = new TrackLayerGroup();
    group.setUniqueId('group-automation');
    const track = group.newLayerAt(0);
    track.setUniqueId('track-automation');
    const source = new BlueX7();
    source.setEnabled(true);
    track.setInstrument(source);
    data.getScore().push(group);

    const instrument = track.getInstrument() as BlueX7;
    const parameter = blueX7Parameter(instrument, 'lfo.wave');
    parameter.setAutomationEnabled(true);
    parameter.setPoints([
      { time: 0, value: 0 },
      { time: 5, value: 5 },
    ]);

    const render = data.toRealtimePlaybackCSD();
    const binding = render.blueX7Bindings.find(
      (candidate) => candidate.ownerIdentity === 'track:group-automation:track-automation',
    );
    expect(binding?.parameterChannels.get('lfo.wave')).toMatch(/^gk_blue_auto\d+$/);
    expect(binding?.parameterChannels.size).toBe(151);
  });
});
