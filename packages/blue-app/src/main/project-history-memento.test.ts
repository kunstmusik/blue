import { describe, expect, it, vi } from 'vitest';
import {
  BlueData,
  Channel,
  Effect,
  Parameter,
  TrackLayerGroup,
  AudioClip,
  BlueSynthBuilder,
} from '@blue/data';
import {
  prepareTransaction,
  validatePreconditions,
  rollbackScalarRecords,
  restoreStructuralMemento,
  type ScalarFieldRecord,
} from './project-history-memento';
import { ProjectSession } from './project-session';
import { applyProjectGraphDelta } from './project-history-graph';
import {
  assignExplicitMixerChannelSnapshotId,
  assignExplicitScoreObjectId,
  getKnownMixerChannelSnapshotId,
  getScoreObjectId,
} from '../shared/project-editor/identity';

describe('project-history-memento', () => {
  describe('validatePreconditions', () => {
    it('validates property, text, mixerChannel, and parameter preconditions', () => {
      const data = new BlueData();
      data.getProjectProperties().title = 'Original Title';
      data.getGlobalOrcSco().setGlobalOrc('sr = 44100');

      const ch = new Channel();
      ch.setName('Bass');
      ch.setLevel(0.7);
      assignExplicitMixerChannelSnapshotId(ch, 'bass-chan-id');
      data.getMixer().getChannels().push(ch);

      // 1. All valid preconditions pass
      const pass = validatePreconditions(data, [
        {
          targetType: 'property',
          targetId: 'projectProperties',
          field: 'title',
          expectedValue: 'Original Title',
        },
        { targetType: 'text', targetId: 'globalOrc', expectedValue: 'sr = 44100' },
        { targetType: 'mixerChannel', targetId: 'Bass', field: 'level', expectedValue: 0.7 },
      ]);
      expect(pass.valid).toBe(true);

      // 2. Value mismatch fails
      const failVal = validatePreconditions(data, [
        {
          targetType: 'property',
          targetId: 'projectProperties',
          field: 'title',
          expectedValue: 'Different',
        },
      ]);
      expect(failVal.valid).toBe(false);
      expect(failVal.reason).toContain('Precondition value mismatch');

      // 3. Target not found fails
      const failTarget = validatePreconditions(data, [
        { targetType: 'mixerChannel', targetId: 'NonexistentChannel' },
      ]);
      expect(failTarget.valid).toBe(false);
      expect(failTarget.reason).toContain('not found');
    });
  });

  describe('scalar transaction preparation and exact no-throw rollback', () => {
    it('captures scalar field records and applies them', () => {
      const data = new BlueData();
      data.getProjectProperties().title = 'Initial Title';
      data.getGlobalOrcSco().setGlobalOrc('sr = 44100');

      const result = prepareTransaction(data, [
        {
          projectProperties: { title: 'New Title' },
          globalOrc: 'sr = 48000',
        },
      ]);

      expect(result.status).toBe('prepared');
      if (result.status !== 'prepared') return;

      expect(result.transaction.kind).toBe('scalar');
      if (result.transaction.kind !== 'scalar') return;

      expect(result.transaction.changed).toBe(true);
      expect(result.transaction.records.length).toBe(2);

      // Verify that values were applied
      expect(data.getProjectProperties().title).toBe('New Title');
      expect(data.getGlobalOrcSco().getGlobalOrc()).toBe('sr = 48000');

      // Verify exact no-throw rollback
      result.transaction.rollback();
      expect(data.getProjectProperties().title).toBe('Initial Title');
      expect(data.getGlobalOrcSco().getGlobalOrc()).toBe('sr = 44100');
    });

    it('rollback never throws even when encountering corrupt records', () => {
      const data = new BlueData();
      const corruptRecords: ScalarFieldRecord[] = [
        {
          targetType: 'text',
          targetId: 'globalOrc',
          field: 'text',
          beforeValue: 'sr = 44100',
          afterValue: 'sr = 48000',
        },
        {
          targetType: 'property',
          targetId: 'projectProperties',
          field: 'invalidProp',
          beforeValue: undefined,
          afterValue: 'bad',
        },
      ];

      expect(() => {
        rollbackScalarRecords(data, corruptRecords);
      }).not.toThrow();

      expect(data.getGlobalOrcSco().getGlobalOrc()).toBe('sr = 44100');
    });

    it('returns empty transaction when patches have no changes', () => {
      const data = new BlueData();
      const result = prepareTransaction(data, [{}]);
      expect(result.status).toBe('prepared');
      if (result.status !== 'prepared') return;
      expect(result.transaction.kind).toBe('empty');
      expect(result.transaction.changed).toBe(false);
    });
  });

  describe('structural transaction preparation and detached candidate publication', () => {
    it('prepares a structural edit with only one whole-project copy', () => {
      const data = new BlueData();
      const copies = vi.spyOn(BlueData.prototype, 'historyCopy');
      try {
        const result = prepareTransaction(data, [
          { orchestra: { type: 'addInstrument', instrumentType: 'generic' } },
        ]);
        expect(result.status).toBe('prepared');
        expect(copies).toHaveBeenCalledOnce();
      } finally {
        copies.mockRestore();
      }
    });
    it('isolates the candidate and delta, preserves identities and leaves source intact', () => {
      const data = new BlueData();
      data.getScore().length = 0;
      const tlg = new TrackLayerGroup();
      data.getScore().push(tlg);
      const track = tlg.newLayerAt(0);

      const clip = new AudioClip();
      assignExplicitScoreObjectId(clip, 'clip-orig-1');
      track.push(clip);

      // Force structural or pass structural patch (e.g. adding an instrument)
      const result = prepareTransaction(data, [
        {
          orchestra: {
            type: 'addInstrument',
            instrumentType: 'generic',
          },
        },
      ]);

      expect(result.status).toBe('prepared');
      if (result.status !== 'prepared') return;

      expect(result.transaction.kind).toBe('structure');
      if (result.transaction.kind !== 'structure') return;

      const { candidate, delta, changed } = result.transaction;
      expect(changed).toBe(true);

      expect(candidate).not.toBe(data);

      // Verify source data was NOT mutated
      expect(data.getArrangement().size()).toBe(0);

      // Verify candidate was mutated
      expect(candidate.getArrangement().size()).toBe(1);

      // Verify sidecars were transferred
      const candClip = (candidate.getScore()[0] as TrackLayerGroup)[0][0];
      expect(getScoreObjectId(candClip)).toBe('clip-orig-1');

      const originalXml = data.saveToString();
      const expectedXml = candidate.saveToString();
      candidate.getArrangement().getInstrument(0)!.setName('Changed after capture');
      candClip.setName('Changed candidate clip');
      expect(data.saveToString()).toBe(originalXml);

      applyProjectGraphDelta(data, delta, 'after');
      expect(data.saveToString()).toBe(expectedXml);
      expect((data.getScore()[0] as TrackLayerGroup)[0][0]).toBe(clip);
      expect(getScoreObjectId(clip)).toBe('clip-orig-1');
      applyProjectGraphDelta(data, delta, 'before');
      expect(data.saveToString()).toBe(originalXml);
      applyProjectGraphDelta(data, delta, 'after');
      expect(data.saveToString()).toBe(expectedXml);
    });

    it('rejects transaction when preconditions fail with stale status', () => {
      const data = new BlueData();
      data.getProjectProperties().title = 'Title A';

      const result = prepareTransaction(data, [{ projectProperties: { title: 'Title B' } }], {
        preconditions: [
          {
            targetType: 'property',
            targetId: 'projectProperties',
            field: 'title',
            expectedValue: 'Wrong Title',
          },
        ],
      });

      expect(result.status).toBe('stale');
      expect((result as { reason: string }).reason).toContain('Precondition value mismatch');
      expect(data.getProjectProperties().title).toBe('Title A');
    });

    it('restores structural memento into a project session without aliasing', () => {
      const session = new ProjectSession();
      const initial = new BlueData();
      initial.getProjectProperties().title = 'State 1';
      session.replace(initial, '/path/doc.blue');

      const mementoData = new BlueData();
      mementoData.getProjectProperties().title = 'State 2 (Memento)';

      const snap = restoreStructuralMemento(session, mementoData, {
        stateId: 'state-restored-2',
      });

      expect(snap.data?.getProjectProperties().title).toBe('State 2 (Memento)');
      expect(snap.filePath).toBe('/path/doc.blue');
      expect(snap.stateId).toBe('state-restored-2');
      expect(snap.revision).toBe(1);

      // Mutating session.data does not mutate mementoData
      snap.data!.getProjectProperties().title = 'Mutated Active';
      expect(mementoData.getProjectProperties().title).toBe('State 2 (Memento)');
    });
  });
});
