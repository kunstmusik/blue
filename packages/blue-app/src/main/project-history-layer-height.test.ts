import { describe, expect, it } from 'vitest';
import { BlueData, PolyObject, TrackLayerGroup, GenericScore } from '@blue/data';
import { ProjectSession } from './project-session';
import { ProjectHistory } from './project-history';
import { FakePublicationRecorder, MockHistoryContext } from './project-history-test-support';
import {
  assignLayerGroupId,
  assignLayerSelectionId,
  getLayerSelectionId,
} from '../shared/project-editor/identity';

function createProject(): BlueData {
  const data = new BlueData();
  const score = data.getScore();
  score.length = 0;

  const trackGroup = new TrackLayerGroup();
  trackGroup.newLayerAt(0);
  trackGroup.newLayerAt(1);
  score.push(trackGroup);

  const polyGroup = new PolyObject(true);
  polyGroup.newLayerAt(0);
  polyGroup.newLayerAt(1);
  score.push(polyGroup);

  // Add sound objects to verify content preservation
  const obj1 = new GenericScore();
  obj1.setName('Obj1');
  polyGroup[0]!.push(obj1);

  return data;
}

describe('ProjectHistory layer height commit, undo, and redo (T015, T023, T031)', () => {
  describe('Single-layer exact heights, raw attributes, and dirty state (T015)', () => {
    it('commits single-layer custom height, transitions dirty state, and restores on undo/redo', async () => {
      const session = new ProjectSession();
      session.replace(createProject(), '/tmp/test.blue');
      const recorder = new FakePublicationRecorder();
      const history = new ProjectHistory({
        session,
        publishUpdated: (evt) => recorder.record(evt),
      });
      const context = new MockHistoryContext('ctx-single-layer');
      const docId = session.read().documentId!;
      const live = () => session.read().data!;

      const trackGroup = live().getScore()[0] as TrackLayerGroup;
      const track = trackGroup[0]!;
      const selId = assignLayerSelectionId(track);
      const groupId = trackGroup.getUniqueId();
      const initialFingerprint = live().saveToString();

      history.markClean();
      expect(history.isDirty()).toBe(false);

      // Commit 57px custom height
      const commit = await history.commit(
        context.nextCommitRequest(docId, 0, 'Resize Track Height', [
          {
            score: {
              type: 'setLayerHeights',
              scopeGroupId: null,
              updates: [{ groupId, layerIndex: 0, layerSelectionId: selId, height: 57 }],
            },
          },
        ]),
      );

      expect(commit.status).toBe('committed');
      if (commit.status !== 'committed') throw new Error('Expected committed');
      expect(commit.revision).toBe(1);
      expect(history.isDirty()).toBe(true);

      const committedTrack = (live().getScore()[0] as TrackLayerGroup)[0]!;
      expect(committedTrack.getLayerHeight()).toBe(57);
      expect(committedTrack.getCustomHeight()).toBe(57);
      expect(committedTrack.getHeightIndex()).toBe(2);
      expect(getLayerSelectionId(committedTrack)).toBe(selId);

      // Undo
      const undo = await history.undo(context.nextUndoRequest(docId, 1));
      expect(undo.status).toBe('committed');
      expect(live().saveToString()).toBe(initialFingerprint);
      expect(history.isDirty()).toBe(false);

      const undoneTrack = (live().getScore()[0] as TrackLayerGroup)[0]!;
      expect(undoneTrack.getLayerHeight()).toBe(22);
      expect(undoneTrack.getCustomHeight()).toBeUndefined();
      expect(getLayerSelectionId(undoneTrack)).toBe(selId);

      // Redo
      const redo = await history.redo(context.nextRedoRequest(docId, session.read().revision));
      expect(redo.status).toBe('committed');
      expect(history.isDirty()).toBe(true);

      const redoneTrack = (live().getScore()[0] as TrackLayerGroup)[0]!;
      expect(redoneTrack.getLayerHeight()).toBe(57);
      expect(redoneTrack.getCustomHeight()).toBe(57);
      expect(getLayerSelectionId(redoneTrack)).toBe(selId);
    });

    it('restores raw malformed customHeight attribute on undo', async () => {
      const xml = `
<blueData>
  <score>
    <polyObject name="Root Score">
      <soundLayer name="Layer 1" heightIndex="1" customHeight="malformed-value" />
    </polyObject>
  </score>
</blueData>`.trim();

      const data = BlueData.loadFromString(xml);
      const session = new ProjectSession();
      session.replace(data, '/tmp/malformed.blue');
      const recorder = new FakePublicationRecorder();
      const history = new ProjectHistory({
        session,
        publishUpdated: (evt) => recorder.record(evt),
      });
      const context = new MockHistoryContext('ctx-malformed');
      const docId = session.read().documentId!;
      const live = () => session.read().data!;

      const polyGroup = live().getScore()[0] as PolyObject;
      const soundLayer = polyGroup[0]!;
      const selId = assignLayerSelectionId(soundLayer);
      const groupId = assignLayerGroupId(polyGroup);
      const initialXml = live().saveToString();
      expect(initialXml).toContain('customHeight="malformed-value"');

      // Resize to preset 66px -> removes customHeight and clears raw attribute
      const commit = await history.commit(
        context.nextCommitRequest(docId, 0, 'Resize Sound Layer', [
          {
            score: {
              type: 'setLayerHeights',
              scopeGroupId: null,
              updates: [{ groupId, layerIndex: 0, layerSelectionId: selId, height: 66 }],
            },
          },
        ]),
      );

      expect(commit.status).toBe('committed');
      if (commit.status !== 'committed') throw new Error('Expected committed');
      expect(live().saveToString()).not.toContain('malformed-value');

      // Undo -> restores exact prior XML including malformed attribute
      const undo = await history.undo(context.nextUndoRequest(docId, commit.revision));
      expect(undo.status).toBe('committed');
      expect(live().saveToString()).toBe(initialXml);
      expect(live().saveToString()).toContain('customHeight="malformed-value"');
    });

    it('preserves sound objects and stable identities through commit and undo', async () => {
      const session = new ProjectSession();
      session.replace(createProject(), '/tmp/content-preservation.blue');
      const recorder = new FakePublicationRecorder();
      const history = new ProjectHistory({
        session,
        publishUpdated: (evt) => recorder.record(evt),
      });
      const context = new MockHistoryContext('ctx-content');
      const docId = session.read().documentId!;
      const live = () => session.read().data!;

      const polyGroup = live().getScore()[1] as PolyObject;
      const layer = polyGroup[0]!;
      const selId = assignLayerSelectionId(layer);
      const groupId = assignLayerGroupId(polyGroup);
      expect(layer.length).toBe(1);
      expect(layer[0]!.getName()).toBe('Obj1');

      await history.commit(
        context.nextCommitRequest(docId, 0, 'Resize Sound Layer', [
          {
            score: {
              type: 'setLayerHeights',
              scopeGroupId: null,
              updates: [{ groupId, layerIndex: 0, layerSelectionId: selId, height: 88 }],
            },
          },
        ]),
      );

      const committedPoly = live().getScore()[1] as PolyObject;
      expect(committedPoly[0]!.length).toBe(1);
      expect(committedPoly[0]![0]!.getName()).toBe('Obj1');

      await history.undo(context.nextUndoRequest(docId, 1));

      const undonePoly = live().getScore()[1] as PolyObject;
      expect(undonePoly[0]!.length).toBe(1);
      expect(undonePoly[0]![0]!.getName()).toBe('Obj1');
    });
  });

  describe('Bulk multi-layer history and failure restoration (T023)', () => {
    it('covers all selected targets under one semantic history entry', async () => {
      const session = new ProjectSession();
      session.replace(createProject(), '/tmp/bulk.blue');
      const recorder = new FakePublicationRecorder();
      const history = new ProjectHistory({
        session,
        publishUpdated: (evt) => recorder.record(evt),
      });
      const context = new MockHistoryContext('ctx-bulk');
      const docId = session.read().documentId!;
      const live = () => session.read().data!;

      const trackGroup = live().getScore()[0] as TrackLayerGroup;
      const polyGroup = live().getScore()[1] as PolyObject;
      const t0 = trackGroup[0]!;
      const s0 = polyGroup[0]!;
      const t0Sel = assignLayerSelectionId(t0);
      const s0Sel = assignLayerSelectionId(s0);
      const initialFingerprint = live().saveToString();

      t0.setExplicitHeight(44);
      s0.setExplicitHeight(88);

      const commit = await history.commit(
        context.nextCommitRequest(docId, 0, 'Resize Selected Layers', [
          {
            score: {
              type: 'setLayerHeights',
              scopeGroupId: null,
              updates: [
                {
                  groupId: trackGroup.getUniqueId(),
                  layerIndex: 0,
                  layerSelectionId: t0Sel,
                  height: 57,
                },
                {
                  groupId: assignLayerGroupId(polyGroup),
                  layerIndex: 0,
                  layerSelectionId: s0Sel,
                  height: 101,
                },
              ],
            },
          },
        ]),
      );

      expect(commit.status).toBe('committed');
      expect(history.read().length).toBe(1);

      const liveTrackGroup = live().getScore()[0] as TrackLayerGroup;
      const livePolyGroup = live().getScore()[1] as PolyObject;
      expect(liveTrackGroup[0]!.getLayerHeight()).toBe(57);
      expect(livePolyGroup[0]!.getLayerHeight()).toBe(101);
      // Unselected rows remain untouched
      expect(liveTrackGroup[1]!.getLayerHeight()).toBe(22);
      expect(livePolyGroup[1]!.getLayerHeight()).toBe(22);

      // Undo restores both rows in one single step
      const undo = await history.undo(context.nextUndoRequest(docId, 1));
      expect(undo.status).toBe('committed');
      expect(history.read().canUndo).toBe(false);

      const undoneTrackGroup = live().getScore()[0] as TrackLayerGroup;
      const undonePolyGroup = live().getScore()[1] as PolyObject;
      expect(undoneTrackGroup[0]!.getLayerHeight()).toBe(44);
      expect(undonePolyGroup[0]!.getLayerHeight()).toBe(88);
    });

    it('rejects an invalid bulk commit and keeps state authoritative without creating history', async () => {
      const session = new ProjectSession();
      session.replace(createProject(), '/tmp/bulk-fail.blue');
      const recorder = new FakePublicationRecorder();
      const history = new ProjectHistory({
        session,
        publishUpdated: (evt) => recorder.record(evt),
      });
      const context = new MockHistoryContext('ctx-bulk-fail');
      const docId = session.read().documentId!;
      const live = () => session.read().data!;

      const trackGroup = live().getScore()[0] as TrackLayerGroup;
      const t0 = trackGroup[0]!;
      const t0Sel = assignLayerSelectionId(t0);
      const initialFingerprint = live().saveToString();

      const commit = await history.commit(
        context.nextCommitRequest(docId, 0, 'Resize Selected Layers', [
          {
            score: {
              type: 'setLayerHeights',
              scopeGroupId: null,
              updates: [
                {
                  groupId: trackGroup.getUniqueId(),
                  layerIndex: 0,
                  layerSelectionId: t0Sel,
                  height: 57,
                },
                {
                  groupId: trackGroup.getUniqueId(),
                  layerIndex: 99,
                  layerSelectionId: 'stale',
                  height: 101,
                },
              ],
            },
          },
        ]),
      );

      expect(commit.status).toBe('invalid');
      expect(history.read().length).toBe(0);
      expect(history.read().canUndo).toBe(false);
      expect(live().saveToString()).toBe(initialFingerprint);
    });
  });

  describe('Group default changes vs. applying default to rows (T031)', () => {
    it('Change Default for New Layers updates group default without altering existing row heights', async () => {
      const session = new ProjectSession();
      session.replace(createProject(), '/tmp/default-change.blue');
      const recorder = new FakePublicationRecorder();
      const history = new ProjectHistory({
        session,
        publishUpdated: (evt) => recorder.record(evt),
      });
      const context = new MockHistoryContext('ctx-default');
      const docId = session.read().documentId!;
      const live = () => session.read().data!;

      const polyGroup = live().getScore()[1] as PolyObject;
      const groupId = assignLayerGroupId(polyGroup);
      expect(polyGroup.getDefaultHeightIndex()).toBe(0);
      expect(polyGroup[0]!.getLayerHeight()).toBe(22);
      expect(polyGroup[1]!.getLayerHeight()).toBe(22);

      // Change default to index 3 (88px)
      const commit = await history.commit(
        context.nextCommitRequest(docId, 0, 'Change Default Layer Height', [
          {
            score: {
              type: 'setLayerGroupDefaultHeight',
              scopeGroupId: null,
              groupId,
              defaultHeightIndex: 3,
            },
          },
        ]),
      );

      expect(commit.status).toBe('committed');
      const committedPoly = live().getScore()[1] as PolyObject;
      expect(committedPoly.getDefaultHeightIndex()).toBe(3);
      // Existing rows remain at 22!
      expect(committedPoly[0]!.getLayerHeight()).toBe(22);
      expect(committedPoly[1]!.getLayerHeight()).toBe(22);

      // Subsequent new layer creation uses the new default
      const newLayer = committedPoly.newLayerAt(2);
      expect(newLayer.getHeightIndex()).toBe(3);
      expect(newLayer.getLayerHeight()).toBe(88);

      // Undo restores default to 0
      if (commit.status !== 'committed') throw new Error('Expected committed');
      const undo = await history.undo(context.nextUndoRequest(docId, commit.revision));
      expect(undo.status).toBe('committed');
      expect((live().getScore()[1] as PolyObject).getDefaultHeightIndex()).toBe(0);
    });

    it('Apply Default to Group resets direct group rows to the current default in one undoable step', async () => {
      const session = new ProjectSession();
      session.replace(createProject(), '/tmp/apply-default.blue');
      const recorder = new FakePublicationRecorder();
      const history = new ProjectHistory({
        session,
        publishUpdated: (evt) => recorder.record(evt),
      });
      const context = new MockHistoryContext('ctx-apply-default');
      const docId = session.read().documentId!;
      const live = () => session.read().data!;

      const polyGroup = live().getScore()[1] as PolyObject;
      const groupId = assignLayerGroupId(polyGroup);
      polyGroup.setDefaultHeightIndex(2); // 66px
      polyGroup[0]!.setExplicitHeight(57);
      polyGroup[1]!.setExplicitHeight(110);

      const commit = await history.commit(
        context.nextCommitRequest(docId, 0, 'Apply Default Height to Group', [
          {
            score: {
              type: 'setLayerHeights',
              scopeGroupId: null,
              updates: [
                {
                  groupId,
                  layerIndex: 0,
                  layerSelectionId: assignLayerSelectionId(polyGroup[0]!),
                  height: 'default',
                },
                {
                  groupId,
                  layerIndex: 1,
                  layerSelectionId: assignLayerSelectionId(polyGroup[1]!),
                  height: 'default',
                },
              ],
            },
          },
        ]),
      );

      expect(commit.status).toBe('committed');
      const committedPoly = live().getScore()[1] as PolyObject;
      expect(committedPoly[0]!.getLayerHeight()).toBe(66);
      expect(committedPoly[1]!.getLayerHeight()).toBe(66);
      expect(committedPoly.getDefaultHeightIndex()).toBe(2);

      // Undo restores 57 and 110
      if (commit.status !== 'committed') throw new Error('Expected committed');
      const undo = await history.undo(context.nextUndoRequest(docId, commit.revision));
      expect(undo.status).toBe('committed');
      const undonePoly = live().getScore()[1] as PolyObject;
      expect(undonePoly[0]!.getLayerHeight()).toBe(57);
      expect(undonePoly[1]!.getLayerHeight()).toBe(110);
    });
  });
});
