import { describe, expect, it } from 'vitest';
import {
  TrackLayer,
  TrackLayerGroup,
  BlueData,
  BlueX7,
  BlueSynthBuilder,
  BSBKnob,
  GenericInstrument,
} from '@blue/data';
import { createProjectEditorSnapshot } from '../shared/project-editor';
import { syncCompiledRuntimeParameterNames } from './runtime-parameter-sync';

describe('syncCompiledRuntimeParameterNames', () => {
  it('copies compiled mixer level parameter names back to live audio-layer channels', () => {
    const data = new BlueData();
    data.getScore().length = 0;

    const instrument = new GenericInstrument();
    instrument.setName('Lead');
    instrument.setText('aout oscili 0.4, 440');
    data.getArrangement().addInstrument(instrument, '1');

    const audioGroup = new TrackLayerGroup();
    const layer = new TrackLayer();
    layer.setName('Audio A');
    audioGroup.push(layer);
    data.getScore().push(audioGroup);

    createProjectEditorSnapshot(data, '/tmp/test.blue');

    const liveInstrumentChannel = data.getMixer().getChannels().find(
      (channel) => channel.getAssociation() === '1',
    );
    const liveAudioChannel = data.getMixer().getAllSourceChannels().find(
      (channel) => channel.getAssociation() === layer.getUniqueId(),
    );

    expect(liveInstrumentChannel?.getLevelParameter().getCompilationVarName()).toBeNull();
    expect(liveAudioChannel?.getLevelParameter().getCompilationVarName()).toBeNull();

    const render = data.toRealtimePlaybackCSD();
    const sync = syncCompiledRuntimeParameterNames(
      data.getArrangement(),
      data.getMixer(),
      render.parameters,
    );

    expect(sync.liveCount).toBe(sync.compiledCount);
    expect(liveInstrumentChannel?.getLevelParameter().getCompilationVarName()).toMatch(/^gk_blue_auto\d+$/);
    expect(liveAudioChannel?.getLevelParameter().getCompilationVarName()).toMatch(/^gk_blue_auto\d+$/);
  });

  it('copies Blue Live compiled BSB parameter names back to the live instrument', () => {
    const data = new BlueData();
    const instrument = new BlueSynthBuilder();
    const knob = instrument.getGraphicInterface().createWidgetByType('BSBKnob') as BSBKnob;
    knob.objectName = 'amplitude';
    instrument.setInstrumentText('aout oscili <amplitude>, 440\nout aout');
    instrument.getGraphicInterface().getRootGroup().addChild(knob);
    data.getArrangement().addInstrument(instrument, '1');

    const liveParameter = instrument.getParameters()[0];
    expect(liveParameter?.getCompilationVarName()).toBeNull();

    const render = data.toBlueLiveCSD();
    const compiledParameters = render.parameters;
    expect(compiledParameters).toBeDefined();
    if (!compiledParameters) {
      throw new Error('Blue Live render did not return compiled parameters');
    }
    const sync = syncCompiledRuntimeParameterNames(
      data.getArrangement(),
      data.getMixer(),
      compiledParameters,
    );

    expect(sync.liveCount).toBe(sync.compiledCount);
    expect(liveParameter?.getCompilationVarName()).toBe(
      compiledParameters[0]?.getCompilationVarName(),
    );
    expect(liveParameter?.getCompilationVarName()).toMatch(/^gk_blue_auto\d+$/);
  });

  it('copies compiled parameter names back to Track-owned BSB instruments in render order', () => {
    const data = new BlueData();
    data.getScore().length = 0;
    const group = new TrackLayerGroup();
    const track = group.newLayerAt(0);
    const instrument = new BlueSynthBuilder();
    const knob = new BSBKnob();
    knob.objectName = 'gain';
    knob.automationAllowed = true;
    instrument.setInstrumentText('aout oscili <gain>, 440\nout aout');
    instrument.getGraphicInterface().getRootGroup().addChild(knob);
    track.setInstrument(instrument);
    data.getScore().push(group);

    const liveParameter = (track.getInstrument() as BlueSynthBuilder).getParameters()[0]!;
    const render = data.toRealtimePlaybackCSD();
    const sync = syncCompiledRuntimeParameterNames(
      data.getArrangement(),
      data.getMixer(),
      render.parameters,
      data.getScore(),
    );

    expect(sync.liveCount).toBe(sync.compiledCount);
    expect(liveParameter.getCompilationVarName()).toBe('gk_blue_auto0');
  });

  it('reconciles arrangement and Track BlueX7 names again after an engine rebuild', () => {
    const data = new BlueData();
    data.getScore().length = 0;
    const arrangementInstrument = new BlueX7();
    data.getArrangement().addInstrument(arrangementInstrument, '4');
    const group = new TrackLayerGroup();
    const track = group.newLayerAt(0);
    const source = new BlueX7();
    source.setEnabled(true);
    track.setInstrument(source);
    data.getScore().push(group);
    const trackInstrument = track.getInstrument() as BlueX7;

    const firstRender = data.toRealtimePlaybackCSD();
    const first = syncCompiledRuntimeParameterNames(
      data.getArrangement(),
      data.getMixer(),
      firstRender.parameters,
      data.getScore(),
    );
    expect(first.liveCount).toBe(first.compiledCount);
    expect(arrangementInstrument.getParameters()[0]!.getCompilationVarName()).toBe('gk_blue_auto0');
    expect(trackInstrument.getParameters()[0]!.getCompilationVarName()).toBe('gk_blue_auto151');

    for (const parameter of [...arrangementInstrument.getParameters(), ...trackInstrument.getParameters()]) {
      parameter.setCompilationVarName('');
    }
    const rebuilt = data.toRealtimePlaybackCSD();
    const second = syncCompiledRuntimeParameterNames(
      data.getArrangement(),
      data.getMixer(),
      rebuilt.parameters,
      data.getScore(),
    );
    expect(second.liveCount).toBe(second.compiledCount);
    expect(arrangementInstrument.getParameters()[0]!.getCompilationVarName()).toBe('gk_blue_auto0');
    expect(trackInstrument.getParameters()[0]!.getCompilationVarName()).toBe('gk_blue_auto151');
  });
});
