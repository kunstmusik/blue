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
import {
  buildRuntimeBindingRegistry,
  syncCompiledRuntimeParameterNames,
} from './runtime-parameter-sync';

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

    const liveInstrumentChannel = data
      .getMixer()
      .getChannels()
      .find((channel) => channel.getAssociation() === '1');
    const liveAudioChannel = data
      .getMixer()
      .getAllSourceChannels()
      .find((channel) => channel.getAssociation() === layer.getUniqueId());

    expect(liveInstrumentChannel?.getLevelParameter().getCompilationVarName()).toBeNull();
    expect(liveAudioChannel?.getLevelParameter().getCompilationVarName()).toBeNull();

    const render = data.toRealtimePlaybackCSD();
    const sync = syncCompiledRuntimeParameterNames(
      data.getArrangement(),
      data.getMixer(),
      render.parameters,
    );

    expect(sync.liveCount).toBe(sync.compiledCount);
    expect(liveInstrumentChannel?.getLevelParameter().getCompilationVarName()).toMatch(
      /^gk_blue_auto\d+$/,
    );
    expect(liveAudioChannel?.getLevelParameter().getCompilationVarName()).toMatch(
      /^gk_blue_auto\d+$/,
    );
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

    for (const parameter of [
      ...arrangementInstrument.getParameters(),
      ...trackInstrument.getParameters(),
    ]) {
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

describe('buildRuntimeBindingRegistry (T044, US3)', () => {
  it('builds generation-scoped bindings for mixer, BSB, BlueX7, and automation', () => {
    const data = new BlueData();
    data.getScore().length = 0;

    // 1. Arrangement BSB
    const bsb = new BlueSynthBuilder();
    const knob = bsb.getGraphicInterface().createWidgetByType('BSBKnob') as BSBKnob;
    knob.objectName = 'cutoff';
    bsb.setInstrumentText('aout oscili 0.5, <cutoff>\nout aout');
    bsb.getGraphicInterface().getRootGroup().addChild(knob);
    data.getArrangement().addInstrument(bsb, 'ia-1');

    // 2. Track BSB
    const group = new TrackLayerGroup();
    const track = group.newLayerAt(0);
    const trackBsb = new BlueSynthBuilder();
    const trackKnob = new BSBKnob();
    trackKnob.objectName = 'reso';
    trackBsb.getGraphicInterface().getRootGroup().addChild(trackKnob);
    track.setInstrument(trackBsb);
    data.getScore().push(group);

    // 3. Compile
    const render = data.toRealtimePlaybackCSD();

    // 4. Fake BlueX7 binding
    const blueX7Binding = {
      ownerIdentity: 'arrangement:ia-2',
      runtimeInstrumentId: 2,
      parameterChannels: new Map([
        ['common:algorithm', 'gk_blue_auto99'],
        ['op1:ratio', 'gk_blue_auto100'],
      ]),
      directGlobalChannels: new Map(),
      domainEpoch: '1',
    };

    const registry = buildRuntimeBindingRegistry(data, render.parameters, [blueX7Binding]);

    // Mixer Master
    const masterLevel = registry.get('Master::level');
    expect(masterLevel).toBeDefined();
    expect(masterLevel?.kind).toBe('channel');
    if (masterLevel?.kind === 'channel') {
      expect(masterLevel.channel).toMatch(/^gk/);
    }

    // Arrangement BSB
    const cutoffParamBinding = registry.get('ia-1::bsb:cutoff');
    expect(cutoffParamBinding).toBeDefined();
    expect(cutoffParamBinding?.kind).toBe('channel');

    const cutoffWidgetBinding = registry.get(`ia-1::bsb:${knob.id}`);
    expect(cutoffWidgetBinding).toBeDefined();
    expect(cutoffWidgetBinding).toEqual(cutoffParamBinding);

    // Track BSB
    const trackKey = `track:${group.getUniqueId()}:${track.getUniqueId()}`;
    const trackParamBinding = registry.get(`${trackKey}::bsb:reso`);
    expect(trackParamBinding).toBeDefined();
    expect(trackParamBinding?.kind).toBe('channel');

    // BlueX7
    const x7Algorithm = registry.get('ia-2::bluex7:common:algorithm');
    expect(x7Algorithm).toEqual({ kind: 'channel', channel: 'gk_blue_auto99' });

    const x7Voice = registry.get('ia-2::bluex7:voice');
    expect(x7Voice).toEqual({
      kind: 'automation',
      supportsCreate: true,
      supportsUpdate: true,
      supportsDelete: true,
    });

    // Score Automation
    const autoParam = bsb.getParameters()[0]!;
    const scoreAuto = registry.get(`score::${autoParam.getUniqueId()}`);
    expect(scoreAuto).toEqual({
      kind: 'automation',
      supportsCreate: true,
      supportsUpdate: true,
      supportsDelete: true,
    });
  });
});
