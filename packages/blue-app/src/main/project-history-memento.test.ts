import { describe, expect, it, vi } from 'vitest';
import {
  BlueData,
  Channel,
  Effect,
  LiveObject,
  Parameter,
  PianoRoll,
  Track,
  TrackLayerGroup,
  TrackerObject,
  AudioClip,
  BlueSynthBuilder,
  BSBHSlider,
  GenericInstrument,
  GenericScore,
  PolyObject,
  SoundLayer,
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
  createProjectEditorSnapshot,
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
    it('undoes root transport and plugin changes with a scoped structural delta', () => {
      const data = new BlueData();
      data.setRenderEndTime(4);
      const library = data.getSoundObjectLibrary();
      const copies = vi.spyOn(data, 'historyCopy');
      const prepared = prepareTransaction(data, [
        {
          transport: { renderStartTime: 8 },
          clojureProject: {
            libraryEntries: [
              { entryId: 'plugin-entry', dependencyCoordinates: 'example/audio', version: '1' },
            ],
          },
        },
        { globalOrc: 'sr = 48000' },
      ]);
      expect(copies).not.toHaveBeenCalled();
      expect(data.getRenderStartTime()).toBe(0);
      expect(data.getRenderEndTime()).toBe(4);
      expect(data.getClojureProjectData()).toBeNull();
      expect(prepared.status === 'prepared' && prepared.transaction.kind).toBe('structure');
      if (prepared.status !== 'prepared' || prepared.transaction.kind !== 'structure') return;
      const { delta, apply } = prepared.transaction;
      expect(delta.rootFields).toEqual([
        'pluginDataXml',
        'renderStartTime',
        'renderEndTime',
        'loopRendering',
        'globalOrcSco',
      ]);
      apply?.();
      expect(data.getRenderEndTime()).toBe(-1);
      expect(data.getClojureProjectData()?.getLibraryEntries()).toHaveLength(1);
      expect(
        createProjectEditorSnapshot(data, null).clojureProject?.libraryEntries[0]?.entryId,
      ).toBe('plugin-entry');
      applyProjectGraphDelta(data, delta, 'before');
      expect(data.getRenderStartTime()).toBe(0);
      expect(data.getRenderEndTime()).toBe(4);
      expect(data.getClojureProjectData()).toBeNull();
      applyProjectGraphDelta(data, delta, 'after');
      expect(data.getClojureProjectData()?.getLibraryEntries()).toHaveLength(1);
      expect(data.getSoundObjectLibrary()).toBe(library);
    });

    it('isolates bounded structural edits without a whole-project copy and uses one copy when forced', () => {
      const data = new BlueData();
      const copies = vi.spyOn(BlueData.prototype, 'historyCopy');
      try {
        const isolated = prepareTransaction(data, [
          { orchestra: { type: 'addInstrument', instrumentType: 'generic' } },
        ]);
        expect(isolated.status).toBe('prepared');
        expect(copies).not.toHaveBeenCalled();

        const forced = prepareTransaction(
          data,
          [{ orchestra: { type: 'addInstrument', instrumentType: 'generic' } }],
          { forceStructural: true },
        );
        expect(forced.status).toBe('prepared');
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

    it('isolates leaf ScoreObject/AudioClip edits and section edits without BlueData.historyCopy and roundtrips commit/undo/redo', async () => {
      const data = new BlueData();
      data.getScore().length = 0;
      const poly = new PolyObject();
      const layer0 = poly.newLayerAt(0);
      const layer1 = poly.newLayerAt(1);

      const gs = new GenericScore();
      gs.setName('Score A');
      gs.setScoreText('i1 0 1 440');

      const pr = new PianoRoll();
      pr.setName('Piano A');
      pr.setInstrumentId('1');

      const tr = new TrackerObject();
      tr.setName('Tracker A');
      tr.getTracks().setSteps(4);
      tr.getTracks().addTrack(new Track());

      const clip = new AudioClip();
      clip.setName('Clip A');
      clip.setFadeIn(0);

      layer0.push(gs, pr, tr);
      const trackGroup = new TrackLayerGroup();
      const audioTrack = trackGroup.newLayerAt(0);
      audioTrack.push(clip);
      data.getScore().push(poly, trackGroup);

      const snap = createProjectEditorSnapshot(data, '/tmp/isolated-leaf-section.blue');
      const groupId = snap.score!.layerGroups[0]!.groupId;
      const [gsId, prId, trId] = snap.score!.layerGroups[0]!.layers[0]!.items.map(
        (item) => item.objectId,
      ) as [string, string, string];
      const clipId = snap.score!.layerGroups[1]!.layers[0]!.items[0]!.objectId;
      const makeTimelineTarget = (
        selectionId: string,
        objectType: string,
        rootGroupIndex: number,
        objectIndex: number,
      ) => ({
        selectionId,
        selectedObjectType: objectType,
        editorObjectType: objectType,
        ownerKind: 'timeline' as const,
        displayContext: 'timeline' as const,
        location: { rootGroupIndex, containerPath: [], layerIndex: 0, objectIndex },
        supportsTimeBehavior: objectType !== 'AudioClip',
        supportsRepeatPoint: objectType !== 'AudioClip',
        supportsNoteProcessorChain: objectType !== 'AudioClip',
      });
      const gsTarget = makeTimelineTarget(gsId, 'GenericScore', 0, 0);
      const prTarget = makeTimelineTarget(prId, 'PianoRoll', 0, 1);
      const trTarget = makeTimelineTarget(trId, 'TrackerObject', 0, 2);
      const clipTarget = makeTimelineTarget(clipId, 'AudioClip', 1, 0);

      const session = new ProjectSession();
      session.replace(data, '/tmp/isolated-leaf-section.blue');
      const history = new ProjectHistory({ session });
      const docId = session.read().documentId!;
      const origin = { contextId: 'isolated-test' };
      let revision = 0;
      let contextSequence = 1;

      const historyCopySpy = vi.spyOn(BlueData.prototype, 'historyCopy');
      try {
        // 1. Leaf GenericScore update
        const r1 = await history.commit({
          documentId: docId,
          expectedRevision: revision,
          origin,
          contextSequence: contextSequence++,
          operationId: 'op-leaf-gs',
          label: 'Edit GenericScore',
          patches: [
            {
              score: {
                type: 'updateTypeSpecificEditor',
                target: gsTarget,
                patch: { text: 'i1 0 2 880' },
              },
            },
          ],
        });
        expect(r1.status).toBe('committed');
        revision += 1;
        expect(historyCopySpy).not.toHaveBeenCalled();

        // 2. Leaf PianoRoll update
        const r2 = await history.commit({
          documentId: docId,
          expectedRevision: revision,
          origin,
          contextSequence: contextSequence++,
          operationId: 'op-leaf-pr',
          label: 'Edit PianoRoll',
          patches: [
            {
              score: {
                type: 'updateTypeSpecificEditor',
                target: prTarget,
                patch: { instrumentId: '2', snapEnabled: true, snapValue: 'EIGHTH' },
              },
            },
          ],
        });
        expect(r2.status).toBe('committed');
        revision += 1;
        expect(historyCopySpy).not.toHaveBeenCalled();

        // 3. Leaf TrackerObject update
        const r3 = await history.commit({
          documentId: docId,
          expectedRevision: revision,
          origin,
          contextSequence: contextSequence++,
          operationId: 'op-leaf-tr',
          label: 'Edit Tracker Cell',
          patches: [
            {
              score: {
                type: 'updateTypeSpecificEditor',
                target: trTarget,
                patch: {
                  updateTrackCell: { trackIndex: 0, columnIndex: 0, stepIndex: 0, value: '8.02' },
                },
              },
            },
          ],
        });
        expect(r3.status).toBe('committed');
        revision += 1;
        expect(historyCopySpy).not.toHaveBeenCalled();

        // 4. Leaf AudioClip update
        const r4 = await history.commit({
          documentId: docId,
          expectedRevision: revision,
          origin,
          contextSequence: contextSequence++,
          operationId: 'op-leaf-clip',
          label: 'Edit AudioClip FadeIn',
          patches: [
            {
              score: {
                type: 'updateTypeSpecificEditor',
                target: clipTarget,
                patch: { fadeIn: 1.5 },
              },
            },
          ],
        });
        expect(r4.status).toBe('committed');
        revision += 1;
        expect(historyCopySpy).not.toHaveBeenCalled();

        // 5. Section Mixer update (addSubChannel)
        const r5 = await history.commit({
          documentId: docId,
          expectedRevision: revision,
          origin,
          contextSequence: contextSequence++,
          operationId: 'op-section-mixer',
          label: 'Add SubChannel',
          patches: [
            {
              mixer: {
                type: 'addSubChannel',
                name: 'Sub Bus',
              },
            },
          ],
        });
        expect(r5.status).toBe('committed');
        revision += 1;
        expect(historyCopySpy).not.toHaveBeenCalled();

        // 6. Section Score update (moveScoreObjects across layers)
        const r6 = await history.commit({
          documentId: docId,
          expectedRevision: revision,
          origin,
          contextSequence: contextSequence++,
          operationId: 'op-section-move',
          label: 'Move Score Object',
          patches: [
            {
              score: {
                type: 'moveScoreObjects',
                moves: [
                  {
                    target: gsTarget,
                    targetGroupId: groupId,
                    targetLayerIndex: 1,
                    targetStartBeats: 2,
                  },
                ],
              },
            },
          ],
        });
        expect(r6.status).toBe('committed');
        revision += 1;
        expect(historyCopySpy).not.toHaveBeenCalled();

        const liveData = session.read().data!;
        const movedLayer1 = liveData.getScore()[0]![1] as SoundLayer;
        expect(movedLayer1[0]).toBeInstanceOf(GenericScore);
        expect(getScoreObjectId(movedLayer1[0]!)).toBe(gsId);
        expect((movedLayer1[0] as GenericScore).getScoreText()).toBe('i1 0 2 880');
        expect(pr.getInstrumentId()).toBe('2');
        expect(tr.getTracks().getTrack(0)?.getTrackerNote(0).getValue(1)).toBe('8.02');
        expect(clip.getFadeIn()).toBe(1.5);
        expect(liveData.getMixer().getSubChannels()).toHaveLength(1);

        // Undo all 6 edits back to baseline and verify zero historyCopy calls + state restoration.
        for (let i = 0; i < 6; i += 1) {
          const u = await history.undo({
            documentId: docId,
            expectedRevision: revision,
            origin,
            contextSequence: contextSequence++,
            operationId: `op-undo-iso-${i}`,
          });
          expect(u.status).toBe('committed');
          revision += 1;
        }
        expect(historyCopySpy).not.toHaveBeenCalled();

        const afterUndoData = session.read().data!;
        const afterUndoLayer0 = afterUndoData.getScore()[0]![0] as SoundLayer;
        expect(afterUndoLayer0).toHaveLength(3);
        expect((afterUndoLayer0[0] as GenericScore).getScoreText()).toBe('i1 0 1 440');
        expect((afterUndoLayer0[1] as PianoRoll).getInstrumentId()).toBe('1');
        expect(
          ((afterUndoData.getScore()[1] as TrackLayerGroup)[0]![0] as AudioClip).getFadeIn(),
        ).toBe(0);
        expect(afterUndoData.getMixer().getSubChannels()).toHaveLength(0);

        // Redo all 6 edits and verify final state + stable score object ID + zero historyCopy calls.
        for (let i = 0; i < 6; i += 1) {
          const r = await history.redo({
            documentId: docId,
            expectedRevision: revision,
            origin,
            contextSequence: contextSequence++,
            operationId: `op-redo-iso-${i}`,
          });
          expect(r.status).toBe('committed');
          revision += 1;
        }
        expect(historyCopySpy).not.toHaveBeenCalled();

        const afterRedoData = session.read().data!;
        const afterRedoLayer1 = afterRedoData.getScore()[0]![1] as SoundLayer;
        expect(afterRedoLayer1).toHaveLength(1);
        expect(getScoreObjectId(afterRedoLayer1[0]!)).toBe(gsId);
        expect((afterRedoLayer1[0] as GenericScore).getScoreText()).toBe('i1 0 2 880');
        expect(
          ((afterRedoData.getScore()[1] as TrackLayerGroup)[0]![0] as AudioClip).getFadeIn(),
        ).toBe(1.5);
        expect(afterRedoData.getMixer().getSubChannels()).toHaveLength(1);
      } finally {
        historyCopySpy.mockRestore();
      }
    });

    it('isolates removeAutomationFromLayer across score and mixer/arrangement on commit, undo, and redo', async () => {
      const data = new BlueData();
      data.getMixer().setEnabled(true);
      const eff = new Effect();
      eff.setName('Delay');
      const param = new Parameter();
      param.setName('feedback');
      param.setAutomationEnabled(true);
      eff.addParameter(param);
      data.getMixer().getMaster().getPreEffects().push(eff);

      const snap = createProjectEditorSnapshot(data, '/tmp/remove-auto-iso.blue');
      const groupSnap = snap.score!.layerGroups[0]!;
      const layer0 = data.getScore()[0]![0] as SoundLayer;
      layer0.getAutomationParameters().addParameterId(param.getUniqueId());

      const session = new ProjectSession();
      session.replace(data, '/tmp/remove-auto-iso.blue');
      const history = new ProjectHistory({ session });
      const docId = session.read().documentId!;
      const origin = { contextId: 'automation-test' };
      const layerRef = {
        rootGroupIndex: 0,
        groupId: groupSnap.groupId,
        layerId: groupSnap.layers[0]!.layerId,
        layerIndex: 0,
        layerKind: 'soundObject' as const,
      };

      const historyCopySpy = vi.spyOn(BlueData.prototype, 'historyCopy');
      try {
        const c = await history.commit({
          documentId: docId,
          expectedRevision: 0,
          origin,
          contextSequence: 1,
          operationId: 'op-remove-auto',
          label: 'Remove Automation',
          patches: [
            {
              score: {
                type: 'removeAutomationFromLayer',
                layer: layerRef,
                parameterId: param.getUniqueId(),
              },
            },
          ],
        });
        expect(c.status).toBe('committed');
        expect(historyCopySpy).not.toHaveBeenCalled();
        expect(param.isAutomationEnabled()).toBe(false);
        expect(layer0.getAutomationParameters().getIds()).toEqual([]);

        const u = await history.undo({
          documentId: docId,
          expectedRevision: 1,
          origin,
          contextSequence: 2,
          operationId: 'op-undo-remove-auto',
        });
        expect(u.status).toBe('committed');
        expect(historyCopySpy).not.toHaveBeenCalled();
        expect(param.isAutomationEnabled()).toBe(true);
        expect(layer0.getAutomationParameters().getIds()).toEqual([param.getUniqueId()]);

        const r = await history.redo({
          documentId: docId,
          expectedRevision: 2,
          origin,
          contextSequence: 3,
          operationId: 'op-redo-remove-auto',
        });
        expect(r.status).toBe('committed');
        expect(historyCopySpy).not.toHaveBeenCalled();
        expect(param.isAutomationEnabled()).toBe(false);
        expect(layer0.getAutomationParameters().getIds()).toEqual([]);
      } finally {
        historyCopySpy.mockRestore();
      }
    });

    it('clones liveData for a multi-patch batch editing a Blue Live sound object and UDO without mutating live project data during preparation', async () => {
      const data = new BlueData();
      const liveScore = new GenericScore();
      liveScore.setName('Live Pattern');
      liveScore.setScoreText('i1 0 1 440');
      const liveObject = new LiveObject();
      liveObject.setUniqueId('live-cell-1');
      liveObject.setEnabled(true);
      liveObject.setSoundObject(liveScore);
      data.getLiveData().getLiveObjectBins().setLiveObject(0, 0, liveObject);

      const session = new ProjectSession();
      session.replace(data, '/tmp/bluelive-udo-iso.blue');
      const history = new ProjectHistory({ session });
      const docId = session.read().documentId!;
      const origin = { contextId: 'bluelive-batch-test' };
      const liveTarget = {
        selectionId: 'bluelive-sel-1',
        selectedObjectType: 'GenericScore',
        editorObjectType: 'GenericScore',
        ownerKind: 'blueLive' as const,
        displayContext: 'blueLive' as const,
        blueLive: {
          liveObjectId: 'live-cell-1',
          column: 0,
          row: 0,
        },
        supportsTimeBehavior: true,
        supportsRepeatPoint: true,
        supportsNoteProcessorChain: true,
      };

      const historyCopySpy = vi.spyOn(BlueData.prototype, 'historyCopy');
      try {
        // Preparing the batch must clone liveData rather than mutating the live SoundObject before commit.
        const prepared = prepareTransaction(data, [
          {
            score: {
              type: 'updateTypeSpecificEditor',
              target: liveTarget,
              patch: { text: 'i1 0 2 880' },
            },
          },
          {
            projectUdo: {
              type: 'add',
              definition: {
                name: 'PreparedOnlyUdo',
                style: 'CLASSIC',
                outTypes: 'a',
                inTypes: 'a',
                inputArguments: '',
                code: 'xout ain',
                comments: '',
              },
            },
          },
        ]);
        expect(prepared.status).toBe('prepared');
        if (prepared.status === 'prepared') {
          expect(prepared.transaction.kind).toBe('structure');
          if (prepared.transaction.kind === 'structure') {
            expect(prepared.transaction.changed).toBe(true);
            expect(prepared.transaction.delta).toBeDefined();
          }
        }
        expect(historyCopySpy).not.toHaveBeenCalled();
        expect(
          (
            data
              .getLiveData()
              .getLiveObjectBins()
              .getLiveObject(0, 0)
              ?.getSoundObject() as GenericScore
          ).getScoreText(),
        ).toBe('i1 0 1 440');

        const committed = await history.commit({
          documentId: docId,
          expectedRevision: 0,
          origin,
          contextSequence: 2,
          operationId: 'op-bluelive-batch-commit',
          label: 'Edit Blue Live Object and Add UDO',
          patches: [
            {
              score: {
                type: 'updateTypeSpecificEditor',
                target: liveTarget,
                patch: { text: 'i1 0 2 880' },
              },
            },
            {
              projectUdo: {
                type: 'add',
                definition: {
                  name: 'BatchUdo',
                  style: 'CLASSIC',
                  outTypes: 'a',
                  inTypes: 'a',
                  inputArguments: '',
                  code: 'xout ain',
                  comments: '',
                },
              },
            },
          ],
        });
        expect(committed.status).toBe('committed');
        expect(historyCopySpy).not.toHaveBeenCalled();
        const afterCommit = session.read().data!;
        expect(
          (
            afterCommit
              .getLiveData()
              .getLiveObjectBins()
              .getLiveObject(0, 0)
              ?.getSoundObject() as GenericScore
          ).getScoreText(),
        ).toBe('i1 0 2 880');
        expect(afterCommit.getOpcodeList().size()).toBe(1);
        expect(afterCommit.getOpcodeList().getOpcode(0)?.getName()).toBe('BatchUdo');

        const undone = await history.undo({
          documentId: docId,
          expectedRevision: 1,
          origin,
          contextSequence: 3,
          operationId: 'op-bluelive-batch-undo',
        });
        expect(undone.status).toBe('committed');
        expect(historyCopySpy).not.toHaveBeenCalled();
        const afterUndo = session.read().data!;
        expect(
          (
            afterUndo
              .getLiveData()
              .getLiveObjectBins()
              .getLiveObject(0, 0)
              ?.getSoundObject() as GenericScore
          ).getScoreText(),
        ).toBe('i1 0 1 440');
        expect(afterUndo.getOpcodeList().size()).toBe(0);

        const redone = await history.redo({
          documentId: docId,
          expectedRevision: 2,
          origin,
          contextSequence: 4,
          operationId: 'op-bluelive-batch-redo',
        });
        expect(redone.status).toBe('committed');
        expect(historyCopySpy).not.toHaveBeenCalled();
        const afterRedo = session.read().data!;
        expect(
          (
            afterRedo
              .getLiveData()
              .getLiveObjectBins()
              .getLiveObject(0, 0)
              ?.getSoundObject() as GenericScore
          ).getScoreText(),
        ).toBe('i1 0 2 880');
        expect(afterRedo.getOpcodeList().size()).toBe(1);
        expect(afterRedo.getOpcodeList().getOpcode(0)?.getName()).toBe('BatchUdo');
      } finally {
        historyCopySpy.mockRestore();
      }
    });
  });
});
