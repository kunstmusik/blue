import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BlueData,
  Channel,
  GenericScore,
  GenericInstrument,
  PolyObject,
  ScoreTrack,
  SoundLayer,
  TimeBehavior,
  TimeDuration,
  TrackLayerGroup,
  buildStandardCSD,
  buildMixerRouteGraph,
  getMixerRouteSignature,
  resolveMixerGateIntent,
} from '@blue/data';
import { ProjectSession } from './project-session';
import { ProjectHistory } from './project-history';
import { ProjectRuntimeReconciliation } from './project-runtime-reconciliation';
import { assignLayerGroupId, getMixerChannelSnapshotId } from '../shared/project-editor/identity';
import { createProjectEditorSnapshot } from '../shared/project-editor';
import type { ProjectEditorSnapshot } from '../shared/project-editor/contract';
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
  it('renders committed SoundObject layer mute and unmute state from the canonical project', async () => {
    const { session, history, contextA } = setupHistory();
    const data = session.read().data!;
    data.getScore().length = 0;

    const root = new PolyObject(true);
    const rootLayer = new SoundLayer();
    const nested = new PolyObject(false);
    nested.setTimeBehavior(TimeBehavior.NONE);
    nested.setSubjectiveDuration(TimeDuration.beats(4));
    const nestedLayer = new SoundLayer();
    const scoreObject = new GenericScore();
    scoreObject.setScoreText('i1 0 1 440');
    nestedLayer.push(scoreObject);
    nested.push(nestedLayer);
    rootLayer.push(nested);
    root.push(rootLayer);
    data.getScore().push(root);

    const nestedGroupId = assignLayerGroupId(nested);
    const docId = session.read().documentId!;
    const renderScore = () => {
      const csd = buildStandardCSD(session.read().data!, 'disk').csdText;
      return csd.slice(csd.indexOf('<CsScore>'), csd.indexOf('</CsScore>'));
    };
    const authoredNote = /\bi1\t0\.0\t4\t440\b/;

    expect(renderScore()).toMatch(authoredNote);

    const muted = await history.commit(
      contextA.nextCommitRequest(docId, 0, 'Mute Layer', [
        {
          score: {
            type: 'updateLayerState',
            groupId: nestedGroupId,
            layerIndex: 0,
            patch: { muted: true },
          },
        },
      ]),
    );
    expect(muted.status).toBe('committed');
    expect(renderScore()).not.toMatch(authoredNote);

    const unmuted = await history.commit(
      contextA.nextCommitRequest(docId, 1, 'Unmute Layer', [
        {
          score: {
            type: 'updateLayerState',
            groupId: nestedGroupId,
            layerIndex: 0,
            patch: { muted: false },
          },
        },
      ]),
    );
    expect(unmuted.status).toBe('committed');
    expect(renderScore()).toMatch(authoredNote);
  });

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

  it('reconciles mode and mixer-enable history across active and stopped performances (T093)', async () => {
    const data = new BlueData();
    const group = new TrackLayerGroup();
    const track = new ScoreTrack();
    track.setUniqueId('track-t093');
    track.setMuted(false);
    track.setSolo(true);
    group.push(track);
    data.getScore().push(group);
    data.getArrangement().addInstrument(new GenericInstrument(), 'track-t093');

    const channel = new Channel();
    channel.setName('Audio T093');
    channel.setAssociation('track-t093');
    channel.setMuted(true);
    channel.setSolo(false);
    data.getMixer().getChannels().push(channel);

    const session = new ProjectSession();
    session.replace(data, path.join(tmpdir(), 't093-history.blue'), {
      documentId: 'doc-t093-history',
    });
    const publishedSnapshots: ProjectEditorSnapshot[] = [];
    const writes = new Map<'timeline' | 'blueLive', unknown[]>([
      ['timeline', []],
      ['blueLive', []],
    ]);
    const reconciliation = new ProjectRuntimeReconciliation();
    for (const kind of ['timeline', 'blueLive'] as const) {
      reconciliation.registerPerformance(kind, 1, {
        async applyOperation(operation) {
          writes.get(kind)!.push(operation);
          return {
            status: 'rejected',
            message: `T093 received unexpected live operation for ${kind}`,
          };
        },
      });
    }
    const history = new ProjectHistory({
      session,
      reconciliation,
      captureSnapshot: () => {
        const current = session.read();
        return current.data
          ? createProjectEditorSnapshot(
              current.data,
              current.filePath,
              current.sessionId,
              current.documentId ?? undefined,
            )
          : null;
      },
      publishUpdated: (event) => {
        if (event.snapshot) publishedSnapshots.push(event.snapshot as ProjectEditorSnapshot);
      },
    });
    const context = new MockHistoryContext('ctx-t093-history');
    const docId = session.read().documentId!;
    const channelRef = channel;
    const trackRef = track;
    const initialState = {
      mode: data.getProjectProperties().trackLayerMuteSoloMode,
      mixerEnabled: data.getMixer().isEnabled(),
      mixerMuted: channel.isMuted(),
      mixerSolo: channel.isSolo(),
      eventMuted: track.isMuted(),
      eventSolo: track.isSolo(),
      association: channel.getAssociation(),
    };
    history.setSavedStateId(session.read().stateId);

    const expectState = (expected: Partial<typeof initialState>, dirty: boolean) => {
      const current = session.read().data!;
      expect({
        mode: current.getProjectProperties().trackLayerMuteSoloMode,
        mixerEnabled: current.getMixer().isEnabled(),
        mixerMuted: channelRef.isMuted(),
        mixerSolo: channelRef.isSolo(),
        eventMuted: trackRef.isMuted(),
        eventSolo: trackRef.isSolo(),
        association: channelRef.getAssociation(),
      }).toMatchObject(expected);
      expect(channelRef).toBe(channel);
      expect(trackRef).toBe(track);
      expect(history.isDirty()).toBe(dirty);
      const snapshot = publishedSnapshots.at(-1);
      expect(snapshot).toBeDefined();
      expect(snapshot?.projectProperties.trackLayerMuteSoloMode).toBe(
        expected.mode ?? current.getProjectProperties().trackLayerMuteSoloMode,
      );
      expect(snapshot?.mixer?.enabled).toBe(
        expected.mixerEnabled ?? current.getMixer().isEnabled(),
      );
      const snapshotChannel = snapshot?.mixer?.channels.find(
        (candidate) => candidate.association === 'track-t093',
      );
      expect(snapshotChannel).toMatchObject({
        muted: expected.mixerMuted ?? channelRef.isMuted(),
        solo: expected.mixerSolo ?? channelRef.isSolo(),
        association: 'track-t093',
      });
      expect(publishedSnapshots.length).toBeGreaterThan(0);
    };

    const expectActiveRestartOutcomes = (response: { runtimeOutcomes?: readonly unknown[] }) => {
      expect(response.runtimeOutcomes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ performanceKind: 'timeline', status: 'restart-required' }),
          expect.objectContaining({ performanceKind: 'blueLive', status: 'restart-required' }),
        ]),
      );
      expect(response.runtimeOutcomes).toHaveLength(2);
      expect(writes.get('timeline')).toHaveLength(0);
      expect(writes.get('blueLive')).toHaveLength(0);
    };

    const modeEvent = { projectProperties: { trackLayerMuteSoloMode: 'event' as const } };
    const disableMixer = { mixer: { type: 'setMixerEnabled' as const, value: false } };

    const modeCommit = await history.commit(
      context.nextCommitRequest(docId, 0, 'Set Track Header Mode to Event', [modeEvent]),
    );
    expect(modeCommit.status).toBe('committed');
    if (modeCommit.status !== 'committed') return;
    expectActiveRestartOutcomes(modeCommit);
    expectState({ ...initialState, mode: 'event' }, true);

    const disableCommit = await history.commit(
      context.nextCommitRequest(docId, 1, 'Disable Mixer', [disableMixer]),
    );
    expect(disableCommit.status).toBe('committed');
    if (disableCommit.status !== 'committed') return;
    expectActiveRestartOutcomes(disableCommit);
    expectState({ ...initialState, mode: 'event', mixerEnabled: false }, true);

    const undoDisable = await history.undo(context.nextUndoRequest(docId, 2));
    expect(undoDisable.status).toBe('committed');
    if (undoDisable.status !== 'committed') return;
    expectActiveRestartOutcomes(undoDisable);
    expectState({ ...initialState, mode: 'event', mixerEnabled: true }, true);

    const redoDisable = await history.redo(context.nextRedoRequest(docId, 3));
    expect(redoDisable.status).toBe('committed');
    if (redoDisable.status !== 'committed') return;
    expectActiveRestartOutcomes(redoDisable);
    expectState({ ...initialState, mode: 'event', mixerEnabled: false }, true);

    const undoDisableAgain = await history.undo(context.nextUndoRequest(docId, 4));
    expect(undoDisableAgain.status).toBe('committed');
    if (undoDisableAgain.status !== 'committed') return;
    expectActiveRestartOutcomes(undoDisableAgain);
    expectState({ ...initialState, mode: 'event', mixerEnabled: true }, true);

    const undoMode = await history.undo(context.nextUndoRequest(docId, 5));
    expect(undoMode.status).toBe('committed');
    if (undoMode.status !== 'committed') return;
    expectActiveRestartOutcomes(undoMode);
    expectState(initialState, false);

    const redoMode = await history.redo(context.nextRedoRequest(docId, 6));
    expect(redoMode.status).toBe('committed');
    if (redoMode.status !== 'committed') return;
    expectActiveRestartOutcomes(redoMode);
    expectState({ ...initialState, mode: 'event' }, true);

    reconciliation.stopPerformance('timeline');
    reconciliation.stopPerformance('blueLive');
    const stoppedCommit = await history.commit(
      context.nextCommitRequest(docId, 7, 'Disable Mixer While Stopped', [disableMixer]),
    );
    expect(stoppedCommit.status).toBe('committed');
    if (stoppedCommit.status !== 'committed') return;
    expect(stoppedCommit.runtimeOutcomes).toEqual([]);
    expectState({ ...initialState, mode: 'event', mixerEnabled: false }, true);

    const stoppedUndo = await history.undo(context.nextUndoRequest(docId, 8));
    expect(stoppedUndo.status).toBe('committed');
    if (stoppedUndo.status !== 'committed') return;
    expect(stoppedUndo.runtimeOutcomes).toEqual([]);
    expectState({ ...initialState, mode: 'event', mixerEnabled: true }, true);

    const stoppedRedo = await history.redo(context.nextRedoRequest(docId, 9));
    expect(stoppedRedo.status).toBe('committed');
    if (stoppedRedo.status !== 'committed') return;
    expect(stoppedRedo.runtimeOutcomes).toEqual([]);
    expectState({ ...initialState, mode: 'event', mixerEnabled: false }, true);
  });

  it('binds same-name unassociated replacements to fresh compiled identities through undo and redo', async () => {
    const session = new ProjectSession();
    const data = new BlueData();
    const original = new Channel();
    original.setName('Return');
    data.getMixer().getSubChannels().push(original);
    session.replace(data, '/tmp/project.blue', { documentId: 'doc-mixer-identity' });

    const reconciliation = new ProjectRuntimeReconciliation({
      resolveMixerGates: () => {
        const current = session.read().data;
        return current ? resolveMixerGateIntent(current.getMixer()) : null;
      },
    });
    reconciliation.registerPerformance('timeline', 1, {
      async applyOperation() {
        return { status: 'applied' };
      },
    });
    const history = new ProjectHistory({ session, reconciliation });
    const context = new MockHistoryContext('ctx-mixer-identity');
    const docId = session.read().documentId!;
    const originalChannelId = getMixerChannelSnapshotId(original);
    const compiledSignature = () => {
      const current = session.read().data!;
      const graphSignature = getMixerRouteSignature(buildMixerRouteGraph(current.getMixer()));
      const catalogSignature = current.toRealtimePlaybackCSD().mixerGateBindings?.signature;
      expect(catalogSignature).toBe(graphSignature);
      return catalogSignature;
    };

    const originalSignature = compiledSignature();
    expect(originalSignature).toBeDefined();
    const remove = await history.commit(
      context.nextCommitRequest(docId, 0, 'Remove Return', [
        { mixer: { type: 'removeSubChannel', channelId: originalChannelId } },
      ]),
    );
    expect(remove.status).toBe('committed');
    expect(session.read().data!.getMixer().getSubChannels()).toHaveLength(0);

    const add = await history.commit(
      context.nextCommitRequest(docId, 1, 'Add Return Replacement', [
        {
          mixer: {
            type: 'addSubChannel',
            name: 'Return',
            insertIndex: 0,
            channelId: 'replacement-return',
          },
        },
      ]),
    );
    expect(add.status).toBe('committed');
    const replacementSignature = compiledSignature();
    expect(replacementSignature).not.toBe(originalSignature);

    const undoAdd = await history.undo(context.nextUndoRequest(docId, 2));
    expect(undoAdd.status).toBe('committed');
    const undoRemove = await history.undo(context.nextUndoRequest(docId, 3));
    expect(undoRemove.status).toBe('committed');
    expect(session.read().data!.getMixer().getSubChannels()[0]).toBeDefined();
    expect(compiledSignature()).toBe(originalSignature);

    const redoRemove = await history.redo(context.nextRedoRequest(docId, 4));
    expect(redoRemove.status).toBe('committed');
    const redoAdd = await history.redo(context.nextRedoRequest(docId, 5));
    expect(redoAdd.status).toBe('committed');
    expect(compiledSignature()).toBe(replacementSignature);
  });
});
