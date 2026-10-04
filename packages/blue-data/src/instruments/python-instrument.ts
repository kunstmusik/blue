import { Element } from '../serialization/xml-reader';
import { XmlLoadContext, requireXmlValue } from '../serialization/xml-load';
import type { XmlDiagnosticSink } from '../serialization/xml-load';
import { checkShape, readText, parseXmlBoolean } from '../utilities/xml';
import { appendUserDefinedOpcodes } from '../opcodes/udo-utilities';
import type { Parameter } from '../automation/parameter';
import { replaceOpcodeNames } from '../utilities/text';
import type { CompileData } from '../compile-data';
import { getJavaRuntimeClient, type JavaRuntimeError } from '../java-runtime';
import { OpcodeList } from '../opcodes/opcode-list';
import { Instrument } from './instrument';

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

export class PythonInstrument extends Instrument {
  private _text =
    '#use variable instrument at end of script to bring instrument back into blue\n\n' +
    'instrument = "aout oscili 32000, 440, 1"';
  private _globalOrc = '';
  private _globalSco = '';
  private _opcodeList = new OpcodeList();
  private _udoReplacementValues: Map<string, string> | null = null;

  constructor(other?: PythonInstrument) {
    super();
    this.setName('PythonInstrument');
    if (other) {
      this._name = other._name;
      this._enabled = other._enabled;
      this._comment = other._comment;
      this._text = other._text;
      this._globalOrc = other._globalOrc;
      this._globalSco = other._globalSco;
      this._opcodeList = OpcodeList.loadFromXML(other._opcodeList.saveAsXML());
    }
  }

  getText(): string {
    return this._text;
  }

  setText(text: string): void {
    this._text = text ?? '';
  }

  getGlobalOrc(): string {
    return this._globalOrc;
  }

  setGlobalOrc(globalOrc: string): void {
    this._globalOrc = globalOrc ?? '';
  }

  getGlobalSco(): string {
    return this._globalSco;
  }

  setGlobalSco(globalSco: string): void {
    this._globalSco = globalSco ?? '';
  }

  getOpcodeList(): OpcodeList {
    return this._opcodeList;
  }

  override generateUserDefinedOpcodes(udoList: unknown): void {
    if (!(udoList instanceof OpcodeList)) {
      return;
    }

    this._udoReplacementValues = appendUserDefinedOpcodes(this._opcodeList, udoList);
  }

  override generateGlobalOrc(): string | null {
    return this._globalOrc || null;
  }

  override generateGlobalSco(): string | null {
    return this._globalSco || null;
  }

  override generateInstrument(): string {
    return '';
  }

  override async generateInstrumentAsync(
    compileData?: CompileData,
    _parameters?: Parameter[],
  ): Promise<string> {
    const runtimeClient = compileData ? getJavaRuntimeClient(compileData) : null;
    if (!runtimeClient) {
      throw new Error('PythonInstrument.generateInstrumentAsync requires a Java runtime session');
    }

    const response = await runtimeClient.evaluateJythonInstrument({
      code: this._text,
    });

    if (!response.ok) {
      throw new Error(formatRuntimeError('Failed to evaluate PythonInstrument', response.error));
    }

    let instrumentText = response.result?.instrumentText ?? '';
    if (this._udoReplacementValues && this._udoReplacementValues.size > 0) {
      instrumentText = replaceOpcodeNames(this._udoReplacementValues, instrumentText);
      this._udoReplacementValues = null;
    }

    return instrumentText;
  }

  saveAsXML(): Element {
    const elem = new Element('instrument');
    elem.setAttribute('type', 'blue.orchestra.PythonInstrument');
    elem.setAttribute('enabled', this._enabled.toString());
    elem.addElement('name').setText(this._name);
    elem.addElement('comment').setText(this._comment);
    elem.addElement('globalOrc').setText(this._globalOrc);
    elem.addElement('globalSco').setText(this._globalSco);
    elem.addElement('instrumentText').setText(this._text);
    elem.addElement(this._opcodeList.saveAsXML());
    return elem;
  }

  static loadFromXML(
    data: Element,
    context?: XmlLoadContext,
    sink?: XmlDiagnosticSink,
  ): PythonInstrument {
    const ctx = context ?? new XmlLoadContext(data);
    checkShape(
      data,
      ['type', 'enabled'],
      ['name', 'comment', 'globalOrc', 'globalSco', 'instrumentText', 'opcodeList'],
      ctx,
    );
    if (
      data.getName() !== 'instrument' ||
      data.getAttribute('type') !== 'blue.orchestra.PythonInstrument'
    )
      throw ctx.at(data).error({
        code: 'type',
        member: '@type',
        value: data.getAttribute('type') ?? '',
        message: 'Expected PythonInstrument instrument type.',
        recovery: 'Use the matching instrument loader.',
      });
    const text = (field: string): string | null => {
      const child = data.getElement(field);
      return child ? readText(child, ctx) : null;
    };
    const instr = new PythonInstrument();
    instr.setEnabled(
      parseXmlBoolean(data.getAttribute('enabled') ?? 'true', ctx.at(data), '@enabled'),
    );
    instr.setName(text('name') ?? '');
    instr.setComment(text('comment') ?? '');
    instr.setGlobalOrc(text('globalOrc') ?? '');
    instr.setGlobalSco(text('globalSco') ?? '');
    instr.setText(text('instrumentText') ?? '');
    const opcodeList = data.getElement('opcodeList');
    if (opcodeList) instr._opcodeList = OpcodeList.loadFromXML(opcodeList, ctx);
    return context ? instr : requireXmlValue(ctx.result(instr), sink);
  }

  deepCopy(): PythonInstrument {
    return new PythonInstrument(this);
  }
}
