/**
 * Element class that mirrors the Java electric.xml.Element API.
 * Wraps parse-xml output to provide the same interface the Java code uses:
 *   - getName(): string
 *   - getAttribute(name: string): string | null
 *   - getAttribute(name: string, defaultVal: string): string
 *   - getAttributeValue(name: string): string | null  (alias used in some Java code)
 *   - getTextString(): string
 *   - getElements(): Elements
 *   - getElements(name: string): Elements  (filter by child name)
 *   - getElement(name: string): Element | null  (first child by name)
 *   - removeElement(name: string): Element | null
 *   - removeElements(name: string): Elements
 *   - addElement(name: string): Element
 *   - addElement(child: Element): Element
 *   - setText(text: string): void
 *   - setAttribute(name: string, value: string): void
 *
 * This is the core serialization primitive used by all data classes.
 */
import { parseXml, XmlNode, XmlElement } from '@rgrove/parse-xml';

/**
 * Iterable collection of Element children, mirroring Java's Elements.
 */
export class Elements implements Iterable<Element> {
  private _children: Element[];
  private _index: number;

  constructor(children: Element[] = []) {
    this._children = children;
    this._index = 0;
  }

  hasMoreElements(): boolean {
    return this._index < this._children.length;
  }

  next(): Element {
    if (this._index >= this._children.length) {
      throw new Error('No more elements');
    }
    return this._children[this._index++];
  }

  // Reset iterator
  reset(): void {
    this._index = 0;
  }

  // Get size
  get size(): number {
    return this._children.length;
  }

  // Iterator protocol
  [Symbol.iterator](): Iterator<Element> {
    let i = 0;
    const children = this._children;
    return {
      next(): IteratorResult<Element> {
        if (i < children.length) {
          return { value: children[i++], done: false };
        }
        return { value: undefined as unknown as Element, done: true };
      },
    };
  }

  // Convert to array
  toArray(): Element[] {
    return [...this._children];
  }
}

/**
 * Element class wrapping an XML node with the electric.xml API.
 */
export class Element {
  private _name: string;
  private _attributes: Map<string, string>;
  private _children: Element[];
  private _text: string | null;
  private _parent: Element | null;

  constructor(name: string) {
    this._name = name;
    this._attributes = new Map();
    this._children = [];
    this._text = null;
    this._parent = null;
  }

  // ─── Factory: Parse XML string to Element ───

  /**
   * Parse an XML string into an Element tree.
   * The root element of the document becomes the returned Element.
   */
  static parse(xmlString: string): Element {
    const doc = parseXml(xmlString);
    // Find the first element child of the document
    for (const child of doc.children) {
      if (child.type === 'element') {
        return Element.fromParseXmlNode(child);
      }
    }
    throw new Error('No root element found in XML');
  }

  /**
   * Recursively convert a parse-xml node to our Element tree.
   */
  private static fromParseXmlNode(node: XmlNode): Element {
    if (node.type !== 'element') {
      throw new Error(`Expected element node, got type ${node.type}`);
    }
    const elem = node as XmlElement;
    const el = new Element(elem.name);

    // Attributes
    if (elem.attributes) {
      for (const [key, value] of Object.entries(elem.attributes)) {
        el._attributes.set(key, String(value));
      }
    }

    // Children
    if (elem.children) {
      for (const child of elem.children) {
        if (child.type === 'element') {
          // Element
          const childEl = Element.fromParseXmlNode(child);
          childEl._parent = el;
          el._children.push(childEl);
        } else if (child.type === 'text') {
          // Text node
          const text = (child as { text?: string }).text?.trim() ?? '';
          if (text.length > 0 && el._text === null) {
            el._text = text;
          }
        }
      }
    }

    return el;
  }

  // ─── Read accessors ───

  /** Element name (tag name). */
  getName(): string {
    return this._name;
  }

  /** Set element name (used when renaming, e.g., setName("startTime")). */
  setName(name: string): Element {
    this._name = name;
    return this;
  }

  /**
   * Get attribute value. Returns null if not found.
   * Overload: getAttribute(name, defaultVal) returns default if missing.
   */
  getAttribute(name: string): string | null;
  getAttribute(name: string, defaultVal: string): string;
  getAttribute(name: string, defaultVal?: string): string | null {
    const val = this._attributes.get(name);
    return val ?? defaultVal ?? null;
  }

