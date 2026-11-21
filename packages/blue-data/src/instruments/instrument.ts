/**
 * Instrument — abstract base for Csound instruments.
 * Mirrors the Java Instrument class.
 */
import { DeepCopyable, type CopyMode } from '../deep-copyable';
import { Element } from '../serialization/xml-reader';
import type { CompileData } from '../compile-data';
import type { Parameter } from '../automation/parameter';

/** Base class for authored instruments that contribute Csound code and compile-time resources. */
export abstract class Instrument implements DeepCopyable<Instrument> {
  protected _name = '';
  protected _enabled = true;
  protected _comment = '';

  /** Returns the instrument's editable display name. */
  getName(): string {
    return this._name;
  }

  /** Sets the instrument's display name independently of its Csound assignment ID. */
  setName(name: string): void {
    this._name = name;
  }

  /** Returns this instrument's own enabled flag. An arrangement assignment has a separate flag. */
  isEnabled(): boolean {
    return this._enabled;
  }

  /** Sets this instrument's own enabled flag. */
  setEnabled(enabled: boolean): void {
    this._enabled = enabled;
  }

  /** Returns the stored instrument notes. */
  getComment(): string {
    return this._comment;
  }

  /** Replaces the stored instrument notes. */
  setComment(comment: string): void {
    this._comment = comment ?? '';
  }

  /**
   * Generate global orchestra code (common to all instances). The
   * CompileData is the render-scoped context: instruments that own
   * shared module text (like the modern BlueX7 synthesis module) register
   * it once per render through its compilation-variable registry.
   */
  generateGlobalOrc(_compileData?: CompileData): string | null {
    return null;
  }

  /** Generate global score code. */
  generateGlobalSco(): string | null {
    return null;
  }

  /** Generate the instrument's orchestra code. */
  abstract generateInstrument(): string;

  /** Generates the instrument body, allowing implementing instruments to await a host runtime. */
  async generateInstrumentAsync(
    _compileData?: CompileData,
    parameters?: Parameter[],
  ): Promise<string> {
    if (
      parameters &&
      typeof (this as { generateInstrument?: unknown }).generateInstrument === 'function'
    ) {
      return (
        this as unknown as { generateInstrument: (parameters: Parameter[]) => string }
      ).generateInstrument(parameters);
    }

    return this.generateInstrument();
  }

  /** Generate always-on instrument code (if needed). */
  generateAlwaysOnInstrument(): string | null {
    return null;
  }

  /** Generate user-defined opcodes. */
  generateUserDefinedOpcodes(_udoList: unknown): void {
    // Default: no-op
  }

  /** Generate F-tables. */
  generateFTables(_tables: unknown): void {
    // Default: no-op
  }

  /** Copies the concrete instrument with the requested identity policy. */
  abstract deepCopy(mode?: CopyMode): Instrument;

  /** Writes the concrete instrument type and its authored settings to XML. */
  abstract saveAsXML(): Element;
}
