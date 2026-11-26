import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import * as fs from 'fs';
import * as path from 'path';
import { app, safeStorage } from 'electron';
import type { McpCredentialStorage } from '../shared/mcp-server';

/** 32 random bytes, carried as 64 lowercase hexadecimal characters. */
export const MCP_CREDENTIAL_BYTES = 32;
const TOKEN_PATTERN = /^[0-9a-f]{64}$/;
const UNREADABLE_REVOKED_MARKER = 'revoked:unreadable';
const LINUX_INSECURE_BACKENDS = new Set(['', 'basic_text', 'unknown']);

/** Ciphertext at rest. The plaintext credential exists only in main-process memory. */
export interface McpCredentialFileStore {
  load(): Buffer | null;
  save(ciphertext: Buffer): void;
  clear(): void;
  loadRevocationMarker?(): string | null;
  saveRevocationMarker?(marker: string): void;
  clearRevocationMarker?(): void;
  verifyWritable?(): void;
}

/**
 * Secondary durable interlock used to record pending credential revocation
 * before removal/replacement runs and to fail closed across restarts if primary
 * credential persistence fails.
 */
export interface McpCredentialInterlock {
  load(): string | null;
  save(marker: string): void;
  clear(): void;
  verifyWritable?(): void;
}

/** The subset of Electron's safeStorage that the credential depends on. */
export interface McpCredentialProtection {
  isEncryptionAvailable(): boolean;
  getSelectedStorageBackend?(): string;
  encryptString(plainText: string): Buffer;
  decryptString(ciphertext: Buffer): string;
}

export interface McpCredentialDeps {
  protection?: McpCredentialProtection;
  fileStore?: McpCredentialFileStore;
  interlock?: McpCredentialInterlock;
  platform?: NodeJS.Platform | string;
}

export type McpCredentialResult =
  | { kind: 'ready'; storage: McpCredentialStorage }
  | { kind: 'unavailable'; message: string };

function digestCiphertext(ciphertext: Buffer): string {
  return `sha256:${createHash('sha256').update(ciphertext).digest('hex')}`;
}

function writeFileAtomically(targetPath: string, data: Buffer | string): void {
  const tmpPath = `${targetPath}.tmp`;
  fs.writeFileSync(tmpPath, data, { mode: 0o600 });
  fs.renameSync(tmpPath, targetPath);
}

function verifyPathWritable(targetPath: string): void {
  if (fs.existsSync(targetPath)) {
    fs.accessSync(targetPath, fs.constants.W_OK);
  }
  const dir = path.dirname(targetPath);
  const probePath = `${targetPath}.probe-${process.pid}-${randomBytes(6).toString('hex')}`;
  const fd = fs.openSync(
    probePath,
    fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL,
    0o600,
  );
  try {
    fs.closeSync(fd);
  } finally {
    fs.rmSync(probePath, { force: true });
  }
  fs.accessSync(dir, fs.constants.W_OK);
}

export function createFileCredentialStore(filePath: string): McpCredentialFileStore {
  const markerPath = `${filePath}.revoked`;
  return {
    load: () => (fs.existsSync(filePath) ? fs.readFileSync(filePath) : null),
    save: (ciphertext) => {
      writeFileAtomically(filePath, ciphertext);
    },
    clear: () => fs.rmSync(filePath, { force: true }),
    loadRevocationMarker: () =>
      fs.existsSync(markerPath) ? fs.readFileSync(markerPath, 'utf8').trim() || null : null,
    saveRevocationMarker: (marker) => {
      writeFileAtomically(markerPath, `${marker}\n`);
    },
    clearRevocationMarker: () => fs.rmSync(markerPath, { force: true }),
    verifyWritable: () => verifyPathWritable(filePath),
  };
}

