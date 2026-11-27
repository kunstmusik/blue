import { describe, expect, it } from 'vite-plus/test';
import {
  BlueData,
  BlueSynthBuilder,
  GenericInstrument,
  GenericScore,
  PolyObject,
  TimeBase,
  TimeDuration,
  TimePosition,
} from '@blue/data';
import type { ProjectDocumentUpdatedEvent } from '../shared/project-history';
import {
  assignScoreObjectId,
  transferProjectEditorIdentities,
} from '../shared/project-editor/identity';
import {
  McpBridge,
  McpConsoleTailBuffer,
  type McpAuthContext,
  type McpDocumentReceipt,
} from './mcp-bridge';
import {
  createProjectHistory,
  verifyStableIdentities,
  type ProjectHistory,
} from './project-history';
import {
  ProjectRuntimeReconciliation,
  type AcknowledgedRuntimeClient,
} from './project-runtime-reconciliation';
import { ProjectSession } from './project-session';

function createHistoryFixture(): { data: BlueData; baseline: BlueData } {
  const data = new BlueData();
  const props = data.getProjectProperties();
  props.title = 'History Fixture';
  props.author = 'Grace';
  props.notes = 'Original notes';
  props.sampleRate = '44100';
  props.ksmps = '64';
  props.nchnls = '2';
  props.diskSampleRate = '96000';
  props.diskKsmps = '16';
  props.diskChannels = '4';

  const generic = new GenericInstrument();
  generic.setName('Lead');
  generic.setText('a1 oscili 0.25, 440\nouts a1, a1');
  generic.setGlobalOrc('giTab ftgen 0, 0, 1024, 10, 1');
  generic.setGlobalSco('f0 8');
  data.getArrangement().addInstrument(generic, '1');

  const bsb = new BlueSynthBuilder();
  bsb.setName('BSB Synth');
  bsb.setInstrumentText('a1 oscili 0.2, 220\nouts a1, a1');
  bsb.setAlwaysOnInstrumentText('gkMaster init 1');
  data.getArrangement().addInstrument(bsb, '2');

  const rootPoly = data.getScore()[0] as PolyObject;
  const layer0 = rootPoly[0]!;
  const score = new GenericScore();
  score.setName('Time-Based Score');
  score.setStartTime(TimePosition.time(0, 0, 2, 0));
  score.setSubjectiveDuration(TimeDuration.time(0, 0, 4, 0));
  score.setScoreText('i1 0 1 440');
  layer0.push(score);

  const baseline = data.historyCopy();
  transferProjectEditorIdentities(data, baseline);
  return { data, baseline };
}

function createHarness(
  options: {
    retainedBytesLimit?: number;
    withActivePerformance?: boolean;
    onPrepareBoundary?: (
      history: ProjectHistory,
      docId: string,
      revision: number,
    ) => Promise<void> | void;
  } = {},
) {
  const { data, baseline } = createHistoryFixture();
  const session = new ProjectSession();
  session.replace(data, '/tmp/history-integration.blue');

  const publishedEvents: ProjectDocumentUpdatedEvent[] = [];
  const runtimeClient: AcknowledgedRuntimeClient = {
    async applyOperation() {
      return { status: 'applied' };
    },
  };
  const reconciliation = new ProjectRuntimeReconciliation();
  if (options.withActivePerformance) {
    reconciliation.registerPerformance('timeline', 1, runtimeClient);
  }

  let history!: ProjectHistory;
  history = createProjectHistory({
    session,
    retainedBytesLimit: options.retainedBytesLimit,
    reconciliation,
    publishUpdated: (event) => {
      publishedEvents.push(event);
    },
    broadcastPrepareBoundary: async () => {
      const snap = session.read();
      if (snap.documentId && options.onPrepareBoundary) {
        await options.onPrepareBoundary(history, snap.documentId, snap.revision);
      }
    },
  });
  const snap0 = session.read();
  history.checkpointSave(snap0.stateId ?? undefined);

  const tail = new McpConsoleTailBuffer();
  let authorized = true;
  let accessMode: 'read-only' | 'read-write' = 'read-write';
  let writeAccessEpoch = 0;

  const bridge = new McpBridge({
    readSession: () => session.read(),
    getSaveState: () => history.getSaveState(),
    isDirty: () => history.isDirty(),
    getEngineStatus: () => ({
      connected: true,
      available: true,
      playbackState: options.withActivePerformance ? 'playing' : 'stopped',
      activeDocumentId: options.withActivePerformance ? session.read().documentId : null,
      consoleTail: tail.read(),
    }),
    history,
  });

  const makeAuth = (action: McpAuthContext['action'] = 'write'): McpAuthContext => {
    const capturedEpoch = writeAccessEpoch;
    const capturedMode = accessMode;
    return {
      listenerGeneration: 1,
      credentialEpoch: 1,
      writeAccessEpoch: capturedEpoch,
      accessMode: capturedMode,
      action,
      signal: new AbortController().signal,
      isAuthorized: () =>
        authorized &&
        (action === 'read' ||
          (capturedMode === 'read-write' &&
            accessMode === 'read-write' &&
            capturedEpoch === writeAccessEpoch)),
    };
  };

  const currentReceipt = (): McpDocumentReceipt => {
    const snap = session.read();
    return {
      documentId: snap.documentId!,
      revision: snap.revision,
      stateId: snap.stateId!,
    };
  };

  return {
    data,
    baseline,
    session,
    history,
    bridge,
    publishedEvents,
    makeAuth,
    currentReceipt,
    setAuthorized: (next: boolean) => {
      authorized = next;
    },
    setAccessMode: (next: 'read-only' | 'read-write') => {
      if (accessMode === 'read-write' && next !== 'read-write') {
        writeAccessEpoch += 1;
      }
      accessMode = next;
    },
  };
}

