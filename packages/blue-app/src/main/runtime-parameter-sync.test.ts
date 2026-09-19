import { describe, expect, it } from 'vitest';
import {
  TrackLayer,
  TrackLayerGroup,
  BlueData,
  BlueX7,
  BlueSynthBuilder,
  BSBCheckBox,
  BSBDropdown,
  BSBHSliderBank,
  BSBKnob,
  BSBXYController,
  Channel,
  GenericInstrument,
} from '@blue/data';
import { getMixerChannelSnapshotId } from '../shared/project-editor/identity';
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
      data.getScore(),
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
      data.getScore(),
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

  it('registers aliases for BSB XY, slider-bank, checkbox, and dropdown values', () => {
    const data = new BlueData();
    const bsb = new BlueSynthBuilder();
    const xy = new BSBXYController();
    xy.id = 'xy-widget';
    xy.objectName = 'pad';
    const bank = new BSBHSliderBank();
    bank.id = 'bank-widget';
    bank.objectName = 'mix';
    bank.numberOfSliders = 2;
    const checkbox = new BSBCheckBox();
    checkbox.id = 'gate-widget';
    checkbox.objectName = 'gate';
    const dropdown = new BSBDropdown();
    dropdown.id = 'mode-widget';
    dropdown.objectName = 'mode';
    bsb.setInstrumentText(
      'aout oscili <padX> + <padY> + <mix_0> + <mix_1> + <gate> + <mode>, 440\nout aout',
    );
    const root = bsb.getGraphicInterface().getRootGroup();
    root.addChild(xy);
    root.addChild(bank);
    root.addChild(checkbox);
    root.addChild(dropdown);
    data.getArrangement().addInstrument(bsb, 'alias-test');

    const render = data.toBlueLiveCSD();
    const registry = buildRuntimeBindingRegistry(data, render.parameters);
    const owner = 'alias-test';

    expect(registry.get(`${owner}::bsb:xy-widget:xValue`)).toEqual(
      registry.get(`${owner}::bsb:padX`),
    );
    expect(registry.get(`${owner}::bsb:xy-widget:yValue`)).toEqual(
      registry.get(`${owner}::bsb:padY`),
    );
    expect(registry.get(`${owner}::bsb:bank-widget[0]`)).toEqual(
      registry.get(`${owner}::bsb:mix_0`),
    );
    expect(registry.get(`${owner}::bsb:bank-widget[1]`)).toEqual(
      registry.get(`${owner}::bsb:mix_1`),
    );
    expect(registry.get(`${owner}::bsb:gate-widget:selected`)).toEqual(
      registry.get(`${owner}::bsb:gate`),
    );
    expect(registry.get(`${owner}::bsb:mode-widget:selectedIndex`)).toEqual(
      registry.get(`${owner}::bsb:mode`),
    );
  });
});

