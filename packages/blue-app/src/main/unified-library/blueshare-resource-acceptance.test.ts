import { describe, expect, it } from 'vitest';
import { UnifiedLibraryService } from './service';
import { UnifiedLibraryRepositoryClient } from './repository-client';
import { createUnifiedLibraryTestDirectory } from './test-helpers';
import {
  createSyntheticInstrumentXml,
  createSyntheticEffectXml,
  createSyntheticSoundObjectXml,
  createHistoricalInstrumentXml,
  createHistoricalConflictingInstrumentXml,
  createHistoricalMeaningfulHelperInstrumentXml,
  createHistoricalEffectXml,
  createHistoricalConflictingEffectXml,
  createHistoricalSoundObjectXml,
  createPythonInstrumentXml,
  createClojureSoundObjectXml,
  createWhitespacePreservingInstrumentXml,
  createWhitespacePreservingEffectXml,
  createWhitespacePreservingSoundObjectXml,
  SIGNIFICANT_INSTRUMENT_CODE,
  SIGNIFICANT_EFFECT_CODE,
  SIGNIFICANT_SCORE_TEXT,
  createInvalidXml,
  createUnsupportedTypeXml,
} from '../blueshare/test-helpers';
import {
  readResourceXml,
  GenericInstrument,
  BlueSynthBuilder,
  PianoRoll,
  Effect,
  GenericScore,
  PythonInstrument,
  ClojureObject,
} from '@blue/data';

