import type {
  EffectEditorSnapshot,
  InstrumentSnapshot,
  ScoreObjectEditorDocumentSnapshot,
  UdoDefinitionSnapshot,
} from '../../shared/project-editor';
import type {
  LibraryEditorDocument,
  LibraryEditorDocumentKind,
} from '../../shared/library-editor-document';
import type { LibraryEditorSessionSnapshot } from '../../shared/unified-library';

export const instrumentDocument: LibraryEditorDocument = {
  kind: 'instrument',
  snapshot: {
    assignmentId: 'library-item',
    type: 'generic',
    name: 'Warm Pad',
    enabled: true,
    comment: '',
    text: 'a1 oscili 0.2, 440',
    globalOrc: '',
    globalSco: '',
    udolist: [
      {
        name: 'LibraryInstrumentUDO',
        style: 'CLASSIC',
        outTypes: 'a',
        inTypes: 'a',
        inputArguments: '',
        code: '',
        comments: '',
      },
    ],
  } satisfies InstrumentSnapshot,
};

export const udoDocument: LibraryEditorDocument = {
  kind: 'udo',
  snapshot: {
    name: 'SoftClip',
    style: 'CLASSIC',
    outTypes: 'a',
    inTypes: 'a',
    inputArguments: '',
    code: 'aout = tanh(ain)\nxout aout',
    comments: '',
  } satisfies UdoDefinitionSnapshot,
};

export const effectDocument: LibraryEditorDocument = {
  kind: 'effect',
  snapshot: {
    effectId: 'library-item',
    ownerType: 'library',
    effectXml: '',
    name: 'Delay',
    enabled: true,
    numIns: 2,
    numOuts: 2,
    style: 'CLASSIC',
    code: 'aout = ain',
    comments: '',
    editEnabled: false,
    gridSettings: { enabled: true, snapEnabled: true, width: 10, height: 10 },
    objectNames: [],
    widgets: [],
    widgetTree: { id: 'root', type: 'BSBRootGroup', objectName: '', value: 0, minimum: 0, maximum: 1, properties: {}, children: [] },
    udos: [
      {
        name: 'LibraryEffectUDO',
        style: 'CLASSIC',
        outTypes: 'a',
        inTypes: 'a',
        inputArguments: '',
        code: '',
        comments: '',
      },
    ],
    projectUdos: [],
  } satisfies EffectEditorSnapshot,
};

export function createLibraryEditorSession(
  document: LibraryEditorDocument = instrumentDocument,
  overrides: Partial<LibraryEditorSessionSnapshot> = {},
): LibraryEditorSessionSnapshot {
  const kind = document.kind as Exclude<LibraryEditorDocumentKind, 'unsupported'>;
  return {
    sessionId: `session-${kind}`,
    key: { scope: 'user', libraryType: kind, nodeId: `node-${kind}` },
    displayName: 'Library Item',
    objectType: kind,
    breadcrumb: ['User Libraries', kind, 'Library Item'],
    baseRevision: 1,
    document,
    dirty: false,
    pinned: false,
    status: 'ready',
    ...overrides,
  };
}

export function createSoundObjectDocument(
  snapshot: ScoreObjectEditorDocumentSnapshot,
): LibraryEditorDocument {
  return { kind: 'soundObject', snapshot };
}
