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
  it('does not report a running child as unspawned after an asynchronous kill error (T051)', async () => {
    vi.useFakeTimers();
    try {
      const child = new MockChildProcess() as MockChildProcess & { pid: number };
      child.pid = 12345;
      child.kill.mockImplementation(() => {
        queueMicrotask(() => child.emit('error', new Error('EPERM')));
        return true;
      });
      const handle = await createJavaRuntimeProcess('/helper.jar', null, 'java', {
        spawnProcess: (() => child as any) as any,
        reservePort: vi.fn().mockResolvedValueOnce(5555).mockResolvedValueOnce(5556),
        createAuthToken: () => 'secret',
      });
      const termination = terminateJavaRuntimeProcess(handle);
      await vi.advanceTimersByTimeAsync(3000);
      expect(await termination).toMatchObject({ status: 'failed' });
      expect(child.kill).toHaveBeenCalledWith('SIGKILL');
      expect(handle.exited).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
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
      exited: false,
      exitCode: null,
      exitSignal: null,
    };

    const result = await terminateJavaRuntimeProcess(handle as any);

    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
    expect(result).toEqual({ status: 'exited' });
  });

  it('escalates termination to SIGKILL when a process does not exit', async () => {
    vi.useFakeTimers();
    try {
      const child = new MockChildProcess();
      child.kill = vi.fn((signal?: NodeJS.Signals) => {
        child.killed = true;
        if (signal === 'SIGKILL') {
          child.emit('exit', 9, signal);
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

      const terminationPromise = terminateJavaRuntimeProcess(handle as any, 'SIGTERM', 50, 20);
      await vi.advanceTimersByTimeAsync(50);

      expect(child.kill).toHaveBeenCalledWith('SIGTERM');
      expect(child.kill).toHaveBeenCalledWith('SIGKILL');

      const result = await terminationPromise;
      expect(result).toEqual({ status: 'exited' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('escalates to SIGKILL when SIGTERM sets killed=true without process exit', async () => {
    vi.useFakeTimers();
    try {
      const child = new MockChildProcess();
      child.kill = vi.fn((signal?: NodeJS.Signals) => {
        child.killed = true;
        if (signal === 'SIGKILL') {
          child.emit('exit', 9, 'SIGKILL');
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

      const terminationPromise = terminateJavaRuntimeProcess(handle as any, 'SIGTERM', 2000, 1000);
      expect(child.kill).toHaveBeenCalledWith('SIGTERM');
      expect(child.killed).toBe(true);
      expect(child.kill).not.toHaveBeenCalledWith('SIGKILL');

      await vi.advanceTimersByTimeAsync(2000);
      expect(child.kill).toHaveBeenCalledWith('SIGKILL');

      const result = await terminationPromise;
      expect(result).toEqual({ status: 'exited' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('confirms exit when process exits during grace period without SIGKILL escalation', async () => {
    vi.useFakeTimers();
    try {
      const child = new MockChildProcess();
      child.kill = vi.fn(() => {
        child.killed = true;
        setTimeout(() => {
          child.emit('exit', 0, 'SIGTERM');
        }, 500);
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

      const terminationPromise = terminateJavaRuntimeProcess(handle as any, 'SIGTERM', 2000, 1000);
      await vi.advanceTimersByTimeAsync(500);

      const result = await terminationPromise;
      expect(result).toEqual({ status: 'exited' });
      expect(child.kill).toHaveBeenCalledWith('SIGTERM');
      expect(child.kill).not.toHaveBeenCalledWith('SIGKILL');
    } finally {
      vi.useRealTimers();
    }
  });

  it('confirms forced-exit when process exits during force-exit confirmation window', async () => {
    vi.useFakeTimers();
    try {
      const child = new MockChildProcess();
      child.kill = vi.fn((signal?: NodeJS.Signals) => {
        child.killed = true;
        if (signal === 'SIGKILL') {
          setTimeout(() => {
            child.emit('exit', 9, 'SIGKILL');
          }, 300);
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

      const terminationPromise = terminateJavaRuntimeProcess(handle as any, 'SIGTERM', 2000, 1000);
      await vi.advanceTimersByTimeAsync(2000);
      expect(child.kill).toHaveBeenCalledWith('SIGKILL');

      await vi.advanceTimersByTimeAsync(300);
      const result = await terminationPromise;
      expect(result).toEqual({ status: 'exited' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns failed status when kill signal fails and process does not exit', async () => {
    const child = new MockChildProcess();
    child.kill = vi.fn(() => {
      throw new Error('EPERM: operation not permitted');
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

    const result = await terminateJavaRuntimeProcess(handle as any);
    expect(result.status).toBe('failed');
    if (result.status === 'failed') {
      expect(result.reason).toContain('EPERM');
    }
  });

  it('returns failed status when process fails to exit within bounded timeout', async () => {
    vi.useFakeTimers();
    try {
      const child = new MockChildProcess();
      child.kill = vi.fn(() => true);
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

      const terminationPromise = terminateJavaRuntimeProcess(handle as any, 'SIGTERM', 2000, 1000);
      await vi.advanceTimersByTimeAsync(2000);
      expect(child.kill).toHaveBeenCalledWith('SIGKILL');

      await vi.advanceTimersByTimeAsync(1000);
      const result = await terminationPromise;
      expect(result.status).toBe('failed');
      if (result.status === 'failed') {
        expect(result.reason).toContain('timed out');
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns not-started status when process had spawn error', async () => {
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
      exited: false,
      exitCode: null,
      exitSignal: null,
      spawnError: 'spawn ENOENT',
    };

    const result = await terminateJavaRuntimeProcess(handle as any);
    expect(result).toEqual({ status: 'not-started' });
  });

  it('aborts process creation when isCancelled returns true after port reservation', async () => {
    const spawnProcess = vi.fn();
    let cancelled = false;

    const promise = createJavaRuntimeProcess('/helper.jar', null, 'java', {
      reservePort: vi.fn(async () => {
        cancelled = true;
        return 5555;
      }),
      isCancelled: () => cancelled,
      spawnProcess: spawnProcess as any,
    });

    await expect(promise).rejects.toThrow('cancelled');
    expect(spawnProcess).not.toHaveBeenCalled();
  });

  it('synchronously calls onSpawned when child process is created', async () => {
    const child = new MockChildProcess();
    let spawnedHandle: any = null;

    const handle = await createJavaRuntimeProcess('/helper.jar', null, 'java', {
      reservePort: vi.fn().mockResolvedValueOnce(5555).mockResolvedValueOnce(5556),
      spawnProcess: vi.fn(() => child as any) as any,
      onSpawned: (h) => {
        spawnedHandle = h;
      },
    });

    expect(spawnedHandle).toBe(handle);
    expect(handle.controlEndpoint).toBe('tcp://127.0.0.1:5555');
  });
});
