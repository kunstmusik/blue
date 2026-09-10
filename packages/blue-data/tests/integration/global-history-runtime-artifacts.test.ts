import { describe, expect, it } from 'vitest';
import { createHistoryFixtureProject } from '../../src/test-support/java-parity-fixtures';

/**
 * US3 runtime artifacts: undo and redo must keep the generated CSD artifact
 * consistent with the canonical document — a reversed live edit regenerates
 * the pre-edit CSD, restart-required content changes the CSD only while it is
 * present, and a retained memento reproduces identical artifacts every time
 * it is restored (no late divergent write into a later performance).
 */
describe('global history runtime artifacts (T040, US3)', () => {
  it('regenerates the pre-edit CSD after an undo of compiled content', () => {
    const project = createHistoryFixtureProject('score');
    const csdBefore = project.toDiskCSD();

    // Capture the retained history state BEFORE the live edit.
    const beforeMemento = project.historyCopy();

    // Live edit of compiled content changes the artifact.
    project.getGlobalOrcSco().setGlobalOrc('; live gain tweak\n');
    const csdAfterEdit = project.toDiskCSD();
    expect(csdAfterEdit).not.toBe(csdBefore);

    // Undo through the retained history state regenerates the original.
    const restored = beforeMemento.historyCopy();

    expect(restored.toDiskCSD()).toBe(csdBefore);
  });

  it('keeps restart-required artifacts consistent across repeated restores', () => {
    const project = createHistoryFixtureProject('score');
    project.getGlobalOrcSco().setGlobalOrc('sr = 48000');
    const csdAtRevision = project.toDiskCSD();

    const memento = project.historyCopy();
    // Multiple performance generations restore the same retained state; the
    // artifact must be deterministic and identical each time.
    const first = memento.historyCopy().toDiskCSD();
    const second = memento.historyCopy().toDiskCSD();
    expect(first).toBe(csdAtRevision);
    expect(second).toBe(csdAtRevision);
  });

  it('restores distinct compiled artifacts exactly across restore cycles', () => {
    const project = createHistoryFixtureProject('score');
    const beforeMemento = project.historyCopy();
    const base = project.toDiskCSD();

    // Compiled changes: distinct artifact per revision...
    project.getGlobalOrcSco().setGlobalSco('i 1 0 1 440 0.3');
    const changed = project.toDiskCSD();
    expect(changed).not.toBe(base);

    // ...and every restore of the retained state reproduces its own artifact
    // exactly, with no divergence between later performance generations.
    expect(beforeMemento.historyCopy().toDiskCSD()).toBe(base);
    expect(beforeMemento.historyCopy().toDiskCSD()).toBe(base);
    expect(project.historyCopy().toDiskCSD()).toBe(changed);
  });
});
