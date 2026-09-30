import { Element } from '../serialization/xml-reader';
import { Note } from '../sound-objects/note';
import type { FileSeekProvenance } from '../sound-objects/note';
import { NoteList } from '../sound-objects/note-list';
import type { CompileData } from '../compile-data';
import {
  getJavaRuntimeClient,
  type JavaRuntimeError,
  type JythonSerializedNote,
} from '../java-runtime';
import { NoteProcessor } from './note-processor';
import { NoteProcessorException } from './note-processor-exception';

const JAVA_TYPE = 'blue.noteProcessor.PythonProcessor';

function formatRuntimeError(message: string, error?: JavaRuntimeError): string {
  const baseMessage = error?.message?.trim().length ? error.message : message;
  if (error?.line == null) {
    return baseMessage;
  }

  if (error.column == null) {
    return `${baseMessage} (line ${error.line})`;
  }

  return `${baseMessage} (line ${error.line}, column ${error.column})`;
}

function serializeNoteList(notes: NoteList): {
  serialized: JythonSerializedNote[];
  fileSeekProvenanceById: Map<string, FileSeekProvenance>;
} {
  const serialized: JythonSerializedNote[] = [];
  const fileSeekProvenanceById = new Map<string, FileSeekProvenance>();

  for (const [index, note] of [...notes].entries()) {
    const pfields: string[] = [];
    for (let i = 1; i <= note.getPCount(); i++) {
      pfields.push(note.getPField(i) ?? '');
    }

    const fileSeekProvenance = note.getFileSeekProvenance();
    const renderMetadataId = fileSeekProvenance ? `file-seek-${index}` : undefined;
    if (renderMetadataId && fileSeekProvenance) {
      fileSeekProvenanceById.set(renderMetadataId, fileSeekProvenance);
    }

    serialized.push({
      pfields,
      subjectiveDuration: note.getSubjectiveDuration(),
      tied: note.isTiedNote(),
      ...(renderMetadataId ? { renderMetadataId } : {}),
    });
  }

  return { serialized, fileSeekProvenanceById };
}

function deserializeNoteList(
  notes: JythonSerializedNote[],
  fileSeekProvenanceById: ReadonlyMap<string, FileSeekProvenance>,
): NoteList {
  const noteList = new NoteList();

  for (const serialized of notes) {
    const count = Math.max(serialized.pfields.length, 3);
    const note = Note.createBlank(count);

    for (let i = 0; i < serialized.pfields.length; i++) {
      note.setPField(serialized.pfields[i] ?? '', i + 1);
    }

    note.setSubjectiveDuration(serialized.subjectiveDuration);
    note.setTied(serialized.tied);
    if (serialized.renderMetadataId) {
      const provenance = fileSeekProvenanceById.get(serialized.renderMetadataId);
      if (provenance) note.setFileSeekProvenance(provenance);
    }
    noteList.add(note);
  }

  return noteList;
}

export const DEFAULT_PYTHON_PROCESSOR_CODE = `# Example: scale duration (p3) by 0.95 for each note
# for note in noteList:
#     p3 = float(note.getPField(3))
#     note.setPField(str(p3 * 0.95), 3)
`;

export class PythonProcessor extends NoteProcessor {
  private code = '';

  getCode(): string {
    return this.code;
  }

  setCode(code: string): void {
    this.code = code ?? '';
  }

  override process(notes: NoteList): NoteList {
    console.warn('PythonProcessor.process skipped: requires Java runtime');
    return notes;
  }

  override async processAsync(notes: NoteList, compileData?: CompileData): Promise<NoteList> {
    if (!compileData) {
      throw new NoteProcessorException('PythonProcessor requires a Java runtime session', -1);
    }

    const runtimeClient = getJavaRuntimeClient(compileData);
    if (!runtimeClient) {
      throw new NoteProcessorException('PythonProcessor requires a Java runtime session', -1);
    }

    const { serialized, fileSeekProvenanceById } = serializeNoteList(notes);
    const response = await runtimeClient.processJythonNoteList({
      code: this.code,
      notes: serialized,
    });

    if (!response.ok) {
      throw new NoteProcessorException(
        formatRuntimeError('Failed to evaluate PythonProcessor', response.error),
        -1,
      );
    }

    return deserializeNoteList(response.result?.notes ?? [], fileSeekProvenanceById);
  }

  override getDisplayName(): string {
    return 'PythonProcessor';
  }

  override deepCopy(): PythonProcessor {
    const copy = new PythonProcessor();
    copy.code = this.code;
    return copy;
  }

  override saveAsXML(): Element {
    const elem = new Element('noteProcessor');
    elem.setAttribute('type', JAVA_TYPE);
    elem.addElement('code').setText(this.code);
    return elem;
  }

  static loadFromXML(data: Element): PythonProcessor {
    const processor = new PythonProcessor();
    const code = data.getTextString('code');
    if (code !== null) {
      processor.code = code;
    }
    return processor;
  }
}
