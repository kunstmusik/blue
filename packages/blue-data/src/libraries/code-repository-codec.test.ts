import { describe, expect, it } from 'vitest';
import {
  CODE_REPOSITORY_ROOT_ID,
  collectDescendantIds,
  createEmptyCodeRepositoryDocument,
  isCodeRepositoryNode,
  validateCodeRepositoryTree,
} from './code-repository';
import { CodeRepositoryXmlError, parseCodeRepositoryXml, serializeCodeRepositoryXml } from './code-repository-codec';

// Java-compatible fixture retained for codec interoperability coverage. It is
// not packaged or used as a TS Blue first-run seed.
const JAVA_COMPATIBLE_XML_FIXTURE = `<?xml version='1.0' encoding='UTF-8'?>
<customAccelerators>
  <customGroup name='envelopes'>
    <customAccelerator>
      <name>panning code</name>
      <signature>aLeft, aRight  pan2    aout, kSpace</signature>
    </customAccelerator>
    <customAccelerator>
      <name>half-sine envelope</name>
      <signature>kenv\toscili  \tkamp, .5 / p3, 1</signature>
    </customAccelerator>
  </customGroup>
</customAccelerators>`;

describe('parseCodeRepositoryXml', () => {
  it('parses a Java-compatible repository fixture preserving names, order, and code', () => {
    const result = parseCodeRepositoryXml(JAVA_COMPATIBLE_XML_FIXTURE);
    expect(result.root.kind).toBe('root');
    expect(result.root.id).toBe(CODE_REPOSITORY_ROOT_ID);
    expect(result.root.parentId).toBeNull();
    expect(result.groupCount).toBe(1);
    expect(result.snippetCount).toBe(2);

    const group = result.root.children?.[0];
    expect(group?.kind).toBe('group');
    expect(group?.name).toBe('envelopes');
    expect(group?.parentId).toBe(result.root.id);
    expect(group?.order).toBe(0);

    const [first, second] = group?.children ?? [];
    expect(first.kind).toBe('snippet');
    expect(first.name).toBe('panning code');
    expect(first.code).toBe('aLeft, aRight  pan2    aout, kSpace');
    expect(first.parentId).toBe(group?.id);
    expect(first.order).toBe(0);
    expect(second.name).toBe('half-sine envelope');
    expect(second.code).toBe('kenv\toscili  \tkamp, .5 / p3, 1');
    expect(second.order).toBe(1);
  });

  it('preserves exact whitespace and tabs in snippet code', () => {
    const xml = `<customAccelerators>
  <customAccelerator>
    <name>tabs</name>
    <signature>  \tleading and trailing  \n</signature>
  </customAccelerator>
</customAccelerators>`;
    const result = parseCodeRepositoryXml(xml);
    expect(result.root.children?.[0].code).toBe('  \tleading and trailing  \n');
  });

  it('supports nested groups and mixed group/snippet ordering', () => {
    const xml = `<customAccelerators>
  <customGroup name="outer">
    <customGroup name="inner">
      <customAccelerator>
        <name>deep</name>
        <signature>deep code</signature>
      </customAccelerator>
    </customGroup>
    <customAccelerator>
      <name>sibling snippet</name>
      <signature>sibling</signature>
    </customAccelerator>
  </customGroup>
</customAccelerators>`;
    const result = parseCodeRepositoryXml(xml);
    const outer = result.root.children?.[0];
    expect(outer?.name).toBe('outer');
    expect(outer?.children).toHaveLength(2);
    expect(outer?.children?.[0].kind).toBe('group');
    expect(outer?.children?.[0].name).toBe('inner');
    expect(outer?.children?.[1].kind).toBe('snippet');
    expect(outer?.children?.[1].name).toBe('sibling snippet');
    const inner = outer?.children?.[0];
    expect(inner?.children?.[0].code).toBe('deep code');
    // Parent links are correct at every depth.
    expect(inner?.parentId).toBe(outer?.id);
    expect(inner?.children?.[0].parentId).toBe(inner?.id);
  });

  it('allows duplicate sibling names', () => {
    const xml = `<customAccelerators>
  <customGroup name="dup">
    <customAccelerator><name>same</name><signature>1</signature></customAccelerator>
    <customAccelerator><name>same</name><signature>2</signature></customAccelerator>
  </customGroup>
</customAccelerators>`;
    const result = parseCodeRepositoryXml(xml);
    const group = result.root.children?.[0];
    expect(group?.children?.[0].name).toBe('same');
    expect(group?.children?.[1].name).toBe('same');
    expect(group?.children?.[0].id).not.toBe(group?.children?.[1].id);
  });

  it('supports unicode names and code text', () => {
    const xml = `<customAccelerators>
  <customGroup name="ユニコード">
    <customAccelerator>
      <name>café — naïve</name>
      <signature>prints "日本語"</signature>
    </customAccelerator>
  </customGroup>
</customAccelerators>`;
    const result = parseCodeRepositoryXml(xml);
    const group = result.root.children?.[0];
    expect(group?.name).toBe('ユニコード');
    expect(group?.children?.[0].name).toBe('café — naïve');
    expect(group?.children?.[0].code).toBe('prints "日本語"');
  });

  it('unescapes XML entities in names and code', () => {
    const xml = `<customAccelerators>
  <customAccelerator>
    <name>a &amp; b &lt; c</name>
    <signature>x &amp; y</signature>
  </customAccelerator>
</customAccelerators>`;
    const result = parseCodeRepositoryXml(xml);
    expect(result.root.children?.[0].name).toBe('a & b < c');
    expect(result.root.children?.[0].code).toBe('x & y');
  });

  it('preserves empty snippet code', () => {
    const xml = `<customAccelerators>
  <customAccelerator>
    <name>empty</name>
    <signature></signature>
  </customAccelerator>
</customAccelerators>`;
    const result = parseCodeRepositoryXml(xml);
    expect(result.root.children?.[0].code).toBe('');
  });

  it('throws on empty input', () => {
    expect(() => parseCodeRepositoryXml('   ')).toThrow(CodeRepositoryXmlError);
  });

  it('throws on malformed XML', () => {
    expect(() => parseCodeRepositoryXml('<customAccelerators><customGroup')).toThrow(CodeRepositoryXmlError);
  });

  it('throws on a non-customAccelerators root', () => {
    expect(() => parseCodeRepositoryXml('<otherRoot/>')).toThrow(CodeRepositoryXmlError);
  });

  it('throws on unsupported child elements', () => {
    const xml = `<customAccelerators>
  <customGroup name="bad">
    <unknownElement/>
  </customGroup>
</customAccelerators>`;
    expect(() => parseCodeRepositoryXml(xml)).toThrow(CodeRepositoryXmlError);
  });

  it('throws when a snippet is missing its name or signature', () => {
    const xml = `<customAccelerators>
  <customAccelerator>
    <name>only name</name>
  </customAccelerator>
</customAccelerators>`;
    expect(() => parseCodeRepositoryXml(xml)).toThrow(CodeRepositoryXmlError);
  });

  it('rejects duplicate or unsupported children inside customAccelerator', () => {
    const duplicate = `<customAccelerators><customAccelerator>
      <name>one</name><name>two</name><signature>code</signature>
    </customAccelerator></customAccelerators>`;
    const unsupported = `<customAccelerators><customAccelerator>
      <name>one</name><signature>code</signature><description>extra</description>
    </customAccelerator></customAccelerators>`;
    expect(() => parseCodeRepositoryXml(duplicate)).toThrow(CodeRepositoryXmlError);
    expect(() => parseCodeRepositoryXml(unsupported)).toThrow(CodeRepositoryXmlError);
  });

  it('rejects unsupported attributes and nested XML in supported text elements', () => {
    const attribute = `<customAccelerators extra="no"/>`;
    const nested = `<customAccelerators><customAccelerator>
      <name><nested/></name><signature>code</signature>
    </customAccelerator></customAccelerators>`;
    expect(() => parseCodeRepositoryXml(attribute)).toThrow(CodeRepositoryXmlError);
    expect(() => parseCodeRepositoryXml(nested)).toThrow(CodeRepositoryXmlError);
  });

  it('rejects blank group and snippet names as whole-document validation failures', () => {
    expect(() => parseCodeRepositoryXml('<customAccelerators><customGroup name="   "/></customAccelerators>')).toThrow(
      CodeRepositoryXmlError,
    );
    expect(() =>
      parseCodeRepositoryXml(
        '<customAccelerators><customAccelerator><name> </name><signature>x</signature></customAccelerator></customAccelerators>',
      ),
    ).toThrow(CodeRepositoryXmlError);
  });
});

