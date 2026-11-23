/**
 * BSBCompilationUnit — collects replacement values and performs text substitution.
 * Mirrors the Java BSBCompilationUnit class.
 *
 * Each BSB widget's `objectName` becomes a `<key>` → `value` replacement pair.
 * During instrument generation, all `<key>` tokens in the instrument text
 * are replaced with their corresponding values.
 */
export class BSBCompilationUnit {
  private replacementValues = new Map<string, string>();

  /** Associates a widget token key with its replacement text, replacing any previous mapping. */
  addReplacementValue(key: string, value: string): void {
    this.replacementValues.set(key, value);
  }

  /**
   * Replace all `<key>` tokens in the instrument text with their values.
   * Uses simple string replacement (matching Java's TextUtilities.replaceAll).
   */
  replaceBSBValues(instrumentText: string): string {
    let result = instrumentText;
    for (const [key, value] of this.replacementValues) {
      result = result.replaceAll(`<${key}>`, value);
    }
    return result;
  }
}
