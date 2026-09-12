import { describe, expect, it } from 'vitest';
import {
  BlueData,
  Channel,
  Effect,
  Send,
  TrackLayerGroup,
  ScoreTrack,
  PolyObject,
  AudioClip,
  GenericInstrument,
  BlueSynthBuilder,
  BSBKnob,
  BSBDropdown,
  Parameter,
  Preset,
  PresetGroup,
} from '@blue/data';
import {
  getArrangementInstrumentOwnerIdentity,
  getTrackInstrumentOwnerIdentity,
  assignMixerSnapshotId,
  getMixerChannelSnapshotId,
  assignExplicitMixerChannelSnapshotId,
  getKnownMixerChannelSnapshotId,
  getMixerEntrySnapshotId,
  assignExplicitMixerEntrySnapshotId,
  getKnownMixerEntrySnapshotId,
  assignLayerSelectionId,
  assignExplicitLayerSelectionId,
  getLayerSelectionId,
  assignPatternLayerId,
  assignExplicitPatternLayerId,
  getPatternLayerId,
  assignLayerGroupId,
  assignExplicitLayerGroupId,
  getLayerGroupId,
  assignScoreObjectId,
  assignExplicitScoreObjectId,
  getScoreObjectId,
  assignParameterSnapshotId,
  assignExplicitParameterSnapshotId,
  getParameterSnapshotId,
  assignBsbWidgetSnapshotId,
  assignExplicitBsbWidgetSnapshotId,
  getBsbWidgetSnapshotId,
  assignPresetSnapshotId,
  assignExplicitPresetSnapshotId,
  getPresetSnapshotId,
  assignDropdownLinkSnapshotId,
  assignExplicitDropdownLinkSnapshotId,
  getDropdownLinkSnapshotId,
  assignLibraryReferenceSnapshotId,
  assignExplicitLibraryReferenceSnapshotId,
  getLibraryReferenceSnapshotId,
  transferProjectEditorIdentities,
} from './identity';

