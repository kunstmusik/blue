import * as path from 'node:path';
import * as dgram from 'node:dgram';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const SCRIPT_PATH = path.resolve(__dirname, '../../scripts/send-osc.mjs');

function runSendOsc(args: string[]): { status: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync(process.execPath, [SCRIPT_PATH, ...args], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { status: 0, stdout, stderr: '' };
  } catch (err: unknown) {
    const error = err as { status?: number; stdout?: string; stderr?: string };
    return {
      status: error.status ?? 1,
      stdout: error.stdout ?? '',
      stderr: error.stderr ?? '',
    };
  }
}

describe('send-osc.mjs CLI', () => {
  describe('help and listing without sending', () => {
    it('prints help with --help and exits successfully', () => {
      const res = runSendOsc(['--help']);
      expect(res.status).toBe(0);
      expect(res.stdout).toContain('Usage:');
      expect(res.stdout).toContain('--command');
      expect(res.stdout).toContain('--address');
      expect(res.stderr).toBe('');
    });

    it('prints help with short -h alias and exits successfully', () => {
      const res = runSendOsc(['-h']);
      expect(res.status).toBe(0);
      expect(res.stdout).toContain('Usage:');
      expect(res.stderr).toBe('');
    });

    it('ignores package-manager literal -- before options', () => {
      const res = runSendOsc(['--', '--help']);
      expect(res.status).toBe(0);
      expect(res.stdout).toContain('Usage:');
      expect(res.stderr).toBe('');
    });

    it('lists registered commands with --list and exits successfully', () => {
      const res = runSendOsc(['--list']);
      expect(res.status).toBe(0);
      expect(res.stdout).toContain('score.play');
      expect(res.stdout).toContain('/score/play');
      expect(res.stderr).toBe('');
    });
  });

  describe('validation and failure before sending', () => {
    it('fails when neither --command nor --address is specified', () => {
      const res = runSendOsc([]);
      expect(res.status).toBe(1);
      expect(res.stderr).toContain('Specify --command or --address.');
      expect(res.stderr).toContain('Usage:');
    });

    it('fails when both --command and --address are specified', () => {
      const res = runSendOsc(['--command', 'score.play', '--address', '/test']);
      expect(res.status).toBe(1);
      expect(res.stderr).toContain('Use either --command or --address, not both.');
      expect(res.stderr).toContain('Usage:');
    });

    it('fails when unknown command ID is provided', () => {
      const res = runSendOsc(['--command', 'unknown.command.id']);
      expect(res.status).toBe(1);
      expect(res.stderr).toContain('Unknown command ID: unknown.command.id');
      expect(res.stderr).toContain('Usage:');
    });

    it('fails when address does not start with /', () => {
      const res = runSendOsc(['--address', 'score/play']);
      expect(res.status).toBe(1);
      expect(res.stderr).toContain('--address must start with /.');
      expect(res.stderr).toContain('Usage:');
    });

    it('fails on invalid port values', () => {
      const resOutOfRange = runSendOsc(['--command', 'score.play', '--port', '70000']);
      expect(resOutOfRange.status).toBe(1);
      expect(resOutOfRange.stderr).toContain('--port must be a whole number from 1 through 65535.');

      const resNaN = runSendOsc(['--command', 'score.play', '--port', 'not-a-number']);
      expect(resNaN.status).toBe(1);
      expect(resNaN.stderr).toContain('--port must be a whole number from 1 through 65535.');
    });

    it('fails on unknown options', () => {
      const res = runSendOsc(['--unknown-flag']);
      expect(res.status).toBe(1);
      expect(res.stderr).toContain('Usage:');
    });

    it('fails when an option requiring a value is missing its value', () => {
      const res = runSendOsc(['--command']);
      expect(res.status).toBe(1);
      expect(res.stderr).toContain('Usage:');
    });
  });

  describe('successful send dispatch', () => {
    it('sends registered command to UDP receiver with default host and custom port', async () => {
      const server = dgram.createSocket('udp4');
      const received: Buffer[] = [];
      server.on('message', (msg) => received.push(msg));

      await new Promise<void>((resolve) => server.bind(0, '127.0.0.1', () => resolve()));
      const port = server.address().port;

      try {
        const res = runSendOsc(['--', '--command', 'score.play', '--port', String(port)]);
        expect(res.status).toBe(0);
        expect(res.stdout).toContain(`Sent /score/play to 127.0.0.1:${port}.`);
        await new Promise((r) => setTimeout(r, 50));
        expect(received.length).toBeGreaterThan(0);
      } finally {
        server.close();
      }
    });

    it('supports inline value syntax --port=9000 and custom address', async () => {
      const server = dgram.createSocket('udp4');
      const received: Buffer[] = [];
      server.on('message', (msg) => received.push(msg));

      await new Promise<void>((resolve) => server.bind(0, '127.0.0.1', () => resolve()));
      const port = server.address().port;

      try {
        const res = runSendOsc(['--address', '/custom/test', `--port=${port}`]);
        expect(res.status).toBe(0);
        expect(res.stdout).toContain(`Sent /custom/test to 127.0.0.1:${port}.`);
        await new Promise((r) => setTimeout(r, 50));
        expect(received.length).toBeGreaterThan(0);
      } finally {
        server.close();
      }
    });

    it('dispatches to custom --host and supports --host=value syntax', async () => {
      const server = dgram.createSocket('udp4');
      const received: Buffer[] = [];
      server.on('message', (msg) => received.push(msg));

      await new Promise<void>((resolve) => server.bind(0, '127.0.0.1', () => resolve()));
      const port = server.address().port;

      try {
        const res1 = runSendOsc([
          '--command',
          'score.play',
          '--host',
          '127.0.0.1',
          '--port',
          String(port),
        ]);
        expect(res1.status).toBe(0);
        expect(res1.stdout).toContain(`Sent /score/play to 127.0.0.1:${port}.`);

        const res2 = runSendOsc([
          '--address',
          '/custom/host-test',
          '--host=127.0.0.1',
          `--port=${port}`,
        ]);
        expect(res2.status).toBe(0);
        expect(res2.stdout).toContain(`Sent /custom/host-test to 127.0.0.1:${port}.`);

        await new Promise((r) => setTimeout(r, 50));
        expect(received.length).toBe(2);
      } finally {
        server.close();
      }
    });
  });

  describe('UDP-receiver verification: no network send on invalid/help/list invocations', () => {
    it('sends no UDP message when invocations are malformed or informational', async () => {
      const server = dgram.createSocket('udp4');
      const received: Buffer[] = [];
      server.on('message', (msg) => received.push(msg));

      await new Promise<void>((resolve) => server.bind(0, '127.0.0.1', () => resolve()));
      const port = server.address().port;

      try {
        const invalidInvocations = [
          ['--port', String(port)],
          ['--command', 'score.play', '--address', '/test', '--port', String(port)],
          ['--command', 'unknown.cmd', '--port', String(port)],
          ['--address', 'invalid/no-slash', '--port', String(port)],
          ['--unknown-flag', '--port', String(port)],
          ['--command', '--port', String(port)],
          ['--help', '--port', String(port)],
          ['--list', '--port', String(port)],
        ];

        for (const args of invalidInvocations) {
          runSendOsc(args);
        }

        await new Promise((r) => setTimeout(r, 100));
        expect(received).toHaveLength(0);
      } finally {
        server.close();
      }
    });
  });
});
