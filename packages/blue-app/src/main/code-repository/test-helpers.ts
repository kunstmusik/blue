import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export interface CodeRepositoryTestDirectory {
  readonly directory: string;
  readonly databasePath: string;
  readonly statePath: string;
  cleanup(): void;
}

export function createCodeRepositoryTestDirectory(
  prefix = 'blue-code-repository-test-',
): CodeRepositoryTestDirectory {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  return {
    directory,
    databasePath: path.join(directory, 'blue_code_repository.sqlite'),
    statePath: path.join(directory, 'blue-code-repository-state.json'),
    cleanup(): void {
      fs.rmSync(directory, { force: true, recursive: true });
    },
  };
}
