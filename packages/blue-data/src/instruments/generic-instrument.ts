/**
 * GenericInstrument — an instrument defined by raw Csound orchestra text.
 * Mirrors the Java GenericInstrument class.
 */
import { Instrument } from './instrument';
import { Element } from '../serialization/xml-reader';
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

  static loadFromXML(data: Element): GenericInstrument {
    const instr = new GenericInstrument();
    const name = data.getTextString('name');
    if (name !== null) {
      instr.setName(name);
    }
    instr.setComment(data.getTextString('comment') ?? '');
    instr.setEnabled(data.getAttribute('enabled') !== 'false');
    instr.setText(data.getTextString('instrumentText') ?? '');
    const go = data.getTextString('globalOrc');
    if (go !== null) instr._globalOrc = go;
    const gs = data.getTextString('globalSco');
    if (gs !== null) instr._globalSco = gs;
    const opcodeList = data.getElement('opcodeList');
    if (opcodeList) instr._opcodeList = OpcodeList.loadFromXML(opcodeList);
    return instr;
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