describe('serializeCodeRepositoryXml', () => {
  it('round-trips a Java-compatible repository fixture', () => {
    const parsed = parseCodeRepositoryXml(JAVA_COMPATIBLE_XML_FIXTURE);
    const serialized = serializeCodeRepositoryXml(parsed.root);
    const reparsed = parseCodeRepositoryXml(serialized);
    expect(reparsed.snippetCount).toBe(2);
    expect(reparsed.groupCount).toBe(1);
    const group = reparsed.root.children?.[0];
    expect(group?.children?.[0].code).toBe('aLeft, aRight  pan2    aout, kSpace');
    expect(group?.children?.[1].code).toBe('kenv\toscili  \tkamp, .5 / p3, 1');
  });

  it('omits internal node ids, revisions, and provenance', () => {
    const parsed = parseCodeRepositoryXml(JAVA_COMPATIBLE_XML_FIXTURE);
    const serialized = serializeCodeRepositoryXml(parsed.root);
    expect(serialized).not.toContain('grp-');
    expect(serialized).not.toContain('snip-');
    expect(serialized).not.toContain(CODE_REPOSITORY_ROOT_ID);
    expect(serialized).not.toContain('revision');
  });

  it('escapes XML-sensitive characters in names and attributes', () => {
    const doc = createEmptyCodeRepositoryDocument();
    const root = {
      ...doc.root,
      children: [
        {
          id: 'grp-test',
          kind: 'group' as const,
          name: 'a & b "quoted"',
          parentId: doc.root.id,
          order: 0,
          children: [
            {
              id: 'snip-test',
              kind: 'snippet' as const,
              name: '<tag>',
              parentId: 'grp-test',
              order: 0,
              code: 'x & y < z',
            },
          ],
        },
      ],
    };
    const xml = serializeCodeRepositoryXml(root);
    expect(xml).toContain('name="a &amp; b &quot;quoted&quot;"');
    expect(xml).toContain('<name>&lt;tag></name>');
    expect(xml).toContain('<signature>x &amp; y &lt; z</signature>');
    // And round-trips back to the original text.
    const reparsed = parseCodeRepositoryXml(xml);
    expect(reparsed.root.children?.[0].name).toBe('a & b "quoted"');
    expect(reparsed.root.children?.[0].children?.[0].name).toBe('<tag>');
    expect(reparsed.root.children?.[0].children?.[0].code).toBe('x & y < z');
  });

  it('keeps the CDATA terminator out of serialized text while preserving code', () => {
    const doc = createEmptyCodeRepositoryDocument();
    const root = {
      ...doc.root,
      children: [
        {
          id: 'snip-cdata-terminator',
          kind: 'snippet' as const,
          name: 'terminator',
          parentId: doc.root.id,
          order: 0,
          code: 'left ]]> right',
        },
      ],
    };
    const xml = serializeCodeRepositoryXml(root);
    expect(xml).toContain('left ]]&gt; right');
    expect(parseCodeRepositoryXml(xml).root.children?.[0].code).toBe('left ]]> right');
  });

  it('produces canonical XML for an empty repository', () => {
    const doc = createEmptyCodeRepositoryDocument();
    const xml = serializeCodeRepositoryXml(doc.root);
    expect(xml).toContain('<?xml version');
    expect(xml).toContain('<customAccelerators>');
    expect(xml).toContain('</customAccelerators>');
  });
});

