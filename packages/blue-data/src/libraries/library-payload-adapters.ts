import {
  ClassifiedLibraryPayload,
  LibraryPreviewField,
  LibraryType,
  RawXmlElement,
} from './library-types';

const KNOWN_INSTRUMENT_TYPES = new Set([
  'blue.orchestra.BlueSynthBuilder',
  'blue.orchestra.GenericInstrument',
  'blue.orchestra.JavaScriptInstrument',
  'blue.orchestra.PythonInstrument',
  'blue.orchestra.BlueX7',
]);

const KNOWN_SOUND_OBJECT_TYPES = new Set([
  'AudioFile',
  'ClojureObject',
  'Comment',
  'CSDSoundObject',
  'External',
  'FrozenSoundObject',
  'GenericScore',
  'Instance',
  'JavaScriptObject',
  'JMask',
  'LineObject',
  'NotationObject',
  'ObjectBuilder',
  'PatternObject',
  'PianoRoll',
  'PolyObject',
  'PythonObject',
  'Sound',
  'TrackerObject',
  'ZakLineObject',
]);

const UNSUPPORTED_NESTED_NAMES = new Set([
  'plugin',
  'futureField',
  'unknownWidget',
  'unknownSoundObject',
]);

function findFirstDescendant(node: RawXmlElement, names: readonly string[]): RawXmlElement | null {
  for (const child of node.children) {
    if (names.includes(child.name)) return child;
    const nested = findFirstDescendant(child, names);
    if (nested) return nested;
  }
  return null;
}

function hasUnsupportedNestedContent(node: RawXmlElement): boolean {
  return node.children.some(
    (child) =>
      UNSUPPORTED_NESTED_NAMES.has(child.name) || hasUnsupportedNestedContent(child),
  );
}

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
  const names = libraryType === 'udo' ? ['opcodeName'] : ['name'];
  const element = findFirstDescendant(node, names);
  const value = element?.text.trim() ?? '';
  return value.length > 0 ? value : null;
}

function determineObjectType(libraryType: LibraryType, node: RawXmlElement): string {
  if (libraryType === 'instrument' || libraryType === 'soundObject') {
    return node.attributes.type ?? 'unknown';
  }
  return libraryType === 'udo' ? 'OpcodeDefinition' : 'Effect';
}

function determineSupport(
  libraryType: LibraryType,
  objectType: string,
  node: RawXmlElement,
): { supported: boolean; reason: string | null } {
  if (hasUnsupportedNestedContent(node)) {
    return { supported: false, reason: 'unknown-nested-content' };
  }
  if (libraryType === 'instrument' && !KNOWN_INSTRUMENT_TYPES.has(objectType)) {
    return { supported: false, reason: 'unknown-type' };
  }
  const normalizedObjectType = objectType.split('.').pop() ?? objectType;
  if (libraryType === 'soundObject' && !KNOWN_SOUND_OBJECT_TYPES.has(normalizedObjectType)) {
    return { supported: false, reason: 'unknown-type' };
  }
  return { supported: true, reason: null };
}

export function classifyLibraryPayload(
  libraryType: LibraryType,
  node: RawXmlElement,
): ClassifiedLibraryPayload {
  const embeddedName = extractEmbeddedName(libraryType, node);
  const objectType = determineObjectType(libraryType, node);
  const support = determineSupport(libraryType, objectType, node);
  const durationElement = findFirstDescendant(node, ['subjectiveDuration', 'duration']);
  const durationValue = durationElement ? Number(durationElement.text.trim()) : null;

  return {
    embeddedName,
    objectType,
    supportStatus: support.supported ? 'supported' : 'unsupported',
    supportReasonCode: support.reason,
    supportMessage: support.reason
      ? 'This object contains content that cannot be edited safely by this version of Blue.'
      : null,
    rawXml: node.rawXml,
    rawHash: stableTextHash(node.rawXml),
    canonicalContentHash: stableTextHash(node.rawXml.replace(/>\s+</g, '><').trim()),
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
