import type { JavaBlueBsbReplacementKey } from '../../editors/editor-adapter-types';

export function createBsbReplacementKeys(objectNames: string[]): JavaBlueBsbReplacementKey[] {
  return objectNames.map((key) => ({
    key,
    objectType: 'BSB object',
  }));
}
