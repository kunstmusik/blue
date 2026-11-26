import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  McpCredentialManager,
  createFileCredentialInterlock,
  createFileCredentialStore,
  type McpCredentialFileStore,
  type McpCredentialInterlock,
  type McpCredentialProtection,
} from './mcp-credential';

const TOKEN_PATTERN = /^[0-9a-f]{64}$/;

/** Reversible stand-in for the platform credential protection. */
class FakeProtection implements McpCredentialProtection {
  available = true;
  failDecrypt = false;
  backend: string | undefined;

  isEncryptionAvailable(): boolean {
    return this.available;
  }

  getSelectedStorageBackend(): string {
    return this.backend ?? 'gnome_libsecret';
  }

  encryptString(plainText: string): Buffer {
    return Buffer.from(plainText, 'utf8').map((byte) => byte ^ 0x5a);
  }

  decryptString(ciphertext: Buffer): string {
    if (this.failDecrypt) throw new Error('Keychain is locked');
    return Buffer.from(ciphertext.map((byte) => byte ^ 0x5a)).toString('utf8');
  }
}

let tempDir: string;
let filePath: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'blue-mcp-credential-test-'));
  filePath = path.join(tempDir, 'mcp-credential.dat');
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function createStore(overrides: Partial<McpCredentialFileStore> = {}): McpCredentialFileStore {
  const store = createFileCredentialStore(filePath);
  return { ...store, ...overrides };
}

function permissionError(): NodeJS.ErrnoException {
  return Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
}

