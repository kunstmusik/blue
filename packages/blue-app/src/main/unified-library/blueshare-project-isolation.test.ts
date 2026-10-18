import { describe, expect, it, vi } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BlueData, Channel, GenericInstrument, GenericScore, Effect, PolyObject } from '@blue/data';
import { UnifiedLibraryService } from './service';
import { UnifiedLibraryRepositoryClient } from './repository-client';
import { createUnifiedLibraryTestDirectory } from './test-helpers';
import { UnifiedLibraryProjectAdapter } from './project-adapter';
import { ProjectSession } from '../project-session';
import { ProjectHistory } from '../project-history';
import { MockHistoryContext } from '../project-history-test-support';
import { transferProjectEditorIdentities } from '../../shared/project-editor/identity';
import type { ProjectRuntimeReconciliation } from '../project-runtime-reconciliation';
import {
  createSyntheticInstrumentXml,
  createSyntheticEffectXml,
  createSyntheticSoundObjectXml,
  createInvalidXml,
  createUnsupportedTypeXml,
  createConnectedTransport,
  createMockSender,
  FakeBlueShareServer,
  TEST_USERS,
} from '../blueshare/test-helpers';
import { BlueShareService } from '../blueshare/service';
import { BlueShareTransport } from '../blueshare/transport';

function createConnectedProject() {
  const data = new BlueData();

  // Initial instrument in arrangement
  const initialInstr = new GenericInstrument();
  initialInstr.setName('Existing Instrument');
  data.getArrangement().addInstrument(initialInstr, '1');

  // Initial sound object in score
  const group = new PolyObject(true);
  group.setName('Score Root');
  group.newLayerAt(0);
  data.getScore().push(group);

  // Initial mixer channel with an effect
  const channel = new Channel();
  channel.setName('Lead Channel');
  channel.setAssociation('1');
  const initialEffect = new Effect();
  initialEffect.setName('Existing Effect');
  channel.getPreEffects().push(initialEffect);
  data.getMixer().getChannels().push(channel);

  const session = new ProjectSession();
  const filePath = join(tmpdir(), `bs-isolation-${Math.random().toString(36).slice(2)}.blue`);
  session.replace(data, filePath);

  const reconciliation: ProjectRuntimeReconciliation = {
    reconcileCommit: vi.fn(async () => []),
    drainPreviews: vi.fn(async () => {}),
  } as unknown as ProjectRuntimeReconciliation;

  const history = new ProjectHistory({ session, reconciliation });
  const context = new MockHistoryContext('ctx-bs-project-isolation');

  const live = () => session.read().data!;

  const adapter = new UnifiedLibraryProjectAdapter(() => {
    const current = session.read();
    if (!current.data) throw new Error('No active project session');
    const candidate = current.data.historyCopy();
    transferProjectEditorIdentities(current.data, candidate);
    return {
      data: candidate,
      sessionId: current.sessionId,
      revision: current.revision,
      commit: async (label?: string) => {
        const receipt = await history.commitPreparedStructuralMutation({
          label: label ?? 'Library Transfer',
          candidate,
          expectedDocumentId: current.documentId!,
          expectedSessionId: current.sessionId,
          expectedRevision: current.revision,
        });
        if (!receipt.changed) {
          throw new Error(receipt.error ?? 'Mutation was not committed');
        }
        return receipt.revision;
      },
    };
  });

  return {
    session,
    history,
    context,
    adapter,
    reconciliation,
    live,
    get data() {
      return live();
    },
    get revision() {
      return session.read().revision;
    },
    get documentId() {
      return session.read().documentId!;
    },
    get sessionId() {
      return session.read().sessionId;
    },
  };
}

