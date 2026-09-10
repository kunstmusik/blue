import { describe, expect, it, vi } from 'vitest';
import { BlueData, GenericInstrument, Channel, Effect, TrackLayerGroup } from '@blue/data';
import { ProjectSession } from './project-session';
import { ProjectHistory } from './project-history';
import {
  MockHistoryContext,
  FakePublicationRecorder,
  createDeferred,
} from './project-history-test-support';
import {
  ProjectRuntimeReconciliation,
  type RuntimeOperationAck,
} from './project-runtime-reconciliation';
import {
  classifyProjectDocumentPatch,
  validateProjectDocumentPatch,
  getMixerEntrySnapshotId,
  type ProjectDocumentPatch,
} from '../shared/project-editor';
import { prepareTransaction } from './project-history-memento';

describe('Project history canonical writer audit (T014)', () => {
  function setupTest(
    options: { bytesLimit?: number; reconciliation?: ProjectRuntimeReconciliation } = {},
  ) {
    const session = new ProjectSession();
    const data = new BlueData();
    data.getProjectProperties().title = 'Original Project';
    data.getGlobalOrcSco().setGlobalOrc('sr = 44100\nksmps = 32');

    const master = data.getMixer().getMaster();
    master.setLevel(0.8);

    const instr = new GenericInstrument();
    instr.setName('Synth 1');
    data.getArrangement().addInstrument(instr, undefined);

    const group = new TrackLayerGroup();
    group.setUniqueId('root-group');
    const track = group.newLayerAt(0);
    track.setUniqueId('track-1');
    const trackInstr = new GenericInstrument();
    trackInstr.setName('Synth 1');
    track.setInstrument(trackInstr);
    data.getScore().push(group);

    session.replace(data, '/path/to/project.blue');

    const recorder = new FakePublicationRecorder();
    const history = new ProjectHistory({
      session,
      publishUpdated: (evt) => recorder.record(evt),
      retainedBytesLimit: options.bytesLimit,
      reconciliation: options.reconciliation,
    });

    const context = new MockHistoryContext('ctx-audit');
    return { session, data, history, recorder, context };
  }

  describe('Preparation boundary validation', () => {
    it('rejects unexpected or unclassified patch properties at the preparation boundary', () => {
      const { data } = setupTest();
      const invalidPatch = {
        arbitraryUnregisteredKey: 'malicious or invalid content',
      } as unknown as ProjectDocumentPatch;

      const validation = validateProjectDocumentPatch(invalidPatch);
      expect(validation.valid).toBe(false);
      expect(validation.unexpectedKeys).toContain('arbitraryUnregisteredKey');

      const classification = classifyProjectDocumentPatch(invalidPatch);
      expect(classification).toBe('invalid');

      const prepResult = prepareTransaction(data, [invalidPatch]);
      expect(prepResult.status).toBe('invalid');
      if (prepResult.status === 'invalid') {
        expect(prepResult.reason).toContain('Unexpected patch key(s)');
      }
    });

    it('rejects invalid patch when committing through ProjectHistory coordinator', async () => {
      const { session, history, context } = setupTest();
      const docId = session.read().documentId!;
      const invalidPatch = {
        unsupportedField: 42,
      } as unknown as ProjectDocumentPatch;

      const req = context.nextCommitRequest(docId, 0, 'Invalid Commit', [invalidPatch]);
      const res = await history.commit(req);
      expect(res.status).toBe('invalid');
      expect(session.read().revision).toBe(0);
      expect(history.read().length).toBe(0);
    });

    it('preserves revision and history when a patch is unchanged / empty', async () => {
      const { session, history, context } = setupTest();
      const docId = session.read().documentId!;

      // Level is already 0.8
      const req = context.nextCommitRequest(docId, 0, 'No-op Level', [
        { mixer: { type: 'updateChannel', channelId: 'Master', patch: { level: 0.8 } } },
      ]);
      const res = await history.commit(req);
      expect(res.status).toBe('unchanged');
      if (res.status === 'unchanged') {
        expect(res.receipt?.changed).toBe(false);
      }
      expect(session.read().revision).toBe(0);
      expect(history.read().length).toBe(0);
    });
  });

  describe('Patch batch writer through preparation boundary', () => {
    it('commits scalar patch batch with exact receipt and undo/redo support', async () => {
      const { session, history, recorder, context } = setupTest();
      const docId = session.read().documentId!;

      const req = context.nextCommitRequest(docId, 0, 'Adjust Mixer and Title', [
        { mixer: { type: 'updateChannel', channelId: 'Master', patch: { level: 0.5 } } },
        { projectProperties: { title: 'Updated Title' } },
      ]);

      const res = await history.commit(req);
      expect(res.status).toBe('committed');
      if (res.status === 'committed') {
        expect(res.receipt?.changed).toBe(true);
        expect(res.receipt?.patchChanged).toEqual([true, true]);
        expect(res.receipt?.patchAccepted).toEqual([true, true]);
        expect(res.receipt?.revision).toBe(1);
      }

      expect(session.read().revision).toBe(1);
      expect(session.read().data?.getMixer().getMaster().getLevel()).toBe(0.5);
      expect(session.read().data?.getProjectProperties().title).toBe('Updated Title');
      expect(recorder.events).toHaveLength(1);

      // Undo restores original values
      const undoReq = context.nextUndoRequest(docId, 1);
      const undoRes = await history.undo(undoReq);
      expect(undoRes.status).toBe('committed');
      expect(session.read().revision).toBe(2);
      expect(session.read().data?.getMixer().getMaster().getLevel()).toBe(0.8);
      expect(session.read().data?.getProjectProperties().title).toBe('Original Project');

      // Redo re-applies values
      const redoReq = context.nextRedoRequest(docId, 2);
      const redoRes = await history.redo(redoReq);
      expect(redoRes.status).toBe('committed');
      expect(session.read().revision).toBe(3);
      expect(session.read().data?.getMixer().getMaster().getLevel()).toBe(0.5);
      expect(session.read().data?.getProjectProperties().title).toBe('Updated Title');
    });

    it('commits structural patch batch with detached memento isolation and undo/redo support', async () => {
      const { session, history, context } = setupTest();
      const docId = session.read().documentId!;

      const req = context.nextCommitRequest(docId, 0, 'Add Generic Instrument', [
        { orchestra: { type: 'addInstrument', instrumentType: 'generic' } },
      ]);

      const res = await history.commit(req);
      expect(res.status).toBe('committed');
      expect(session.read().revision).toBe(1);
      expect(session.read().data?.getArrangement().size()).toBe(2);

      // Undo removes the added instrument
      const undoReq = context.nextUndoRequest(docId, 1);
      const undoRes = await history.undo(undoReq);
      expect(undoRes.status).toBe('committed');
      expect(session.read().revision).toBe(2);
      expect(session.read().data?.getArrangement().size()).toBe(1);

      // Redo restores the instrument
      const redoReq = context.nextRedoRequest(docId, 2);
      const redoRes = await history.redo(redoReq);
      expect(redoRes.status).toBe('committed');
      expect(session.read().revision).toBe(3);
      expect(session.read().data?.getArrangement().size()).toBe(2);
    });
  });

  describe('Track and effect adapter writers through preparation boundary', () => {
    it('commits track instrument patch via prepared transaction and supports undo/redo', async () => {
      const { session, history, context } = setupTest();
      const docId = session.read().documentId!;

      const trackPatch: ProjectDocumentPatch = {
        score: {
          type: 'updateTrackInstrument',
          track: {
            projectSessionId: session.read().sessionId,
            projectRevision: 0,
            rootGroupId: 'root-group',
            trackId: 'track-1',
          },
          patch: {
            name: 'Lead Synth',
          },
        },
      };

      const req = context.nextCommitRequest(docId, 0, 'Update Track Instrument', [trackPatch]);
      const res = await history.commit(req);
      expect(res.status).toBe('committed');
      expect(session.read().revision).toBe(1);
      expect(history.read().undoLabel).toBe('Update Track Instrument');

      const undoReq = context.nextUndoRequest(docId, 1);
      const undoRes = await history.undo(undoReq);
      expect(undoRes.status).toBe('committed');
      expect(session.read().revision).toBe(2);
    });

    it('commits effect editor patch via prepared transaction and supports undo/redo', async () => {
      const { session, history, context } = setupTest();
      const docId = session.read().documentId!;

      // Add an effect to master channel
      const master = session.read().data!.getMixer().getMaster();
      const effect = new Effect();
      effect.setName('Reverb');
      master.getPostEffects().push(effect);
      const entryId = getMixerEntrySnapshotId(effect);

      const effectPatch: ProjectDocumentPatch = {
        mixer: {
          type: 'updateEffect',
          channelId: 'Master',
          chain: 'post',
          entryId,
          patch: {
            name: 'Plate Reverb',
          },
        },
      };

      const req = context.nextCommitRequest(docId, 0, 'Update Effect', [effectPatch]);
      const res = await history.commit(req);
      expect(res.status).toBe('committed');
      expect(session.read().revision).toBe(1);
      expect(history.read().undoLabel).toBe('Update Effect');

      const undoReq = context.nextUndoRequest(docId, 1);
      const undoRes = await history.undo(undoReq);
      expect(undoRes.status).toBe('committed');
      expect(session.read().revision).toBe(2);
    });
  });

  describe('Direct main-process mutations via commitDirectMutation', () => {
    it('commits structural direct mutation, records memento, and supports undo/redo', async () => {
      const { session, history, context } = setupTest();
      const docId = session.read().documentId!;

      const receipt = await history.commitDirectMutation({
        label: 'Direct Structural Edit',
        mutator: (candidate) => {
          candidate.getProjectProperties().author = 'Steven Yi';
          candidate.getProjectProperties().title = 'Direct Mutated Title';
          return true;
        },
      });

      expect(receipt.changed).toBe(true);
      expect(receipt.revision).toBe(1);
      expect(session.read().data?.getProjectProperties().author).toBe('Steven Yi');
      expect(session.read().data?.getProjectProperties().title).toBe('Direct Mutated Title');
      expect(history.read().canUndo).toBe(true);
      expect(history.read().undoLabel).toBe('Direct Structural Edit');

      // Undo restores pre-mutation values
      const undoReq = context.nextUndoRequest(docId, 1);
      const undoRes = await history.undo(undoReq);
      expect(undoRes.status).toBe('committed');
      expect(session.read().data?.getProjectProperties().author).toBe('');
      expect(session.read().data?.getProjectProperties().title).toBe('Original Project');

      // Redo restores mutated values
      const redoReq = context.nextRedoRequest(docId, 2);
      const redoRes = await history.redo(redoReq);
      expect(redoRes.status).toBe('committed');
      expect(session.read().data?.getProjectProperties().author).toBe('Steven Yi');
      expect(session.read().data?.getProjectProperties().title).toBe('Direct Mutated Title');
    });

    it('returns unchanged receipt and does not advance revision if mutator returns false', async () => {
      const { session, history } = setupTest();

      const receipt = await history.commitDirectMutation({
        label: 'No-op Direct Edit',
        mutator: (_candidate) => false,
      });

      expect(receipt.changed).toBe(false);
      expect(receipt.revision).toBe(0);
      expect(history.read().length).toBe(0);
    });

    it('keeps direct publication behind replay runtime completion', async () => {
      const runtimeGate = createDeferred<RuntimeOperationAck>();
      const applyOperation = vi.fn(() => runtimeGate.promise);
      const reconciliation = new ProjectRuntimeReconciliation();
      const { session, history, context } = setupTest({ reconciliation });
      const documentId = session.read().documentId!;

      const baseline = await history.commit(
        context.nextCommitRequest(documentId, 0, 'Baseline level', [
          { mixer: { type: 'updateChannel', channelId: 'Master', patch: { level: 0.5 } } },
        ]),
      );
      expect(baseline.status).toBe('committed');

      reconciliation.registerPerformance(
        'timeline',
        1,
        { applyOperation },
        new Map([['Master::level', { kind: 'channel', channel: 'gkMasterLevel' }]]),
      );

      const undoPromise = history.undo({
        documentId,
        operationId: 'delayed-replay-undo',
        expectedRevision: 1,
        contextSequence: 2,
      });
      await vi.waitFor(() => expect(applyOperation).toHaveBeenCalledOnce());

      let directRan = false;
      const directPromise = history.commitDirectMutation({
        label: 'Direct publication after replay',
        mutator: (candidate) => {
          directRan = true;
          candidate.getProjectProperties().author = 'After replay';
          return true;
        },
      });
      await Promise.resolve();
      expect(directRan).toBe(false);

      runtimeGate.resolve({ status: 'applied' });
      const undo = await undoPromise;
      const direct = await directPromise;
      expect(undo.status).toBe('committed');
      expect(direct.changed).toBe(true);
      expect(directRan).toBe(true);
      expect(session.read().data?.getProjectProperties().author).toBe('After replay');
    });

    it('proposes an oversized prepared direct action before publication and cancels without changing state', async () => {
      const { session, history } = setupTest({ bytesLimit: 500 });
      const beforeXml = session.read().data!.saveToString();

      const receipt = await history.commitDirectMutation({
        label: 'Oversized Direct Edit',
        mutator: (candidate) => {
          candidate.getGlobalOrcSco().setGlobalOrc('x'.repeat(2_000));
          return true;
        },
      });

      expect(receipt.changed).toBe(false);
      expect(receipt.oversizeProposal?.token).toBeTruthy();
      expect(session.read().data!.saveToString()).toBe(beforeXml);
      expect(history.read().length).toBe(0);

      const cancelResult = history.cancelOversizeProposal({
        proposalToken: receipt.oversizeProposal!.token,
      });
      expect(cancelResult).toEqual({ ok: true });
      expect(session.read().data!.saveToString()).toBe(beforeXml);
      expect(history.read().length).toBe(0);
    });

    it('rolls back oversized already-applied direct mutations and preserves a redo branch on cancel', async () => {
      const { session, history, context, recorder } = setupTest({ bytesLimit: 500 });
      const documentId = session.read().documentId!;

      await history.commit(
        context.nextCommitRequest(documentId, 0, 'Branching Edit', [
          { projectProperties: { title: 'Branch' } },
        ]),
      );
      await history.undo(context.nextUndoRequest(documentId, 1));
      const beforeXml = session.read().data!.saveToString();
      const beforeMemento = session.read().data!.historyCopy();
      session.read().data!.getGlobalOrcSco().setGlobalOrc('y'.repeat(2_000));
      const afterMemento = session.read().data!.historyCopy();

      const receipt = history.recordDirectStructureMutation({
        label: 'Oversized Applied Direct Edit',
        beforeMemento,
        afterMemento,
      });

      expect(receipt.changed).toBe(false);
      expect(receipt.oversizeProposal?.token).toBeTruthy();
      expect(session.read().data!.saveToString()).toBe(beforeXml);
      expect(history.read().canRedo).toBe(true);
      expect(history.read().length).toBe(1);
      expect(recorder.latest()?.history.canRedo).toBe(true);

      const cancelResult = history.cancelOversizeProposal({
        proposalToken: receipt.oversizeProposal!.token,
      });
      expect(cancelResult).toEqual({ ok: true });
      expect(session.read().data!.saveToString()).toBe(beforeXml);
      expect(history.read().canRedo).toBe(true);
    });

    it('consumes one direct oversize proposal exactly once when explicitly confirmed', async () => {
      const { session, history } = setupTest({ bytesLimit: 500 });
      const beforeMemento = session.read().data!.historyCopy();
      const afterMemento = beforeMemento.historyCopy();
      afterMemento.getGlobalOrcSco().setGlobalOrc('z'.repeat(2_000));
      session.read().data!.getGlobalOrcSco().setGlobalOrc('z'.repeat(2_000));

      const proposal = history.recordDirectStructureMutation({
        label: 'Confirm Oversized Direct Edit',
        beforeMemento,
        afterMemento,
      });
      const token = proposal.oversizeProposal!.token;

      const confirmed = history.recordDirectStructureMutation({
        label: 'Confirm Oversized Direct Edit',
        beforeMemento,
        afterMemento,
        proposalToken: token,
      });
      expect(confirmed.changed).toBe(true);
      // Explicit confirmation authorizes the documented history reset. The
      // oversized action is applied, but cannot be retained under the limit.
      expect(history.read().length).toBe(0);
      expect(history.read().canUndo).toBe(false);
      expect(session.read().data!.getGlobalOrcSco().getGlobalOrc()).toBe('z'.repeat(2_000));

      const reused = history.recordDirectStructureMutation({
        label: 'Confirm Oversized Direct Edit',
        beforeMemento,
        afterMemento,
        proposalToken: token,
      });
      expect(reused.changed).toBe(false);
      expect(reused.error).toMatch(/invalid|stale|consumed/i);
    });
  });
});
