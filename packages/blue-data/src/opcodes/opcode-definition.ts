/**
 * OpcodeDefinition — a single user-defined opcode.
 * Mirrors the Java UserDefinedOpcode class.
 *
 * Supports both CLASSIC and MODERN Csound UDO declaration styles.
 */
import { Element } from '../serialization/xml-reader';
import { BlueDataObject } from '../blue-data-object';
import { UDOStyle } from './udo-style';
import {
  getModernOutputSignature,
  getModernOutTypesDisplay,
  normalizeModernOutTypes,
  normalizeClassicOutTypes,
  normalizeModernOutTypesForComparison,
} from './udo-type-utils';

export class OpcodeDefinition implements BlueDataObject {
  private _name = 'newOpcode';
  private _style: UDOStyle = UDOStyle.CLASSIC;
  private _outTypes = '';
  private _inTypes = '';
  private _inputArguments = '';
  private _code = '';
  private _comments = '';
  private _commentText: string | null = null;

  getName(): string {
    return this._name;
  }
  setName(name: string): void {
    this._name = name;
  }

  getStyle(): UDOStyle {
    return this._style;
  }
  setStyle(style: UDOStyle): void {
    this._style = style;
  }

  getOutTypes(): string {
    return this._outTypes;
  }
  setOutTypes(types: string): void {
    this._outTypes = types;
  }

  getInTypes(): string {
    return this._inTypes;
  }
  setInTypes(types: string): void {
    this._inTypes = types;
  }

  getInputArguments(): string {
    return this._inputArguments;
  }
  setInputArguments(args: string): void {
    this._inputArguments = args;
  }

  getCode(): string {
    return this._code;
  }
  setCode(code: string): void {
    this._code = code;
  }

  getComments(): string {
    return this._comments;
  }
  setComments(comments: string): void {
    this._comments = comments;
  }

  getCommentText(): string | null {
    return this._commentText;
  }
  setCommentText(text: string | null): void {
    this._commentText = text;
  }

  /**
   * Generate CSD text for this UDO, dispatching to classic or modern style.
   */
  generateCode(): string {
    if (this._style === UDOStyle.MODERN) {
      return this._generateModernCode();
    }
    return this._generateClassicCode();
  }

  /**
   * Get the opcode as CSD text (delegates to generateCode).
   */
  toCSD(): string {
    return this.generateCode();
  }

  private _generateClassicCode(): string {
    const buffer: string[] = [];
    let header = `\topcode ${this._name},${this._outTypes},${this._inTypes}`;
    if (this._commentText !== null) {
      header += ` ; ${this._commentText}`;
    }
    buffer.push(header);
    buffer.push('');
    buffer.push(this._code);
    buffer.push('');
    buffer.push('\tendop');
    return buffer.join('\n');
  }

  private _generateModernCode(): string {
    const buffer: string[] = [];
    let header = `opcode ${this._name}(${this._inputArguments}):${getModernOutputSignature(this._outTypes)}`;
    if (this._commentText !== null) {
      header += ` ; ${this._commentText}`;
    }
    buffer.push(header);

    const formatted = this._indentModernCodeBody(this._code);
    if (formatted.length > 0) {
      buffer.push(formatted);
    }

    buffer.push('endop');
    return buffer.join('\n');
  }

  private _indentModernCodeBody(source: string): string {
    if (!source) return '';
    const trimmed = this._trimTrailingLineBreaks(source);
    if (!trimmed) return '';
    const lines = trimmed.split('\n');
    return lines.map((line) => (line.length > 0 ? `    ${line}` : '')).join('\n');
  }

  private _trimTrailingLineBreaks(source: string): string {
    let end = source.length;
    while (end > 0 && (source[end - 1] === '\n' || source[end - 1] === '\r')) {
      end--;
    }
    return source.substring(0, end);
  }

  /**
   * Style-aware equivalence check for UDO deduplication.
   */
  isEquivalent(other: OpcodeDefinition | null): boolean {
    if (other == null) return false;

    const thisOutTypes =
      this._style === UDOStyle.MODERN
        ? normalizeModernOutTypesForComparison(this._outTypes)
        : normalizeClassicOutTypes(this._outTypes);
    const otherOutTypes =
      other._style === UDOStyle.MODERN
        ? normalizeModernOutTypesForComparison(other._outTypes)
        : normalizeClassicOutTypes(other._outTypes);

    if (
      this._style !== other._style ||
      thisOutTypes !== otherOutTypes ||
      this._code !== other._code
    ) {
      return false;
    }

    if (this._style === UDOStyle.MODERN) {
      return this._inputArguments === other._inputArguments;
    }
    return this._inTypes === other._inTypes;
  }

  saveAsXML(): Element {
    const elem = new Element('udo');
    elem.addElement('style').setText(this._style);
    elem.addElement('opcodeName').setText(this._name);
    elem
      .addElement('outTypes')
      .setText(
        this._style === UDOStyle.MODERN ? getModernOutTypesDisplay(this._outTypes) : this._outTypes,
      );
    if (this._style === UDOStyle.MODERN) {
      elem.addElement('inputArguments').setText(this._inputArguments);
    } else {
      elem.addElement('inTypes').setText(this._inTypes);
    }
    elem.addElement('codeBody').setText(this._code);
    elem.addElement('comments').setText(this._comments);
    return elem;
  }

  static loadFromXML(data: Element): OpcodeDefinition {
    const opcode = new OpcodeDefinition();

    const children = data.getElements();
    while (children.hasMoreElements()) {
      const node = children.next();
      const val = node.getTextString() ?? '';
      switch (node.getName()) {
        case 'style':
          try {
            opcode._style = UDOStyle[val as keyof typeof UDOStyle];
          } catch {
            opcode._style = UDOStyle.CLASSIC;
          }
          break;
        case 'opcodeName':
          opcode._name = val;
          break;
        case 'outTypes':
          opcode._outTypes = val;
          break;
        case 'inTypes':
          opcode._inTypes = val;
          break;
        case 'inputArguments':
          opcode._inputArguments = val;
          break;
        case 'codeBody':
          opcode._code = val;
          break;
        case 'comments':
          opcode._comments = val;
          break;
      }
    }

    // Normalize after load (mirrors Java behavior)
    if (opcode._style === UDOStyle.MODERN) {
      opcode._inTypes = '';
      opcode._outTypes = normalizeModernOutTypes(opcode._outTypes);
    } else {
      opcode._inputArguments = '';
      opcode._outTypes = normalizeClassicOutTypes(opcode._outTypes);
    }

    return opcode;
  }

  deepCopy(): BlueDataObject {
    const copy = new OpcodeDefinition();
    copy._name = this._name;
    copy._style = this._style;
    copy._outTypes = this._outTypes;
    copy._inTypes = this._inTypes;
    copy._inputArguments = this._inputArguments;
    copy._code = this._code;
    copy._comments = this._comments;
    copy._commentText = this._commentText;
    return copy;
  }
}