describe('channel pan runtime binding (Spec 112 T077)', () => {
  interface MixerFixture {
    data: BlueData;
    channelA: Channel;
    channelB: Channel;
  }

  function createMixerFixture(panningEnabled: boolean): MixerFixture {
    const data = new BlueData();
    data.getMixer().setPanningEnabled(panningEnabled);
    const mixer = data.getMixer();
    mixer.setEnabled(true);
    const channelA = new Channel();
    channelA.setName('Track 1');
    channelA.setAssociation('track-1');
    const channelB = new Channel();
    channelB.setName('Track 2');
    mixer.getChannels().push(channelA, channelB);
    return { data, channelA, channelB };
  }

  it('binds ${channelId}::pan to the compiled pan channel when panning is enabled', () => {
    const { data, channelA } = createMixerFixture(true);
    const render = data.toRealtimePlaybackCSD();
    syncCompiledRuntimeParameterNames(
      data.getArrangement(),
      data.getMixer(),
      render.parameters,
      data.getScore(),
    );
    const registry = buildRuntimeBindingRegistry(data, render.parameters);

    const expectedPanVar = channelA.getPanParameter().getCompilationVarName();
    expect(expectedPanVar).toMatch(/^gk_blue_auto\d+$/);
    // The pan binding is distinct from the volume binding and resolves to the
    // compiled pan parameter variable for every key the channel is known by.
    for (const key of ['Track 1::pan', 'track-1::pan', 'Master::pan']) {
      const binding = registry.get(key);
      expect(binding, key).toBeDefined();
      expect(binding?.kind).toBe('channel');
      if (binding?.kind === 'channel') {
        expect(binding.channel).toMatch(/^gk_blue_auto\d+$/);
      }
    }
    const levelBinding = registry.get('Track 1::level');
    const panBinding = registry.get('Track 1::pan');
    expect(panBinding).not.toEqual(levelBinding);
    if (panBinding?.kind === 'channel' && levelBinding?.kind === 'channel') {
      expect(panBinding.channel).toBe(expectedPanVar);
      expect(panBinding.channel).not.toBe(levelBinding.channel);
    }
  });

  it('registers no ::pan binding and keeps volumes aligned when panning is disabled', () => {
    const { data, channelA, channelB } = createMixerFixture(false);
    const render = data.toRealtimePlaybackCSD();
    const sync = syncCompiledRuntimeParameterNames(
      data.getArrangement(),
      data.getMixer(),
      render.parameters,
      data.getScore(),
    );
    expect(sync.liveCount).toBe(sync.compiledCount);
    const registry = buildRuntimeBindingRegistry(data, render.parameters);

    // Legacy (panning-disabled) projects expose only volume bindings.
    expect(registry.get('Track 1::pan')).toBeUndefined();
    expect(registry.get('Track 2::pan')).toBeUndefined();
    expect(registry.get('Master::pan')).toBeUndefined();

    // Positional name syncing stays aligned: each channel's volume binding
    // resolves to its own compiled variable, never a neighbor's.
    const compiledNames = new Map(
      (render.parameters ?? []).map((p) => [p.getCompilationVarName(), p.getName()]),
    );
    for (const channel of [channelA, channelB]) {
      const binding = registry.get(`${channel.getName()}::level`);
      expect(binding?.kind).toBe('channel');
      if (binding?.kind === 'channel') {
        const liveVar = channel.getLevelParameter().getCompilationVarName();
        expect(binding.channel).toBe(liveVar);
        expect(compiledNames.get(binding.channel)).toBe('Volume');
      }
    }
    expect(channelA.getLevelParameter().getCompilationVarName()).not.toBe(
      channelB.getLevelParameter().getCompilationVarName(),
    );
  });
});

describe('compiled panner binding ownership', () => {
  it.each(['timeline', 'timelineAsync', 'blueLive'] as const)(
    'keeps colliding names separate in %s',
    async (profile) => {
      const data = new BlueData();
      const instrument = new GenericInstrument();
      instrument.setText('aout init 0\nblueMixerOut aout, aout');
      data.getArrangement().addInstrument(instrument, '1');
      const source = new Channel();
      source.setAssociation('1');
      source.setName('Lead');
      data.getMixer().getChannels().push(source);
      const sub = new Channel();
      sub.setName('1');
      data.getMixer().getSubChannels().push(sub);
      const subId = getMixerChannelSnapshotId(sub);
      const render =
        profile === 'timeline'
          ? data.toRealtimePlaybackCSD()
          : profile === 'timelineAsync'
            ? await data.toRealtimePlaybackCSDAsync()
            : data.toBlueLiveCSD();
      const registry = buildRuntimeBindingRegistry(
        data,
        render.parameters,
        undefined,
        render.pannerBindings,
      );
      for (const [owner, kind] of [
        ['1', 'source'],
        [subId, 'sub'],
        ['master', 'master'],
      ] as const) {
        const binding = render.pannerBindings!.channels.find((b) => b.channelKind === kind)!;
        expect(registry.get(`${owner}::stereoPanMode`)).toEqual({
          kind: 'channel',
          channel: binding.modeChannel,
        });
      }
    },
  );

  it.each(['timeline', 'timelineAsync', 'blueLive'] as const)(
    'omits bypassed panner bindings in %s',
    async (profile) => {
      const data = new BlueData();
      data.getMixer().setEnabled(false);
      const render =
        profile === 'timeline'
          ? data.toRealtimePlaybackCSD()
          : profile === 'timelineAsync'
            ? await data.toRealtimePlaybackCSDAsync()
            : data.toBlueLiveCSD();
      const registry = buildRuntimeBindingRegistry(
        data,
        render.parameters,
        undefined,
        render.pannerBindings,
      );
      expect(render.csdText).not.toContain('gk_blue_score_pan_law chnexport');
      expect(render.pannerBindings).toBeUndefined();
      expect(registry.has('mixer::panLawDb')).toBe(false);
      expect(registry.has('mixer::panOffCenterBoost')).toBe(false);
      expect([...registry.keys()].some((key) => key.endsWith('::stereoPanMode'))).toBe(false);
    },
  );
});
