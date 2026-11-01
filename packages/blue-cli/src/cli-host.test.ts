import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { BlueData } from '@blue/data';

const binary = path.resolve('dist/blue-cli.cjs');
const directories: string[] = [];
function fixture(data = new BlueData()) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'blue-cli-host-'));
  directories.push(directory);
  const project = path.join(directory, 'project.blue');
  const output = path.join(directory, 'project.csd');
  fs.writeFileSync(project, data.saveToString());
  return { directory, project, output };
}
afterEach(() => {
  for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true });
});
describe('CLI host preparation', () => {
  it('protects the project from direct, symbolic-link and hard-link output aliases', () => {
    const { project, directory } = fixture();
    const source = fs.readFileSync(project, 'utf8');
    const hard = path.join(directory, 'hard.csd');
    const symbolic = path.join(directory, 'symbolic.csd');
    fs.linkSync(project, hard);
    fs.symlinkSync(project, symbolic);
    for (const output of [project, hard, symbolic]) {
      const result = spawnSync(process.execPath, [binary, 'compile', '-p', project, '-o', output], {
        encoding: 'utf8',
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('different file');
      expect(fs.readFileSync(project, 'utf8')).toBe(source);
    }
  });
});
