import {
  ClassifiedLibraryPayload,
  LibraryPreviewField,
  LibraryType,
  RawXmlElement,
} from './library-types';

import { readResourceXml } from '../resource-xml-policy';
import type { XmlDiagnostic, XmlSource } from '../serialization/xml-load';
import { TimeBase } from '../time/time-base';

export function stableTextHash(value: string): string {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function available(value: string | number | null): LibraryPreviewField<string | number> {
  return value === null || value === ''
    ? { state: 'unavailable', reason: 'Not safely available' }
    : { state: 'available', value };
}

function extractEmbeddedName(libraryType: LibraryType, node: RawXmlElement): string | null {
  const name = libraryType === 'udo' ? 'opcodeName' : 'name';
  const candidates = node.children.filter((child) => child.name === name);
  if (
    candidates.length !== 1 ||
    candidates[0].children.length ||
    Object.keys(candidates[0].attributes).length
  )
    return null;
  return candidates[0].text.trim() || null;
}

function determineObjectType(libraryType: LibraryType, node: RawXmlElement): string {
  return libraryType === 'instrument' || libraryType === 'soundObject'
    ? (node.attributes.type ?? 'unknown')
    : libraryType === 'udo'
      ? 'OpcodeDefinition'
      : 'Effect';
}

export function classifyLibraryPayload(
  libraryType: LibraryType,
  node: RawXmlElement,
  source: XmlSource = { kind: 'library', label: 'in-memory library' },
  path = `/${node.name}`,
): ClassifiedLibraryPayload {
  const embeddedName = extractEmbeddedName(libraryType, node);
  const objectType = determineObjectType(libraryType, node);
  const report = readResourceXml(libraryType, node.rawXml, source);
  const diagnostics: readonly XmlDiagnostic[] = report.diagnostics.map((diagnostic) => ({
    ...diagnostic,
    path: path + diagnostic.path.slice(('/' + node.name).length),
    ...(!report.ok
      ? {
          severity: 'warning' as const,
          code: 'L-ARCHIVE',
          message: `Archived unsupported ${libraryType}: ${diagnostic.message}`,
          recovery: `Original XML is retained for exact export. Typed editing and project insertion are disabled. ${diagnostic.recovery}`,
        }
      : {}),
  }));
  const reason = report.ok
    ? null
    : report.diagnostics[0]?.code === 'type'
      ? 'unknown-type'
      : 'unknown-nested-content';
  let durationValue: number | null = null;
  if (report.ok && 'getSubjectiveDuration' in report.value) {
    const duration = report.value.getSubjectiveDuration();
    if (duration.getTimeBase() === TimeBase.BEATS) durationValue = duration.getValue();
  }
  const canonical = report.ok ? report.value.saveAsXML().toXml() : node.rawXml;

  return {
    embeddedName,
    objectType,
    supportStatus: report.ok ? 'supported' : 'unsupported',
    supportReasonCode: reason,
    supportMessage: diagnostics.length
      ? diagnostics
          .map(
            (diagnostic) =>
              `${diagnostic.source.label}: ${diagnostic.path}: ${diagnostic.message} ${diagnostic.recovery}`,
          )
          .join('\n')
      : null,
    diagnostics,
    rawXml: node.rawXml,
    rawHash: stableTextHash(node.rawXml),
    canonicalContentHash: stableTextHash(canonical),
    preview: {
      name: available(embeddedName),
      objectType: available(objectType),
      duration: available(Number.isFinite(durationValue) ? durationValue : null),
    },
    dependencies: {
      itemOwned: [],
      unresolvedExternal: [],
    },
  };
}
