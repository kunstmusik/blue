import { promises as fs } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

export interface RememberedCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  hostOnly: boolean;
  sameSite: 'unspecified' | 'no_restriction' | 'lax' | 'strict';
  expirationDate?: number;
}
export interface RememberedSession {
  version: 1;
  origin: string;
  expiresAt: string;
  cookies: RememberedCookie[];
}
interface Encryption {
  isEncryptionAvailable(): boolean;
  getSelectedStorageBackend?(): string;
  encryptString(value: string): Buffer;
  decryptString(value: Buffer): string;
}
const MAX_BYTES = 128 * 1024;
export const STORAGE_UNAVAILABLE =
  'OS-protected storage is unavailable. Sign-in will last only until Blue exits.';
export const STORAGE_FAILURE =
  'Blue could not update the saved sign-in. Your session may not be remembered.';
export const CLEANUP_FAILURE =
  'Blue could not remove the saved sign-in. Durable local sign-out could not be confirmed.';

export function isRememberedSession(value: unknown, origin: string): value is RememberedSession {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const r = value as RememberedSession;
  if (Object.keys(r).some((k) => !['version', 'origin', 'expiresAt', 'cookies'].includes(k)))
    return false;
  if (r.version !== 1 || r.origin !== origin || typeof r.expiresAt !== 'string') return false;
  const expiry = Date.parse(r.expiresAt);
  if (
    !Number.isFinite(expiry) ||
    expiry <= Date.now() ||
    expiry > Date.now() + 7 * 86400_000 + 60_000
  )
    return false;
  const url = new URL(origin);
  if (!Array.isArray(r.cookies) || !r.cookies.length || r.cookies.length > 32) return false;
  return r.cookies.every(
    (c) =>
      c &&
      typeof c === 'object' &&
      Object.keys(c).every((k) =>
        [
          'name',
          'value',
          'domain',
          'path',
          'secure',
          'httpOnly',
          'hostOnly',
          'sameSite',
          'expirationDate',
        ].includes(k),
      ) &&
      typeof c.name === 'string' &&
      /^[!#$%&'*+.^_`|~0-9A-Za-z-]{1,256}$/.test(c.name) &&
      typeof c.value === 'string' &&
      c.value.length <= 8192 &&
      !/[\x00-\x1f\x7f]/.test(c.value) &&
      c.domain === url.hostname &&
      c.hostOnly === true &&
      c.httpOnly === true &&
      typeof c.secure === 'boolean' &&
      (url.protocol !== 'https:' || c.secure) &&
      typeof c.path === 'string' &&
      c.path.startsWith('/') &&
      c.path.length <= 1024 &&
      !/[\x00-\x1f\x7f]/.test(c.path) &&
      ['unspecified', 'no_restriction', 'lax', 'strict'].includes(c.sameSite) &&
      (c.expirationDate === undefined ||
        (Number.isFinite(c.expirationDate) && c.expirationDate * 1000 > Date.now())),
  );
}

/** A single encrypted auth record. The serial queue makes logout win over pending file writes. */
export class RememberedSessionStore {
  private generation = 0;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(
    private readonly options: { filePath: string; origin: string; encryption: Encryption },
  ) {}
  invalidate(): void {
    this.generation++;
  }
  private protectedStorage(): void {
    const crypto = this.options.encryption;
    if (!crypto.isEncryptionAvailable() || crypto.getSelectedStorageBackend?.() === 'basic_text')
      throw new Error(STORAGE_UNAVAILABLE);
  }
  private serial<T>(work: () => Promise<T>): Promise<T> {
    const next = this.queue.then(work);
    this.queue = next.catch(() => {});
    return next;
  }
  clear(): Promise<void> {
    this.invalidate();
    return this.serial(async () => {
      try {
        await fs.rm(this.options.filePath, { force: true });
      } catch {
        throw new Error(CLEANUP_FAILURE);
      }
    });
  }
  load(): Promise<RememberedSession | null> {
    const generation = this.generation;
    return this.serial(async () => {
      let bytes: Buffer;
      try {
        const info = await fs.lstat(this.options.filePath);
        if (!info.isFile() || info.size > MAX_BYTES) {
          await fs.rm(this.options.filePath, { force: true });
          return null;
        }
        bytes = await fs.readFile(this.options.filePath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw new Error(STORAGE_FAILURE);
      }
      this.protectedStorage();
      let record: unknown;
      try {
        record = JSON.parse(this.options.encryption.decryptString(bytes));
      } catch {
        record = null;
      }
      if (!isRememberedSession(record, this.options.origin)) {
        try {
          await fs.rm(this.options.filePath, { force: true });
        } catch {
          throw new Error(CLEANUP_FAILURE);
        }
        return null;
      }
      return generation === this.generation ? record : null;
    });
  }
  save(record: RememberedSession, isCurrent: () => boolean = () => true): Promise<void> {
    const generation = this.generation;
    const current = () => generation === this.generation && isCurrent();
    return this.serial(async () => {
      if (!current()) return;
      this.protectedStorage();
      if (!isRememberedSession(record, this.options.origin)) throw new Error(STORAGE_FAILURE);
      const temporary = `${this.options.filePath}.${randomUUID()}.tmp`;
      try {
        const text = JSON.stringify(record);
        if (Buffer.byteLength(text) > MAX_BYTES / 2) throw new Error(STORAGE_FAILURE);
        const bytes = this.options.encryption.encryptString(text);
        if (bytes.length > MAX_BYTES) throw new Error(STORAGE_FAILURE);
        if (!current()) return;
        await fs.mkdir(dirname(this.options.filePath), { recursive: true, mode: 0o700 });
        await fs.writeFile(temporary, bytes, { mode: 0o600, flag: 'wx' });
        if (!current()) return;
        await fs.rename(temporary, this.options.filePath);
        if (!current()) await fs.rm(this.options.filePath, { force: true });
      } catch {
        throw new Error(STORAGE_FAILURE);
      } finally {
        await fs.rm(temporary, { force: true }).catch(() => {});
      }
    });
  }
}
