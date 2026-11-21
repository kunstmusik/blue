import { AbstractSoundObject } from './abstract-sound-object';
import { BSBCompilationUnit } from '../instruments/blue-synth-builder/bsb-compilation-unit';
import { BSBGraphicInterface } from '../instruments/blue-synth-builder/bsb-graphic-interface';
import { PresetGroup } from '../instruments/blue-synth-builder/preset-group';
import { CompileData } from '../compile-data';
import { NoteList } from './note-list';
import { TimeContext } from '../time/time-context';
import { Element } from '../serialization/xml-reader';
import { XmlLoadContext, requireXmlValue, type XmlDiagnosticSink } from '../serialization/xml-load';
import { checkShape, readText, readBoolean, readEnum, parseXmlBoolean } from '../utilities/xml';
import { BASIC_SOUND_OBJECT_CHILDREN } from './sound-object-utilities';
import { ObjRefLoadMap, ObjRefSaveMap } from '../serialization/obj-ref-map';
import { SoundObject } from './sound-object';
import { getBasicXML, initBasicFromXML } from './sound-object-utilities';
import {
  applyNoteProcessorChain,
  applyNoteProcessorChainAsync,
  applyTimeBehavior,
  getNotes,
  setScoreStart,
} from '../utilities/score';
import { getJavaRuntimeClient, type JavaRuntimeError } from '../java-runtime';
import { executeJavaScriptCode } from './javascript-object';
import { getExternalCommandExecutor } from './external';
import type { CopyMode } from '../deep-copyable';

