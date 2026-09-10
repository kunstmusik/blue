import { describe, expect, it } from 'vitest';
import type { BlueData } from '@blue/data';
import { ProjectSession, createDocumentLifetimeId, createHistoryStateId } from './project-session';

const data = { id: 'orig-data' } as unknown as BlueData;
const candidateData = { id: 'cand-data' } as unknown as BlueData;

describe('ProjectSession', () => {
  it('owns empty, unsaved, saved, replaced, closed, and shutdown transitions', () => {
    const session = new ProjectSession();
    expect(session.read()).toMatchObject({
      data: null,
      filePath: null,
      revision: 0,
      sessionId: 0,
      documentId: null,
      stateId: null,
    });

    const unsaved = session.replace(data, null);
    expect(unsaved).toMatchObject({
      data,
      filePath: null,
      revision: 0,
      sessionId: 1,
    });
    expect(typeof unsaved.documentId).toBe('string');
    expect(typeof unsaved.stateId).toBe('string');

    const docId1 = unsaved.documentId;
    const stateId1 = unsaved.stateId;

    const saved = session.publishPath('/tmp/example.blue');
    expect(saved).toMatchObject({
      data,
      filePath: '/tmp/example.blue',
      revision: 0,
      sessionId: 1,
      documentId: docId1,
      stateId: stateId1,
    });

    const changed = session.recordMutation({ changed: true });
    expect(changed).toMatchObject({
      changed: true,
      revision: 1,
      sessionId: 1,
      documentId: docId1,
    });
    expect(changed.stateId).toBeDefined();
    expect(changed.stateId).not.toBe(stateId1);

    const stateId2 = changed.stateId;

    const noopReceipt = session.recordMutation({ changed: false });
    expect(noopReceipt).toMatchObject({
      changed: false,
      revision: 1,
      sessionId: 1,
      documentId: docId1,
      stateId: stateId2,
    });

    const replaced = session.replace(data, 'C:\\Projects\\next.blue');
    expect(replaced).toMatchObject({
      data,
      filePath: 'C:\\Projects\\next.blue',
      revision: 0,
      sessionId: 2,
    });
    expect(replaced.documentId).not.toBe(docId1);

    const closed = session.close();
    expect(closed).toMatchObject({
      data: null,
      filePath: null,
      revision: 0,
      sessionId: 3,
      documentId: null,
      stateId: null,
    });

    session.resetForShutdown();
    expect(session.read()).toEqual(closed);
  });

  it('advances the session fence without resetting the accepted revision when requested', () => {
    const session = new ProjectSession();
    session.replace(data, '\\\\server\\share\\project.blue');
    const receipt = session.recordMutation({ changed: true, invalidateSession: true });

    expect(receipt).toMatchObject({ changed: true, revision: 1, sessionId: 2 });
    expect(session.read().revision).toBe(1);
    expect(session.read().filePath).toBe('\\\\server\\share\\project.blue');
    expect(session.read().documentId).toBe(receipt.documentId);
  });

  it('fails closed for invalid operations and keeps resetForShutdown idempotent', () => {
    const session = new ProjectSession();
    expect(() => session.publishPath('/tmp/no-project.blue')).toThrow('without an active project');
    expect(() => session.recordMutation({ changed: true })).toThrow('without an active project');
    expect(() => session.publishCommittedDocument(candidateData)).toThrow(
      'without an active project',
    );

    session.replace(data, '/tmp/project.blue');
    session.recordMutation({ changed: true });
    session.resetForShutdown();
    const first = session.read();
    session.resetForShutdown();
    expect(session.read()).toEqual(first);
  });

  describe('document lifetime identity and history state identity', () => {
    it('maintains distinct documentId across different project loads and preserves across mutations', () => {
      const session = new ProjectSession();
      const snap1 = session.replace(data, '/path/one.blue');
      const docId1 = snap1.documentId;
      expect(docId1).toMatch(/^doc-/);

      // Path update preserves documentId
      session.publishPath('/path/one-renamed.blue');
      expect(session.read().documentId).toBe(docId1);

      // Mutation preserves documentId
      session.recordMutation({ changed: true });
      expect(session.read().documentId).toBe(docId1);

      // Loading a new project assigns a new documentId
      const snap2 = session.replace(candidateData, '/path/two.blue');
      expect(snap2.documentId).toMatch(/^doc-/);
      expect(snap2.documentId).not.toBe(docId1);
    });

    it('supports explicit stateId and generates unique stateId when omitted', () => {
      const session = new ProjectSession();
      session.replace(data, '/path/project.blue');

      const explicitState = 'state-custom-1234';
      const receipt = session.recordMutation({ changed: true, stateId: explicitState });
      expect(receipt.stateId).toBe(explicitState);
      expect(session.read().stateId).toBe(explicitState);

      const nextReceipt = session.recordMutation({ changed: true });
      expect(nextReceipt.stateId).toMatch(/^state-/);
      expect(nextReceipt.stateId).not.toBe(explicitState);
    });
  });

  describe('canonical committed-document publication and path preservation', () => {
    it('publishes committed document preserving filePath, documentId, and monotonically advancing revision', () => {
      const session = new ProjectSession();
      session.replace(data, '/original/path.blue');
      const docId = session.read().documentId;
      expect(session.read().revision).toBe(0);

      // Record a mutation
      session.recordMutation({ changed: true });
      expect(session.read().revision).toBe(1);

      // Publish committed candidate document
      const publishedSnap = session.publishCommittedDocument(candidateData, {
        stateId: 'state-committed-structural-edit',
      });

      expect(publishedSnap.data).toBe(candidateData);
      expect(publishedSnap.filePath).toBe('/original/path.blue');
      expect(publishedSnap.documentId).toBe(docId);
      expect(publishedSnap.revision).toBe(2);
      expect(publishedSnap.stateId).toBe('state-committed-structural-edit');
      expect(publishedSnap.sessionId).toBe(1);

      // Further mutation increments revision again
      const rec = session.recordMutation({ changed: true });
      expect(rec.revision).toBe(3);
      expect(session.read().revision).toBe(3);
    });

    it('advances sessionId during publishCommittedDocument when invalidateSession is true', () => {
      const session = new ProjectSession();
      session.replace(data, '/path.blue');
      expect(session.read().sessionId).toBe(1);

      const published = session.publishCommittedDocument(candidateData, {
        invalidateSession: true,
      });
      expect(published.sessionId).toBe(2);
      expect(published.revision).toBe(1);
    });

    it('supports replace with preserveFilePath and preserveDocumentId options', () => {
      const session = new ProjectSession();
      session.replace(data, '/keep/this/path.blue');
      const origDocId = session.read().documentId;

      // Replace candidate preserving file path and document ID
      const preservedSnap = session.replace(candidateData, null, {
        preserveFilePath: true,
        preserveDocumentId: true,
        initialRevision: 5,
      });

      expect(preservedSnap.data).toBe(candidateData);
      expect(preservedSnap.filePath).toBe('/keep/this/path.blue');
      expect(preservedSnap.documentId).toBe(origDocId);
      expect(preservedSnap.revision).toBe(5);
      expect(preservedSnap.sessionId).toBe(2);
    });
  });
});
