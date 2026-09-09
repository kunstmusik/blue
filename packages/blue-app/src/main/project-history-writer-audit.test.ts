import { describe, expect, it } from 'vitest';
import { BlueData, GenericInstrument, Channel, Effect, TrackLayerGroup } from '@blue/data';
import { ProjectSession } from './project-session';
import { ProjectHistory } from './project-history';
import { MockHistoryContext, FakePublicationRecorder } from './project-history-test-support';
import {
  classifyProjectDocumentPatch,
  validateProjectDocumentPatch,
  getMixerEntrySnapshotId,
  type ProjectDocumentPatch,
} from '../shared/project-editor';
import { prepareTransaction } from './project-history-memento';

describe('Project history canonical writer audit (T014)', () => {
  function setupTest() {
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
  });
});
