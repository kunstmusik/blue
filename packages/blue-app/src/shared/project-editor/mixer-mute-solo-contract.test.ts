import { describe, expect, it } from 'vitest';
import { BlueData } from '@blue/data';
import { Channel } from '@blue/data';
import { Send } from '@blue/data';
import { hasLegacyMixerStateAtLoad, markLegacyMixerStateAtLoad } from '@blue/data';
import { computeLegacyMixerStateNotice } from './snapshot-mixer-orchestra';
import { createProjectEditorSnapshot } from './snapshot-score';
import {
  applyProjectDocumentPatch,
  validateProjectDocumentPatch,
  classifyProjectDocumentPatch,
  isScalarProjectDocumentPatch,
} from './patch-document';
import { applyMixerPatchToData, mixerPatchActionLabel } from './patch-mixer-bluelive';
import { createMixerSnapshot, createProjectPropertiesSnapshot } from './snapshot-mixer-orchestra';
import {
  effectiveTrackLayerMuteSoloMode,
  type MixerPatch,
  type ProjectDocumentPatch,
} from './contract';

function createProjectWithMasterSolo(): BlueData {
  const data = new BlueData();
  const mixer = data.getMixer();
  mixer.setEnabled(true);
  const master = mixer.getMaster();
  master.setSolo(true); // legacy stored master solo
  return data;
}

