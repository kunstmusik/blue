import { AbstractSoundObject } from './abstract-sound-object';
import { BSBCompilationUnit } from '../instruments/blue-synth-builder/bsb-compilation-unit';
import { BSBGraphicInterface } from '../instruments/blue-synth-builder/bsb-graphic-interface';
import { PresetGroup } from '../instruments/blue-synth-builder/preset-group';
import { CompileData } from '../compile-data';
import { NoteList } from './note-list';
import { TimeContext } from '../time/time-context';
import { Element } from '../serialization/xml-reader';
import { ObjRefLoadMap, ObjRefSaveMap } from '../serialization/obj-ref-map';
import { SoundObject } from './sound-object';
import { getBasicXML, initBasicFromXML } from './sound-object-utilities';
import { applyNoteProcessorChainAsync, applyTimeBehavior, getNotes, setScoreStart } from '../utilities/score';
import { getJavaRuntimeClient, type JavaRuntimeError } from '../java-runtime';

export type ObjectBuilderLanguageType = 'PYTHON' | 'JAVASCRIPT' | 'CLOJURE' | 'EXTERNAL';

const OBJECT_BUILDER_LANGUAGE_TYPES: ReadonlySet<string> = new Set([
  'PYTHON',
  'JAVASCRIPT',
  'CLOJURE',
  'EXTERNAL',
]);

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

export class ObjectBuilder extends AbstractSoundObject {
  private graphicInterface = new BSBGraphicInterface();
  private presetGroup = new PresetGroup();
  private code = '';
  private commandLine = '';
  private editEnabled = true;
  private comment = '';
  private languageType: ObjectBuilderLanguageType = 'PYTHON';

  constructor(other?: ObjectBuilder) {
    super();
    this.setName('ObjectBuilder');

    if (other) {
      this.copyFrom(other);
      this.graphicInterface = other.graphicInterface.deepCopy();
      this.presetGroup = other.presetGroup.deepCopy();
      this.code = other.code;
      this.commandLine = other.commandLine;
      this.editEnabled = other.editEnabled;
      this.comment = other.comment;
      this.languageType = other.languageType;
    }
  }

  getGraphicInterface(): BSBGraphicInterface {
    return this.graphicInterface;
  }

  setGraphicInterface(graphicInterface: BSBGraphicInterface): void {
    this.graphicInterface = graphicInterface;
  }

  getPresetGroup(): PresetGroup {
    return this.presetGroup;
  }

  setPresetGroup(presetGroup: PresetGroup): void {
    this.presetGroup = presetGroup;
  }

  getCode(): string {
    return this.code;
  }

  setCode(code: string): void {
    this.code = code ?? '';
  }

  getCommandLine(): string {
    return this.commandLine;
  }

  setCommandLine(commandLine: string): void {
    this.commandLine = commandLine ?? '';
  }

  isEditEnabled(): boolean {
    return this.editEnabled;
  }

  setEditEnabled(editEnabled: boolean): void {
    this.editEnabled = editEnabled;
  }

  getComment(): string {
    return this.comment;
  }

  setComment(comment: string): void {
    this.comment = comment ?? '';
  }

  getLanguageType(): ObjectBuilderLanguageType {
    return this.languageType;
  }

  setLanguageType(languageType: string): void {
    const normalized = (languageType ?? '').trim().toUpperCase();
    this.languageType = OBJECT_BUILDER_LANGUAGE_TYPES.has(normalized)
      ? normalized as ObjectBuilderLanguageType
      : 'PYTHON';
  }

  isPythonLanguage(): boolean {
    return this.languageType === 'PYTHON';
  }

  private compileCode(): string {
    const unit = new BSBCompilationUnit();
    this.graphicInterface.collectReplacements(unit);
    return unit.replaceBSBValues(this.code);
  }

