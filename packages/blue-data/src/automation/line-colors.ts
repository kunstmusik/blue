/**
 * LineColors — color configuration for automation parameter lines.
 * Mirrors the Java LineColors class (30 colors from Cecilia).
 */
export class LineColors {
  static readonly DEFAULT_COLORS: number[] = [
    0x20dd00, // green
    0x0000ff, // blue
    0xffa500, // orange
    0x008b00, // dark green
    0xff00ff, // magenta
    0xcd3700, // dark orange
    0x682b8b, // dark purple
    0x00688b, // dark cyan
    0x2f4f4f, // dark slate gray
    0xcd1076, // deep pink
    0x8b6914, // dark goldenrod
    0x458b74, // aquamarine dark
    0x8b4513, // saddle brown
    0x4169e1, // royal blue
    0x8b7d6b, // dark beige
    0x000080, // navy
    0x7cfc00, // lawn green
    0x483d8b, // dark slate blue
    0xffd700, // gold
    0x838b8b, // dark slate gray
    0x8b1a1a, // dark red
    0x7fff00, // chartreuse
    0x8b2323, // brown
    0x8b7355, // burlywood dark
    0x458b74, // aquamarine dark (dup)
    0xfa8072, // salmon
    0x8b3e2f, // indian red dark
    0x008b8b, // dark cyan
    0x458b00, // green dark
    0xa020f0, // purple
  ];

  private _colors: number[] = [...LineColors.DEFAULT_COLORS];

  getColors(): number[] {
    return [...this._colors];
  }

  getColor(index: number): number {
    return this._colors[index % this._colors.length];
  }

  setColors(colors: number[]): void {
    this._colors = [...colors];
  }
}
