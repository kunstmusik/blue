import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  deriveRevisionFromBaselines,
  ExampleLibraryStateError,
  ExampleLibraryOperationJournal,
  FactoryBaselineRecord,
  parseOperationJournalText,
  parseUserLibraryStateText,
  serializeOperationJournal,
  serializeUserLibraryState,
  UserLibraryState,
  validateUserLibraryState,
  writeJsonAtomically,
} from './state-store';

function makeBaseline(
  relativePath: string,
  byteSeed: string,
  factoryPresent = true,
): FactoryBaselineRecord {
  return {
    relativePath,
    factorySha256: Buffer.from(byteSeed).toString('hex').padEnd(64, '0').slice(0, 64),
    factorySize: byteSeed.length,
    factoryPresent,
  };
}

function makeValidState(): UserLibraryState {
  const baselines = [makeBaseline('a/blue1.blue', 'alpha'), makeBaseline('b/x.wav', 'bravo')];
  return {
    schemaVersion: 1,
    acceptedFactoryRevision: deriveRevisionFromBaselines(baselines) as string,
    declinedFactoryRevision: null,
    baselines,
    lastCompletedAt: '2026-08-26T12:00:00.000Z',
  };
}

let tempDir = '';

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'blue-statestore-'));
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
  tempDir = '';
});

describe('user library state validation', () => {
  it('loads and round-trips a valid v1 document', () => {
    const state = makeValidState();
    const text = serializeUserLibraryState(state);
    const parsed = parseUserLibraryStateText(text);
    expect(parsed.kind).toBe('loaded');
    if (parsed.kind === 'loaded') {
      expect(parsed.value.acceptedFactoryRevision).toBe(state.acceptedFactoryRevision);
      expect(parsed.value.baselines).toHaveLength(2);
    }
  });

  it('rejects unknown future schema versions without defaulting', () => {
    const check = validateUserLibraryState({ ...makeValidState(), schemaVersion: 2 });
    expect('invalid' in check && check.invalid.join(' ')).toContain('Unsupported schemaVersion');
  });

  it.each([
    [
      'malformed accepted revision',
      (doc: Record<string, unknown>) => {
        doc.acceptedFactoryRevision = 'not-a-hash';
      },
    ],
    [
      'non-array baselines',
      (doc: Record<string, unknown>) => {
        doc.baselines = {};
      },
    ],
    ['unsorted baselines', () => undefined],
  ])('flags %s', (_label, mutate) => {
    const doc: Record<string, unknown> = JSON.parse(serializeUserLibraryState(makeValidState()));
    if (_label === 'unsorted baselines') {
      doc.baselines = [...(doc.baselines as FactoryBaselineRecord[])].reverse();
    } else {
      mutate(doc);
    }
    expect(validateUserLibraryState(doc)).toHaveProperty('invalid');
  });

  it('flags a mismatch between stored and derived accepted revisions', () => {
    const doc: Record<string, unknown> = JSON.parse(serializeUserLibraryState(makeValidState()));
    doc.baselines = [
      ...(doc.baselines as FactoryBaselineRecord[]),
      makeBaseline('c/new.blue', 'charlie'),
    ];
    // Document intentionally omits updating the accepted revision.
    const check = validateUserLibraryState(doc);
    expect('invalid' in check && check.invalid.join(' ')).toContain(
      'acceptedFactoryRevision does not match',
    );
  });

  it('treats unreadable or malformed state beside existing content as invalid, not absent', () => {
    expect(parseUserLibraryStateText('{ not json').kind).toBe('invalid');
    expect(parseUserLibraryStateText('').kind).toBe('absent');
    expect(parseUserLibraryStateText(null).kind).toBe('absent');
  });

  it('normalizes declined equal to accepted on serialization', () => {
    const state = makeValidState();
    state.declinedFactoryRevision = state.acceptedFactoryRevision;
    const roundTripped = parseUserLibraryStateText(serializeUserLibraryState(state));
    expect(roundTripped.kind).toBe('loaded');
    if (roundTripped.kind === 'loaded') {
      expect(roundTripped.value.declinedFactoryRevision).toBeNull();
    }
  });

  it('keeps distinct declined revisions and duplicate-path reporting intact', () => {
    const state = makeValidState();
    state.declinedFactoryRevision = 'sha256:' + 'd'.repeat(64);
    const parsed = parseUserLibraryStateText(serializeUserLibraryState(state));
    expect(parsed.kind === 'loaded' && parsed.value.declinedFactoryRevision).toBe(
      'sha256:' + 'd'.repeat(64),
    );

    const duplicated = makeValidState();
    duplicated.baselines.push(makeBaseline('a/blue1.blue', 'echo'));
    expect(validateUserLibraryState(duplicated)).toHaveProperty('invalid');
  });
});