describe('validateCodeRepositoryTree', () => {
  it('accepts a well-formed tree', () => {
    const parsed = parseCodeRepositoryXml(JAVA_COMPATIBLE_XML_FIXTURE);
    expect(validateCodeRepositoryTree(parsed.root)).toBeNull();
  });

  it('rejects a root with the wrong kind', () => {
    const doc = createEmptyCodeRepositoryDocument();
    const bad = { ...doc.root, kind: 'group' as const };
    expect(validateCodeRepositoryTree(bad)?.code).toBe('root-kind');
  });

  it('rejects a draft that replaces the protected root identity or uses blank names', () => {
    const doc = createEmptyCodeRepositoryDocument();
    expect(validateCodeRepositoryTree({ ...doc.root, id: 'other-root' })?.code).toBe('root-id');
    expect(validateCodeRepositoryTree({ ...doc.root, name: 'Renamed Root' })?.code).toBe('root-name');
    expect(validateCodeRepositoryTree({ ...doc.root, order: 1 })?.code).toBe('root-order');
    expect(
      validateCodeRepositoryTree({
        ...doc.root,
        children: [
          {
            id: 'blank',
            kind: 'snippet',
            name: '   ',
            parentId: doc.root.id,
            order: 0,
            code: '',
          },
        ],
      })?.code,
    ).toBe('empty-name');
  });

  it('rejects a snippet with children', () => {
    const doc = createEmptyCodeRepositoryDocument();
    const bad: typeof doc.root = {
      ...doc.root,
      children: [
        {
          id: 'snip-bad',
          kind: 'snippet',
          name: 'bad',
          parentId: doc.root.id,
          order: 0,
          code: 'x',
          children: [
            {
              id: 'child',
              kind: 'snippet',
              name: 'c',
              parentId: 'snip-bad',
              order: 0,
              code: 'y',
            },
          ],
        },
      ],
    };
    expect(validateCodeRepositoryTree(bad)?.code).toBe('snippet-has-children');
  });

  it('rejects a non-contiguous sibling order', () => {
    const doc = createEmptyCodeRepositoryDocument();
    const bad: typeof doc.root = {
      ...doc.root,
      children: [
        {
          id: 'a',
          kind: 'snippet',
          name: 'a',
          parentId: doc.root.id,
          order: 0,
          code: '1',
        },
        {
          id: 'b',
          kind: 'snippet',
          name: 'b',
          parentId: doc.root.id,
          order: 5,
          code: '2',
        },
      ],
    };
    expect(validateCodeRepositoryTree(bad)?.code).toBe('order-gap');
  });

  it('rejects duplicate node ids', () => {
    const doc = createEmptyCodeRepositoryDocument();
    const bad: typeof doc.root = {
      ...doc.root,
      children: [
        {
          id: 'dup',
          kind: 'snippet',
          name: 'a',
          parentId: doc.root.id,
          order: 0,
          code: '1',
        },
        {
          id: 'dup',
          kind: 'snippet',
          name: 'b',
          parentId: doc.root.id,
          order: 1,
          code: '2',
        },
      ],
    };
    expect(validateCodeRepositoryTree(bad)?.code).toBe('duplicate-id');
  });
});