/** Script or external execution backends supported by ObjectBuilder. */
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

  /** Creates a default object builder or copies a supplied instance. The copy mode controls identity preservation. */
  constructor(other?: ObjectBuilder, mode: CopyMode = 'duplication') {
    super();
    this.setName('ObjectBuilder');

    if (other) {
      this.copyFrom(other);
      this.graphicInterface = other.graphicInterface.deepCopy(mode);
      this.presetGroup = other.presetGroup.deepCopy(mode);
      this.code = other.code;
      this.commandLine = other.commandLine;
      this.editEnabled = other.editEnabled;
      this.comment = other.comment;
      this.languageType = other.languageType;
    }
  }

  /** Returns the editable BlueSynthBuilder graphics model. */
  getGraphicInterface(): BSBGraphicInterface {
    return this.graphicInterface;
  }

  /** Sets the editable BlueSynthBuilder graphics model. */
  setGraphicInterface(graphicInterface: BSBGraphicInterface): void {
    this.graphicInterface = graphicInterface;
  }

  /** Returns the preset hierarchy. */
  getPresetGroup(): PresetGroup {
    return this.presetGroup;
  }

  /** Sets the preset hierarchy. */
  setPresetGroup(presetGroup: PresetGroup): void {
    this.presetGroup = presetGroup;
  }

  /** Returns the authored generator source for the selected backend. */
  getCode(): string {
    return this.code;
  }

  /** Sets the source passed to the selected generator backend. */
  setCode(code: string): void {
    this.code = code ?? '';
  }

  /** Returns the command-line text supplied to the generator. */
  getCommandLine(): string {
    return this.commandLine;
  }

  /** Sets the command-line text supplied to the generator. */
  setCommandLine(commandLine: string): void {
    this.commandLine = commandLine ?? '';
  }

  /** Reports whether the object builder allows editing the graphic interface. */
  isEditEnabled(): boolean {
    return this.editEnabled;
  }

  /** Enables or disables editing the ObjectBuilder interface. */
  setEditEnabled(editEnabled: boolean): void {
    this.editEnabled = editEnabled;
  }

  /** Returns the comment stored on the object builder. */
  getComment(): string {
    return this.comment;
  }

  /** Replaces the descriptive comment attached to the ObjectBuilder. */
  setComment(comment: string): void {
    this.comment = comment ?? '';
  }

  /** Returns the language type stored on the object builder. */
  getLanguageType(): ObjectBuilderLanguageType {
    return this.languageType;
  }

  /** Selects the backend used to evaluate the ObjectBuilder. */
  setLanguageType(languageType: string): void {
    const normalized = (languageType ?? '').trim().toUpperCase();
    this.languageType = OBJECT_BUILDER_LANGUAGE_TYPES.has(normalized)
      ? (normalized as ObjectBuilderLanguageType)
      : 'PYTHON';
  }

  /** Reports whether this ObjectBuilder uses the Python backend. */
  isPythonLanguage(): boolean {
    return this.languageType === 'PYTHON';
  }

  /** Reports whether the selected backend requires the host Java adapter. */
  usesJavaRuntime(): boolean {
    return this.languageType === 'PYTHON' || this.languageType === 'CLOJURE';
  }

  private compileCode(): string {
    const unit = new BSBCompilationUnit();
    this.graphicInterface.collectReplacements(unit);
    return unit.replaceBSBValues(this.code);
  }

  private executeExternal(code: string): string {
    if (this.commandLine.trim().length === 0 && code.trim().length === 0) {
      return '';
    }

    const executor = getExternalCommandExecutor();
    if (!executor) {
      throw new Error('ObjectBuilder EXTERNAL execution requires an external command executor');
    }

    return executor.execute(this.commandLine, code, null);
  }

  private finishNoteList(noteList: NoteList, context: TimeContext): NoteList {
    const duration = this.getSubjectiveDuration().toBeats(context);
    const startTime = this.getStartTime().toBeats(context);
    const repeatPoint = this.getRepeatPoint();
    const repeatPointBeats = repeatPoint ? repeatPoint.toBeats(context) : -1;

    applyTimeBehavior(noteList, this.getTimeBehavior(), duration, repeatPointBeats);
    setScoreStart(noteList, startTime);
    return noteList;
  }

  override generateForCSD(
    context: TimeContext,
    compileData: CompileData,
    _startTime: number,
    _endTime: number,
  ): NoteList {
    const code = this.compileCode();
    let scoreText: string;

    switch (this.languageType) {
      case 'JAVASCRIPT':
        scoreText = executeJavaScriptCode(
          code,
          this.getSubjectiveDuration().toBeats(context),
          compileData,
        );
        break;
      case 'EXTERNAL':
        scoreText = this.executeExternal(code);
        break;
      case 'PYTHON':
      case 'CLOJURE':
        console.warn(
          `ObjectBuilder.generateForCSD skipped: ${this.languageType} requires Java runtime`,
        );
        return new NoteList();
    }

    const processed = applyNoteProcessorChain(getNotes(scoreText), this.getNoteProcessorChain());
    return this.finishNoteList(processed, context);
  }

  /** Generates the object builder’s Csound notes, awaiting asynchronous generators or processors through the compile context. */
  async generateForCSDAsync(
    context: TimeContext,
    compileData: CompileData,
    _startTime: number,
    _endTime: number,
  ): Promise<NoteList> {
    const code = this.compileCode();
    const duration = this.getSubjectiveDuration().toBeats(context);
    let scoreText: string;

    if (this.languageType === 'JAVASCRIPT') {
      scoreText = executeJavaScriptCode(code, duration, compileData);
    } else if (this.languageType === 'EXTERNAL') {
      scoreText = this.executeExternal(code);
    } else {
      const runtimeClient = getJavaRuntimeClient(compileData);
      if (!runtimeClient) {
        throw new Error(
          `ObjectBuilder ${this.languageType} execution requires a Java runtime session`,
        );
      }

      if (this.languageType === 'PYTHON') {
        const response = await runtimeClient.evaluateJythonObjectBuilder({
          code,
          blueDuration: duration,
          commandline: this.commandLine,
        });

        if (!response.ok) {
          throw new Error(formatRuntimeError('Failed to evaluate ObjectBuilder', response.error));
        }
        scoreText = response.result?.scoreText ?? '';
      } else {
        const response = await runtimeClient.evaluateClojureScoreObject({
          code,
          blueDuration: duration,
          commandline: this.commandLine,
        });

        if (!response.ok) {
          throw new Error(formatRuntimeError('Failed to evaluate ObjectBuilder', response.error));
        }
        scoreText = response.result?.scoreText ?? '';
      }
    }

    const noteList = getNotes(scoreText);
    const processed = await applyNoteProcessorChainAsync(
      noteList,
      this.getNoteProcessorChain(),
      compileData,
    );
    return this.finishNoteList(processed, context);
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

  /** Reconstructs the object builder from its Blue XML element, using the supplied diagnostic context when provided. */
  static loadFromXML(
    data: Element,
    _objRefMap?: ObjRefLoadMap,
    context?: XmlLoadContext,
    sink?: XmlDiagnosticSink,
  ): ObjectBuilder {
    const ctx = context ?? new XmlLoadContext(data);
    const type = data.getAttribute('type');
    if (
      data.getName() !== 'soundObject' ||
      type === null ||
      !['ObjectBuilder', 'blue.soundObject.ObjectBuilder'].includes(type)
    )
      throw ctx.at(data).error({
        code: 'type',
        member: '@type',
        value: type ?? '',
        message: 'Unsupported ObjectBuilder type.',
        recovery: 'Supply a supported concrete SoundObject type.',
      });
    checkShape(
      data,
      ['type', 'editEnabled'],
      [
        ...BASIC_SOUND_OBJECT_CHILDREN,
        'code',
        'commandLine',
        'graphicInterface',
        'presetGroup',
        'comment',
        'languageType',
        'isExternal',
        'syntaxType',
      ],
      ctx,
    );
    const builder = new ObjectBuilder();
    const syntaxTypeElement = data.getElement('syntaxType');
    if (syntaxTypeElement) readText(syntaxTypeElement, ctx);
    const isExternalElement = data.getElement('isExternal');
    if (isExternalElement) readText(isExternalElement, ctx);
    const languageTypeElement = data.getElement('languageType');
    if (languageTypeElement) readText(languageTypeElement, ctx);
    const commentElement = data.getElement('comment');
    if (commentElement) readText(commentElement, ctx);
    const commandLineElement = data.getElement('commandLine');
    if (commandLineElement) readText(commandLineElement, ctx);
    const codeElement = data.getElement('code');
    if (codeElement) readText(codeElement, ctx);
    initBasicFromXML(builder, data, ctx);

    const editEnabled = data.getAttribute('editEnabled');
    if (editEnabled !== null)
      builder.setEditEnabled(parseXmlBoolean(editEnabled, ctx, '@editEnabled'));
    const language = data.getElement('languageType');
    const external = data.getElement('isExternal');
    const current = language
      ? readEnum(language, ['PYTHON', 'JAVASCRIPT', 'CLOJURE', 'EXTERNAL'], ctx)
      : undefined;
    const historical = external ? (readBoolean(external, ctx) ? 'EXTERNAL' : 'PYTHON') : undefined;
    if (current && historical && current !== historical)
      throw ctx.at(language!).error({
        code: 'conflict',
        message: 'Conflicting ObjectBuilder language representations.',
        recovery: 'Keep one equivalent language setting.',
      });
    builder.setLanguageType(current ?? historical ?? 'PYTHON');
    const syntax = data.getElement('syntaxType');
    if (syntax) {
      const value = readText(syntax, ctx);
      if (value !== 'Python')
        throw ctx.at(syntax).error({
          code: 'value',
          value,
          message: 'Unsupported historical editor syntax choice.',
          recovery: 'Convert this editor choice with a compatible historical editor.',
        });
      ctx.at(syntax).diagnostic({
        code: 'SL-H02',
        severity: 'warning',
        member: 'syntaxType',
        value,
        message: 'Redundant historical Python editor setting normalized.',
        recovery:
          'The editor hint is omitted; the canonical language setting preserves execution mode.',
      });
    }
    for (const child of data.getElements()) {
      switch (child.getName()) {
        case 'code':
          builder.setCode(readText(child, ctx));
          break;
        case 'commandLine':
          builder.setCommandLine(readText(child, ctx));
          break;
        case 'comment':
          builder.setComment(readText(child, ctx));
          break;
        case 'graphicInterface': {
          const gi = new BSBGraphicInterface();
          gi.loadFromXML(child, ctx);
          builder.setGraphicInterface(gi);
          break;
        }
        case 'presetGroup':
          builder.setPresetGroup(PresetGroup.loadFromXML(child, ctx));
          break;
      }
    }

    return context ? builder : requireXmlValue(ctx.result(builder), sink);
  }

  override deepCopy(mode: CopyMode = 'duplication'): SoundObject {
    return new ObjectBuilder(this, mode);
  }
}
