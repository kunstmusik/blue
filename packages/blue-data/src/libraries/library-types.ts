export const LIBRARY_TYPES = [
  'instrument',
  'udo',
  'soundObject',
  'effect',
] as const;

export type LibraryType = (typeof LIBRARY_TYPES)[number];
export type LibrarySupportStatus = 'supported' | 'unsupported';

export interface LegacyLibraryFormatDescriptor {
  readonly libraryType: LibraryType;
  readonly fileName: string;
  readonly rootElement: string;
  readonly categoryElement: string;
  readonly leafElement: string;
  readonly ordering: 'categoriesFirst' | 'mixed';
}

export const LEGACY_LIBRARY_FORMATS: Readonly<Record<LibraryType, LegacyLibraryFormatDescriptor>> = {
  instrument: {
    libraryType: 'instrument',
    fileName: 'userInstrumentLibrary.xml',
    rootElement: 'instrumentLibrary',
    categoryElement: 'instrumentCategory',
    leafElement: 'instrument',
    ordering: 'categoriesFirst',
  },
  udo: {
    libraryType: 'udo',
    fileName: 'udoLibrary.xml',
    rootElement: 'udoLibrary',
    categoryElement: 'udoCategory',
    leafElement: 'udo',
    ordering: 'categoriesFirst',
  },
  soundObject: {
    libraryType: 'soundObject',
    fileName: 'soundObjectLibrary.xml',
    rootElement: 'soundObjectLibrary',
    categoryElement: 'category',
    leafElement: 'soundObject',
    ordering: 'mixed',
  },
  effect: {
    libraryType: 'effect',
    fileName: 'effectsLibrary.xml',
    rootElement: 'effectsLibrary',
    categoryElement: 'effectCategory',
    leafElement: 'effect',
    ordering: 'categoriesFirst',
  },
};

export interface RawXmlElement {
  readonly name: string;
  readonly attributes: Readonly<Record<string, string>>;
  readonly startCodeUnit: number;
  readonly endCodeUnit: number;
  readonly rawXml: string;
  readonly text: string;
  readonly children: readonly RawXmlElement[];
}

export interface RawXmlDocument {
  readonly source: string;
  readonly root: RawXmlElement;
}

export interface LibraryPreviewField<T = string> {
  readonly state: 'available' | 'unavailable';
  readonly value?: T;
  readonly reason?: string;
}

export interface ClassifiedLibraryPayload {
  readonly embeddedName: string | null;
  readonly objectType: string;
  readonly supportStatus: LibrarySupportStatus;
  readonly supportReasonCode: string | null;
  readonly supportMessage: string | null;
  readonly rawXml: string;
  readonly rawHash: string;
  readonly canonicalContentHash: string;
  readonly preview: Readonly<Record<string, LibraryPreviewField<string | number>>>;
  readonly dependencies: {
    readonly itemOwned: readonly string[];
    readonly unresolvedExternal: readonly string[];
  };
}

export interface LegacyLibraryItemPlan {
  readonly kind: 'item';
  readonly displayName: string;
  readonly sourceIndex: number;
  readonly payload: ClassifiedLibraryPayload;
}

export interface LegacyLibraryFolderPlan {
  readonly kind: 'folder';
  readonly name: string;
  readonly isRoot: boolean;
  readonly sourceIndex: number;
  readonly children: readonly LegacyLibraryTreeNode[];
}

export type LegacyLibraryTreeNode = LegacyLibraryFolderPlan | LegacyLibraryItemPlan;

export interface LegacyLibraryDocumentPlan {
  readonly libraryType: LibraryType;
  readonly descriptor: LegacyLibraryFormatDescriptor;
  readonly root: LegacyLibraryFolderPlan;
  readonly folderCount: number;
  readonly itemCount: number;
  readonly unsupportedCount: number;
  readonly diagnostics: readonly string[];
  readonly sourceRawHash: string;
}

export function isLibraryType(value: unknown): value is LibraryType {
  return typeof value === 'string' && (LIBRARY_TYPES as readonly string[]).includes(value);
}