describe('McpCredentialManager', () => {
  it('persists a protected credential across restarts', () => {
    const protection = new FakeProtection();
    const manager = new McpCredentialManager({ protection, fileStore: createStore() });

    const result = manager.provision();

    expect(result).toEqual({ kind: 'ready', storage: 'persisted' });
    const token = manager.current();
    expect(token).toMatch(TOKEN_PATTERN);
    expect(manager.matches(token)).toBe(true);
    const persisted = fs.readFileSync(filePath);
    expect(persisted.includes(Buffer.from(token!, 'utf8'))).toBe(false);

    const restarted = new McpCredentialManager({ protection, fileStore: createStore() });
    expect(restarted.provision()).toEqual({ kind: 'ready', storage: 'persisted' });
    expect(restarted.current()).toBe(token);
  });

  it('uses a session-only credential when no protection provider is available', () => {
    const protection = new FakeProtection();
    protection.available = false;
    const manager = new McpCredentialManager({ protection, fileStore: createStore() });

    expect(manager.provision()).toEqual({ kind: 'ready', storage: 'session-only' });
    const token = manager.current();
    expect(token).toMatch(TOKEN_PATTERN);
    expect(fs.existsSync(filePath)).toBe(false);

    const restarted = new McpCredentialManager({ protection, fileStore: createStore() });
    restarted.provision();
    expect(restarted.current()).not.toBe(token);
  });

  it('leaves the endpoint unavailable while an existing credential is locked', () => {
    const protection = new FakeProtection();
    const first = new McpCredentialManager({ protection, fileStore: createStore() });
    first.provision();
    const token = first.current();
    const persisted = fs.readFileSync(filePath);

    protection.available = false;
    const locked = new McpCredentialManager({ protection, fileStore: createStore() });
    expect(locked.provision().kind).toBe('unavailable');
    expect(locked.current()).toBeNull();
    expect(locked.matches(token)).toBe(false);
    expect(fs.readFileSync(filePath)).toEqual(persisted);

    protection.available = true;
    protection.failDecrypt = true;
    expect(locked.provision().kind).toBe('unavailable');

    protection.failDecrypt = false;
    expect(locked.provision()).toEqual({ kind: 'ready', storage: 'persisted' });
    expect(locked.current()).toBe(token);
  });

  it('does not replace a corrupt persisted credential with a session-only token', () => {
    fs.writeFileSync(filePath, Buffer.from('not a protected credential'));

    const manager = new McpCredentialManager({
      protection: new FakeProtection(),
      fileStore: createStore(),
    });

    expect(manager.provision().kind).toBe('unavailable');
    expect(manager.current()).toBeNull();
  });

  it('fails closed when the stored credential cannot be read', () => {
    const manager = new McpCredentialManager({
      protection: new FakeProtection(),
      fileStore: createStore({
        load: () => {
          throw permissionError();
        },
      }),
    });

    expect(manager.provision().kind).toBe('unavailable');
    expect(manager.current()).toBeNull();
  });

  it('falls back to a session-only credential when persistence fails', () => {
    const manager = new McpCredentialManager({
      protection: new FakeProtection(),
      fileStore: createStore({
        save: () => {
          throw permissionError();
        },
      }),
    });

    expect(manager.provision()).toEqual({ kind: 'ready', storage: 'session-only' });
    expect(manager.current()).toMatch(TOKEN_PATTERN);
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it('revokes the old credential before provisioning a replacement', () => {
    const protection = new FakeProtection();
    const manager = new McpCredentialManager({ protection, fileStore: createStore() });
    manager.provision();
    const oldToken = manager.current();
    const epoch = manager.getEpoch();

    const result = manager.rotate();

    expect(result).toEqual({ kind: 'ready', storage: 'persisted' });
    const newToken = manager.current();
    expect(newToken).toMatch(TOKEN_PATTERN);
    expect(newToken).not.toBe(oldToken);
    expect(manager.matches(oldToken)).toBe(false);
    expect(manager.matches(newToken)).toBe(true);
    expect(manager.getEpoch()).toBeGreaterThan(epoch);
    expect(protection.decryptString(fs.readFileSync(filePath))).toBe(newToken);
  });

  it('loads the replacement, not the revoked credential, after a restart', () => {
    const protection = new FakeProtection();
    const manager = new McpCredentialManager({ protection, fileStore: createStore() });
    manager.provision();
    const oldToken = manager.current();
    manager.rotate();

    const restarted = new McpCredentialManager({ protection, fileStore: createStore() });
    restarted.provision();

    expect(restarted.current()).toBe(manager.current());
    expect(restarted.matches(oldToken)).toBe(false);
  });

  it('refuses a replacement it cannot durably invalidate while no provider is available', () => {
    const protection = new FakeProtection();
    const manager = new McpCredentialManager({ protection, fileStore: createStore() });
    manager.provision();

    protection.available = false;
    const blocked = new McpCredentialManager({
      protection,
      fileStore: createStore({
        clear: () => {
          throw permissionError();
        },
      }),
    });

    // A session-only replacement would let the next restart restore the revoked token.
    expect(blocked.rotate().kind).toBe('unavailable');
    expect(blocked.current()).toBeNull();
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('refuses a session-only replacement while the revoked credential remains on disk', () => {
    const protection = new FakeProtection();
    const manager = new McpCredentialManager({ protection, fileStore: createStore() });
    manager.provision();
    const oldToken = manager.current();

    // Every write and delete now fails, as they would in a read-only directory.
    const readOnly = createStore({
      save: () => {
        throw permissionError();
      },
      clear: () => {
        throw permissionError();
      },
    });
    const stranded = new McpCredentialManager({ protection, fileStore: readOnly });
    expect(stranded.provision().kind).toBe('ready');
    expect(stranded.matches(oldToken)).toBe(true);

    expect(stranded.rotate().kind).toBe('unavailable');
    expect(stranded.current()).toBeNull();
    expect(stranded.matches(oldToken)).toBe(false);
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('rejects malformed and non-matching tokens', () => {
    const manager = new McpCredentialManager({
      protection: new FakeProtection(),
      fileStore: createStore(),
    });
    manager.provision();
    const token = manager.current()!;

    expect(manager.matches(undefined)).toBe(false);
    expect(manager.matches(null)).toBe(false);
    expect(manager.matches(42)).toBe(false);
    expect(manager.matches('')).toBe(false);
    expect(manager.matches(token.slice(0, 63))).toBe(false);
    expect(manager.matches(`${'0'.repeat(63)}?`)).toBe(false);
    expect(manager.matches('0'.repeat(64))).toBe(false);
    expect(manager.matches(token.replace(/^./, token[0] === '0' ? '1' : '0'))).toBe(false);
  });

  it('treats Linux basic_text as unprotected storage for fresh and existing credentials (T053)', () => {
    const basicProtection = new FakeProtection();
    basicProtection.available = true;
    basicProtection.backend = 'basic_text';

    // Fresh Linux basic_text -> session-only without persisting to disk
    const fresh = new McpCredentialManager({
      protection: basicProtection,
      fileStore: createStore(),
      platform: 'linux',
    });
    expect(fresh.provision()).toEqual({ kind: 'ready', storage: 'session-only' });
    expect(fresh.current()).toMatch(TOKEN_PATTERN);
    expect(fs.existsSync(filePath)).toBe(false);

    // Pre-existing persisted credential created with real backend
    const keyringProtection = new FakeProtection();
    keyringProtection.backend = 'gnome_libsecret';
    const initial = new McpCredentialManager({
      protection: keyringProtection,
      fileStore: createStore(),
      platform: 'linux',
    });
    expect(initial.provision()).toEqual({ kind: 'ready', storage: 'persisted' });
    const persistedToken = initial.current();
    const persistedBytes = fs.readFileSync(filePath);

    // Under basic_text on Linux, existing stored credential must stay unavailable and untouched
    const downgraded = new McpCredentialManager({
      protection: basicProtection,
      fileStore: createStore(),
      platform: 'linux',
    });
    expect(downgraded.provision().kind).toBe('unavailable');
    expect(downgraded.current()).toBeNull();
    expect(downgraded.matches(persistedToken)).toBe(false);
    expect(fs.readFileSync(filePath)).toEqual(persistedBytes);

    // Restoring a protected backend recovers the original credential
    const unlocked = new McpCredentialManager({
      protection: keyringProtection,
      fileStore: createStore(),
      platform: 'linux',
    });
    expect(unlocked.provision()).toEqual({ kind: 'ready', storage: 'persisted' });
    expect(unlocked.current()).toBe(persistedToken);
  });

  it('preserves revocation across failed rotation, retry, and restart until rotation succeeds (T054)', () => {
    const protection = new FakeProtection();
    const initial = new McpCredentialManager({ protection, fileStore: createStore() });
    expect(initial.provision()).toEqual({ kind: 'ready', storage: 'persisted' });
    const oldToken = initial.current()!;

    // Scenario 1: Credential file removal and overwrite fail, while revocation marker can be saved
    let allowCredWrite = false;
    let allowCredClear = false;
    const partialFailStore = createStore({
      clear: () => {
        if (!allowCredClear) throw permissionError();
        fs.rmSync(filePath, { force: true });
      },
      save: (ciphertext) => {
        if (!allowCredWrite) throw permissionError();
        fs.writeFileSync(filePath, ciphertext);
      },
    });
    const manager = new McpCredentialManager({ protection, fileStore: partialFailStore });
    expect(manager.provision()).toEqual({ kind: 'ready', storage: 'persisted' });
    expect(manager.rotate().kind).toBe('unavailable');
    expect(manager.current()).toBeNull();
    expect(manager.matches(oldToken)).toBe(false);

    // Retry/enable in the same process stays unavailable (does not resurrect oldToken)
    expect(manager.provision().kind).toBe('unavailable');
    expect(manager.current()).toBeNull();
    expect(manager.matches(oldToken)).toBe(false);

    // Simulated restart with revocation marker still sees the old file revoked
    const restarted = new McpCredentialManager({ protection, fileStore: partialFailStore });
    expect(restarted.provision().kind).toBe('unavailable');
    expect(restarted.current()).toBeNull();
    expect(restarted.matches(oldToken)).toBe(false);

    // Once writable, rotation creates a new token and clears the revocation marker
    allowCredClear = true;
    allowCredWrite = true;
    expect(restarted.rotate()).toEqual({ kind: 'ready', storage: 'persisted' });
    const newToken = restarted.current()!;
    expect(newToken).not.toBe(oldToken);
    expect(restarted.matches(oldToken)).toBe(false);
    expect(restarted.matches(newToken)).toBe(true);

    const postRecoveryRestart = new McpCredentialManager({ protection, fileStore: createStore() });
    expect(postRecoveryRestart.provision()).toEqual({ kind: 'ready', storage: 'persisted' });
    expect(postRecoveryRestart.current()).toBe(newToken);

    // Scenario 2: Neither credential nor revocation marker can be written -> in-process retry stays closed
    const completelyReadOnlyStore = createStore({
      clear: () => {
        throw permissionError();
      },
      save: () => {
        throw permissionError();
      },
      saveRevocationMarker: () => {
        throw permissionError();
      },
    });
    const stuckManager = new McpCredentialManager({
      protection,
      fileStore: completelyReadOnlyStore,
    });
    expect(stuckManager.provision()).toEqual({ kind: 'ready', storage: 'persisted' });
    expect(stuckManager.rotate().kind).toBe('unavailable');
    expect(stuckManager.provision().kind).toBe('unavailable');
    expect(stuckManager.current()).toBeNull();
    expect(stuckManager.matches(newToken)).toBe(false);
  });

  it('fails closed across fresh-manager relaunch when clear, replacement, and revocation marker fail simultaneously (T064)', () => {
    const protection = new FakeProtection();
    const interlockPath = path.join(tempDir, 'mcp-credential.interlock');
    const interlock = createFileCredentialInterlock(interlockPath);

    const initial = new McpCredentialManager({
      protection,
      fileStore: createStore(),
      interlock,
    });
    expect(initial.provision()).toEqual({ kind: 'ready', storage: 'persisted' });
    const oldToken = initial.current()!;

    // Case 1: fileStore clear/save/saveRevocationMarker all fail simultaneously; interlock records write-ahead revocation.
    const failingPrimaryStore = createStore({
      clear: () => {
        throw permissionError();
      },
      save: () => {
        throw permissionError();
      },
      saveRevocationMarker: () => {
        throw permissionError();
      },
    });
    const first = new McpCredentialManager({
      protection,
      fileStore: failingPrimaryStore,
      interlock,
    });
    expect(first.provision()).toEqual({ kind: 'ready', storage: 'persisted' });
    expect(first.rotate().kind).toBe('unavailable');
    expect(first.matches(oldToken)).toBe(false);

    // Fresh manager after relaunch fails closed even if fileStore itself is writable again.
    const relaunched = new McpCredentialManager({
      protection,
      fileStore: createStore(),
      interlock: createFileCredentialInterlock(interlockPath),
    });
    expect(relaunched.provision().kind).toBe('unavailable');
    expect(relaunched.current()).toBeNull();
    expect(relaunched.matches(oldToken)).toBe(false);

    // Explicit recovery via rotate() provisions a fresh token, clears the interlock, and rejects oldToken.
    expect(relaunched.rotate()).toEqual({ kind: 'ready', storage: 'persisted' });
    const recoveredToken = relaunched.current()!;
    expect(recoveredToken).not.toBe(oldToken);
    expect(relaunched.matches(oldToken)).toBe(false);
    expect(relaunched.matches(recoveredToken)).toBe(true);

    // Case 2: Total simultaneous failure across primary store AND interlock on an unwritable directory fails closed across relaunch.
    let dirWritable = false;
    const totalFailInterlock: McpCredentialInterlock = {
      load: () => createFileCredentialInterlock(interlockPath).load(),
      save: (marker) => {
        if (!dirWritable) throw permissionError();
        createFileCredentialInterlock(interlockPath).save(marker);
      },
      clear: () => {
        if (!dirWritable) throw permissionError();
        createFileCredentialInterlock(interlockPath).clear();
      },
      verifyWritable: () => {
        if (!dirWritable) throw permissionError();
      },
    };
    const totalFailStore = createStore({
      clear: () => {
        if (!dirWritable) throw permissionError();
        createStore().clear();
      },
      save: (buf) => {
        if (!dirWritable) throw permissionError();
        createStore().save(buf);
      },
      saveRevocationMarker: () => {
        if (!dirWritable) throw permissionError();
      },
      verifyWritable: () => {
        if (!dirWritable) throw permissionError();
      },
    });

    const totalFailRotate = new McpCredentialManager({
      protection,
      fileStore: totalFailStore,
      interlock: totalFailInterlock,
    });
    expect(totalFailRotate.rotate()).toMatchObject({
      kind: 'unavailable',
      message: expect.stringContaining('Rotation could not be committed'),
    });

    const relaunchedLocked = new McpCredentialManager({
      protection,
      fileStore: totalFailStore,
      interlock: totalFailInterlock,
    });
    expect(relaunchedLocked.provision().kind).toBe('unavailable');
    expect(relaunchedLocked.matches(recoveredToken)).toBe(false);

    dirWritable = true;
    const relaunchedAfterStorageRecovery = new McpCredentialManager({
      protection,
      fileStore: totalFailStore,
      interlock: totalFailInterlock,
    });
    expect(totalFailRotate.provision()).toMatchObject({
      kind: 'unavailable',
      message: expect.stringContaining('Rotation could not be committed'),
    });
    expect(relaunchedAfterStorageRecovery.provision()).toEqual({
      kind: 'ready',
      storage: 'persisted',
    });
    expect(relaunchedAfterStorageRecovery.matches(recoveredToken)).toBe(true);
    expect(relaunchedLocked.rotate()).toEqual({ kind: 'ready', storage: 'persisted' });
    expect(relaunchedLocked.current()).not.toBe(recoveredToken);
    expect(relaunchedLocked.matches(recoveredToken)).toBe(false);
  });
});
