import { Element } from '../serialization/xml-reader';
import { XmlLoadContext, requireXmlValue } from '../serialization/xml-load';
import type { XmlDiagnosticSink } from '../serialization/xml-load';
import { checkShape, readText, parseXmlBoolean } from '../utilities/xml';
import { OpcodeList } from '../opcodes/opcode-list';
import { appendUserDefinedOpcodes } from '../opcodes/udo-utilities';
import { Instrument } from './instrument';
import { CompileData } from '../compile-data';
import { disposeJavaScriptCompileState, getJavaScriptCompileContext } from '../javascript-runtime';

function executeInstrumentScript(text: string, compileData: CompileData): string {
  const context = getJavaScriptCompileContext(compileData);
  for (const code of ["var instrument = '';", text]) {
    const result = context.unwrapResult(
      context.evalCode(code, 'blue-javascript-instrument.js', { type: 'global' }),
    );
    result.dispose();
  }
  const value = context.getProp(context.global, 'instrument');
  try {
    return String(context.dump(value) ?? '');
  } finally {
    value.dispose();
  }
}

export class JavaScriptInstrument extends Instrument {
  private _text =
    '//use variable instrument at end of script to bring instrument back into blue\n\n' +
    'instrument = "aout oscili 32000, 440, 1";';
  private _globalOrc = '';
  private _globalSco = '';
  private _opcodeList = new OpcodeList();

  /** Creates a default JavaScript instrument or copies a supplied instance. */
  constructor(other?: JavaScriptInstrument) {
    super();
    this.setName('JavaScriptInstrument');
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

  /** Returns the authored text. */
  getText(): string {
    return this._text;
  }

  /** Sets the authored text. */
  setText(text: string): void {
    this._text = text ?? '';
  }

  /** Returns the project-wide Csound orchestra source contributed by the instrument. */
  getGlobalOrc(): string {
    return this._globalOrc;
  }

  /** Sets the project-wide Csound orchestra source contributed by the instrument. */
  setGlobalOrc(globalOrc: string): void {
    this._globalOrc = globalOrc ?? '';
  }

  /** Returns the project-wide Csound score source contributed by the instrument. */
  getGlobalSco(): string {
    return this._globalSco;
  }

  /** Sets the project-wide Csound score source contributed by the instrument. */
  setGlobalSco(globalSco: string): void {
    this._globalSco = globalSco ?? '';
  }

  /** Returns the collection of user-defined Csound opcodes. */
  getOpcodeList(): OpcodeList {
    return this._opcodeList;
  }

  override generateUserDefinedOpcodes(udoList: unknown): void {
    if (!(udoList instanceof OpcodeList)) {
      return;
    }

    appendUserDefinedOpcodes(this._opcodeList, udoList);
  }

  override generateGlobalOrc(): string | null {
    return this._globalOrc || null;
  }

  override generateGlobalSco(): string | null {
    return this._globalSco || null;
  }

  override generateInstrument(): string {
    const compileData = CompileData.createEmptyCompileData();
    try {
      return executeInstrumentScript(this._text, compileData);
    } finally {
      disposeJavaScriptCompileState(compileData);
    }
  }

  override async generateInstrumentAsync(compileData?: CompileData): Promise<string> {
    if (!compileData) return this.generateInstrument();
    return executeInstrumentScript(this._text, compileData);
  }

  saveAsXML(): Element {
    const elem = new Element('instrument');
    elem.setAttribute('type', 'blue.orchestra.JavaScriptInstrument');
    elem.setAttribute('enabled', this._enabled.toString());
    elem.addElement('name').setText(this._name);
    elem.addElement('comment').setText(this._comment);
    elem.addElement('globalOrc').setText(this._globalOrc);
    elem.addElement('globalSco').setText(this._globalSco);
    elem.addElement('instrumentText').setText(this._text);
    elem.addElement(this._opcodeList.saveAsXML());
    return elem;
  }

  /** Reconstructs the JavaScript instrument from its Blue XML element, using the supplied diagnostic context when provided. */
  static loadFromXML(
    data: Element,
    context?: XmlLoadContext,
    sink?: XmlDiagnosticSink,
  ): JavaScriptInstrument {
    const ctx = context ?? new XmlLoadContext(data);
    checkShape(
      data,
      ['type', 'enabled'],
      ['name', 'comment', 'globalOrc', 'globalSco', 'instrumentText', 'opcodeList'],
      ctx,
    );
    if (
      data.getName() !== 'instrument' ||
      data.getAttribute('type') !== 'blue.orchestra.JavaScriptInstrument'
    )
      throw ctx.at(data).error({
        code: 'type',
        member: '@type',
        value: data.getAttribute('type') ?? '',
        message: 'Expected JavaScriptInstrument instrument type.',
        recovery: 'Use the matching instrument loader.',
      });
    const text = (field: string): string | null => {
      const child = data.getElement(field);
      return child ? readText(child, ctx) : null;
    };
    const instr = new JavaScriptInstrument();
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

  deepCopy(): JavaScriptInstrument {
    return new JavaScriptInstrument(this);
  }
}
