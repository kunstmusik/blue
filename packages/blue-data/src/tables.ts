import { Element } from './serialization/xml-reader';
import { XmlLoadContext } from './serialization/xml-load';
import { checkRoot, readText } from './utilities/xml';

/** Stores Csound function-table source and tracks compile-time table number reservations. */
export class Tables {
  private _tables = '';
  private _compilationVariables = new Map<unknown, unknown>();
  private _ftableNumberSet: Set<number> | null = null;

  /** Creates empty tables or copies another instance's text. Reservations and compilation variables start empty. */
  constructor(other?: Tables) {
    if (other) {
      this._tables = other._tables;
    }
  }

  /** Returns the stored Csound function-table source. */
  getTables(): string {
    return this._tables;
  }

  /** Replaces function-table source and clears cached number reservations. */
  setTables(tables: string): void {
    this._tables = tables;
    this._ftableNumberSet = null;
  }

  /** Returns all stored function-table source. Alias for {@link Tables.getTables}. */
  getAllTables(): string {
    return this._tables;
  }

  /** Reserves and returns the lowest positive number absent from the stored table statements and current reservations. */
  getOpenFTableNumber(): number {
    if (!this._ftableNumberSet) {
      this._ftableNumberSet = getFtableNumberSet(this._tables);
    }

    let counter = 1;
    while (this._ftableNumberSet.has(counter)) {
      counter++;
    }
    this._ftableNumberSet.add(counter);
    return counter;
  }

  /** Marks an explicitly allocated table number as occupied. */
  addFtgenNumber(ftgenNum: number): void {
    if (!this._ftableNumberSet) {
      this._ftableNumberSet = getFtableNumberSet(this._tables);
    }
    this._ftableNumberSet.add(ftgenNum);
  }

  /** Returns a table-scoped compilation value or `undefined` when the key is absent. */
  getCompilationVariable(key: unknown): unknown {
    return this._compilationVariables.get(key);
  }

  /** Stores a table-scoped compilation value by key. Values are omitted from XML. */
  setCompilationVariable(key: unknown, value: unknown): void {
    this._compilationVariables.set(key, value);
  }

  /** Writes the function-table text to a new XML element. */
  saveAsXML(): Element {
    const elem = new Element('tables');
    elem.setText(this._tables);
    return elem;
  }

  /** Reads a function-table element, or returns empty tables if no element was supplied. */
  static loadFromXML(data: Element | null, context?: XmlLoadContext): Tables {
    const tables = new Tables();
    if (!data) return tables;
    const operation = context ?? new XmlLoadContext(data);
    checkRoot(data, 'tables', operation);
    tables.setTables(readText(data, operation));

    return tables;
  }
}

function getFtableNumberSet(ftableText: string): Set<number> {
  const ftableNumbers = new Set<number>();
  const lines = ftableText.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('f') || trimmed.startsWith(';')) {
      continue;
    }

    const match = trimmed.match(/^f\s*(\d+)/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!Number.isNaN(num)) {
        ftableNumbers.add(num);
      }
    }
  }

  return ftableNumbers;
}
