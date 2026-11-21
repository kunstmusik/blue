/**
 * OpcodeList — list of user-defined opcodes (UDOs).
 * Mirrors the Java OpcodeList class.
 */
import { OpcodeDefinition } from './opcode-definition';
import { Element } from '../serialization/xml-reader';
import { XmlLoadContext, requireXmlValue } from '../serialization/xml-load';
import type { XmlDiagnosticSink } from '../serialization/xml-load';
import { checkRoot, checkShape } from '../utilities/xml';

/** Collects reusable Csound user-defined opcodes and allocates unique names at compilation. */
export class OpcodeList {
  private _opcodes: OpcodeDefinition[] = [];
  private _counter = 0;

  /** Creates a default opcode list or copies a supplied instance. */
  constructor(other?: OpcodeList) {
    if (other) {
      this._opcodes = other.getOpcodes().map((opcode) => opcode.deepCopy() as OpcodeDefinition);
    }
  }

  /** Appends a user-defined opcode to the list. */
  addOpcode(opcode: OpcodeDefinition): void {
    this._opcodes.push(opcode);
  }

  /**
   * Add an opcode at a specific index. If index is out of bounds, appends.
   */
  addOpcodeAt(index: number, opcode: OpcodeDefinition): void {
    if (index < 0 || index > this._opcodes.length) {
      this._opcodes.push(opcode);
    } else {
      this._opcodes.splice(index, 0, opcode);
    }
  }

  /**
   * Remove the opcode at the specified index.
   */
  removeOpcodeAt(index: number): boolean {
    if (index < 0 || index >= this._opcodes.length) return false;
    this._opcodes.splice(index, 1);
    return true;
  }

  /**
   * Replace the opcode at the specified index.
   */
  replaceOpcodeAt(index: number, opcode: OpcodeDefinition): boolean {
    if (index < 0 || index >= this._opcodes.length) return false;
    this._opcodes[index] = opcode;
    return true;
  }

  /**
   * Clear all opcodes.
   */
  clear(): void {
    this._opcodes = [];
    this._counter = 0;
  }

  /**
   * Move an opcode from one index to another.
   */
  moveOpcode(fromIndex: number, toIndex: number): boolean {
    if (fromIndex < 0 || fromIndex >= this._opcodes.length) return false;
    if (toIndex < 0 || toIndex >= this._opcodes.length) return false;
    if (fromIndex === toIndex) return true;
    const [moved] = this._opcodes.splice(fromIndex, 1);
    this._opcodes.splice(toIndex, 0, moved);
    return true;
  }

  /**
   * Add all opcodes from another OpcodeList.
   */
  addAll(other: OpcodeList): void {
    for (const opcode of other.getOpcodes()) {
      this._opcodes.push(opcode.deepCopy() as OpcodeDefinition);
    }
  }

  /** Returns the number of entries stored in the opcode list. */
  size(): number {
    return this._opcodes.length;
  }

  /** Returns the entry at the supplied index in the opcode list’s opcodes. */
  getOpcode(index: number): OpcodeDefinition | null {
    if (index < 0 || index >= this._opcodes.length) return null;
    return this._opcodes[index];
  }

  /** Returns the opcode definitions in their stored order. */
  getOpcodes(): OpcodeDefinition[] {
    return [...this._opcodes];
  }

  /**
   * Find an equivalent UDO in this list and return its name.
   * Returns null if no equivalent is found.
   */
  getNameOfEquivalentCopy(udo: OpcodeDefinition): string | null {
    if (udo == null) return null;
    for (const temp of this._opcodes) {
      if (temp.isEquivalent(udo)) {
        return temp.getName();
      }
    }
    return null;
  }

  /** Checks whether the supplied opcode name is unused by this list. */
  isNameUnique(name: string): boolean {
    for (const udo of this._opcodes) {
      if (udo.getName() === name) return false;
    }
    return true;
  }

  /** Finds an unused opcode name starting from the supplied base name. */
  getUniqueName(): string {
    let uniqueName = `uniqueUDO${this._counter++}`;
    while (!this.isNameUnique(uniqueName)) {
      uniqueName = `uniqueUDO${this._counter++}`;
    }
    return uniqueName;
  }

  /** Serializes the opcode list and its persisted settings to a new Blue XML element. */
  saveAsXML(): Element {
    const elem = new Element('opcodeList');
    for (const opcode of this._opcodes) {
      elem.addElement(opcode.saveAsXML());
    }
    return elem;
  }

  /** Reconstructs the opcode list from its Blue XML element, using the supplied diagnostic context when provided. */
  static loadFromXML(
    data: Element,
    context?: XmlLoadContext,
    sink?: XmlDiagnosticSink,
  ): OpcodeList {
    const ctx = context ?? new XmlLoadContext(data);
    checkRoot(data, 'opcodeList', ctx);
    checkShape(data, [], ['udo'], ctx, ['udo']);
    const list = new OpcodeList();
    const children = data.getElements();
    while (children.hasMoreElements()) {
      const node = children.next();
      const udo = OpcodeDefinition.loadFromXML(node, ctx);
      list._opcodes.push(udo);
    }
    return context ? list : requireXmlValue(ctx.result(list), sink);
  }

  /**
   * Get all opcodes as a single CSD text block.
   */
  toString(): string {
    if (this._opcodes.length === 0) return '';
    return this._opcodes.map((op) => op.generateCode()).join('\n');
  }
}
