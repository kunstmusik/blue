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
): LegacyLibraryFolderPlan {
  const children: LegacyLibraryTreeNode[] = [];
  let sourceIndex = 0;
  for (const child of element.children) {
    if (child.name === descriptor.categoryElement) {
      children.push(parseFolder(descriptor, child, false));
    } else if (child.name === descriptor.leafElement) {
      const payload = classifyLibraryPayload(descriptor.libraryType, child);
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

export function parseLegacyLibraryDocument(source: string): LegacyLibraryDocumentPlan {
  const document = parseRawXmlDocument(source);
  const descriptor = descriptorForRoot(document.root.name);
  const category = document.root.children.find(
    (child) => child.name === descriptor.categoryElement,
  );
  if (!category) {
    throw new Error(`Missing ${descriptor.categoryElement} root category`);
  }

  const root = parseFolder(descriptor, category, true);
  const counts = walkCounts(root);
  return {
    libraryType: descriptor.libraryType,
    descriptor,
    root,
    folderCount: counts.folders,
    itemCount: counts.items,
    unsupportedCount: counts.unsupported,
    diagnostics: [],
    sourceRawHash: stableTextHash(source),
  };
}

function serializeFolder(
  descriptor: LegacyLibraryFormatDescriptor,
  folder: LegacyLibraryFolderPlan,
): string {
  const rootAttribute = descriptor.ordering === 'categoriesFirst'
    ? ` isRoot="${folder.isRoot ? 'true' : 'false'}"`
    : '';
  const open = `<${descriptor.categoryElement} categoryName="${escapeAttribute(folder.name)}"${rootAttribute}>`;
  const orderedChildren = descriptor.ordering === 'categoriesFirst'
    ? [
        ...folder.children.filter((child) => child.kind === 'folder'),
        ...folder.children.filter((child) => child.kind === 'item'),
      ]
    : folder.children;
  const body = orderedChildren
    .map((child) =>
      child.kind === 'folder'
        ? serializeFolder(descriptor, child)
        : child.payload.rawXml,
    )
    .join('');
  return `${open}${body}</${descriptor.categoryElement}>`;
}

export function exportLegacyLibraryDocument(plan: LegacyLibraryDocumentPlan): string {
  return `<${plan.descriptor.rootElement}>${serializeFolder(plan.descriptor, plan.root)}</${plan.descriptor.rootElement}>`;
}
