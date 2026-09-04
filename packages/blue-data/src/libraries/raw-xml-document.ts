import { parseXml, XmlElement, XmlNode } from '@rgrove/parse-xml';
import { RawXmlDocument, RawXmlElement } from './library-types';

const DOCUMENT_TYPE_PATTERN = /<!DOCTYPE\b/i;

function utf8ByteOffsetToCodeUnit(source: string, byteOffset: number): number {
  if (!Number.isInteger(byteOffset) || byteOffset < 0) {
    throw new Error(`Invalid XML offset: ${byteOffset}`);
  }

  let bytes = 0;
  let codeUnits = 0;
  for (const character of source) {
    if (bytes >= byteOffset) break;
    bytes += new TextEncoder().encode(character).length;
    codeUnits += character.length;
  }

  if (bytes !== byteOffset) {
    throw new Error(`XML byte offset ${byteOffset} does not align to a character boundary`);
  }
  return codeUnits;
}

function candidateSpan(
  source: string,
  node: XmlElement,
  convert: (offset: number) => number,
): { start: number; end: number; rawXml: string } | null {
  const start = convert(node.start);
  const end = convert(node.end);
  const rawXml = source.slice(start, end);
  const openingPattern = new RegExp(`^<${node.name}(?:\\s|/?>)`);
  if (!openingPattern.test(rawXml) || !rawXml.endsWith('>')) return null;
  return { start, end, rawXml };
}

function resolveElementSpan(
  source: string,
  node: XmlElement,
): { start: number; end: number; rawXml: string } {
  if (node.start < 0 || node.end < node.start) {
    throw new Error(`Missing source offsets for XML element ${node.name}`);
  }

  const direct = candidateSpan(source, node, (offset) => offset);
  if (direct) return direct;

  const utf8 = candidateSpan(source, node, (offset) => utf8ByteOffsetToCodeUnit(source, offset));
  if (utf8) return utf8;

  throw new Error(`Unable to resolve source offsets for XML element ${node.name}`);
}

function collectText(node: XmlElement): string {
  return node.children
    .filter((child) => child.type === XmlNode.TYPE_TEXT || child.type === XmlNode.TYPE_CDATA)
    .map((child) => ('text' in child ? String(child.text) : ''))
    .join('');
}

function convertElement(source: string, node: XmlElement): RawXmlElement {
  const span = resolveElementSpan(source, node);
  const attributes: Record<string, string> = {};
  for (const [name, value] of Object.entries(node.attributes)) {
    attributes[name] = String(value);
  }

  return {
    name: node.name,
    attributes,
    startCodeUnit: span.start,
    endCodeUnit: span.end,
    rawXml: span.rawXml,
    text: collectText(node),
    children: node.children
      .filter((child): child is XmlElement => child.type === XmlNode.TYPE_ELEMENT)
      .map((child) => convertElement(source, child)),
  };
}

export function parseRawXmlDocument(source: string): RawXmlDocument {
  if (DOCUMENT_TYPE_PATTERN.test(source)) {
    throw new Error('XML document type declarations are not allowed');
  }

  const document = parseXml(source, {
    includeOffsets: true,
    preserveCdata: true,
    preserveComments: true,
    preserveDocumentType: true,
  });
  const root = document.children.find(
    (child): child is XmlElement => child.type === XmlNode.TYPE_ELEMENT,
  );
  if (!root) throw new Error('No root element found in XML document');

  return { source, root: convertElement(source, root) };
}

export function findRawXmlElements(document: RawXmlDocument, name: string): RawXmlElement[] {
  const matches: RawXmlElement[] = [];
  const visit = (node: RawXmlElement): void => {
    if (node.name === name) matches.push(node);
    node.children.forEach(visit);
  };
  visit(document.root);
  return matches;
}
