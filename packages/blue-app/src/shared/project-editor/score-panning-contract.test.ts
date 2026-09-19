import { describe, expect, it } from 'vitest';
import {
  BlueData,
  Channel,
  ScoreTrack,
  TrackLayerGroup,
  AudioClip,
  Effect,
  Send,
  createAudioLayoutManifest,
} from '@blue/data';
import { createMixerSnapshot, createEmptyMixerSnapshot } from './snapshot-mixer-orchestra';
import { applyMixerPatchToData } from './patch-mixer-bluelive';
import { validateProjectDocumentPatch, classifyProjectDocumentPatch } from './patch-document';
import { MIXER_PATCH_PREPARATION_CLASS, type MixerPatch } from './contract';

describe('mixer-panning-contract (T029, T032, T045, T047)', () => {
  it('exposes panningEnabled on MixerSnapshot and defaults empty to true', () => {
    const data = new BlueData();
    const snap = createMixerSnapshot(data.getMixer(), data.getScore());
    expect(snap.panningEnabled).toBe(true);

    const emptySnap = createEmptyMixerSnapshot();
    expect(emptySnap.panningEnabled).toBe(true);

    data.getMixer().setPanningEnabled(false);
    const disabledSnap = createMixerSnapshot(data.getMixer(), data.getScore());
    expect(disabledSnap.panningEnabled).toBe(false);
  });

  it('applies updateMixerPanning patch to BlueData.getMixer()', () => {
    const data = new BlueData();
    expect(data.getMixer().isPanningEnabled()).toBe(true);

    // Toggling to false
    const patchFalse: MixerPatch = { type: 'updateMixerPanning', panningEnabled: false };
    const changed1 = applyMixerPatchToData(data, patchFalse);
    expect(changed1).toBe(true);
    expect(data.getMixer().isPanningEnabled()).toBe(false);

    // Idempotent application returns false
    const changedNoop = applyMixerPatchToData(data, patchFalse);
    expect(changedNoop).toBe(false);

    // Toggling back to true
    const patchTrue: MixerPatch = { type: 'updateMixerPanning', panningEnabled: true };
    const changed2 = applyMixerPatchToData(data, patchTrue);
    expect(changed2).toBe(true);
    expect(data.getMixer().isPanningEnabled()).toBe(true);
  });

  it('classifies updateMixerPanning as structural in MIXER_PATCH_PREPARATION_CLASS', () => {
    expect(MIXER_PATCH_PREPARATION_CLASS.updateMixerPanning).toBe('structural');

    const classification = classifyProjectDocumentPatch({
      mixer: { type: 'updateMixerPanning', panningEnabled: false },
    });
    expect(classification).toBe('structural');
  });

  it('validates mixer panningEnabled is a boolean', () => {
    const valid = validateProjectDocumentPatch({
      mixer: { type: 'updateMixerPanning', panningEnabled: true },
    });
    expect(valid.valid).toBe(true);

    const invalid = validateProjectDocumentPatch({
      mixer: { type: 'updateMixerPanning', panningEnabled: 'true' as unknown as boolean },
    });
    expect(invalid.valid).toBe(false);
    expect(invalid.reason).toContain('Mixer panningEnabled must be a boolean');
  });

  it('validates channel pan is finite in [0, 1]', () => {
    const validCenter = validateProjectDocumentPatch({
      mixer: { type: 'updateChannel', channelId: 'c1', patch: { pan: 0.5 } },
    });
    expect(validCenter.valid).toBe(true);

    const validZero = validateProjectDocumentPatch({
      mixer: { type: 'updateChannel', channelId: 'c1', patch: { pan: 0 } },
    });
    expect(validZero.valid).toBe(true);

    const validOne = validateProjectDocumentPatch({
      mixer: { type: 'updateChannel', channelId: 'c1', patch: { pan: 1 } },
    });
    expect(validOne.valid).toBe(true);

    const invalidNegative = validateProjectDocumentPatch({
      mixer: { type: 'updateChannel', channelId: 'c1', patch: { pan: -0.1 } },
    });
    expect(invalidNegative.valid).toBe(false);
    expect(invalidNegative.reason).toContain('finite number between 0 and 1');

    const invalidOver = validateProjectDocumentPatch({
      mixer: { type: 'updateChannel', channelId: 'c1', patch: { pan: 1.05 } },
    });
    expect(invalidOver.valid).toBe(false);

    const invalidNaN = validateProjectDocumentPatch({
      mixer: { type: 'updateChannel', channelId: 'c1', patch: { pan: NaN } },
    });
    expect(invalidNaN.valid).toBe(false);
  });

  it('derives positionMode on mixer channels', () => {
    const data = new BlueData();
    const mixer = data.getMixer();
    const score = data.getScore();

    // Add subchannel and verify it has positionMode='balance'
    const subCh = new Channel();
    subCh.setName('Sub1');
    mixer.getSubChannels().push(subCh);

    const snapshot = createMixerSnapshot(mixer, score);
    expect(snapshot.master.positionMode).toBe('balance');

    expect(snapshot.subChannels[0]?.positionMode).toBe('balance');

    // Track with verified mono clip
    const trackGroup = new TrackLayerGroup();
    const track = new ScoreTrack();
    track.setUniqueId('track-mono');
    const clip = new AudioClip();
    clip.setAudioFile('/audio/mono.wav');
    track.push(clip);
    trackGroup.push(track);
    score.push(trackGroup);

    const ch = new Channel();
    ch.setName('MonoChan');
    ch.setAssociation('track-mono');
    mixer.getChannels().push(ch);

    const manifest = createAudioLayoutManifest([
      ['/audio/mono.wav', { filePath: '/audio/mono.wav', channels: 1, status: 'verified' }],
    ]);

    const snapWithManifest = createMixerSnapshot(mixer, score, manifest);
    const monoChSnap = snapWithManifest.channels.find((c) => c.name === 'MonoChan');
    expect(monoChSnap?.positionMode).toBe('pan');
  });

  it('ignores sends and disabled effects when classifying the source layout', () => {
    const data = new BlueData();
    const score = data.getScore();
    const mixer = data.getMixer();
    const group = new TrackLayerGroup();
    const track = new ScoreTrack();
    track.setUniqueId('track-mono-with-send');
    const clip = new AudioClip();
    clip.setAudioFile('/audio/mono.wav');
    track.push(clip);
    group.push(track);
    score.push(group);

    const channel = new Channel();
    channel.setName('Mono with Send');
    channel.setAssociation('track-mono-with-send');
    const disabledEffect = new Effect();
    disabledEffect.setEnabled(false);
    const send = new Send();
    send.setEnabled(true);
    channel.getPostEffects().push(disabledEffect, send);
    mixer.getChannels().push(channel);

    const manifest = createAudioLayoutManifest([
      ['/audio/mono.wav', { filePath: '/audio/mono.wav', channels: 1, status: 'verified' }],
    ]);
    const snapshot = createMixerSnapshot(mixer, score, manifest);
    expect(snapshot.channels[0]?.positionMode).toBe('pan');
  });

  it('exposes panLawDb and panOffCenterBoost on MixerSnapshot and defaults properly', () => {
    const data = new BlueData();
    const snap = createMixerSnapshot(data.getMixer(), data.getScore());
    expect(snap.panLawDb).toBe(-3);
    expect(snap.panOffCenterBoost).toBe(false);

    const emptySnap = createEmptyMixerSnapshot();
    expect(emptySnap.panLawDb).toBe(-3);
    expect(emptySnap.panOffCenterBoost).toBe(false);

    data.getMixer().setPanLawDb(-6);
    data.getMixer().setPanOffCenterBoost(true);
    const customSnap = createMixerSnapshot(data.getMixer(), data.getScore());
    expect(customSnap.panLawDb).toBe(-6);
    expect(customSnap.panOffCenterBoost).toBe(true);
  });

  it('applies updateMixerPanLaw and updateMixerPanBoost patches to BlueData.getMixer()', () => {
    const data = new BlueData();
    expect(data.getMixer().getPanLawDb()).toBe(-3);
    expect(data.getMixer().isPanOffCenterBoost()).toBe(false);

    const patchLaw: MixerPatch = { type: 'updateMixerPanLaw', panLawDb: -4.5 };
    const changed1 = applyMixerPatchToData(data, patchLaw);
    expect(changed1).toBe(true);
    expect(data.getMixer().getPanLawDb()).toBe(-4.5);

    const patchBoost: MixerPatch = { type: 'updateMixerPanBoost', panOffCenterBoost: true };
    const changed2 = applyMixerPatchToData(data, patchBoost);
    expect(changed2).toBe(true);
    expect(data.getMixer().isPanOffCenterBoost()).toBe(true);
  });

  it('validates mixer panLawDb and panOffCenterBoost', () => {
    expect(
      validateProjectDocumentPatch({ mixer: { type: 'updateMixerPanLaw', panLawDb: 0 } }).valid,
    ).toBe(true);
    expect(
      validateProjectDocumentPatch({ mixer: { type: 'updateMixerPanLaw', panLawDb: -3 } }).valid,
    ).toBe(true);
    expect(
      validateProjectDocumentPatch({ mixer: { type: 'updateMixerPanLaw', panLawDb: -4.5 } }).valid,
    ).toBe(true);
    expect(
      validateProjectDocumentPatch({ mixer: { type: 'updateMixerPanLaw', panLawDb: -6 } }).valid,
    ).toBe(true);
    expect(
      validateProjectDocumentPatch({ mixer: { type: 'updateMixerPanLaw', panLawDb: -5 as never } })
        .valid,
    ).toBe(false);

    expect(
      validateProjectDocumentPatch({
        mixer: { type: 'updateMixerPanBoost', panOffCenterBoost: true },
      }).valid,
    ).toBe(true);
    expect(
      validateProjectDocumentPatch({
        mixer: { type: 'updateMixerPanBoost', panOffCenterBoost: 'true' as never },
      }).valid,
    ).toBe(false);
  });

  it('exposes stereoPanMode, panWidth, dualPanLeft, dualPanRight on MixerChannelSnapshot and defaults correctly', () => {
    const data = new BlueData();
    const ch = new Channel();
    ch.setName('Stereo1');
    data.getMixer().getChannels().push(ch);

    const snap = createMixerSnapshot(data.getMixer(), data.getScore());
    const channelSnap = snap.channels[0]!;
    expect(channelSnap.stereoPanMode).toBe('balance');
    expect(channelSnap.panWidth).toBe(1.0);
    expect(channelSnap.dualPanLeft).toBe(0.0);
    expect(channelSnap.dualPanRight).toBe(1.0);
  });

  it('validates channel stereo pan mode and scalar fields', () => {
    expect(
      validateProjectDocumentPatch({
        mixer: { type: 'updateChannel', channelId: 'c1', patch: { stereoPanMode: 'stereoPan' } },
      }).valid,
    ).toBe(true);
    expect(
      validateProjectDocumentPatch({
        mixer: { type: 'updateChannel', channelId: 'c1', patch: { stereoPanMode: 'dualPan' } },
      }).valid,
    ).toBe(true);
    expect(
      validateProjectDocumentPatch({
        mixer: {
          type: 'updateChannel',
          channelId: 'c1',
          patch: { stereoPanMode: 'invalid' as never },
        },
      }).valid,
    ).toBe(false);

    expect(
      validateProjectDocumentPatch({
        mixer: { type: 'updateChannel', channelId: 'c1', patch: { panWidth: 0.5 } },
      }).valid,
    ).toBe(true);
    expect(
      validateProjectDocumentPatch({
        mixer: { type: 'updateChannel', channelId: 'c1', patch: { panWidth: -0.1 } },
      }).valid,
    ).toBe(false);
    expect(
      validateProjectDocumentPatch({
        mixer: { type: 'updateChannel', channelId: 'c1', patch: { panWidth: 1.1 } },
      }).valid,
    ).toBe(false);

    expect(
      validateProjectDocumentPatch({
        mixer: { type: 'updateChannel', channelId: 'c1', patch: { dualPanLeft: 0.2 } },
      }).valid,
    ).toBe(true);
    expect(
      validateProjectDocumentPatch({
        mixer: { type: 'updateChannel', channelId: 'c1', patch: { dualPanRight: 0.8 } },
      }).valid,
    ).toBe(true);
    expect(
      validateProjectDocumentPatch({
        mixer: { type: 'updateChannel', channelId: 'c1', patch: { dualPanLeft: NaN } },
      }).valid,
    ).toBe(false);
  });
});
