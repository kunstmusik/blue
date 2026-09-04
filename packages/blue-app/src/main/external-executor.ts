import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { ExternalCommandExecutor } from '@blue/data';
import {
  prepareCommandLine,
  shouldUseOutFile,
  type ExternalTestRequest,
  type ExternalTestResult,
} from '../shared/external-executor';

export function executeExternalTestSync(request: ExternalTestRequest): ExternalTestResult {
  const { commandLine, text, projectDir } = request;

  if (commandLine.trim().length === 0 && text.trim().length === 0) {
    return { ok: false, output: '', error: 'No command line or text to execute.' };
  }

  const tmpDirBase = projectDir ?? os.tmpdir();

  let workDir: string;
  try {
    workDir = fs.mkdtempSync(path.join(tmpDirBase, 'blue-ext-'));
  } catch (err) {
    return {
      ok: false,
      output: '',
      error: `Failed to create temp dir: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  try {
    const inFile = path.join(workDir, 'input.txt');
    fs.writeFileSync(inFile, text);

    const useOutFile = shouldUseOutFile(commandLine);
    let outFile: string | undefined;
    if (useOutFile) {
      outFile = path.join(workDir, 'output.sco');
      fs.writeFileSync(outFile, '');
    }

    const preparedCmd = prepareCommandLine(commandLine, inFile, outFile);

    try {
      const output = runCommandSync(preparedCmd, workDir);
      let result: string;
      if (useOutFile && outFile) {
        try {
          result = fs.readFileSync(outFile, 'utf-8');
        } catch {
          result = output;
        }
      } else {
        result = output;
      }
      return { ok: true, output: result };
    } catch (err) {
      return {
        ok: false,
        output: '',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  } finally {
    try {
      fs.rmSync(workDir, { recursive: true });
    } catch {
      /* ignore */
    }
  }
}

function runCommandSync(commandLine: string, cwd: string): string {
  const isWindows = process.platform === 'win32';
  const cmd = isWindows ? 'powershell.exe' : '/bin/sh';
  const cmdArgs = isWindows ? ['-NoProfile', '-Command', commandLine] : ['-c', commandLine];

  return execFileSync(cmd, cmdArgs, {
    cwd,
    timeout: 30000,
    maxBuffer: 1024 * 1024,
    encoding: 'utf-8',
  });
}

export async function executeExternalTest(
  request: ExternalTestRequest,
): Promise<ExternalTestResult> {
  return executeExternalTestSync(request);
}

export function createMainExternalExecutor(
  getProjectDir: () => string | null,
): ExternalCommandExecutor {
  return {
    execute(commandLine: string, textBody: string, _projectDir: string | null): string {
      const projectDir = getProjectDir();
      const result = executeExternalTestSync({ commandLine, text: textBody, projectDir });
      if (!result.ok) {
        throw new Error(result.error ?? 'External command failed');
      }
      return result.output;
    },
  };
}
