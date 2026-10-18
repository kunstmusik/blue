import { describe, expect, it } from 'vitest';
import { UnifiedLibraryRepositoryClient } from './repository-client';
import { UnifiedLibraryService } from './service';
import type { LibraryItemKey } from '../../shared/unified-library';
import {
  createHistoricalInstrumentXml,
  createHistoricalEffectXml,
  createHistoricalSoundObjectXml,
  createPythonInstrumentXml,
  createClojureSoundObjectXml,
  createWhitespacePreservingInstrumentXml,
  SIGNIFICANT_INSTRUMENT_CODE,
} from '../blueshare/test-helpers';

describe('BlueShare Publish Source Capture (T031)', () => {
  it('captures coherent snapshot with expected revision and extracts metadata', async () => {
    const service = new UnifiedLibraryService(
      ':memory:',
      UnifiedLibraryRepositoryClient.openForTesting,
    );
    await service.start();

    // Import a sample instrument
    const importRes = await service.importStandaloneResource(
      'instrument',
      `<instrument type="blue.orchestra.GenericInstrument">
        <name>Lead Synth</name>
        <comment>Original instrument comment</comment>
        <globalOrc>gk1 init 0</globalOrc>
        <globalSco></globalSco>
        <instrumentText>a1 oscil 1000, 440, 1</instrumentText>
        <opcodeList/>
      </instrument>`,
      101,
      'Remote Lead Synth',
    );

    expect(importRes.ok).toBe(true);
    if (!importRes.ok) throw new Error('Import failed');

    const importedNode = importRes.value.affectedNodes[0];
    const key = importedNode.key as LibraryItemKey;
    const revision = importedNode.revision as number;

    const captureRes = await service.capturePublishSource({
      key,
      expectedRevision: revision,
    });

    expect(captureRes.ok).toBe(true);
    if (!captureRes.ok) throw new Error('Capture failed');

    expect(captureRes.value.key).toEqual(key);
    expect(captureRes.value.revision).toBe(revision);
    expect(captureRes.value.displayName).toBe('Lead Synth');
    expect(captureRes.value.blueType).toBe('blue.orchestra.GenericInstrument');
    expect(captureRes.value.description).toBe('Original instrument comment');
    expect(captureRes.value.xml).toContain('<instrument type="blue.orchestra.GenericInstrument">');

    await service.stop();
  });

  it('correctly handles effect (null blueType, comments) and soundObject (blueType, comment)', async () => {
    const service = new UnifiedLibraryService(
      ':memory:',
      UnifiedLibraryRepositoryClient.openForTesting,
    );
    await service.start();

    // 1. Effect
    const effectRes = await service.importStandaloneResource(
      'effect',
      `<effect>
        <name>Reverb Effect</name>
        <comments>Spacious hall reverb</comments>
        <code>aout reverb ain, 1.5</code>
      </effect>`,
      102,
      'Remote Reverb',
    );
    expect(effectRes.ok).toBe(true);
    if (!effectRes.ok) throw new Error('Effect import failed');

    const effectNode = effectRes.value.affectedNodes[0];
    const effectCapture = await service.capturePublishSource({
      key: effectNode.key as LibraryItemKey,
      expectedRevision: effectNode.revision as number,
    });
    expect(effectCapture.ok).toBe(true);
    if (!effectCapture.ok) throw new Error('Effect capture failed');
    expect(effectCapture.value.blueType).toBeNull();
    expect(effectCapture.value.description).toBe('Spacious hall reverb');

    // 2. SoundObject
    const soundRes = await service.importStandaloneResource(
      'soundObject',
      `<soundObject type="blue.soundObject.Sound">
        <startTime type="BEATS"><csoundBeats>0.0</csoundBeats></startTime>
        <subjectiveDuration type="BEATS"><csoundBeats>4.0</csoundBeats></subjectiveDuration>
        <name>Poly Sound</name>
        <instrumentText>instr 1\n  out(0)\nendin</instrumentText>
        <comment>Complex polyphony</comment>
      </soundObject>`,
      103,
      'Remote Poly',
    );
    expect(soundRes.ok).toBe(true);
    if (!soundRes.ok) throw new Error('SoundObject import failed');

    const soundNode = soundRes.value.affectedNodes[0];
    const soundCapture = await service.capturePublishSource({
      key: soundNode.key as LibraryItemKey,
      expectedRevision: soundNode.revision as number,
    });
    expect(soundCapture.ok).toBe(true);
    if (!soundCapture.ok) throw new Error('Sound capture failed');
    expect(soundCapture.value.blueType).toBe('blue.soundObject.Sound');
    expect(soundCapture.value.description).toBe('Complex polyphony');

    await service.stop();
  });

  it('rejects non-user keys and UDO library items', async () => {
    const service = new UnifiedLibraryService(
      ':memory:',
      UnifiedLibraryRepositoryClient.openForTesting,
    );
    await service.start();

    // Project key
    const projectRes = await service.capturePublishSource({
      key: {
        scope: 'projectOwned',
        libraryType: 'instrument',
        projectSessionId: 1,
        locator: { kind: 'instrument', assignmentId: 'inst-1' },
      },
      expectedRevision: 1,
    });
    expect(projectRes.ok).toBe(false);
    if (projectRes.ok) throw new Error('Expected project key to be rejected');
    expect(projectRes.error.message).toMatch(/user/i);

    // UDO item
    const udoRes = await service.capturePublishSource({
      key: {
        scope: 'user',
        libraryType: 'udo',
        nodeId: 'any-udo-id',
      },
      expectedRevision: 1,
    });
    expect(udoRes.ok).toBe(false);
    if (udoRes.ok) throw new Error('Expected UDO to be rejected');
    expect(udoRes.error.message).toMatch(/udo/i);

    await service.stop();
  });

  it('rejects stale revisions and deleted items (concurrency protection)', async () => {
    const service = new UnifiedLibraryService(
      ':memory:',
      UnifiedLibraryRepositoryClient.openForTesting,
    );
    await service.start();

    const importRes = await service.importStandaloneResource(
      'instrument',
      `<instrument type="blue.orchestra.GenericInstrument">
        <name>Original</name>
        <comment></comment>
        <instrumentText></instrumentText>
      </instrument>`,
      104,
      'Orig',
    );
    expect(importRes.ok).toBe(true);
    if (!importRes.ok) throw new Error('Import failed');

    const importedNode = importRes.value.affectedNodes[0];
    const key = importedNode.key as LibraryItemKey;
    const revision = importedNode.revision as number;

    // Stale revision: requesting revision + 1
    const staleRes = await service.capturePublishSource({
      key,
      expectedRevision: revision + 1,
    });
    expect(staleRes.ok).toBe(false);
    if (staleRes.ok) throw new Error('Expected stale revision to be rejected');
    expect(staleRes.error.message).toMatch(/stale|revision/i);

    // Now delete the item
    if (key.scope === 'user') {
      await (service as any).client?.deleteNode(key.nodeId, revision);
    }

    // Attempting to capture deleted item
    const deletedRes = await service.capturePublishSource({
      key,
      expectedRevision: revision,
    });
    expect(deletedRes.ok).toBe(false);

    await service.stop();
  });

  it('does not mutate library, clipboard, or project state and returns detached data', async () => {
    const service = new UnifiedLibraryService(
      ':memory:',
      UnifiedLibraryRepositoryClient.openForTesting,
    );
    await service.start();

    const importRes = await service.importStandaloneResource(
      'instrument',
      `<instrument type="blue.orchestra.GenericInstrument">
        <name>Test</name>
        <comment>Clean test</comment>
        <instrumentText></instrumentText>
      </instrument>`,
      105,
      'Test',
    );
    expect(importRes.ok).toBe(true);
    if (!importRes.ok) throw new Error('Import failed');

    const importedNode = importRes.value.affectedNodes[0];
    const key = importedNode.key as LibraryItemKey;
    const revision = importedNode.revision as number;

    const initialSnapshot = service.getSnapshot();

    const captureRes = await service.capturePublishSource({
      key,
      expectedRevision: revision,
    });
    expect(captureRes.ok).toBe(true);
    if (!captureRes.ok) throw new Error('Capture failed');

    // Content revision and snapshot state must be strictly identical
    const finalSnapshot = service.getSnapshot();
    expect(finalSnapshot.contentRevision).toBe(initialSnapshot.contentRevision);
    expect(finalSnapshot.clipboard).toBe(initialSnapshot.clipboard);
    expect(finalSnapshot.bsbClipboard).toBe(initialSnapshot.bsbClipboard);

    await service.stop();
  });

  it('captures publish sources for documented historical and runtime-backed resources without code execution', async () => {
    const service = new UnifiedLibraryService(
      ':memory:',
      UnifiedLibraryRepositoryClient.openForTesting,
    );
    await service.start();

    // 1. Historical BSB
    const bsbXml = createHistoricalInstrumentXml('Historical BSB Organ');
    const imp1 = await service.importStandaloneResource(
      'instrument',
      bsbXml,
      601,
      'Historical BSB Organ',
    );
    expect(imp1.ok).toBe(true);
    if (!imp1.ok) throw new Error('Import failed');
    const cap1 = await service.capturePublishSource({
      key: imp1.value.affectedNodes[0].key as LibraryItemKey,
      expectedRevision: imp1.value.affectedNodes[0].revision as number,
    });
    expect(cap1.ok).toBe(true);
    if (!cap1.ok) throw new Error('Capture failed');
    expect(cap1.value.blueType).toBe('blue.orchestra.BlueSynthBuilder');
    expect(cap1.value.displayName).toBe('Historical BSB Organ');
    expect(cap1.value.xml).toBe(bsbXml);

    // 2. Historical PianoRoll
    const pianoXml = createHistoricalSoundObjectXml('Historical Score');
    const imp2 = await service.importStandaloneResource(
      'soundObject',
      pianoXml,
      602,
      'Historical Score',
    );
    expect(imp2.ok).toBe(true);
    if (!imp2.ok) throw new Error('Import failed');
    const cap2 = await service.capturePublishSource({
      key: imp2.value.affectedNodes[0].key as LibraryItemKey,
      expectedRevision: imp2.value.affectedNodes[0].revision as number,
    });
    expect(cap2.ok).toBe(true);
    if (!cap2.ok) throw new Error('Capture failed');
    expect(cap2.value.blueType).toBe('blue.soundObject.PianoRoll');
    expect(cap2.value.xml).toBe(pianoXml);

    // 3. Historical Effect
    const effectXml = createHistoricalEffectXml('Historical Effect');
    const imp3 = await service.importStandaloneResource(
      'effect',
      effectXml,
      603,
      'Historical Effect',
    );
    expect(imp3.ok).toBe(true);
    if (!imp3.ok) throw new Error('Import failed');
    const cap3 = await service.capturePublishSource({
      key: imp3.value.affectedNodes[0].key as LibraryItemKey,
      expectedRevision: imp3.value.affectedNodes[0].revision as number,
    });
    expect(cap3.ok).toBe(true);
    if (!cap3.ok) throw new Error('Capture failed');
    expect(cap3.value.blueType).toBeNull();
    expect(cap3.value.xml).toBe(effectXml);

    // 4. Runtime-backed PythonInstrument (must not execute code)
    const pyXml = createPythonInstrumentXml('Py Synth');
    const imp4 = await service.importStandaloneResource('instrument', pyXml, 604, 'Py Synth');
    expect(imp4.ok).toBe(true);
    if (!imp4.ok) throw new Error('Import failed');
    const cap4 = await service.capturePublishSource({
      key: imp4.value.affectedNodes[0].key as LibraryItemKey,
      expectedRevision: imp4.value.affectedNodes[0].revision as number,
    });
    expect(cap4.ok).toBe(true);
    if (!cap4.ok) throw new Error('Capture failed');
    expect(cap4.value.blueType).toBe('blue.orchestra.PythonInstrument');
    expect(cap4.value.xml).toBe(pyXml);

    // 5. Runtime-backed ClojureObject (must not execute code)
    const cljXml = createClojureSoundObjectXml('Clj Score');
    const imp5 = await service.importStandaloneResource('soundObject', cljXml, 605, 'Clj Score');
    expect(imp5.ok).toBe(true);
    if (!imp5.ok) throw new Error('Import failed');
    const cap5 = await service.capturePublishSource({
      key: imp5.value.affectedNodes[0].key as LibraryItemKey,
      expectedRevision: imp5.value.affectedNodes[0].revision as number,
    });
    expect(cap5.ok).toBe(true);
    if (!cap5.ok) throw new Error('Capture failed');
    expect(cap5.value.blueType).toBe('blue.clojure.soundObject.ClojureObject');
    expect(cap5.value.xml).toBe(cljXml);

    await service.stop();
  });

  it('strictly preserves significant whitespace in captured publish source XML (FR-005)', async () => {
    const service = new UnifiedLibraryService(
      ':memory:',
      UnifiedLibraryRepositoryClient.openForTesting,
    );
    await service.start();

    const instrXml = createWhitespacePreservingInstrumentXml('Whitespace Synth');
    const imp = await service.importStandaloneResource(
      'instrument',
      instrXml,
      701,
      'Whitespace Synth',
    );
    expect(imp.ok).toBe(true);
    if (!imp.ok) throw new Error('Import failed');

    const cap = await service.capturePublishSource({
      key: imp.value.affectedNodes[0].key as LibraryItemKey,
      expectedRevision: imp.value.affectedNodes[0].revision as number,
    });
    expect(cap.ok).toBe(true);
    if (!cap.ok) throw new Error('Capture failed');

    // Verify byte-for-byte preservation including exact leading/trailing spaces and tabs
    expect(cap.value.xml).toBe(instrXml);
    expect(cap.value.xml).toContain(SIGNIFICANT_INSTRUMENT_CODE);

    await service.stop();
  });
});
