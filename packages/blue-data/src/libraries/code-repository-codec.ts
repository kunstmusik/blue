// Java-compatible Code Repository XML codec.
//
// Parses and serializes the `customAccelerators` document format used by Java
// Blue's `CodeRepositoryManager`. Portable and host-free: no Node built-ins,
// no dynamic imports.

import { parseXml, XmlElement, XmlNode } from '@rgrove/parse-xml';
import {
  CODE_REPOSITORY_ROOT_ID,
  CODE_REPOSITORY_MAX_DEPTH,
  CODE_REPOSITORY_ROOT_NAME,
  CodeRepositoryNode,
  CodeRepositoryValidationError,
  validateCodeRepositoryTree,
} from './code-repository';

/** Root element name used by Java Blue. */
export const CODE_REPOSITORY_ROOT_ELEMENT = 'customAccelerators';
/** Group element name. Carries a `name` attribute. */
export const CODE_REPOSITORY_GROUP_ELEMENT = 'customGroup';
/** Snippet (accelerator) element name. Contains `name` and `signature`. */
export const CODE_REPOSITORY_SNIPPET_ELEMENT = 'customAccelerator';

/** Error thrown when XML cannot be parsed or is structurally unsupported. */
export class CodeRepositoryXmlError extends Error {
  constructor(
    message: string,
    readonly code: 'invalid-legacy-xml',
  ) {
    super(message);
    this.name = 'CodeRepositoryXmlError';
  }
}

/** Parsed import plan: a fresh tree (with generated ids) and counts. */
export interface CodeRepositoryParseResult {
  readonly root: CodeRepositoryNode;
  readonly groupCount: number;
  readonly snippetCount: number;
}

function generateId(prefix: 'grp' | 'snip', counter: { value: number }): string {
  counter.value += 1;
  // Portable code cannot use host randomness. Separate RFC-4122-shaped
  // namespaces make these import-local IDs deterministic and collision-free;
  // XML re-import intentionally regenerates identity from document order.
  const namespace = prefix === 'grp' ? '10000000' : '20000000';
  const suffix = counter.value.toString(16).padStart(12, '0');
  return `${namespace}-0000-4000-8000-${suffix}`;
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function escapeText(value: string): string {
  // `>` is normally safe in XML text, but the literal `]]>` closes a CDATA
  // section and is therefore invalid even when no CDATA is emitted here.
  // Escape only that sequence so ordinary Java-compatible output stays
  // canonical while every snippet remains valid XML.
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\]\]>/g, ']]&gt;');
}

function readText(node: XmlNode): string {
  if (node.type === XmlNode.TYPE_TEXT) {
    return (node as unknown as { text: string }).text;
  }
  return '';
}

function getChildElements(node: XmlElement, name: string): XmlElement[] {
  return node.children
    .filter((child): child is XmlElement => child.type === XmlNode.TYPE_ELEMENT)
    .filter((child) => child.name === name);
}

function assertOnlyAttributes(node: XmlElement, allowed: readonly string[]): void {
  for (const attribute of Object.keys(node.attributes)) {
    if (!allowed.includes(attribute)) {
      throw new CodeRepositoryXmlError(
        `Unsupported attribute ${attribute} on <${node.name}>`,
        'invalid-legacy-xml',
      );
    }
  }
}

function assertContainerTextIsWhitespace(node: XmlElement): void {
  for (const child of node.children) {
    if (child.type === XmlNode.TYPE_TEXT && readText(child).trim().length > 0) {
      throw new CodeRepositoryXmlError(
        `Unexpected text inside <${node.name}>`,
        'invalid-legacy-xml',
      );
    }
  }
}

function getRequiredTextElement(parent: XmlElement, name: string): string {
  const matches = getChildElements(parent, name);
  if (matches.length !== 1) {
    throw new CodeRepositoryXmlError(
      `customAccelerator must contain exactly one <${name}>`,
      'invalid-legacy-xml',
    );
  }
  const element = matches[0];
  assertOnlyAttributes(element, []);
  for (const child of element.children) {
    if (child.type === XmlNode.TYPE_ELEMENT) {
      throw new CodeRepositoryXmlError(
        `<${name}> cannot contain child elements`,
        'invalid-legacy-xml',
      );
    }
  }
  return element.children.map(readText).join('');
}

function buildNode(
  node: XmlElement,
  kind: 'root' | 'group',
  parentId: string | null,
  order: number,
  idCounter: { value: number },
  depth = 0,
): CodeRepositoryNode {
  if (depth > CODE_REPOSITORY_MAX_DEPTH) {
    throw new CodeRepositoryXmlError(
      'Code Repository XML exceeds the maximum group depth',
      'invalid-legacy-xml',
    );
  }
  const id = kind === 'root' ? CODE_REPOSITORY_ROOT_ID : generateId('grp', idCounter);
  assertOnlyAttributes(node, kind === 'group' ? ['name'] : []);
  if (kind === 'group' && typeof node.attributes.name !== 'string') {
    throw new CodeRepositoryXmlError(
      'customGroup is missing its name attribute',
      'invalid-legacy-xml',
    );
  }
  assertContainerTextIsWhitespace(node);
  const name = kind === 'root' ? CODE_REPOSITORY_ROOT_NAME : node.attributes.name!;
  const childElements = node.children.filter(
    (child): child is XmlElement => child.type === XmlNode.TYPE_ELEMENT,
  );
  const children: CodeRepositoryNode[] = [];
  let childOrder = 0;
  for (const child of childElements) {
    if (child.name === CODE_REPOSITORY_GROUP_ELEMENT) {
      children.push(buildNode(child, 'group', id, childOrder, idCounter, depth + 1));
      childOrder += 1;
    } else if (child.name === CODE_REPOSITORY_SNIPPET_ELEMENT) {
      children.push(buildSnippetNode(child, id, childOrder, idCounter));
      childOrder += 1;
    } else {
      throw new CodeRepositoryXmlError(
        `Unsupported element <${child.name}> inside <${node.name}>`,
        'invalid-legacy-xml',
      );
    }
  }
  return { id, kind, name, parentId, order, children };
}