  override generateForCSD(
    _context: TimeContext,
    _compileData: CompileData,
    _startTime: number,
    _endTime: number,
  ): NoteList {
    if (!this.isPythonLanguage()) {
      console.warn(`ObjectBuilder.generateForCSD skipped: unsupported language ${this.languageType}`);
      return new NoteList();
    }

    console.warn('ObjectBuilder.generateForCSD skipped: requires Java runtime');
    return new NoteList();
  }

  async generateForCSDAsync(
    context: TimeContext,
    compileData: CompileData,
    _startTime: number,
    _endTime: number,
  ): Promise<NoteList> {
    if (!this.isPythonLanguage()) {
      throw new Error(`ObjectBuilder only supports Python execution in this build (found ${this.languageType})`);
    }

    const runtimeClient = getJavaRuntimeClient(compileData);
    if (!runtimeClient) {
      throw new Error('ObjectBuilder.generateForCSDAsync requires a Java runtime session');
    }

    const response = await runtimeClient.evaluateJythonObjectBuilder({
      code: this.compileCode(),
      blueDuration: this.getSubjectiveDuration().toBeats(context),
      commandline: this.commandLine,
    });

    if (!response.ok) {
      throw new Error(formatRuntimeError('Failed to evaluate ObjectBuilder', response.error));
    }

    const noteList = getNotes(response.result?.scoreText ?? '');
    const processed = await applyNoteProcessorChainAsync(noteList, this.getNoteProcessorChain(), compileData);
    const duration = this.getSubjectiveDuration().toBeats(context);
    const startTime = this.getStartTime().toBeats(context);
    const repeatPoint = this.getRepeatPoint();
    const repeatPointBeats = repeatPoint ? repeatPoint.toBeats(context) : -1;

    applyTimeBehavior(processed, this.getTimeBehavior(), duration, repeatPointBeats);
    setScoreStart(processed, startTime);

    return processed;
  }

  override saveAsXML(_objRefMap?: ObjRefSaveMap): Element {
    const elem = getBasicXML(this, 'blue.soundObject.ObjectBuilder');
    elem.setAttribute('editEnabled', this.editEnabled.toString());
    elem.addElement('code').setText(this.code);
    elem.addElement('commandLine').setText(this.commandLine);
    elem.addElement(this.graphicInterface.saveAsXML());
    elem.addElement(this.presetGroup.saveAsXML());
    elem.addElement('comment').setText(this.comment);
    elem.addElement('languageType').setText(this.languageType);
    return elem;
  }

  static loadFromXML(data: Element, _objRefMap?: ObjRefLoadMap): ObjectBuilder {
    const builder = new ObjectBuilder();
    initBasicFromXML(builder, data);

    const editEnabled = data.getAttribute('editEnabled');
    if (editEnabled !== null) {
      builder.setEditEnabled(editEnabled === 'true');
    }

    const nodes = data.getElements();
    while (nodes.hasMoreElements()) {
      const node = nodes.next();
      const nodeName = node.getName();
      switch (nodeName) {
        case 'code':
          builder.setCode(node.getTextString() ?? '');
          break;
        case 'commandLine':
          builder.setCommandLine(node.getTextString() ?? '');
          break;
        case 'isExternal':
          builder.setLanguageType(node.getTextString() === 'true' ? 'EXTERNAL' : 'PYTHON');
          break;
        case 'graphicInterface': {
          const graphicInterface = new BSBGraphicInterface();
          graphicInterface.loadFromXML(node);
          builder.setGraphicInterface(graphicInterface);
          break;
        }
        case 'presetGroup':
          builder.setPresetGroup(PresetGroup.loadFromXML(node));
          break;
        case 'comment':
          builder.setComment(node.getTextString() ?? '');
          break;
        case 'languageType':
          builder.setLanguageType(node.getTextString() ?? 'PYTHON');
          break;
      }
    }

    return builder;
  }

  override deepCopy(): SoundObject {
    return new ObjectBuilder(this);
  }
}