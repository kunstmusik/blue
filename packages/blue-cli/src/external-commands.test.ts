import fs from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import { CliExternalCommands } from './external-commands';

afterEach(() => vi.restoreAllMocks());

it('records setup errors so External cannot hide them as an empty score', () => {
  vi.spyOn(fs, 'mkdtempSync').mockImplementation(() => {
    throw new Error('synthetic permission failure');
  });
  const commands = new CliExternalCommands(process.cwd());
  expect(() => commands.execute('generator', '')).toThrow('synthetic permission failure');
  expect(commands.failure?.message).toContain('synthetic permission failure');
});
