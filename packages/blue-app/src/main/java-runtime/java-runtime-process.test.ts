import { EventEmitter } from 'events';
import { describe, expect, it, vi } from 'vitest';
import {
  createJavaRuntimeProcess,
  parseJavaVersion,
  probeJavaExecutable,
  terminateJavaRuntimeProcess,
} from './java-runtime-process';

class MockStream extends EventEmitter {}

class MockChildProcess extends EventEmitter {
  stdout = new MockStream();
  stderr = new MockStream();
  killed = false;
  exitCode: number | null = null;
  kill = vi.fn((signal?: NodeJS.Signals) => {
    this.killed = true;
    this.emit('exit', signal === 'SIGKILL' ? 9 : 0, signal ?? null);
    return true;
  });
}

describe('java-runtime-process', () => {
  it('parses java version strings from java -version output', () => {
    expect(parseJavaVersion('openjdk version "21.0.2" 2024-01-16')).toBe(21);
    expect(parseJavaVersion('java version "17.0.11"')).toBe(17);
    expect(parseJavaVersion('java version "1.8.0_402"')).toBe(8);
  });

  it('probes the java executable using java -version', async () => {
    const probe = await probeJavaExecutable('java', {
      runCommand: async () => ({ stdout: '', stderr: 'openjdk version "21.0.2"' }),
    });

    expect(probe.available).toBe(true);
    expect(probe.versionMajor).toBe(21);
  });

  it('spawns the helper jar with generated endpoints and cwd', async () => {
    const child = new MockChildProcess();
    const spawnProcess = vi.fn(() => child as any);

    const handle = await createJavaRuntimeProcess(
      '/repo/packages/blue-app/assets/java/blue-java.jar',
      '/tmp/project',
      'java',
      {
        spawnProcess: spawnProcess as any,
        reservePort: vi.fn().mockResolvedValueOnce(5555).mockResolvedValueOnce(5556),
        createAuthToken: () => 'secret',
        existsSync: () => true,
        statSync: () => ({ isDirectory: () => true }) as any,
      },
    );

    expect(spawnProcess).toHaveBeenCalledWith(
      'java',
      [
        '-jar',
        '/repo/packages/blue-app/assets/java/blue-java.jar',
        '--control-endpoint',
        'tcp://127.0.0.1:5555',
        '--event-endpoint',
        'tcp://127.0.0.1:5556',
        '--auth-token',
        'secret',
      ],
      expect.objectContaining({ cwd: '/tmp/project' }),
    );
    expect(handle.controlEndpoint).toBe('tcp://127.0.0.1:5555');

    child.stdout.emit('data', Buffer.from('hello'));
    child.stderr.emit('data', Buffer.from('warn'));
    expect(handle.stdoutText).toBe('hello');
    expect(handle.stderrText).toBe('warn');
  });

  it('caps retained helper stdout and stderr text', async () => {
    const child = new MockChildProcess();
    const handle = await createJavaRuntimeProcess('/helper.jar', null, 'java', {
      spawnProcess: vi.fn(() => child as any) as any,
      reservePort: vi.fn().mockResolvedValueOnce(5555).mockResolvedValueOnce(5556),
      createAuthToken: () => 'secret',
    });

    child.stdout.emit('data', 'a'.repeat(1024 * 1024 + 100));
    child.stderr.emit('data', 'b'.repeat(1024 * 1024 + 100));

    expect(handle.stdoutText.startsWith('[truncated]\n')).toBe(true);
    expect(handle.stderrText.startsWith('[truncated]\n')).toBe(true);
    expect(handle.stdoutText.length).toBeLessThan(1024 * 1024 + 20);
    expect(handle.stderrText.length).toBeLessThan(1024 * 1024 + 20);
  });

  it('terminates a running helper process', async () => {
    const child = new MockChildProcess();
    const handle = {
      process: child as any,
      javaExecutable: 'java',
      artifactPath: '/helper.jar',
      controlEndpoint: 'tcp://127.0.0.1:5555',
      eventEndpoint: 'tcp://127.0.0.1:5556',
      authToken: 'token',
      stdoutText: '',
      stderrText: '',
    };

    terminateJavaRuntimeProcess(handle as any);

    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
  });

  it('escalates termination to SIGKILL when a process does not exit', async () => {
    vi.useFakeTimers();
    try {
      const child = new MockChildProcess();
      child.kill = vi.fn((signal?: NodeJS.Signals) => {
        if (signal === 'SIGKILL') {
          child.killed = true;
        }
        return true;
      });
      const handle = {
        process: child as any,
        javaExecutable: 'java',
        artifactPath: '/helper.jar',
        controlEndpoint: 'tcp://127.0.0.1:5555',
        eventEndpoint: 'tcp://127.0.0.1:5556',
        authToken: 'token',
        stdoutText: '',
        stderrText: '',
        exited: false,
        exitCode: null,
        exitSignal: null,
      };

      terminateJavaRuntimeProcess(handle as any, 'SIGTERM', 50);
      await vi.advanceTimersByTimeAsync(50);

      expect(child.kill).toHaveBeenCalledWith('SIGTERM');
      expect(child.kill).toHaveBeenCalledWith('SIGKILL');
    } finally {
      vi.useRealTimers();
    }
  });
});
