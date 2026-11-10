import { describe, it, expect } from 'vitest';
import { compactHistoryRuntimePatches } from './project-history-runtime-patches';
import { extractPatchRuntimeWork } from './project-runtime-reconciliation';
import { validateProjectDocumentPatch } from '../shared/project-editor';
describe('bounded history runtime hints', () => {
  it('drops code payloads while preserving exact restart owners', () => {
    const patches = [{ globalOrc: 'large code'.repeat(100000) }];
    const hints = compactHistoryRuntimePatches(patches);
    expect(JSON.stringify(hints).length).toBeLessThan(300);
    expect(extractPatchRuntimeWork(hints[0]!)).toEqual(extractPatchRuntimeWork(patches[0]!));
    expect(validateProjectDocumentPatch(hints[0]!).valid).toBe(false);
  });
  it('keeps latest values forward and earliest values backward per runtime target', () => {
    const patches = [0.2, 0.4, 0.9].map((level) => ({
      mixer: { type: 'updateChannel' as const, channelId: 'Master', patch: { level } },
    }));
    expect(compactHistoryRuntimePatches(patches)).toEqual([patches[2]]);
    expect(compactHistoryRuntimePatches(patches, 'first')).toEqual([patches[0]]);
  });
  it('keeps independent operations from overlapping composite patches', () => {
    const hints = compactHistoryRuntimePatches([
      { mixer: { type: 'updateChannel', channelId: 'Master', patch: { level: 0.2, pan: 0.4 } } },
      { mixer: { type: 'updateChannel', channelId: 'Master', patch: { level: 0.9 } } },
    ]);
    expect(hints.flatMap((hint) => extractPatchRuntimeWork(hint).operations)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ parameterId: 'level', value: 0.9 }),
        expect.objectContaining({ parameterId: 'pan', value: 0.4 }),
      ]),
    );
  });
  it('drops cosmetic payloads and deduplicates restart-only owners', () => {
    expect(
      compactHistoryRuntimePatches([{ scratchPad: { text: 'large cosmetic content' } }]),
    ).toEqual([]);
    expect(
      compactHistoryRuntimePatches(Array.from({ length: 100 }, () => ({ globalOrc: 'code' }))),
    ).toHaveLength(1);
  });
});
