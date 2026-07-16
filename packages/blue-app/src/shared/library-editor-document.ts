import type {
  EffectEditablePatch,
  EffectEditorSnapshot,
  InstrumentSnapshot,
  OrchestraPatch,
  ProjectUdoPatch,
  ScoreObjectEditorDocumentSnapshot,
  ScorePatch,
  UdoDefinitionSnapshot,
} from './project-editor';
import type { LibraryType } from './unified-library';

export type LibraryEditorDocumentKind = LibraryType | 'unsupported';

export type LibraryEditorDocument =
  | { readonly kind: 'instrument'; readonly snapshot: InstrumentSnapshot }
  | { readonly kind: 'udo'; readonly snapshot: UdoDefinitionSnapshot }
  | { readonly kind: 'effect'; readonly snapshot: EffectEditorSnapshot }
  | { readonly kind: 'soundObject'; readonly snapshot: ScoreObjectEditorDocumentSnapshot }
  | {
      readonly kind: 'unsupported';
      readonly libraryType: LibraryType;
      readonly objectType: string;
      readonly message: string;
      readonly rawXml: string;
    };

export type LibraryEditorDocumentPatch =
  | { readonly kind: 'instrument'; readonly patch: OrchestraPatch }
  | { readonly kind: 'udo'; readonly patch: ProjectUdoPatch }
  | { readonly kind: 'effect'; readonly patch: EffectEditablePatch }
  | { readonly kind: 'soundObject'; readonly patch: ScorePatch };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isLibraryType(value: unknown): value is LibraryType {
  return value === 'instrument' || value === 'udo' || value === 'effect' || value === 'soundObject';
}

export function isLibraryEditorDocument(value: unknown): value is LibraryEditorDocument {
  if (!isRecord(value) || typeof value.kind !== 'string') return false;
  if (value.kind === 'unsupported') {
    return isLibraryType(value.libraryType)
      && typeof value.objectType === 'string'
      && typeof value.message === 'string'
      && typeof value.rawXml === 'string';
  }
  return isLibraryType(value.kind) && isRecord(value.snapshot);
}

export function isLibraryEditorDocumentPatch(value: unknown): value is LibraryEditorDocumentPatch {
  return isRecord(value)
    && isLibraryType(value.kind)
    && isRecord(value.patch);
}