function buildSnippetNode(
  node: XmlElement,
  parentId: string,
  order: number,
  idCounter: { value: number },
): CodeRepositoryNode {
  assertOnlyAttributes(node, []);
  assertContainerTextIsWhitespace(node);
  const childElements = node.children.filter(
    (child): child is XmlElement => child.type === XmlNode.TYPE_ELEMENT,
  );
  if (
    childElements.length !== 2 ||
    childElements.some((child) => child.name !== 'name' && child.name !== 'signature')
  ) {
    throw new CodeRepositoryXmlError(
      'customAccelerator supports only one <name> and one <signature>',
      'invalid-legacy-xml',
    );
  }
  const name = getRequiredTextElement(node, 'name');
  const code = getRequiredTextElement(node, 'signature');
  return {
    id: generateId('snip', idCounter),
    kind: 'snippet',
    name,
    parentId,
    order,
    code,
  };
}

/**
 * Parse Java-compatible Code Repository XML into a fresh tree with generated
 * node ids. Throws {@link CodeRepositoryXmlError} on malformed or unsupported
 * input; never returns a partial tree.
 */
export function parseCodeRepositoryXml(source: string): CodeRepositoryParseResult {
  if (source.trim().length === 0) {
    throw new CodeRepositoryXmlError('Code Repository XML is empty', 'invalid-legacy-xml');
  }
  let document;
  try {
    document = parseXml(source);
  } catch (error) {
    throw new CodeRepositoryXmlError(
      `Code Repository XML is malformed: ${(error as Error).message}`,
      'invalid-legacy-xml',
    );
  }
  const rootElements = document.children.filter(
    (child): child is XmlElement => child.type === XmlNode.TYPE_ELEMENT,
  );
  if (rootElements.length !== 1 || rootElements[0].name !== CODE_REPOSITORY_ROOT_ELEMENT) {
    throw new CodeRepositoryXmlError(
      `Root element must be <${CODE_REPOSITORY_ROOT_ELEMENT}>`,
      'invalid-legacy-xml',
    );
  }

  const idCounter = { value: 0 };
  const root = buildNode(rootElements[0], 'root', null, 0, idCounter);
  const validationError = validateCodeRepositoryTree(root);
  if (validationError) {
    throw new CodeRepositoryXmlError(
      `Code Repository XML violates the ${validationError.code} tree invariant`,
      'invalid-legacy-xml',
    );
  }

  const counts = { groupCount: 0, snippetCount: 0 };
  const tally = (node: CodeRepositoryNode): void => {
    if (node.kind === 'group') counts.groupCount += 1;
    if (node.kind === 'snippet') counts.snippetCount += 1;
    for (const child of node.children ?? []) tally(child);
  };
  tally(root);

  return { root, ...counts };
}

function serializeNode(node: CodeRepositoryNode, parts: string[]): void {
  if (node.kind === 'root') {
    for (const child of node.children ?? []) serializeNode(child, parts);
    return;
  }
  if (node.kind === 'snippet') {
    parts.push(
      `    <${CODE_REPOSITORY_SNIPPET_ELEMENT}>\n` +
        `      <name>${escapeText(node.name)}</name>\n` +
        `      <signature>${escapeText(node.code ?? '')}</signature>\n` +
        `    </${CODE_REPOSITORY_SNIPPET_ELEMENT}>`,
    );
    return;
  }
  parts.push(`  <${CODE_REPOSITORY_GROUP_ELEMENT} name="${escapeAttribute(node.name)}">`);
  for (const child of node.children ?? []) serializeNode(child, parts);
  parts.push(`  </${CODE_REPOSITORY_GROUP_ELEMENT}>`);
}

/**
 * Serialize a repository root into Java-compatible XML. Omits internal node
 * ids, revisions, and database provenance. Escapes names and snippet text.
 */
export function serializeCodeRepositoryXml(root: CodeRepositoryNode): string {
  const error = validateCodeRepositoryTree(root);
  if (error) {
    throw new Error(`Cannot serialize invalid repository tree: ${error.code}`);
  }
  const parts: string[] = [];
  parts.push(`<?xml version='1.0' encoding='UTF-8'?>`);
  parts.push(`<${CODE_REPOSITORY_ROOT_ELEMENT}>`);
  for (const child of root.children ?? []) serializeNode(child, parts);
  parts.push(`</${CODE_REPOSITORY_ROOT_ELEMENT}>`);
  return parts.join('\n') + '\n';
}

/** Validate an arbitrary tree and return a typed error for invalid input. */
export function validateParsedTree(root: CodeRepositoryNode): CodeRepositoryValidationError | null {
  return validateCodeRepositoryTree(root);
}
