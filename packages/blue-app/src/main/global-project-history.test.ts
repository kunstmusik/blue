import { describe, expect, it } from 'vitest';
import { BlueData, GenericScore, TimeBase, TrackLayerGroup, beatsToTimePosition } from '@blue/data';
import { ProjectSession } from './project-session';
import { ProjectHistory } from './project-history';
import { MockHistoryContext, FakePublicationRecorder } from './project-history-test-support';
import { assignExplicitScoreObjectId, getScoreObjectId } from '../shared/project-editor/identity';
import { createOrchestraSnapshot } from '../shared/project-editor/snapshot-mixer-orchestra';
import type {
  ScoreObjectEditorTargetSnapshot,
  ScorePatch,
} from '../shared/project-editor/contract';

let trackGroupId = '';

function buildScoreData(): BlueData {
  const data = new BlueData();
  data.getScore().length = 0;
  const group = new TrackLayerGroup();
  data.getScore().push(group);
  const layer0 = group.newLayerAt(0);
  layer0.setName('Layer 0');
  const layer1 = group.newLayerAt(1);
  layer1.setName('Layer 1');
  trackGroupId = group.getUniqueId();

  const obj = new GenericScore();
  obj.setName('Lead Object');
  obj.setStartTime(beatsToTimePosition(4, TimeBase.BEATS, data.getScore().getTimeContext()));
  assignExplicitScoreObjectId(obj, 'sobj-1');
  layer0.push(obj);
  return data;
}

function scoreObjectAt(data: BlueData, layerIndex: number, objectIndex: number) {
  const group = data.getScore()[0] as TrackLayerGroup;
  return group[layerIndex][objectIndex];
}

function objectStartBeats(data: BlueData, layerIndex: number, objectIndex: number): number {
  const group = data.getScore()[0] as TrackLayerGroup;
  return group[layerIndex][objectIndex].getStartTime().toBeats(data.getScore().getTimeContext());
}

function layerCount(data: BlueData, layerIndex: number): number {
  const group = data.getScore()[0] as TrackLayerGroup;
  return group[layerIndex].length;
}

function movePatch(
  from: { layerIndex: number; objectIndex: number },
  targetLayerIndex: number,
  targetStartBeats: number,
): ProjectDocumentPatchSingle {
  const target: ScoreObjectEditorTargetSnapshot = {
    selectionId: 'sobj-1',
    selectedObjectType: 'GenericScore',
    editorObjectType: 'GenericScore',
    ownerKind: 'timeline',
    displayContext: 'timeline',
    supportsTimeBehavior: false,
    supportsRepeatPoint: false,
    supportsNoteProcessorChain: false,
    location: {
      rootGroupIndex: 0,
      containerPath: [],
      layerIndex: from.layerIndex,
      objectIndex: from.objectIndex,
    },
  };
  return {
    score: {
      type: 'moveScoreObjects',
      moves: [
        {
          target,
          targetGroupId: trackGroupId,
          targetLayerIndex,
          targetStartBeats,
        },
      ],
    } satisfies ScorePatch,
  };
}

type ProjectDocumentPatchSingle = Pick<
  import('../shared/project-editor/contract').ProjectDocumentPatch,
  'score' | 'projectProperties' | 'orchestra' | 'mixer'
>;

function setupHistory() {
  const session = new ProjectSession();
  const data = buildScoreData();
  session.replace(data, '/tmp/project.blue');

  const recorder = new FakePublicationRecorder();
  const history = new ProjectHistory({
    session,
    publishUpdated: (evt) => recorder.record(evt),
  });
  const contextA = new MockHistoryContext('ctx-a');
  const contextB = new MockHistoryContext('ctx-b');

  return { session, history, recorder, contextA, contextB };
}