  /** Alias used by some Java code: getAttributeValue(name). */
  getAttributeValue(name: string): string | null {
    return this._attributes.get(name) ?? null;
  }

  /**
   * Get text content of this element, or the text content of a named child element.
   * Returns concatenated text of direct text child nodes.
   */
  getTextString(): string;
  getTextString(childName: string): string | null;
  getTextString(childName?: string): string | null {
    if (childName !== undefined) {
      const child = this.getElement(childName);
      return child?.getTextString() ?? null;
    }
    if (this._text !== null) {
      return this._text;
    }
    return '';
  }

  // ─── Child element access ───

  /**
   * Get all child elements.
   * With optional name parameter, filters by element name.
   */
  getElements(name?: string): Elements {
    if (name !== undefined) {
      return new Elements(this._children.filter((c) => c._name === name));
    }
    return new Elements([...this._children]);
  }

  /**
   * Get first child element by name.
   */
  getElement(name: string): Element | null {
    return this._children.find((c) => c._name === name) ?? null;
  }

  /**
   * Check if this element has a child element with the given name.
   */
  hasElement(name: string): boolean {
    return this._children.some((c) => c._name === name);
  }

  // ─── Child element modification ───

  /**
   * Remove first child element by name. Returns the removed element or null.
   */
  removeElement(name: string): Element | null {
    const idx = this._children.findIndex((c) => c._name === name);
    if (idx === -1) return null;
    const removed = this._children.splice(idx, 1)[0];
    removed._parent = null;
    return removed;
  }

  /**
   * Remove all child elements by name. Returns them as Elements.
   */
  removeElements(name: string): Elements {
    const removed: Element[] = [];
    this._children = this._children.filter((c) => {
      if (c._name === name) {
        c._parent = null;
        removed.push(c);
        return false;
      }
      return true;
    });
    return new Elements(removed);
  }

  /**
   * Add a new child element by name, or add an existing element as a child.
   * Returns the added element.
   */
  addElement(arg: string | Element): Element {
    if (typeof arg === 'string') {
      const child = new Element(arg);
      child._parent = this;
      this._children.push(child);
      return child;
    }
    arg._parent = this;
    this._children.push(arg);
    return arg;
  }

  // ─── Text content ───

  /**
   * Set the text content of this element.
   * Replaces any existing text.
   */
  setText(text: string): void {
    this._text = text;
  }

  // ─── Attributes ───

  /**
   * Set an attribute.
   */
  setAttribute(name: string, value: string): void {
    this._attributes.set(name, value);
  }

  /**
   * Remove an attribute.
   */
  removeAttribute(name: string): boolean {
    return this._attributes.delete(name);
  }

  /**
   * Check if an attribute exists.
   */
  hasAttribute(name: string): boolean {
    return this._attributes.has(name);
  }

  /**
   * Get all attribute names.
   */
  getAttributeNames(): string[] {
    return Array.from(this._attributes.keys());
  }

  // ─── Serialization ───

  /**
   * Convert this Element tree back to an XML string.
   * Produces output compatible with Java Blue's electric.xml format.
   */
  toXml(): string {
    const parts: string[] = [];
    this._serializeTo(parts, 0);
    return parts.join('');
  }

  private _serializeTo(parts: string[], depth: number): void {
    const indent = '  '.repeat(depth);

    parts.push(`${indent}<${this._name}`);

    // Attributes
    for (const [key, value] of this._attributes) {
      parts.push(` ${key}="${this._escapeAttr(value)}"`);
    }

    if (this._children.length === 0 && this._text === null) {
      parts.push('/>\n');
      return;
    }

    parts.push('>');

    // Text content (no children)
    if (this._text !== null && this._children.length === 0) {
      parts.push(this._escapeText(this._text));
      parts.push(`</${this._name}>\n`);
      return;
    }

    // Mixed content or only children
    if (this._text !== null) {
      parts.push(this._escapeText(this._text));
    }

    if (this._children.length > 0) {
      parts.push('\n');
    }

    for (const child of this._children) {
      child._serializeTo(parts, depth + 1);
    }

    parts.push(`${indent}</${this._name}>\n`);
  }

  private _escapeText(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  private _escapeAttr(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * Create a deep copy of this Element tree.
   * Uses round-trip serialization for a clean, independent copy.
   */
  clone(): Element {
    return Element.parse(this.toXml());
  }
}