describe('project-editor identity sidecars and transfer mappings', () => {
  describe('owner identities', () => {
    it('formats arrangement instrument owner identity', () => {
      expect(getArrangementInstrumentOwnerIdentity('inst-1')).toBe('arrangement:inst-1');
    });

    it('formats track instrument owner identity', () => {
      expect(getTrackInstrumentOwnerIdentity('root-1', 'trk-2')).toBe('track:root-1:trk-2');
    });
  });

  describe('mixer snapshot identities', () => {
    it('identifies master and associated channels deterministically', () => {
      const master = new Channel();
      master.setName('Master');
      expect(getMixerChannelSnapshotId(master)).toBe('master');

      const assoc = new Channel();
      assoc.setName('Sub');
      assoc.setAssociation('sub-assoc-42');
      expect(getMixerChannelSnapshotId(assoc)).toBe('sub-assoc-42');
    });

    it('assigns and preserves mixer channel snapshot IDs', () => {
      const channel = new Channel();
      channel.setName('Audio 1');
      const id1 = getMixerChannelSnapshotId(channel, 'preferred-ch-1');
      expect(id1).toBe('preferred-ch-1');
      expect(getMixerChannelSnapshotId(channel)).toBe('preferred-ch-1');
      expect(getKnownMixerChannelSnapshotId(channel)).toBe('preferred-ch-1');

      assignExplicitMixerChannelSnapshotId(channel, 'explicit-ch-1');
      expect(getKnownMixerChannelSnapshotId(channel)).toBe('explicit-ch-1');
    });

    it('assigns and preserves mixer entry snapshot IDs for effects and sends', () => {
      const effect = new Effect();
      const send = new Send();

      const effId = getMixerEntrySnapshotId(effect, 'custom-eff-1');
      expect(effId).toBe('custom-eff-1');
      expect(getKnownMixerEntrySnapshotId(effect)).toBe('custom-eff-1');

      const sendId = getMixerEntrySnapshotId(send);
      expect(sendId).toMatch(/^mixer-send-\d+$/);
      expect(getKnownMixerEntrySnapshotId(send)).toBe(sendId);

      assignExplicitMixerEntrySnapshotId(send, 'explicit-send-1');
      expect(getKnownMixerEntrySnapshotId(send)).toBe('explicit-send-1');
    });
  });

  describe('score and layer identities', () => {
    it('assigns, retrieves, and explicitly overrides score object IDs', () => {
      const obj = new AudioClip();
      const id = assignScoreObjectId(obj, 'aclp');
      expect(id).toMatch(/^aclp-\d+$/);
      expect(getScoreObjectId(obj)).toBe(id);

      assignExplicitScoreObjectId(obj, 'custom-aclp-99');
      expect(getScoreObjectId(obj)).toBe('custom-aclp-99');
    });

    it('assigns, retrieves, and explicitly overrides layer group IDs', () => {
      const group = new TrackLayerGroup();
      const id = assignLayerGroupId(group);
      expect(id).toMatch(/^lg-\d+$/);
      expect(getLayerGroupId(group)).toBe(id);

      assignExplicitLayerGroupId(group, 'custom-lg-42');
      expect(getLayerGroupId(group)).toBe('custom-lg-42');
    });

    it('assigns, retrieves, and explicitly overrides pattern layer IDs', () => {
      const layer = {};
      const id = assignPatternLayerId(layer);
      expect(id).toMatch(/^pl-\d+$/);
      expect(getPatternLayerId(layer)).toBe(id);

      assignExplicitPatternLayerId(layer, 'custom-pl-7');
      expect(getPatternLayerId(layer)).toBe('custom-pl-7');
    });

    it('assigns, retrieves, and explicitly overrides layer selection IDs', () => {
      const layer = {};
      const id = assignLayerSelectionId(layer);
      expect(id).toMatch(/^lsel-\d+$/);
      expect(getLayerSelectionId(layer)).toBe(id);

      assignExplicitLayerSelectionId(layer, 'custom-lsel-10');
      expect(getLayerSelectionId(layer)).toBe('custom-lsel-10');
    });
  });

  describe('non-XML sidecar maps: parameters, BSB widgets, presets, dropdown links, library references', () => {
    it('handles parameter sidecars', () => {
      const param = new Parameter();
      expect(getParameterSnapshotId(param)).toBeUndefined();
      const id = assignParameterSnapshotId(param, 'p-sidecar-1');
      expect(id).toBe('p-sidecar-1');
      expect(getParameterSnapshotId(param)).toBe('p-sidecar-1');

      assignExplicitParameterSnapshotId(param, 'p-sidecar-override');
      expect(getParameterSnapshotId(param)).toBe('p-sidecar-override');
    });

    it('handles BSB widget sidecars', () => {
      const widget = new BSBKnob();
      expect(getBsbWidgetSnapshotId(widget)).toBeUndefined();
      const id = assignBsbWidgetSnapshotId(widget, 'w-sidecar-1');
      expect(id).toBe('w-sidecar-1');
      expect(getBsbWidgetSnapshotId(widget)).toBe('w-sidecar-1');

      assignExplicitBsbWidgetSnapshotId(widget, 'w-sidecar-override');
      expect(getBsbWidgetSnapshotId(widget)).toBe('w-sidecar-override');
    });

    it('handles preset sidecars', () => {
      const preset = new Preset();
      expect(getPresetSnapshotId(preset)).toBeUndefined();
      const id = assignPresetSnapshotId(preset, 'preset-sidecar-1');
      expect(id).toBe('preset-sidecar-1');
      expect(getPresetSnapshotId(preset)).toBe('preset-sidecar-1');

      assignExplicitPresetSnapshotId(preset, 'preset-sidecar-override');
      expect(getPresetSnapshotId(preset)).toBe('preset-sidecar-override');
    });

    it('handles dropdown link sidecars', () => {
      const item = { name: 'Choice 1', value: 'c1', uniqueId: 'u1' };
      expect(getDropdownLinkSnapshotId(item)).toBeUndefined();
      const id = assignDropdownLinkSnapshotId(item, 'dd-link-1');
      expect(id).toBe('dd-link-1');
      expect(getDropdownLinkSnapshotId(item)).toBe('dd-link-1');

      assignExplicitDropdownLinkSnapshotId(item, 'dd-link-override');
      expect(getDropdownLinkSnapshotId(item)).toBe('dd-link-override');
    });

    it('handles library reference sidecars', () => {
      const ref = new PolyObject();
      expect(getLibraryReferenceSnapshotId(ref)).toBeUndefined();
      const id = assignLibraryReferenceSnapshotId(ref, 'lib-ref-1');
      expect(id).toBe('lib-ref-1');
      expect(getLibraryReferenceSnapshotId(ref)).toBe('lib-ref-1');

      assignExplicitLibraryReferenceSnapshotId(ref, 'lib-ref-override');
      expect(getLibraryReferenceSnapshotId(ref)).toBe('lib-ref-override');
    });
  });

  describe('transferProjectEditorIdentities', () => {
    function buildProjectWithIdentities(): {
      project: BlueData;
      track: ScoreTrack;
      clip: AudioClip;
      bsb: BlueSynthBuilder;
      knob: BSBKnob;
      dropdown: BSBDropdown;
      preset: Preset;
      channel: Channel;
      send: Send;
      effect: Effect;
      effParam: Parameter;
      libObj: PolyObject;
    } {
      const project = new BlueData();

      // 1. Score with TrackLayerGroup and Track
      project.getScore().length = 0;
      const tlg = new TrackLayerGroup();
      assignExplicitLayerGroupId(tlg, 'tlg-sidecar-1');
      project.getScore().push(tlg);

      const track = tlg.newLayerAt(0);
      assignExplicitLayerSelectionId(track, 'track-lsel-1');

      const clip = new AudioClip();
      track.push(clip);
      assignExplicitScoreObjectId(clip, 'clip-sidecar-1');

      // Instrument on track: BlueSynthBuilder
      track.setInstrument(new BlueSynthBuilder());
      const bsb = track.getInstrument() as BlueSynthBuilder;
      const knob = new BSBKnob();
      knob.id = 'knob1';
      assignExplicitBsbWidgetSnapshotId(knob, 'knob-sidecar-1');
      bsb.getGraphicInterface().rootGroup.addChild(knob);

      const dropdown = new BSBDropdown();
      dropdown.id = 'dd1';
      dropdown.dropdownItems = [
        { name: 'Option 1', value: 'opt1', uniqueId: 'dd-u1' },
        { name: 'Option 2', value: 'opt2', uniqueId: 'dd-u2' },
      ];
      assignExplicitDropdownLinkSnapshotId(dropdown.dropdownItems[0], 'dd-item-0-sidecar');
      assignExplicitDropdownLinkSnapshotId(dropdown.dropdownItems[1], 'dd-item-1-sidecar');
      bsb.getGraphicInterface().rootGroup.addChild(dropdown);

      const presetGroup = new PresetGroup();
      bsb.setPresetGroup(presetGroup);
      const preset = new Preset();
      preset.setPresetName('Preset 1');
      assignExplicitPresetSnapshotId(preset, 'preset-sidecar-1');
      presetGroup.presets.push(preset);

      // 2. Mixer
      const channel = new Channel();
      channel.setName('Audio 1');
      assignExplicitMixerChannelSnapshotId(channel, 'ch-sidecar-1');
      project.getMixer().getChannels().push(channel);

      const send = new Send();
      assignExplicitMixerEntrySnapshotId(send, 'send-sidecar-1');
      channel.getEffectsChain().push(send);

      const effect = new Effect();
      assignExplicitMixerEntrySnapshotId(effect, 'effect-sidecar-1');
      const effParam = new Parameter();
      effParam.setName('Cutoff');
      assignExplicitParameterSnapshotId(effParam, 'param-sidecar-1');
      effect.addParameter(effParam);
      project.getMixer().getMaster().getEffectsChain().push(effect);

      // 3. Library
      const libObj = new PolyObject();
      assignExplicitLibraryReferenceSnapshotId(libObj, 'lib-obj-sidecar-1');
      project.getSoundObjectLibrary().addObject(libObj);

      return {
        project,
        track,
        clip,
        bsb,
        knob,
        dropdown,
        preset,
        channel,
        send,
        effect,
        effParam,
        libObj,
      };
    }

    it('transfers all non-XML sidecars to a historyCopy clone', () => {
      const original = buildProjectWithIdentities();
      const copy = original.project.historyCopy();

      // Verify separate instances before transfer
      expect(copy).not.toBe(original.project);
      expect(copy.getScore()[0]).not.toBe(original.project.getScore()[0]);

      // Before transfer, copy objects have NO sidecars
      const copyTlg = copy.getScore()[0] as TrackLayerGroup;
      const copyTrack = copyTlg[0];
      const copyClip = copyTrack[0];
      expect(getLayerGroupId(copyTlg)).toBeUndefined();
      expect(getLayerSelectionId(copyTrack)).toBeUndefined();
      expect(getScoreObjectId(copyClip)).toBeUndefined();

      // Transfer identities
      const mapping = transferProjectEditorIdentities(original.project, copy);
      expect(mapping.transferredCount).toBeGreaterThan(0);

      // Verify sidecars transferred
      expect(getLayerGroupId(copyTlg)).toBe('tlg-sidecar-1');
      expect(getLayerSelectionId(copyTrack)).toBe('track-lsel-1');
      expect(getScoreObjectId(copyClip)).toBe('clip-sidecar-1');

      // Verify BSB widgets, dropdown links, and presets transferred
      const copyBsb = copyTrack.getInstrument() as BlueSynthBuilder;
      const copyWidgets = copyBsb.getGraphicInterface().rootGroup.getChildren();
      const copyKnob = copyWidgets.find((w) => w.id === 'knob1') as BSBKnob;
      expect(getBsbWidgetSnapshotId(copyKnob)).toBe('knob-sidecar-1');

      const copyDropdown = copyWidgets.find((w) => w.id === 'dd1') as BSBDropdown;
      expect(getDropdownLinkSnapshotId(copyDropdown.dropdownItems[0])).toBe('dd-item-0-sidecar');
      expect(getDropdownLinkSnapshotId(copyDropdown.dropdownItems[1])).toBe('dd-item-1-sidecar');

      const copyPreset = copyBsb.getPresetGroup().presets[0];
      expect(getPresetSnapshotId(copyPreset)).toBe('preset-sidecar-1');

      // Verify mixer channel, send, effect, and effect parameter sidecars transferred
      const copyChannel = copy.getMixer().getChannels()[0];
      expect(getKnownMixerChannelSnapshotId(copyChannel)).toBe('ch-sidecar-1');

      const copySend = copyChannel.getEffectsChain()[0] as Send;
      expect(getKnownMixerEntrySnapshotId(copySend)).toBe('send-sidecar-1');

      const copyEffect = copy.getMixer().getMaster().getEffectsChain()[0] as Effect;
      expect(getKnownMixerEntrySnapshotId(copyEffect)).toBe('effect-sidecar-1');
      expect(getParameterSnapshotId(copyEffect.getParameters()[0])).toBe('param-sidecar-1');

      // Verify library reference sidecar transferred
      const copyLibObj = copy.getSoundObjectLibrary().getAllObjects()[0];
      expect(getLibraryReferenceSnapshotId(copyLibObj)).toBe('lib-obj-sidecar-1');

      // Verify bidirectional reference mapping
      expect(mapping.sourceToTarget.get(original.clip)).toBe(copyClip);
      expect(mapping.targetToSource.get(copyClip)).toBe(original.clip);
      expect(mapping.sourceToTarget.get(original.knob)).toBe(copyKnob);
      expect(mapping.targetToSource.get(copyKnob)).toBe(original.knob);
    });

    it('survives round-trip replay through multiple history copies without leaking aliases', () => {
      const state0 = buildProjectWithIdentities();
      const state1 = state0.project.historyCopy();
      transferProjectEditorIdentities(state0.project, state1);

      // Replay / restore to state2
      const state2 = state1.historyCopy();
      transferProjectEditorIdentities(state1, state2);

      const state2Tlg = state2.getScore()[0] as TrackLayerGroup;
      const state2Track = state2Tlg[0];
      const state2Clip = state2Track[0];
      expect(getScoreObjectId(state2Clip)).toBe('clip-sidecar-1');
      expect(getLayerGroupId(state2Tlg)).toBe('tlg-sidecar-1');

      // Verify memory isolation between all three generations
      expect(state2Clip).not.toBe(state1.getScore()[0][0][0]);
      expect(state2Clip).not.toBe(state0.clip);
    });

    it('preserves canonical meter presentation settings and unchanged channel identities through copy and identity transfer (T036)', () => {
      const project = new BlueData();
      project.getMixer().setEnableMeters(false);
      project.getMixer().setMeterProfileKey('k14-rms-peak');

      const ch = new Channel();
      ch.setName('Audio 1');
      assignExplicitMixerChannelSnapshotId(ch, 'ch-explicit-42');
      const send = new Send();
      assignExplicitMixerEntrySnapshotId(send, 'send-explicit-99');
      ch.getEffectsChain().push(send);
      project.getMixer().getChannels().push(ch);

      // 1. History copy & deepCopy preserve presentation values
      const copy = project.historyCopy();
      expect(copy.getMixer().isEnableMeters()).toBe(false);
      expect(copy.getMixer().getMeterProfileKey()).toBe('k14-rms-peak');

      // 2. Transfer identities retains stable channel IDs
      transferProjectEditorIdentities(project, copy);
      const copyCh = copy.getMixer().getChannels()[0];
      expect(getKnownMixerChannelSnapshotId(copyCh)).toBe('ch-explicit-42');
      expect(getKnownMixerEntrySnapshotId(copyCh.getEffectsChain()[0])).toBe('send-explicit-99');

      // 3. Mutating presentation on copy does not affect original or channel identities
      copy.getMixer().setEnableMeters(true);
      copy.getMixer().setMeterProfileKey('k20-rms-peak');

      expect(project.getMixer().isEnableMeters()).toBe(false);
      expect(project.getMixer().getMeterProfileKey()).toBe('k14-rms-peak');
      expect(getKnownMixerChannelSnapshotId(ch)).toBe('ch-explicit-42');
      expect(getKnownMixerChannelSnapshotId(copyCh)).toBe('ch-explicit-42');
    });
  });
});