describe('BlueShare Project Isolation and Downstream Insertion (T021)', () => {
  it('preserves active project content, revision, and history during successful and failed imports', async () => {
    const dir = createUnifiedLibraryTestDirectory('bs-proj-isolation-');
    const project = createConnectedProject();
    project.history.markClean();
    const initialXml = project.live().saveToString();
    const initialRevision = project.revision;

    try {
      const libraryService = new UnifiedLibraryService(
        dir.databasePath,
        UnifiedLibraryRepositoryClient.openForTesting,
        project.adapter,
      );
      await libraryService.start();

      // 1. Successful imports across all kinds
      const instrXml = createSyntheticInstrumentXml('Imported Synth');
      const effectXml = createSyntheticEffectXml('Imported Chorus');
      const scoreXml = createSyntheticSoundObjectXml('Imported Pattern');

      const res1 = await libraryService.importStandaloneResource(
        'instrument',
        instrXml,
        1,
        'Imported Synth',
      );
      const res2 = await libraryService.importStandaloneResource(
        'effect',
        effectXml,
        2,
        'Imported Chorus',
      );
      const res3 = await libraryService.importStandaloneResource(
        'soundObject',
        scoreXml,
        3,
        'Imported Pattern',
      );

      expect(res1.ok).toBe(true);
      expect(res2.ok).toBe(true);
      expect(res3.ok).toBe(true);

      // 2. Failed imports (invalid XML, wrong root, unsupported type)
      const fail1 = await libraryService.importStandaloneResource(
        'instrument',
        createInvalidXml(),
        4,
        'Broken',
      );
      const fail2 = await libraryService.importStandaloneResource(
        'instrument',
        effectXml,
        5,
        'Mismatched',
      );
      const fail3 = await libraryService.importStandaloneResource(
        'instrument',
        createUnsupportedTypeXml(),
        6,
        'Unsupported',
      );

      expect(fail1.ok).toBe(false);
      expect(fail2.ok).toBe(false);
      expect(fail3.ok).toBe(false);

      // Verify complete project invariance
      expect(project.live().saveToString()).toBe(initialXml);
      expect(project.revision).toBe(initialRevision);
      expect(project.history.isDirty()).toBe(false);
      expect(project.history.read().undoLabel).toBeNull();
      expect(project.reconciliation.reconcileCommit).not.toHaveBeenCalled();

      await libraryService.stop();
    } finally {
      dir.cleanup();
    }
  });

  it('allows downstream insertion of imported items into project with real history commit, undo, and redo for instrument, effect, and SoundObject', async () => {
    const dir = createUnifiedLibraryTestDirectory('bs-downstream-insert-');
    const project = createConnectedProject();
    project.history.markClean();
    const baselineXml = project.live().saveToString();
    const initialDocId = project.documentId;
    const initialRevision = project.revision;

    try {
      const libraryService = new UnifiedLibraryService(
        dir.databasePath,
        UnifiedLibraryRepositoryClient.openForTesting,
        project.adapter,
      );
      await libraryService.start();

      // ==========================================
      // 1. Downstream Instrument Insertion
      // ==========================================
      const importedInstrXml = createSyntheticInstrumentXml('BlueShare Lead');
      const importInstrRes = await libraryService.importStandaloneResource(
        'instrument',
        importedInstrXml,
        42,
        'BlueShare Lead',
      );
      expect(importInstrRes.ok).toBe(true);
      if (!importInstrRes.ok) throw new Error('Instrument import failed');

      const instrNodeId = importInstrRes.value.affectedNodes[0].nodeId;
      const beforeInstrRev = project.revision;

      const instrReceipt = await project.adapter.applyInsertion({
        key: { scope: 'user', libraryType: 'instrument', nodeId: instrNodeId },
        payloadXml: importedInstrXml,
        target: {
          libraryType: 'instrument',
          projectSessionId: project.sessionId,
          label: 'Project Arrangement',
          valid: true,
          targetRevision: String(beforeInstrRev),
          insertIndex: 1,
        },
        mode: 'independent',
      });

      expect(instrReceipt.projectRevision).toBe(beforeInstrRev + 1);
      expect(project.history.isDirty()).toBe(true);
      expect(project.history.read().undoLabel).toBe('Insert Library Item');
      expect(project.reconciliation.reconcileCommit).toHaveBeenCalled();

      // Check arrangement has 2 instruments with stable identities
      const arrangementAfterInstr = project.live().getArrangement().getArrangement();
      expect(arrangementAfterInstr.length).toBe(2);
      expect(arrangementAfterInstr[0].instr?.getName()).toBe('Existing Instrument');
      expect(arrangementAfterInstr[0].arrangementId).toBe('1');
      expect(arrangementAfterInstr[1].instr?.getName()).toBe('BlueShare Lead');
      expect(arrangementAfterInstr[1].arrangementId).toBe('2');

      // Real Undo: restore pre-insertion state
      const undoInstr = await project.history.undo(
        project.context.nextUndoRequest(initialDocId, project.revision),
      );
      expect(undoInstr.status).toBe('committed');
      expect(project.live().getArrangement().getArrangement().length).toBe(1);
      expect(project.live().getArrangement().getArrangement()[0].instr?.getName()).toBe(
        'Existing Instrument',
      );
      expect(project.live().getArrangement().getArrangement()[0].arrangementId).toBe('1');
      expect(project.history.isDirty()).toBe(false);
      expect(project.history.read().redoLabel).toBe('Insert Library Item');

      // Real Redo: re-apply insertion
      const redoInstr = await project.history.redo(
        project.context.nextRedoRequest(initialDocId, project.revision),
      );
      expect(redoInstr.status).toBe('committed');
      expect(project.live().getArrangement().getArrangement().length).toBe(2);
      expect(project.live().getArrangement().getArrangement()[1].instr?.getName()).toBe(
        'BlueShare Lead',
      );
      expect(project.history.isDirty()).toBe(true);

      // ==========================================
      // 2. Downstream Effect Insertion
      // ==========================================
      const importedEffectXml = createSyntheticEffectXml('BlueShare Chorus');
      const importEffectRes = await libraryService.importStandaloneResource(
        'effect',
        importedEffectXml,
        43,
        'BlueShare Chorus',
      );
      expect(importEffectRes.ok).toBe(true);
      if (!importEffectRes.ok) throw new Error('Effect import failed');

      const effectNodeId = importEffectRes.value.affectedNodes[0].nodeId;
      const beforeEffectRev = project.revision;

      const effectReceipt = await project.adapter.applyInsertion({
        key: { scope: 'user', libraryType: 'effect', nodeId: effectNodeId },
        payloadXml: importedEffectXml,
        target: {
          libraryType: 'effect',
          projectSessionId: project.sessionId,
          label: 'Effect Chain',
          valid: true,
          targetRevision: String(beforeEffectRev),
          channelId: '1',
          chain: 'pre',
          insertIndex: 1,
        },
        mode: 'independent',
      });

      expect(effectReceipt.projectRevision).toBe(beforeEffectRev + 1);
      expect(project.history.isDirty()).toBe(true);
      expect(project.history.read().undoLabel).toBe('Insert Library Item');

      const preEffects = project.live().getMixer().getChannels()[0].getPreEffects();
      expect(preEffects.length).toBe(2);
      expect((preEffects[0] as Effect).getName()).toBe('Existing Effect');
      expect((preEffects[1] as Effect).getName()).toBe('BlueShare Chorus');

      // Real Undo: restore pre-effect state
      const undoEffect = await project.history.undo(
        project.context.nextUndoRequest(initialDocId, project.revision),
      );
      expect(undoEffect.status).toBe('committed');
      expect(project.live().getMixer().getChannels()[0].getPreEffects().length).toBe(1);
      expect(
        (project.live().getMixer().getChannels()[0].getPreEffects()[0] as Effect).getName(),
      ).toBe('Existing Effect');

      // Real Redo: re-apply effect insertion
      const redoEffect = await project.history.redo(
        project.context.nextRedoRequest(initialDocId, project.revision),
      );
      expect(redoEffect.status).toBe('committed');
      expect(project.live().getMixer().getChannels()[0].getPreEffects().length).toBe(2);
      expect(
        (project.live().getMixer().getChannels()[0].getPreEffects()[1] as Effect).getName(),
      ).toBe('BlueShare Chorus');

      // ==========================================
      // 3. Downstream SoundObject Insertion
      // ==========================================
      const importedScoreXml = createSyntheticSoundObjectXml('BlueShare Pattern');
      const importScoreRes = await libraryService.importStandaloneResource(
        'soundObject',
        importedScoreXml,
        44,
        'BlueShare Pattern',
      );
      expect(importScoreRes.ok).toBe(true);
      if (!importScoreRes.ok) throw new Error('SoundObject import failed');

      const scoreNodeId = importScoreRes.value.affectedNodes[0].nodeId;
      const beforeScoreRev = project.revision;

      const scoreReceipt = await project.adapter.applyInsertion({
        key: { scope: 'user', libraryType: 'soundObject', nodeId: scoreNodeId },
        payloadXml: importedScoreXml,
        target: {
          libraryType: 'soundObject',
          projectSessionId: project.sessionId,
          label: 'SoundObject Library',
          valid: true,
          targetRevision: String(beforeScoreRev),
          destinationKind: 'projectSoundObjectLibrary',
        },
        mode: 'independent',
      });

      expect(scoreReceipt.projectRevision).toBe(beforeScoreRev + 1);
      expect(project.history.isDirty()).toBe(true);
      expect(project.history.read().undoLabel).toBe('Insert Library Item');
      const insertedSoundObj = project
        .live()
        .getSoundObjectLibrary()
        .getObjectById(scoreReceipt.insertedIdentity);
      expect(insertedSoundObj?.getName()).toBe('BlueShare Pattern');

      // Real Undo: restore pre-score state
      const undoScore = await project.history.undo(
        project.context.nextUndoRequest(initialDocId, project.revision),
      );
      expect(undoScore.status).toBe('committed');
      expect(
        project.live().getSoundObjectLibrary().getObjectById(scoreReceipt.insertedIdentity),
      ).toBeUndefined();

      // Real Redo: re-apply soundObject insertion
      const redoScore = await project.history.redo(
        project.context.nextRedoRequest(initialDocId, project.revision),
      );
      expect(redoScore.status).toBe('committed');
      expect(
        project
          .live()
          .getSoundObjectLibrary()
          .getObjectById(scoreReceipt.insertedIdentity)
          ?.getName(),
      ).toBe('BlueShare Pattern');

      // Complete unwind back to clean baseline: undo soundObject, undo effect, undo instrument
      await project.history.undo(project.context.nextUndoRequest(initialDocId, project.revision));
      await project.history.undo(project.context.nextUndoRequest(initialDocId, project.revision));
      await project.history.undo(project.context.nextUndoRequest(initialDocId, project.revision));
      expect(project.live().saveToString()).toBe(baselineXml);
      expect(project.history.isDirty()).toBe(false);

      await libraryService.stop();
    } finally {
      dir.cleanup();
    }
  });

  it('cancelling or abandoning an insertion preview restores canonical project state', async () => {
    const dir = createUnifiedLibraryTestDirectory('bs-preview-cancel-');
    const project = createConnectedProject();
    project.history.markClean();
    const initialXml = project.live().saveToString();
    const initialRevision = project.revision;

    try {
      const libraryService = new UnifiedLibraryService(
        dir.databasePath,
        UnifiedLibraryRepositoryClient.openForTesting,
        project.adapter,
      );
      await libraryService.start();

      // Import an instrument to preview
      const importedInstrXml = createSyntheticInstrumentXml('Preview Instrument');
      const importRes = await libraryService.importStandaloneResource(
        'instrument',
        importedInstrXml,
        88,
        'Preview Instrument',
      );
      expect(importRes.ok).toBe(true);
      if (!importRes.ok) throw new Error('Import failed');

      // Set destination target in library service
      const contextRes = libraryService.setLibraryContext({
        type: 'instrumentTarget',
        projectSessionId: project.sessionId,
      });
      expect(contextRes.ok).toBe(true);

      const previewRes = await libraryService.previewLibraryInsertion({
        key: {
          scope: 'user',
          libraryType: 'instrument',
          nodeId: importRes.value.affectedNodes[0].nodeId,
        },
        mode: 'independent',
      });

      expect(previewRes.ok).toBe(true);
      // Project is untouched during preview
      expect(project.live().saveToString()).toBe(initialXml);
      expect(project.revision).toBe(initialRevision);
      expect(project.history.isDirty()).toBe(false);
      expect(project.reconciliation.reconcileCommit).not.toHaveBeenCalled();

      // Abandon/clear target
      libraryService.clearLibraryInsertionTarget();
      expect(project.live().saveToString()).toBe(initialXml);
      expect(project.revision).toBe(initialRevision);
      expect(project.history.isDirty()).toBe(false);

      await libraryService.stop();
    } finally {
      dir.cleanup();
    }
  });

  it('remote removal, authentication, publish, and account lifecycle preserve existing local imported copies and active project/dirty/history state', async () => {
    const dir = createUnifiedLibraryTestDirectory('bs-remote-remove-isolation-');
    const project = createConnectedProject();
    project.history.markClean();
    const initialXml = project.live().saveToString();
    const initialRevision = project.revision;

    try {
      const libraryService = new UnifiedLibraryService(
        dir.databasePath,
        UnifiedLibraryRepositoryClient.openForTesting,
        project.adapter,
      );
      await libraryService.start();

      // 1. Import a standalone instrument from BlueShare into the user library
      const importedInstrXml = createSyntheticInstrumentXml('Locally Retained Synth');
      const importRes = await libraryService.importStandaloneResource(
        'instrument',
        importedInstrXml,
        2, // Remote resource ID 2 (owned by Steven)
        'Locally Retained Synth',
      );
      expect(importRes.ok).toBe(true);
      if (!importRes.ok) throw new Error('Import failed');
      const importedNodeId = importRes.value.affectedNodes[0].nodeId;

      // Verify the local copy exists and contains the expected XML
      const readRes = await libraryService.capturePublishSource({
        key: {
          scope: 'user',
          libraryType: 'instrument',
          nodeId: importedNodeId,
        },
        expectedRevision: 1,
      });
      expect(readRes.ok).toBe(true);
      if (!readRes.ok) throw new Error('Failed to read local resource');
      expect(readRes.value.xml).toBe(importedInstrXml);

      // 2. Setup BlueShare service connected to FakeBlueShareServer
      const fakeServer = new FakeBlueShareServer();
      const transport = createConnectedTransport(fakeServer);
      const blueShareService = new BlueShareService({ transport, libraryService });
      const sender = createMockSender(99);
      const openRes = blueShareService.openDialog(sender);
      expect(openRes.ok).toBe(true);
      const { contextId } = (openRes as any).value;

      // Sign in as Steven (TEST_USERS[0], who owns resource 2)
      const loginRes = await blueShareService.signIn(
        contextId,
        'req-login',
        TEST_USERS[0].email,
        TEST_USERS[0].password,
      );
      expect(loginRes.ok).toBe(true);

      // 3. Publish an item from user library and verify active project invariance
      const prepareRes = await blueShareService.preparePublishSource(
        contextId,
        'req-prep',
        { scope: 'user', libraryType: 'instrument', nodeId: importedNodeId },
        1,
      );
      expect(prepareRes.ok).toBe(true);
      if (!prepareRes.ok) throw new Error('Prepare publish failed');

      const publishRes = await blueShareService.publishResource(
        contextId,
        'req-pub',
        prepareRes.value.sourceToken,
        10,
        'Published Synth',
        'A test publish',
      );
      expect(publishRes.ok).toBe(true);

      // 4. Perform remote removal of resource 2 from BlueShare
      const removeRes = await blueShareService.removeResource(contextId, 'req-rem', {
        kind: 'instrument',
        id: 2,
      });
      expect(removeRes.ok).toBe(true);
      if (!removeRes.ok) throw new Error('Expected removal to succeed');
      expect(removeRes.value.removed).toBe(true);

      // Verify server now reports resource 2 as removed (410)
      const getRes = await blueShareService.getResource(contextId, 'req-get', {
        kind: 'instrument',
        id: 2,
      });
      expect(getRes.ok).toBe(false);
      if (getRes.ok) throw new Error('Expected 410 from removed resource');
      expect(getRes.error.status).toBe(410);

      // 5. Critical Invariance check: Local imported copy in user library is STILL intact!
      const verifyLocalCopy = await libraryService.capturePublishSource({
        key: {
          scope: 'user',
          libraryType: 'instrument',
          nodeId: importedNodeId,
        },
        expectedRevision: 1,
      });
      expect(verifyLocalCopy.ok).toBe(true);
      if (!verifyLocalCopy.ok) throw new Error('Local copy was corrupted or deleted!');
      expect(verifyLocalCopy.value.xml).toBe(importedInstrXml);
      expect(verifyLocalCopy.value.displayName).toBe('Locally Retained Synth');

      // 6. Repeated removal, non-owner attempt, and sign-out also preserve local state
      const repeatRes = await blueShareService.removeResource(contextId, 'req-repeat', {
        kind: 'instrument',
        id: 2,
      });
      expect(repeatRes.ok).toBe(true);
      if (!repeatRes.ok) throw new Error('Repeat removal failed');
      expect(repeatRes.value.alreadyRemoved).toBe(true);

      // Sign out
      await blueShareService.signOut(contextId, 'req-signout');

      // Re-verify local copy after signout
      const verifyAfterSignout = await libraryService.capturePublishSource({
        key: {
          scope: 'user',
          libraryType: 'instrument',
          nodeId: importedNodeId,
        },
        expectedRevision: 1,
      });
      expect(verifyAfterSignout.ok).toBe(true);
      if (!verifyAfterSignout.ok) throw new Error('Local copy missing after sign out');
      expect(verifyAfterSignout.value.xml).toBe(importedInstrXml);

      // 7. Project Invariance: Active project was NEVER touched by any of these operations!
      expect(project.live().saveToString()).toBe(initialXml);
      expect(project.revision).toBe(initialRevision);
      expect(project.history.isDirty()).toBe(false);
      expect(project.history.read().undoLabel).toBeNull();
      expect(project.reconciliation.reconcileCommit).not.toHaveBeenCalled();

      blueShareService.destroy();
      await libraryService.stop();
    } finally {
      dir.cleanup();
    }
  });
});