describe('operation journal validation', () => {
  const journal: ExampleLibraryOperationJournal = {
    schemaVersion: 1,
    operationId: 'op-123456',
    kind: 'update',
    phase: 'backup-created',
    stagingDirectoryName: 'staging-op-123456',
    backupDirectoryName: 'backup-op-123456',
    sourceUserRevision: null,
    targetFactoryRevision: 'sha256:' + 'f'.repeat(64),
    startedAt: '2026-08-26T13:30:00.000Z',
  };

  it('round-trips a valid journal', () => {
    const parsed = parseOperationJournalText(serializeOperationJournal(journal));
    expect(parsed.kind).toBe('loaded');
    if (parsed.kind === 'loaded') {
      expect(parsed.value.phase).toBe('backup-created');
    }
  });

  it.each([
    ['wrong phase', { phase: 'finished' }],
    ['mismatched staging name', { stagingDirectoryName: 'staging-other-id' }],
    ['bad backup name', { backupDirectoryName: '/abs/path/evil' }],
    ['unsafe operation id', { operationId: '../escape' }],
  ])('rejects %s', (_label, overrides) => {
    const mutated = { ...journal, ...overrides };
    const parsed = parseOperationJournalText(JSON.stringify(mutated));
    expect(parsed.kind).toBe('invalid');
  });
});

describe('writeJsonAtomically durability', () => {
  it('writes via temp file and leaves content durable on success', async () => {
    const target = path.join(tempDir, 'nested', 'state.json');
    await writeJsonAtomically(target, '{"ok":true}\n');
    const dir = path.dirname(target);
    const entries = fs.readdirSync(dir);
    expect(entries.filter((name) => name.endsWith('.tmp'))).toEqual([]);
    expect(fs.readFileSync(target, 'utf8')).toBe('{"ok":true}\n');
  });

  it('retains the previous valid document when rename fails', async () => {
    const target = path.join(tempDir, 'state.json');
    fs.writeFileSync(target, 'PREVIOUS\n', 'utf8');

    await expect(
      writeJsonAtomically(target, 'NEXT\n', {
        seams: {
          open: async () => {
            const calls: string[] = [];
            void calls;
            return {
              writeAll: async (contents) => {
                void contents;
              },
              sync: async () => {},
              close: async () => {},
            };
          },
          rename: async () => {
            throw new Error('EIO: injected rename failure');
          },
          mkdir: async () => {},
        },
      }),
    ).rejects.toThrow('EIO');

    expect(fs.readFileSync(target, 'utf8')).toBe('PREVIOUS\n');
  });

  it('surfaces write failures before rename without touching the target', async () => {
    const target = path.join(tempDir, 'state.json');
    fs.writeFileSync(target, 'PREVIOUS\n', 'utf8');

    await expect(
      writeJsonAtomically(target, 'NEXT\n', {
        seams: {
          open: async () => ({
            writeAll: async () => {
              throw new Error('ENOSPC: injected no-space failure');
            },
            sync: async () => {},
            close: async () => {},
          }),
          rename: async () => {},
          mkdir: async () => {},
        },
      }),
    ).rejects.toThrow('ENOSPC');

    expect(fs.readFileSync(target, 'utf8')).toBe('PREVIOUS\n');
  });

  it('refuses targets outside the configured library root', async () => {
    await expect(
      writeJsonAtomically(path.join(tempDir, 'elsewhere', 'x.json'), '{}', {
        libraryRoot: path.join(tempDir, 'examples'),
      }),
    ).rejects.toBeInstanceOf(ExampleLibraryStateError);
  });

  it('tolerates filesystems that reject parent-directory fsync', async () => {
    const target = path.join(tempDir, 'ok.json');
    await writeJsonAtomically(target, '{}\n', {
      seams: {
        open: async (filePath) => {
          const handle = await fs.promises.open(filePath, 'w', 0o600);
          return {
            writeAll: async (contents) => {
              await handle.write(Buffer.from(contents, 'utf8'));
            },
            sync: () => handle.sync(),
            close: () => handle.close(),
          };
        },
        rename: (fromPath, toPath) => fs.promises.rename(fromPath, toPath),
        mkdir: async () => {},
        fsyncDirectory: async () => {
          throw new Error('EINVAL: dir fsync unsupported');
        },
      },
    });
    expect(fs.existsSync(target)).toBe(true);
  });
});