describe('Global project history — User Story 1 regressions (T019)', () => {
  it('undoes and redoes a score-object move exactly with stable identity', async () => {
    const { session, history, contextA } = setupHistory();
    const docId = session.read().documentId!;

    const res = await history.commit(
      contextA.nextCommitRequest(docId, 0, 'Move Lead Object', [
        movePatch({ layerIndex: 0, objectIndex: 0 }, 1, 10),
      ]),
    );
    expect(res.status).toBe('committed');
    expect(layerCount(session.read().data!, 0)).toBe(0);
    expect(layerCount(session.read().data!, 1)).toBe(1);
    expect(getScoreObjectId(scoreObjectAt(session.read().data!, 1, 0))).toBe('sobj-1');
    expect(objectStartBeats(session.read().data!, 1, 0)).toBe(10);

    const undoRes = await history.undo({
      documentId: docId,
      operationId: 'undo-move-1',
      expectedRevision: 1,
      contextSequence: contextA.sequence + 1,
    });
    expect(undoRes.status).toBe('committed');
    expect(layerCount(session.read().data!, 0)).toBe(1);
    expect(layerCount(session.read().data!, 1)).toBe(0);
    expect(getScoreObjectId(scoreObjectAt(session.read().data!, 0, 0))).toBe('sobj-1');
    expect(objectStartBeats(session.read().data!, 0, 0)).toBe(4);

    const redoRes = await history.redo({
      documentId: docId,
      operationId: 'redo-move-1',
      expectedRevision: 2,
      contextSequence: contextA.sequence + 2,
    });
    expect(redoRes.status).toBe('committed');
    expect(layerCount(session.read().data!, 1)).toBe(1);
    expect(getScoreObjectId(scoreObjectAt(session.read().data!, 1, 0))).toBe('sobj-1');
    expect(objectStartBeats(session.read().data!, 1, 0)).toBe(10);
  });

  it('undoes a referenced instrument deletion and restores the same assignment identity', async () => {
    const { session, history, contextA } = setupHistory();
    const docId = session.read().documentId!;

    const addRes = await history.commit(
      contextA.nextCommitRequest(docId, 0, 'Add Instrument', [
        { orchestra: { type: 'addInstrument', instrumentType: 'generic' } },
      ]),
    );
    expect(addRes.status).toBe('committed');
    const assignmentId = createOrchestraSnapshot(session.read().data!).arrangement.rows[0]
      ?.assignmentId;
    expect(assignmentId).toBeTruthy();

    const removeRes = await history.commit(
      contextA.nextCommitRequest(docId, 1, 'Delete Instrument', [
        { orchestra: { type: 'removeAssignment', assignmentId: assignmentId! } },
      ]),
    );
    expect(removeRes.status).toBe('committed');
    expect(createOrchestraSnapshot(session.read().data!).arrangement.rows).toHaveLength(0);

    const undoRes = await history.undo({
      documentId: docId,
      operationId: 'undo-delete-instrument',
      expectedRevision: 2,
      contextSequence: contextA.sequence + 1,
    });
    expect(undoRes.status).toBe('committed');
    const rows = createOrchestraSnapshot(session.read().data!).arrangement.rows;
    expect(rows).toHaveLength(1);
    expect(rows[0]!.assignmentId).toBe(assignmentId);
  });

  it('undoes and redoes a mixer level change with exact values', async () => {
    const { session, history, contextA } = setupHistory();
    const docId = session.read().documentId!;
    session.read().data!.getMixer().getMaster().setLevel(0.7);

    const res = await history.commit(
      contextA.nextCommitRequest(docId, 0, 'Set Master Level', [
        { mixer: { type: 'updateChannel', channelId: 'Master', patch: { level: 0.3 } } },
      ]),
    );
    expect(res.status).toBe('committed');
    expect(session.read().data!.getMixer().getMaster().getLevel()).toBe(0.3);

    await history.undo({
      documentId: docId,
      operationId: 'undo-level',
      expectedRevision: 1,
      contextSequence: contextA.sequence + 1,
    });
    expect(session.read().data!.getMixer().getMaster().getLevel()).toBe(0.7);

    const redoRes = await history.redo({
      documentId: docId,
      operationId: 'redo-level',
      expectedRevision: 2,
      contextSequence: contextA.sequence + 2,
    });
    expect(redoRes.status).toBe('committed');
    expect(session.read().data!.getMixer().getMaster().getLevel()).toBe(0.3);
  });

  it('compounds a multi-phase drag into one history entry that undoes as a unit', async () => {
    const { session, history, contextA } = setupHistory();
    const docId = session.read().documentId!;

    const begin = await history.commit(
      contextA.nextCommitRequest(
        docId,
        0,
        'Drag Lead Object',
        [movePatch({ layerIndex: 0, objectIndex: 0 }, 1, 8)],
        { gestureId: 'drag-1', phase: 'begin' },
      ),
    );
    expect(begin.status).toBe('committed');
    expect(history.read().length).toBe(1);

    const update = await history.commit(
      contextA.nextCommitRequest(
        docId,
        1,
        'Drag Lead Object',
        [movePatch({ layerIndex: 1, objectIndex: 0 }, 0, 12)],
        { gestureId: 'drag-1', phase: 'update' },
      ),
    );
    expect(update.status).toBe('committed');
    expect(history.read().length).toBe(1);

    const end = await history.commit(
      contextA.nextCommitRequest(
        docId,
        2,
        'Drag Lead Object',
        [movePatch({ layerIndex: 0, objectIndex: 0 }, 1, 16)],
        { gestureId: 'drag-1', phase: 'end' },
      ),
    );
    expect(end.status).toBe('committed');
    expect(history.read().length).toBe(1);
    expect(layerCount(session.read().data!, 1)).toBe(1);
    expect(objectStartBeats(session.read().data!, 1, 0)).toBe(16);

    const undoRes = await history.undo({
      documentId: docId,
      operationId: 'undo-drag',
      expectedRevision: 3,
      contextSequence: contextA.sequence + 1,
    });
    expect(undoRes.status).toBe('committed');
    expect(layerCount(session.read().data!, 0)).toBe(1);
    expect(getScoreObjectId(scoreObjectAt(session.read().data!, 0, 0))).toBe('sobj-1');
    expect(objectStartBeats(session.read().data!, 0, 0)).toBe(4);
  });

  it('rejects a failed compound application atomically without partial writes', async () => {
    const { session, history, contextA } = setupHistory();
    const docId = session.read().documentId!;

    const res = await history.commit(
      contextA.nextCommitRequest(docId, 0, 'Compound Edit', [
        { projectProperties: { title: 'Should Not Stick' } },
        { rogueMember: true } as unknown as ProjectDocumentPatchSingle,
      ]),
    );

    expect(res.status).toBe('invalid');
    expect(session.read().revision).toBe(0);
    expect(session.read().data!.getProjectProperties().title).not.toBe('Should Not Stick');
    expect(history.read().length).toBe(0);
  });

  it('keeps the redo branch alive across unchanged edits and restores on redo', async () => {
    const { session, history, contextA } = setupHistory();
    const docId = session.read().documentId!;
    session.read().data!.getMixer().getMaster().setLevel(0.7);

    await history.commit(
      contextA.nextCommitRequest(docId, 0, 'Set Master Level', [
        { mixer: { type: 'updateChannel', channelId: 'Master', patch: { level: 0.3 } } },
      ]),
    );
    await history.undo({
      documentId: docId,
      operationId: 'undo-level',
      expectedRevision: 1,
      contextSequence: contextA.sequence + 1,
    });
    expect(history.read().canRedo).toBe(true);

    // Unchanged edit: assign the value the channel already has.
    const unchanged = await history.commit(
      contextA.nextCommitRequest(docId, 2, 'Set Master Level', [
        { mixer: { type: 'updateChannel', channelId: 'Master', patch: { level: 0.7 } } },
      ]),
    );
    expect(unchanged.status).toBe('unchanged');
    expect(history.read().canRedo).toBe(true);

    const redoRes = await history.redo({
      documentId: docId,
      operationId: 'redo-level',
      expectedRevision: 2,
      contextSequence: contextA.sequence + 2,
    });
    expect(redoRes.status).toBe('committed');
    expect(session.read().data!.getMixer().getMaster().getLevel()).toBe(0.3);
  });

  it('invalidates the redo branch when a new commit follows an undo', async () => {
    const { session, history, contextA } = setupHistory();
    const docId = session.read().documentId!;

    await history.commit(
      contextA.nextCommitRequest(docId, 0, 'Move Object', [
        movePatch({ layerIndex: 0, objectIndex: 0 }, 1, 10),
      ]),
    );
    await history.undo({
      documentId: docId,
      operationId: 'undo-move',
      expectedRevision: 1,
      contextSequence: contextA.sequence + 1,
    });
    expect(history.read().canRedo).toBe(true);

    const branchRes = await history.commit(
      contextA.nextCommitRequest(docId, 2, 'Branch Edit', [
        { projectProperties: { title: 'Branched' } },
      ]),
    );
    expect(branchRes.status).toBe('committed');
    expect(history.read().canRedo).toBe(false);

    const redoRes = await history.redo({
      documentId: docId,
      operationId: 'redo-stale-branch',
      expectedRevision: session.read().revision,
      contextSequence: contextA.sequence + 2,
    });
    expect(redoRes.status).toBe('unchanged');
  });

  it('emits stable changed-target hints on commit, undo, and merged gestures', async () => {
    const { session, history, contextA } = setupHistory();
    const docId = session.read().documentId!;

    // Scalar mixer edit
    const scalar = await history.commit(
      contextA.nextCommitRequest(docId, 0, 'Set Master Level', [
        { mixer: { type: 'updateChannel', channelId: 'Master', patch: { level: 0.3 } } },
      ]),
    );
    expect(scalar.status).toBe('committed');
    if (scalar.status !== 'committed') return;
    expect(scalar.changedTargets).toContain('mixerChannel:Master');

    // Undo reply carries the same hints as the entry it reverses.
    const undoRes = await history.undo({
      documentId: docId,
      operationId: 'undo-hints',
      expectedRevision: 1,
      contextSequence: contextA.sequence + 1,
    });
    expect(undoRes.status).toBe('committed');
    if (undoRes.status !== 'committed') return;
    expect(undoRes.changedTargets).toContain('mixerChannel:Master');

    // Compound gesture: hints from every phase union into the single entry.
    const begin = await history.commit(
      contextA.nextCommitRequest(
        docId,
        2,
        'Move Object',
        [movePatch({ layerIndex: 0, objectIndex: 0 }, 1, 8)],
        { gestureId: 'hint-drag', phase: 'begin' },
      ),
    );
    expect(begin.status).toBe('committed');
    if (begin.status !== 'committed') return;
    expect(begin.changedTargets).toContain('score');

    const update = await history.commit(
      contextA.nextCommitRequest(
        docId,
        3,
        'Move Object',
        [{ projectProperties: { title: 'Titled Mid-Gesture' } }],
        { gestureId: 'hint-drag', phase: 'update' },
      ),
    );
    expect(update.status).toBe('committed');
    if (update.status !== 'committed') return;
    expect(update.changedTargets).toContain('score');
    expect(update.changedTargets).toContain('property:projectProperties');

    // Structural commit hints identify the moved score objects.
    const structural = await history.commit(
      contextA.nextCommitRequest(docId, 4, 'Move Again', [
        movePatch({ layerIndex: 1, objectIndex: 0 }, 0, 4),
      ]),
    );
    expect(structural.status).toBe('committed');
    if (structural.status !== 'committed') return;
    expect(structural.changedTargets).toContain('score');
  });

  it('applies a duplicate structural delivery once and returns the same committed response', async () => {
    const { session, history, contextA } = setupHistory();
    const docId = session.read().documentId!;

    const req = contextA.nextCommitRequest(docId, 0, 'Move Object', [
      movePatch({ layerIndex: 0, objectIndex: 0 }, 1, 10),
    ]);

    const first = await history.commit(req);
    expect(first.status).toBe('committed');

    // Duplicate delivery (IPC retry): same operation id, same everything.
    const duplicate = await history.commit(req);
    expect(duplicate).toBe(first);
    expect(session.read().revision).toBe(1);
    expect(layerCount(session.read().data!, 1)).toBe(1);
  });
});
