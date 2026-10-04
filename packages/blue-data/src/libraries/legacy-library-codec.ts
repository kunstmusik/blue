import { Element } from '../serialization/xml-reader';
import { XmlLoadContext } from '../serialization/xml-load';
import type { XmlDiagnostic, XmlSource } from '../serialization/xml-load';
import { checkShape, parseXmlBoolean } from '../utilities/xml';
import {
  LEGACY_LIBRARY_FORMATS,
  LegacyLibraryDocumentPlan,
  LegacyLibraryFolderPlan,
  LegacyLibraryFormatDescriptor,
  LegacyLibraryItemPlan,
  LegacyLibraryTreeNode,
  RawXmlElement,
} from './library-types';
import { classifyLibraryPayload, stableTextHash } from './library-payload-adapters';
import { parseRawXmlDocument } from './raw-xml-document';

function descriptorForRoot(rootName: string): LegacyLibraryFormatDescriptor {
  const descriptor = Object.values(LEGACY_LIBRARY_FORMATS).find(
    (candidate) => candidate.rootElement === rootName,
  );
  if (!descriptor) throw new Error(`Unsupported legacy library root: ${rootName}`);
  return descriptor;
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function parseFolder(
  descriptor: LegacyLibraryFormatDescriptor,
  element: RawXmlElement,
  isRoot: boolean,
  source: XmlSource,
  path: string,
  diagnostics: XmlDiagnostic[],
): LegacyLibraryFolderPlan {
  const children: LegacyLibraryTreeNode[] = [];
  let sourceIndex = 0;
  const counts = new Map<string, number>();
  for (const child of element.children) {
    const count = (counts.get(child.name) ?? 0) + 1;
    counts.set(child.name, count);
    const childPath = `${path}/${child.name}[${count}]`;
    if (child.name === descriptor.categoryElement) {
      children.push(parseFolder(descriptor, child, false, source, childPath, diagnostics));
    } else if (child.name === descriptor.leafElement) {
      const payload = classifyLibraryPayload(descriptor.libraryType, child, source, childPath);
      diagnostics.push(...(payload.diagnostics ?? []));
      const item: LegacyLibraryItemPlan = {
        kind: 'item',
        displayName: payload.embeddedName ?? `Unsupported ${descriptor.libraryType}`,
        sourceIndex,
        payload,
      };
      children.push(item);
    }
    sourceIndex += 1;
  }

  return {
    kind: 'folder',
    name: element.attributes.categoryName ?? `${descriptor.libraryType} Library`,
    isRoot,
    sourceIndex: 0,
    children,
  };
}

function walkCounts(node: LegacyLibraryFolderPlan): {
  folders: number;
  items: number;
  unsupported: number;
} {
  let folders = 0;
  let items = 0;
  let unsupported = 0;
  for (const child of node.children) {
    if (child.kind === 'folder') {
      const nested = walkCounts(child);
      folders += 1 + nested.folders;
      items += nested.items;
      unsupported += nested.unsupported;
    } else {
      items += 1;
      if (child.payload.supportStatus === 'unsupported') unsupported += 1;
    }
  }
  return { folders, items, unsupported };
}

export function parseLegacyLibraryDocument(
  source: string,
  sourceInfo: XmlSource = { kind: 'library', label: 'in-memory library' },
): LegacyLibraryDocumentPlan {
  const document = parseRawXmlDocument(source);
  const descriptor = descriptorForRoot(document.root.name);
  const candidate = Element.parse(source);
  const context = new XmlLoadContext(candidate, sourceInfo);
  checkShape(candidate, [], [descriptor.categoryElement], context);
  const validateCategory = (node: Element, root: boolean): void => {
    checkShape(
      node,
      descriptor.libraryType === 'soundObject' ? ['categoryName'] : ['categoryName', 'isRoot'],
      [descriptor.categoryElement, descriptor.leafElement],
      context,
      [descriptor.categoryElement, descriptor.leafElement],
    );
    const name = node.getAttribute('categoryName');
    if (name === null || !name.trim())
      throw context.at(node).error({
        code: 'value',
        member: '@categoryName',
        value: name ?? '',
        message: 'Library category requires a nonempty name.',
        recovery: 'Supply a valid category name.',
      });
    const flag = node.getAttribute('isRoot');
    if (flag !== null && parseXmlBoolean(flag, context.at(node), '@isRoot') !== root)
      throw context.at(node).error({
        code: 'conflict',
        member: '@isRoot',
        value: flag,
        message: 'Category root flag disagrees with its structural position.',
        recovery: 'Correct the root flag.',
      });
    for (const child of node.getElements(descriptor.categoryElement))
      validateCategory(child, false);
  };
  const rootCategory = candidate.getElement(descriptor.categoryElement);
  if (rootCategory) validateCategory(rootCategory, true);
  const category = document.root.children.find(
    (child) => child.name === descriptor.categoryElement,
  );
  if (!category) {
    throw context.at(candidate).error({
      code: 'cardinality',
      member: descriptor.categoryElement,
      message: `Missing ${descriptor.categoryElement} root category`,
      recovery: 'Supply the complete library envelope.',
    });
  }

  const diagnostics: XmlDiagnostic[] = [];
  const root = parseFolder(
    descriptor,
    category,
    true,
    sourceInfo,
    `/${descriptor.rootElement}/${descriptor.categoryElement}[1]`,
    diagnostics,
  );
  const counts = walkCounts(root);
  return {
    libraryType: descriptor.libraryType,
    descriptor,
    root,
    folderCount: counts.folders,
    itemCount: counts.items,
    unsupportedCount: counts.unsupported,
    diagnostics,
    sourceRawHash: stableTextHash(source),
  };
}

function serializeFolder(
  descriptor: LegacyLibraryFormatDescriptor,
  folder: LegacyLibraryFolderPlan,
): string {
  const rootAttribute =
    descriptor.ordering === 'categoriesFirst'
      ? ` isRoot="${folder.isRoot ? 'true' : 'false'}"`
      : '';
  const open = `<${descriptor.categoryElement} categoryName="${escapeAttribute(folder.name)}"${rootAttribute}>`;
  const orderedChildren =
    descriptor.ordering === 'categoriesFirst'
      ? [
          ...folder.children.filter((child) => child.kind === 'folder'),
          ...folder.children.filter((child) => child.kind === 'item'),
        ]
      : folder.children;
  const body = orderedChildren
    .map((child) =>
      child.kind === 'folder' ? serializeFolder(descriptor, child) : child.payload.rawXml,
    )
    .join('');
  return `${open}${body}</${descriptor.categoryElement}>`;
}

export function exportLegacyLibraryDocument(plan: LegacyLibraryDocumentPlan): string {
  return `<${plan.descriptor.rootElement}>${serializeFolder(plan.descriptor, plan.root)}</${plan.descriptor.rootElement}>`;
}
