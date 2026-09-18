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
import { createScoreDocumentSnapshot, createEmptyScoreDocumentSnapshot } from './snapshot-score';
import { createMixerSnapshot, createEmptyMixerSnapshot } from './snapshot-mixer-orchestra';
import {
  applyScoreObjectPatch,
  isNonEmptyScorePatch,
  scorePatchTouchesMixerAudioChannels,
} from './patch-score';
import { validateProjectDocumentPatch, classifyProjectDocumentPatch } from './patch-document';
import { SCORE_PATCH_PREPARATION_CLASS, type ScorePatch } from './contract';

describe('score-panning-contract (T029, T032, T045, T047)', () => {
  it('exposes panningEnabled on ScoreDocumentSnapshot and defaults empty to true', () => {
    const data = new BlueData();
    const snap = createScoreDocumentSnapshot(data);
    expect(snap.panningEnabled).toBe(true);

    const emptySnap = createEmptyScoreDocumentSnapshot();
    expect(emptySnap.panningEnabled).toBe(true);

    data.getScore().panningEnabled = false;
    const disabledSnap = createScoreDocumentSnapshot(data);
    expect(disabledSnap.panningEnabled).toBe(false);
  });

  it('applies updateScorePanning patch to BlueData.getScore()', () => {
    const data = new BlueData();
    expect(data.getScore().panningEnabled).toBe(true);

    // Toggling to false
    const patchFalse: ScorePatch = { type: 'updateScorePanning', panningEnabled: false };
    const changed1 = applyScoreObjectPatch(data, patchFalse);
    expect(changed1).toBe(true);
    expect(data.getScore().panningEnabled).toBe(false);

    // Idempotent application returns false
    const changedNoop = applyScoreObjectPatch(data, patchFalse);
    expect(changedNoop).toBe(false);

    // Toggling back to true
    const patchTrue: ScorePatch = { type: 'updateScorePanning', panningEnabled: true };
    const changed2 = applyScoreObjectPatch(data, patchTrue);
    expect(changed2).toBe(true);
    expect(data.getScore().panningEnabled).toBe(true);
  });

  it('classifies updateScorePanning as structural in SCORE_PATCH_PREPARATION_CLASS', () => {
    expect(SCORE_PATCH_PREPARATION_CLASS.updateScorePanning).toBe('structural');

    const classification = classifyProjectDocumentPatch({
      score: { type: 'updateScorePanning', panningEnabled: false },
    });
    expect(classification).toBe('structural');
  });

  it('treats updateScorePanning as touching mixer audio channels', () => {
    expect(
      scorePatchTouchesMixerAudioChannels({
        type: 'updateScorePanning',
        panningEnabled: true,
      }),
    ).toBe(true);
  });

  it('validates score panningEnabled is a boolean', () => {
    const valid = validateProjectDocumentPatch({
      score: { type: 'updateScorePanning', panningEnabled: true },
    });
    expect(valid.valid).toBe(true);

    const invalid = validateProjectDocumentPatch({
      score: { type: 'updateScorePanning', panningEnabled: 'true' as unknown as boolean },
    });
    expect(invalid.valid).toBe(false);
    expect(invalid.reason).toContain('Score panningEnabled must be a boolean');
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

  it('exposes panLawDb and panOffCenterBoost on ScoreDocumentSnapshot and defaults properly', () => {
    const data = new BlueData();
    const snap = createScoreDocumentSnapshot(data);
    expect(snap.panLawDb).toBe(-3);
    expect(snap.panOffCenterBoost).toBe(false);

    const emptySnap = createEmptyScoreDocumentSnapshot();
    expect(emptySnap.panLawDb).toBe(-3);
    expect(emptySnap.panOffCenterBoost).toBe(false);

    data.getScore().panLawDb = -6;
    data.getScore().panOffCenterBoost = true;
    const customSnap = createScoreDocumentSnapshot(data);
    expect(customSnap.panLawDb).toBe(-6);
    expect(customSnap.panOffCenterBoost).toBe(true);
  });

  it('applies updateScorePanLaw and updateScorePanBoost patches to BlueData.getScore()', () => {
    const data = new BlueData();
    expect(data.getScore().panLawDb).toBe(-3);
    expect(data.getScore().panOffCenterBoost).toBe(false);

    const patchLaw: ScorePatch = { type: 'updateScorePanLaw', panLawDb: -4.5 };
    const changed1 = applyScoreObjectPatch(data, patchLaw);
    expect(changed1).toBe(true);
    expect(data.getScore().panLawDb).toBe(-4.5);

    const patchBoost: ScorePatch = { type: 'updateScorePanBoost', panOffCenterBoost: true };
    const changed2 = applyScoreObjectPatch(data, patchBoost);
    expect(changed2).toBe(true);
    expect(data.getScore().panOffCenterBoost).toBe(true);
  });

  it('validates score panLawDb and panOffCenterBoost', () => {
    expect(
      validateProjectDocumentPatch({ score: { type: 'updateScorePanLaw', panLawDb: 0 } }).valid,
    ).toBe(true);
    expect(
      validateProjectDocumentPatch({ score: { type: 'updateScorePanLaw', panLawDb: -3 } }).valid,
    ).toBe(true);
    expect(
      validateProjectDocumentPatch({ score: { type: 'updateScorePanLaw', panLawDb: -4.5 } }).valid,
    ).toBe(true);
    expect(
      validateProjectDocumentPatch({ score: { type: 'updateScorePanLaw', panLawDb: -6 } }).valid,
    ).toBe(true);
    expect(
      validateProjectDocumentPatch({ score: { type: 'updateScorePanLaw', panLawDb: -5 as never } })
        .valid,
    ).toBe(false);

    expect(
      validateProjectDocumentPatch({
        score: { type: 'updateScorePanBoost', panOffCenterBoost: true },
      }).valid,
    ).toBe(true);
    expect(
      validateProjectDocumentPatch({
        score: { type: 'updateScorePanBoost', panOffCenterBoost: 'true' as never },
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