describe('mixer mute/solo contract boundary (Spec 111)', () => {
  describe('serializable renderer intents', () => {
    it('round-trips mixer channel M/S patches and header intents through JSON', () => {
      const patch: ProjectDocumentPatch = {
        mixer: {
          type: 'updateChannel',
          channelId: 'master',
          patch: { muted: true },
          headerIntent: { expectedMode: 'audio', association: 'track-abc' },
        },
        projectProperties: { trackLayerMuteSoloMode: 'audio' },
      };
      const serialized = JSON.stringify(patch);
      const parsed = JSON.parse(serialized) as ProjectDocumentPatch;
      expect(parsed.mixer).toEqual(patch.mixer);
      expect(parsed.projectProperties).toEqual(patch.projectProperties);
    });
  });

  describe('derived runtime state is never project state', () => {
    it('snapshots carry no gate symbols, route masks, tokens, or applied revisions', () => {
      const data = createProjectWithMasterSolo();
      const mixer = data.getMixer();
      const source = new Channel();
      source.setName('S1');
      mixer.getChannels().push(source);

      const snapshot = createMixerSnapshot(mixer);
      const text = JSON.stringify(snapshot);
      expect(text).not.toContain('gk_blue_mixgate_');
      expect(text).not.toContain('routeMask');
      expect(text).not.toContain('commitToken');
      expect(text).not.toContain('appliedRevision');
    });

    it('project XML never contains runtime gate symbols or route masks', () => {
      const data = createProjectWithMasterSolo();
      data.getMixer().getChannels()[0] ?? data.getMixer().getMaster();
      const xml = data.saveToString();
      expect(xml).not.toContain('gk_blue_mixgate_');
      expect(xml).not.toContain('routeMask');
      // Legacy master solo survives as inert compatibility data.
      expect(xml).toContain('<solo>true</solo>');
    });
  });

  describe('master solo rejection', () => {
    it('rejects a master-solo patch without applying companion fields', () => {
      const data = createProjectWithMasterSolo();
      const before = data.getMixer().getMaster().getName();
      const changed = applyMixerPatchToData(data, {
        type: 'updateChannel',
        channelId: 'master',
        patch: { solo: true, name: 'Renamed' },
      });
      expect(changed).toBe(false);
      expect(data.getMixer().getMaster().getName()).toBe(before);
      expect(data.getMixer().getMaster().isSolo()).toBe(true);
    });

    it('still applies non-solo edits to the master channel', () => {
      const data = createProjectWithMasterSolo();
      const changed = applyMixerPatchToData(data, {
        type: 'updateChannel',
        channelId: 'master',
        patch: { muted: true },
      });
      expect(changed).toBe(true);
      expect(data.getMixer().getMaster().isMuted()).toBe(true);
    });
  });

  describe('header authority guard', () => {
    it('rejects a header intent whose expected mode no longer matches', () => {
      const data = createProjectWithMasterSolo();
      data.getMixer().setEnabled(true);
      data.getProjectProperties().trackLayerMuteSoloMode = 'event';

      const changed = applyMixerPatchToData(data, {
        type: 'updateChannel',
        channelId: data.getMixer().getMaster().getName(),
        patch: { muted: true },
        headerIntent: { expectedMode: 'audio' },
      });
      expect(changed).toBe(false);
    });

    it('rejects a header intent whose association moved', () => {
      const data = createProjectWithMasterSolo();
      data.getProjectProperties().trackLayerMuteSoloMode = 'audio';
      const source = new Channel();
      source.setName('S1');
      source.setAssociation('track-1');
      data.getMixer().getChannels().push(source);

      const changed = applyMixerPatchToData(data, {
        type: 'updateChannel',
        channelId: 'track-1',
        patch: { muted: true },
        headerIntent: { expectedMode: 'audio', association: 'track-9' },
      });
      expect(changed).toBe(false);

      const matched = applyMixerPatchToData(data, {
        type: 'updateChannel',
        channelId: 'track-1',
        patch: { muted: true },
        headerIntent: { expectedMode: 'audio', association: 'track-1' },
      });
      expect(matched).toBe(true);
    });
  });

  describe('mode patches', () => {
    it('applies supported mode values and rejects unsupported ones', () => {
      const data = createProjectWithMasterSolo();
      const changed = applyProjectDocumentPatch(data, {
        projectProperties: { trackLayerMuteSoloMode: 'event' },
      });
      expect(changed).toBe(true);
      expect(data.getProjectProperties().trackLayerMuteSoloMode).toBe('event');

      const rejected = applyProjectDocumentPatch(data, {
        projectProperties: { trackLayerMuteSoloMode: 'loud' as 'audio' },
      });
      expect(rejected).toBe(false);
    });

    it('classifies mode and M/S patches for history preparation', () => {
      expect(
        isScalarProjectDocumentPatch({
          projectProperties: { trackLayerMuteSoloMode: 'audio' },
        }),
      ).toBe(true);
      expect(
        isScalarProjectDocumentPatch({
          mixer: { type: 'updateChannel', channelId: 'A', patch: { muted: true } },
        }),
      ).toBe(true);
      expect(
        isScalarProjectDocumentPatch({
          mixer: { type: 'updateChannel', channelId: 'A', patch: { solo: true } },
        }),
      ).toBe(true);
      expect(
        validateProjectDocumentPatch({ mixer: { type: 'setMixerEnabled', value: false } }).valid,
      ).toBe(true);
    });

    it('supplies semantic action labels for every durable writer', () => {
      expect(
        mixerPatchActionLabel({ type: 'updateChannel', channelId: 'A', patch: { muted: true } }),
      ).toBe('Mute Channel');
      expect(
        mixerPatchActionLabel({ type: 'updateChannel', channelId: 'A', patch: { muted: false } }),
      ).toBe('Unmute Channel');
      expect(
        mixerPatchActionLabel({ type: 'updateChannel', channelId: 'A', patch: { solo: true } }),
      ).toBe('Solo Channel');
      expect(
        mixerPatchActionLabel({ type: 'updateChannel', channelId: 'A', patch: { solo: false } }),
      ).toBe('Unsolo Channel');
      expect(mixerPatchActionLabel({ type: 'setMixerEnabled', value: false })).toBe(
        'Disable Mixer',
      );
    });
  });

  describe('effective mode derivation', () => {
    it('forces Event when the mixer is disabled and keeps the saved mode otherwise', () => {
      expect(effectiveTrackLayerMuteSoloMode('audio', true)).toBe('audio');
      expect(effectiveTrackLayerMuteSoloMode('audio', false)).toBe('event');
      expect(effectiveTrackLayerMuteSoloMode('event', true)).toBe('event');
    });

    it('snapshots expose the parsed mode and unsupported raw text', () => {
      const data = createProjectWithMasterSolo();
      data.getProjectProperties().trackLayerMuteSoloMode = 'audio';
      const snapshot = createProjectPropertiesSnapshot(data.getProjectProperties());
      expect(snapshot.trackLayerMuteSoloMode).toBe('audio');
      expect(snapshot.trackLayerMuteSoloModeRaw).toBeNull();
    });
  });

  describe('route indicators in snapshots', () => {
    it('exposes solo exclusion and send survival for the contract matrix', () => {
      const data = new BlueData();
      const mixer = data.getMixer();
      mixer.setEnabled(true);
      const a = new Channel();
      a.setName('A');
      const sendToR = new Send();
      sendToR.setSendChannel('R');
      a.getPostEffects().push(sendToR);
      const b = new Channel();
      b.setName('B');
      const r = new Channel();
      r.setName('R');
      r.setOutChannel('Master');
      mixer.getChannels().push(a, b);
      mixer.getSubChannels().push(r);

      const snapshot = createMixerSnapshot(mixer);
      expect(snapshot.channels.find((c) => c.name === 'A')?.outputExcludedBySolo).toBe(false);
      expect(snapshot.legacyActiveChannelStateNotice ?? false).toBe(false);

      r.setSolo(true);
      const soloSnapshot = createMixerSnapshot(mixer);
      const aSnap = soloSnapshot.channels.find((c) => c.name === 'A');
      expect(aSnap?.outputExcludedBySolo).toBe(true);
      expect(aSnap?.hasIncludedSend).toBe(true);
      // Load provenance (simulated with the loader's marker) is what makes
      // the notice fire; live edits alone never do.
      markLegacyMixerStateAtLoad(data);
      expect(computeLegacyMixerStateNotice(data)).toBe(true);

      // Clearing the loaded flags retires the notice.
      r.setSolo(false);
      expect(computeLegacyMixerStateNotice(data)).toBe(false);
    });

    it('carries legacy master mute through load, snapshot, bypass, and clearing', () => {
      const data = BlueData.loadFromString(
        '<blueData version="2.8.0"><mixer><enabled>true</enabled>' +
          '<channel><name>Master</name><muted>true</muted><solo>false</solo></channel>' +
          '</mixer></blueData>',
      );

      expect(data.getMixer().getMaster().isMuted()).toBe(true);
      expect(hasLegacyMixerStateAtLoad(data)).toBe(true);
      expect(computeLegacyMixerStateNotice(data)).toBe(true);
      let snapshot = createProjectEditorSnapshot(data, null);
      expect(snapshot.mixer.legacyActiveChannelStateNotice).toBe(true);

      data.getMixer().setEnabled(false);
      snapshot = createProjectEditorSnapshot(data, null);
      expect(snapshot.mixer.enabled).toBe(false);
      expect(snapshot.mixer.legacyActiveChannelStateNotice).toBe(true);

      data.getMixer().setEnabled(true);
      data.getMixer().getMaster().setMuted(false);
      data.getMixer().getMaster().setSolo(true);
      snapshot = createProjectEditorSnapshot(data, null);
      expect(snapshot.mixer.legacyActiveChannelStateNotice).toBe(false);
    });
  });

  describe('association stability (Spec 111 T037)', () => {
    it('keeps the track-channel association through channel and track renames', async () => {
      const data = new BlueData();
      data.getProjectProperties().trackLayerMuteSoloMode = 'audio';
      const { TrackLayerGroup, ScoreTrack } = (await import('@blue/data')) as unknown as {
        TrackLayerGroup: new () => unknown[];
        ScoreTrack: new () => { setName: (n: string) => void; getUniqueId: () => string };
      };
      const group = new TrackLayerGroup();
      const track = new ScoreTrack();
      track.setName('Bass');
      group.push(track);
      data.getScore().length = 0;
      data.getScore().push(group as never);

      const channel = new Channel();
      channel.setName('Bass Channel');
      channel.setAssociation(track.getUniqueId());
      data.getMixer().getChannels().push(channel);

      // Rename the channel: the association key is untouched.
      applyMixerPatchToData(data, {
        type: 'updateChannel',
        channelId: track.getUniqueId(),
        patch: { name: 'Renamed Channel' },
      });
      expect(channel.getAssociation()).toBe(track.getUniqueId());

      // Rename the track itself: association is by uniqueId, not name.
      track.setName('Renamed Bass');
      const found = data
        .getMixer()
        .getAllSourceChannels()
        .find((candidate) => candidate.getAssociation() === track.getUniqueId());
      expect(found).toBe(channel);
    });

    it('keeps the association through track reordering', async () => {
      const data = new BlueData();
      const { TrackLayerGroup, ScoreTrack } = (await import('@blue/data')) as unknown as {
        TrackLayerGroup: new () => unknown[];
        ScoreTrack: new () => { setName: (n: string) => void; getUniqueId: () => string };
      };
      const group = new TrackLayerGroup() as unknown as Array<{ getUniqueId: () => string }> & {
        push: (t: unknown) => void;
      };
      const first = new ScoreTrack();
      const second = new ScoreTrack();
      group.push(first, second);
      data.getScore().length = 0;
      data.getScore().push(group as never);

      const channel = new Channel();
      channel.setName('Second');
      channel.setAssociation(second.getUniqueId());
      data.getMixer().getChannels().push(channel);

      // Move the second track to the front (a reorder, not a rename).
      const moved = group.splice(1, 1)[0]!;
      group.unshift(moved);
      expect(group[0]!.getUniqueId()).toBe(second.getUniqueId());

      const found = data
        .getMixer()
        .getAllSourceChannels()
        .find((candidate) => candidate.getAssociation() === second.getUniqueId());
      expect(found).toBe(channel);
    });
  });

  describe('classification exhaustiveness', () => {
    it('keeps mixer M/S classified as live-capable patch work', () => {
      const patch: MixerPatch = {
        type: 'updateChannel',
        channelId: 'A',
        patch: { muted: true },
      };
      expect(classifyProjectDocumentPatch({ mixer: patch })).toBe('scalar');
    });
  });
});
