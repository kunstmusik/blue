import {
  BlueData,
  Effect,
  OpcodeDefinition,
  PolyObject,
  readResourceXml,
  XmlLoadError,
} from '@blue/data';
import type { Instrument, SoundObject, XmlDiagnostic, XmlSource } from '@blue/data';
import type {
  LibraryEditorDocument,
  LibraryEditorDocumentPatch,
} from '../../shared/library-editor-document';
import {
  applyEffectEditablePatchToEffect,
  applyProjectDocumentPatch,
  createEffectEditorSnapshot,
  createInstrumentSnapshot,
  createScoreDocumentSnapshot,
  createScoreObjectEditorDocument,
  udoToSnapshot,
} from '../../shared/project-editor';
import type { LibrarySupportStatus, LibraryType } from '../../shared/unified-library';

export interface AppliedLibraryEditorPatch {
  readonly document: LibraryEditorDocument;
  readonly payloadXml: string;
  readonly diagnostics?: readonly XmlDiagnostic[];
}

function unsupported(
  libraryType: LibraryType,
  objectType: string,
  rawXml: string,
  diagnostics: readonly XmlDiagnostic[] = [],
): LibraryEditorDocument {
  return {
    kind: 'unsupported',
    libraryType,
    objectType,
    message: 'This item is preserved but cannot be edited safely by this version of Blue.',
    rawXml,
    ...(diagnostics.length ? { diagnostics } : {}),
  };
}

function createSoundObjectWorkspace(value: SoundObject): BlueData {
  const data = new BlueData();
  const root = data.getScore()[0];
  if (!(root instanceof PolyObject) || !root[0]) {
    throw new Error('Unable to create SoundObject editor workspace');
  }
  root[0].push(value);
  return data;
}

function createSoundObjectDocument(value: SoundObject): LibraryEditorDocument {
  const data = createSoundObjectWorkspace(value);
  const target =
    createScoreDocumentSnapshot(data).layerGroups[0]?.layers[0]?.items[0]?.editorTarget;
  if (!target) throw new Error('Unable to create SoundObject editor target');
  const snapshot = createScoreObjectEditorDocument(data, { target });
  if (!snapshot) throw new Error('Unable to create SoundObject editor document');
  return { kind: 'soundObject', snapshot };
}

export class LibraryEditorAdapterRegistry {
  hydrate(
    libraryType: LibraryType,
    payloadXml: string,
    objectType: string,
    supportStatus: LibrarySupportStatus,
    source: XmlSource = { kind: 'library', label: `${libraryType} library item` },
  ): LibraryEditorDocument {
    const report = readResourceXml(libraryType, payloadXml, source);
    if (!report.ok || supportStatus === 'unsupported')
      return unsupported(libraryType, objectType, payloadXml, report.diagnostics);
    const value = report.value;
    const diagnostics = report.diagnostics;
    try {
      switch (libraryType) {
        case 'instrument':
          return {
            kind: 'instrument',
            snapshot: createInstrumentSnapshot('library-item', value as Instrument),
            diagnostics,
          };
        case 'udo':
          return {
            kind: 'udo',
            snapshot: udoToSnapshot(value as OpcodeDefinition),
            diagnostics,
          };
        case 'effect': {
          return {
            kind: 'effect',
            diagnostics,
            snapshot: createEffectEditorSnapshot(value as Effect, 'library-item', 'library'),
          };
        }
        case 'soundObject':
          return { ...createSoundObjectDocument(value as SoundObject), diagnostics };
      }
    } catch (error) {
      if (error instanceof XmlLoadError)
        return unsupported(libraryType, objectType, payloadXml, error.diagnostics);
      throw error;
    }
  }

  applyPatch(
    libraryType: LibraryType,
    payloadXml: string,
    documentPatch: LibraryEditorDocumentPatch,
    source: XmlSource = { kind: 'library', label: `${libraryType} library item` },
  ): AppliedLibraryEditorPatch {
    if (documentPatch.kind !== libraryType) throw new Error('Library editor patch type mismatch');
    const report = readResourceXml(libraryType, payloadXml, source);
    if (!report.ok) throw new XmlLoadError(report.diagnostics);
    const accepted = report.value;
    const diagnostics = report.diagnostics;
    const finish = (
      document: LibraryEditorDocument,
      nextXml: string,
    ): AppliedLibraryEditorPatch => {
      const next = readResourceXml(libraryType, nextXml, source);
      if (!next.ok) throw new XmlLoadError(next.diagnostics);
      const allDiagnostics = [...diagnostics, ...next.diagnostics];
      return {
        document: { ...document, diagnostics: allDiagnostics },
        payloadXml: nextXml,
        diagnostics: allDiagnostics,
      };
    };
    switch (documentPatch.kind) {
      case 'instrument': {
        const data = new BlueData();
        data.getArrangement().addInstrument(accepted as Instrument, 'library-item');
        if (!applyProjectDocumentPatch(data, { orchestra: documentPatch.patch })) {
          throw new Error('Instrument patch did not apply');
        }
        const value = data.getArrangement().getInstrumentById('library-item');
        if (!value) throw new Error('Instrument editor source is missing');
        const nextXml = value.saveAsXML().toXml();
        return finish(
          { kind: 'instrument', snapshot: createInstrumentSnapshot('library-item', value) },
          nextXml,
        );
      }
      case 'udo': {
        const data = new BlueData();
        data.getOpcodeList().addOpcode(accepted as OpcodeDefinition);
        if (!applyProjectDocumentPatch(data, { projectUdo: documentPatch.patch })) {
          throw new Error('UDO patch did not apply');
        }
        const value = data.getOpcodeList().getOpcodes()[0];
        if (!value) throw new Error('UDO editor source is missing');
        const nextXml = value.saveAsXML().toXml();
        return finish({ kind: 'udo', snapshot: udoToSnapshot(value) }, nextXml);
      }
      case 'effect': {
        const value = accepted as Effect;
        if (!applyEffectEditablePatchToEffect(value, documentPatch.patch)) {
          throw new Error('Effect patch did not apply');
        }
        const nextXml = value.saveAsXML().toXml();
        return finish(
          {
            kind: 'effect',
            snapshot: createEffectEditorSnapshot(value, 'library-item', 'library'),
          },
          nextXml,
        );
      }
      case 'soundObject': {
        const data = createSoundObjectWorkspace(accepted as SoundObject);
        if (!applyProjectDocumentPatch(data, { score: documentPatch.patch })) {
          throw new Error('SoundObject patch did not apply');
        }
        const root = data.getScore()[0];
        const value = root instanceof PolyObject ? root[0]?.[0] : undefined;
        if (!value) throw new Error('SoundObject editor source is missing');
        return finish(createSoundObjectDocument(value), value.saveAsXML().toXml());
      }
    }
  }
}
