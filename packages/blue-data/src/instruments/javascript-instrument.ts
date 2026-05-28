import { Element } from '../serialization/xml-reader';
import { OpcodeList } from '../opcodes/opcode-list';
import { appendUserDefinedOpcodes } from '../opcodes/udo-utilities';
import { Instrument } from './instrument';

export class JavaScriptInstrument extends Instrument {
  private _text =
    '//use variable instrument at end of script to bring instrument back into blue\n\n' +
    'instrument = "aout oscili 32000, 440, 1";';
  private _globalOrc = '';
  private _globalSco = '';
  private _opcodeList = new OpcodeList();

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

    appendUserDefinedOpcodes(this._opcodeList, udoList);
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

  saveAsXML(): Element {
    const elem = new Element('instrument');
    elem.setAttribute('type', 'blue.orchestra.JavaScriptInstrument');
    elem.addElement('name').setText(this._name);
    elem.addElement('comment').setText(this._comment);
    elem.addElement('globalOrc').setText(this._globalOrc);
    elem.addElement('globalSco').setText(this._globalSco);
    elem.addElement('instrumentText').setText(this._text);
    elem.addElement(this._opcodeList.saveAsXML());
    return elem;
  }

  static loadFromXML(data: Element): JavaScriptInstrument {
    const instr = new JavaScriptInstrument();
    instr.setName(data.getTextString('name') ?? '');
    instr.setComment(data.getTextString('comment') ?? '');
    instr.setGlobalOrc(data.getTextString('globalOrc') ?? '');
    instr.setGlobalSco(data.getTextString('globalSco') ?? '');
    instr.setText(data.getTextString('instrumentText') ?? '');
    const opcodeList = data.getElement('opcodeList');
    if (opcodeList) instr._opcodeList = OpcodeList.loadFromXML(opcodeList);
    return instr;
  }

  deepCopy(): JavaScriptInstrument {
    return new JavaScriptInstrument(this);
  }
}
