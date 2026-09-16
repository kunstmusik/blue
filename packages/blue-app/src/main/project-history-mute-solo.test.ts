import { describe, expect, it } from 'vitest';
import { BlueData, Channel, TrackLayerGroup } from '@blue/data';
import type { ScoreTrack } from '@blue/data';
import { ProjectSession } from './project-session';
import { ProjectHistory } from './project-history';
import { MockHistoryContext, FakePublicationRecorder } from './project-history-test-support';

function setupHistory() {
  const session = new ProjectSession();
  session.replace(new BlueData(), '/tmp/project.blue');
  const recorder = new FakePublicationRecorder();
  const history = new ProjectHistory({
    session,
    publishUpdated: (evt) => recorder.record(evt),
  });
  const contextA = new MockHistoryContext('ctx-a');
  return { session, history, recorder, contextA };
}

/**
 * Spec 111 US4: every durable mute/solo/mode/mixer-enable edit commits one
 * semantic history action that restores canonical values, identities, and
 * dirty state through undo and redo; a rejected master-solo edit creates no
 * history entry at all.
 */
describe('project history: mixer mute/solo, mode, and enable (Spec 111)', () => {
  it('commits, undoes, and redoes a channel mute while keeping the channel identity stable', async () => {
    const { session, history, contextA } = setupHistory();
    const docId = session.read().documentId!;
    const master = session.read().data!.getMixer().getMaster();
    const masterRef = master;
    expect(master.isMuted()).toBe(false);

    const res = await history.commit(
      contextA.nextCommitRequest(docId, 0, 'Mute Channel', [
        { mixer: { type: 'updateChannel', channelId: 'master', patch: { muted: true } } },
      ]),
    );
    expect(res.status).toBe('committed');
    expect(session.read().data!.getMixer().getMaster().isMuted()).toBe(true);
    // Same object identity survives the commit.
    expect(session.read().data!.getMixer().getMaster()).toBe(masterRef);

    await history.undo({
      documentId: docId,
      operationId: 'undo-mute',
      expectedRevision: 1,
      contextSequence: contextA.sequence + 1,
    });
    expect(session.read().data!.getMixer().getMaster().isMuted()).toBe(false);

    const redo = await history.redo({
      documentId: docId,
      operationId: 'redo-mute',
      expectedRevision: 2,
      contextSequence: contextA.sequence + 2,
    });
    expect(redo.status).toBe('committed');
    expect(session.read().data!.getMixer().getMaster().isMuted()).toBe(true);
  });

  it('commits and undoes solo on a non-master channel', async () => {
    const { session, history, contextA } = setupHistory();
    const docId = session.read().documentId!;
    const channel = new Channel();
    channel.setName('S1');
    channel.setAssociation('track-1');
    session.read().data!.getMixer().getChannels().push(channel);

    const res = await history.commit(
      contextA.nextCommitRequest(docId, 0, 'Solo Channel', [
        { mixer: { type: 'updateChannel', channelId: 'track-1', patch: { solo: true } } },
      ]),
    );
    expect(res.status).toBe('committed');
    expect(session.read().data!.getMixer().getChannels()[0].isSolo()).toBe(true);

    await history.undo({
      documentId: docId,
      operationId: 'undo-solo',
      expectedRevision: 1,
      contextSequence: contextA.sequence + 1,
    });
    expect(session.read().data!.getMixer().getChannels()[0].isSolo()).toBe(false);
  });

  it('rejects a master-solo edit without creating a history entry', async () => {
    const { session, history, contextA } = setupHistory();
    const docId = session.read().documentId!;

    const res = await history.commit(
      contextA.nextCommitRequest(docId, 0, 'Solo Channel', [
        {
          mixer: {
            type: 'updateChannel',
            channelId: 'master',
            patch: { solo: true, volume: 0.5 },
          },
        },
      ]),
    );
    // The patch applies to nothing: history stays at revision 0 with no entry.
    expect(res.status).toBe('unchanged');
    expect(session.read().data!.getMixer().getMaster().isSolo()).toBe(false);
    expect(session.read().data!.getMixer().getMaster().getVolume()).toBe(1.0);
    expect(history.read().length).toBe(0);
  });

  it('restores invalid raw mode provenance exactly through undo', async () => {
    const { session, history, contextA } = setupHistory();
    const docId = session.read().documentId!;
    // Load provenance: an unsupported raw value parses Event but retains text.
    const data = session.read().data!;
    data.getProjectProperties().restoreTrackLayerMuteSoloMode('event', 'solo-all', true);

    const res = await history.commit(
      contextA.nextCommitRequest(docId, 0, 'Set Track Header Mode to Audio', [
        { projectProperties: { trackLayerMuteSoloMode: 'audio' } },
      ]),
    );
    expect(res.status).toBe('committed');
    expect(data.getProjectProperties().trackLayerMuteSoloModeRaw).toBeNull();

    await history.undo({
      documentId: docId,
      operationId: 'undo-mode-raw',
      expectedRevision: 1,
      contextSequence: contextA.sequence + 1,
    });
    // Undo reinstates the retained raw text, not just the parsed mode.
    expect(data.getProjectProperties().trackLayerMuteSoloMode).toBe('event');
    expect(data.getProjectProperties().trackLayerMuteSoloModeRaw).toBe('solo-all');
    expect(data.getProjectProperties().trackLayerMuteSoloModePresent).toBe(true);
  });

  it('leaves both flag sets untouched by mode changes (no state copying)', async () => {
    const { session, history, contextA } = setupHistory();
    const docId = session.read().documentId!;
    const data = session.read().data!;
    data.getMixer().getMaster().setMuted(true);
    const score = data.getScore();
    score.length = 0;
    const group = new TrackLayerGroup();
    const track = new TrackLayerGroup().newLayerAt(0) as unknown as ScoreTrack;
    track.setMuted(true);
    track.setSolo(true);
    group.push(track);
    score.push(group);

    const res = await history.commit(
      contextA.nextCommitRequest(docId, 0, 'Set Track Header Mode to Event', [
        { projectProperties: { trackLayerMuteSoloMode: 'event' } },
      ]),
    );
    expect(res.status).toBe('committed');
    // Neither the channel flags nor the track event flags moved.
    const scoreTrack = (data.getScore()[0] as unknown as ScoreTrack[])[0]!;
    expect(data.getMixer().getMaster().isMuted()).toBe(true);
    expect(scoreTrack.isMuted()).toBe(true);
    expect(scoreTrack.isSolo()).toBe(true);

    await history.undo({
      documentId: docId,
      operationId: 'undo-mode-copy',
      expectedRevision: 1,
      contextSequence: contextA.sequence + 1,
    });
    expect(data.getMixer().getMaster().isMuted()).toBe(true);
    expect((data.getScore()[0] as unknown as ScoreTrack[])[0]!.isMuted()).toBe(true);
  });

  it('commits, undoes, and redoes the track header mode', async () => {
    const { session, history, contextA } = setupHistory();
    const docId = session.read().documentId!;
    expect(session.read().data!.getProjectProperties().trackLayerMuteSoloMode).toBe('audio');

    const res = await history.commit(
      contextA.nextCommitRequest(docId, 0, 'Set Track Header Mode to Event', [
        { projectProperties: { trackLayerMuteSoloMode: 'event' } },
      ]),
    );
    expect(res.status).toBe('committed');
    expect(session.read().data!.getProjectProperties().trackLayerMuteSoloMode).toBe('event');

    await history.undo({
      documentId: docId,
      operationId: 'undo-mode',
      expectedRevision: 1,
      contextSequence: contextA.sequence + 1,
    });
    expect(session.read().data!.getProjectProperties().trackLayerMuteSoloMode).toBe('audio');

    const redo = await history.redo({
      documentId: docId,
      operationId: 'redo-mode',
      expectedRevision: 2,
      contextSequence: contextA.sequence + 2,
    });
    expect(redo.status).toBe('committed');
    expect(session.read().data!.getProjectProperties().trackLayerMuteSoloMode).toBe('event');
  });

  it('commits and undoes mixer enable while preserving channel flags', async () => {
    const { session, history, contextA } = setupHistory();
    const docId = session.read().documentId!;
    session.read().data!.getMixer().getMaster().setMuted(true);

    const res = await history.commit(
      contextA.nextCommitRequest(docId, 0, 'Disable Mixer', [
        { mixer: { type: 'setMixerEnabled', value: false } },
      ]),
    );
    expect(res.status).toBe('committed');
    expect(session.read().data!.getMixer().isEnabled()).toBe(false);
    expect(session.read().data!.getMixer().getMaster().isMuted()).toBe(true);

    await history.undo({
      documentId: docId,
      operationId: 'undo-enable',
      expectedRevision: 1,
      contextSequence: contextA.sequence + 1,
    });
    expect(session.read().data!.getMixer().isEnabled()).toBe(true);
    expect(session.read().data!.getMixer().getMaster().isMuted()).toBe(true);
  });
});
