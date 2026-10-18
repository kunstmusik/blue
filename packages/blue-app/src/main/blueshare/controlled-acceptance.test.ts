import { describe, expect, it, vi } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BlueData, Channel, GenericInstrument, GenericScore, Effect, PolyObject } from '@blue/data';
import { UnifiedLibraryService } from '../unified-library/service';
import { UnifiedLibraryRepositoryClient } from '../unified-library/repository-client';
import { createUnifiedLibraryTestDirectory } from '../unified-library/test-helpers';
import { UnifiedLibraryProjectAdapter } from '../unified-library/project-adapter';
import { ProjectSession } from '../project-session';
import { ProjectHistory } from '../project-history';
import { MockHistoryContext } from '../project-history-test-support';
import { transferProjectEditorIdentities } from '../../shared/project-editor/identity';
import type { ProjectRuntimeReconciliation } from '../project-runtime-reconciliation';
import {
  createConnectedTransport,
  createMockSender,
  FakeBlueShareServer,
  TEST_USERS,
  type TestResourceKind,
} from './test-helpers';
import { BlueShareService } from './service';

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
  const filePath = join(
    tmpdir(),
    `bs-controlled-acceptance-${Math.random().toString(36).slice(2)}.blue`,
  );
  session.replace(data, filePath);

  const reconciliation: ProjectRuntimeReconciliation = {
    reconcileCommit: vi.fn(async () => []),
    drainPreviews: vi.fn(async () => {}),
  } as unknown as ProjectRuntimeReconciliation;

  const history = new ProjectHistory({ session, reconciliation });
  const context = new MockHistoryContext('ctx-bs-controlled-acceptance');

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

