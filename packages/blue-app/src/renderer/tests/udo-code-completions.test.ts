import { EditorState } from '@codemirror/state';
import { CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
import { describe, expect, it } from 'vitest';

import { createJavaBlueCsoundCompletionSource } from '../components/workbench/panels/editors/csound-java-blue-completions';
import type { JavaBlueUdoCompletionDefinition } from '../components/workbench/panels/editors/editor-adapter-types';

function udo(
  name: string,
  partial: Partial<JavaBlueUdoCompletionDefinition> = {},
): JavaBlueUdoCompletionDefinition {
  return {
    name,
    style: 'CLASSIC',
    outTypes: 'a',
    inTypes: 'a',
    inputArguments: '',
    ...partial,
  };
}

function complete(
  doc: string,
  options: {
    contextUdos?: JavaBlueUdoCompletionDefinition[];
    projectUdos?: JavaBlueUdoCompletionDefinition[];
  },
  explicit = true,
): CompletionResult | null {
  const source = createJavaBlueCsoundCompletionSource(options);
  const state = EditorState.create({ doc });
  const context = new CompletionContext(state, state.doc.length, explicit);
  const result = source(context);
  if (result instanceof Promise) {
    throw new Error('Java Blue completion source should be synchronous');
  }
  return result;
}

describe('Java Blue UDO completion adapter', () => {
  describe('signature-bearing context and project definitions', () => {
    it('offers context-owned UDOs and project-global UDOs together', () => {
      const result = complete('', {
        contextUdos: [udo('ContextUDO', { inTypes: 'k', outTypes: 'a' })],
        projectUdos: [udo('ProjectUDO', { inTypes: 'a', outTypes: 'a' })],
      });
      const labels = result?.options.map((c) => c.label) ?? [];
      expect(labels).toContain('ContextUDO');
      expect(labels).toContain('ProjectUDO');
    });

    it('shows visible signature and source metadata on each UDO row', () => {
      const result = complete('', {
        contextUdos: [udo('Ctx', { inTypes: 'k', outTypes: 'a' })],
        projectUdos: [udo('Proj', { inTypes: 'a,a', outTypes: 'a' })],
      });
      const ctx = result?.options.find((c) => c.label === 'Ctx');
      const proj = result?.options.find((c) => c.label === 'Proj');
      expect(ctx).toMatchObject({
        label: 'Ctx',
        displayLabel: 'Ctx (k) → a',
        detail: 'context UDO',
        type: 'function',
      });
      expect(proj).toMatchObject({
        label: 'Proj',
        displayLabel: 'Proj (a, a) → a',
        detail: 'project UDO',
        type: 'function',
      });
    });

    it('inserts only the authored UDO name when a completion is applied', () => {
      const result = complete('MultiSig', {
        contextUdos: [udo('MultiSig', { inTypes: 'k', outTypes: 'a' })],
      });
      const overload = result?.options.find((c) => c.label === 'MultiSig');
      expect(overload?.apply).toBe('MultiSig');
    });

    it('creates document-local UDO candidates from the active editor text', () => {
      const result = complete('opcode DocUDO, a, kk\nendop\nDoc', {
        contextUdos: [],
        projectUdos: [],
      });
      const doc = result?.options.find((c) => c.label === 'DocUDO');
      expect(doc).toMatchObject({
        label: 'DocUDO',
        detail: 'document UDO',
        displayLabel: 'DocUDO (k, k) → a',
      });
    });

    it('marks an in-progress document-local declaration as incomplete', () => {
      const result = complete('opcode Draft\nDra', {});
      const draft = result?.options.find((c) => c.label === 'Draft');
      expect(draft).toMatchObject({
        label: 'Draft',
        detail: 'document UDO',
      });
      expect(draft?.displayLabel).toContain('incomplete');
    });

    it('keeps a same-name incomplete document declaration beside a parsed complete overload', () => {
      const result = complete(
        'opcode Poly, a, k\nendop\nopcode Poly\nPoly',
        {},
      );
      const rows = result?.options.filter((c) => c.label === 'Poly') ?? [];
      expect(rows).toHaveLength(2);
      expect(rows.some((c) => c.displayLabel === 'Poly (k) → a')).toBe(true);
      expect(rows.some((c) => c.displayLabel?.includes('incomplete'))).toBe(true);
    });
  });

  describe('preservation of existing non-UDO categories', () => {
    it('keeps native opcode rows alongside a same-name UDO', () => {
      const result = complete('oscil', {
        contextUdos: [udo('oscil', { inTypes: 'a', outTypes: 'a' })],
      });
      const rows = result?.options.filter((c) => c.label === 'oscil') ?? [];
      expect(rows.length).toBe(2);
      const udoRow = rows.find((c) => c.detail === 'context UDO');
      const nativeRow = rows.find((c) => c.detail === 'opcode');
      expect(udoRow).toBeDefined();
      expect(nativeRow).toBeDefined();
      expect(udoRow?.displayLabel).toBe('oscil (a) → a');
    });

    it('keeps Blue opcode rows (blueMixerOut) when UDO context is supplied', () => {
      const result = complete('blueMixer', {
        contextUdos: [udo('OtherUDO')],
      });
      expect(result?.options.some((c) => c.label === 'blueMixerOut')).toBe(true);
    });

    it('keeps document-local Csound variable rows', () => {
      const result = complete('asig = oscil\nas', {
        contextUdos: [udo('asigRelated', { inTypes: 'a' })],
      });
      const variable = result?.options.find(
        (c) => c.label === 'asig' && c.detail === 'variable',
      );
      expect(variable).toBeDefined();
    });
  });

  describe('polymorphic overloads and precedence (US3)', () => {
    it('keeps same-name UDOs with different input signatures as separate rows', () => {
      const result = complete('Poly', {
        contextUdos: [
          udo('Poly', { inTypes: 'k', outTypes: 'a' }),
          udo('Poly', { inTypes: 'a', outTypes: 'a' }),
        ],
      });
      const polyRows = result?.options.filter((c) => c.label === 'Poly') ?? [];
      expect(polyRows.length).toBe(2);
      const signatures = polyRows.map((c) => c.displayLabel).sort();
      expect(signatures).toEqual(['Poly (a) → a', 'Poly (k) → a']);
    });

    it('keeps same-name UDOs with different output signatures as separate rows', () => {
      const result = complete('Poly', {
        contextUdos: [
          udo('Poly', { inTypes: 'k', outTypes: 'a' }),
          udo('Poly', { inTypes: 'k', outTypes: 'k' }),
        ],
      });
      const polyRows = result?.options.filter((c) => c.label === 'Poly') ?? [];
      expect(polyRows.length).toBe(2);
      expect(polyRows.some((c) => c.displayLabel === 'Poly (k) → a')).toBe(true);
      expect(polyRows.some((c) => c.displayLabel === 'Poly (k) → k')).toBe(true);
    });

    it('treats equivalent classic and modern declarations as one overload', () => {
      const result = complete('Equiv', {
        contextUdos: [
          udo('Equiv', { style: 'CLASSIC', inTypes: 'ak', outTypes: 'a', inputArguments: '' }),
          udo('Equiv', {
            style: 'MODERN',
            inTypes: '',
            outTypes: 'a',
            inputArguments: 'aSig, kFreq',
          }),
        ],
      });
      const equivRows = result?.options.filter((c) => c.label === 'Equiv') ?? [];
      expect(equivRows.length).toBe(1);
    });

    it('shadows an exact context/project duplicate with the context-owned overload only', () => {
      const result = complete('Shadow', {
        contextUdos: [udo('Shadow', { inTypes: 'k', outTypes: 'a' })],
        projectUdos: [udo('Shadow', { inTypes: 'k', outTypes: 'a' })],
      });
      const shadowRows = result?.options.filter((c) => c.label === 'Shadow') ?? [];
      expect(shadowRows.length).toBe(1);
      expect(shadowRows[0]?.detail).toBe('context UDO');
    });

    it('keeps distinct same-name overloads across context and project sources', () => {
      const result = complete('Mix', {
        contextUdos: [udo('Mix', { inTypes: 'k', outTypes: 'a' })],
        projectUdos: [udo('Mix', { inTypes: 'a', outTypes: 'a' })],
      });
      const mixRows = result?.options.filter((c) => c.label === 'Mix') ?? [];
      expect(mixRows.length).toBe(2);
      const details = mixRows.map((c) => c.detail).sort();
      expect(details).toEqual(['context UDO', 'project UDO']);
    });

    it('deduplicates an exact identity repeated within one source', () => {
      const result = complete('Dup', {
        contextUdos: [
          udo('Dup', { inTypes: 'k', outTypes: 'a' }),
          udo('Dup', { inTypes: 'k', outTypes: 'a' }),
        ],
      });
      const dupRows = result?.options.filter((c) => c.label === 'Dup') ?? [];
      expect(dupRows.length).toBe(1);
    });

    it('resolves exact duplicates by source precedence: context > project > document', () => {
      const docResult = complete('opcode P, a, a\nendop\nP', {
        contextUdos: [udo('P', { inTypes: 'a', outTypes: 'a' })],
        projectUdos: [udo('P', { inTypes: 'a', outTypes: 'a' })],
      });
      const pRows = docResult?.options.filter((c) => c.label === 'P') ?? [];
      expect(pRows.length).toBe(1);
      expect(pRows[0]?.detail).toBe('context UDO');
    });

    it('keeps a same-name native opcode alongside UDO overloads', () => {
      const result = complete('oscil', {
        contextUdos: [udo('oscil', { inTypes: 'a', outTypes: 'a' })],
      });
      const oscilRows = result?.options.filter((c) => c.label === 'oscil') ?? [];
      expect(oscilRows.length).toBe(2);
      expect(oscilRows.some((c) => c.detail === 'context UDO')).toBe(true);
      expect(oscilRows.some((c) => c.detail === 'opcode')).toBe(true);
    });

    it('applies only the authored UDO name when an overload is selected', () => {
      const result = complete('Poly', {
        contextUdos: [
          udo('Poly', { inTypes: 'k', outTypes: 'a' }),
          udo('Poly', { inTypes: 'a', outTypes: 'a' }),
        ],
      });
      const polyRows = result?.options.filter((c) => c.label === 'Poly') ?? [];
      for (const row of polyRows) {
        expect(row.apply).toBe('Poly');
      }
    });

    it('keeps an incomplete signature distinct from complete overloads', () => {
      const result = complete('Inc', {
        contextUdos: [
          udo('Inc', { style: 'MODERN', inTypes: '', outTypes: 'a', inputArguments: 'aSig, bad' }),
          udo('Inc', { style: 'MODERN', inTypes: '', outTypes: 'a', inputArguments: 'aSig' }),
        ],
      });
      const incRows = result?.options.filter((c) => c.label === 'Inc') ?? [];
      expect(incRows.length).toBe(2);
      expect(incRows.some((c) => c.displayLabel?.includes('incomplete'))).toBe(true);
    });
  });

  describe('live completion refresh (US4, T025)', () => {
    it('reflects an added UDO on the next completion request', () => {
      const before = complete('Added', { contextUdos: [] });
      // No UDO named Added exists yet, so it is absent (the result may be null
      // when nothing else prefix-matches 'Added').
      expect(before?.options.some((c) => c.label === 'Added') ?? false).toBe(false);

      const after = complete('Added', {
        contextUdos: [udo('Added', { inTypes: 'k', outTypes: 'a' })],
      });
      expect(after?.options.some((c) => c.label === 'Added')).toBe(true);
    });

    it('reflects a renamed UDO and drops the old name', () => {
      const before = complete('Old', {
        contextUdos: [udo('Old', { inTypes: 'k', outTypes: 'a' })],
      });
      expect(before?.options.some((c) => c.label === 'Old')).toBe(true);

      const after = complete('New', {
        contextUdos: [udo('New', { inTypes: 'k', outTypes: 'a' })],
      });
      expect(after?.options.some((c) => c.label === 'New')).toBe(true);
      expect(after?.options.some((c) => c.label === 'Old')).toBe(false);
    });

    it('reflects a removed UDO', () => {
      const after = complete('Gone', { contextUdos: [] });
      expect(after?.options.some((c) => c.label === 'Gone') ?? false).toBe(false);
    });

    it('preserves an overload across a style conversion that keeps the callable signature', () => {
      const classic = complete('Conv', {
        contextUdos: [udo('Conv', { style: 'CLASSIC', inTypes: 'ak', outTypes: 'a', inputArguments: '' })],
      });
      const modern = complete('Conv', {
        contextUdos: [
          udo('Conv', { style: 'MODERN', inTypes: '', outTypes: 'a', inputArguments: 'aSig, kFreq' }),
        ],
      });
      expect(classic?.options.filter((c) => c.label === 'Conv').length).toBe(1);
      // The converted declaration normalizes to the same callable signature,
      // so the overload count does not double.
      expect(modern?.options.filter((c) => c.label === 'Conv').length).toBe(1);
    });

    it('restores a shadowed project overload once the shadowing context UDO is removed', () => {
      const shadowed = complete('Sh', {
        contextUdos: [udo('Sh', { inTypes: 'k', outTypes: 'a' })],
        projectUdos: [udo('Sh', { inTypes: 'k', outTypes: 'a' })],
      });
      expect(shadowed?.options.filter((c) => c.label === 'Sh').length).toBe(1);
      expect(shadowed?.options.find((c) => c.label === 'Sh')?.detail).toBe('context UDO');

      const restored = complete('Sh', {
        contextUdos: [],
        projectUdos: [udo('Sh', { inTypes: 'k', outTypes: 'a' })],
      });
      expect(restored?.options.filter((c) => c.label === 'Sh').length).toBe(1);
      expect(restored?.options.find((c) => c.label === 'Sh')?.detail).toBe('project UDO');
    });

    it('keeps working when no UDOs are available and preserves existing completions', () => {
      const result = complete('oscil', { contextUdos: [], projectUdos: [] });
      expect(result?.options.some((c) => c.label === 'oscil' && c.detail === 'opcode')).toBe(true);
      expect(result?.options.some((c) => c.detail === 'context UDO')).toBe(false);
    });
  });

  describe('completion construction performance (US3, T024)', () => {
    it('keeps p95 completion construction below 100 ms for 500 project and 100 context UDOs', () => {
      const projectUdos: JavaBlueUdoCompletionDefinition[] = Array.from(
        { length: 500 },
        (_, i) => udo(`ProjUDO${i}`, { inTypes: i % 2 === 0 ? 'a' : 'k', outTypes: 'a' }),
      );
      const contextUdos: JavaBlueUdoCompletionDefinition[] = Array.from(
        { length: 100 },
        (_, i) => udo(`CtxUDO${i}`, { inTypes: 'k', outTypes: 'a' }),
      );
      const source = createJavaBlueCsoundCompletionSource({ contextUdos, projectUdos });

      // Warm-up pass (not measured) so JIT/cache effects do not skew p95.
      for (let i = 0; i < 5; i++) {
        const state = EditorState.create({ doc: 'Ctx' });
        const ctx = new CompletionContext(state, state.doc.length, true);
        source(ctx);
      }

      const samples: number[] = [];
      for (let i = 0; i < 40; i++) {
        const state = EditorState.create({ doc: 'Ctx' });
        const ctx = new CompletionContext(state, state.doc.length, true);
        const start = performance.now();
        source(ctx);
        samples.push(performance.now() - start);
      }
      samples.sort((a, b) => a - b);
      const p95 = samples[Math.floor(samples.length * 0.95) - 1] ?? samples[samples.length - 1]!;

      // SC-005: p95 below 100 ms on supported development hardware.
      expect(p95).toBeLessThan(100);
    });
  });
});
