import { describe, expect, it } from 'vitest';

import { normalizeUdoCallableSignature } from './udo-type-utils';

describe('normalizeUdoCallableSignature', () => {
  // ─── Classic input normalization ───

  it('normalizes classic joined input types into ordered tokens', () => {
    const sig = normalizeUdoCallableSignature({
      name: 'Classic',
      style: 'CLASSIC',
      outTypes: 'a',
      inTypes: 'ak',
      inputArguments: '',
    });
    expect(sig.inputTypes).toEqual(['a', 'k']);
    expect(sig.outputTypes).toEqual(['a']);
    expect(sig.complete).toBe(true);
  });

  it('normalizes classic comma-separated input types into ordered tokens', () => {
    const joined = normalizeUdoCallableSignature({
      name: 'C',
      style: 'CLASSIC',
      outTypes: 'a',
      inTypes: 'ak',
      inputArguments: '',
    });
    const comma = normalizeUdoCallableSignature({
      name: 'C',
      style: 'CLASSIC',
      outTypes: 'a',
      inTypes: 'a, k',
      inputArguments: '',
    });
    expect(comma.inputTypes).toEqual(joined.inputTypes);
    expect(comma.key).toBe(joined.key);
  });

  it('treats classic grouped and whitespace-separated inputs as equivalent', () => {
    const baseline = normalizeUdoCallableSignature({
      name: 'C',
      style: 'CLASSIC',
      outTypes: 'a',
      inTypes: 'ak',
      inputArguments: '',
    });
    const spaced = normalizeUdoCallableSignature({
      name: 'C',
      style: 'CLASSIC',
      outTypes: 'a',
      inTypes: 'a k',
      inputArguments: '',
    });
    const grouped = normalizeUdoCallableSignature({
      name: 'C',
      style: 'CLASSIC',
      outTypes: 'a',
      inTypes: '(a, k)',
      inputArguments: '',
    });
    expect(spaced.key).toBe(baseline.key);
    expect(grouped.key).toBe(baseline.key);
  });

  it('preserves classic input token order so different orders stay distinct', () => {
    const ak = normalizeUdoCallableSignature({
      name: 'C',
      style: 'CLASSIC',
      outTypes: 'a',
      inTypes: 'ak',
      inputArguments: '',
    });
    const ka = normalizeUdoCallableSignature({
      name: 'C',
      style: 'CLASSIC',
      outTypes: 'a',
      inTypes: 'ka',
      inputArguments: '',
    });
    expect(ak.inputTypes).toEqual(['a', 'k']);
    expect(ka.inputTypes).toEqual(['k', 'a']);
    expect(ak.key).not.toBe(ka.key);
  });

  it('normalizes classic no-input to an empty input list', () => {
    const sig = normalizeUdoCallableSignature({
      name: 'C',
      style: 'CLASSIC',
      outTypes: 'a',
      inTypes: '0',
      inputArguments: '',
    });
    expect(sig.inputTypes).toEqual([]);
    expect(sig.complete).toBe(true);
  });

  // ─── Output normalization ───

  it('normalizes classic no-output ("0"/"void"/"") to an empty output list', () => {
    for (const out of ['0', 'void', '']) {
      const sig = normalizeUdoCallableSignature({
        name: 'C',
        style: 'CLASSIC',
        outTypes: out,
        inTypes: 'a',
        inputArguments: '',
      });
      expect(sig.outputTypes).toEqual([]);
      expect(sig.complete).toBe(true);
    }
  });

  it('normalizes modern no-output ("0"/"void"/"()"/"") to an empty output list', () => {
    for (const out of ['0', 'void', '()', '']) {
      const sig = normalizeUdoCallableSignature({
        name: 'M',
        style: 'MODERN',
        outTypes: out,
        inTypes: '',
        inputArguments: 'aSig',
      });
      expect(sig.outputTypes).toEqual([]);
      expect(sig.complete).toBe(true);
    }
  });

  it('treats classic and modern equivalent output declarations as equivalent', () => {
    const classic = normalizeUdoCallableSignature({
      name: 'X',
      style: 'CLASSIC',
      outTypes: 'ak',
      inTypes: 'a',
      inputArguments: '',
    });
    const modern = normalizeUdoCallableSignature({
      name: 'X',
      style: 'MODERN',
      outTypes: 'a, k',
      inTypes: '',
      inputArguments: 'aSig',
    });
    expect(classic.outputTypes).toEqual(['a', 'k']);
    expect(modern.outputTypes).toEqual(['a', 'k']);
    expect(classic.key).toBe(modern.key);
  });

  it('keeps distinct output signatures separate', () => {
    const single = normalizeUdoCallableSignature({
      name: 'X',
      style: 'CLASSIC',
      outTypes: 'a',
      inTypes: 'a',
      inputArguments: '',
    });
    const multi = normalizeUdoCallableSignature({
      name: 'X',
      style: 'CLASSIC',
      outTypes: 'ak',
      inTypes: 'a',
      inputArguments: '',
    });
    expect(single.outputTypes).toEqual(['a']);
    expect(multi.outputTypes).toEqual(['a', 'k']);
    expect(single.key).not.toBe(multi.key);
  });

  // ─── Modern input normalization ───

  it('infers modern input types from variable-name rate prefixes', () => {
    const sig = normalizeUdoCallableSignature({
      name: 'M',
      style: 'MODERN',
      outTypes: 'a',
      inTypes: '',
      inputArguments: 'aSig, kFreq',
    });
    expect(sig.inputTypes).toEqual(['a', 'k']);
    expect(sig.complete).toBe(true);
  });

  it('uses explicit modern type annotations over inferred rate notation', () => {
    const inferred = normalizeUdoCallableSignature({
      name: 'M',
      style: 'MODERN',
      outTypes: 'a',
      inTypes: '',
      inputArguments: 'kSig:a',
    });
    const plain = normalizeUdoCallableSignature({
      name: 'M',
      style: 'MODERN',
      outTypes: 'a',
      inTypes: '',
      inputArguments: 'aSig',
    });
    expect(inferred.inputTypes).toEqual(['a']);
    expect(inferred.key).toBe(plain.key);
  });

  it('ignores modern argument variable names and default values when deriving types', () => {
    const withNames = normalizeUdoCallableSignature({
      name: 'M',
      style: 'MODERN',
      outTypes: 'a',
      inTypes: '',
      inputArguments: 'aLeft, aRight',
    });
    const withDefaults = normalizeUdoCallableSignature({
      name: 'M',
      style: 'MODERN',
      outTypes: 'a',
      inTypes: '',
      inputArguments: 'aLeft=0, aRight=0',
    });
    expect(withDefaults.inputTypes).toEqual(['a', 'a']);
    expect(withDefaults.key).toBe(withNames.key);
  });

  it('supports explicit modern type annotations with array modifiers', () => {
    const sig = normalizeUdoCallableSignature({
      name: 'M',
      style: 'MODERN',
      outTypes: 'a',
      inTypes: '',
      inputArguments: 'kArr:k[], aSig',
    });
    expect(sig.inputTypes).toEqual(['k[]', 'a']);
    expect(sig.complete).toBe(true);
  });

  it('treats modern inferred array notation as a distinct modifier', () => {
    const scalar = normalizeUdoCallableSignature({
      name: 'M',
      style: 'MODERN',
      outTypes: 'a',
      inTypes: '',
      inputArguments: 'kArr',
    });
    const array = normalizeUdoCallableSignature({
      name: 'M',
      style: 'MODERN',
      outTypes: 'a',
      inTypes: '',
      inputArguments: 'kArr[]',
    });
    expect(scalar.inputTypes).toEqual(['k']);
    expect(array.inputTypes).toEqual(['k[]']);
    expect(scalar.key).not.toBe(array.key);
  });

  // ─── Classic/modern equivalence ───

  it('treats equivalent classic and modern callable signatures as the same identity', () => {
    const classic = normalizeUdoCallableSignature({
      name: 'Same',
      style: 'CLASSIC',
      outTypes: 'a',
      inTypes: 'ak',
      inputArguments: '',
    });
    const modern = normalizeUdoCallableSignature({
      name: 'Same',
      style: 'MODERN',
      outTypes: 'a',
      inTypes: '',
      inputArguments: 'aSig, kFreq',
    });
    expect(classic.inputTypes).toEqual(modern.inputTypes);
    expect(classic.outputTypes).toEqual(modern.outputTypes);
    expect(classic.key).toBe(modern.key);
  });

  it('normalizes optional-rate modifiers consistently between styles', () => {
    // 'o' and 'j' are optional-rate classic input types. They should normalize
    // to a stable token rather than be dropped, so two UDOs that differ only in
    // spelling remain equivalent and a UDO that drops them stays distinct.
    const o = normalizeUdoCallableSignature({
      name: 'Opt',
      style: 'CLASSIC',
      outTypes: 'a',
      inTypes: 'ao',
      inputArguments: '',
    });
    const j = normalizeUdoCallableSignature({
      name: 'Opt',
      style: 'CLASSIC',
      outTypes: 'a',
      inTypes: 'aj',
      inputArguments: '',
    });
    const none = normalizeUdoCallableSignature({
      name: 'Opt',
      style: 'CLASSIC',
      outTypes: 'a',
      inTypes: 'a',
      inputArguments: '',
    });
    expect(o.inputTypes).toEqual(['a', 'o']);
    expect(j.inputTypes).toEqual(['a', 'j']);
    expect(o.key).not.toBe(none.key);
    // 'o' and 'j' carry different semantic defaults and must remain distinct.
    expect(o.key).not.toBe(j.key);
  });

  // ─── Incomplete declarations ───

  it('marks a modern argument with no derivable type as incomplete', () => {
    const sig = normalizeUdoCallableSignature({
      name: 'Inc',
      style: 'MODERN',
      outTypes: 'a',
      inTypes: '',
      inputArguments: 'aSig, custom',
    });
    expect(sig.complete).toBe(false);
  });

  it('marks an empty classic inTypes that should declare inputs as incomplete', () => {
    // A modern-style UDO that has an empty body declaration is treated as
    // no-input (complete). Incompleteness applies when the declared notation
    // itself cannot be resolved into tokens.
    const sig = normalizeUdoCallableSignature({
      name: 'Inc',
      style: 'MODERN',
      outTypes: 'a',
      inTypes: '',
      inputArguments: 'gibberishArg',
    });
    expect(sig.complete).toBe(false);
  });

  it('never compares an incomplete signature equal to a complete one', () => {
    const complete = normalizeUdoCallableSignature({
      name: 'Inc',
      style: 'MODERN',
      outTypes: 'a',
      inTypes: '',
      inputArguments: 'aSig',
    });
    const incomplete = normalizeUdoCallableSignature({
      name: 'Inc',
      style: 'MODERN',
      outTypes: 'a',
      inTypes: '',
      inputArguments: 'aSig, bad',
    });
    expect(complete.complete).toBe(true);
    expect(incomplete.complete).toBe(false);
    expect(complete.key).not.toBe(incomplete.key);
  });

  it('marks an unparseable classic input type list as incomplete while retaining valid prefix types', () => {
    const sig = normalizeUdoCallableSignature({
      name: 'ClassicDraft',
      style: 'CLASSIC',
      outTypes: 'a',
      inTypes: 'a, pending',
      inputArguments: '',
    });
    expect(sig.inputTypes).toEqual(['a']);
    expect(sig.complete).toBe(false);
  });

  it('marks an unparseable output type list as incomplete while retaining valid prefix types', () => {
    const sig = normalizeUdoCallableSignature({
      name: 'OutputDraft',
      style: 'MODERN',
      outTypes: 'a, pending',
      inTypes: '',
      inputArguments: 'kFreq',
    });
    expect(sig.outputTypes).toEqual(['a']);
    expect(sig.complete).toBe(false);
  });

  it('marks an unknown explicit modern type annotation as incomplete', () => {
    const sig = normalizeUdoCallableSignature({
      name: 'AnnotationDraft',
      style: 'MODERN',
      outTypes: 'a',
      inTypes: '',
      inputArguments: 'kValue:pending',
    });
    expect(sig.inputTypes).toEqual([]);
    expect(sig.complete).toBe(false);
  });

  // ─── Display helpers ───

  it('exposes void display strings for empty input/output', () => {
    const sig = normalizeUdoCallableSignature({
      name: 'NoArgs',
      style: 'CLASSIC',
      outTypes: '0',
      inTypes: '0',
      inputArguments: '',
    });
    expect(sig.inputDisplay).toBe('void');
    expect(sig.outputDisplay).toBe('void');
  });

  it('exposes comma-separated display strings for non-empty signatures', () => {
    const sig = normalizeUdoCallableSignature({
      name: 'Disp',
      style: 'MODERN',
      outTypes: 'a, k',
      inTypes: '',
      inputArguments: 'aSig, kFreq',
    });
    expect(sig.inputDisplay).toBe('a, k');
    expect(sig.outputDisplay).toBe('a, k');
  });

  // ─── Case sensitivity ───

  it('preserves authored name case in identity', () => {
    const lower = normalizeUdoCallableSignature({
      name: 'myop',
      style: 'CLASSIC',
      outTypes: 'a',
      inTypes: 'a',
      inputArguments: '',
    });
    const upper = normalizeUdoCallableSignature({
      name: 'MyOp',
      style: 'CLASSIC',
      outTypes: 'a',
      inTypes: 'a',
      inputArguments: '',
    });
    expect(lower.name).toBe('myop');
    expect(upper.name).toBe('MyOp');
    // Identity key incorporates the name, so differing case stays distinct.
    expect(lower.identityKey).not.toBe(upper.identityKey);
  });

  // ─── Key stability ───

  it('produces a deterministic key independent of declaration style for equivalent signatures', () => {
    const classic = normalizeUdoCallableSignature({
      name: 'Poly',
      style: 'CLASSIC',
      outTypes: 'a',
      inTypes: 'k',
      inputArguments: '',
    });
    const modern = normalizeUdoCallableSignature({
      name: 'Poly',
      style: 'MODERN',
      outTypes: 'a',
      inTypes: '',
      inputArguments: 'kFreq',
    });
    expect(classic.key).toBe(modern.key);
    expect(classic.identityKey).toBe(modern.identityKey);
  });
});