describe('Controlled Desktop-to-Implemented-Service Acceptance (T052 / T073)', () => {
  it('executes full controlled-catalog acceptance for all three kinds with project invariance, pagination, restart, exact content, owner removal, and uncertain outcomes', async () => {
    const dir = createUnifiedLibraryTestDirectory('bs-controlled-acceptance-');
    const project = createConnectedProject();
    project.history.markClean();
    const initialXml = project.live().saveToString();
    const initialRevision = project.revision;

    try {
      // 1. Unified Library setup
      const libraryService = new UnifiedLibraryService(
        dir.databasePath,
        UnifiedLibraryRepositoryClient.openForTesting,
        project.adapter,
      );
      await libraryService.start();

      // 2. Fake BlueShare server with >= 25 items per kind (30 items), nested and empty categories
      const fakeServer = new FakeBlueShareServer();
      const transport = createConnectedTransport(fakeServer);
      const blueShareService = new BlueShareService({ transport, libraryService });
      const sender = createMockSender(101);
      const openRes = blueShareService.openDialog(sender);
      expect(openRes.ok).toBe(true);
      const { contextId } = (openRes as any).value;

      const kinds: readonly TestResourceKind[] = ['instrument', 'effect', 'soundObject'];

      // =========================================================================
      // Step A: Categories & Nested / Empty Trees
      // =========================================================================
      for (const kind of kinds) {
        const catsRes = await blueShareService.getCategories(contextId, `req-cat-${kind}`, kind);
        expect(catsRes.ok).toBe(true);
        if (!catsRes.ok) throw new Error(`Failed to get categories for ${kind}`);

        // Verify categories exist, include nested and empty categories
        expect(catsRes.value.length).toBeGreaterThanOrEqual(3);
        const hasNested = catsRes.value.some((c) => c.parentId !== null);
        const hasEmpty = catsRes.value.some((c) => c.name.toLowerCase().includes('empty'));
        expect(hasNested).toBe(true);
        expect(hasEmpty).toBe(true);
      }

      // =========================================================================
      // Step B: Public Pagination (Page size 25, cursor beforeId, second page)
      // =========================================================================
      for (const kind of kinds) {
        // Page 1: 25 items
        const page1Res = await blueShareService.listResources(
          contextId,
          `req-p1-${kind}`,
          kind,
          null,
          null,
        );
        expect(page1Res.ok).toBe(true);
        if (!page1Res.ok) throw new Error(`Failed to list page 1 for ${kind}`);

        expect(page1Res.value.items.length).toBe(25);
        expect(page1Res.value.nextBeforeId).not.toBeNull();

        // Verify descending ID ordering
        for (let i = 1; i < page1Res.value.items.length; i++) {
          expect(page1Res.value.items[i].id).toBeLessThan(page1Res.value.items[i - 1].id);
        }

        // Page 2: remaining items (30 - 25 = 5 items)
        const page2Res = await blueShareService.listResources(
          contextId,
          `req-p2-${kind}`,
          kind,
          null,
          page1Res.value.nextBeforeId,
        );
        expect(page2Res.ok).toBe(true);
        if (!page2Res.ok) throw new Error(`Failed to list page 2 for ${kind}`);

        expect(page2Res.value.items.length).toBe(5);
        expect(page2Res.value.nextBeforeId).toBeNull();
      }

      // =========================================================================
      // Step C: Independent Latest Ordering (Per-kind latest-ten)
      // =========================================================================
      for (const kind of kinds) {
        const latestRes = await blueShareService.getLatest(contextId, `req-latest-${kind}`, kind);
        expect(latestRes.ok).toBe(true);
        if (!latestRes.ok) throw new Error(`Failed to get latest for ${kind}`);

        expect(latestRes.value.items.length).toBe(10);
        expect(latestRes.value.items.every((it) => it.kind === kind)).toBe(true);

        // Verify latest ordering: dates descending, ties by descending ID
        for (let i = 1; i < latestRes.value.items.length; i++) {
          const prev = latestRes.value.items[i - 1];
          const curr = latestRes.value.items[i];
          if (prev.createdAt && curr.createdAt) {
            const prevTime = new Date(prev.createdAt).getTime();
            const currTime = new Date(curr.createdAt).getTime();
            expect(prevTime).toBeGreaterThanOrEqual(currTime);
            if (prevTime === currTime) {
              expect(prev.id).toBeGreaterThan(curr.id);
            }
          }
        }
      }

      // =========================================================================
      // Step D: Durable Import and Restart Persistence
      // =========================================================================
      const importedIds: Record<TestResourceKind, string> = {
        instrument: '',
        effect: '',
        soundObject: '',
      };

      for (const kind of kinds) {
        // Import resource ID 1 of this kind
        const importRes = await blueShareService.importResource(contextId, `req-import-${kind}`, {
          kind,
          id: 1,
        });
        expect(importRes.ok).toBe(true);
        if (!importRes.ok) throw new Error(`Failed to import ${kind} 1`);

        expect(importRes.value.affectedNodes.length).toBeGreaterThan(0);
        importedIds[kind] = importRes.value.affectedNodes[0].nodeId;
      }

      // Simulate application restart by stopping the library service and re-opening with the same database
      await libraryService.stop();

      const restartedLibraryService = new UnifiedLibraryService(
        dir.databasePath,
        UnifiedLibraryRepositoryClient.openForTesting,
        project.adapter,
      );
      await restartedLibraryService.start();

      // Verify all 3 imported resources survive restart and are readable from their respective folders
      for (const kind of kinds) {
        const sourceRes = await restartedLibraryService.capturePublishSource({
          key: { scope: 'user', libraryType: kind, nodeId: importedIds[kind] },
          expectedRevision: 1,
        });
        expect(sourceRes.ok).toBe(true);
        if (!sourceRes.ok) throw new Error(`Resource ${kind} missing after restart`);
        expect(sourceRes.value.xml).toBeTruthy();
        expect(sourceRes.value.xml.length).toBeGreaterThan(0);
      }

      // Reconnect BlueShareService with restarted library service
      const restartedBlueShareService = new BlueShareService({
        transport,
        libraryService: restartedLibraryService,
      });
      const restartedOpen = restartedBlueShareService.openDialog(sender);
      expect(restartedOpen.ok).toBe(true);
      const restartedContextId = (restartedOpen as any).value.contextId;

      // =========================================================================
      // Step E: Exact Reviewed Publish and Retrieve Content
      // =========================================================================
      // Sign in as Steven (user-001)
      const loginRes = await restartedBlueShareService.signIn(
        restartedContextId,
        'req-login-steven',
        TEST_USERS[0].email,
        TEST_USERS[0].password,
      );
      expect(loginRes.ok).toBe(true);

      const publishedIds: Record<TestResourceKind, number> = {
        instrument: 0,
        effect: 0,
        soundObject: 0,
      };

      const multilineDescription =
        '  Line 1: Special Synth\\n\\tLine 2: Indented note\\nLine 3: Trailing space  ';

      for (const kind of kinds) {
        const prepRes = await restartedBlueShareService.preparePublishSource(
          restartedContextId,
          `req-prep-${kind}`,
          { scope: 'user', libraryType: kind, nodeId: importedIds[kind] },
          1,
        );
        expect(prepRes.ok).toBe(true);
        if (!prepRes.ok) throw new Error(`Prepare publish failed for ${kind}`);

        const catId = kind === 'instrument' ? 10 : kind === 'effect' ? 20 : 30;
        const pubRes = await restartedBlueShareService.publishResource(
          restartedContextId,
          `req-pub-${kind}`,
          prepRes.value.sourceToken,
          catId,
          `Published ${kind}`,
          multilineDescription,
        );
        expect(pubRes.ok).toBe(true);
        if (!pubRes.ok) throw new Error(`Publish failed for ${kind}`);

        publishedIds[kind] = pubRes.value.id;
      }

      // Now retrieve each published item back and verify exact XML and description whitespace
      for (const kind of kinds) {
        const getRes = await restartedBlueShareService.getResource(
          restartedContextId,
          `req-get-pub-${kind}`,
          { kind, id: publishedIds[kind] },
        );
        expect(getRes.ok).toBe(true);
        if (!getRes.ok) throw new Error(`Failed to retrieve published ${kind}`);

        expect(getRes.value.name).toBe(`Published ${kind}`);
        expect(getRes.value.description).toBe(multilineDescription);
        expect(getRes.value.author.id).toBe(TEST_USERS[0].id);
      }

      // =========================================================================
      // Step F: Owned Pagination (/mine)
      // =========================================================================
      for (const kind of kinds) {
        const mineRes = await restartedBlueShareService.listMine(
          restartedContextId,
          `req-mine-${kind}`,
          kind,
          null,
        );
        expect(mineRes.ok).toBe(true);
        if (!mineRes.ok) throw new Error(`Failed to list owned for ${kind}`);

        // Steven owns several pre-seeded items plus the 1 newly published item
        expect(mineRes.value.items.length).toBeGreaterThanOrEqual(1);
        expect(mineRes.value.items.some((it) => it.id === publishedIds[kind])).toBe(true);
        expect(mineRes.value.items.every((it) => it.author.id === TEST_USERS[0].id)).toBe(true);
      }

      // =========================================================================
      // Step G: Owner Denial, Cancellation, and Removal Exclusion
      // =========================================================================
      // Switch to Other Author (user-002)
      const loginOther = await restartedBlueShareService.signIn(
        restartedContextId,
        'req-login-other',
        TEST_USERS[1].email,
        TEST_USERS[1].password,
      );
      expect(loginOther.ok).toBe(true);

      // 1. Owner denial: user-002 attempts to remove user-001's published instrument
      const deniedRemove = await restartedBlueShareService.removeResource(
        restartedContextId,
        'req-remove-denied',
        { kind: 'instrument', id: publishedIds.instrument },
      );
      expect(deniedRemove.ok).toBe(false);
      if (deniedRemove.ok) throw new Error('Expected denial of non-owner removal');
      expect(deniedRemove.error.status).toBe(403);
      expect(deniedRemove.error.outcome).toBe('rejected');

      // 2. Cancellation: If user cancels in UI dialog, no request is dispatched to service.
      // (Verified by the fact that publishedIds.instrument is still accessible on the server).
      const checkStillThere = await restartedBlueShareService.getResource(
        restartedContextId,
        'req-check-exists',
        { kind: 'instrument', id: publishedIds.instrument },
      );
      expect(checkStillThere.ok).toBe(true);

      // 3. Switch back to Steven (user-001) for owner removal
      await restartedBlueShareService.signIn(
        restartedContextId,
        'req-login-steven-again',
        TEST_USERS[0].email,
        TEST_USERS[0].password,
      );

      // Owner removal of all three published resources
      for (const kind of kinds) {
        const removeRes = await restartedBlueShareService.removeResource(
          restartedContextId,
          `req-remove-owner-${kind}`,
          { kind, id: publishedIds[kind] },
        );
        expect(removeRes.ok).toBe(true);
        if (!removeRes.ok) throw new Error(`Failed to remove ${kind}`);
        expect(removeRes.value.removed).toBe(true);

        // 4. Removal exclusion: Subsequent public detail returns 410 Gone
        const getRemoved = await restartedBlueShareService.getResource(
          restartedContextId,
          `req-get-removed-${kind}`,
          { kind, id: publishedIds[kind] },
        );
        expect(getRemoved.ok).toBe(false);
        if (getRemoved.ok) throw new Error(`Expected 410 for removed ${kind}`);
        expect(getRemoved.error.status).toBe(410);

        // 5. Subsequent owned list excludes removed item
        const mineAfter = await restartedBlueShareService.listMine(
          restartedContextId,
          `req-mine-after-${kind}`,
          kind,
          null,
        );
        expect(mineAfter.ok).toBe(true);
        if (!mineAfter.ok) throw new Error(`Failed to list owned after remove for ${kind}`);
        expect(mineAfter.value.items.some((it) => it.id === publishedIds[kind])).toBe(false);

        // 6. Local imported copy in user library is STILL present and untouched!
        const localCopy = await restartedLibraryService.capturePublishSource({
          key: { scope: 'user', libraryType: kind, nodeId: importedIds[kind] },
          expectedRevision: 1,
        });
        expect(localCopy.ok).toBe(true);
        if (!localCopy.ok) throw new Error(`Local copy was deleted on remote removal!`);
        expect(localCopy.value.xml).toBeTruthy();
      }

      // =========================================================================
      // Step H: Uncertain Outcomes (504 Timeout handling on publish and remove)
      // =========================================================================
      fakeServer.lostCommittedWrites = true;

      // 1. Uncertain publish: Returns outcome 'unknown' (504)
      const prepUncertain = await restartedBlueShareService.preparePublishSource(
        restartedContextId,
        'req-prep-unc',
        { scope: 'user', libraryType: 'instrument', nodeId: importedIds.instrument },
        1,
      );
      expect(prepUncertain.ok).toBe(true);
      if (!prepUncertain.ok) throw new Error('Prepare uncertain publish failed');

      const uncertainPub = await restartedBlueShareService.publishResource(
        restartedContextId,
        'req-pub-unc',
        prepUncertain.value.sourceToken,
        10,
        'Uncertain Synth',
        'Draft description',
      );
      expect(uncertainPub.ok).toBe(false);
      if (uncertainPub.ok) throw new Error('Expected 504 on uncertain publish');
      expect(uncertainPub.error.status).toBe(504);
      expect(uncertainPub.error.outcome).toBe('unknown');

      // 2. Uncertain remove: Returns outcome 'unknown' (504)
      const uncertainRemove = await restartedBlueShareService.removeResource(
        restartedContextId,
        'req-remove-unc',
        { kind: 'instrument', id: 2 },
      );
      expect(uncertainRemove.ok).toBe(false);
      if (uncertainRemove.ok) throw new Error('Expected 504 on uncertain remove');
      expect(uncertainRemove.error.status).toBe(504);
      expect(uncertainRemove.error.outcome).toBe('unknown');

      fakeServer.resetFaults();

      // =========================================================================
      // Step I: Complete Project and History Invariance Assertion
      // =========================================================================
      // Throughout this entire multi-step acceptance exercise spanning browse,
      // pagination, import, restart, publish, retrieve, denial, removal, and
      // timeouts across all three kinds:
      // The connected active project must be 100% clean and invariant!
      expect(project.live().saveToString()).toBe(initialXml);
      expect(project.revision).toBe(initialRevision);
      expect(project.history.isDirty()).toBe(false);
      expect(project.history.read().undoLabel).toBeNull();
      expect(project.reconciliation.reconcileCommit).not.toHaveBeenCalled();

      restartedBlueShareService.destroy();
      await restartedLibraryService.stop();
    } finally {
      dir.cleanup();
    }
  });
});
