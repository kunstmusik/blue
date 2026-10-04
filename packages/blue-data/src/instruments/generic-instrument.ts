/**
 * GenericInstrument — an instrument defined by raw Csound orchestra text.
 * Mirrors the Java GenericInstrument class.
 */
import { Instrument } from './instrument';
import { Element } from '../serialization/xml-reader';
import { XmlLoadContext, requireXmlValue } from '../serialization/xml-load';
import type { XmlDiagnosticSink } from '../serialization/xml-load';
import { checkShape, readText, parseXmlBoolean } from '../utilities/xml';
import { ObjRefSaveMap } from '../serialization/obj-ref-map';
import { DeepCopyable } from '../deep-copyable';
import { OpcodeList } from '../opcodes/opcode-list';
import { appendUserDefinedOpcodes } from '../opcodes/udo-utilities';
import { replaceOpcodeNames } from '../utilities/text';

export class GenericInstrument extends Instrument implements DeepCopyable<GenericInstrument> {
  private _text = '';
  private _globalOrc = '';
  private _globalSco = '';
  private _opcodeList = new OpcodeList();
  private _udoReplacementValues: Map<string, string> | null = null;

  constructor() {
    super();
    this.setName('untitled');
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

  setOpcodeList(opcodeList: OpcodeList): void {
    this._opcodeList = opcodeList;
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
    let instrumentText = this._text;
    if (this._udoReplacementValues && this._udoReplacementValues.size > 0) {
      instrumentText = replaceOpcodeNames(this._udoReplacementValues, instrumentText);
      this._udoReplacementValues = null;
    }

    return instrumentText;
  }

  // ─── XML ───

  saveAsXML(_objRefMap?: ObjRefSaveMap): Element {
    const elem = new Element('instrument');
    elem.setAttribute('type', 'blue.orchestra.GenericInstrument');
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
  ): GenericInstrument {
    const ctx = context ?? new XmlLoadContext(data);
    checkShape(
      data,
      ['type', 'enabled'],
      ['name', 'comment', 'globalOrc', 'globalSco', 'instrumentText', 'opcodeList'],
      ctx,
    );
    if (
      data.getName() !== 'instrument' ||
      data.getAttribute('type') !== 'blue.orchestra.GenericInstrument'
    )
      throw ctx.at(data).error({
        code: 'type',
        member: '@type',
        value: data.getAttribute('type') ?? '',
        message: 'Expected GenericInstrument instrument type.',
        recovery: 'Use the matching instrument loader.',
      });
    const text = (field: string): string | null => {
      const child = data.getElement(field);
      return child ? readText(child, ctx) : null;
    };
    const instr = new GenericInstrument();
    const name = text('name');
    if (name !== null) {
      instr.setName(name);
    }
    instr.setComment(text('comment') ?? '');
    instr.setEnabled(
      parseXmlBoolean(data.getAttribute('enabled') ?? 'true', ctx.at(data), '@enabled'),
    );
    instr.setText(text('instrumentText') ?? '');
    const go = text('globalOrc');
    if (go !== null) instr._globalOrc = go;
    const gs = text('globalSco');
    if (gs !== null) instr._globalSco = gs;
    const opcodeList = data.getElement('opcodeList');
    if (opcodeList) instr._opcodeList = OpcodeList.loadFromXML(opcodeList, ctx);
    return context ? instr : requireXmlValue(ctx.result(instr), sink);
  }

  deepCopy(): GenericInstrument {
    const copy = new GenericInstrument();
    copy._name = this._name;
    copy._enabled = this._enabled;
    copy._comment = this._comment;
    copy._text = this._text;
    copy._globalOrc = this._globalOrc;
    copy._globalSco = this._globalSco;
    copy._opcodeList = OpcodeList.loadFromXML(this._opcodeList.saveAsXML());
    return copy;
  }
}
