import { describe, expect, it, vi } from 'vitest';
import {
  BlueData,
  Channel,
  Effect,
  Parameter,
  TrackLayerGroup,
  AudioClip,
  BlueSynthBuilder,
  BSBHSlider,
  GenericInstrument,
  GenericScore,
  PolyObject,
  TimePosition,
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
import {
  createScopedProjectEditorSnapshot,
  reconcileMixerWithArrangement,
  type ProjectEditorSnapshot,
} from '../shared/project-editor';
import { ProjectHistory } from './project-history';

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

    it('prepares single-owner instrument structure transactions without whole-project historyCopy', () => {
      const data = new BlueData();
      const bsb = new BlueSynthBuilder();
      bsb.setName('Lead');
      bsb.setComment('initial');
      data.getArrangement().addInstrument(bsb, '1');

      const historyCopySpy = vi.spyOn(BlueData.prototype, 'historyCopy');
      try {
        const result = prepareTransaction(data, [
          {
            orchestra: {
              type: 'updateInstrumentComment',
              assignmentId: '1',
              comment: 'Updated instrument notes',
            },
          },
        ]);

        expect(result.status).toBe('prepared');
        if (result.status !== 'prepared') {
          throw new Error('Expected prepared transaction');
        }
        expect(result.transaction.kind).toBe('structure');
        expect(result.transaction.changed).toBe(true);
        expect(historyCopySpy).not.toHaveBeenCalled();

        if (result.transaction.kind === 'structure') {
          result.transaction.apply?.();
        }
        expect(data.getArrangement().getInstrumentById('1')?.getComment()).toBe(
          'Updated instrument notes',
        );
      } finally {
        historyCopySpy.mockRestore();
      }
    });

    it('builds scoped snapshot publications reusing unchanged sections when targets are known', () => {
      const data = new BlueData();
      const bsb = new BlueSynthBuilder();
      bsb.setName('Lead');
      data.getArrangement().addInstrument(bsb, '1');

      const mixerScoped = createScopedProjectEditorSnapshot(data, '/test.blue', 1, 'doc-1', [
        'mixerChannel:Master',
      ]);
      expect(mixerScoped.mixer).toBeDefined();
      expect(mixerScoped.score).toBeUndefined();
      expect(mixerScoped.orchestra).toBeUndefined();

      const instScoped = createScopedProjectEditorSnapshot(data, '/test.blue', 1, 'doc-1', [
        'instrument:1',
      ]);
      expect(instScoped.orchestra).toBeDefined();
      expect(instScoped.mixer).toBeDefined();
      expect(instScoped.projectUdos).toBeDefined();
      expect(instScoped.score).toBeUndefined();

      const fallback = createScopedProjectEditorSnapshot(data, '/test.blue', 1, 'doc-1', [
        'unknown-target',
      ]);
      expect(fallback.score).toBeDefined();
      expect(fallback.orchestra).toBeDefined();
      expect(fallback.mixer).toBeDefined();
    });

    it.each(['tempo', 'resolution', 'resolutionDecimal'] as const)(
      'publishes updated score data for %s edits through commit, undo, and redo',
      async (edit) => {
        const data = new BlueData();
        data.getScore().length = 0;
        const poly = new PolyObject(true);
        const layer = poly.newLayerAt(0);
        const object = new GenericScore();
        object.setStartTime(TimePosition.seconds(10));
        layer.push(object);
        data.getScore().push(poly);
        const tempoMap = data.getScore().getTimeContext().getTempoMap();
        tempoMap.setTempo(120);
        tempoMap.setEnabled(false);

        const instrument = new BlueSynthBuilder();
        const slider = new BSBHSlider();
        slider.id = 'gain-slider';
        slider.objectName = 'gain';
        instrument.getGraphicInterface().getRootGroup().addChild(slider);
        data.getArrangement().addInstrument(instrument, '1');
        const parameter = instrument.getParameters()[0]!;
        layer.getAutomationParameters().addParameterId(parameter.getUniqueId());
        const initialResolution = parameter.getResolution();

        const session = new ProjectSession();
        session.replace(data, '/tmp/score-scope.blue');
        const { documentId, sessionId, filePath } = session.read();
        let published: ProjectEditorSnapshot | undefined;
        const history = new ProjectHistory({
          session,
          captureSnapshot: ({ changedTargets }) =>
            createScopedProjectEditorSnapshot(
              session.read().data!,
              filePath,
              sessionId,
              documentId!,
              changedTargets,
            ),
          publishUpdated: (event) => {
            published = event.snapshot as ProjectEditorSnapshot | undefined;
          },
        });
        const expectScore = (edited: boolean) => {
          const publishedLayer = published?.score?.layerGroups[0]?.layers[0];
          if (edit === 'tempo') {
            expect(published?.transport).toBeDefined();
            expect(published?.blueLive).toBeDefined();
            expect(publishedLayer).toMatchObject({
              items: [{ startBeats: edited ? 20 : 10 }],
            });
          } else {
            expect(publishedLayer?.automation?.parameters[0]?.resolution).toBe(
              edited ? 0.25 : initialResolution,
            );
          }
        };
        const context = { documentId: documentId!, origin: { contextId: 'score-scope' } };
        const commit = await history.commit({
          ...context,
          operationId: 'edit',
          expectedRevision: 0,
          contextSequence: 1,
          label: 'Update Score Context',
          patches: [
            edit === 'tempo'
              ? { transport: { tempoMap: { enabled: true } } }
              : {
                  orchestra: {
                    type: 'updateInstrument',
                    assignmentId: '1',
                    patch: {
                      bsbInterface: {
                        type: 'updateWidgetProperties',
                        widgetId: slider.id,
                        properties:
                          edit === 'resolution'
                            ? { resolution: 0.25 }
                            : { resolutionDecimal: '0.25' },
                      },
                    },
                  },
                },
          ],
        });
        expect(commit.status).toBe('committed');
        expectScore(true);
        const undo = await history.undo({
          ...context,
          operationId: 'undo',
          expectedRevision: 1,
          contextSequence: 2,
        });
        expect(undo.status).toBe('committed');
        expectScore(false);
        const redo = await history.redo({
          ...context,
          operationId: 'redo',
          expectedRevision: 2,
          contextSequence: 3,
        });
        expect(redo.status).toBe('committed');
        expectScore(true);
      },
    );

    it('includes updated score names in scoped publications for track-backed mixer renames on commit, undo, and redo', async () => {
      const data = new BlueData();
      data.getScore().length = 0;

      const group = new TrackLayerGroup();
      group.setName('Track Group');
      group.setUniqueId('group-1');
      const track = group.newLayerAt(0);
      track.setName('Lead Track');
      track.setUniqueId('track-1');
      data.getScore().push(group);
      reconcileMixerWithArrangement(data);

      const session = new ProjectSession();
      session.replace(data, '/tmp/mixer-rename-scope.blue');
      const publishedSnapshots: Array<ProjectEditorSnapshot | undefined> = [];
      const history = new ProjectHistory({
        session,
        captureSnapshot: ({ changedTargets }) => {
          const snap = session.read();
          return createScopedProjectEditorSnapshot(
            snap.data!,
            snap.filePath,
            snap.sessionId,
            snap.documentId!,
            changedTargets,
          );
        },
        publishUpdated: (event) => {
          publishedSnapshots.push(event.snapshot as ProjectEditorSnapshot | undefined);
        },
      });

      const docId = session.read().documentId!;
      const origin = { contextId: 'mixer-ui' };
      let contextSequence = 1;

      // Non-rename level edit keeps score omitted from scoped publication.
      const levelCommit = await history.commit({
        documentId: docId,
        expectedRevision: 0,
        origin,
        contextSequence: contextSequence++,
        operationId: 'op-level',
        label: 'Adjust Track Channel Level',
        patches: [{ mixer: { type: 'updateChannel', channelId: 'track-1', patch: { level: -3 } } }],
      });
      expect(levelCommit.status).toBe('committed');
      expect(publishedSnapshots.at(-1)?.mixer).toBeDefined();
      expect(publishedSnapshots.at(-1)?.score).toBeUndefined();

      // Track-backed channel rename includes score on commit, undo, and redo.
      const renameCommit = await history.commit({
        documentId: docId,
        expectedRevision: 1,
        origin,
        contextSequence: contextSequence++,
        operationId: 'op-rename-channel',
        label: 'Rename Track Channel',
        patches: [
          {
            mixer: {
              type: 'updateChannel',
              channelId: 'track-1',
              patch: { name: 'Lead Track Renamed' },
            },
          },
        ],
      });
      expect(renameCommit.status).toBe('committed');
      if (renameCommit.status === 'committed') {
        expect(renameCommit.changedTargets).toContain('score');
      }
      const commitScoreGroup = publishedSnapshots.at(-1)?.score?.layerGroups[0];
      expect(commitScoreGroup?.groupType).toBe('track');
      if (commitScoreGroup?.groupType === 'track') {
        expect(commitScoreGroup.layers[0]?.name).toBe('Lead Track Renamed');
      }

      const undoRename = await history.undo({
        documentId: docId,
        expectedRevision: 2,
        origin,
        contextSequence: contextSequence++,
        operationId: 'op-undo-rename-channel',
      });
      expect(undoRename.status).toBe('committed');
      const undoScoreGroup = publishedSnapshots.at(-1)?.score?.layerGroups[0];
      expect(undoScoreGroup?.groupType).toBe('track');
      if (undoScoreGroup?.groupType === 'track') {
        expect(undoScoreGroup.layers[0]?.name).toBe('Lead Track');
      }

      const redoRename = await history.redo({
        documentId: docId,
        expectedRevision: 3,
        origin,
        contextSequence: contextSequence++,
        operationId: 'op-redo-rename-channel',
      });
      expect(redoRename.status).toBe('committed');
      const redoScoreGroup = publishedSnapshots.at(-1)?.score?.layerGroups[0];
      expect(redoScoreGroup?.groupType).toBe('track');
      if (redoScoreGroup?.groupType === 'track') {
        expect(redoScoreGroup.layers[0]?.name).toBe('Lead Track Renamed');
      }

      // Channel list group rename includes score on commit, undo, and redo.
      const groupRenameCommit = await history.commit({
        documentId: docId,
        expectedRevision: 4,
        origin,
        contextSequence: contextSequence++,
        operationId: 'op-rename-group',
        label: 'Rename Track Group',
        patches: [
          {
            mixer: {
              type: 'renameChannelListGroup',
              association: 'group-1',
              name: 'Renamed Group',
            },
          },
        ],
      });
      expect(groupRenameCommit.status).toBe('committed');
      if (groupRenameCommit.status === 'committed') {
        expect(groupRenameCommit.changedTargets).toContain('score');
      }
      expect(publishedSnapshots.at(-1)?.score?.layerGroups[0]?.name).toBe('Renamed Group');

      const undoGroupRename = await history.undo({
        documentId: docId,
        expectedRevision: 5,
        origin,
        contextSequence: contextSequence++,
        operationId: 'op-undo-rename-group',
      });
      expect(undoGroupRename.status).toBe('committed');
      expect(publishedSnapshots.at(-1)?.score?.layerGroups[0]?.name).toBe('Track Group');

      const redoGroupRename = await history.redo({
        documentId: docId,
        expectedRevision: 6,
        origin,
        contextSequence: contextSequence++,
        operationId: 'op-redo-rename-group',
      });
      expect(redoGroupRename.status).toBe('committed');
      expect(publishedSnapshots.at(-1)?.score?.layerGroups[0]?.name).toBe('Renamed Group');
    });

    it('reconciles mixer channel on instrument rename and scopes tempo/mixer/orchestra sections safely', async () => {
      const data = new BlueData();
      const arrangementId = '1';
      const inst = new GenericInstrument();
      inst.setName('Bass Synth');
      data.getArrangement().addInstrument(inst, arrangementId);
      reconcileMixerWithArrangement(data);
      const eff = new Effect();
      eff.setName('Chorus');
      const channel = data
        .getMixer()
        .getChannels()
        .find((c) => c.getAssociation() === arrangementId)!;
      channel.getPreEffects().push(eff);
      reconcileMixerWithArrangement(data);

      const effectSnap = createScopedProjectEditorSnapshot(data, '/test.blue', 1, 'doc-1', [
        `mixerEntry:${arrangementId}:entry-1`,
      ]);
      expect(effectSnap.score).toBeDefined();
      expect(effectSnap.mixer).toBeDefined();

      const timeContextSnap = createScopedProjectEditorSnapshot(data, '/test.blue', 1, 'doc-1', [
        'transport:timeContext',
      ]);
      expect(timeContextSnap.transport).toBeDefined();
      expect(timeContextSnap.score).toBeDefined();
      expect(timeContextSnap.blueLive).toBeDefined();

      const session = new ProjectSession();
      session.replace(data, '/tmp/instrument-rename-reconcile.blue');
      const publishedSnapshots: Array<ProjectEditorSnapshot | undefined> = [];
      const history = new ProjectHistory({
        session,
        captureSnapshot: ({ changedTargets }) => {
          const snap = session.read();
          return createScopedProjectEditorSnapshot(
            snap.data!,
            snap.filePath,
            snap.sessionId,
            snap.documentId!,
            changedTargets,
          );
        },
        publishUpdated: (event) => {
          publishedSnapshots.push(event.snapshot as ProjectEditorSnapshot | undefined);
        },
      });

      const docId = session.read().documentId!;
      const origin = { contextId: 'orchestra-ui' };
      let contextSequence = 1;

      const commit = await history.commit({
        documentId: docId,
        expectedRevision: 0,
        origin,
        contextSequence: contextSequence++,
        operationId: 'op-rename-inst',
        label: 'Rename Instrument',
        patches: [
          {
            orchestra: {
              type: 'updateInstrument',
              assignmentId: arrangementId,
              patch: { name: 'Lead Bass' },
            },
          },
        ],
      });
      expect(commit.status).toBe('committed');
      expect(
        session.read().data!.getArrangement().getInstrumentById(arrangementId)?.getName(),
      ).toBe('Lead Bass');
      expect(publishedSnapshots.at(-1)?.score).toBeDefined();
      expect(publishedSnapshots.at(-1)?.orchestra?.arrangement.rows[0]?.instrumentName).toBe(
        'Lead Bass',
      );

      const undo = await history.undo({
        documentId: docId,
        expectedRevision: 1,
        origin,
        contextSequence: contextSequence++,
        operationId: 'op-undo-rename-inst',
      });
      expect(undo.status).toBe('committed');
      expect(
        session.read().data!.getArrangement().getInstrumentById(arrangementId)?.getName(),
      ).toBe('Bass Synth');

      const redo = await history.redo({
        documentId: docId,
        expectedRevision: 2,
        origin,
        contextSequence: contextSequence++,
        operationId: 'op-redo-rename-inst',
      });
      expect(redo.status).toBe('committed');
      expect(
        session.read().data!.getArrangement().getInstrumentById(arrangementId)?.getName(),
      ).toBe('Lead Bass');
    });
  });
});
