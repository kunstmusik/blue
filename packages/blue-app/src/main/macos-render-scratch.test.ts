import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import {
  closeSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';
import { openMacRenderScratch } from './macos-render-scratch';

describe.skipIf(process.platform !== 'darwin')('macOS render scratch', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'blue-scratch-test-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });
  const acquire = () => openMacRenderScratch(dir, dir, false)!;
  const recover = () => openMacRenderScratch(dir, dir, true);
  const filename = () =>
    path.join(
      dir,
      readdirSync(dir).find((name) => name.endsWith('.wav'))!,
    );

  it('keeps one empty file across successive renders and handles OS eviction', () => {
    let scratch = acquire();
    const file = filename();
    const ino = statSync(file).ino;
    writeSync(scratch.wavFd, 'audio');
    scratch.clear();
    closeSync(scratch.wavFd);
    expect(statSync(file).size).toBe(0);
    scratch = acquire();
    expect(statSync(file).ino).toBe(ino);
    closeSync(scratch.wavFd);
    rmSync(file);
    recover();
    scratch = acquire();
    scratch.clear();
    closeSync(scratch.wavFd);
    expect(statSync(file).size).toBe(0);
  });

  it('waits for the surviving writer to exit before reclaiming abandoned audio', async () => {
    const scratch = acquire();
    const file = filename();
    const writer = spawn(
      process.execPath,
      ['-e', "process.stdout.write('audio', () => process.send('ready')); process.stdin.resume()"],
      { stdio: ['pipe', scratch.wavFd, 'ignore', 'ipc'] },
    );
    try {
      await once(writer, 'message');
      closeSync(scratch.wavFd);
      recover();
      expect(readFileSync(file, 'utf8')).toBe('audio');
      expect(acquire).toThrow();
    } finally {
      const exited = once(writer, 'exit');
      writer.kill();
      await exited;
    }
    recover();
    recover();
    expect(statSync(file).size).toBe(0);
  });

  it('clears the held file when another entry takes its name during rendering', () => {
    const scratch = acquire();
    const file = filename();
    try {
      writeSync(scratch.wavFd, 'partial');
      renameSync(file, file + '.moved');
      writeFileSync(file, 'unrelated');
      scratch.clear();
      expect(statSync(file + '.moved').size).toBe(0);
      expect(readFileSync(file, 'utf8')).toBe('unrelated');
    } finally {
      closeSync(scratch.wavFd);
    }
  });

  it('preserves audio when the inode matches but its ownership tag is missing', () => {
    const scratch = acquire();
    const file = filename();
    writeSync(scratch.wavFd, 'partial');
    closeSync(scratch.wavFd);
    const removeTag = spawnSync('/usr/bin/xattr', ['-d', 'org.blue.mcp.render-scratch', file]);
    expect(removeTag.status).toBe(0);
    expect(recover).toThrow(/ownership/);
    expect(readFileSync(file, 'utf8')).toBe('partial');
  });

  it('preserves a replacement on startup and on the next render', () => {
    const scratch = acquire();
    const file = filename();
    writeSync(scratch.wavFd, 'partial');
    closeSync(scratch.wavFd);
    renameSync(file, file + '.moved');
    writeFileSync(file, 'unrelated');
    expect(recover).toThrow(/ownership/);
    expect(acquire).toThrow(/ownership/);
    expect(readFileSync(file, 'utf8')).toBe('unrelated');
  });
});
