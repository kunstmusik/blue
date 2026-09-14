import { describe, expect, it } from 'vitest';
import { BlueData } from '@blue/data';
import { ProjectSession } from './project-session';
import { ProjectHistory } from './project-history';
import { resolveProjectSaveDecision } from './project-replacement-flow';
import { getWindowTitle } from '../shared/window-title';
import { MockHistoryContext } from './project-history-test-support';

/**
 * Cross-consumer consistency matrix (spec 109 US3): the window title and the
 * close/quit protection are two consumers of the same main-owned
 * ProjectHistory.getSaveState() answer. Every transition in the matrix must
 * keep them in agreement, including cancellation, failure, branch/prune, and
 * save-before-redo-tip cases.
 */
describe('project save-state consumers stay consistent (spec 109 US3)', () => {
  function setup() {
    const session = new ProjectSession();
    const history = new ProjectHistory({ session });
    const context = new MockHistoryContext('ctx-consistency');
    return { session, history, context };
  }

  interface ConsumerProbe {
    title: string;
    prompted: boolean;
    outcome: 'saved' | 'discarded' | 'cancelled' | 'blocked';
  }

  /**
   * Observes both consumers at one point in the transition matrix: the title
   * formatter (US2) and the injected confirmation flow (US1). `choice`
   * defaults to 'cancel' so a prompt never mutates state.
   */
  async function probe(
    session: ProjectSession,
    history: ProjectHistory,
    choice: 'save' | 'discard' | 'cancel' = 'cancel',
    options: { writeSucceeds?: boolean; saveAsPath?: string | null } = {},
  ): Promise<ConsumerProbe> {
    const title = getWindowTitle(session.read().filePath, history.getSaveState());
    let prompted = false;
    const outcome = await resolveProjectSaveDecision({
      runSettlementBarrier: (action) => history.runSettlementBarrier('replacement', action),
      getSaveState: () => history.getSaveState(),
      choose: () => {
        prompted = true;
        return choice;
      },
      hasCurrentPath: () => Boolean(session.read().filePath),
      saveCurrent: () => {
        if (options.writeSucceeds === false) return false;
        history.checkpointSave();
        return true;
      },
      saveAs: () => {
        if (options.writeSucceeds === false || !options.saveAsPath) {
          return false;
        }
        session.publishPath(options.saveAsPath);
        history.checkpointSave();
        return true;
      },
    });
    return { title, prompted, outcome };
  }

  /** The marker implied by a title must match whether protection prompted. */
  function expectConsistent(
    probe: ConsumerProbe,
    marker: 'none' | 'unsaved' | 'saved' | 'modified',
  ) {
    const impliedNeedsSaving = marker === 'unsaved' || marker === 'modified';
    expect(
      probe.prompted,
      `title "${probe.title}" must ${impliedNeedsSaving ? '' : 'not '}prompt`,
    ).toBe(impliedNeedsSaving);
    expect(probe.title).toBe(
      marker === 'none'
        ? 'Blue'
        : marker === 'unsaved'
          ? 'Blue - New Project - [UNSAVED PROJECT]'
          : marker === 'saved'
            ? `Blue - ${probe.title.split(' - ')[1]}`
            : `${probe.title}`,
    );
    if (marker === 'modified') {
      expect(probe.title.endsWith(' - [modified]')).toBe(true);
    } else {
      expect(probe.title.endsWith(' - [modified]')).toBe(false);
      expect(probe.title.includes('[UNSAVED PROJECT]')).toBe(marker === 'unsaved');
    }
  }

  it('agrees across create, edit, Save As, undo, redo, branch, and close', async () => {
    const { session, history, context } = setup();

    // No document.
    expectConsistent(await probe(session, history), 'none');

    // Create: unsaved even with clean history.
    const data = new BlueData();
    session.replace(data, null);
    history.clear();
    history.checkpointSave();
    expectConsistent(await probe(session, history), 'unsaved');

    // Durable commit on the never-saved project.
    const docId = session.read().documentId!;
    let commit = await history.commit(
      context.nextCommitRequest(docId, 0, 'Edit 1', [{ projectProperties: { title: 'T1' } }]),
    );
    expect(commit.status).toBe('committed');
    expectConsistent(await probe(session, history), 'unsaved');

    // Successful Save As converts it to a saved on-disk project.
    const savedAs = await probe(session, history, 'save', {
      saveAsPath: '/work/consistency.blue',
    });
    expect(savedAs.outcome).toBe('saved');
    expectConsistent(await probe(session, history), 'saved');
    expect(session.read().filePath).toBe('/work/consistency.blue');

    // Durable commit -> modified.
    commit = await history.commit(
      context.nextCommitRequest(docId, session.read().revision, 'Edit 2', [
        { projectProperties: { title: 'T2' } },
      ]),
    );
    expect(commit.status).toBe('committed');
    expectConsistent(await probe(session, history), 'modified');

    // Undo to the save point -> saved, without another save.
    let undo = await history.undo({
      documentId: docId,
      operationId: 'consistency-undo-1',
      expectedRevision: session.read().revision,
      contextSequence: 3,
    });
    expect(undo.status).toBe('committed');
    expectConsistent(await probe(session, history), 'saved');

    // Redo away from the save point -> modified again.
    let redo = await history.redo({
      documentId: docId,
      operationId: 'consistency-redo-1',
      expectedRevision: session.read().revision,
      contextSequence: 4,
    });
    expect(redo.status).toBe('committed');
    expectConsistent(await probe(session, history), 'modified');

    // A second edit, then undo once: the state sits before the redo tip while
    // still differing from the save point, so saving here re-baselines it.
    commit = await history.commit(
      context.nextCommitRequest(docId, session.read().revision, 'Edit 3', [
        { projectProperties: { title: 'T3' } },
      ]),
    );
    expect(commit.status).toBe('committed');
    undo = await history.undo({
      documentId: docId,
      operationId: 'consistency-undo-2',
      expectedRevision: session.read().revision,
      contextSequence: 5,
    });
    expect(undo.status).toBe('committed');
    expect(history.read().canRedo).toBe(true);
    expectConsistent(await probe(session, history), 'modified');

    // Save before the redo tip: only the newly saved revision is clean.
    const savedBeforeTip = await probe(session, history, 'save');
    expect(savedBeforeTip.outcome).toBe('saved');
    expectConsistent(await probe(session, history), 'saved');
    redo = await history.redo({
      documentId: docId,
      operationId: 'consistency-redo-2',
      expectedRevision: session.read().revision,
      contextSequence: 6,
    });
    expect(redo.status).toBe('committed');
    expectConsistent(await probe(session, history), 'modified');
    undo = await history.undo({
      documentId: docId,
      operationId: 'consistency-undo-3',
      expectedRevision: session.read().revision,
      contextSequence: 7,
    });
    expect(undo.status).toBe('committed');
    expectConsistent(await probe(session, history), 'saved');

    // Branch/prune: a new commit from the save point stays modified.
    commit = await history.commit(
      context.nextCommitRequest(docId, session.read().revision, 'Branched Edit', [
        { projectProperties: { title: 'B1' } },
      ]),
    );
    expect(commit.status).toBe('committed');
    expect(history.read().canRedo).toBe(false);
    expectConsistent(await probe(session, history), 'modified');

    // Close after a successful save -> none.
    const closed = await probe(session, history, 'save');
    expect(closed.outcome).toBe('saved');
    session.close();
    expectConsistent(await probe(session, history), 'none');
  });

  it('keeps title, state, and protection unchanged after cancelled or failed saves', async () => {
    const { session, history, context } = setup();
    const data = new BlueData();
    session.replace(data, '/work/stable.blue');
    history.clear();
    history.checkpointSave();
    const docId = session.read().documentId!;
    const commit = await history.commit(
      context.nextCommitRequest(docId, 0, 'Edit 1', [{ projectProperties: { title: 'T1' } }]),
    );
    expect(commit.status).toBe('committed');

    const titleBefore = getWindowTitle(session.read().filePath, history.getSaveState());
    expect(titleBefore).toBe('Blue - stable.blue - [modified]');
    const projectionBefore = history.read();

    // Cancelled decision: nothing changes.
    const cancelled = await probe(session, history, 'cancel');
    expect(cancelled.outcome).toBe('cancelled');
    expect(cancelled.prompted).toBe(true);
    expect(getWindowTitle(session.read().filePath, history.getSaveState())).toBe(titleBefore);
    expect(history.read()).toEqual(projectionBefore);

    // Failed write: nothing changes and the project stays protected.
    const failed = await probe(session, history, 'save', { writeSucceeds: false });
    expect(failed.outcome).toBe('blocked');
    expect(getWindowTitle(session.read().filePath, history.getSaveState())).toBe(titleBefore);
    expect(history.read()).toEqual(projectionBefore);
    expectConsistent(await probe(session, history), 'modified');

    // Cancelled Save As for an unsaved project keeps the unsaved marker.
    session.replace(new BlueData(), null);
    history.clear();
    history.checkpointSave();
    const saveAsCancelled = await probe(session, history, 'save', { saveAsPath: null });
    expect(saveAsCancelled.outcome).toBe('blocked');
    expect(getWindowTitle(session.read().filePath, history.getSaveState())).toBe(
      'Blue - New Project - [UNSAVED PROJECT]',
    );
    expect(session.read().filePath).toBeNull();
    expectConsistent(await probe(session, history), 'unsaved');
  });

  it('derives both consumers from the same query so transient activity cannot desync them', async () => {
    const { session, history } = setup();
    session.replace(new BlueData(), '/work/transient.blue');
    history.clear();
    history.checkpointSave();

    // Selection/playback/preview-style activity has no history or path
    // effect; repeated queries must keep answering saved without prompting.
    for (let i = 0; i < 3; i += 1) {
      const observed = await probe(session, history);
      expect(observed.prompted).toBe(false);
      expect(observed.title).toBe('Blue - transient.blue');
      expect(history.getSaveState()).toBe('saved');
      expect(history.isDirty()).toBe(false);
    }
  });
});