describe('BlueShare Resource Standalone Acceptance (T013, T071)', () => {
  it('accepts and imports current supported resources for all three kinds', async () => {
    const dir = createUnifiedLibraryTestDirectory('bs-accept-current-');
    try {
      const service = new UnifiedLibraryService(
        dir.databasePath,
        UnifiedLibraryRepositoryClient.openForTesting,
      );
      await service.start();

      // 1. Instrument (GenericInstrument)
      const instrXml = createSyntheticInstrumentXml('Classic Lead');
      const res1 = await service.importStandaloneResource(
        'instrument',
        instrXml,
        101,
        'Classic Lead',
      );
      expect(res1.ok).toBe(true);
      if (!res1.ok) throw new Error('Expected instrument import to succeed');
      expect(res1.value.affectedNodes[0].displayName).toBe('Classic Lead');
      expect(res1.value.affectedNodes[0].supportStatus).toBe('supported');

      // 2. Effect
      const effectXml = createSyntheticEffectXml('Stereo Delay');
      const res2 = await service.importStandaloneResource('effect', effectXml, 102, 'Stereo Delay');
      expect(res2.ok).toBe(true);
      if (!res2.ok) throw new Error('Expected effect import to succeed');
      expect(res2.value.affectedNodes[0].displayName).toBe('Stereo Delay');

      // 3. SoundObject (GenericScore)
      const scoreXml = createSyntheticSoundObjectXml('Cadence');
      const res3 = await service.importStandaloneResource('soundObject', scoreXml, 103, 'Cadence');
      expect(res3.ok).toBe(true);
      if (!res3.ok) throw new Error('Expected soundObject import to succeed');
      expect(res3.value.affectedNodes[0].displayName).toBe('Cadence');

      await service.stop();
    } finally {
      dir.cleanup();
    }
  });

  it('accepts documented class-local historical resources across all three kinds and preserves defaults/conversions', async () => {
    const dir = createUnifiedLibraryTestDirectory('bs-accept-historical-');
    try {
      const service = new UnifiedLibraryService(
        dir.databasePath,
        UnifiedLibraryRepositoryClient.openForTesting,
      );
      await service.start();

      // 1. Historical Instrument: BlueSynthBuilder with retired helper uniqueNameManager & bsbParameterList
      const historicalInstrXml = createHistoricalInstrumentXml('Historical BSB Organ');
      const res1 = await service.importStandaloneResource(
        'instrument',
        historicalInstrXml,
        201,
        'Historical BSB Organ',
      );
      expect(res1.ok).toBe(true);
      if (!res1.ok) throw new Error('Expected historical BSB import to succeed');

      const client = UnifiedLibraryRepositoryClient.openForTesting(dir.databasePath);
      const payload1 = await client.getItemPayload(res1.value.affectedNodes[0].nodeId);
      expect(payload1.payloadXml).toBe(historicalInstrXml);

      // Verify that reloading the stored payload via readResourceXml omits the retired helper on save
      const reload1 = readResourceXml('instrument', payload1.payloadXml, {
        kind: 'instrument',
        label: 'reloaded-bsb.xml',
      });
      expect(reload1.ok).toBe(true);
      if (!reload1.ok) throw new Error('Failed to reload historical BSB');
      expect(reload1.value).toBeInstanceOf(BlueSynthBuilder);
      const savedXml1 = (reload1.value as BlueSynthBuilder).saveAsXML().toXml();
      expect(savedXml1).not.toContain('<uniqueNameManager');
      expect(savedXml1).toContain('Historical BSB Organ');

      // 2. Historical Effect: Effect with historical bsbParameterList alias
      const historicalEffectXml = createHistoricalEffectXml('Historical Chorus');
      const res2 = await service.importStandaloneResource(
        'effect',
        historicalEffectXml,
        202,
        'Historical Chorus',
      );
      expect(res2.ok).toBe(true);
      if (!res2.ok) throw new Error('Expected historical effect import to succeed');

      const payload2 = await client.getItemPayload(res2.value.affectedNodes[0].nodeId);
      expect(payload2.payloadXml).toBe(historicalEffectXml);
      const reload2 = readResourceXml('effect', payload2.payloadXml, {
        kind: 'effect',
        label: 'reloaded-effect.xml',
      });
      expect(reload2.ok).toBe(true);
      if (!reload2.ok) throw new Error('Failed to reload historical effect');
      expect(reload2.value).toBeInstanceOf(Effect);

      // 3. Historical SoundObject: PianoRoll with historical ruler metadata <timeUnit>6</timeUnit>
      const historicalScoreXml = createHistoricalSoundObjectXml('Historical PianoRoll Object');
      const res3 = await service.importStandaloneResource(
        'soundObject',
        historicalScoreXml,
        203,
        'Historical PianoRoll Object',
      );
      expect(res3.ok).toBe(true);
      if (!res3.ok) throw new Error('Expected historical PianoRoll import to succeed');

      const payload3 = await client.getItemPayload(res3.value.affectedNodes[0].nodeId);
      expect(payload3.payloadXml).toBe(historicalScoreXml);
      const reload3 = readResourceXml('soundObject', payload3.payloadXml, {
        kind: 'soundObject',
        label: 'reloaded-piano-roll.xml',
      });
      expect(reload3.ok).toBe(true);
      if (!reload3.ok) throw new Error('Failed to reload historical PianoRoll');
      expect(reload3.value).toBeInstanceOf(PianoRoll);
      // Historical timeUnit is retained on save
      const savedXml3 = (reload3.value as PianoRoll).saveAsXML().toXml();
      expect(savedXml3).toContain('<timeUnit>6</timeUnit>');

      await client.close();
      await service.stop();
    } finally {
      dir.cleanup();
    }
  });

  it('rejects documented class-local historical conflicts without mutating library state', async () => {
    const dir = createUnifiedLibraryTestDirectory('bs-accept-conflicts-');
    try {
      const service = new UnifiedLibraryService(
        dir.databasePath,
        UnifiedLibraryRepositoryClient.openForTesting,
      );
      await service.start();

      // 1. Instrument conflict: simultaneous parameterList and bsbParameterList
      const conflictingInstrXml = createHistoricalConflictingInstrumentXml('Conflicting BSB');
      const res1 = await service.importStandaloneResource(
        'instrument',
        conflictingInstrXml,
        211,
        'Conflicting BSB',
      );
      expect(res1.ok).toBe(false);
      if (res1.ok) throw new Error('Expected conflicting BSB to fail');
      expect(res1.error.code).toBe('validation-failed');
      expect(res1.error.diagnostics?.some((d) => d.code === 'conflict')).toBe(true);

      // 2. Instrument conflict: retired uniqueNameManager with non-empty text content
      const meaningfulHelperXml =
        createHistoricalMeaningfulHelperInstrumentXml('Helper Content BSB');
      const res2 = await service.importStandaloneResource(
        'instrument',
        meaningfulHelperXml,
        212,
        'Helper Content BSB',
      );
      expect(res2.ok).toBe(false);
      if (res2.ok) throw new Error('Expected meaningful helper BSB to fail');
      expect(res2.error.code).toBe('validation-failed');
      expect(res2.error.diagnostics?.some((d) => d.code === 'value')).toBe(true);

      // 3. Effect conflict: simultaneous parameterList and bsbParameterList
      const conflictingEffectXml = createHistoricalConflictingEffectXml('Conflicting Effect');
      const res3 = await service.importStandaloneResource(
        'effect',
        conflictingEffectXml,
        213,
        'Conflicting Effect',
      );
      expect(res3.ok).toBe(false);
      if (res3.ok) throw new Error('Expected conflicting effect to fail');
      expect(res3.error.code).toBe('validation-failed');
      expect(res3.error.diagnostics?.some((d) => d.code === 'conflict')).toBe(true);

      // Verify no items or folders were created for any rejected conflicts
      const client = UnifiedLibraryRepositoryClient.openForTesting(dir.databasePath);
      const instrRoot = await client.getRoot('instrument');
      const effectRoot = await client.getRoot('effect');
      expect((await client.listChildren(instrRoot.id)).length).toBe(0);
      expect((await client.listChildren(effectRoot.id)).length).toBe(0);
      await client.close();

      await service.stop();
    } finally {
      dir.cleanup();
    }
  });

  it('accepts supported runtime-backed resources without installed runtimes or code/asset execution (FR-015)', async () => {
    const dir = createUnifiedLibraryTestDirectory('bs-accept-runtime-backed-');
    try {
      const service = new UnifiedLibraryService(
        dir.databasePath,
        UnifiedLibraryRepositoryClient.openForTesting,
      );
      await service.start();

      // 1. PythonInstrument: contains python code that throws if executed
      const pythonXml = createPythonInstrumentXml('Guarded Python Synth');
      const res1 = await service.importStandaloneResource(
        'instrument',
        pythonXml,
        301,
        'Guarded Python Synth',
      );
      expect(res1.ok).toBe(true);
      if (!res1.ok) throw new Error('Expected PythonInstrument import to succeed');
      expect(res1.value.affectedNodes[0].displayName).toBe('Guarded Python Synth');
      expect(res1.value.affectedNodes[0].supportStatus).toBe('supported');

      const client = UnifiedLibraryRepositoryClient.openForTesting(dir.databasePath);
      const payload1 = await client.getItemPayload(res1.value.affectedNodes[0].nodeId);
      expect(payload1.payloadXml).toBe(pythonXml);
      expect(payload1.payloadXml).toContain('raise RuntimeError("Executed!")');

      // Reloading must parse into PythonInstrument model without code execution
      const reload1 = readResourceXml('instrument', payload1.payloadXml, {
        kind: 'instrument',
        label: 'reloaded-python.xml',
      });
      expect(reload1.ok).toBe(true);
      if (!reload1.ok) throw new Error('Failed to reload PythonInstrument');
      expect(reload1.value).toBeInstanceOf(PythonInstrument);
      expect((reload1.value as PythonInstrument).getText()).toContain(
        'raise RuntimeError("Executed!")',
      );

      // 2. ClojureObject: contains clojure code that throws if executed
      const clojureXml = createClojureSoundObjectXml('Guarded Clojure Score');
      const res2 = await service.importStandaloneResource(
        'soundObject',
        clojureXml,
        302,
        'Guarded Clojure Score',
      );
      expect(res2.ok).toBe(true);
      if (!res2.ok) throw new Error('Expected ClojureObject import to succeed');
      expect(res2.value.affectedNodes[0].displayName).toBe('Guarded Clojure Score');
      expect(res2.value.affectedNodes[0].supportStatus).toBe('supported');

      const payload2 = await client.getItemPayload(res2.value.affectedNodes[0].nodeId);
      expect(payload2.payloadXml).toBe(clojureXml);
      expect(payload2.payloadXml).toContain('(throw (Exception. "Executed!"))');

      // Reloading must parse into ClojureObject model without code execution
      const reload2 = readResourceXml('soundObject', payload2.payloadXml, {
        kind: 'soundObject',
        label: 'reloaded-clojure.xml',
      });
      expect(reload2.ok).toBe(true);
      if (!reload2.ok) throw new Error('Failed to reload ClojureObject');
      expect(reload2.value).toBeInstanceOf(ClojureObject);
      expect((reload2.value as ClojureObject).getClojureCode()).toContain(
        '(throw (Exception. "Executed!"))',
      );

      await client.close();
      await service.stop();
    } finally {
      dir.cleanup();
    }
  });

  it('preserves significant whitespace and maintains stable normalize/copy/save/reload relationships (FR-005)', async () => {
    const dir = createUnifiedLibraryTestDirectory('bs-accept-whitespace-');
    try {
      const service = new UnifiedLibraryService(
        dir.databasePath,
        UnifiedLibraryRepositoryClient.openForTesting,
      );
      await service.start();

      // 1. Instrument with exact indentation and tabs
      const instrXml = createWhitespacePreservingInstrumentXml('Whitespace Lead');
      const res1 = await service.importStandaloneResource(
        'instrument',
        instrXml,
        401,
        'Whitespace Lead',
      );
      expect(res1.ok).toBe(true);
      if (!res1.ok) throw new Error('Import failed');

      // 2. Effect with exact code whitespace
      const effectXml = createWhitespacePreservingEffectXml('Whitespace Delay');
      const res2 = await service.importStandaloneResource(
        'effect',
        effectXml,
        402,
        'Whitespace Delay',
      );
      expect(res2.ok).toBe(true);
      if (!res2.ok) throw new Error('Import failed');

      // 3. SoundObject with exact multiline score text
      const scoreXml = createWhitespacePreservingSoundObjectXml('Whitespace Cadence');
      const res3 = await service.importStandaloneResource(
        'soundObject',
        scoreXml,
        403,
        'Whitespace Cadence',
      );
      expect(res3.ok).toBe(true);
      if (!res3.ok) throw new Error('Import failed');

      const client = UnifiedLibraryRepositoryClient.openForTesting(dir.databasePath);

      // Verify instrument whitespace preservation
      const p1 = await client.getItemPayload(res1.value.affectedNodes[0].nodeId);
      expect(p1.payloadXml).toBe(instrXml);
      const r1 = readResourceXml('instrument', p1.payloadXml, {
        kind: 'instrument',
        label: 'test',
      });
      expect(r1.ok).toBe(true);
      if (!r1.ok) throw new Error('Reload failed');
      const instrModel = r1.value as GenericInstrument;
      expect(instrModel.getText()).toBe(SIGNIFICANT_INSTRUMENT_CODE);
      expect(instrModel.deepCopy().getText()).toBe(SIGNIFICANT_INSTRUMENT_CODE);
      const resavedInstr = instrModel.saveAsXML().toXml();
      const roundtripInstr = readResourceXml('instrument', resavedInstr, {
        kind: 'instrument',
        label: 'test2',
      });
      expect(roundtripInstr.ok).toBe(true);
      if (!roundtripInstr.ok) throw new Error('Roundtrip failed');
      expect((roundtripInstr.value as GenericInstrument).getText()).toBe(
        SIGNIFICANT_INSTRUMENT_CODE,
      );

      // Verify effect whitespace preservation
      const p2 = await client.getItemPayload(res2.value.affectedNodes[0].nodeId);
      expect(p2.payloadXml).toBe(effectXml);
      const r2 = readResourceXml('effect', p2.payloadXml, { kind: 'effect', label: 'test' });
      expect(r2.ok).toBe(true);
      if (!r2.ok) throw new Error('Reload failed');
      const effectModel = r2.value as Effect;
      expect(effectModel.getCode()).toBe(SIGNIFICANT_EFFECT_CODE);
      expect((effectModel.deepCopy() as Effect).getCode()).toBe(SIGNIFICANT_EFFECT_CODE);

      // Verify score whitespace preservation
      const p3 = await client.getItemPayload(res3.value.affectedNodes[0].nodeId);
      expect(p3.payloadXml).toBe(scoreXml);
      const r3 = readResourceXml('soundObject', p3.payloadXml, {
        kind: 'soundObject',
        label: 'test',
      });
      expect(r3.ok).toBe(true);
      if (!r3.ok) throw new Error('Reload failed');
      const scoreModel = r3.value as GenericScore;
      expect(scoreModel.getScoreText()).toBe(SIGNIFICANT_SCORE_TEXT);
      expect((scoreModel.deepCopy() as GenericScore).getScoreText()).toBe(SIGNIFICANT_SCORE_TEXT);

      await client.close();
      await service.stop();
    } finally {
      dir.cleanup();
    }
  });

  it('rejects invalid or malformed XML and names diagnostic properties', async () => {
    const dir = createUnifiedLibraryTestDirectory('bs-accept-malformed-');
    try {
      const service = new UnifiedLibraryService(
        dir.databasePath,
        UnifiedLibraryRepositoryClient.openForTesting,
      );
      await service.start();

      const malformedXml = createInvalidXml();
      const res = await service.importStandaloneResource('instrument', malformedXml, 501, 'Broken');
      expect(res.ok).toBe(false);
      if (res.ok) throw new Error('Expected malformed import to fail');
      expect(res.error.code).toBe('validation-failed');
      expect(res.error.diagnostics).toBeDefined();
      expect(res.error.diagnostics!.length).toBeGreaterThan(0);

      await service.stop();
    } finally {
      dir.cleanup();
    }
  });

  it('rejects root mismatch without creating any library nodes', async () => {
    const dir = createUnifiedLibraryTestDirectory('bs-accept-mismatch-');
    try {
      const service = new UnifiedLibraryService(
        dir.databasePath,
        UnifiedLibraryRepositoryClient.openForTesting,
      );
      await service.start();

      // Pass effect XML to an instrument import
      const effectXml = createSyntheticEffectXml('Misplaced Delay');
      const res = await service.importStandaloneResource(
        'instrument',
        effectXml,
        601,
        'Misplaced Delay',
      );
      expect(res.ok).toBe(false);
      if (res.ok) throw new Error('Expected root mismatch to fail');
      expect(res.error.code).toBe('validation-failed');

      // Ensure no items or folders were created
      const client = UnifiedLibraryRepositoryClient.openForTesting(dir.databasePath);
      const root = await client.getRoot('instrument');
      const children = await client.listChildren(root.id);
      expect(children.length).toBe(0);
      await client.close();

      await service.stop();
    } finally {
      dir.cleanup();
    }
  });

  it('rejects unsupported types and archive fallback', async () => {
    const dir = createUnifiedLibraryTestDirectory('bs-accept-unsupported-');
    try {
      const service = new UnifiedLibraryService(
        dir.databasePath,
        UnifiedLibraryRepositoryClient.openForTesting,
      );
      await service.start();

      const unsupportedXml = createUnsupportedTypeXml();
      const res = await service.importStandaloneResource(
        'instrument',
        unsupportedXml,
        701,
        'Unsupported',
      );
      expect(res.ok).toBe(false);
      if (res.ok) throw new Error('Expected unsupported type to fail');
      expect(res.error.code).toBe('validation-failed');

      await service.stop();
    } finally {
      dir.cleanup();
    }
  });

  it('rejects nested unknown members with structured diagnostics', async () => {
    const dir = createUnifiedLibraryTestDirectory('bs-accept-nested-unknown-');
    try {
      const service = new UnifiedLibraryService(
        dir.databasePath,
        UnifiedLibraryRepositoryClient.openForTesting,
      );
      await service.start();

      const unknownMemberXml =
        '<instrument type="blue.orchestra.GenericInstrument"><name>Test</name><futureMember>value</futureMember></instrument>';
      const res = await service.importStandaloneResource(
        'instrument',
        unknownMemberXml,
        801,
        'Future',
      );
      expect(res.ok).toBe(false);
      if (res.ok) throw new Error('Expected nested unknown member to fail');
      expect(res.error.code).toBe('validation-failed');

      await service.stop();
    } finally {
      dir.cleanup();
    }
  });

  it('allows reloading imported payload cleanly without aliases or meaningful loss', async () => {
    const dir = createUnifiedLibraryTestDirectory('bs-accept-reload-');
    try {
      const service = new UnifiedLibraryService(
        dir.databasePath,
        UnifiedLibraryRepositoryClient.openForTesting,
      );
      await service.start();

      const originalXml = createSyntheticInstrumentXml('Reloadable Organ');
      const res = await service.importStandaloneResource(
        'instrument',
        originalXml,
        901,
        'Reloadable Organ',
      );
      expect(res.ok).toBe(true);
      if (!res.ok) throw new Error('Import failed');

      const client = UnifiedLibraryRepositoryClient.openForTesting(dir.databasePath);
      const payload = await client.getItemPayload(res.value.affectedNodes[0].nodeId);

      // Verify the payload reloads via readResourceXml
      const reloadReport = readResourceXml('instrument', payload.payloadXml, {
        kind: 'instrument',
        label: 'reloaded.xml',
      });
      expect(reloadReport.ok).toBe(true);
      if (!reloadReport.ok) throw new Error('Failed to reload stored payload');
      expect((reloadReport.value as GenericInstrument).getName()).toBe('Reloadable Organ');

      await client.close();
      await service.stop();
    } finally {
      dir.cleanup();
    }
  });
});