export function createFileCredentialInterlock(filePath: string): McpCredentialInterlock {
  return {
    load: () => (fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8').trim() || null : null),
    save: (marker) => {
      writeFileAtomically(filePath, `${marker}\n`);
    },
    clear: () => fs.rmSync(filePath, { force: true }),
    verifyWritable: () => verifyPathWritable(filePath),
  };
}

/**
 * Owns the local MCP bearer credential. Only the main process holds the
 * plaintext; disk carries protected ciphertext, and a memory-only token is used
 * when no protected storage provider is available.
 */
export class McpCredentialManager {
  private readonly protection: McpCredentialProtection;
  private readonly fileStore: McpCredentialFileStore;
  private readonly interlock?: McpCredentialInterlock;
  private readonly platform: NodeJS.Platform | string;
  private token: string | null = null;
  private storage: McpCredentialStorage | null = null;
  private epoch = 0;
  private rotationFailure: Extract<McpCredentialResult, { kind: 'unavailable' }> | null = null;

  constructor(deps: McpCredentialDeps = {}) {
    this.protection = deps.protection ?? safeStorage;
    this.fileStore =
      deps.fileStore ??
      createFileCredentialStore(path.join(app.getPath('userData'), 'mcp-credential.dat'));
    this.interlock = deps.interlock;
    this.platform = deps.platform ?? process.platform;
  }

  /** Advances whenever the current credential changes or is revoked. */
  getEpoch(): number {
    return this.epoch;
  }

  current(): string | null {
    return this.token;
  }

  getStorage(): McpCredentialStorage | null {
    return this.storage;
  }

  private isProtectedStorageAvailable(): boolean {
    if (!this.protection.isEncryptionAvailable()) {
      return false;
    }
    if (
      this.platform === 'linux' &&
      typeof this.protection.getSelectedStorageBackend === 'function'
    ) {
      const backend = this.protection.getSelectedStorageBackend().trim().toLowerCase();
      if (LINUX_INSECURE_BACKENDS.has(backend)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Recovers the persisted credential, or creates one when none exists. An
   * existing credential that cannot be recovered leaves the service unavailable
   * rather than silently replacing it, and a failed rotation keeps the previous
   * credential closed until a subsequent rotation succeeds.
   */
  provision(): McpCredentialResult {
    if (this.rotationFailure) return this.rotationFailure;

    if (this.token) return { kind: 'ready', storage: this.storage! };

    let revocationMarker: string | null = null;
    try {
      revocationMarker = this.fileStore.loadRevocationMarker?.() ?? null;
    } catch {
      return {
        kind: 'unavailable',
        message: 'The MCP credential revocation state could not be verified.',
      };
    }

    let interlockMarker: string | null = null;
    try {
      interlockMarker = this.interlock?.load() ?? null;
    } catch {
      return {
        kind: 'unavailable',
        message: 'The MCP credential interlock state could not be verified.',
      };
    }

    let stored: Buffer | null;
    try {
      stored = this.fileStore.load();
    } catch {
      return { kind: 'unavailable', message: 'The saved MCP credential could not be read.' };
    }

    if (revocationMarker !== null || interlockMarker !== null) {
      if (stored === null) {
        try {
          if (revocationMarker !== null) this.fileStore.clearRevocationMarker?.();
          if (interlockMarker !== null) this.interlock?.clear();
        } catch {
          return {
            kind: 'unavailable',
            message: 'The MCP credential revocation marker could not be cleared.',
          };
        }
        return this.create(false);
      }
      const storedDigest = digestCiphertext(stored);
      const matchesFileMarker =
        revocationMarker !== null &&
        (revocationMarker === UNREADABLE_REVOKED_MARKER || revocationMarker === storedDigest);
      const matchesInterlock =
        interlockMarker !== null &&
        (interlockMarker === UNREADABLE_REVOKED_MARKER || interlockMarker === storedDigest);
      if (matchesFileMarker || matchesInterlock) {
        return {
          kind: 'unavailable',
          message:
            'The previously revoked MCP credential could not be removed. Rotate the credential again once write access is restored.',
        };
      }
    }

    if (stored === null) return this.create(false);

    // Ensure future revocation/rotation writes can succeed before activating a persisted secret.
    try {
      this.fileStore.verifyWritable?.();
      this.interlock?.verifyWritable?.();
    } catch {
      return {
        kind: 'unavailable',
        message:
          'The saved MCP credential location is not writable, so durable revocation cannot be guaranteed. Restore write access and rotate again.',
      };
    }

    if (this.isProtectedStorageAvailable()) {
      try {
        const token = this.protection.decryptString(stored);
        if (TOKEN_PATTERN.test(token)) {
          this.install(token, 'persisted');
          return { kind: 'ready', storage: 'persisted' };
        }
      } catch {
        // Locked or corrupt: fall through to the recoverable unavailable state.
      }
    }
    return {
      kind: 'unavailable',
      message:
        'The saved MCP credential is locked. Unlock the system credential store and retry, or rotate the credential to create a new one.',
    };
  }

  /**
   * Revokes the current credential, then provisions a replacement. The revoked
   * ciphertext must be removed or durably replaced before any fallback so retry
   * and restart cannot restore it.
   */
  rotate(): McpCredentialResult {
    // Revoke before any I/O so pending work loses its authority immediately.
    this.token = null;
    this.storage = null;
    this.epoch++;

    let revokedMarker = UNREADABLE_REVOKED_MARKER;
    let hadStoredCredential = false;
    try {
      const existing = this.fileStore.load();
      if (existing !== null) {
        hadStoredCredential = true;
        revokedMarker = digestCiphertext(existing);
      }
    } catch {
      hadStoredCredential = true;
      revokedMarker = UNREADABLE_REVOKED_MARKER;
    }

    let revocationCommitted = false;
    if (hadStoredCredential) {
      try {
        if (this.interlock) {
          this.interlock.save(revokedMarker);
          revocationCommitted = true;
        }
      } catch {
        // Try the primary marker and credential invalidation independently.
      }
      try {
        if (this.fileStore.saveRevocationMarker) {
          this.fileStore.saveRevocationMarker(revokedMarker);
          revocationCommitted = true;
        }
      } catch {
        // Removing or replacing the ciphertext can still commit rotation.
      }
    }

    let invalidated = true;
    try {
      this.fileStore.clear();
    } catch {
      invalidated = false;
    }

    const result = this.create(!invalidated);
    if (result.kind === 'ready') {
      try {
        this.fileStore.clearRevocationMarker?.();
      } catch {
        // If no stored file remains, a stale marker would be cleared on recovery;
        // if persisted replacement succeeded, its digest differs from the revoked digest.
      }
      try {
        this.interlock?.clear();
      } catch {
        // Replaced persisted credential digest differs from the prior revoked digest.
      }
      this.rotationFailure = null;
      return result;
    }

    this.rotationFailure = revocationCommitted
      ? result
      : {
          kind: 'unavailable',
          message:
            'Rotation could not be committed. The previous credential may be used after restart. Restore write access and rotate again.',
        };
    return this.rotationFailure;
  }

  /** Constant-time comparison of the decoded fixed-length credentials. */
  matches(token: unknown): boolean {
    if (typeof token !== 'string' || !TOKEN_PATTERN.test(token) || !this.token) return false;
    return timingSafeEqual(Buffer.from(token, 'hex'), Buffer.from(this.token, 'hex'));
  }

  private create(mustPersist: boolean): McpCredentialResult {
    const token = randomBytes(MCP_CREDENTIAL_BYTES).toString('hex');
    if (this.isProtectedStorageAvailable()) {
      try {
        this.fileStore.save(this.protection.encryptString(token));
        this.install(token, 'persisted');
        return { kind: 'ready', storage: 'persisted' };
      } catch {
        // Fall through: persistence failed.
      }
    }
    if (mustPersist) {
      return {
        kind: 'unavailable',
        message:
          'The previous MCP credential could not be removed, so no replacement was created. Check write access to the Blue user data folder, then rotate again.',
      };
    }
    this.install(token, 'session-only');
    return { kind: 'ready', storage: 'session-only' };
  }

  private install(token: string, storage: McpCredentialStorage): void {
    this.token = token;
    this.storage = storage;
    this.epoch++;
  }
}
