import { describe, expect, it } from 'vitest';
import { Element } from './xml-reader';
import { XmlLoadContext, XmlLoadError, loadXml, requireXmlValue } from './xml-load';

const source = { kind: 'project' as const, label: 'C:\\Users\\composer\\piece.blue' };

describe('XML operation reports', () => {
  it('uses indexed source paths that survive migration and reports plain data', () => {
    const root = Element.parse('<blueData><score/><score><name future="x"/></score></blueData>');
    const context = new XmlLoadContext(root, source);
    const second = root.getElements('score').toArray()[1];
    const name = second.getElement('name')!;
    root.removeElements('score');
    root.addElement('replacement').addElement(second);
    const diagnostic = context.at(name).diagnostic({
      code: 'member',
      severity: 'error',
      member: '@future',
      value: 'x',
      message: 'Unexpected attribute.',
      recovery: 'Remove it in a compatible editor.',
    });
    expect(diagnostic.path).toBe('/blueData/score[2]/name[1]/@future');
    expect(diagnostic.source.label).toBe('C:\\Users\\composer\\piece.blue');
    expect(JSON.parse(JSON.stringify(diagnostic))).toEqual(diagnostic);
    const generated = new Element('canonicalName');
    context.anchor(generated, name);
    expect(context.at(generated).path).toBe('/blueData/score[2]/name[1]');
  });

  it('returns warnings with an accepted value and requires a strict caller to handle them', () => {
    const result = loadXml('<root/>', source, (_root, context) => {
      context.diagnostic({
        code: 'fixed-ppq',
        severity: 'warning',
        message: 'Redundant fixed PPQ.',
        recovery: 'Canonical save omits the redundant value.',
      });
      return 42;
    });
    expect(result.ok).toBe(true);
    expect(() => requireXmlValue(result)).toThrow(XmlLoadError);
    const warnings: string[] = [];
    expect(
      requireXmlValue(result, (diagnostics) => warnings.push(...diagnostics.map((d) => d.code))),
    ).toBe(42);
    expect(warnings).toEqual(['fixed-ppq']);
  });

  it('does not expose a partial candidate when validation records an error', () => {
    const result = loadXml('<root/>', source, (_root, context) => {
      context.diagnostic({
        code: 'value',
        severity: 'error',
        message: 'Invalid value.',
        recovery: 'Correct the value.',
      });
      return { partial: true };
    });
    expect(result.ok).toBe(false);
    expect(result).not.toHaveProperty('value');
    expect(() => requireXmlValue(result)).toThrow(XmlLoadError);
  });

  it('converts parser and loader exceptions into rejected contextual reports', () => {
    const syntax = loadXml('<root>', source, () => 1);
    expect(syntax.ok).toBe(false);
    expect(syntax.diagnostics[0]).toMatchObject({
      code: 'syntax',
      severity: 'error',
      source,
      path: '/',
    });
    const failure = loadXml('<root><child/></root>', source, (_root, context) => {
      throw context.at(_root.getElement('child')!).error({
        code: 'type',
        member: 'type',
        value: 'future',
        message: 'Unknown type.',
        recovery: 'Convert it first.',
      });
    });
    expect(failure.diagnostics).toHaveLength(1);
    expect(failure.diagnostics[0]).toMatchObject({ code: 'type', path: '/root/child[1]' });
    const ordinary = loadXml('<root/>', source, () => {
      throw new Error('Invalid resource');
    });
    expect(ordinary.ok).toBe(false);
    expect(ordinary.diagnostics[0]).toMatchObject({
      severity: 'error',
      path: '/root',
      message: 'Invalid resource',
    });
  });
});