describe('collectDescendantIds', () => {
  it('collects a subtree including the node itself', () => {
    const parsed = parseCodeRepositoryXml(JAVA_COMPATIBLE_XML_FIXTURE);
    const group = parsed.root.children?.[0];
    if (!group) throw new Error('expected group');
    const ids = collectDescendantIds(parsed.root, group.id);
    expect(ids[0]).toBe(group.id);
    expect(ids).toHaveLength(3);
  });
});

describe('defensive tree parsing', () => {
  it('rejects XML nesting beyond the supported repository depth', () => {
    const openings = Array.from({ length: 66 }, (_, index) => `<customGroup name="g${index}">`).join('');
    const closings = '</customGroup>'.repeat(66);
    expect(() => parseCodeRepositoryXml(`<customAccelerators>${openings}${closings}</customAccelerators>`)).toThrow(
      /maximum group depth/,
    );
  });
});

describe('isCodeRepositoryNode guard', () => {
  it('accepts a valid node and rejects malformed values', () => {
    const parsed = parseCodeRepositoryXml(JAVA_COMPATIBLE_XML_FIXTURE);
    expect(isCodeRepositoryNode(parsed.root)).toBe(true);
    expect(isCodeRepositoryNode(null)).toBe(false);
    expect(
      isCodeRepositoryNode({
        id: '',
        kind: 'root',
        name: 'x',
        parentId: null,
        order: 0,
      }),
    ).toBe(false);
    expect(
      isCodeRepositoryNode({
        id: 'x',
        kind: 'bogus',
        name: 'x',
        parentId: null,
        order: 0,
      }),
    ).toBe(false);

    const cyclic: Record<string, unknown> = {
      id: 'cyclic',
      kind: 'group',
      name: 'cyclic',
      parentId: CODE_REPOSITORY_ROOT_ID,
      order: 0,
      children: [],
    };
    (cyclic.children as unknown[]).push(cyclic);
    expect(isCodeRepositoryNode(cyclic)).toBe(false);
  });
});
