import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { readProjectXml } from '../../src/blue-data/xml-policy';

const repositoryRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const exampleDirectories = ['examples', 'packages/blue-app/assets/examples'];

// Read the existing corpus in place; its licenses remain in each directory's notices.
// Loading candidates does not execute project scripts or initialize audio runtimes.
describe.each(exampleDirectories)('Example projects: %s', (directory) => {
  const root = path.join(repositoryRoot, directory);
  const files = fs
    .readdirSync(root, { recursive: true })
    .filter((file) => file.endsWith('.blue'))
    .sort();

  it('contains project files', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('loads and canonically reopens %s without changing its source', (file) => {
    const nativePath = path.join(root, file);
    const original = fs.readFileSync(nativePath);
    const source = { kind: 'project' as const, label: path.join(directory, file), nativePath };
    const result = readProjectXml(original.toString('utf8'), source);

    expect(fs.readFileSync(nativePath)).toEqual(original);
    expect(result.ok, JSON.stringify(result.diagnostics, null, 2)).toBe(true);
    if (!result.ok) return;

    const canonical = result.value.saveToString();
    const historyCopyXml = result.value.historyCopy().saveToString();
    expect(historyCopyXml).toBe(canonical);
    const reopened = readProjectXml(canonical, source);
    expect(reopened.ok, JSON.stringify(reopened.diagnostics, null, 2)).toBe(true);
    if (!reopened.ok) return;

    expect(reopened.value.saveToString()).toBe(canonical);
    expect(fs.readFileSync(nativePath)).toEqual(original);
  });
});
