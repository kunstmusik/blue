import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  closeSync,
  constants,
  existsSync,
  fstatSync,
  fsyncSync,
  ftruncateSync,
  lstatSync,
  openSync,
  realpathSync,
} from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

// Darwin's O_EXLOCK attaches the flock to the open file description. The child
// inherits it with stdout, including if Electron exits before the writer does.
const locked = constants.O_RDWR | constants.O_NONBLOCK | constants.O_NOFOLLOW | 0x20;
const tag = 'org.blue.mcp.render-scratch';
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;

function ownershipTag(fd: number, token?: string): string {
  const args = token ? ['-w', tag, token] : ['-p', tag];
  const result = spawnSync('/usr/bin/xattr', [...args, '/dev/fd/3'], {
    stdio: ['ignore', 'pipe', 'pipe', fd],
    encoding: 'utf8',
  });
  if (result.status !== 0) throw new Error('Could not verify render scratch ownership.');
  return result.stdout.trim();
}

interface VolumeScratchLocation {
  dev: bigint;
  ino: bigint;
  create?: (leaf: string, token: string) => { dev: bigint; ino: bigint };
}

function verifyLocation(root: string, location: VolumeScratchLocation): void {
  const info = lstatSync(root, { bigint: true });
  if (!info.isDirectory() || info.dev !== location.dev || info.ino !== location.ino) {
    throw new Error('Render scratch directory no longer matches its approved identity.');
  }
}

export function openMacRenderScratch(
  profile: string,
  root: string,
  recoverOnly: boolean,
  location?: VolumeScratchLocation,
) {
  const registry = path.join(profile, 'mcp-render-scratch.sqlite');
  if (recoverOnly && !existsSync(registry)) return;
  if (location) verifyLocation(root, location);
  const hash = createHash('sha256').update(realpathSync(profile));
  if (location) hash.update('\0').update(root);
  const leaf = `blue-mcp-${hash.digest('hex')}.wav`;
  const filename = path.join(root, leaf);
  const table = location ? 'volume_scratch' : 'scratch';
  const slot = location ? root : 1;
  const db = new DatabaseSync(registry);
  let fd: number | undefined;
  try {
    db.exec(`PRAGMA synchronous=FULL;
      CREATE TABLE IF NOT EXISTS scratch (
        slot INTEGER PRIMARY KEY CHECK(slot=1), token TEXT NOT NULL,
        dev TEXT NOT NULL, ino TEXT NOT NULL, dirty INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS volume_scratch (
        slot TEXT PRIMARY KEY NOT NULL, token TEXT NOT NULL,
        dev TEXT NOT NULL, ino TEXT NOT NULL, dirty INTEGER NOT NULL,
        root_dev TEXT NOT NULL, root_ino TEXT NOT NULL);
      BEGIN IMMEDIATE;`);
    const row = db.prepare(`SELECT * FROM ${table} WHERE slot=?`).get(slot);
    if (
      row &&
      location &&
      (row.root_dev !== String(location.dev) || row.root_ino !== String(location.ino))
    ) {
      throw new Error('Recorded render scratch directory changed. The entry was preserved.');
    }
    let token = row?.token;
    if (row) {
      if (typeof token !== 'string' || !uuid.test(token))
        throw new Error('Invalid scratch record.');
      try {
        fd = openSync(filename, locked);
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (recoverOnly && code === 'EAGAIN') return;
        if (code !== 'ENOENT') throw error;
        db.prepare(`DELETE FROM ${table} WHERE slot=?`).run(slot);
      }
      if (fd !== undefined) {
        if (location) verifyLocation(root, location);
        const stat = fstatSync(fd, { bigint: true });
        if (
          !stat.isFile() ||
          (stat.mode & 0o077n) !== 0n ||
          stat.uid !== BigInt(process.geteuid!()) ||
          stat.nlink !== 1n ||
          String(stat.dev) !== row.dev ||
          String(stat.ino) !== row.ino ||
          ownershipTag(fd) !== token
        ) {
          throw new Error('Render scratch ownership changed. The entry was preserved.');
        }
        if (stat.size !== 0n) {
          if (row.dirty !== 1) throw new Error('Clean render scratch contains unexpected data.');
          ftruncateSync(fd, 0);
          fsyncSync(fd);
        }
      }
    }
    if (recoverOnly) {
      db.prepare(`UPDATE ${table} SET dirty=0 WHERE slot=?`).run(slot);
      db.exec('COMMIT');
      return;
    }
    if (fd === undefined) {
      token = randomUUID();
      if (location) {
        if (!location.create) throw new Error('Native render scratch allocation is required.');
        const expected = location.create(leaf, token);
        fd = openSync(filename, locked);
        verifyLocation(root, location);
        const info = fstatSync(fd, { bigint: true });
        if (
          !info.isFile() ||
          info.nlink !== 1n ||
          info.size !== 0n ||
          info.dev !== expected.dev ||
          info.ino !== expected.ino ||
          info.dev !== location.dev ||
          ownershipTag(fd) !== token
        ) {
          throw new Error('Allocated render scratch changed before handoff.');
        }
        db.prepare('INSERT INTO volume_scratch VALUES(?,?,?,?,1,?,?)').run(
          slot,
          token,
          String(info.dev),
          String(info.ino),
          String(location.dev),
          String(location.ino),
        );
      } else {
        fd = openSync(filename, locked | constants.O_CREAT | constants.O_EXCL, 0o600);
        const info = fstatSync(fd, { bigint: true });
        ownershipTag(fd, token);
        fsyncSync(fd);
        db.prepare('INSERT INTO scratch VALUES(1,?,?,?,1)').run(
          token,
          String(info.dev),
          String(info.ino),
        );
      }
    }
    db.prepare(`UPDATE ${table} SET dirty=1 WHERE slot=?`).run(slot);
    db.exec('COMMIT');
    const wavFd = fd;
    fd = undefined;
    return {
      wavFd,
      clear() {
        ftruncateSync(wavFd, 0);
        fsyncSync(wavFd);
        const state = new DatabaseSync(registry);
        try {
          state
            .prepare(`UPDATE ${table} SET dirty=0 WHERE slot=? AND token=?`)
            .run(slot, token as string);
        } finally {
          state.close();
        }
      },
    };
  } finally {
    if (fd !== undefined) closeSync(fd);
    db.close();
  }
}

export function recoverMacRenderScratch(profile: string, tempRoot: string): void {
  const registry = path.join(profile, 'mcp-render-scratch.sqlite');
  if (!existsSync(registry)) return;
  const recover = (root: string, location?: VolumeScratchLocation) => {
    try {
      openMacRenderScratch(profile, root, true, location);
    } catch (error) {
      // A disconnected or changed volume must not prevent recovery on other volumes.
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn('Could not recover MCP render scratch.', error);
      }
    }
  };
  recover(tempRoot);
  const db = new DatabaseSync(registry, { readOnly: true });
  let rows;
  try {
    if (
      !db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='volume_scratch'").get()
    )
      return;
    rows = db.prepare('SELECT slot, root_dev, root_ino FROM volume_scratch WHERE dirty=1').all();
  } finally {
    db.close();
  }
  for (const row of rows) {
    recover(String(row.slot), {
      dev: BigInt(String(row.root_dev)),
      ino: BigInt(String(row.root_ino)),
    });
  }
}