describe('MCP history and runtime integration (T021)', () => {
  it('commits, undoes, and redoes all 4 write tools with semantic labels, dirty tracking, identity preservation, and runtime outcomes', async () => {
    const harness = createHarness({ withActivePerformance: true });
    const score = (harness.data.getScore()[0] as PolyObject)[0]![0] as GenericScore;
    const scoreObjId = assignScoreObjectId(score, 'sobj');

    let receipt = harness.currentReceipt();
    expect(harness.history.isDirty()).toBe(false);
    expect(harness.history.getSaveState()).toBe('saved');

    // 1. Update GenericInstrument code
    const genRes = await harness.bridge.updateInstrumentCode(harness.makeAuth(), {
      expected: receipt,
      instrumentId: '1',
      changes: { text: 'a1 oscili 0.5, 660\nouts a1, a1' },
    });
    expect(genRes.ok).toBe(true);
    if (!genRes.ok) return;
    receipt = genRes.value.receipt;
    expect(harness.history.isDirty()).toBe(true);
    expect(harness.history.getSaveState()).toBe('modified');
    expect(harness.history.read().undoLabel).toBe('MCP: Update Instrument 1');
    expect(harness.publishedEvents.at(-1)?.originContextId).toBe('mcp');

    // 2. Update BSB code
    const bsbRes = await harness.bridge.updateInstrumentCode(harness.makeAuth(), {
      expected: receipt,
      instrumentId: '2',
      changes: {
        instrumentText: 'a1 oscili 0.35, 110\nouts a1, a1',
        alwaysOnInstrumentText: 'gkMaster init 0.7',
      },
    });
    expect(bsbRes.ok).toBe(true);
    if (!bsbRes.ok) return;
    receipt = bsbRes.value.receipt;
    expect(harness.history.read().undoLabel).toBe('MCP: Update Instrument 2');

    // 3. Upsert create new instrument + mixer channel reconciliation
    const createRes = await harness.bridge.upsertInstrument(harness.makeAuth(), {
      expected: receipt,
      instrumentId: 'Brass',
      changes: { name: 'Warm Brass', enabled: true },
    });
    expect(createRes.ok).toBe(true);
    if (!createRes.ok) return;
    receipt = createRes.value.receipt;
    expect(harness.history.read().undoLabel).toBe('MCP: Add Instrument Brass');
    expect(harness.data.getArrangement().getInstrumentById('Brass')?.getName()).toBe('Warm Brass');
    expect(
      harness.data
        .getMixer()
        .getChannels()
        .some((ch) => ch.getAssociation() === 'Brass'),
    ).toBe(true);

    // 4. Upsert update existing instrument
    const updateInstrRes = await harness.bridge.upsertInstrument(harness.makeAuth(), {
      expected: receipt,
      instrumentId: 'Brass',
      changes: { name: 'Solo Brass', enabled: false },
    });
    expect(updateInstrRes.ok).toBe(true);
    if (!updateInstrRes.ok) return;
    receipt = updateInstrRes.value.receipt;
    expect(harness.history.read().undoLabel).toBe('MCP: Update Instrument Brass');

    // 5. Update score object name + timing + text atomically while preserving TimeBase.TIME
    const scoreRes = await harness.bridge.updateScoreObject(harness.makeAuth(), {
      expected: receipt,
      locator: { layerGroupPath: [0], layerIndex: 0, objectIndex: 0 },
      changes: { name: 'Renamed Time Score', start: 6, duration: 10, text: 'i1 0 2 880' },
    });
    expect(scoreRes.ok).toBe(true);
    if (!scoreRes.ok) return;
    receipt = scoreRes.value.receipt;
    expect(harness.history.read().undoLabel).toBe('MCP: Update Score Object');
    expect(score.getName()).toBe('Renamed Time Score');
    expect(score.getStartTime().getTimeBase()).toBe(TimeBase.TIME);
    expect(score.getSubjectiveDuration().getTimeBase()).toBe(TimeBase.TIME);
    expect(score.getScoreText()).toBe('i1 0 2 880');
    expect(assignScoreObjectId(score, 'sobj')).toBe(scoreObjId);

    // Rename-only edit is also a single undoable step
    const renameOnlyRes = await harness.bridge.updateScoreObject(harness.makeAuth(), {
      expected: receipt,
      locator: { layerGroupPath: [0], layerIndex: 0, objectIndex: 0 },
      changes: { name: 'Renamed Twice' },
    });
    expect(renameOnlyRes.ok).toBe(true);
    if (!renameOnlyRes.ok) return;
    receipt = renameOnlyRes.value.receipt;
    expect(score.getName()).toBe('Renamed Twice');
    expect(harness.history.read().undoLabel).toBe('MCP: Update Score Object');

    // 6. Set realtime project properties -> restart-required runtimeOutcome & warning, disk settings intact
    const propRes = await harness.bridge.setProjectProperties(harness.makeAuth(), {
      expected: receipt,
      changes: { title: 'Edited Title', sampleRate: 48000, ksmps: 32, nchnls: 4 },
    });
    expect(propRes.ok).toBe(true);
    if (!propRes.ok) return;
    receipt = propRes.value.receipt;
    expect(harness.history.read().undoLabel).toBe('MCP: Set Project Properties');
    expect(propRes.value.runtimeOutcomes.some((o) => o.status === 'restart-required')).toBe(true);
    expect(propRes.value.warnings.length).toBeGreaterThan(0);

    // Unchanged no-op leaves history entries untouched
    const cursorBeforeNoop = harness.history.read().cursor;
    const noopRes = await harness.bridge.setProjectProperties(harness.makeAuth(), {
      expected: receipt,
      changes: { title: 'Edited Title' },
    });
    expect(noopRes.ok).toBe(true);
    if (noopRes.ok) {
      expect(noopRes.value.changed).toBe(false);
    }
    expect(harness.history.read().cursor).toBe(cursorBeforeNoop);

    // Undo all 6 entries back to clean baseline
    let opCounter = 1;
    while (harness.history.read().canUndo) {
      const snap = harness.session.read();
      const undoRes = await harness.history.undo({
        documentId: snap.documentId!,
        operationId: `undo-${opCounter++}`,
        expectedRevision: snap.revision,
        contextSequence: opCounter,
      });
      expect(undoRes.status).toBe('committed');
    }

    expect(harness.history.isDirty()).toBe(false);
    expect(harness.history.getSaveState()).toBe('saved');
    expect(harness.data.getArrangement().getInstrumentById('Brass')).toBeUndefined();
    expect(
      harness.data
        .getMixer()
        .getChannels()
        .some((ch) => ch.getAssociation() === 'Brass'),
    ).toBe(false);
    expect(score.getName()).toBe('Time-Based Score');
    expect(score.getScoreText()).toBe('i1 0 1 440');
    expect(score.getStartTime().getTimeBase()).toBe(TimeBase.TIME);
    expect(harness.data.getProjectProperties().sampleRate).toBe('44100');
    expect(harness.data.getProjectProperties().diskSampleRate).toBe('96000');
    expect(verifyStableIdentities(harness.baseline, harness.data)).toBe(true);

    // Redo all 7 entries back to final state
    while (harness.history.read().canRedo) {
      const snap = harness.session.read();
      const redoRes = await harness.history.redo({
        documentId: snap.documentId!,
        operationId: `redo-${opCounter++}`,
        expectedRevision: snap.revision,
        contextSequence: opCounter,
      });
      expect(redoRes.status).toBe('committed');
    }

    expect(harness.history.isDirty()).toBe(true);
    expect(harness.data.getArrangement().getInstrumentById('Brass')?.getName()).toBe('Solo Brass');
    expect(score.getName()).toBe('Renamed Twice');
    expect(score.getScoreText()).toBe('i1 0 2 880');
    expect(harness.data.getProjectProperties().title).toBe('Edited Title');
    expect(harness.data.getProjectProperties().sampleRate).toBe('48000');
    expect(harness.data.getProjectProperties().diskSampleRate).toBe('96000');
  });

  it('rejects concurrent MCP writes and participant boundary delays with CONFLICT without mutating state', async () => {
    const harness = createHarness({
      onPrepareBoundary: (history) => {
        const barrier = history.getActiveBarrier();
        if (!barrier) return;
        const snap = harness.session.read();
        history.acknowledgeBoundary({
          contextId: 'renderer-1',
          barrierId: barrier.barrierId,
          lastAcknowledgedRevision: snap.revision,
          lastAcknowledgedSequence: 0,
          outstandingPrefixCount: 0,
        });
      },
    });
    const snap = harness.session.read();
    expect(
      harness.history.registerParticipant({
        contextId: 'renderer-1',
        documentId: snap.documentId!,
        acceptedRevision: snap.revision,
      }).ok,
    ).toBe(true);

    const receipt = harness.currentReceipt();
    // Queue a UI commit first, then an MCP write that admitted the same receipt concurrently.
    const uiCommitPromise = harness.history.commit({
      documentId: receipt.documentId,
      operationId: 'participant-edit',
      expectedRevision: receipt.revision,
      contextSequence: 1,
      label: 'UI Edit',
      phase: 'single',
      patches: [{ projectProperties: { author: 'Participant' } }],
    });
    const mcpWritePromise = harness.bridge.updateInstrumentCode(harness.makeAuth(), {
      expected: receipt,
      instrumentId: '1',
      changes: { text: 'stale change' },
    });

    const [uiRes, mcpRes] = await Promise.all([uiCommitPromise, mcpWritePromise]);
    expect(uiRes.status).toBe('committed');
    expect(mcpRes.ok).toBe(false);
    if (!mcpRes.ok) {
      expect(mcpRes.code).toBe('CONFLICT');
    }
    expect(
      (harness.data.getArrangement().getInstrumentById('1') as GenericInstrument).getText(),
    ).toBe('a1 oscili 0.25, 440\nouts a1, a1');
  });

  it('rejects concurrent upsertInstrument ID collision and late authorization revocation before committing', async () => {
    const revokeHarness = createHarness({
      onPrepareBoundary: (history) => {
        const barrier = history.getActiveBarrier();
        if (!barrier) return;
        revokeHarness.setAuthorized(false);
        history.acknowledgeBoundary({
          contextId: 'renderer-1',
          barrierId: barrier.barrierId,
          lastAcknowledgedRevision: revokeHarness.session.read().revision,
          lastAcknowledgedSequence: 0,
          outstandingPrefixCount: 0,
        });
      },
    });
    const snapA = revokeHarness.session.read();
    revokeHarness.history.registerParticipant({
      contextId: 'renderer-1',
      documentId: snapA.documentId!,
      acceptedRevision: snapA.revision,
    });

    const denied = await revokeHarness.bridge.setProjectProperties(revokeHarness.makeAuth(), {
      expected: revokeHarness.currentReceipt(),
      changes: { title: 'Should Be Denied' },
    });
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.code).toBe('ACCESS_DENIED');
    }
    expect(revokeHarness.data.getProjectProperties().title).toBe('History Fixture');

    // Two concurrent upsertInstrument calls with the same new ID: first succeeds, second returns CONFLICT
    const collisionHarness = createHarness();
    const initialReceipt = collisionHarness.currentReceipt();
    const [firstUpsert, secondUpsert] = await Promise.all([
      collisionHarness.bridge.upsertInstrument(collisionHarness.makeAuth(), {
        expected: initialReceipt,
        instrumentId: 'Horn',
        changes: { name: 'First Horn' },
      }),
      collisionHarness.bridge.upsertInstrument(collisionHarness.makeAuth(), {
        expected: initialReceipt,
        instrumentId: 'Horn',
        changes: { name: 'Second Horn' },
      }),
    ]);

    expect(firstUpsert.ok).toBe(true);
    expect(secondUpsert.ok).toBe(false);
    if (!secondUpsert.ok) {
      expect(secondUpsert.code).toBe('CONFLICT');
    }
    expect(collisionHarness.data.getArrangement().getInstrumentById('Horn')?.getName()).toBe(
      'First Horn',
    );
  });

  it('atomically rejects oversize guarded value and structural writes with OUTPUT_REJECTED and no pending proposal', async () => {
    const harness = createHarness({ retainedBytesLimit: 256 });
    const receiptBefore = harness.currentReceipt();

    const hugeCodeRes = await harness.bridge.updateInstrumentCode(harness.makeAuth(), {
      expected: receiptBefore,
      instrumentId: '1',
      changes: { text: '; '.padEnd(1024, 'x') },
    });
    expect(hugeCodeRes.ok).toBe(false);
    if (!hugeCodeRes.ok) {
      expect(hugeCodeRes.code).toBe('OUTPUT_REJECTED');
    }
    expect(harness.currentReceipt()).toEqual(receiptBefore);
    expect(harness.history.isDirty()).toBe(false);
    expect(harness.history.read().cursor).toBe(0);
    expect(
      (harness.data.getArrangement().getInstrumentById('1') as GenericInstrument).getText(),
    ).toBe('a1 oscili 0.25, 440\nouts a1, a1');

    const hugeCreateRes = await harness.bridge.upsertInstrument(harness.makeAuth(), {
      expected: receiptBefore,
      instrumentId: 'HugeInstrument',
      changes: { name: 'Oversized'.padEnd(512, 'Z') },
    });
    expect(hugeCreateRes.ok).toBe(false);
    if (!hugeCreateRes.ok) {
      expect(hugeCreateRes.code).toBe('OUTPUT_REJECTED');
    }
    expect(harness.currentReceipt()).toEqual(receiptBefore);
    expect(harness.history.isDirty()).toBe(false);
    expect(harness.data.getArrangement().getInstrumentById('HugeInstrument')).toBeUndefined();
  });

  it('keeps queued MCP writes permanently invalidated after read-write -> read-only -> read-write toggle (T055)', async () => {
    const toggleHarness = createHarness({
      onPrepareBoundary: (history) => {
        const barrier = history.getActiveBarrier();
        if (!barrier) return;
        // Downgrade to read-only and re-enable read-write before the barrier settles
        toggleHarness.setAccessMode('read-only');
        toggleHarness.setAccessMode('read-write');
        history.acknowledgeBoundary({
          contextId: 'renderer-1',
          barrierId: barrier.barrierId,
          lastAcknowledgedRevision: toggleHarness.session.read().revision,
          lastAcknowledgedSequence: 0,
          outstandingPrefixCount: 0,
        });
      },
    });
    const snap = toggleHarness.session.read();
    toggleHarness.history.registerParticipant({
      contextId: 'renderer-1',
      documentId: snap.documentId!,
      acceptedRevision: snap.revision,
    });

    const auth = toggleHarness.makeAuth('write');
    const denied = await toggleHarness.bridge.setProjectProperties(auth, {
      expected: toggleHarness.currentReceipt(),
      changes: { title: 'Blocked After Downgrade' },
    });
    expect(denied).toMatchObject({ ok: false, code: 'ACCESS_DENIED' });
    expect(toggleHarness.data.getProjectProperties().title).toBe('History Fixture');
    expect(toggleHarness.history.read().cursor).toBe(0);
  });
});
