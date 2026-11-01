import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import type { ExternalCommandExecutor } from '@blue/data';

function quoteFilename(filename: string): string {
  return process.platform === 'win32'
    ? "'" + filename.replaceAll("'", "''") + "'"
    : "'" + filename.replaceAll("'", "'\\''") + "'";
}

/** Each compilation owns its command failures, including errors caught by External. */
export class CliExternalCommands implements ExternalCommandExecutor {
  failure: Error | undefined;

  constructor(private readonly projectDirectory: string) {}

  execute(commandLine: string, text: string): string {
    try {
      return this.run(commandLine, text);
    } catch (error) {
      this.failure = new Error('External score generation failed: ' + String(error));
      throw this.failure;
    }
  }

  private run(commandLine: string, text: string): string {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'blue-score-'));
    try {
      const input = path.join(directory, 'input.txt');
      const output = path.join(directory, 'output.sco');
      fs.writeFileSync(input, text);
      const useOutput = commandLine.includes('$outfile');
      const command = (commandLine.includes('$infile') ? commandLine : commandLine + ' $infile')
        .replaceAll('$infile', quoteFilename(input))
        .replaceAll('$outfile', quoteFilename(output));
      const stdout = execSync(command, {
        cwd: this.projectDirectory,
        encoding: 'utf8',
        timeout: 30_000,
        maxBuffer: 1024 * 1024,
        ...(process.platform === 'win32' ? { shell: 'powershell.exe' } : {}),
      });
      return useOutput ? fs.readFileSync(output, 'utf8') : stdout;
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }
}
