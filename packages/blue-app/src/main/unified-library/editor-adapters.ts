import {
  BlueData,
  Effect,
  Element,
  OpcodeDefinition,
  PolyObject,
  loadInstrumentFromXML,
  loadSoundObjectFromXML,
} from '@blue/data';
import type { Instrument, SoundObject } from '@blue/data';
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
}

function unsupported(
  libraryType: LibraryType,
  objectType: string,
  rawXml: string,
): LibraryEditorDocument {
  return {
    kind: 'unsupported',
    libraryType,
    objectType,
    message: 'This item is preserved but cannot be edited safely by this version of Blue.',
    rawXml,
  };
}

function loadInstrument(payloadXml: string): Instrument {
  const value = loadInstrumentFromXML(Element.parse(payloadXml));
  if (!value) throw new Error('Unsupported Instrument payload');
  return value;
}

function loadSoundObject(payloadXml: string): SoundObject {
  const value = loadSoundObjectFromXML(Element.parse(payloadXml));
  if (!value) throw new Error('Unsupported SoundObject payload');
  return value;
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
  const target = createScoreDocumentSnapshot(data).layerGroups[0]?.layers[0]?.items[0]?.editorTarget;
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
  ): LibraryEditorDocument {
    if (supportStatus === 'unsupported') return unsupported(libraryType, objectType, payloadXml);
    try {
      switch (libraryType) {
        case 'instrument':
          return { kind: 'instrument', snapshot: createInstrumentSnapshot('library-item', loadInstrument(payloadXml)) };
        case 'udo':
          return { kind: 'udo', snapshot: udoToSnapshot(OpcodeDefinition.loadFromXML(Element.parse(payloadXml))) };
        case 'effect': {
          const value = Effect.loadFromXML(Element.parse(payloadXml));
          return { kind: 'effect', snapshot: createEffectEditorSnapshot(value, 'library-item', 'library') };
        }
        case 'soundObject':
          return createSoundObjectDocument(loadSoundObject(payloadXml));
      }
    } catch {
      return unsupported(libraryType, objectType, payloadXml);
    }
  }

  applyPatch(
    libraryType: LibraryType,
    payloadXml: string,
    documentPatch: LibraryEditorDocumentPatch,
  ): AppliedLibraryEditorPatch {
    if (documentPatch.kind !== libraryType) throw new Error('Library editor patch type mismatch');
    switch (documentPatch.kind) {
      case 'instrument': {
        const data = new BlueData();
        data.getArrangement().addInstrument(loadInstrument(payloadXml), 'library-item');
        if (!applyProjectDocumentPatch(data, { orchestra: documentPatch.patch })) {
          throw new Error('Instrument patch did not apply');
        }
        const value = data.getArrangement().getInstrumentById('library-item');
        if (!value) throw new Error('Instrument editor source is missing');
        const nextXml = value.saveAsXML().toXml();
        return {
          document: { kind: 'instrument', snapshot: createInstrumentSnapshot('library-item', value) },
          payloadXml: nextXml,
        };
      }
      case 'udo': {
        const data = new BlueData();
        data.getOpcodeList().addOpcode(OpcodeDefinition.loadFromXML(Element.parse(payloadXml)));
        if (!applyProjectDocumentPatch(data, { projectUdo: documentPatch.patch })) {
          throw new Error('UDO patch did not apply');
        }
        const value = data.getOpcodeList().getOpcodes()[0];
        if (!value) throw new Error('UDO editor source is missing');
        const nextXml = value.saveAsXML().toXml();
        return { document: { kind: 'udo', snapshot: udoToSnapshot(value) }, payloadXml: nextXml };
      }
      case 'effect': {
        const value = Effect.loadFromXML(Element.parse(payloadXml));
        if (!applyEffectEditablePatchToEffect(value, documentPatch.patch)) {
          throw new Error('Effect patch did not apply');
        }
        const nextXml = value.saveAsXML().toXml();
        return {
          document: { kind: 'effect', snapshot: createEffectEditorSnapshot(value, 'library-item', 'library') },
          payloadXml: nextXml,
        };
      }
      case 'soundObject': {
        const data = createSoundObjectWorkspace(loadSoundObject(payloadXml));
        if (!applyProjectDocumentPatch(data, { score: documentPatch.patch })) {
          throw new Error('SoundObject patch did not apply');
        }
        const root = data.getScore()[0];
        const value = root instanceof PolyObject ? root[0]?.[0] : undefined;
        if (!value) throw new Error('SoundObject editor source is missing');
        return { document: createSoundObjectDocument(value), payloadXml: value.saveAsXML().toXml() };
      }
    }
  }
}
