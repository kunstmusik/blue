import { afterEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { RememberedSessionStore, type RememberedSession } from './remembered-session';

const origin = 'https://blue.example.invalid';
const proof: RememberedSession = {
  version: 1,
  origin,
  expiresAt: new Date(Date.now() + 86400_000).toISOString(),
  cookies: [
    {
      name: 'session',
      value: 'synthetic-secret',
      domain: 'blue.example.invalid',
      path: '/',
      secure: true,
      httpOnly: true,
      hostOnly: true,
      sameSite: 'lax',
    },
  ],
};
const encryption = {
  isEncryptionAvailable: () => true,
  encryptString: (text: string) => Buffer.from(text.split('').reverse().join('')),
  decryptString: (data: Buffer) => data.toString().split('').reverse().join(''),
};
const dirs: string[] = [];
async function fixture(crypto = encryption) {
  const dir = await mkdtemp(join(tmpdir(), 'blue-remember-test-'));
  dirs.push(dir);
  const filePath = join(dir, 'session.enc');
  return { filePath, store: new RememberedSessionStore({ filePath, origin, encryption: crypto }) };
}
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('remembered session storage', () => {
  it('encrypts proof, preserves cookie attributes and clears it durably', async () => {
    const { store, filePath } = await fixture();
    await store.save(proof);
    expect((await readFile(filePath)).toString()).not.toContain('synthetic-secret');
    expect(await store.load()).toEqual(proof);
    await store.clear();
    expect(await store.load()).toBeNull();
  });
  it('rejects unavailable OS protection without writing plaintext', async () => {
    const { store, filePath } = await fixture({
      ...encryption,
      isEncryptionAvailable: () => false,
    });
    await expect(store.save(proof)).rejects.toThrow('protected storage');
    await expect(readFile(filePath)).rejects.toMatchObject({ code: 'ENOENT' });
  });
  it('rejects the Linux basic_text backend', async () => {
    const { store } = await fixture({
      ...encryption,
      getSelectedStorageBackend: () => 'basic_text',
    } as typeof encryption);
    await expect(store.save(proof)).rejects.toThrow('protected storage');
  });
  it.each([
    { ...proof, version: 2 },
    { ...proof, origin: 'https://other.invalid' },
    { ...proof, expiresAt: '2020-01-01T00:00:00Z' },
    { ...proof, cookies: [{ ...proof.cookies[0], domain: '.example.invalid' }] },
    { ...proof, cookies: [] },
    { ...proof, password: 'must-not-be-stored' },
  ])('discards invalid records', async (record) => {
    const { store, filePath } = await fixture();
    await writeFile(filePath, encryption.encryptString(JSON.stringify(record)));
    expect(await store.load()).toBeNull();
    await expect(readFile(filePath)).rejects.toMatchObject({ code: 'ENOENT' });
  });
  it('clears corrupt ciphertext and does not expose decryption errors', async () => {
    const { store, filePath } = await fixture({
      ...encryption,
      decryptString: () => {
        throw Error('synthetic-secret');
      },
    });
    await writeFile(filePath, 'corrupt');
    expect(await store.load()).toBeNull();
  });
  it('fences queued saves after clear and shutdown invalidation', async () => {
    const { store } = await fixture();
    const save = store.save(proof);
    const clear = store.clear();
    await Promise.all([save, clear]);
    expect(await store.load()).toBeNull();
    const late = store.save(proof);
    store.invalidate();
    await late;
    expect(await store.load()).toBeNull();
  });
  it('reports local deletion failure instead of claiming durable sign-out', async () => {
    const { store, filePath } = await fixture();
    await mkdir(filePath);
    await expect(store.clear()).rejects.toThrow('saved sign-in');
  });
  it('logout removes a save whose atomic rename was already in flight', async () => {
    const { store } = await fixture();
    const original = fs.rename.bind(fs);
    let release!: () => void;
    vi.spyOn(fs, 'rename').mockImplementationOnce(async (from, to) => {
      await new Promise<void>((r) => (release = r));
      await original(from, to);
    });
    const saving = store.save(proof);
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    const clearing = store.clear();
    release();
    await Promise.all([saving, clearing]);
    expect(await store.load()).toBeNull();
  });
  it('reports atomic-write errors without exposing proof or a native path', async () => {
    const { store } = await fixture();
    vi.spyOn(fs, 'writeFile').mockRejectedValueOnce(
      Object.assign(Error('/private/synthetic-secret'), { code: 'EACCES' }),
    );
    await expect(store.save(proof)).rejects.toThrow('saved sign-in');
    expect(await store.load()).toBeNull();
  });
  it('does not save when the originating account has been superseded', async () => {
    const { store } = await fixture();
    const current = vi.fn(() => false);
    await store.save(proof, current);
    expect(await store.load()).toBeNull();
  });
  it('removes a physical rename that settles after the originating operation deadline', async () => {
    const { store } = await fixture();
    let now = Date.now();
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    const deadline = now + 30_000;
    const original = fs.rename.bind(fs);
    let release!: () => void;
    vi.spyOn(fs, 'rename').mockImplementationOnce(async (from, to) => {
      await new Promise<void>((r) => (release = r));
      await original(from, to);
    });
    const saving = store.save(proof, () => Date.now() < deadline);
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    now = deadline;
    store.invalidate();
    const cleanup = store.clear();
    release();
    await Promise.all([saving, cleanup]);
    expect(await store.load()).toBeNull();
  });
});
