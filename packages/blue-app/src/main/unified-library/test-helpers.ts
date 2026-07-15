import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export interface UnifiedLibraryTestDirectory {
  readonly directory: string;
  readonly databasePath: string;
  readonly statePath: string;
  cleanup(): void;
}

export function createUnifiedLibraryTestDirectory(
  prefix = 'blue-unified-library-test-',
): UnifiedLibraryTestDirectory {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));

  return {
    directory,
    databasePath: path.join(directory, 'blue_libraries.sqlite'),
    statePath: path.join(directory, 'blue-libraries-state.json'),
    cleanup(): void {
      fs.rmSync(directory, { force: true, recursive: true });
    },
  };
}

export function writeFixtureFile(
  directory: string,
  fileName: string,
  contents: string,
): string {
  const filePath = path.join(directory, fileName);
  fs.writeFileSync(filePath, contents, 'utf8');
  return filePath;
}
