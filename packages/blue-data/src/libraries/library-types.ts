import type { XmlDiagnostic } from '../serialization/xml-load';

/** Library resource categories recognized by Blue. */
export const LIBRARY_TYPES = ['instrument', 'udo', 'soundObject', 'effect'] as const;

/** Supported categories of reusable Blue library resources. */
export type LibraryType = (typeof LIBRARY_TYPES)[number];
/** Whether a classified item can be interpreted by the current implementation. */
export type LibrarySupportStatus = 'supported' | 'unsupported';

/** Names used to identify and parse one historical library XML format. */
export interface LegacyLibraryFormatDescriptor {
  /** Resource category encoded by this XML format. */
  readonly libraryType: LibraryType;
  /** Historical library filename for this resource category. */
  readonly fileName: string;
  /** Expected name of the document's outer XML element. */
  readonly rootElement: string;
  /** XML element name used to identify folders. */
  readonly categoryElement: string;
  /** XML element name used to identify library items. */
  readonly leafElement: string;
  /** Policy used to preserve or normalize the historical child order. */
  readonly ordering: 'categoriesFirst' | 'mixed';
}

/** Legacy file and XML names indexed by library resource category. */
export const LEGACY_LIBRARY_FORMATS: Readonly<Record<LibraryType, LegacyLibraryFormatDescriptor>> =
  {
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

/** Indexed XML element and source offsets for extracting its original text. */
export interface RawXmlElement {
  /** Qualified name as written in the source XML. */
  readonly name: string;
  /** Decoded attributes keyed by their XML names. */
  readonly attributes: Readonly<Record<string, string>>;
  /** Inclusive UTF-16 offset of the opening tag in the source document. */
  readonly startCodeUnit: number;
  /** Exclusive UTF-16 offset after this element's closing delimiter. */
  readonly endCodeUnit: number;
  /** Exact source text covered by this element's offsets. */
  readonly rawXml: string;
  /** Decoded character data associated with the element. */
  readonly text: string;
  /** Child elements in source order. */
  readonly children: readonly RawXmlElement[];
}

/** Original XML text and the source-indexed root element parsed from it. */
export interface RawXmlDocument {
  /** Original XML text used for source slices and offsets. */
  readonly source: string;
  /** Root element of the indexed source document. */
  readonly root: RawXmlElement;
}

/** A preview value when available, or a reason why it could not be extracted. */
export interface LibraryPreviewField<T = string> {
  /** Availability of the requested preview field. */
  readonly state: 'available' | 'unavailable';
  /** Value associated with the successful result. */
  readonly value?: T;
  /** Explanation of why the requested value is unavailable. */
  readonly reason?: string;
}

/** Metadata, source XML, and support classification for one library item. */
export interface ClassifiedLibraryPayload {
  /** Name embedded in the resource XML, or null when absent. */
  readonly embeddedName: string | null;
  /** Resource type identifier discovered in the XML. */
  readonly objectType: string;
  /** Whether the current implementation supports this resource shape. */
  readonly supportStatus: LibrarySupportStatus;
  /** Machine-readable reason for the support classification. */
  readonly supportReasonCode: string | null;
  /** Human-readable explanation of the support classification. */
  readonly supportMessage: string | null;
  /** Diagnostics collected while processing the input. */
  readonly diagnostics?: readonly XmlDiagnostic[];
  /** Original resource XML retained for round trips. */
  readonly rawXml: string;
  /** Hash of the input XML text as supplied. */
  readonly rawHash: string;
  /** Hash of canonicalized content when available for comparison. */
  readonly canonicalContentHash: string;
  /** Extracted display fields made available for previews. */
  readonly preview: Readonly<Record<string, LibraryPreviewField<string | number>>>;
  /** Dependencies belonging to this classified library payload, in stored order. */
  readonly dependencies: {
    /** References carried by the resource itself. */
    readonly itemOwned: readonly string[];
    /** References requiring resolution outside this resource. */
    readonly unresolvedExternal: readonly string[];
  };
}

/** One classified item in a parsed legacy library import tree. */
export interface LegacyLibraryItemPlan {
  /** Discriminant identifying the `item` variant. */
  readonly kind: 'item';
  /** Human-readable display label. */
  readonly displayName: string;
  /** Position of this element in the source document. */
  readonly sourceIndex: number;
  /** Classified resource content and metadata from the source leaf. */
  readonly payload: ClassifiedLibraryPayload;
}

/** One folder in a parsed legacy library import tree. */
export interface LegacyLibraryFolderPlan {
  /** Discriminant identifying the `folder` variant. */
  readonly kind: 'folder';
  /** Name associated with the legacy library folder plan. */
  readonly name: string;
  /** Marks the top-level library folder. */
  readonly isRoot: boolean;
  /** Position of this element in the source document. */
  readonly sourceIndex: number;
  /** Child entries belonging to this legacy library folder plan, in stored order. */
  readonly children: readonly LegacyLibraryTreeNode[];
}

/** A parsed folder or item in a historical library document. */
export type LegacyLibraryTreeNode = LegacyLibraryFolderPlan | LegacyLibraryItemPlan;

/** Parsed library import plan with its detected format, tree, and counts. */
export interface LegacyLibraryDocumentPlan {
  /** Detected resource category of the library. */
  readonly libraryType: LibraryType;
  /** Historical XML format used to parse the document. */
  readonly descriptor: LegacyLibraryFormatDescriptor;
  /** Top-level element or container. */
  readonly root: LegacyLibraryFolderPlan;
  /** Number of folders counted in the import. */
  readonly folderCount: number;
  /** Number of items counted in the import. */
  readonly itemCount: number;
  /** Number of items with unsupported payloads. */
  readonly unsupportedCount: number;
  /** Diagnostics collected while processing the input. */
  readonly diagnostics: readonly XmlDiagnostic[];
  /** Hash of the input XML used to build the import plan. */
  readonly sourceRawHash: string;
}

/** Checks whether the supplied value is a supported library type. */
export function isLibraryType(value: unknown): value is LibraryType {
  return typeof value === 'string' && (LIBRARY_TYPES as readonly string[]).includes(value);
}
