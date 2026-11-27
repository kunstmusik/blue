import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  closeSync,
  constants,
  existsSync,
  fstatSync,
  fsyncSync,
  ftruncateSync,
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

export function openMacRenderScratch(profile: string, root: string, recoverOnly: boolean) {
  const registry = path.join(profile, 'mcp-render-scratch.sqlite');
  if (recoverOnly && !existsSync(registry)) return;
  // A fixed per-profile name bounds empty residue even if initialization is interrupted.
  // Exclusive creation refuses to adopt an entry without a committed ownership record.
  const profileId = createHash('sha256').update(realpathSync(profile)).digest('hex');
  const filename = path.join(root, `blue-mcp-${profileId}.wav`);
  const db = new DatabaseSync(registry);
  let fd: number | undefined;
  try {
    db.exec(`PRAGMA synchronous=FULL;
      CREATE TABLE IF NOT EXISTS scratch (
        slot INTEGER PRIMARY KEY CHECK(slot=1), token TEXT NOT NULL,
        dev TEXT NOT NULL, ino TEXT NOT NULL, dirty INTEGER NOT NULL);
      BEGIN IMMEDIATE;`);
    const row = db.prepare('SELECT * FROM scratch WHERE slot=1').get();
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
        db.exec('DELETE FROM scratch WHERE slot=1');
      }
      if (fd !== undefined) {
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
      db.exec('UPDATE scratch SET dirty=0 WHERE slot=1; COMMIT');
      return;
    }
    if (fd === undefined) {
      token = randomUUID();
      fd = openSync(filename, locked | constants.O_CREAT | constants.O_EXCL, 0o600);
      const stat = fstatSync(fd, { bigint: true });
      ownershipTag(fd, token);
      fsyncSync(fd);
      db.prepare('INSERT INTO scratch VALUES(1,?,?,?,1)').run(
        token,
        String(stat.dev),
        String(stat.ino),
      );
    }
    db.exec('UPDATE scratch SET dirty=1 WHERE slot=1; COMMIT');
    const wavFd = fd;
    fd = undefined;
    return {
      wavFd,
      clear() {
        ftruncateSync(wavFd, 0);
        fsyncSync(wavFd);
        const state = new DatabaseSync(registry);
        try {
          state.prepare('UPDATE scratch SET dirty=0 WHERE slot=1 AND token=?').run(token as string);
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
